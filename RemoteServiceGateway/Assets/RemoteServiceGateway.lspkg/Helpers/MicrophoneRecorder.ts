/**
 * Specs Inc. 2026
 * Microphone input manager for audio recording and streaming. Captures audio frames from
 * the device microphone with bystander rejection via VoiceML, configurable sample rates,
 * and event-based frame delivery for AI audio processing.
 */
import Event from "../Utils/Event";

@component
export class MicrophoneRecorder extends BaseScriptComponent {
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Microphone Configuration</span>')
  @ui.label('<span style="color: #94A3B8; font-size: 11px;">Audio track asset for capturing microphone input</span>')

  @input
  private micAudioTrack: AudioTrackAsset;
  private micAudioProvider: MicrophoneAudioProvider;
  private recordUpdate: UpdateEvent;
  public onAudioFrame = new Event<Float32Array>();

  private onAwake() {
    // Require the VoiceML Module in order to get Bystander Rejection
    require("LensStudio:VoiceMLModule");
    this.micAudioProvider = this.micAudioTrack
      .control as MicrophoneAudioProvider;
    this.recordUpdate = this.createEvent("UpdateEvent");
    this.recordUpdate.bind(this.onUpdate.bind(this));
    this.recordUpdate.enabled = false;
  }

  private onUpdate() {
    let audioFrame = new Float32Array(this.micAudioProvider.maxFrameSize);
    const audioShape = this.micAudioProvider.getAudioFrame(audioFrame);
    audioFrame = audioFrame.subarray(0, audioShape.x);
    this.onAudioFrame.invoke(audioFrame);
  }

  /**
   * Sets the sample rate for the microphone audio provider.
   * @param sampleRate The sample rate to set.
   */
  setSampleRate(sampleRate: number) {
    this.micAudioProvider.sampleRate = sampleRate;
  }

  /**
   * Starts recording audio from the microphone.
   */
  startRecording() {
    this.micAudioProvider.start();
    this.recordUpdate.enabled = true;
  }

  /**
   * Stops recording audio from the microphone.
   */
  stopRecording() {
    this.micAudioProvider.stop();
    this.recordUpdate.enabled = false;
  }
}
