import {providers,validateTargets} from './catalog.mjs';
import {finalizeMedia} from './media.mjs';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
export class SocialService {
 constructor(cloud,oauth,publishers) {Object.assign(this,{cloud,oauth,publishers});this.rendering=new Set();this.busy=false;}
 async connections(user) {
  const rows=await this.cloud.rows('social_connections',`user_id=eq.${encodeURIComponent(user)}&select=provider,account_id,updated_at`);
  return providers.map(p=>({...p,connected:rows.some(r=>r.provider===p.id),account_id:rows.find(r=>r.provider===p.id)?.account_id??null}));
 }
 async finalize(user,input) {
  if(this.rendering.has(user))throw fail('A recording is already rendering',409);
  this.rendering.add(user);try{return await finalizeMedia(this.cloud,user,input);}finally{this.rendering.delete(user);}
 }
 async enqueue(user,input) {
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.requestKey||''))throw fail('Use a UUID request key');
  const media=await this.cloud.get('social_media',user,input.mediaId);if(!media)throw fail('Recording not found',404);
  const targets=validateTargets(input.targets,media);
  for(const t of targets)if(!await this.cloud.connection(user,t.provider))throw fail(`Connect ${t.provider} before sharing`,409);
  const payload={mediaId:media.id,targets};
  const query=`user_id=eq.${encodeURIComponent(user)}&request_key=eq.${input.requestKey}`;
  const existing=(await this.cloud.rows('social_jobs',query))[0];
  const reuse=job=>{if(canonical(job.payload)!==canonical(payload))throw fail('Request key already used for different content',409);return job;};
  if(existing)return reuse(existing);
  try{return await this.cloud.insert('social_jobs',{user_id:user,request_key:input.requestKey,payload});}
  catch(e){const race=(await this.cloud.rows('social_jobs',query))[0];if(race)return reuse(race);throw e;}
 }
 async work() {
  if(this.busy)return;this.busy=true;
  try {
   const jobs=await this.cloud.request('/rest/v1/rpc/claim_social_job',{method:'POST',body:'{}'});
   if(!jobs.length)return;
   const job=jobs[0],results=[];
   try {
    const media=await this.cloud.get('social_media',job.user_id,job.payload.mediaId);if(!media)throw new Error('Recording no longer exists');
    const source={...media,url:await this.cloud.signedObject(job.user_id,media.object_key),bytes:await this.cloud.readObject(job.user_id,media.object_key)};
    for(const target of job.payload.targets) {
     let result;
     try {const credential=await this.oauth.credential(job.user_id,target.provider);result={provider:target.provider,...await this.publishers.publish(target,source,credential)};}
     catch(e){result={provider:target.provider,state:e.uncertain||e.name==='TimeoutError'||e.name==='TypeError'?'unknown':'failed',message:e.message};}
     results.push(result);
     // Persist each receipt immediately. Do not resend an entire batch on retry.
     await this.cloud.patch('social_jobs',`id=eq.${job.id}`,{results,updated_at:new Date().toISOString()});
    }
    const failed=results.filter(r=>['failed','unknown'].includes(r.state)).length;
    const status=results.some(r=>r.state==='unknown')?'unknown':failed===0?'complete':failed===results.length?'failed':'partial';
    await this.cloud.patch('social_jobs',`id=eq.${job.id}`,{status,results,updated_at:new Date().toISOString()});
   } catch(e) {
    // If a receipt could not be saved, any already-attempted publish is uncertain.
    await this.cloud.patch('social_jobs',`id=eq.${job.id}`,{status:results.length?'unknown':'failed',results:results.length?results:[{state:'failed',message:e.message}],updated_at:new Date().toISOString()});
   }
  } finally {this.busy=false;}
 }
}
function canonical(value) {
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
