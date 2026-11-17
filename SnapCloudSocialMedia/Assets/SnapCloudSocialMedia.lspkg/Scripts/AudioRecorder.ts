// Microphone + PCM WAV pattern extracted from Example5-Media/AudioCaptureUploader.
export class AudioRecorder {
  private provider: MicrophoneAudioProvider
  private frames: Float32Array[] = []
  private samples = 0
  private recording = false
  constructor(script: BaseScriptComponent, microphone: AudioTrackAsset) {
    this.provider = microphone.control as MicrophoneAudioProvider
    this.provider.sampleRate = 16000
    script.createEvent('UpdateEvent').bind(() => {
      if(!this.recording)return
      const frame = new Float32Array(this.provider.maxFrameSize)
      const shape = this.provider.getAudioFrame(frame)
      const count = Math.min(shape.x, frame.length, Math.max(0, this.provider.sampleRate * 16 - this.samples))
      if(count>0){this.frames.push(frame.slice(0,count));this.samples += count}
    })
  }
  start(): void {this.frames=[];this.samples=0;this.provider.start();this.recording=true}
  stop(): Uint8Array | null {
    this.recording=false;this.provider.stop()
    if(!this.samples)return null
    const bytes=new Uint8Array(44+this.samples*2),view=new DataView(bytes.buffer)
    const ascii=(offset: number, text: string) => {for(let i=0;i<text.length;i++)bytes[offset+i]=text.charCodeAt(i)}
    const rate=this.provider.sampleRate
    ascii(0,'RIFF');view.setUint32(4,bytes.length-8,true);ascii(8,'WAVE');ascii(12,'fmt ');view.setUint32(16,16,true)
    view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);ascii(36,'data');view.setUint32(40,this.samples*2,true)
    let offset=44
    for(const frame of this.frames)for(const sample of frame){const s=Math.max(-1,Math.min(1,sample));view.setInt16(offset,Math.round(s<0?s*32768:s*32767),true);offset+=2}
    this.frames=[];this.samples=0;return bytes
  }
  destroy(): void {if(this.recording)this.provider.stop();this.recording=false;this.frames=[]}
}
