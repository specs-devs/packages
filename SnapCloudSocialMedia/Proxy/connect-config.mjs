// Explicit CLI action: import existing user-authorized platform tokens. This is
// account configuration only; it never publishes a post.
import {readFile} from 'node:fs/promises';
import {assertBaseUrl} from './src/security.mjs';
import {provider} from './src/catalog.mjs';
const config=JSON.parse(await readFile(process.argv[2]||'connections.private.json','utf8'));
if(config.schemaVersion!==1||!Array.isArray(config.connections))throw new Error('Invalid connections JSON');
const resolve=value=>value?.startsWith('$')?process.env[value.slice(1)]||'':value;
const url=assertBaseUrl(config.proxyUrl,true),bearer=resolve(config.snapCloudAccessToken);
if(!bearer)throw new Error('Provide SNAP_CLOUD_ACCESS_TOKEN for the account owner');
for(const c of config.connections) {
 const p=provider(c.provider);
 const r=await fetch(`${url}/v1/connections/${p.id}/token`,{method:'POST',headers:{Authorization:`Bearer ${bearer}`,'Content-Type':'application/json'},body:JSON.stringify({access_token:resolve(c.accessToken),refresh_token:resolve(c.refreshToken),expires_in:c.expiresIn}),signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw new Error(`${p.name} token import failed (${r.status}); check permissions`);
 console.log(`${p.name} account connected`);
}
