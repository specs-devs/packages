import {readFile} from 'node:fs/promises';
import {providers} from './catalog.mjs';
export async function loadProxyConfig(env=process.env) {
 if(!env.SOCIAL_PROXY_CONFIG)return {...env};
 const config=JSON.parse(await readFile(env.SOCIAL_PROXY_CONFIG,'utf8'));
 if(config.schemaVersion!==1)throw new Error('Unsupported proxy config version');
 const resolve=value=>typeof value==='string' && value.startsWith('$') ? env[value.slice(1)]||'' : value;
 const output={...env};
 const mapping={publicOrigin:'PUBLIC_ORIGIN',port:'PORT',snapCloudUrl:'SNAP_CLOUD_URL',serviceRoleKey:'SNAP_CLOUD_SERVICE_ROLE_KEY',tokenEncryptionKey:'TOKEN_ENCRYPTION_KEY'};
 for(const [key,target]of Object.entries(mapping))if(config[key]!==undefined)output[target]=String(resolve(config[key]));
 for(const p of providers) {
  const app=config.apps?.[p.id];if(!app)continue;
  if(app.clientId!==undefined)output[p.id.toUpperCase()+'_CLIENT_ID']=resolve(app.clientId);
  if(app.clientSecret!==undefined)output[p.id.toUpperCase()+'_CLIENT_SECRET']=resolve(app.clientSecret);
  if(app.scopes!==undefined)output[p.id.toUpperCase()+'_SCOPES']=resolve(app.scopes);
 }
 return output;
}
