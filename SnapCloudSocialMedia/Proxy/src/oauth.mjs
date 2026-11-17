import {randomToken,digest} from './security.mjs';
import {provider} from './catalog.mjs';
export const oauthConfig = {
 snapchat:{auth:'https://accounts.snapchat.com/login/oauth2/authorize',token:'https://accounts.snapchat.com/login/oauth2/access_token',scope:'snapchat-profile-api'},
 x:{auth:'https://x.com/i/oauth2/authorize',token:'https://api.x.com/2/oauth2/token',scope:'tweet.read tweet.write users.read media.write offline.access'},
 youtube:{auth:'https://accounts.google.com/o/oauth2/v2/auth',token:'https://oauth2.googleapis.com/token',scope:'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly'},
 linkedin:{auth:'https://www.linkedin.com/oauth/v2/authorization',token:'https://www.linkedin.com/oauth/v2/accessToken',scope:'openid profile w_member_social'},
 instagram:{auth:'https://www.instagram.com/oauth/authorize',token:'https://api.instagram.com/oauth/access_token',scope:'instagram_business_basic,instagram_business_content_publish'},
 threads:{auth:'https://threads.net/oauth/authorize',token:'https://graph.threads.net/oauth/access_token',scope:'threads_basic,threads_content_publish'},
 tiktok:{auth:'https://www.tiktok.com/v2/auth/authorize/',token:'https://open.tiktokapis.com/v2/oauth/token/',scope:'user.info.basic,video.upload'}
};
export class OAuth {
 constructor(cloud,vault,origin,env=process.env,fetcher=fetch) {Object.assign(this,{cloud,vault,origin,env,fetch:fetcher});}
 settings(id) {
  provider(id); const conf=oauthConfig[id]; if(!conf) throw Object.assign(new Error('Use the Snapchat share handoff'),{status:400});
  const prefix=id.toUpperCase(),clientId=this.env[`${prefix}_CLIENT_ID`],secret=this.env[`${prefix}_CLIENT_SECRET`];
  if(!clientId||(id!=='x'&&!secret)) throw Object.assign(new Error(`Configure ${prefix}_CLIENT_ID and CLIENT_SECRET on the proxy, or connect an existing user access token`),{status:409});
  return {...conf,scope:this.env[`${prefix}_SCOPES`]||conf.scope,clientId,secret,redirect:`${this.origin}/oauth/${id}/callback`};
 }
 async begin(user,id) {
  const conf=this.settings(id),state=randomToken(),verifier=randomToken();
  await this.cloud.insert('social_oauth_states',{id:digest(state),user_id:user,provider:id,verifier:this.vault.seal(verifier),expires_at:new Date(Date.now()+600000).toISOString()});
  const u=new URL(conf.auth);
  const params={client_id:conf.clientId,redirect_uri:conf.redirect,response_type:'code',scope:conf.scope,state};
  if(['x','tiktok'].includes(id)) Object.assign(params,{code_challenge:digestBase64(verifier),code_challenge_method:'S256'});
  if(id==='tiktok') {params.client_key=params.client_id;delete params.client_id;}
  if(id==='youtube') Object.assign(params,{access_type:'offline',prompt:'consent'});
  if(id==='instagram') Object.assign(params,{enable_fb_login:'0',force_authentication:'1'});
  u.search=new URLSearchParams(params).toString(); return {url:u.toString()};
 }
 async complete(id,state,code) {
  if(!state||!code) throw Object.assign(new Error('Authorization was cancelled or incomplete'),{status:400});
  const conf=this.settings(id),hash=digest(state);
  // Atomic consumption prevents replay, including concurrent callbacks.
  const consumed=await this.cloud.request(`/rest/v1/social_oauth_states?id=eq.${hash}&provider=eq.${id}&consumed=eq.false&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({consumed:true})});
  const row=consumed[0];if(!row) throw Object.assign(new Error('Authorization link expired or already used'),{status:400});
  const params={grant_type:'authorization_code',code,redirect_uri:conf.redirect,client_id:conf.clientId,client_secret:conf.secret};
  if(['x','tiktok'].includes(id)) params.code_verifier=this.vault.open(row.verifier);
  if(id==='tiktok') {params.client_key=params.client_id;delete params.client_id;}
  const headers={'Content-Type':'application/x-www-form-urlencoded'};
  if(id==='x' && conf.secret) {headers.Authorization='Basic '+Buffer.from(`${conf.clientId}:${conf.secret}`).toString('base64');delete params.client_secret;}
  if(!conf.secret)delete params.client_secret;
  // Instagram's token endpoint expects multipart form data.
  let body=new URLSearchParams(params);
  if(id==='instagram') {body=new FormData();for(const [k,v]of Object.entries(params))body.append(k,v);delete headers['Content-Type'];}
  const r=await this.fetch(conf.token,{method:'POST',headers,body,signal:AbortSignal.timeout(30000)});
  if(!r.ok) throw new Error(`Authorization exchange failed (${r.status}); check app permissions and redirect URI`);
  const token=await r.json(); if(!token.access_token) throw new Error('Provider returned no user access token');
  await this.connect(row.user_id,id,token);
 }
 async connect(user,id,token) {
  provider(id);
  if(!token.access_token||typeof token.access_token!=='string'||token.access_token.length>8192) throw Object.assign(new Error('Enter a user access token'),{status:400});
  const endpoints={snapchat:'https://businessapi.snapchat.com/v1/public_profiles/my_profile',x:'https://api.x.com/2/users/me',youtube:'https://www.googleapis.com/youtube/v3/channels?part=id&mine=true',linkedin:'https://api.linkedin.com/v2/userinfo',instagram:`https://graph.instagram.com/${this.env.INSTAGRAM_VERSION||'v23.0'}/me?fields=user_id,username`,threads:'https://graph.threads.net/v1.0/me?fields=id,username',tiktok:'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name'};
  if(!endpoints[id]) throw Object.assign(new Error('Snapchat uses a share handoff'),{status:400});
  const r=await this.fetch(endpoints[id],{headers:{Authorization:`Bearer ${token.access_token}`},signal:AbortSignal.timeout(20000)});
  if(!r.ok) throw Object.assign(new Error(`Token verification failed (${r.status}); check account and scopes`),{status:400});
  const data=await r.json();
  const account=({snapchat:data.request_status==='SUCCESS'?data.public_profile?.id:null,x:data.data?.id,youtube:data.items?.[0]?.id,linkedin:data.sub,instagram:data.user_id||data.id,threads:data.id,tiktok:data.data?.user?.open_id})[id];
  if(!account) throw Object.assign(new Error('Could not verify a publishing account'),{status:400});
  const safe={access_token:token.access_token,refresh_token:typeof token.refresh_token==='string'?token.refresh_token:undefined,expires_at:token.expires_in?Date.now()+Number(token.expires_in)*1000:undefined};
  await this.cloud.saveConnection(user,id,this.vault.seal(safe),String(account));
  return {provider:id,account_id:String(account),connected:true};
 }
 async credential(user,id) {
  const row=await this.cloud.connection(user,id);if(!row) throw new Error(`Connect ${provider(id).name} before sharing`);
  let token=this.vault.open(row.credential);
  if(token.expires_at && token.expires_at<Date.now()+60000) {
   // Meta short-lived/long-lived tokens have provider-specific exchange rules;
   // explicitly ask for reconnection instead of silently reusing expired tokens.
   if(!token.refresh_token||['instagram','threads'].includes(id)) throw new Error(`Reconnect ${provider(id).name}; authorization expired`);
   const conf=this.settings(id),params={grant_type:'refresh_token',refresh_token:token.refresh_token,client_id:conf.clientId,client_secret:conf.secret};
   if(id==='tiktok'){params.client_key=params.client_id;delete params.client_id;}
   const headers={'Content-Type':'application/x-www-form-urlencoded'};
   if(id==='x'&&conf.secret){headers.Authorization='Basic '+Buffer.from(`${conf.clientId}:${conf.secret}`).toString('base64');delete params.client_secret;}
   if(!conf.secret)delete params.client_secret;
   const r=await this.fetch(conf.token,{method:'POST',headers,body:new URLSearchParams(params),signal:AbortSignal.timeout(30000)});
   if(!r.ok) throw new Error(`Reconnect ${provider(id).name}; refresh failed`);
   const next=await r.json();if(!next.access_token)throw new Error('Refresh returned no token');
   token={access_token:next.access_token,refresh_token:next.refresh_token||token.refresh_token,expires_at:Date.now()+Number(next.expires_in||3600)*1000};
   await this.cloud.saveConnection(user,id,this.vault.seal(token),row.account_id);
  }
  return {...token,account:row.account_id};
 }
}
function digestBase64(value) {return Buffer.from(digest(value),'hex').toString('base64url');}
