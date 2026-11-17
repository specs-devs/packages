import {randomBytes,createCipheriv,createDecipheriv,createHash} from 'node:crypto';
export function encryption(key) {
  const raw=Buffer.from(key||'', 'base64');
  if (raw.length!==32) throw new Error('TOKEN_ENCRYPTION_KEY must contain 32 base64-encoded bytes');
  return {
    seal(value) { const iv=randomBytes(12), c=createCipheriv('aes-256-gcm',raw,iv); const body=Buffer.concat([c.update(JSON.stringify(value)),c.final()]); return [iv,c.getAuthTag(),body].map(b=>b.toString('base64')).join('.'); },
    open(value) { const [iv,tag,body]=value.split('.').map(s=>Buffer.from(s,'base64')); const c=createDecipheriv('aes-256-gcm',raw,iv); c.setAuthTag(tag); return JSON.parse(Buffer.concat([c.update(body),c.final()]).toString()); }
  };
}
export const randomToken=()=>randomBytes(32).toString('base64url');
export const digest=value=>createHash('sha256').update(value).digest('hex');
export function assertOwnedKey(user,key) {
  if (typeof key!=='string'||!key.startsWith(`${user}/`)||key.includes('..')||!/^[-a-zA-Z0-9_/\.]+$/.test(key)) throw Object.assign(new Error('Invalid storage object path'),{status:400});
  return key;
}
export function assertBaseUrl(value, local=false) {
  const url=new URL(value);
  if (url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||(local && url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname)))) throw new Error('Use an HTTPS origin (localhost HTTP is development only)');
  return url.origin;
}
