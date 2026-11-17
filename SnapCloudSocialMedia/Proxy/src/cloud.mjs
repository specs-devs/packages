import {assertOwnedKey} from './security.mjs';
export class Cloud {
  constructor(url,key,fetcher=fetch) { this.url=url.replace(/\/$/,''); this.key=key; this.fetch=fetcher; }
  async request(path,options={}) {
    const r=await this.fetch(this.url+path,{...options,headers:{apikey:this.key,Authorization:`Bearer ${this.key}`,'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout(60000)});
    if (!r.ok) throw new Error(`Snap Cloud request failed (${r.status})`);
    if (r.status===204) return null;
    const text=await r.text(); return text?JSON.parse(text):null;
  }
  async user(bearer) {
    if (!bearer) throw Object.assign(new Error('Snap Cloud sign-in required'),{status:401});
    const r=await this.fetch(this.url+'/auth/v1/user',{headers:{apikey:this.key,Authorization:`Bearer ${bearer}`},signal:AbortSignal.timeout(15000)});
    if (!r.ok) throw Object.assign(new Error('Session expired; sign in again'),{status:401});
    const user=await r.json(); if(!user.id) throw Object.assign(new Error('Invalid session'),{status:401}); return user.id;
  }
  rows(table,query='') { return this.request(`/rest/v1/${table}?${query}`); }
  async insert(table,value) { const rows=await this.request(`/rest/v1/${table}`,{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify(value)}); return rows[0]; }
  patch(table,query,value) { return this.request(`/rest/v1/${table}?${query}`,{method:'PATCH',body:JSON.stringify(value)}); }
  remove(table,query) { return this.request(`/rest/v1/${table}?${query}`,{method:'DELETE'}); }
  async get(table,user,id) { return (await this.rows(table,`user_id=eq.${encodeURIComponent(user)}&id=eq.${encodeURIComponent(id)}`))[0]; }
  async connection(user,provider) { return (await this.rows('social_connections',`user_id=eq.${encodeURIComponent(user)}&provider=eq.${provider}`))[0]; }
  async saveConnection(user,provider,credential,account) {
    return this.request('/rest/v1/social_connections?on_conflict=user_id,provider',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({user_id:user,provider,credential,account_id:account,updated_at:new Date().toISOString()})});
  }
  async readObject(user,key) {
    assertOwnedKey(user,key);
    const r=await this.fetch(`${this.url}/storage/v1/object/social-media/${key}`,{headers:{apikey:this.key,Authorization:`Bearer ${this.key}`},signal:AbortSignal.timeout(60000)});
    if(!r.ok) throw new Error(`Recording object unavailable (${r.status})`);
    const size=Number(r.headers.get('content-length'));
    if(size>50*1024*1024) throw new Error('Recording object too large');
    const body=Buffer.from(await r.arrayBuffer()); if(body.length>50*1024*1024) throw new Error('Recording object too large'); return body;
  }
  async writeObject(user,key,body,type) {
    assertOwnedKey(user,key);
    const r=await this.fetch(`${this.url}/storage/v1/object/social-media/${key}`,{method:'POST',headers:{apikey:this.key,Authorization:`Bearer ${this.key}`,'Content-Type':type,'x-upsert':'true'},body,signal:AbortSignal.timeout(60000)});
    if(!r.ok) throw new Error(`Rendered upload failed (${r.status})`);
  }
  async signedObject(user,key) {
    assertOwnedKey(user,key);
    const r=await this.request(`/storage/v1/object/sign/social-media/${key}`,{method:'POST',body:JSON.stringify({expiresIn:3600})});
    return this.url+'/storage/v1'+r.signedURL;
  }
}
