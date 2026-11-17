import {createClient} from 'SupabaseClient.lspkg/supabase-snapcloud'
import {SocialConfig, ProviderId} from './SocialConfig'
export interface Connection {provider?: ProviderId; id?: ProviderId; name: string; connected: boolean; note: string}
export interface CapturedFrame {bytes: Uint8Array; time: number}
export interface ShareResult {provider: string; state: string; message?: string; id?: string; url?: string}
export class SocialClient {
  private cloud: ReturnType<typeof createClient>
  private user: string
  private internet: InternetModule = require('LensStudio:InternetModule')
  constructor(private config: SocialConfig) {}
  async initialize(): Promise<void> {
    if (this.config.demoMode) return
    this.cloud = createClient(this.config.cloud.url, this.config.cloud.publishableKey, {realtime: {heartbeatIntervalMs: 2500}})
    const {data, error} = await this.cloud.auth.signInWithIdToken({provider: 'snapchat', token: ''})
    if (error || !data.user?.id) throw new Error('Snap Cloud sign-in failed. Check your project and account access.')
    this.user = data.user.id
  }
  async request(path: string, method: string = 'GET', body?: unknown): Promise<any> {
    const {data, error} = await this.cloud.auth.getSession()
    if (error || !data.session?.access_token) throw new Error('Sign in to Snap Cloud again')
    const response = await this.internet.fetch(this.config.proxyUrl.replace(/\/$/, '') + path, {
      method, headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + data.session.access_token},
      ...(body !== undefined ? {body: JSON.stringify(body)} : {})
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Social proxy request failed')
    return result
  }
  async connections(): Promise<Connection[]> {
    return this.request('/v1/connections')
  }
  async upload(frames: CapturedFrame[], kind: 'photo' | 'video', audio?: Uint8Array): Promise<any> {
    if (this.config.demoMode) return {id: 'demo-recording', kind, duration: frames[frames.length - 1]?.time || 0}
    const session = uuid(), uploaded: {key: string; time: number}[] = []
    for (let i = 0; i < frames.length; i++) {
      const key = `${this.user}/${session}/frame-${String(i).padStart(4, '0')}.jpg`
      const {error} = await this.cloud.storage.from('social-media').upload(key, frames[i].bytes, {contentType: 'image/jpeg', upsert: false})
      if (error) throw new Error('Recording upload failed; no social posts were sent')
      uploaded.push({key, time: frames[i].time})
    }
    let audioKey: string | undefined
    if(audio){audioKey=`${this.user}/${session}/audio.wav`;const {error}=await this.cloud.storage.from('social-media').upload(audioKey,audio,{contentType:'audio/wav',upsert:false});if(error)throw new Error('Microphone upload failed; no posts were sent')}
    const media = await this.request('/v1/media/finalize', 'POST', kind === 'photo'
      ? {kind, key: uploaded[0].key}
      : {kind, frames: uploaded, aspect: this.config.capture.aspect, audioKey})
    // Raw frames are temporary; the server has safely persisted the MP4/JPEG.
    await this.cloud.storage.from('social-media').remove(uploaded.map(f => f.key).concat(audioKey?[audioKey]:[]))
    return media
  }
  async share(mediaId: string, targets: unknown[], requestKey: string): Promise<any> {
    return this.request('/v1/jobs', 'POST', {mediaId, targets, requestKey})
  }
  async job(id: string): Promise<any> {return this.request('/v1/jobs/' + id)}
  destroy(): void {if (this.cloud) this.cloud.removeAllChannels()}
}
// A UUID is a deduplication key, not an authentication secret.
export function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16)
    return (c === 'x' ? r : (r & 3) | 8).toString(16)
  })
}
