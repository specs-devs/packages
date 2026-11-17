import {createServer} from 'node:http';
import {pathToFileURL} from 'node:url';
import {Cloud} from './cloud.mjs';
import {encryption,assertBaseUrl} from './security.mjs';
import {providers,provider} from './catalog.mjs';
import {OAuth} from './oauth.mjs';
import {Publishers} from './publishers.mjs';
import {SocialService} from './service.mjs';
import {loadProxyConfig} from './config.mjs';
export function createApp(cloud,oauth,service) {
 const limits=new Map();
 const server=createServer(async(req,res)=>{
  const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
  try {
   const url=new URL(req.url,'http://localhost'),path=url.pathname;
   if(path==='/health')return send(200,{ok:true,version:'0.1.0'});
   if(path==='/v1/providers'&&req.method==='GET')return send(200,providers);
   const callback=path.match(/^\/oauth\/([a-z]+)\/callback$/);
   if(callback && req.method==='GET') {await oauth.complete(callback[1],url.searchParams.get('state'),url.searchParams.get('code'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'"});return res.end('<!doctype html><title>Account connected</title><style>body{font:20px system-ui;background:#131722;color:white;padding:64px}</style><h1>Account connected</h1><p>Return to Lens Studio and refresh connections.</p>');}
   const token=(req.headers.authorization||'').replace(/^Bearer /,'');const user=await cloud.user(token);
   const now=Date.now(),limit=limits.get(user);if(!limit||now-limit.time>60000)limits.set(user,{time:now,count:1});else if(++limit.count>120)return send(429,{error:'Please wait before retrying'});
   if(limits.size>10000)for(const [key,value]of limits)if(now-value.time>60000)limits.delete(key);
   let input={};
   if(req.method==='POST') {let text='',size=0;for await(const chunk of req){size+=chunk.length;if(size>150000)throw Object.assign(new Error('Request too large'),{status:413});text+=chunk;}try{input=JSON.parse(text||'{}');}catch{throw Object.assign(new Error('Invalid JSON'),{status:400});}}
   if(path==='/v1/connections'&&req.method==='GET')return send(200,await service.connections(user));
   if(path==='/v1/connections/tiktok/creator'&&req.method==='GET')return send(200,await service.publishers.creator(await oauth.credential(user,'tiktok')));
   const connection=path.match(/^\/v1\/connections\/([a-z]+)(?:\/(oauth|token))?$/);
   if(connection) {
    const id=connection[1];provider(id);
    if(req.method==='POST'&&connection[2]==='oauth')return send(200,await oauth.begin(user,id));
    if(req.method==='POST'&&connection[2]==='token')return send(200,await oauth.connect(user,id,input));
    if(req.method==='DELETE'&&!connection[2]){await cloud.remove('social_connections',`user_id=eq.${encodeURIComponent(user)}&provider=eq.${id}`);return send(200,{disconnected:true});}
   }
   if(path==='/v1/media/finalize'&&req.method==='POST')return send(201,await service.finalize(user,input));
   if(path==='/v1/jobs'&&req.method==='POST')return send(202,await service.enqueue(user,input));
   const job=path.match(/^\/v1\/jobs\/([a-f0-9-]{36})$/);
   if(job&&req.method==='GET') {const result=await cloud.get('social_jobs',user,job[1]);return result?send(200,result):send(404,{error:'Job not found'});}
   return send(404,{error:'Route not found'});
  }catch(e){send(e.status&&e.status<500?e.status:500,{error:e.status&&e.status<500?e.message:'Operation failed; check proxy configuration and provider permissions'});}
 });
 server.requestTimeout=180000;return server;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
 const env=await loadProxyConfig();
 const url=assertBaseUrl(env.SNAP_CLOUD_URL),origin=assertBaseUrl(env.PUBLIC_ORIGIN,true);
 if(!env.SNAP_CLOUD_SERVICE_ROLE_KEY)throw new Error('SNAP_CLOUD_SERVICE_ROLE_KEY is required');
 const cloud=new Cloud(url,env.SNAP_CLOUD_SERVICE_ROLE_KEY),vault=encryption(env.TOKEN_ENCRYPTION_KEY),oauth=new OAuth(cloud,vault,origin,env),service=new SocialService(cloud,oauth,new Publishers(fetch,undefined,env));
 const server=createApp(cloud,oauth,service);server.listen(Number(env.PORT||8787),'0.0.0.0',()=>console.log('Snap Cloud Social Media proxy listening'));
 const timer=setInterval(()=>service.work().catch(()=>console.error('Publish worker failed; inspect Snap Cloud job state')),2000);
 timer.unref();
 // A crash must never cause automatic duplicate posts. Expose abandoned jobs as
 // unknown after ten minutes, preserving successful receipts for manual review.
 const stale=setInterval(()=>cloud.patch('social_jobs',`status=eq.processing&updated_at=lt.${encodeURIComponent(new Date(Date.now()-600000).toISOString())}`,{status:'unknown'}).catch(()=>console.error('Could not reconcile abandoned jobs')),60000);stale.unref();
 process.on('SIGTERM',()=>{clearInterval(timer);clearInterval(stale);server.close();});
}
