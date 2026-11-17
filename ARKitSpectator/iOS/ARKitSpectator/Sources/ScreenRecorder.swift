import Photos
import ReplayKit
import SwiftUI

/// Default recorder: the system screen recorder (ReplayKit). iOS composites and encodes the
/// display in hardware, so the live AR view keeps its full frame rate and pacing while recording —
/// the same path as Control Center screen recording, but started and reviewed from the app.
/// Anything visible on screen is recorded, so the menu collapses to a small stop control.
@MainActor final class ScreenRecorder:ObservableObject {
 enum Phase {case idle,starting,recording,finishing}
 @Published private(set) var phase:Phase = .idle
 @Published private(set) var elapsed=0
 @Published private(set) var clip:URL?
 @Published var message=""
 var recording:Bool {phase == .recording}
 private var started=Date()
 private var ticker:Task<Void,Never>?

 func start() {
  guard phase == .idle else{return}
  let recorder=RPScreenRecorder.shared()
  guard recorder.isAvailable else {message="Screen recording is unavailable (screen mirroring or Screen Time restrictions)";return}
  recorder.isMicrophoneEnabled=false
  phase = .starting;message=""
  recorder.startRecording {[weak self] error in
   Task { @MainActor in
    guard let self else{return}
    if let error {self.phase = .idle;self.message=error.localizedDescription;return}
    self.phase = .recording;self.started=Date();self.elapsed=0
    self.ticker=Task { @MainActor [weak self] in
     while !Task.isCancelled {
      try? await Task.sleep(for:.milliseconds(500))
      guard let self,self.phase == .recording else{return}
      self.elapsed=Int(Date().timeIntervalSince(self.started))
     }
    }
   }
  }
 }

 func stop() {
  guard phase == .recording else{return}
  ticker?.cancel();ticker=nil;phase = .finishing
  let url:URL
  do {
   let folder=FileManager.default.urls(for:.documentDirectory,in:.userDomainMask)[0].appendingPathComponent("Recordings",isDirectory:true)
   try FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
   url=folder.appendingPathComponent("ARKitSpectator-\(Int(Date().timeIntervalSince1970))-\(UUID().uuidString.prefix(6)).mov")
  } catch {
   message=error.localizedDescription
   RPScreenRecorder.shared().stopRecording {_,_ in}
   phase = .idle;return
  }
  RPScreenRecorder.shared().stopRecording(withOutput:url) {[weak self] error in
   Task { @MainActor in
    guard let self else{return}
    if let error {self.message=error.localizedDescription} else {self.clip=url;self.message="Clip ready · save to Photos or share"}
    self.phase = .idle
   }
  }
 }

 func saveToPhotos() async {
  guard let clip else{return}
  let access=await PHPhotoLibrary.requestAuthorization(for:.addOnly)
  guard access == .authorized || access == .limited else {message="Photos access is off. Use Share to save the video to Files.";return}
  do {try await PHPhotoLibrary.shared().performChanges {PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL:clip)};message="Saved to Photos"}
  catch {message=error.localizedDescription}
 }
}
