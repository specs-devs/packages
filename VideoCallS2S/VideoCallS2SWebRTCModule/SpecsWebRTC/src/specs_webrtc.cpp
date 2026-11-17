/*
 * specs_webrtc.cpp — libdatachannel-backed implementation of the specs_webrtc.h C ABI.
 *
 * This file owns the WebRTC engine (vendored libdatachannel, C API) and exposes
 * only the swrtc_* symbols (everything else is hidden via -fvisibility=hidden +
 * the version script). One swrtc_session wraps one rtc PeerConnection plus up to
 * one video and one audio track.
 *
 * Signaling:
 *   - BUILT-IN (default): a minimal length-prefixed TCP exchange implemented
 *     here (SignalingTransport). The OFFERER dials sig_ip:sig_port (with retry);
 *     the ANSWERER binds/listens on sig_port. SDP + ICE candidates are carried
 *     automatically — callers only swrtc_set_signaling_endpoint() + swrtc_start().
 *   - MANUAL: caller ferries SDP/ICE via on_local_* callbacks + the setters.
 */
#include "specs_webrtc.h"

#include "rtc/rtc.h"
#include <opus.h>
#if SWRTC_HW_ENCODER
#include "hw_video_encoder.hpp"  // device-only built-in H.264 encoder
#endif

#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/select.h>
#include <sys/socket.h>
#include <unistd.h>

#include <strings.h>

#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <ctime>
#include <map>
#include <mutex>
#include <string>
#include <thread>
#include <utility>
#include <vector>

namespace {

constexpr uint8_t kDefaultVideoPayloadType = 96;
constexpr uint8_t kDefaultAudioPayloadType = 111;
constexpr uint32_t kVideoClockRate = 90000;   // H.264 RTP clock
constexpr uint32_t kVideoSsrc = 0xF0000001u;
constexpr uint32_t kAudioSsrc = 0xF0000002u;
constexpr uint32_t kVideoRecvSsrc = 0xF0000003u;  // duplex: our recvonly return-video track
constexpr uint32_t kVideoRtxSsrc  = 0xF0000005u;  // RTX (retransmission) SSRC for the video track
constexpr uint8_t  kVideoRtxPt    = 97;           // RTX payload type (apt = video PT 96)

// Built-in signaling frame types: [1B type][4B BE length][payload].
constexpr uint8_t kMsgOffer = 1;   // payload = SDP
constexpr uint8_t kMsgAnswer = 2;  // payload = SDP
constexpr uint8_t kMsgCand = 3;    // payload = [2B BE mid_len][mid][candidate]

swrtc_state map_state(rtcState s) {
    switch (s) {
        case RTC_NEW:          return SWRTC_STATE_NEW;
        case RTC_CONNECTING:   return SWRTC_STATE_CONNECTING;
        case RTC_CONNECTED:    return SWRTC_STATE_CONNECTED;
        case RTC_DISCONNECTED: return SWRTC_STATE_DISCONNECTED;
        case RTC_FAILED:       return SWRTC_STATE_FAILED;
        case RTC_CLOSED:       return SWRTC_STATE_CLOSED;
    }
    return SWRTC_STATE_NEW;
}

rtcLogLevel map_log_level(swrtc_log_level l) {
    switch (l) {
        case SWRTC_LOG_NONE:  return RTC_LOG_NONE;
        case SWRTC_LOG_ERROR: return RTC_LOG_ERROR;
        case SWRTC_LOG_WARN:  return RTC_LOG_WARNING;
        case SWRTC_LOG_INFO:  return RTC_LOG_INFO;
        case SWRTC_LOG_DEBUG: return RTC_LOG_DEBUG;
    }
    return RTC_LOG_WARNING;
}

// Scan an Annex-B buffer for a keyframe NAL to flag keyframes on receive.
// H.264 IDR = NAL type 5 (byte & 0x1F). H.265 IDR/CRA/BLA = types 16..21
// ((byte >> 1) & 0x3F).
int annexb_has_idr(const uint8_t* d, size_t n, bool h265) {
    for (size_t i = 0; i + 4 < n; ++i) {
        const bool short_sc = (d[i] == 0 && d[i + 1] == 0 && d[i + 2] == 1);
        const bool long_sc  = (d[i] == 0 && d[i + 1] == 0 && d[i + 2] == 0 && d[i + 3] == 1);
        if (!short_sc && !long_sc) continue;
        const size_t off = short_sc ? i + 3 : i + 4;
        if (off >= n) continue;
        if (h265) {
            const int t = (d[off] >> 1) & 0x3F;
            if (t >= 16 && t <= 21) return 1;
        } else if ((d[off] & 0x1F) == 5) {
            return 1;
        }
    }
    return 0;
}

bool write_all(int fd, const void* buf, size_t n) {
    const char* p = static_cast<const char*>(buf);
    while (n > 0) {
        const ssize_t w = ::send(fd, p, n, 0);
        if (w <= 0) return false;
        p += w;
        n -= static_cast<size_t>(w);
    }
    return true;
}

bool read_all(int fd, void* buf, size_t n) {
    char* p = static_cast<char*>(buf);
    while (n > 0) {
        const ssize_t r = ::recv(fd, p, n, 0);
        if (r <= 0) return false;
        p += r;
        n -= static_cast<size_t>(r);
    }
    return true;
}

void sleep_ms(long ms) {
    struct timespec ts { ms / 1000, (ms % 1000) * 1000000L };
    ::nanosleep(&ts, nullptr);
}

constexpr uint32_t kOpusClockRate = 48000;       // Opus RTP clock + encode rate
constexpr int kOpusFrameSamples = 960;           // 20 ms @ 48 kHz (per channel)

inline int16_t clamp_s16(int v) { return static_cast<int16_t>(v < -32768 ? -32768 : (v > 32767 ? 32767 : v)); }

// Linear resampler, interleaved S16, arbitrary input rate -> 48 kHz. Keeps
// fractional position + the last input frame across calls for continuity.
struct Resampler {
    uint32_t in_rate = 0;
    int channels = 0;
    double pos = 0.0;
    std::vector<int16_t> prev;  // last input frame
    bool have_prev = false;

    void reset(uint32_t rate, int ch) {
        in_rate = rate; channels = ch; pos = 0.0; have_prev = false;
        prev.assign(static_cast<size_t>(ch), 0);
    }

    // Append resampled 48 kHz interleaved S16 to `out`.
    void process(const int16_t* in, int frames, std::vector<int16_t>& out) {
        if (frames <= 0) return;
        const double step = static_cast<double>(in_rate) / kOpusClockRate;
        auto sample = [&](int idx, int c) -> double {
            if (idx < 0) return have_prev ? prev[c] : in[c];
            if (idx >= frames) idx = frames - 1;
            return in[idx * channels + c];
        };
        while (pos < frames) {
            const int i = static_cast<int>(std::floor(pos));
            const double frac = pos - i;
            for (int c = 0; c < channels; ++c)
                out.push_back(clamp_s16(static_cast<int>(std::lround(
                    sample(i, c) * (1.0 - frac) + sample(i + 1, c) * frac))));
            pos += step;
        }
        pos -= frames;  // rebase for the next block
        for (int c = 0; c < channels; ++c) prev[c] = in[(frames - 1) * channels + c];
        have_prev = true;
    }
};

}  // namespace

struct SignalingTransport;  // defined below swrtc_session

// One peer connection plus its media tracks and signaling state.
struct swrtc_session {
    swrtc_config    cfg{};
    swrtc_callbacks cb{};
    std::vector<std::string> ice_uris;   // deep copy of cfg.ice_servers
    std::vector<const char*> ice_ptrs;

    int pc = -1;
    int video_tr = -1;
    int video_rx_tr = -1;      // duplex: our recvonly return-video m-line
    int audio_tr = -1;
    bool video_send = false;   // true: we packetize+send; false: we receive
    bool video_duplex = false; // true: send (camera) AND receive (return) video on one PC
    bool audio_send = false;
    bool audio_duplex = false; // true: send (mic) AND receive (remote voice) on one audio m-line
    bool video_is_h265 = false;  // sender: from cfg; receiver: auto-detected from the offered track

    std::atomic<swrtc_state> state{SWRTC_STATE_NEW};

    std::string sig_ip;        // built-in signaling endpoint
    uint16_t    sig_port = 0;
    SignalingTransport* sig = nullptr;

    // Remote ICE candidates that arrived before the remote description was set.
    std::atomic<bool> has_remote_desc{false};
    std::mutex cand_mtx;
    std::vector<std::pair<std::string, std::string>> pending_cands;  // (candidate, mid)

    // Audio codec (libopus, owned by the lib). Encoder/resampler on the send path,
    // decoder on the receive path.
    int audio_channels = 2;
    OpusEncoder* opus_enc = nullptr;       // send: PCM -> Opus
    OpusDecoder* opus_dec = nullptr;       // receive: Opus -> PCM
    Resampler resampler;                   // send: input rate -> 48k
    std::vector<int16_t> accum48k;         // send: resampled 48k samples pending encode
    uint64_t audio_out_samples = 0;        // send: 48k frames emitted (RTP ts)
    std::vector<int16_t> decode_buf;       // receive: scratch for opus_decode
    std::mutex audio_mtx;                  // guards the send-side encoder/resampler/accum

    // Receive-side reordering jitter buffer (ported from the XR-AI engine rev).
    // Wi-Fi on the device reorders and drops RTP heavily; decoding in ARRIVAL
    // order shreds speech into robotic gibberish. Packets are staged here keyed
    // by RTP timestamp and decoded in timestamp order once the buffer holds
    // kAudioJbDepth packets; loss gaps are concealed with Opus PLC.
    std::mutex arx_mtx;
    std::map<uint32_t, std::vector<uint8_t>> arx_jb;
    uint32_t audio_rx_expected_ts = 0;     // next expected RTP ts (48k units)
    bool audio_rx_have_ts = false;         // ...valid once a packet was decoded
    uint32_t arx_max_ts = 0;               // newest ts seen (reorder detection)
    uint64_t arx_pkts = 0;                 // stats: packets received
    uint64_t arx_reordered = 0;            //        arrived out of order
    uint64_t arx_late_dropped = 0;         //        too late (gap already concealed)
    uint64_t arx_gaps = 0;                 //        loss gaps concealed
    uint64_t arx_plc_frames = 0;           //        PLC samples synthesized
    uint64_t arx_red_pkts = 0;             //        RED-wrapped packets unwrapped
    int audio_opus_pt = -1;                // payload types from the remote m-line
    int audio_red_pt = -1;

#if SWRTC_HW_ENCODER
    swrtc_hw::HwVideoEncoder* venc = nullptr;  // built-in H.264 encoder (send_video_raw)
    std::mutex venc_mtx;
#endif

    std::mutex mtx;
};

static void apply_or_buffer_remote_candidate(swrtc_session* s, const std::string& cand,
                                             const std::string& mid) {
    if (s->has_remote_desc.load(std::memory_order_acquire)) {
        rtcAddRemoteCandidate(s->pc, cand.c_str(), mid.empty() ? nullptr : mid.c_str());
    } else {
        std::lock_guard<std::mutex> lk(s->cand_mtx);
        s->pending_cands.emplace_back(cand, mid);
    }
}

static void flush_remote_candidates(swrtc_session* s) {
    std::lock_guard<std::mutex> lk(s->cand_mtx);
    for (auto& c : s->pending_cands)
        rtcAddRemoteCandidate(s->pc, c.first.c_str(), c.second.empty() ? nullptr : c.second.c_str());
    s->pending_cands.clear();
}

// (Re)build and tear down the PeerConnection + tracks for one connection cycle.
// Factored out so the signaling transport can rebuild a fresh PC on every
// (re)connection — the engine of reconnect robustness.
static bool build_pc(swrtc_session* s);
static void teardown_pc(swrtc_session* s);

// Minimal TCP signaling: carries SDP + ICE between the two peers. Outbound SDP/
// candidates are pushed here from the libdatachannel local-description/candidate
// callbacks; inbound ones are read on a worker thread and applied to the PC.
struct SignalingTransport {
    swrtc_session* s;
    swrtc_role     role;
    std::string    ip;
    uint16_t       port;

    int listen_fd = -1;
    int conn_fd = -1;
    std::thread th;
    std::atomic<bool> running{false};
    std::mutex send_mtx;

    SignalingTransport(swrtc_session* sess, swrtc_role r, std::string ip_, uint16_t p)
        : s(sess), role(r), ip(std::move(ip_)), port(p) {}

    ~SignalingTransport() { stop(); }

    void start() {
        running.store(true);
        th = std::thread([this] { role == SWRTC_ROLE_OFFERER ? run_offerer() : run_answerer(); });
    }

    void stop() {
        running.store(false);
        if (conn_fd >= 0)   ::shutdown(conn_fd, SHUT_RDWR);
        if (listen_fd >= 0) ::shutdown(listen_fd, SHUT_RDWR);
        if (th.joinable())  th.join();
        if (conn_fd >= 0)   { ::close(conn_fd);   conn_fd = -1; }
        if (listen_fd >= 0) { ::close(listen_fd); listen_fd = -1; }
    }

    void report_err(const char* m) {
        if (s->cb.on_error) s->cb.on_error(s, SWRTC_ERR_SIGNALING, m, s->cb.user_data);
    }

    void send_frame(uint8_t type, const char* payload, uint32_t len) {
        std::lock_guard<std::mutex> lk(send_mtx);
        if (conn_fd < 0) return;
        uint8_t hdr[5] = {type, static_cast<uint8_t>(len >> 24), static_cast<uint8_t>(len >> 16),
                          static_cast<uint8_t>(len >> 8), static_cast<uint8_t>(len)};
        if (!write_all(conn_fd, hdr, sizeof(hdr))) return;
        if (len) write_all(conn_fd, payload, len);
    }

    void send_sdp(swrtc_sdp_type t, const char* sdp) {
        send_frame(t == SWRTC_SDP_ANSWER ? kMsgAnswer : kMsgOffer, sdp,
                   static_cast<uint32_t>(std::strlen(sdp)));
    }

    void send_candidate(const char* mid, const char* cand) {
        const std::string m = mid ? mid : "";
        const std::string c = cand ? cand : "";
        std::string payload;
        payload.reserve(2 + m.size() + c.size());
        payload.push_back(static_cast<char>((m.size() >> 8) & 0xFF));
        payload.push_back(static_cast<char>(m.size() & 0xFF));
        payload += m;
        payload += c;
        send_frame(kMsgCand, payload.data(), static_cast<uint32_t>(payload.size()));
    }

    void read_loop() {
        while (running.load()) {
            uint8_t hdr[5];
            if (!read_all(conn_fd, hdr, sizeof(hdr))) break;
            const uint8_t type = hdr[0];
            const uint32_t len = (static_cast<uint32_t>(hdr[1]) << 24) |
                                 (static_cast<uint32_t>(hdr[2]) << 16) |
                                 (static_cast<uint32_t>(hdr[3]) << 8) | hdr[4];
            std::string payload;
            payload.resize(len);
            if (len && !read_all(conn_fd, payload.data(), len)) break;

            if (type == kMsgOffer) {
                rtcSetRemoteDescription(s->pc, payload.c_str(), "offer");
                s->has_remote_desc.store(true, std::memory_order_release);
                flush_remote_candidates(s);
                rtcSetLocalDescription(s->pc, "answer");  // -> on_localdesc sends the answer
            } else if (type == kMsgAnswer) {
                rtcSetRemoteDescription(s->pc, payload.c_str(), "answer");
                s->has_remote_desc.store(true, std::memory_order_release);
                flush_remote_candidates(s);
            } else if (type == kMsgCand && payload.size() >= 2) {
                const uint16_t ml = (static_cast<uint8_t>(payload[0]) << 8) |
                                    static_cast<uint8_t>(payload[1]);
                if (static_cast<size_t>(2 + ml) <= payload.size()) {
                    apply_or_buffer_remote_candidate(s, payload.substr(2 + ml), payload.substr(2, ml));
                }
            }
        }
    }

    // Close just the per-connection socket (not the listener), so the loop can
    // start a fresh cycle. Guarded by send_mtx so it can't race a send_frame().
    void close_conn() {
        std::lock_guard<std::mutex> lk(send_mtx);
        if (conn_fd >= 0) { ::shutdown(conn_fd, SHUT_RDWR); ::close(conn_fd); conn_fd = -1; }
    }

    // Dial the answerer, retrying indefinitely until connected or stopped. This
    // is what makes "start the Mac viewer after the device" (or after a restart)
    // just work — the offerer keeps knocking. Returns true with conn_fd set.
    bool dial_with_retry() {
        while (running.load()) {
            const int fd = ::socket(AF_INET, SOCK_STREAM, 0);
            if (fd < 0) { report_err("signaling socket() failed"); return false; }
            sockaddr_in a{};
            a.sin_family = AF_INET;
            a.sin_port = htons(port);
            if (::inet_pton(AF_INET, ip.c_str(), &a.sin_addr) != 1) {
                ::close(fd);
                report_err("invalid signaling ip");
                return false;
            }
            if (::connect(fd, reinterpret_cast<sockaddr*>(&a), sizeof(a)) == 0) {
                std::lock_guard<std::mutex> lk(send_mtx);
                conn_fd = fd;
                return true;
            }
            ::close(fd);
            sleep_ms(300);  // answerer not up / restarting — keep trying
        }
        return false;
    }

    // OFFERER: (re)dial → fresh PC → offer → pump → on disconnect, rebuild & redial.
    void run_offerer() {
        bool first = true;  // first cycle reuses the PC built in session_create
        while (running.load()) {
            if (!dial_with_retry()) break;
            if (!first && !build_pc(s)) { close_conn(); sleep_ms(300); continue; }
            first = false;
            rtcSetLocalDescription(s->pc, "offer");  // -> on_localdesc sends OFFER + candidates
            read_loop();                             // returns when the connection drops
            close_conn();
            teardown_pc(s);
            if (running.load()) sleep_ms(300);
        }
    }

    bool setup_listen() {
        listen_fd = ::socket(AF_INET, SOCK_STREAM, 0);
        if (listen_fd < 0) { report_err("signaling socket() failed"); return false; }
        const int one = 1;
        ::setsockopt(listen_fd, SOL_SOCKET, SO_REUSEADDR, &one, sizeof(one));
        sockaddr_in a{};
        a.sin_family = AF_INET;
        a.sin_addr.s_addr = INADDR_ANY;
        a.sin_port = htons(port);
        if (!ip.empty() && ip != "0.0.0.0") ::inet_pton(AF_INET, ip.c_str(), &a.sin_addr);
        if (::bind(listen_fd, reinterpret_cast<sockaddr*>(&a), sizeof(a)) < 0) {
            report_err("signaling bind failed");
            return false;
        }
        if (::listen(listen_fd, 4) < 0) { report_err("signaling listen failed"); return false; }
        return true;
    }

    // Interruptible accept: shutdown() of a listening socket does NOT unblock a
    // blocked accept() on macOS/BSD, so poll with select() and re-check running()
    // — otherwise stop()/join() would deadlock on teardown. Returns -1 if stopped.
    int accept_one() {
        while (running.load()) {
            fd_set rfds;
            FD_ZERO(&rfds);
            FD_SET(listen_fd, &rfds);
            timeval tv{0, 200000};  // 200 ms
            const int sel = ::select(listen_fd + 1, &rfds, nullptr, nullptr, &tv);
            if (sel < 0) { if (errno == EINTR) continue; return -1; }
            if (sel == 0) continue;  // timeout: re-check running
            return ::accept(listen_fd, nullptr, nullptr);
        }
        return -1;
    }

    // ANSWERER: keep listening; for each inbound connection build a fresh PC and
    // pump it. This is what lets the viewer survive a lens restart — when the old
    // device connection drops it loops back and accepts the new one.
    void run_answerer() {
        if (!setup_listen()) return;
        bool first = true;  // first cycle reuses the PC built in session_create
        while (running.load()) {
            const int fd = accept_one();
            if (fd < 0) break;
            { std::lock_guard<std::mutex> lk(send_mtx); conn_fd = fd; }
            if (!first && !build_pc(s)) { close_conn(); continue; }
            first = false;
            read_loop();  // reads OFFER -> applies -> answer generated via callback
            close_conn();
            teardown_pc(s);
        }
    }
};

// ---- libdatachannel C-callback trampolines (recover session from user ptr) ----

static void RTC_API on_state_tramp(int /*pc*/, rtcState st, void* ptr) {
    auto* s = static_cast<swrtc_session*>(ptr);
    if (!s) return;
    const swrtc_state mapped = map_state(st);
    s->state.store(mapped, std::memory_order_relaxed);
    if (s->cb.on_state) s->cb.on_state(s, mapped, s->cb.user_data);
}

static void RTC_API on_localdesc_tramp(int /*pc*/, const char* sdp, const char* type, void* ptr) {
    auto* s = static_cast<swrtc_session*>(ptr);
    if (!s) return;
    const swrtc_sdp_type t =
        (type && std::strcmp(type, "answer") == 0) ? SWRTC_SDP_ANSWER : SWRTC_SDP_OFFER;
    if (s->sig) s->sig->send_sdp(t, sdp ? sdp : "");                       // built-in signaling
    if (s->cb.on_local_description) s->cb.on_local_description(s, t, sdp ? sdp : "", s->cb.user_data);
}

static void RTC_API on_localcand_tramp(int /*pc*/, const char* cand, const char* mid, void* ptr) {
    auto* s = static_cast<swrtc_session*>(ptr);
    if (!s) return;
    if (s->sig) s->sig->send_candidate(mid, cand);                         // built-in signaling
    if (s->cb.on_local_candidate) s->cb.on_local_candidate(s, cand ? cand : "", mid, s->cb.user_data);
}

// Depacketized media frames arrive via the track FRAME callback (not the message
// callback, which is for data-channel/raw messages). rtcFrameInfo carries the RTP
// timestamp + payload type, so we recover pts_us here.
static uint64_t pts_us_from(const rtcFrameInfo* info, uint32_t clock_rate) {
    if (!info) return 0;
    if (info->timestampSeconds >= 0) return static_cast<uint64_t>(info->timestampSeconds * 1e6);
    return static_cast<uint64_t>(info->timestamp) * 1000000ULL / clock_rate;
}

static void RTC_API on_video_frame_tramp(int /*tr*/, const char* data, int size,
                                         const rtcFrameInfo* info, void* ptr) {
    auto* s = static_cast<swrtc_session*>(ptr);
    if (!s || size <= 0 || !s->cb.on_video_frame) return;
    const auto* d = reinterpret_cast<const uint8_t*>(data);
    s->cb.on_video_frame(s, d, static_cast<size_t>(size), pts_us_from(info, kVideoClockRate),
                         annexb_has_idr(d, static_cast<size_t>(size), s->video_is_h265), s->cb.user_data);
}

// RFC 2198 RED: locate the PRIMARY payload inside a redundant-audio packet.
// Some senders wrap Opus in RED (pt "red/48000"); feeding the RED container to
// opus_decode "succeeds" but yields garbage audio. Layout: N 4-byte headers
// (F=1) for redundant blocks, then a 1-byte final header (F=0), then the
// redundant payloads in order, then the primary payload.
static bool red_primary_payload(const uint8_t* d, int n, const uint8_t** out, int* out_n) {
    int i = 0;
    int redundant_bytes = 0;
    while (i < n) {
        if ((d[i] & 0x80) == 0) { i += 1; break; }  // final header -> primary follows blocks
        if (i + 4 > n) return false;
        redundant_bytes += ((d[i + 2] & 0x03) << 8) | d[i + 3];
        i += 4;
    }
    if (i <= 0 || i + redundant_bytes >= n) return false;
    *out = d + i + redundant_bytes;
    *out_n = n - i - redundant_bytes;
    return true;
}

// Decode one staged Opus packet in timestamp order and deliver PCM. Loss gaps
// in front of the packet are filled with Opus packet-loss concealment (capped;
// longer gaps such as DTX pauses resync silently). Caller holds arx_mtx.
static void decode_and_deliver_locked(swrtc_session* s, uint32_t ts,
                                      const uint8_t* data, int size) {
    const int ch = s->audio_channels;
    if (s->decode_buf.size() < static_cast<size_t>(5760 * ch))
        s->decode_buf.resize(static_cast<size_t>(5760 * ch));  // up to 120 ms @ 48k

    if (s->audio_rx_have_ts) {
        int32_t gap = static_cast<int32_t>(ts - s->audio_rx_expected_ts);
        if (gap > 0 && gap <= 9600) {  // conceal up to 200 ms of real loss
            s->arx_gaps++;
            while (gap > 0) {
                const int want = gap > 5760 ? 5760 : gap;
                const int plc = opus_decode(s->opus_dec, nullptr, 0, s->decode_buf.data(), want, 0);
                if (plc <= 0) break;
                s->arx_plc_frames += static_cast<uint64_t>(plc);
                s->cb.on_audio_frame(s, s->decode_buf.data(), plc, ch, kOpusClockRate,
                                     static_cast<uint64_t>(ts) * 1000000ULL / kOpusClockRate,
                                     s->cb.user_data);
                gap -= plc;
            }
        }
    }

    const int frames = opus_decode(s->opus_dec, reinterpret_cast<const unsigned char*>(data), size,
                                   s->decode_buf.data(), 5760, /*decode_fec=*/0);
    if (frames <= 0) return;
    s->audio_rx_expected_ts = ts + static_cast<uint32_t>(frames);
    s->audio_rx_have_ts = true;
    s->cb.on_audio_frame(s, s->decode_buf.data(), frames, ch, kOpusClockRate,
                         static_cast<uint64_t>(ts) * 1000000ULL / kOpusClockRate, s->cb.user_data);
}

// Inbound Opus packet: stage in the reordering jitter buffer, then decode the
// oldest packets in TIMESTAMP order once enough are buffered. Depth 4 packets
// (~80 ms at the phone's 20 ms packetization — a wider absorption window than
// the XR-AI rev's 60 ms) absorbs Wi-Fi reordering; the downstream speaker
// prime buffer absorbs the added latency.
static constexpr size_t kAudioJbDepth = 4;

static void RTC_API on_audio_frame_tramp(int /*tr*/, const char* data, int size,
                                         const rtcFrameInfo* info, void* ptr) {
    auto* s = static_cast<swrtc_session*>(ptr);
    if (!s || size <= 0 || !s->cb.on_audio_frame || !s->opus_dec || !info) return;

    std::lock_guard<std::mutex> lk(s->arx_mtx);
    s->arx_pkts++;

    // Unwrap RED (redundant audio) down to the primary Opus block. Only when
    // the remote m-line actually declared payload types (learned in
    // on_track_tramp) — with unknown pts every packet is treated as plain
    // Opus, preserving the pre-JB behavior.
    const uint8_t* payload = reinterpret_cast<const uint8_t*>(data);
    int payload_size = size;
    const int pt = static_cast<int>(info->payloadType);
    if (s->audio_opus_pt >= 0 && pt != s->audio_opus_pt) {
        const uint8_t* prim = nullptr;
        int prim_n = 0;
        if (red_primary_payload(payload, payload_size, &prim, &prim_n)) {
            payload = prim;
            payload_size = prim_n;
            s->arx_red_pkts++;
        } else if (s->audio_red_pt >= 0 && pt == s->audio_red_pt) {
            return;  // declared RED but malformed — drop rather than decode garbage
        }
    }

    const uint32_t ts = info->timestamp;
    // First packets: trace payload type + ts delta vs decoded duration. This is
    // how a codec mismatch (e.g. RED-wrapped Opus fed to a plain decoder) shows
    // itself: pt differs from the negotiated one, or ts deltas != frame counts.
    if (s->arx_pkts <= 30) {
        static uint32_t prev_ts = 0;
        std::fprintf(stderr, "[swrtc] arx pkt#%llu pt=%u size=%d ts=%u dts=%d\n",
                     static_cast<unsigned long long>(s->arx_pkts),
                     static_cast<unsigned>(info->payloadType), size, ts,
                     s->arx_pkts > 1 ? static_cast<int32_t>(ts - prev_ts) : 0);
        prev_ts = ts;
    }
    if (s->arx_pkts > 1 && static_cast<int32_t>(ts - s->arx_max_ts) < 0)
        s->arx_reordered++;
    else
        s->arx_max_ts = ts;
    if (s->audio_rx_have_ts && static_cast<int32_t>(ts - s->audio_rx_expected_ts) < 0) {
        s->arx_late_dropped++;  // gap already played/concealed; playing it now would garble
        return;
    }
    s->arx_jb[ts].assign(payload, payload + payload_size);
    while (s->arx_jb.size() > kAudioJbDepth) {
        auto it = s->arx_jb.begin();
        const uint32_t pts = it->first;
        std::vector<uint8_t> pkt = std::move(it->second);
        s->arx_jb.erase(it);
        decode_and_deliver_locked(s, pts, pkt.data(), static_cast<int>(pkt.size()));
    }
}

// Duplex audio: the SAME sendrecv m-line that carries our mic also delivers the
// remote's voice. The libdatachannel C API has no chainable Opus depacketizer
// (rtcSetOpusDepacketizer would REPLACE the packetizer we send with), so the raw
// RTP reaches us through the track MESSAGE callback and we strip the header here
// — an Opus RTP payload is exactly one Opus packet (RFC 7587) — then hand it to
// the same jitter-buffer path the receive-only session uses.
static void RTC_API on_audio_rtp_tramp(int tr, const char* data, int size, void* ptr) {
    auto* s = static_cast<swrtc_session*>(ptr);
    if (!s || !data || size < 12) return;  // size < 0 = string message: not RTP
    const auto* d = reinterpret_cast<const uint8_t*>(data);
    if ((d[0] >> 6) != 2) return;            // RTP version 2 only
    if (d[1] >= 192 && d[1] <= 223) return;  // RTCP payload-type range — the chain owns RTCP
    const bool has_padding = (d[0] & 0x20) != 0;
    const bool has_ext = (d[0] & 0x10) != 0;
    const int cc = d[0] & 0x0f;
    size_t hdr = 12 + 4 * static_cast<size_t>(cc);
    size_t end = static_cast<size_t>(size);
    if (hdr > end) return;
    if (has_ext) {
        if (hdr + 4 > end) return;
        const size_t ext_words = (static_cast<size_t>(d[hdr + 2]) << 8) | d[hdr + 3];
        hdr += 4 + 4 * ext_words;
        if (hdr > end) return;
    }
    if (has_padding) {
        const size_t pad = d[end - 1];
        if (pad == 0 || pad > end - hdr) return;
        end -= pad;
    }
    if (end <= hdr) return;
    rtcFrameInfo info{};
    info.timestamp = (static_cast<uint32_t>(d[4]) << 24) | (static_cast<uint32_t>(d[5]) << 16) |
                     (static_cast<uint32_t>(d[6]) << 8) | static_cast<uint32_t>(d[7]);
    info.payloadType = static_cast<uint8_t>(d[1] & 0x7f);
    info.timestampSeconds = -1.0;
    on_audio_frame_tramp(tr, reinterpret_cast<const char*>(d + hdr), static_cast<int>(end - hdr),
                         &info, ptr);
}

// A remote track appeared (we are the receiver). libdatachannel creates the
// track from the remote offer's m-line; we attach the matching depacketizer +
// RTCP receiving session and route assembled frames to the user callback. The
// sender labels its m-lines mid "video"/"audio", so we branch on that.
static void RTC_API on_track_tramp(int /*pc*/, int tr, void* ptr) {
    auto* s = static_cast<swrtc_session*>(ptr);
    if (!s) return;
    char mid[64] = {0};
    rtcGetTrackMid(tr, mid, sizeof(mid));
    rtcSetUserPointer(tr, s);
    // Identify the track by codec, not just mid: our own sender labels m-lines
    // "video"/"audio", but foreign offerers (e.g. libwebrtc on a phone) assign
    // mids like "0"/"1". The track description's rtpmap tells the truth.
    char probe[2048] = {0};
    rtcGetTrackDescription(tr, probe, sizeof(probe));
    const bool is_audio = (std::strcmp(mid, "audio") == 0) ||
                          (std::strstr(probe, "opus") != nullptr) ||
                          (std::strstr(probe, "OPUS") != nullptr);
    if (is_audio) {
        if (!s->opus_dec) {
            int err = 0;
            s->opus_dec = opus_decoder_create(kOpusClockRate, s->audio_channels, &err);
        }
        // Learn the opus and RED payload types from the remote m-line so the
        // decode path can unwrap RED-encapsulated packets if the sender uses them.
        for (const char* p = probe; (p = std::strstr(p, "a=rtpmap:")) != nullptr; ++p) {
            const int rpt = std::atoi(p + 9);
            const char* sp = std::strchr(p, ' ');
            if (!sp) continue;
            if (strncasecmp(sp + 1, "opus/", 5) == 0) s->audio_opus_pt = rpt;
            else if (strncasecmp(sp + 1, "red/", 4) == 0) s->audio_red_pt = rpt;
        }
        rtcSetOpusDepacketizer(tr);
        rtcChainRtcpReceivingSession(tr);
        rtcSetFrameCallback(tr, on_audio_frame_tramp);
        s->audio_tr = tr;
    } else {  // default to video
        // Auto-detect the offered codec from the track's SDP m-line so the receiver
        // follows whatever the sender chose (H.264 or H.265) — no config needed.
        char desc[2048] = {0};
        rtcGetTrackDescription(tr, desc, sizeof(desc));
        const bool h265 = (std::strstr(desc, "H265") != nullptr) ||
                          (std::strstr(desc, "h265") != nullptr) ||
                          (std::strstr(desc, "HEVC") != nullptr);
        s->video_is_h265 = h265;
        if (h265) rtcSetH265Depacketizer(tr, RTC_NAL_SEPARATOR_START_SEQUENCE);
        else      rtcSetH264Depacketizer(tr, RTC_NAL_SEPARATOR_START_SEQUENCE);
        rtcChainRtcpReceivingSession(tr);
        rtcSetFrameCallback(tr, on_video_frame_tramp);
        s->video_tr = tr;
    }
}

// ---- send-track setup (this peer transmits) ----------------------------------

// Remote asked for a fresh keyframe (RTCP PLI). Force one on the built-in encoder
// if it's driving this track, and surface the request to the caller's callback
// (callers feeding pre-encoded H.264 emit their own IDR).
static void RTC_API on_pli_tramp(int /*tr*/, void* ptr) {
    auto* s = static_cast<swrtc_session*>(ptr);
    if (!s) return;
#if SWRTC_HW_ENCODER
    {
        std::lock_guard<std::mutex> lk(s->venc_mtx);
        if (s->venc) s->venc->requestKeyframe();
    }
#endif
    if (s->cb.on_keyframe_request) s->cb.on_keyframe_request(s, s->cb.user_data);
}

static int setup_video_send_track(swrtc_session* s, uint8_t pt) {
    const bool h265 = (s->cfg.video_codec == SWRTC_VIDEO_H265);
    s->video_is_h265 = h265;
    rtcTrackInit ti{};
    ti.direction   = s->video_duplex ? RTC_DIRECTION_SENDRECV : RTC_DIRECTION_SENDONLY;
    ti.codec       = h265 ? RTC_CODEC_H265 : RTC_CODEC_H264;
    ti.payloadType = pt;
    ti.ssrc        = kVideoSsrc;
    ti.mid         = "video";
    ti.name        = "video";
    ti.msid        = "specs-stream";
    ti.trackId     = "video";
    // H.264 fmtp — strict answerers (e.g. Decart) won't negotiate H.264 without a
    // profile-level-id + packetization-mode. Constrained-baseline 3.1, mode 1.
    if (!h265) ti.profile = "profile-level-id=42e01f;packetization-mode=1;level-asymmetry-allowed=1";

    const int tr = rtcAddTrackEx(s->pc, &ti);
    if (tr < 0) return tr;

    rtcPacketizerInit pi{};
    pi.ssrc            = kVideoSsrc;
    pi.cname           = "video";
    pi.payloadType     = pt;
    pi.clockRate       = kVideoClockRate;
    pi.nalSeparator    = RTC_NAL_SEPARATOR_START_SEQUENCE;  // our encoder emits Annex-B
    pi.maxFragmentSize = 0;                                 // default (MTU-derived)
    if (h265) rtcSetH265Packetizer(tr, &pi);
    else      rtcSetH264Packetizer(tr, &pi);
    rtcChainRtcpSrReporter(tr);
    rtcChainRtcpNackResponder(tr, RTC_DEFAULT_MAX_STORED_PACKET_COUNT);
    rtcSetUserPointer(tr, s);          // so on_pli_tramp can recover the session
    rtcChainPliHandler(tr, on_pli_tramp);
    // Pace the outgoing H.264 RTP. rtcSendMessage blasts a whole access unit's
    // packets back-to-back — a keyframe is tens of KB, i.e. 40-150 ms of wire
    // time on a loaded Wi-Fi uplink — and every 20 ms Opus audio packet queues
    // BEHIND that burst on the same socket (this engine has no congestion
    // control). Draining at 2x the nominal video bitrate in 5 ms slices smooths
    // the bursts so audio interleaves, without throttling steady-state video.
    {
        // Floor of 8 Mbps: the session bitrate is runtime-tunable now
        // (swrtc_set_video_bitrate), so the pacer must never sit below the
        // highest preset a user can switch to mid-call — it only smooths
        // bursts, it must never become the throttle.
        const uint32_t kbps = s->cfg.video_bitrate_kbps ? s->cfg.video_bitrate_kbps : 2500;
        const double paceKbps = std::max(2.0 * static_cast<double>(kbps), 8000.0);
        rtcChainPacingHandler(tr, 1000.0 * paceKbps, 5);
    }
    if (s->video_duplex) {
        // This same sendrecv m-line also RECEIVES the remote's return (transformed) track.
        // NOTE: RTX negotiation is DISABLED — adding `a=rtpmap:97 rtx` + `a=ssrc-group:FID`
        // to the offer made Decart's WS signaling proxy stop answering entirely. Without RTX,
        // NACK can't fetch retransmissions, but the reorder/jitter buffer below still recovers
        // out-of-order / slightly-late packets (the likely cause on a healthy network).
        //   rtcSetTrackRtx(tr, kVideoRtxPt, kVideoRtxSsrc);   // re-enable only if the SDP is made Decart-acceptable
        (void)kVideoRtxPt;
        (void)kVideoRtxSsrc;
        // Receive chain: depacketizer (keeps the packetizer above) + reorder/jitter buffer
        // (+ NACK, harmless if unhonored) + receiving RTCP session. chainMediaHandler appends
        // at the tail and incoming runs tail-first, so effective incoming order is:
        // ReceivingSession → NackReorder (reorder) → Depacketizer.
        if (h265) rtcChainH265Depacketizer(tr, RTC_NAL_SEPARATOR_START_SEQUENCE);
        else      rtcChainH264Depacketizer(tr, RTC_NAL_SEPARATOR_START_SEQUENCE);
        rtcChainNackReorder(tr);
        rtcChainRtcpReceivingSession(tr);
        rtcSetFrameCallback(tr, on_video_frame_tramp);
    }
    return tr;
}

// ---- recv-track setup (duplex: this peer also receives a return video track) ----
// Adds a locally-declared RECVONLY video m-line and attaches the depacketizer +
// RTCP receiving session + frame callback directly (the track is ours, not created
// from a remote offer, so on_track_tramp does not fire for it).
[[maybe_unused]] static int setup_video_recv_track(swrtc_session* s, uint8_t pt) {
    const bool h265 = (s->cfg.video_codec == SWRTC_VIDEO_H265);
    rtcTrackInit ti{};
    ti.direction   = RTC_DIRECTION_RECVONLY;
    ti.codec       = h265 ? RTC_CODEC_H265 : RTC_CODEC_H264;
    ti.payloadType = pt;
    ti.ssrc        = kVideoRecvSsrc;
    ti.mid         = "video-in";
    ti.name        = "video-in";
    ti.msid        = "specs-return";
    ti.trackId     = "video-in";

    const int tr = rtcAddTrackEx(s->pc, &ti);
    if (tr < 0) return tr;

    if (h265) rtcSetH265Depacketizer(tr, RTC_NAL_SEPARATOR_START_SEQUENCE);
    else      rtcSetH264Depacketizer(tr, RTC_NAL_SEPARATOR_START_SEQUENCE);
    rtcChainRtcpReceivingSession(tr);
    rtcSetUserPointer(tr, s);
    rtcSetFrameCallback(tr, on_video_frame_tramp);
    return tr;
}

static int setup_audio_send_track(swrtc_session* s, uint8_t pt) {
    rtcTrackInit ti{};
    ti.direction   = s->audio_duplex ? RTC_DIRECTION_SENDRECV : RTC_DIRECTION_SENDONLY;
    ti.codec       = RTC_CODEC_OPUS;
    ti.payloadType = pt;
    ti.ssrc        = kAudioSsrc;
    ti.mid         = "audio";
    ti.name        = "audio";
    ti.msid        = "specs-stream";
    ti.trackId     = "audio";

    const int tr = rtcAddTrackEx(s->pc, &ti);
    if (tr < 0) return tr;

    rtcPacketizerInit pi{};
    pi.ssrc        = kAudioSsrc;
    pi.cname       = "audio";
    pi.payloadType = pt;
    pi.clockRate   = kOpusClockRate;  // Opus RTP clock is always 48 kHz
    rtcSetOpusPacketizer(tr, &pi);
    rtcChainRtcpSrReporter(tr);
    if (s->audio_duplex) {
        // This same sendrecv m-line also RECEIVES the remote's voice: decoder up
        // front (the receive-only path creates it lazily in on_track_tramp, which
        // never fires for a track we declared ourselves), RTCP receiving session
        // for the inbound SSRC, and the raw-RTP message callback that feeds the
        // jitter buffer. Both ends of a device-to-device call run this engine, so
        // the remote's Opus rides our own payload type — RED is never negotiated.
        if (!s->opus_dec) {
            int err = 0;
            s->opus_dec = opus_decoder_create(kOpusClockRate, s->audio_channels, &err);
        }
        s->audio_opus_pt = pt;
        rtcChainRtcpReceivingSession(tr);
        rtcSetUserPointer(tr, s);
        rtcSetMessageCallback(tr, on_audio_rtp_tramp);
    }

    // Opus encoder + resampler (lib owns the codec). Created once and reused
    // across reconnects (guard avoids leaking on PC rebuild).
    if (!s->opus_enc) {
        int err = 0;
        // VOIP application (was AUDIO): this track only ever carries mic speech,
        // and in-band FEC below is produced only in the SILK/hybrid modes that
        // VOIP+SIGNAL_VOICE bias the encoder toward.
        s->opus_enc = opus_encoder_create(kOpusClockRate, s->audio_channels, OPUS_APPLICATION_VOIP, &err);
        if (s->opus_enc) {
            const int br = (s->cfg.audio_bitrate_kbps ? s->cfg.audio_bitrate_kbps : 64) * 1000;
            opus_encoder_ctl(s->opus_enc, OPUS_SET_BITRATE(br));
            // Loss resilience: each packet carries a low-rate copy of the previous
            // frame (LBRR), so a single lost packet is rebuilt by the receiver's
            // NetEQ instead of concealed. The offered fmtp already advertises
            // useinbandfec=1 (libdatachannel default); without these ctls the
            // encoder never actually spends bits on it. Costs stay inside the
            // configured bitrate — worth it on Wi-Fi where audio shares the
            // uplink with the POV video.
            opus_encoder_ctl(s->opus_enc, OPUS_SET_SIGNAL(OPUS_SIGNAL_VOICE));
            opus_encoder_ctl(s->opus_enc, OPUS_SET_INBAND_FEC(1));
            opus_encoder_ctl(s->opus_enc, OPUS_SET_PACKET_LOSS_PERC(15));
        }
        s->resampler.reset(0, s->audio_channels);  // in_rate set on first send_audio_pcm
    }
    return tr;
}

// Send one H.264 Annex-B access unit on the video track at the given PTS.
static swrtc_result send_video_annexb(swrtc_session* s, const uint8_t* annexb, int size,
                                      uint64_t pts_us) {
    if (s->video_tr < 0 || !s->video_send) return SWRTC_ERR_INVALID_STATE;
    if (s->state.load(std::memory_order_relaxed) != SWRTC_STATE_CONNECTED)
        return SWRTC_ERR_NOT_CONNECTED;
    rtcSetTrackRtpTimestamp(s->video_tr, static_cast<uint32_t>((pts_us * kVideoClockRate) / 1000000ULL));
    return rtcSendMessage(s->video_tr, reinterpret_cast<const char*>(annexb), size) >= 0
               ? SWRTC_OK : SWRTC_ERR_TRANSPORT;
}

// Send one Opus packet on the audio track at the given 48k RTP timestamp.
static swrtc_result send_opus_on_track(swrtc_session* s, const unsigned char* opus, int size,
                                       uint32_t rtp_ts) {
    if (s->audio_tr < 0 || !s->audio_send) return SWRTC_ERR_INVALID_STATE;
    if (s->state.load(std::memory_order_relaxed) != SWRTC_STATE_CONNECTED)
        return SWRTC_ERR_NOT_CONNECTED;
    rtcSetTrackRtpTimestamp(s->audio_tr, rtp_ts);
    return rtcSendMessage(s->audio_tr, reinterpret_cast<const char*>(opus), size) >= 0
               ? SWRTC_OK : SWRTC_ERR_TRANSPORT;
}

// ---- public ABI --------------------------------------------------------------

extern "C" {

const char* swrtc_version_string(void) {
    return "0.2.0";
}

void swrtc_set_log_level(swrtc_log_level level) {
    rtcInitLogger(map_log_level(level), nullptr);
}

void swrtc_config_default(swrtc_config* config) {
    if (!config) return;
    std::memset(config, 0, sizeof(*config));
    config->role           = SWRTC_ROLE_OFFERER;
    config->signaling_mode = SWRTC_SIGNALING_BUILTIN;
    config->video_codec    = SWRTC_VIDEO_H264;
    config->video_fps      = 30;
    config->video_bitrate_kbps = 4000;
    config->audio_codec    = SWRTC_AUDIO_OPUS;
    config->audio_sample_rate = 48000;
    config->audio_channels = 2;
    config->audio_bitrate_kbps = 64;
    config->lan_only       = 1;
}

swrtc_result swrtc_session_create(const swrtc_config* config,
                                  const swrtc_callbacks* callbacks,
                                  swrtc_session** out_session) {
    if (!config || !callbacks || !out_session) return SWRTC_ERR_INVALID_ARG;
    *out_session = nullptr;

    auto* s = new (std::nothrow) swrtc_session();
    if (!s) return SWRTC_ERR_NO_MEMORY;
    s->cfg = *config;
    s->cb  = *callbacks;
    s->audio_channels = config->audio_channels ? static_cast<int>(config->audio_channels) : 2;

    // Deep-copy ICE server URIs so we don't alias caller memory.
    if (config->ice_servers && config->ice_server_count > 0 && !config->lan_only) {
        s->ice_uris.reserve(config->ice_server_count);
        for (size_t i = 0; i < config->ice_server_count; ++i)
            s->ice_uris.emplace_back(config->ice_servers[i] ? config->ice_servers[i] : "");
        s->ice_ptrs.reserve(s->ice_uris.size());
        for (auto& u : s->ice_uris) s->ice_ptrs.push_back(u.c_str());
    }

    // A media type is "send" when its codec is set and no receive callback is
    // provided; providing on_*_frame marks this peer as the receiver.
    // Duplex overrides for video: when video_duplex is requested with both a codec
    // and a frame callback, we BOTH send (camera) and receive (return) video.
    s->video_duplex = (config->video_codec != SWRTC_VIDEO_NONE) &&
                      (config->video_duplex != 0) && (callbacks->on_video_frame != nullptr);
    s->video_send = (config->video_codec != SWRTC_VIDEO_NONE) &&
                    (callbacks->on_video_frame == nullptr || s->video_duplex);
    // Same override for audio: audio_duplex + a codec + on_audio_frame means we
    // BOTH send (mic) and receive (remote voice) on one sendrecv audio m-line.
    s->audio_duplex = (config->audio_codec != SWRTC_AUDIO_NONE) &&
                      (config->audio_duplex != 0) && (callbacks->on_audio_frame != nullptr);
    s->audio_send = (config->audio_codec != SWRTC_AUDIO_NONE) &&
                    (callbacks->on_audio_frame == nullptr || s->audio_duplex);

    if (!build_pc(s)) {
        delete s;
        return SWRTC_ERR_TRANSPORT;
    }

    *out_session = s;
    return SWRTC_OK;
}

// Create the PeerConnection + media tracks + callbacks for one connection cycle.
// Called by session_create and again by the signaling loop on every reconnect.
static bool build_pc(swrtc_session* s) {
    s->state.store(SWRTC_STATE_NEW, std::memory_order_relaxed);

    rtcConfiguration rc{};
    std::memset(&rc, 0, sizeof(rc));
    if (!s->ice_ptrs.empty()) {
        rc.iceServers      = s->ice_ptrs.data();
        rc.iceServersCount = static_cast<int>(s->ice_ptrs.size());
    }
    rc.disableAutoNegotiation = true;  // we drive offer/answer explicitly

    s->pc = rtcCreatePeerConnection(&rc);
    if (s->pc < 0) return false;

    rtcSetUserPointer(s->pc, s);
    rtcSetStateChangeCallback(s->pc, on_state_tramp);
    rtcSetLocalDescriptionCallback(s->pc, on_localdesc_tramp);
    rtcSetLocalCandidateCallback(s->pc, on_localcand_tramp);

    // Pre-add the tracks this peer sends. Tracks this peer receives are created
    // on demand from the remote offer via the track callback.
    const bool video_recv = (s->cfg.video_codec != SWRTC_VIDEO_NONE) && !s->video_send;
    const bool audio_recv = (s->cfg.audio_codec == SWRTC_AUDIO_OPUS) && !s->audio_send;
    if (video_recv || audio_recv) rtcSetTrackCallback(s->pc, on_track_tramp);

    if (s->video_send) {
        const uint8_t pt = s->cfg.video_payload_type ? s->cfg.video_payload_type
                                                     : kDefaultVideoPayloadType;
        s->video_tr = setup_video_send_track(s, pt);
    }
    // Single sendrecv video m-line (matches the standard browser offer Decart expects):
    // the send track above is created SENDRECV when duplex, so there is ONE m=video.
    // NOTE(receive): incoming frames still need a depacketizer on this track;
    // libdatachannel's rtcSetH26xDepacketizer REPLACES the packetizer (setMediaHandler),
    // so wiring receive needs a chained-depacketizer addition — done after we confirm
    // Decart answers a single sendrecv offer.
    if (s->audio_send) {
        const uint8_t pt = s->cfg.audio_payload_type ? s->cfg.audio_payload_type
                                                     : kDefaultAudioPayloadType;
        s->audio_tr = setup_audio_send_track(s, pt);
    }
    return true;
}

// Tear the PeerConnection down at the end of a connection cycle, resetting all
// per-connection state but KEEPING reusable resources (Opus codecs, HW encoder)
// so the next cycle reconnects fast. Emits a DISCONNECTED state change once.
static void teardown_pc(swrtc_session* s) {
    const int pc = s->pc;
    s->pc = -1;
    s->video_tr = -1;
    s->video_rx_tr = -1;
    s->audio_tr = -1;
    s->has_remote_desc.store(false, std::memory_order_release);
    { std::lock_guard<std::mutex> lk(s->cand_mtx); s->pending_cands.clear(); }
    {   // reset the send-side audio accumulators so we don't flush stale samples
        std::lock_guard<std::mutex> lk(s->audio_mtx);
        s->accum48k.clear();
        s->audio_out_samples = 0;
        s->resampler.reset(0, s->audio_channels);
    }
    if (pc >= 0) {
        rtcSetUserPointer(pc, nullptr);  // silence any late libdatachannel callback
        rtcClosePeerConnection(pc);
        rtcDeletePeerConnection(pc);
    }
    const swrtc_state prev = s->state.exchange(SWRTC_STATE_DISCONNECTED);
    if (prev != SWRTC_STATE_DISCONNECTED && prev != SWRTC_STATE_CLOSED && s->cb.on_state)
        s->cb.on_state(s, SWRTC_STATE_DISCONNECTED, s->cb.user_data);
}

void swrtc_session_destroy(swrtc_session* session) {
    if (!session) return;
    // Order matters to avoid callback races:
    // 1) detach the user pointer so any late libdatachannel callback is a no-op,
    // 2) stop+join the signaling thread (it may still touch the PC),
    // 3) tear down the PC, 4) free the transport, 5) free the session.
    if (session->pc >= 0) rtcSetUserPointer(session->pc, nullptr);
#if SWRTC_HW_ENCODER
    if (session->venc) { session->venc->stop(); delete session->venc; session->venc = nullptr; }
#endif
    if (session->sig) session->sig->stop();
    if (session->pc >= 0) {
        rtcClosePeerConnection(session->pc);
        rtcDeletePeerConnection(session->pc);
    }
    delete session->sig;
    if (session->opus_enc) opus_encoder_destroy(session->opus_enc);
    if (session->opus_dec) opus_decoder_destroy(session->opus_dec);
    delete session;
}

swrtc_state swrtc_get_state(swrtc_session* session) {
    if (!session) return SWRTC_STATE_CLOSED;
    return session->state.load(std::memory_order_relaxed);
}

swrtc_result swrtc_set_signaling_endpoint(swrtc_session* session, const char* ip, uint16_t port) {
    if (!session) return SWRTC_ERR_INVALID_ARG;
    std::lock_guard<std::mutex> lk(session->mtx);
    session->sig_ip   = ip ? ip : "";
    session->sig_port = port;
    return SWRTC_OK;
}

swrtc_result swrtc_start(swrtc_session* session) {
    if (!session || session->pc < 0) return SWRTC_ERR_INVALID_ARG;
    if (session->cfg.signaling_mode != SWRTC_SIGNALING_BUILTIN) return SWRTC_ERR_INVALID_STATE;
    if (session->sig) return SWRTC_ERR_INVALID_STATE;  // already started

    std::string ip;
    uint16_t port;
    {
        std::lock_guard<std::mutex> lk(session->mtx);
        ip   = session->sig_ip;
        port = session->sig_port;
    }
    if (port == 0) return SWRTC_ERR_INVALID_ARG;
    if (session->cfg.role == SWRTC_ROLE_OFFERER && ip.empty()) return SWRTC_ERR_INVALID_ARG;

    session->sig = new (std::nothrow) SignalingTransport(session, session->cfg.role, ip, port);
    if (!session->sig) return SWRTC_ERR_NO_MEMORY;
    session->sig->start();
    return SWRTC_OK;
}

swrtc_result swrtc_stop(swrtc_session* session) {
    if (!session) return SWRTC_ERR_INVALID_ARG;
    if (session->sig) {
        session->sig->stop();
        delete session->sig;
        session->sig = nullptr;
    }
    if (session->pc >= 0) rtcClosePeerConnection(session->pc);
    return SWRTC_OK;
}

swrtc_result swrtc_create_offer(swrtc_session* session) {
    if (!session || session->pc < 0) return SWRTC_ERR_INVALID_ARG;
    return rtcSetLocalDescription(session->pc, "offer") >= 0 ? SWRTC_OK : SWRTC_ERR_SIGNALING;
}

swrtc_result swrtc_set_remote_description(swrtc_session* session, swrtc_sdp_type type,
                                          const char* sdp) {
    if (!session || session->pc < 0 || !sdp) return SWRTC_ERR_INVALID_ARG;
    const char* t = (type == SWRTC_SDP_ANSWER) ? "answer" : "offer";
    if (rtcSetRemoteDescription(session->pc, sdp, t) < 0) return SWRTC_ERR_SIGNALING;
    session->has_remote_desc.store(true, std::memory_order_release);
    flush_remote_candidates(session);
    // Answerer: a remote offer is followed by generating our local answer.
    if (type == SWRTC_SDP_OFFER) {
        if (rtcSetLocalDescription(session->pc, "answer") < 0) return SWRTC_ERR_SIGNALING;
    }
    return SWRTC_OK;
}

swrtc_result swrtc_add_remote_candidate(swrtc_session* session, const char* candidate,
                                        const char* mid) {
    if (!session || session->pc < 0 || !candidate) return SWRTC_ERR_INVALID_ARG;
    apply_or_buffer_remote_candidate(session, candidate, mid ? mid : "");
    return SWRTC_OK;
}

swrtc_result swrtc_send_video_raw(swrtc_session* session, swrtc_pixel_format fmt,
                                  const uint8_t* data, size_t size,
                                  uint32_t width, uint32_t height, uint64_t pts_us) {
#if SWRTC_HW_ENCODER
    if (!session || !data || width == 0 || height == 0) return SWRTC_ERR_INVALID_ARG;
    const size_t expected = (fmt == SWRTC_PIXFMT_RGBA)
                                ? static_cast<size_t>(width) * height * 4
                                : static_cast<size_t>(width) * height * 3 / 2;
    if (size < expected) return SWRTC_ERR_INVALID_ARG;
    if (!session->video_send) return SWRTC_ERR_INVALID_STATE;
    if (session->state.load(std::memory_order_relaxed) != SWRTC_STATE_CONNECTED)
        return SWRTC_ERR_NOT_CONNECTED;

    std::lock_guard<std::mutex> lk(session->venc_mtx);
    if (!session->venc) {
        session->venc = new (std::nothrow) swrtc_hw::HwVideoEncoder();
        if (!session->venc) return SWRTC_ERR_NO_MEMORY;
        swrtc_hw::EncodeParams p;
        p.width  = session->cfg.video_width  ? static_cast<int>(session->cfg.video_width)  : static_cast<int>(width);
        p.height = session->cfg.video_height ? static_cast<int>(session->cfg.video_height) : static_cast<int>(height);
        p.fps = session->cfg.video_fps ? static_cast<int>(session->cfg.video_fps) : 30;
        p.bitrate_bps = (session->cfg.video_bitrate_kbps ? session->cfg.video_bitrate_kbps : 4000) * 1000;
        p.max_qp = static_cast<int>(session->cfg.video_max_qp);
        p.rate_control = static_cast<swrtc_hw::RateControl>(session->cfg.video_rate_control);
        p.h265 = (session->cfg.video_codec == SWRTC_VIDEO_H265);
        swrtc_session* sess = session;
        const bool ok = session->venc->start(p, [sess](const uint8_t* a, size_t n, uint64_t pts) {
            send_video_annexb(sess, a, static_cast<int>(n), pts);
        });
        if (!ok) { delete session->venc; session->venc = nullptr; return SWRTC_ERR_UNSUPPORTED; }
    }
    session->venc->pushFrame(static_cast<swrtc_hw::PixFmt>(fmt), data,
                             static_cast<int>(width), static_cast<int>(height), pts_us);
    return SWRTC_OK;
#else
    (void)session; (void)fmt; (void)data; (void)size; (void)width; (void)height; (void)pts_us;
    return SWRTC_ERR_UNSUPPORTED;  // no hardware encoder on this platform
#endif
}

swrtc_result swrtc_send_video_frame(swrtc_session* session, const uint8_t* annexb, size_t size,
                                    uint64_t pts_us, int /*is_keyframe*/) {
    if (!session || !annexb || size == 0) return SWRTC_ERR_INVALID_ARG;
    return send_video_annexb(session, annexb, static_cast<int>(size), pts_us);
}

swrtc_result swrtc_send_audio_frame(swrtc_session* session, const uint8_t* opus, size_t size,
                                    uint64_t pts_us) {
    if (!session || !opus || size == 0) return SWRTC_ERR_INVALID_ARG;
    const uint32_t rtp_ts = static_cast<uint32_t>((pts_us * kOpusClockRate) / 1000000ULL);
    return send_opus_on_track(session, opus, static_cast<int>(size), rtp_ts);
}

swrtc_result swrtc_send_audio_pcm(swrtc_session* session, const int16_t* pcm, int num_frames,
                                  uint32_t sample_rate, int channels, uint64_t /*pts_us*/) {
    if (!session || !pcm || num_frames <= 0 || sample_rate == 0) return SWRTC_ERR_INVALID_ARG;
    if (session->audio_tr < 0 || !session->audio_send || !session->opus_enc)
        return SWRTC_ERR_INVALID_STATE;
    if (channels != session->audio_channels) return SWRTC_ERR_INVALID_ARG;
    if (session->state.load(std::memory_order_relaxed) != SWRTC_STATE_CONNECTED)
        return SWRTC_ERR_NOT_CONNECTED;

    std::lock_guard<std::mutex> lk(session->audio_mtx);
    if (session->resampler.in_rate != sample_rate)
        session->resampler.reset(sample_rate, session->audio_channels);
    session->resampler.process(pcm, num_frames, session->accum48k);

    const int chunk = kOpusFrameSamples * session->audio_channels;  // interleaved samples / 20ms
    unsigned char opus[4000];
    swrtc_result last = SWRTC_OK;
    size_t consumed = 0;
    while (session->accum48k.size() - consumed >= static_cast<size_t>(chunk)) {
        const int n = opus_encode(session->opus_enc, session->accum48k.data() + consumed,
                                  kOpusFrameSamples, opus, sizeof(opus));
        consumed += chunk;
        if (n > 0) {
            last = send_opus_on_track(session, opus, n,
                                      static_cast<uint32_t>(session->audio_out_samples & 0xFFFFFFFFu));
            session->audio_out_samples += kOpusFrameSamples;
        }
    }
    if (consumed)
        session->accum48k.erase(session->accum48k.begin(), session->accum48k.begin() + consumed);
    return last;
}

swrtc_result swrtc_request_keyframe(swrtc_session* session) {
    if (!session || session->video_tr < 0) return SWRTC_ERR_INVALID_ARG;
    return rtcRequestKeyframe(session->video_tr) >= 0 ? SWRTC_OK : SWRTC_ERR_TRANSPORT;
}

swrtc_result swrtc_set_video_bitrate(swrtc_session* session, uint32_t bitrate_kbps) {
    if (!session || session->video_tr < 0 || bitrate_kbps == 0) return SWRTC_ERR_INVALID_ARG;
    // Remember for any later encoder (re)start (camera drop/regrab keeps the rate).
    session->cfg.video_bitrate_kbps = bitrate_kbps;
#ifdef SWRTC_HW_ENCODER
    // The actual lever: live SpecsMediaCodec parameter change on OUR encoder.
    // rtcRequestBitrate below only emits an RTCP REMB toward the remote — it
    // never touched the local encoder, which is why this call used to be a no-op.
    if (session->venc) session->venc->setBitrate(static_cast<int>(bitrate_kbps) * 1000);
#endif
    return rtcRequestBitrate(session->video_tr, bitrate_kbps * 1000) >= 0 ? SWRTC_OK
                                                                          : SWRTC_ERR_TRANSPORT;
}

// Receive-side audio stats: quantifies Wi-Fi downlink health (loss/reorder) so
// bad audio can be attributed to the network vs the pipeline.
int swrtc_get_audio_rx_stats(swrtc_session* session, char* buffer, int size) {
    if (!session || !buffer || size <= 0) return SWRTC_ERR_INVALID_ARG;
    std::lock_guard<std::mutex> lk(session->arx_mtx);
    const int n = std::snprintf(buffer, static_cast<size_t>(size),
                     "rx_pkts=%llu red=%llu reorder=%llu late_drop=%llu gaps=%llu plc_frames=%llu jb=%zu",
                     static_cast<unsigned long long>(session->arx_pkts),
                     static_cast<unsigned long long>(session->arx_red_pkts),
                     static_cast<unsigned long long>(session->arx_reordered),
                     static_cast<unsigned long long>(session->arx_late_dropped),
                     static_cast<unsigned long long>(session->arx_gaps),
                     static_cast<unsigned long long>(session->arx_plc_frames),
                     session->arx_jb.size());
    return n > 0 && n < size ? SWRTC_OK : SWRTC_ERR_INVALID_ARG;
}

}  // extern "C"
