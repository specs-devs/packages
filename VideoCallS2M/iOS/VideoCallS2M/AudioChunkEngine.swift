//
//  AudioChunkEngine.swift
//  VideoCallS2M
//
//  Walkie-talkie audio for Call Friend mode over the session's Supabase
//  Realtime channel. Sends: an AVAudioEngine input tap accumulates mic
//  samples continuously (no recorder-rotation gaps) and broadcasts 0.5 s WAV
//  chunks as audio:<me>. Receives: audio:<remote> chunks are queued and
//  played back-to-back. (v1 uploaded 2 s chunks to storage and polled a head
//  pointer — 2-4 s behind.)
//

import AVFoundation
import Combine
import Foundation

final class AudioChunkEngine: NSObject, ObservableObject {
    @Published var isRunning = false
    @Published var chunksSent = 0
    @Published var chunksReceived = 0
    @Published var chunksPlayed = 0
    @Published var lastError: String?

    /// A sequence number this far below the last played one means the remote
    /// streamer restarted (its seq resets to 0 on every mode re-entry within
    /// the same session) — resync instead of dropping the new stream.
    private let seqRestartGap = 50

    /// Session channel transport, injected by VideoCallS2MModeModel before start().
    weak var realtime: RealtimeClient?

    /// 0.5 s chunks at the raw tap rate — the known-good configuration.
    /// (0.3 s chunks + 16 kHz downsampling were tried and rolled back while
    /// chasing a both-ways audio failure; reintroduce one at a time only
    /// after voice is confirmed working, using the Glasses caption counters.)
    private let chunkSeconds: Double = 0.5
    /// Jitter buffer: wait for this much audio before starting playback, then
    /// play concatenated batches back-to-back — a deliberate ~1 s delay in
    /// exchange for smooth, gapless audio.
    private let bufferStartS = 1.2
    private let batchMinS = 0.25
    /// Never drift more than this behind live (drop oldest audio beyond it).
    private let bufferMaxS = 4.0

    private var myStreamer = ""
    private var remoteStreamer = ""

    // Send side
    private let audioEngine = AVAudioEngine()
    private let processQueue = DispatchQueue(label: "pf.audio-chunker")
    private var pendingSamples: [Float] = []
    private var tapSampleRate = 48_000
    private var sendSeq = 0

    // Receive side (jitter-buffered: header-stripped PCM accumulates, then
    // plays as concatenated batches)
    private var player: AVAudioPlayer?
    private var pcmBuffer = Data()
    private var bufferRate = 0
    private var playbackStarted = false
    private var playedSeq = -1
    // Capture watchdog — the camera/audio-session interplay can kill the
    // input tap without any error surfacing.
    private var watchdog: Timer?

    func start(session: String, myStreamerId: String, remoteStreamerId: String) {
        stop()
        self.myStreamer = myStreamerId
        self.remoteStreamer = remoteStreamerId

        realtime?.on(StreamConfig.audioEvent(remoteStreamerId)) { [weak self] payload in
            self?.handleRemoteChunk(payload)
        }

        AVAudioSession.sharedInstance().requestRecordPermission { [weak self] granted in
            guard let self else { return }
            DispatchQueue.main.async {
                guard granted else {
                    self.lastError = "Microphone access denied"
                    return
                }
                do {
                    try self.activateSessionAndTap()
                } catch {
                    self.lastError = "Audio session: \(error.localizedDescription)"
                    return
                }
                self.isRunning = true
                self.observeAudioSession()
                // Watchdog: the engine can die silently (audio-session
                // stomps, route changes) — check and revive every 2 s.
                self.watchdog = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
                    guard let self, self.isRunning, !self.audioEngine.isRunning else { return }
                    print("[Audio] Input tap died — restarting capture.")
                    self.restartCapture()
                }
            }
        }
    }

    private func activateSessionAndTap() throws {
        let av = AVAudioSession.sharedInstance()
        try av.setCategory(.playAndRecord, mode: .voiceChat,
                           options: [.defaultToSpeaker, .allowBluetooth])
        try av.setActive(true)
        try startTap()
    }

    private func restartCapture() {
        guard isRunning else { return }
        if audioEngine.isRunning {
            audioEngine.inputNode.removeTap(onBus: 0)
            audioEngine.stop()
        }
        do {
            try activateSessionAndTap()
            print("[Audio] Capture restarted.")
        } catch {
            lastError = "Audio restart: \(error.localizedDescription)"
        }
    }

    // Interruptions (calls, Siri, other apps) and media-services resets kill
    // the tap; the camera's capture session can also disturb the audio
    // session. Rebuild capture whenever any of those end.
    private var observersInstalled = false

    private func observeAudioSession() {
        guard !observersInstalled else { return }
        observersInstalled = true
        let center = NotificationCenter.default
        center.addObserver(forName: AVAudioSession.interruptionNotification,
                           object: nil, queue: .main) { [weak self] note in
            guard let self, self.isRunning else { return }
            let type = (note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt)
                .flatMap(AVAudioSession.InterruptionType.init)
            if type == .ended {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self.restartCapture() }
            }
        }
        center.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification,
                           object: nil, queue: .main) { [weak self] _ in
            guard let self, self.isRunning else { return }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self.restartCapture() }
        }
    }

    func stop() {
        realtime?.off(StreamConfig.audioEvent(remoteStreamer))
        watchdog?.invalidate()
        watchdog = nil
        if audioEngine.isRunning {
            audioEngine.inputNode.removeTap(onBus: 0)
            audioEngine.stop()
        }
        player?.stop()
        player = nil
        processQueue.async { self.pendingSamples.removeAll() }
        pcmBuffer.removeAll()
        bufferRate = 0
        playbackStarted = false
        playedSeq = -1
        sendSeq = 0
        chunksReceived = 0
        isRunning = false
    }

    // ── Send side: continuous input tap → 0.5 s WAV chunks ──────────────────

    private func startTap() throws {
        let input = audioEngine.inputNode
        let format = input.outputFormat(forBus: 0)
        tapSampleRate = Int(format.sampleRate)
        input.installTap(onBus: 0, bufferSize: 4096, format: format) { [weak self] buffer, _ in
            guard let self, let channels = buffer.floatChannelData else { return }
            let count = Int(buffer.frameLength)
            let samples = Array(UnsafeBufferPointer(start: channels[0], count: count))
            self.processQueue.async { self.accumulate(samples) }
        }
        audioEngine.prepare()
        try audioEngine.start()
    }

    private func accumulate(_ samples: [Float]) {
        pendingSamples.append(contentsOf: samples)
        let chunkSamples = Int(chunkSeconds * Double(tapSampleRate))
        while pendingSamples.count >= chunkSamples {
            let chunk = Array(pendingSamples.prefix(chunkSamples))
            pendingSamples.removeFirst(chunkSamples)
            broadcast(chunk: chunk)
        }
    }

    private func broadcast(chunk: [Float]) {
        guard let realtime, realtime.isConnected else { return }
        let wav = Self.wavData(from: chunk, sampleRate: tapSampleRate)
        let seq = sendSeq
        sendSeq += 1
        realtime.send(event: StreamConfig.audioEvent(myStreamer), payload: [
            "d": wav.base64EncodedString(),
            "n": seq,
            "r": tapSampleRate,
            "t": Int(Date().timeIntervalSince1970 * 1000),
        ])
        DispatchQueue.main.async { self.chunksSent += 1 }
    }

    /// 16-bit PCM mono WAV.
    private static func wavData(from samples: [Float], sampleRate: Int) -> Data {
        let dataSize = samples.count * 2
        var wav = Data(capacity: 44 + dataSize)

        func append32(_ value: UInt32) { withUnsafeBytes(of: value.littleEndian) { wav.append(contentsOf: $0) } }
        func append16(_ value: UInt16) { withUnsafeBytes(of: value.littleEndian) { wav.append(contentsOf: $0) } }

        wav.append(contentsOf: Array("RIFF".utf8))
        append32(UInt32(36 + dataSize))
        wav.append(contentsOf: Array("WAVE".utf8))
        wav.append(contentsOf: Array("fmt ".utf8))
        append32(16)
        append16(1)                          // PCM
        append16(1)                          // mono
        append32(UInt32(sampleRate))
        append32(UInt32(sampleRate * 2))     // byte rate
        append16(2)                          // block align
        append16(16)                         // bits per sample
        wav.append(contentsOf: Array("data".utf8))
        append32(UInt32(dataSize))

        var pcm = [Int16](repeating: 0, count: samples.count)
        for (i, s) in samples.enumerated() {
            pcm[i] = Int16(max(-1, min(1, s)) * 32767)
        }
        pcm.withUnsafeBytes { wav.append(contentsOf: $0) }
        return wav
    }

    // ── Receive side: jitter-buffered, batch-concatenated playback ──────────
    //
    // The old per-chunk AVAudioPlayer had a gap at every 0.3-0.5 s chunk
    // boundary. Now: strip each chunk's WAV header, accumulate raw PCM, wait
    // for bufferStartS, then play one concatenated WAV per batch — gaps only
    // at multi-second batch boundaries. Deliberate ~1 s delay for smoothness.

    private func handleRemoteChunk(_ payload: [String: Any]) {
        guard let b64 = payload["d"] as? String,
              let seq = (payload["n"] as? NSNumber)?.intValue,
              let rate = (payload["r"] as? NSNumber)?.intValue, rate > 0,
              let data = Data(base64Encoded: b64), data.count > 44 else { return }
        chunksReceived += 1
        if seq <= playedSeq {
            // Small step back = duplicate/out-of-order — drop. A big jump back
            // means the Glasses streamer restarted and its sequence reset to 0
            // (mode re-entry keeps the session code) — resync.
            guard seq <= playedSeq - seqRestartGap else { return }
            print("[Audio] Remote voice stream restarted (seq \(seq) after \(playedSeq)) — resyncing")
            resetPlaybackBuffer()
        }
        playedSeq = seq
        // Mid-call sample-rate change (Glasses mic restart) — flush.
        if bufferRate != 0 && rate != bufferRate { resetPlaybackBuffer() }
        bufferRate = rate
        pcmBuffer.append(data.subdata(in: 44..<data.count))
        // Stay near live: drop the oldest audio beyond the max buffer.
        let maxBytes = Int(bufferMaxS * Double(rate) * 2)
        if pcmBuffer.count > maxBytes {
            pcmBuffer.removeFirst(pcmBuffer.count - maxBytes)
        }
        playNextIfIdle()
    }

    private func resetPlaybackBuffer() {
        pcmBuffer.removeAll()
        bufferRate = 0
        playedSeq = -1
        playbackStarted = false
    }

    private func playNextIfIdle() {
        guard player?.isPlaying != true, bufferRate > 0 else { return }
        if pcmBuffer.isEmpty {
            // Sender stalled and we drained — go back to initial buffering.
            playbackStarted = false
            return
        }
        let queuedS = Double(pcmBuffer.count) / (Double(bufferRate) * 2)
        let threshold = playbackStarted ? batchMinS : bufferStartS
        guard queuedS >= threshold else { return }
        let wav = Self.wavData(fromPCM: pcmBuffer, sampleRate: bufferRate)
        pcmBuffer.removeAll()
        do {
            let p = try AVAudioPlayer(data: wav)
            p.delegate = self
            p.play()
            player = p
            playbackStarted = true
            chunksPlayed += 1
        } catch {
            lastError = "Playback: \(error.localizedDescription)"
        }
    }

    /// Wrap raw 16-bit PCM mono bytes in a WAV container.
    private static func wavData(fromPCM pcm: Data, sampleRate: Int) -> Data {
        var wav = Data(capacity: 44 + pcm.count)
        func append32(_ value: UInt32) { withUnsafeBytes(of: value.littleEndian) { wav.append(contentsOf: $0) } }
        func append16(_ value: UInt16) { withUnsafeBytes(of: value.littleEndian) { wav.append(contentsOf: $0) } }
        wav.append(contentsOf: Array("RIFF".utf8))
        append32(UInt32(36 + pcm.count))
        wav.append(contentsOf: Array("WAVE".utf8))
        wav.append(contentsOf: Array("fmt ".utf8))
        append32(16)
        append16(1)                          // PCM
        append16(1)                          // mono
        append32(UInt32(sampleRate))
        append32(UInt32(sampleRate * 2))     // byte rate
        append16(2)                          // block align
        append16(16)                         // bits per sample
        wav.append(contentsOf: Array("data".utf8))
        append32(UInt32(pcm.count))
        wav.append(pcm)
        return wav
    }
}

extension AudioChunkEngine: AVAudioPlayerDelegate {
    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        DispatchQueue.main.async { self.playNextIfIdle() }
    }
}
