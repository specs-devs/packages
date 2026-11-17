/**
 * DecartWebRTCSession — the TS half of the on-device native WebRTC path.
 *
 * Owns the Decart /v1/stream signaling WebSocket (via the Lens InternetModule)
 * and bridges it to the native module (libDecartWebRTCModule.so):
 *
 *   native offer/ICE  ──getSignalingOut()──▶  this ──WS──▶ Decart
 *   Decart answer/ICE  ──WS──▶  this ──setRemoteAnswer()/addRemoteCandidate()──▶ native
 *   prompt             ──WS──▶  Decart   (control rides the signaling channel)
 *
 * Media (camera encode + return-track decode → getFrameRGBA) is entirely native.
 * The Decart wire shapes (ice-candidate nesting, message types) follow
 * README-WebRTC-OnDevice.md and are a tuning point against live Decart.
 */
import type {DecartWebRTCNativeExports} from './DecartWebRTCNativeModule'

export class DecartWebRTCSession {
  private ws: WebSocket | null = null
  private wsOpen = false
  private pendingPrompt = ''

  constructor(
    private lib: DecartWebRTCNativeExports,
    private internetModule: InternetModule,
    private endpoint: string,
    private apiKey: string,
    private model: string,
    private log: (msg: string) => void
  ) {}

  /** Create the native session + offer, then open the Decart signaling socket. */
  start(prompt: string, useH265: boolean, fps: number, bitrateKbps: number, cameraMaxWidth: number): void {
    this.pendingPrompt = prompt
    const r = this.lib.startSession(useH265 ? 1 : 0, fps, bitrateKbps, cameraMaxWidth)
    this.log('native startSession -> ' + r)

    const sep = this.endpoint.indexOf('?') >= 0 ? '&' : '?'
    const url =
      this.endpoint + sep + 'api_key=' + encodeURIComponent(this.apiKey) + '&model=' + encodeURIComponent(this.model)
    try {
      this.ws = this.internetModule.createWebSocket(url)
    } catch (e) {
      this.log('Decart signaling connect failed: ' + String(e))
      return
    }
    this.log('connecting model=' + this.model + ' → ' + this.endpoint)
    const sock = this.ws
    sock.onopen = () => {
      this.wsOpen = true
      this.log('Decart signaling connected')
      // Per Decart spec: offer first, prompt AFTER the answer. Prompt is sent from
      // handleMessage() once the answer is applied (not here on open).
    }
    sock.onmessage = (event: WebSocketMessageEvent) => {
      if (typeof event.data === 'string') {
        this.handleMessage(event.data)
      } else {
        this.log('rx: <binary frame>')
      }
    }
    sock.onclose = () => {
      this.wsOpen = false
    }
    sock.onerror = () => {
      this.log('Decart signaling socket error')
    }
  }

  /** Call once per frame: forward native's queued offer/ICE to Decart. */
  pump(): void {
    if (!this.wsOpen || !this.ws) {
      return
    }
    for (let i = 0; i < 8; i++) {
      const out = this.lib.getSignalingOut()
      if (!out || out.kind === 'none') {
        break
      }
      if (out.kind === 'offer' && out.sdp) {
        this.ws.send(JSON.stringify({type: 'offer', sdp: out.sdp}))
        this.log('tx: offer (' + out.sdp.length + 'B)')
        const flat = out.sdp.replace(/\r/g, '').replace(/\n/g, ' | ')
        for (let i = 0; i < flat.length; i += 180) {
          this.log('sdp+' + i + ': ' + flat.substring(i, i + 180))
        }
      } else if (out.kind === 'cand' && out.candidate) {
        this.ws.send(
          JSON.stringify({type: 'ice-candidate', candidate: {candidate: out.candidate, sdpMid: out.mid || '0'}})
        )
        this.log('tx: ice mid=' + (out.mid || '0'))
      }
    }
  }

  setPrompt(prompt: string): void {
    this.pendingPrompt = prompt
    if (this.wsOpen) {
      this.sendPrompt(prompt)
    }
  }

  stop(): void {
    try {
      this.lib.stopSession()
    } catch (e) {
      // ignore
    }
    if (this.ws) {
      try {
        this.ws.close()
      } catch (e) {
        // already closed
      }
      this.ws = null
    }
    this.wsOpen = false
  }

  private sendPrompt(prompt: string): void {
    if (this.ws && this.wsOpen) {
      this.ws.send(JSON.stringify({type: 'prompt', prompt: prompt, enhance_prompt: true}))
    }
  }

  private handleMessage(raw: string): void {
    let msg: {type?: string; sdp?: string; candidate?: unknown; session_id?: string; success?: boolean; message?: string}
    try {
      msg = JSON.parse(raw)
    } catch (e) {
      this.log('rx: <non-JSON ' + raw.length + 'B> ' + raw.substring(0, 60))
      return
    }
    const t = msg.type
    this.log('rx: ' + (t || '?') + ' ' + raw.substring(0, 80))
    if (t === 'answer' && msg.sdp) {
      this.lib.setRemoteAnswer(msg.sdp)
      this.log('Decart answer applied')
      if (this.pendingPrompt) {
        this.sendPrompt(this.pendingPrompt) // prompt after answer, per spec
      }
    } else if (t === 'ice-candidate' && msg.candidate) {
      const c = msg.candidate as {candidate?: string; sdpMid?: string} | string
      const cand = typeof c === 'string' ? c : c.candidate
      const mid = typeof c === 'string' ? '0' : c.sdpMid || '0'
      if (cand) {
        this.lib.addRemoteCandidate(cand, mid)
      }
    } else if (t === 'session_id') {
      this.log('Decart session ' + (msg.session_id || ''))
    } else if (t === 'prompt_ack') {
      this.log('prompt ' + (msg.success ? 'ack' : 'rejected'))
    } else if (t === 'error' || t === 'session_error') {
      this.log('Decart error: ' + (msg.message || raw.substring(0, 120)))
    }
  }
}
