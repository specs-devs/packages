import {
  createClient,
  SupabaseClient,
  RealtimeChannel,
} from 'SupabaseClient.lspkg/supabase-snapcloud'
import { SnapCloudRequirements } from '../SnapCloudRequirements'

@component
export class TsTestRealtime extends BaseScriptComponent {

  @input
  @allowUndefined
  @hint('SnapCloudRequirements holding the Supabase project')
  snapCloudRequirements: SnapCloudRequirements

  @input
  @allowUndefined
  @hint('Deprecated: use snapCloudRequirements')
  supabaseProject: SupabaseProject

  @input
  @hint('Channel name for realtime subscription')
  channelName: string = 'test-channel'

  private client: SupabaseClient
  private uid: string
  private channel: RealtimeChannel

  onAwake() {
    this.createEvent('OnStartEvent').bind(() => {
      this.onStart()
    })
  }

  onStart() {
    this.initSupabase()
  }

  async initSupabase() {
    this.log('Initializing Supabase client...')

    const options = {
      realtime: {
        // Temporary fix due to a known alpha limitation
        heartbeatIntervalMs: 2500,
      },
    }

    const project = this.getSupabaseProject()
    if (!project) {
      this.log('No Supabase Project assigned — set a Snap Cloud Supabase Project asset on SnapCloudRequirements, then reset the Preview.')
      return
    }

    let url = ''
    let token = ''
    try {
      url = project.url
      token = project.publicToken
    } catch (e) {
      this.log('SupabaseProject fields blocked by platform (' + e + ') — only works on paired Glasses device')
      return
    }

    this.client = createClient(url, token, options)

    if (this.client) {
      this.log('Client created successfully')
      await this.signInUser()
      if (this.uid) {
        this.log('Setting up realtime subscription...')
        await this.setupRealtimeSubscription()
      }
    }
  }

  /** The project from SnapCloudRequirements; the deprecated supabaseProject input only when it isn't wired. */
  private getSupabaseProject(): SupabaseProject {
    if (this.snapCloudRequirements) {
      return this.snapCloudRequirements.getSupabaseProject()
    }
    return this.supabaseProject
  }

  async signInUser() {
    this.log('Signing in user...')
    const { data, error } = await this.client.auth.signInWithIdToken({
      provider: 'snapchat',
      token: '',
    })

    if (error) {
      this.log('Sign in error: ' + JSON.stringify(error))
    } else {
      const { user } = data
      this.uid = JSON.stringify(user.id).replace(/^"(.*)"$/, '$1')
      this.log('User authenticated: ' + this.uid)
    }
  }

  async setupRealtimeSubscription() {
    this.log('--- REALTIME TEST START ---')

    this.channel = this.client
      .channel(this.channelName)
      .on('broadcast', { event: 'test-event' }, (msg) => {
        this.log('--- BROADCAST RECEIVED ---')
        this.log('Payload: ' + JSON.stringify(msg.payload))
      })

    this.channel.subscribe((status) => {
      this.log('Channel status: ' + status)
      if (status === 'SUBSCRIBED') {
        this.log('Realtime channel active — sending test broadcast')
        this.sendBroadcastMessage('Hello from Lens Studio!')
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.log('Channel closed or error')
      }
    })
  }

  async sendBroadcastMessage(message: string) {
    if (!this.channel) {
      this.log('Channel not initialized')
      return
    }
    this.log('Sending broadcast: ' + message)
    this.channel.send({
      type: 'broadcast',
      event: 'test-event',
      payload: {
        message: message,
        user_id: this.uid,
        timestamp: Date.now(),
      },
    })
    this.log('Broadcast sent')
  }

  onDestroy() {
    this.log('Cleaning up realtime subscriptions...')
    if (this.client) {
      this.client.removeAllChannels()
    }
  }

  private log(message: string) {
    print('[ts_test_realtime] ' + message)
  }
}
