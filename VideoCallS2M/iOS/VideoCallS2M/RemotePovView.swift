//
//  RemotePovView.swift
//  VideoCallS2M
//
//  Renders the live Glasses POV during Call Friend. Preferred source is the
//  WebRTC video track (H.264 over RTP, rendered by WebRTCCallManager's
//  RTCMTLVideoView); until that connects — or if it drops — the JPEG frames
//  from the Realtime fallback path (VideoCallS2MModeModel.glassesFrame) show instead.
//

import SwiftUI
import WebRTC

struct RemotePovView: View {
    let image: UIImage?
    var videoView: RTCMTLVideoView? = nil
    var videoLive: Bool = false
    /// Call-setup stage shown under the spinner while video isn't live yet.
    /// Setup takes seconds by design: SDP/ICE ride polled DB rows (~0.4 s per
    /// hop × ~8 hops), so an honest loader beats a frozen panel.
    var status: String = "Waiting for Glasses POV…"

    /// Rotating loader lines (~7 s each) while the call sets up. Mirrored on
    /// the Glasses in VideoCallS2MManager.ts; keep the two lists in sync-ish.
    private static let connectingMessages = [
        "Connecting the dots…",
        "We're working on it…",
        "Taking longer than expected — hang tight…",
        "Herding video packets…",
        "Negotiating pixels with the cloud…",
        "Finding the shortest path to your friend…",
        "Still dialing across the internet…",
        "Warming up the cameras…",
        "Trading secret handshakes…",
        "Good things take a second (or ten)…",
    ]

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(.black.opacity(0.85))

            if videoLive, let videoView {
                RTCVideoViewRepresentable(videoView: videoView)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            } else if let image {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            } else {
                VStack(spacing: 8) {
                    ProgressView()
                        .tint(.white)
                    TimelineView(.periodic(from: .now, by: 7)) { context in
                        let i = Int(context.date.timeIntervalSinceReferenceDate / 7)
                            % Self.connectingMessages.count
                        Text(Self.connectingMessages[i])
                            .font(.callout.weight(.medium))
                            .foregroundStyle(.white.opacity(0.9))
                            .multilineTextAlignment(.center)
                            .transition(.opacity)
                    }
                    Text(status)
                        .font(.caption2)
                        .foregroundStyle(.white.opacity(0.5))
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, 16)
            }
        }
        // Explicit, uncollapsible size. `.aspectRatio(fit)` sized this panel
        // from its content's ideal size when the container proposed no height —
        // and RTCMTLVideoView has NO intrinsic size, so the video branch
        // collapsed to 0x0 (Metal rendered nothing while frames decoded fine).
        // The spinner/JPEG branches have intrinsic sizes, masking the bug.
        .frame(maxWidth: .infinity)
        .frame(height: 280)
    }
}

/// SwiftUI wrapper for libwebrtc's Metal renderer. The view instance is owned
/// by WebRTCCallManager (the remote track is attached/detached there); this
/// just embeds it in the layout.
private struct RTCVideoViewRepresentable: UIViewRepresentable {
    let videoView: RTCMTLVideoView

    func makeUIView(context: Context) -> RTCMTLVideoView {
        videoView.videoContentMode = .scaleAspectFit
        print("[RTC] pov video view ENTERED the layout (videoLive flipped true).")
        return videoView
    }

    func updateUIView(_ uiView: RTCMTLVideoView, context: Context) {
        // Layout probe: a 0x0 Metal view renders nothing while frames decode
        // fine (the CAMetalLayer setDrawableSize width=0 warning).
        DispatchQueue.main.async { [weak uiView] in
            guard let uiView else { return }
            let s = uiView.bounds.size
            if s != Self.lastLoggedSize {
                Self.lastLoggedSize = s
                print("[RTC] pov video view laid out at \(Int(s.width))x\(Int(s.height)) (0x0 = zero-size bug)")
            }
        }
    }

    private static var lastLoggedSize = CGSize(width: -1, height: -1)
}
