//
//  FrameStreamer.swift
//  FriendFinder
//
//  Streams the phone camera as JPEG frames over the session's Supabase
//  Realtime channel (event frame:<streamer>), targeting TARGET_FPS with
//  congestion-aware frame dropping: at most MAX_IN_FLIGHT frames may be
//  inside the socket at once — when the uplink can't keep up we drop the
//  frame instead of queueing it, so latency stays bounded (live video must
//  drop, never buffer). Frames are downscaled to ~480 px and encoded through
//  one reused CIContext (creating a CIContext per frame was the original
//  framerate killer).
//

import AVFoundation
import Combine
import UIKit

final class FrameStreamer: NSObject, ObservableObject {
    @Published var isStreaming = false
    @Published var uploadCount = 0
    @Published var lastError: String?
    @Published var cameraPosition: AVCaptureDevice.Position = .back

    /// Session channel transport, injected by FriendFinderModeModel before start().
    weak var realtime: RealtimeClient?

    private let captureSession = AVCaptureSession()
    private let videoOutput = AVCaptureVideoDataOutput()
    private let captureQueue = DispatchQueue(label: "pf.frame-streamer.capture")
    private let ciContext = CIContext(options: [.cacheIntermediates: false])
    // 10 fps: the Glasses decodes phoneB frames at ~8-11 fps (device journal) —
    // sending faster only piles up "dropped behind decode" waste.
    private let sendInterval: TimeInterval = 1.0 / 10.0
    private let maxInFlight = 2
    private let targetMaxDimension: CGFloat = 480
    // 0.45 reads visibly cleaner on the Glasses panel than the old 0.32; the
    // maxInFlight congestion drop absorbs the bigger frames on slow uplinks.
    private let jpegQuality: CGFloat = 0.45
    private var lastSendAt = Date.distantPast
    private var frameSeq = 0
    private var inFlightSends = 0 // captureQueue-confined
    private var droppedFrames = 0

    private var streamer = ""

    func start(session: String, streamer: String, camera: String) {
        stop()
        self.streamer = streamer
        self.frameSeq = 0
        captureQueue.async {
            self.inFlightSends = 0
            self.droppedFrames = 0
        }
        let position: AVCaptureDevice.Position = camera == "front" ? .front : .back

        AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
            guard let self, granted else {
                DispatchQueue.main.async { self?.lastError = "Camera access denied" }
                return
            }
            self.captureQueue.async {
                self.configureSession(position: position)
                self.captureSession.startRunning()
                DispatchQueue.main.async {
                    self.cameraPosition = position
                    self.isStreaming = true
                    self.uploadCount = 0
                }
            }
        }
    }

    func stop() {
        guard captureSession.isRunning || isStreaming else { return }
        captureQueue.async { self.captureSession.stopRunning() }
        DispatchQueue.main.async { self.isStreaming = false }
    }

    func flipCamera() {
        let next: AVCaptureDevice.Position = cameraPosition == .back ? .front : .back
        captureQueue.async {
            self.configureSession(position: next)
            DispatchQueue.main.async { self.cameraPosition = next }
        }
    }

    private func configureSession(position: AVCaptureDevice.Position) {
        captureSession.beginConfiguration()
        // CRITICAL: never let the camera touch the shared audio session — by
        // default AVCaptureSession reconfigures it on start, which kills the
        // walkie-talkie's mic tap AND playback (both audio directions die
        // while video keeps working).
        captureSession.automaticallyConfiguresApplicationAudioSession = false
        // 720p capture → portrait frames are true 9:16 (720x1280), downscaled
        // to 270x480 for the wire — matches the Lens panel's portrait box.
        captureSession.sessionPreset = .hd1280x720
        for input in captureSession.inputs { captureSession.removeInput(input) }
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position),
              let input = try? AVCaptureDeviceInput(device: device),
              captureSession.canAddInput(input) else {
            captureSession.commitConfiguration()
            DispatchQueue.main.async { self.lastError = "Camera unavailable" }
            return
        }
        captureSession.addInput(input)

        if !captureSession.outputs.contains(videoOutput) {
            videoOutput.videoSettings =
                [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA]
            videoOutput.alwaysDiscardsLateVideoFrames = true
            videoOutput.setSampleBufferDelegate(self, queue: captureQueue)
            if captureSession.canAddOutput(videoOutput) {
                captureSession.addOutput(videoOutput)
            }
        }
        // Orientation is fixed per configuration — setting it per frame is
        // wasted work in the capture callback.
        if let connection = videoOutput.connection(with: .video),
           connection.isVideoOrientationSupported {
            connection.videoOrientation = .portrait
        }
        captureSession.commitConfiguration()
    }

    private func broadcast(jpeg: Data) {
        guard let realtime else { return }
        let seq = frameSeq
        frameSeq += 1
        inFlightSends += 1
        realtime.send(event: StreamConfig.frameEvent(streamer), payload: [
            "d": jpeg.base64EncodedString(),
            "n": seq,
            "t": Int(Date().timeIntervalSince1970 * 1000),
        ]) { [weak self] ok in
            guard let self else { return }
            self.captureQueue.async { self.inFlightSends -= 1 }
            if ok {
                self.uploadCount += 1
                self.lastError = nil
            }
        }
    }
}

extension FrameStreamer: AVCaptureVideoDataOutputSampleBufferDelegate {
    func captureOutput(
        _ output: AVCaptureOutput,
        didOutput sampleBuffer: CMSampleBuffer,
        from connection: AVCaptureConnection
    ) {
        let now = Date()
        guard now.timeIntervalSince(lastSendAt) >= sendInterval,
              realtime?.isConnected == true,
              let pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else { return }
        // Congestion control: never queue behind a slow uplink — drop instead.
        guard inFlightSends < maxInFlight else {
            droppedFrames += 1
            return
        }
        lastSendAt = now

        var ciImage = CIImage(cvPixelBuffer: pixelBuffer)
        let maxDim = max(ciImage.extent.width, ciImage.extent.height)
        if maxDim > targetMaxDimension {
            let s = targetMaxDimension / maxDim
            ciImage = ciImage.transformed(by: CGAffineTransform(scaleX: s, y: s))
        }
        guard let cgImage = ciContext.createCGImage(ciImage, from: ciImage.extent) else { return }
        let image = UIImage(cgImage: cgImage)
        guard let jpeg = image.jpegData(compressionQuality: jpegQuality) else { return }
        broadcast(jpeg: jpeg)
    }
}
