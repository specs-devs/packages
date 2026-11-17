import {parseConfig, SocialConfig, PROVIDERS, ProviderId} from './SocialConfig'
import {SocialClient, uuid} from './SocialClient'
import {CameraRecorder} from './CameraRecorder'
import {SocialPanel} from './SocialPanel'
import {AudioRecorder} from './AudioRecorder'

@component
export class SnapCloudSocialMedia extends BaseScriptComponent {
  @ui.label('Snap Cloud Social Media')
  @input
  @hint('Public JSON configuration. Never add provider secrets to a Lens asset.')
  configAsset: JsonAsset = requireAsset('../social.config.json') as JsonAsset

  @input
  @allowUndefined
  @hint('Optional rendered camera texture to include AR content. Leave empty to use the physical camera.')
  compositeTexture: Texture

  @input
  @allowUndefined
  @hint('Microphone audio track used when capture.includeAudio is enabled in JSON.')
  microphone: AudioTrackAsset = requireAsset('../Microphone Audio.micaudio') as AudioTrackAsset

  @input
  @widget(new SliderWidget(38, 48, 1))
  @hint('Panel width in centimeters. Prefab is positioned at 110 cm.')
  panelWidth: number = 44

  @input
  @widget(new SliderWidget(0.8, 1.4, 0.05))
  @hint('Font metric adjustment for your project theme.')
  fontScale: number = 1

  private config: SocialConfig
  private client: SocialClient
  private panel: SocialPanel
  private recorder: CameraRecorder
  private audio: AudioRecorder
  private connected: Record<string, boolean> = {}
  private media: any = null
  private state: 'initializing' | 'ready' | 'recording' | 'busy' = 'initializing'
  private requestKey = ''
  private activeJob = ''
  private alive = true
  private creator: any = null
  onAwake(): void {
    try {
      this.config = parseConfig(this.configAsset.getString())
      // Privacy selection for Direct Post must be made in the current session.
      this.config.destinations.tiktok.privacyLevel = ''
      this.client = new SocialClient(this.config)
      this.panel = new SocialPanel(this.sceneObject, this.config, {
        record: () => this.run(() => this.record()), photo: () => this.run(() => this.photo()),
        share: () => this.run(() => this.share()), refresh: () => this.run(() => this.refresh()),
        select: id => this.selected(id), privacy: id => this.run(() => this.privacy(id))
      }, this.panelWidth, this.fontScale)
      this.createEvent('OnStartEvent').bind(() => this.run(() => this.initialize()))
      this.createEvent('OnDestroyEvent').bind(() => {this.alive = false;this.client.destroy();if(this.recorder)this.recorder.destroy();if(this.audio)this.audio.destroy()})
    } catch(error) {print('[Snap Cloud Social Media] ' + error)}
  }
  private async run(action: () => Promise<void>): Promise<void> {
    try {await action()} catch(error) {if(this.state==='busy')this.state='ready';if(this.panel)this.panel.setStatus(String(error));}
  }
  private async initialize(): Promise<void> {
    await this.client.initialize()
    this.recorder = new CameraRecorder(this, this.config.capture.fps, this.config.capture.maxSeconds,
      () => this.run(() => this.finishRecording()), message => {if(this.audio)this.audio.destroy();this.state='ready';this.panel.setRecording(false);this.panel.setStatus(message)},this.compositeTexture)
    if(this.config.capture.includeAudio){if(!this.microphone)throw new Error('Assign a microphone audio track or disable Include microphone');this.audio=new AudioRecorder(this,this.microphone)}
    await this.refresh();this.state='ready'
    this.panel.setStatus(this.config.demoMode?'Demo ready · record a clip, select destinations, simulate share':'Ready · Connect accounts in the editor plugin')
  }
  private async refresh(): Promise<void> {
    if(this.config.demoMode) for(const p of PROVIDERS){this.connected[p.id]=true;this.panel.setConnection(p.id,true)}
    else for(const c of await this.client.connections()) {
      const id=c.id||c.provider;this.connected[id]=c.connected;this.panel.setConnection(id,c.connected)
    }
  }
  private async record(): Promise<void> {
    if(this.state==='recording'){await this.finishRecording();return}
    if(this.state!=='ready'||this.activeJob){this.panel.setStatus('Finish the current upload before recording again');return}
    if(this.audio)this.audio.start()
    try{this.recorder.start()}catch(error){if(this.audio)this.audio.destroy();throw error}
    this.media=null;this.state='recording';this.panel.setRecording(true)
    this.panel.setStatus(`Recording · up to ${this.config.capture.maxSeconds}s · ${this.config.capture.aspect}`)
  }
  private async finishRecording(): Promise<void> {
    if(this.state!=='recording')return
    this.state='busy';this.panel.setRecording(false);this.panel.setStatus('Preparing recording…')
    const audio=this.audio?this.audio.stop():null
    const frames=await this.recorder.stop()
    if(this.config.capture.includeAudio&&!audio&&!this.config.demoMode)throw new Error('No microphone samples captured. Check microphone access or disable Include microphone.')
    this.panel.setStatus(this.config.demoMode?'Preparing demo clip…':'Uploading frames and encoding MP4…')
    this.media=await this.client.upload(frames,'video',audio);this.requestKey=uuid();this.state='ready'
    this.panel.setStatus(`Clip ready · ${this.media.duration.toFixed(1)}s · choose destinations and share`)
  }
  private async photo(): Promise<void> {
    if(this.state!=='ready'||this.activeJob)return
    this.state='busy';this.media=null;this.panel.setStatus('Capturing photo…')
    this.media=await this.client.upload(await this.recorder.photo(),'photo');this.requestKey=uuid();this.state='ready';this.panel.setStatus('Photo ready · select photo formats before sharing')
  }
  private async share(): Promise<void> {
    if(this.state!=='ready'||!this.media){this.panel.setStatus('Capture a photo or record a clip first');return}
    this.state='busy'
    const targets=PROVIDERS.filter(p=>this.config.destinations[p.id].enabled).map(p=>{
      const d=this.config.destinations[p.id]
      if(!this.connected[p.id])throw new Error('Connect '+p.name+' in the editor plugin')
      if((d.format==='photo')!==(this.media.kind==='photo'))throw new Error('Choose compatible media formats for '+p.name)
      if(p.id==='tiktok'&&d.publishMode==='direct'&&!d.privacyLevel)throw new Error('Select TikTok, then choose privacy before sharing')
      return {provider:p.id,...d,caption:d.caption||this.config.composer.caption,title:d.title||this.config.composer.title,...(p.id==='tiktok'&&d.publishMode==='direct'?{consent:true}:{})}
    })
    if(!targets.length)throw new Error('Enable at least one destination')
    if(this.config.demoMode){this.panel.setStatus('DEMO · Simulated '+targets.map(t=>t.provider+'/'+t.format).join(', ')+' · No posts sent');this.state='ready';return}
    this.panel.setStatus('Submitting to '+targets.length+' destinations…')
    const job=await this.client.share(this.media.id,targets,this.requestKey)
    this.activeJob=job.id
    await this.pollJob()
  }
  private async pollJob(): Promise<void> {
    if(!this.alive)return
    try {
      const job=await this.client.job(this.activeJob)
      this.panel.setStatus(job.results?.length?job.results.map(r=>r.provider+': '+r.state).join(' · '):'Sharing · '+job.status)
      if(['complete','partial','failed','unknown'].includes(job.status)) {
        this.activeJob='';this.state='ready'
        if(job.status==='unknown')this.panel.setStatus('Delivery uncertain · inspect your accounts before posting again')
        return
      }
    }catch(error){this.panel.setStatus('Waiting for connection · job remains saved on server')}
    const delay=this.createEvent('DelayedCallbackEvent') as DelayedCallbackEvent
    delay.bind(()=>{this.removeEvent(delay);this.run(()=>this.pollJob())});delay.reset(2)
  }
  private selected(id: ProviderId): void {
    if(id==='tiktok'&&this.config.destinations.tiktok.publishMode==='direct'&&!this.config.demoMode) {
      this.run(async()=>{this.creator=await this.client.request('/v1/connections/tiktok/creator');this.panel.setStatus('TikTok '+this.creator.creator_nickname+' · choose privacy, then Share')})
    }
  }
  private async privacy(id: ProviderId): Promise<void> {
    const d=this.config.destinations[id]
    if(id==='youtube'){const options=['private','unlisted','public'];d.privacy=options[(options.indexOf(d.privacy||'private')+1)%options.length];this.panel.deliveryLabel();return}
    if(id==='tiktok'&&d.publishMode==='direct') {
      const options=this.config.demoMode?['SELF_ONLY']:this.creator?.privacy_level_options
      if(!options?.length)throw new Error('Select TikTok and load creator settings first')
      d.privacyLevel=options[(options.indexOf(d.privacyLevel)+1)%options.length];this.panel.deliveryLabel();return
    }
    this.panel.setStatus(id==='tiktok'?'Inbox mode: finish publishing in TikTok':id==='snapchat'?'Public Profile API · allowlisting required · Story captions omitted':'Use the editor plugin to connect or disconnect this account')
  }
}
