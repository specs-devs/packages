// Class representing Supabase project credentials
export class SupabaseProjectCredential {

  constructor(name, id, domain) {
    this._name = name
    this._id = id
    this._domain = domain
    this._publishableToken = ''  // New format: type === 'publishable'
    this._anonToken = ''          // Legacy format: id === 'anon'
    this._hasPublishableToken = false  // Track if project has new publishable key
    this._hasLegacyAnonToken = false   // Track if project has legacy anon key
  }
  set name(name) {
    this._name = name
  }
  get name () {
    return this._name
  }

  set id(id) {
    this._id = id
  }
  get id () {
    return this._id
  }

  get url () {
    return `https://${this._id}.${this._domain}`
  }

  set publishableToken(publishableToken) {
    this._publishableToken = publishableToken
    this._hasPublishableToken = publishableToken !== ''
  }
  get publishableToken () {
    return this._publishableToken
  }

  set anonToken(anonToken) {
    this._anonToken = anonToken
    this._hasLegacyAnonToken = anonToken !== ''
  }
  get anonToken () {
    return this._anonToken
  }

  // Get the appropriate public token: prefer publishable if available, else fallback to legacy anon
  get publicToken () {
    return this._publishableToken || this._anonToken
  }

  get hasPublishableToken () {
    return this._hasPublishableToken
  }

  get hasLegacyAnonToken () {
    return this._hasLegacyAnonToken
  }

};
