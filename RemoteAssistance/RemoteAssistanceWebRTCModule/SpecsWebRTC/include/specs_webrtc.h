/*
 * specs_webrtc.h — Reusable WebRTC media engine (C ABI)
 * =====================================================
 *
 * A small, dependency-free C interface over a libdatachannel-based WebRTC stack.
 * It is a media *engine*, not just a transport: callers hand it RAW frames and
 * raw audio, and the library owns the codecs and conversions:
 *
 *   video in : raw RGBA / NV12 / I420 frames -> (convert) -> H.264 encode -> RTP
 *   audio in : raw PCM (any rate) -> resample 48k -> Opus encode -> RTP
 *   audio out: RTP -> Opus decode -> raw PCM (delivered to the caller)
 *   video out: RTP -> H.264 Annex-B (delivered to the caller; decode is the
 *              caller's platform HW, e.g. VideoToolbox — no portable SW decoder)
 *
 * What can't be inferred from the frames themselves (frame rate, target bitrate,
 * encoder/quality, rate-control) is set once in swrtc_config; resolution and
 * pixel format come from each frame.
 *
 * Platform note: the H.264 *encoder* is hardware (SpecsMediaCodec on the device),
 * so the raw-video-in encode path is available only in the device build. A host
 * build (e.g. macOS receiver) still does signaling, transport, audio Opus
 * encode/decode, and receiving — swrtc_send_video_raw returns SWRTC_ERR_UNSUPPORTED
 * where no hardware encoder exists. Opus (libopus) is built into the library on
 * every platform, so audio is fully owned by the lib in both directions.
 *
 * The ABI is pure C: no C++ types cross the boundary, every entry point is
 * extern "C", media is exchanged as raw byte/sample buffers.
 *
 * --------------------------------------------------------------------------
 * Lifecycle (device sender)
 * --------------------------------------------------------------------------
 *     swrtc_config cfg; swrtc_config_default(&cfg);
 *     cfg.role = SWRTC_ROLE_OFFERER;
 *     cfg.video_fps = 30;                 // can't be inferred from frames
 *     cfg.video_bitrate_kbps = 4000;
 *     cfg.video_max_qp = 24;              // quality floor (0 = encoder default)
 *     cfg.video_rate_control = SWRTC_RC_CBR;
 *     swrtc_callbacks cb = {0}; cb.on_state = on_state;
 *     swrtc_session* s; swrtc_session_create(&cfg, &cb, &s);
 *     swrtc_set_signaling_endpoint(s, "10.0.0.5", 8888); swrtc_start(s);
 *     // once CONNECTED, push raw frames; the lib converts + encodes + sends:
 *     swrtc_send_video_raw(s, SWRTC_PIXFMT_RGBA, rgba, size, w, h, pts_us);
 *     swrtc_send_audio_pcm(s, pcm, frames, 32000, 2, pts_us);
 *
 * Threading & memory: callbacks fire on internal worker threads; do NOT call
 * swrtc_session_destroy() from inside one. Buffers handed to callbacks are valid
 * only for the call. swrtc_send_* are thread-safe, copy what they need, and are
 * non-blocking (encode happens on a worker thread).
 */
#ifndef SPECS_WEBRTC_H
#define SPECS_WEBRTC_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define SPECS_WEBRTC_VERSION_MAJOR 0
#define SPECS_WEBRTC_VERSION_MINOR 2
#define SPECS_WEBRTC_VERSION_PATCH 0

#if defined(_WIN32)
#  define SWRTC_API __declspec(dllexport)
#else
#  define SWRTC_API __attribute__((visibility("default")))
#endif

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

typedef struct swrtc_session swrtc_session;

typedef enum {
    SWRTC_OK                 = 0,
    SWRTC_ERR_INVALID_ARG    = -1,
    SWRTC_ERR_INVALID_STATE  = -2,
    SWRTC_ERR_NO_MEMORY      = -3,
    SWRTC_ERR_SIGNALING      = -4,
    SWRTC_ERR_TRANSPORT      = -5,
    SWRTC_ERR_NOT_CONNECTED  = -6,
    SWRTC_ERR_UNSUPPORTED    = -7,   /* e.g. raw-video encode where no HW encoder */
    SWRTC_ERR_INTERNAL       = -100,
} swrtc_result;

typedef enum {
    SWRTC_ROLE_OFFERER  = 0,  /* creates the offer; dials the peer (built-in signaling) */
    SWRTC_ROLE_ANSWERER = 1,  /* answers; listens                                       */
} swrtc_role;

typedef enum {
    SWRTC_VIDEO_NONE = 0,
    SWRTC_VIDEO_H264 = 1,
    SWRTC_VIDEO_H265 = 2,  /* HEVC — encode via SpecsMediaCodec, decode via VideoToolbox */
} swrtc_video_codec;

typedef enum {
    SWRTC_AUDIO_NONE = 0,
    SWRTC_AUDIO_OPUS = 1,
} swrtc_audio_codec;

/* Raw pixel format of frames passed to swrtc_send_video_raw. */
typedef enum {
    SWRTC_PIXFMT_I420 = 0,  /* planar Y, U, V (w*h + 2*(w/2*h/2))           */
    SWRTC_PIXFMT_NV12 = 1,  /* planar Y + interleaved UV (Cb,Cr)            */
    SWRTC_PIXFMT_RGBA = 2,  /* 32 bpp R,G,B,A                               */
} swrtc_pixel_format;

/* Encoder rate-control mode. */
typedef enum {
    SWRTC_RC_DEFAULT = 0,  /* encoder default                               */
    SWRTC_RC_CBR     = 1,  /* constant bitrate                              */
    SWRTC_RC_VBR     = 2,  /* variable bitrate                              */
    SWRTC_RC_CQ      = 3,  /* constant quality                              */
} swrtc_rate_control;

typedef enum {
    SWRTC_STATE_NEW          = 0,
    SWRTC_STATE_CONNECTING   = 1,
    SWRTC_STATE_CONNECTED    = 2,
    SWRTC_STATE_DISCONNECTED = 3,
    SWRTC_STATE_FAILED       = 4,
    SWRTC_STATE_CLOSED       = 5,
} swrtc_state;

typedef enum {
    SWRTC_SDP_OFFER  = 0,
    SWRTC_SDP_ANSWER = 1,
} swrtc_sdp_type;

typedef enum {
    SWRTC_SIGNALING_BUILTIN = 0, /* library exchanges SDP/ICE over its own TCP socket */
    SWRTC_SIGNALING_MANUAL  = 1, /* app ferries SDP/ICE via callbacks + setters       */
} swrtc_signaling_mode;

typedef enum {
    SWRTC_LOG_NONE = 0, SWRTC_LOG_ERROR = 1, SWRTC_LOG_WARN = 2,
    SWRTC_LOG_INFO = 3, SWRTC_LOG_DEBUG = 4,
} swrtc_log_level;

/* ------------------------------------------------------------------ */
/* Configuration                                                      */
/* ------------------------------------------------------------------ */
/* Always swrtc_config_default() first, then override; fields are appended at the
 * end over time so callers stay source/ABI compatible. */
typedef struct {
    swrtc_role           role;
    swrtc_signaling_mode signaling_mode;

    /* --- Video --- (SWRTC_VIDEO_NONE = no video track) */
    swrtc_video_codec    video_codec;
    uint32_t             video_width;        /* 0 = infer from the first frame  */
    uint32_t             video_height;       /* 0 = infer                       */
    uint32_t             video_fps;          /* required for encode (can't infer); default 30 */
    uint32_t             video_bitrate_kbps; /* target bitrate                  */
    uint32_t             video_max_qp;       /* 0 = encoder default; ~24 sets a quality floor */
    swrtc_rate_control   video_rate_control; /* SWRTC_RC_DEFAULT unless set      */
    uint8_t              video_payload_type; /* RTP PT; 0 = default (96)         */

    /* --- Audio --- (SWRTC_AUDIO_NONE = no audio track) */
    swrtc_audio_codec    audio_codec;
    uint32_t             audio_sample_rate;  /* RTP/Opus clock, e.g. 48000      */
    uint32_t             audio_channels;     /* 1 or 2                          */
    uint32_t             audio_bitrate_kbps;
    uint8_t              audio_payload_type;  /* RTP PT; 0 = default (111)       */

    /* Optional ICE servers (STUN/TURN URIs). LAN-only: leave count 0, lan_only=1. */
    const char* const*   ice_servers;
    size_t               ice_server_count;
    int                  lan_only;

    /* Duplex video (appended field — ABI/source compatible). When != 0 AND a video
     * codec is set AND on_video_frame is provided, the session adds BOTH a sendonly
     * (this peer's camera) and a recvonly (remote's return) video m-line, so a single
     * PeerConnection sends and receives video — required for the Decart transform
     * round-trip. 0 = the original send-XOR-receive behaviour. */
    int                  video_duplex;
} swrtc_config;

/* ------------------------------------------------------------------ */
/* Callbacks                                                          */
/* ------------------------------------------------------------------ */
typedef void (*swrtc_state_cb)(swrtc_session* s, swrtc_state state, void* user);
typedef void (*swrtc_error_cb)(swrtc_session* s, swrtc_result code, const char* message, void* user);

/* Inbound video: H.264 Annex-B access unit (decode is the caller's platform HW). */
typedef void (*swrtc_video_frame_cb)(swrtc_session* s, const uint8_t* annexb, size_t size,
                                     uint64_t pts_us, int is_keyframe, void* user);

/* Inbound audio: decoded interleaved S16 PCM (the lib Opus-decodes for you).
 * num_frames = samples per channel; total samples = num_frames * channels. */
typedef void (*swrtc_audio_frame_cb)(swrtc_session* s, const int16_t* pcm, int num_frames,
                                     int channels, uint32_t sample_rate, uint64_t pts_us, void* user);

/* Remote requested a fresh keyframe (RTCP PLI) — a sender should emit an IDR. */
typedef void (*swrtc_keyframe_request_cb)(swrtc_session* s, void* user);

/* Manual-signaling outputs (only when signaling_mode == MANUAL). */
typedef void (*swrtc_local_description_cb)(swrtc_session* s, swrtc_sdp_type type, const char* sdp, void* user);
typedef void (*swrtc_local_candidate_cb)(swrtc_session* s, const char* candidate, const char* mid, void* user);

typedef struct {
    void* user_data;
    swrtc_state_cb             on_state;
    swrtc_error_cb            on_error;
    swrtc_video_frame_cb      on_video_frame;       /* receiver: H.264 Annex-B */
    swrtc_audio_frame_cb      on_audio_frame;       /* receiver: decoded PCM   */
    swrtc_keyframe_request_cb on_keyframe_request;   /* sender                  */
    swrtc_local_description_cb on_local_description; /* manual signaling        */
    swrtc_local_candidate_cb   on_local_candidate;   /* manual signaling        */
} swrtc_callbacks;

/* ------------------------------------------------------------------ */
/* Global / lifecycle                                                 */
/* ------------------------------------------------------------------ */
SWRTC_API const char* swrtc_version_string(void);
SWRTC_API void swrtc_set_log_level(swrtc_log_level level);
SWRTC_API void swrtc_config_default(swrtc_config* config);

SWRTC_API swrtc_result swrtc_session_create(const swrtc_config* config,
                                            const swrtc_callbacks* callbacks,
                                            swrtc_session** out_session);
SWRTC_API void swrtc_session_destroy(swrtc_session* session);
SWRTC_API swrtc_state swrtc_get_state(swrtc_session* session);

/* ------------------------------------------------------------------ */
/* Built-in signaling                                                 */
/* ------------------------------------------------------------------ */
SWRTC_API swrtc_result swrtc_set_signaling_endpoint(swrtc_session* session, const char* ip, uint16_t port);
SWRTC_API swrtc_result swrtc_start(swrtc_session* session);
SWRTC_API swrtc_result swrtc_stop(swrtc_session* session);

/* ------------------------------------------------------------------ */
/* Manual signaling                                                   */
/* ------------------------------------------------------------------ */
SWRTC_API swrtc_result swrtc_create_offer(swrtc_session* session);
SWRTC_API swrtc_result swrtc_set_remote_description(swrtc_session* session, swrtc_sdp_type type, const char* sdp);
SWRTC_API swrtc_result swrtc_add_remote_candidate(swrtc_session* session, const char* candidate, const char* mid);

/* ------------------------------------------------------------------ */
/* Media — send                                                       */
/* ------------------------------------------------------------------ */

/* Send one RAW video frame: the library converts `fmt` to the encoder's input
 * format, H.264-encodes (per the swrtc_config video settings), and transmits.
 * `width`/`height` describe this frame (resolution is inferred from them).
 * Device-only encode path: returns SWRTC_ERR_UNSUPPORTED where no HW encoder. */
SWRTC_API swrtc_result swrtc_send_video_raw(swrtc_session* session, swrtc_pixel_format fmt,
                                            const uint8_t* data, size_t size,
                                            uint32_t width, uint32_t height, uint64_t pts_us);

/* Send a pre-encoded H.264 Annex-B access unit (bypasses the built-in encoder). */
SWRTC_API swrtc_result swrtc_send_video_frame(swrtc_session* session, const uint8_t* annexb, size_t size,
                                              uint64_t pts_us, int is_keyframe);

/* Send RAW interleaved S16 PCM: the library resamples to the Opus clock
 * (48 kHz) as needed and Opus-encodes. num_frames = samples per channel. */
SWRTC_API swrtc_result swrtc_send_audio_pcm(swrtc_session* session, const int16_t* pcm, int num_frames,
                                            uint32_t sample_rate, int channels, uint64_t pts_us);

/* Send a pre-encoded Opus packet (bypasses the built-in encoder/resampler). */
SWRTC_API swrtc_result swrtc_send_audio_frame(swrtc_session* session, const uint8_t* opus, size_t size,
                                              uint64_t pts_us);

/* ------------------------------------------------------------------ */
/* Control                                                            */
/* ------------------------------------------------------------------ */
SWRTC_API swrtc_result swrtc_request_keyframe(swrtc_session* session);
SWRTC_API swrtc_result swrtc_set_video_bitrate(swrtc_session* session, uint32_t bitrate_kbps);

/* Receive-side audio stats ("rx_pkts=.. red=.. reorder=.. late_drop=.. gaps=..
 * plc_frames=.. jb=..") into `buffer`. Returns SWRTC_OK or SWRTC_ERR_INVALID_ARG. */
SWRTC_API int swrtc_get_audio_rx_stats(swrtc_session* session, char* buffer, int size);

#ifdef __cplusplus
} /* extern "C" */
#endif

#endif /* SPECS_WEBRTC_H */
