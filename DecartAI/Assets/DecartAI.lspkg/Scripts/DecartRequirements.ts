// DecartRequirements — central Decart API key gate + setup reminder.
//
// Paste YOUR Decart API key (https://platform.decart.ai) either here or
// directly on the DecartRestyle object's apiKey field. Until a real key is
// provided (empty or the PASTE_YOUR_DECART_API_KEY placeholder don't count),
// an optional Text shows a reminder and the console logs what to do.
// The key is only needed for http mode and on-device WebRTC — bridge mode's
// key lives in DecartBridge/bridge.py (DECART_API_KEY env var).
// Mirrors the SupabaseRequirements pattern used by the People Finder family.

export const DECART_API_KEY_PLACEHOLDER = 'PASTE_YOUR_DECART_API_KEY'

@component
export class DecartRequirements extends BaseScriptComponent {
  @input('string')
  @hint('Decart API key from https://platform.decart.ai — used when the DecartRestyle object has none')
  @allowUndefined
  apiKey: string = 'PASTE_YOUR_DECART_API_KEY'

  @input
  @hint('Optional Text that shows the reminder until a key is provided')
  @allowUndefined
  text: Text

  private static instance: DecartRequirements | null = null
  private static externalKeyPresent = false
  private static warned = false

  onAwake(): void {
    DecartRequirements.instance = this
    this.createEvent('OnStartEvent').bind(() => this.refresh())
  }

  /** A usable key: non-empty and not the shipped placeholder. */
  static isRealKey(key: string | undefined | null): boolean {
    return !!key && key.length > 0 && key !== DECART_API_KEY_PLACEHOLDER
  }

  /**
   * Central key lookup used by DecartRealtimeRestyle. Returns null (with a
   * one-time console reminder) while no key has been provided anywhere.
   */
  static getApiKey(caller: string): string | null {
    const inst = DecartRequirements.instance
    const key = inst && DecartRequirements.isRealKey(inst.apiKey) ? inst.apiKey : null
    if (!key && !DecartRequirements.warned) {
      DecartRequirements.warned = true
      print(
        '[DecartRequirements] (' + caller + ') No Decart API key set — paste yours on the ' +
        'DecartRequirements script or the DecartRestyle object (needed for http mode and ' +
        'on-device WebRTC; bridge mode reads DECART_API_KEY in bridge.py).'
      )
    }
    return key
  }

  /** Called by DecartRealtimeRestyle when it resolves a usable key on its own input. */
  static markConfigured(): void {
    DecartRequirements.externalKeyPresent = true
    if (DecartRequirements.instance) {
      DecartRequirements.instance.refresh()
    }
  }

  private refresh(): void {
    const configured =
      DecartRequirements.externalKeyPresent || DecartRequirements.isRealKey(this.apiKey)
    if (configured) {
      print('[DecartRequirements] Decart API key configured.')
      if (this.text) {
        this.text.enabled = false
      }
      return
    }
    const msg =
      'Decart API key not set!\n' +
      'Paste your key (platform.decart.ai) on the\n' +
      'DecartRequirements script or the DecartRestyle\n' +
      "object's apiKey field.\n" +
      'Needed for http mode and on-device WebRTC;\n' +
      'bridge mode reads DECART_API_KEY in bridge.py.'
    if (this.text) {
      this.text.enabled = true
      this.text.text = msg
    }
    print('[DecartRequirements] ' + msg.replace(/\n/g, ' '))
  }
}
