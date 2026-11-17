import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes,createDecipheriv} from 'node:crypto';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {providers,validateTargets} from '../src/catalog.mjs';
import {encryption,assertOwnedKey,assertBaseUrl} from '../src/security.mjs';
import {validateRecording,finalizeMedia,runTool} from '../src/media.mjs';
import {SocialService} from '../src/service.mjs';
import {OAuth} from '../src/oauth.mjs';
import {Publishers} from '../src/publishers.mjs';
import {createApp} from '../src/server.mjs';
import {parseConfig,PROVIDERS} from '../../Plugins/SnapCloudSocialMedia/SocialConfig.js';
import {loadProxyConfig} from '../src/config.mjs';
const video={id:'m1',user_id:'u1',kind:'video',width:720,height:1280,duration:8,object_key:'u1/rendered/video.mp4'};
const target={provider:'youtube',format:'short',caption:'A caption',title:'A video',privacy:'private'};
const uuid='4fbc9104-8474-4994-a932-8112ab9511e2';
const response=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json',...headers}});

test('public JSON and provider catalog agree on every format',async()=>{
 const config=parseConfig(await readFile(new URL('../../social.config.example.json',import.meta.url),'utf8'));
 assert.equal(config.demoMode,true);
 assert.deepEqual(PROVIDERS.map(p=>[p.id,p.formats]),providers.map(p=>[p.id,p.formats]));
});
test('public JSON rejects embedded provider secrets and invalid capture limits',async()=>{
 const config=JSON.parse(await readFile(new URL('../../social.config.example.json',import.meta.url),'utf8'));
 assert.throws(()=>parseConfig(JSON.stringify({...config,clientSecret:'private'})),/private credentials/);
 assert.throws(()=>parseConfig(JSON.stringify({...config,capture:{...config.capture,includeAudio:'yes'}})),/boolean/);
 config.capture.fps=60;assert.throws(()=>parseConfig(JSON.stringify(config)),/Capture limits/);
});
test('encrypted tokens round-trip and detect tampering',()=>{
 const key=randomBytes(32).toString('base64'),v=encryption(key),token={access_token:'secret-token'},sealed=v.seal(token);
 assert.ok(!sealed.includes('secret-token'));assert.deepEqual(v.open(sealed),token);
 const parts=sealed.split('.');const body=Buffer.from(parts[2],'base64');body[0]^=1;parts[2]=body.toString('base64');assert.throws(()=>v.open(parts.join('.')));
 assert.throws(()=>encryption('invalid'));
});
test('storage input cannot cross account boundaries or traverse paths',()=>{
 assert.equal(assertOwnedKey('u1','u1/a/frame.jpg'),'u1/a/frame.jpg');
 for(const path of ['u2/a.jpg','u1/../u2.jpg','https://evil.example/x','u1/../../etc/passwd'])assert.throws(()=>assertOwnedKey('u1',path));
 assert.throws(()=>assertBaseUrl('http://example.com'));assert.equal(assertBaseUrl('http://localhost:8787',true),'http://localhost:8787');
});
test('target validation rejects unavailable formats and incompatible media',()=>{
 assert.throws(()=>validateTargets([{...target,provider:'linkedin',format:'story'}],video),/Unsupported/);
 assert.throws(()=>validateTargets([{provider:'instagram',format:'photo'}],video),/Media type/);
 assert.throws(()=>validateTargets([target,target],video),/duplicate/);
 assert.throws(()=>validateTargets([{...target,title:''}],video),/title/);
 assert.throws(()=>validateTargets([target],{...video,width:1280,height:720}),/portrait/);
 assert.throws(()=>validateTargets([{provider:'snapchat',format:'spotlight',caption:''}],{...video,duration:4}),/at least/);
});
test('TikTok Direct Post requires explicit privacy selection and consent',()=>{
 const t={provider:'tiktok',format:'video',publishMode:'direct',caption:''};
 assert.throws(()=>validateTargets([t],video),/privacy/);
 assert.throws(()=>validateTargets([{...t,privacyLevel:'SELF_ONLY'}],video),/confirm/);
 assert.equal(validateTargets([{...t,privacyLevel:'SELF_ONLY',consent:true}],video)[0].consent,true);
});
test('recording validation rejects duplicate timestamps and unbounded manifests',()=>{
 const value={kind:'video',aspect:'portrait',frames:[{key:'u1/a.jpg',time:0},{key:'u1/b.jpg',time:1}]};
 assert.equal(validateRecording('u1',value),value);
 assert.throws(()=>validateRecording('u1',{...value,frames:[...value.frames,{key:'u1/c.jpg',time:1}]}),/timestamp/);
 assert.throws(()=>validateRecording('u1',{...value,frames:Array(181).fill(value.frames[0])}),/180/);
 assert.throws(()=>validateRecording('u1',{...value,audioKey:'another-user/audio.wav'}),error=>error.status===400);
});
test('enqueue is idempotent even when Postgres JSONB changes object key order',async()=>{
 const job={id:'j1',payload:{targets:[{privacy:'private',title:'A video',caption:'A caption',format:'short',provider:'youtube'}],mediaId:'m1'}};
 const cloud={get:async()=>video,connection:async()=>({}),rows:async()=>[job]};
 const service=new SocialService(cloud,{},{});
 assert.equal((await service.enqueue('u1',{requestKey:uuid,mediaId:'m1',targets:[target]})).id,'j1');
 await assert.rejects(()=>service.enqueue('u1',{requestKey:uuid,mediaId:'m1',targets:[{...target,caption:'changed'}]}),/different content/);
});
test('a missing connection stops a batch before any publish request',async()=>{
 const service=new SocialService({get:async()=>video,connection:async()=>null},{},{});
 await assert.rejects(()=>service.enqueue('u1',{requestKey:uuid,mediaId:'m1',targets:[target]}),/Connect/);
});
test('worker persists successful destinations and reports a partial failure',async()=>{
 const patches=[],calls=[];
 const job={id:'j1',user_id:'u1',payload:{mediaId:'m1',targets:[target,{provider:'x',format:'video'}]}};
 const cloud={request:async()=>[job],get:async()=>video,signedObject:async()=> 'https://cloud.example/media',readObject:async()=>Buffer.from('mp4'),patch:async(t,q,value)=>patches.push(structuredClone(value))};
 const service=new SocialService(cloud,{credential:async()=>({access_token:'secret'})},{publish:async t=>{calls.push(t.provider);if(t.provider==='x')throw new Error('Quota exhausted');return{state:'processing',id:'post-1'};}});
 await service.work();assert.deepEqual(calls,['youtube','x']);assert.equal(patches.at(-1).status,'partial');assert.equal(patches.at(-1).results[0].id,'post-1');assert.equal(patches.at(-1).results[1].state,'failed');
});
test('uncertain delivery never becomes a retryable successful batch',async()=>{
 const patches=[],job={id:'j1',user_id:'u1',payload:{mediaId:'m1',targets:[target]}};
 const cloud={request:async()=>[job],get:async()=>video,signedObject:async()=> 'https://cloud.example/media',readObject:async()=>Buffer.from('mp4'),patch:async(t,q,v)=>patches.push(v)};
 const service=new SocialService(cloud,{credential:async()=>({})},{publish:async()=>{throw Object.assign(new Error('Network timed out'),{name:'TimeoutError'});}});
 await service.work();assert.equal(patches.at(-1).status,'unknown');
});
test('OAuth stores a hashed state and uses PKCE for X',async()=>{
 let stored;const vault=encryption(randomBytes(32).toString('base64'));
 const oauth=new OAuth({insert:async(t,v)=>{stored=v;}},vault,'https://proxy.example',{X_CLIENT_ID:'client-id'});
 const result=await oauth.begin('owner','x'),url=new URL(result.url);
 assert.notEqual(stored.id,url.searchParams.get('state'));assert.equal(stored.user_id,'owner');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.ok(!stored.verifier.includes('secret'));
});
test('OAuth callback replay is rejected before token exchange',async()=>{
 let fetched=false;const oauth=new OAuth({request:async()=>[]},encryption(randomBytes(32).toString('base64')),'https://proxy.example',{X_CLIENT_ID:'client'},async()=>{fetched=true;});
 await assert.rejects(()=>oauth.complete('x','already-used','code'),/already used/);assert.equal(fetched,false);
});
test('TikTok inbox authorization omits Direct Post scope unless configured',async()=>{
 const cloud={insert:async()=>{}},vault=encryption(randomBytes(32).toString('base64'));
 const env={TIKTOK_CLIENT_ID:'app',TIKTOK_CLIENT_SECRET:'secret'};
 const inbox=new URL((await new OAuth(cloud,vault,'https://proxy.example',env).begin('owner','tiktok')).url);
 assert.equal(inbox.searchParams.get('scope'),'user.info.basic,video.upload');assert.equal(inbox.searchParams.get('client_key'),'app');
 const direct=new URL((await new OAuth(cloud,vault,'https://proxy.example',{...env,TIKTOK_SCOPES:'user.info.basic,video.upload,video.publish'}).begin('owner','tiktok')).url);
 assert.ok(direct.searchParams.get('scope').includes('video.publish'));
});
test('connection token is verified and encrypted under its owner',async()=>{
 const saved=[],vault=encryption(randomBytes(32).toString('base64'));
 const oauth=new OAuth({saveConnection:async(...args)=>saved.push(args)},vault,'https://proxy.example',{},async()=>response({data:{id:'social-user'}}));
 await oauth.connect('owner','x',{access_token:'private',refresh_token:'refresh'});
 assert.deepEqual(saved[0].slice(0,2),['owner','x']);assert.equal(saved[0][3],'social-user');assert.equal(vault.open(saved[0][2]).access_token,'private');
});
test('X photo uses v2 multipart media upload then a string media id',async()=>{
 const calls=[],p=new Publishers(async(url,opts)=>{calls.push({url,opts});return response(calls.length===1?{data:{id:'1234567890123456789'}}:{data:{id:'post-id'}});});
 const result=await p.publish({provider:'x',caption:'hello'},{kind:'photo',bytes:Buffer.from('jpeg')},{access_token:'token'});
 assert.equal(result.state,'published');assert.equal(calls[0].url,'https://api.x.com/2/media/upload');assert.ok(calls[0].opts.body instanceof FormData);
 assert.deepEqual(JSON.parse(calls[1].opts.body).media.media_ids,['1234567890123456789']);
});
test('Snapchat upload encrypts bytes and submits Spotlight without claiming it is live',async()=>{
 const calls=[],p=new Publishers(async(url,opts)=>{
  calls.push({url,opts});
  if(calls.length===1)return response({request_status:'SUCCESS',media_id:'m1',add_path:'/v1/media/add',finalize_path:'/v1/media/finalize'});
  return response({request_status:'SUCCESS',spotlight_id:'sp1'});
 });
 const bytes=Buffer.from('source-video'),result=await p.publish({provider:'snapchat',format:'spotlight',caption:'Hi'},{kind:'video',bytes},{account:'profile',access_token:'token'});
 const init=JSON.parse(calls[0].opts.body),encrypted=Buffer.from(await calls[1].opts.body.get('file').arrayBuffer()),decipher=createDecipheriv('aes-256-cbc',Buffer.from(init.key,'base64'),Buffer.from(init.iv,'base64'));
 assert.deepEqual(Buffer.concat([decipher.update(encrypted),decipher.final()]),bytes);assert.equal(result.state,'processing');assert.equal(result.id,'sp1');
});
test('Instagram waits for media processing before publish and sends form fields',async()=>{
 const calls=[],p=new Publishers(async(url,opts)=>{calls.push({url,opts});return response(calls.length===1?{id:'container'}:calls.length===2?{status_code:'FINISHED'}:{id:'published'});});
 const result=await p.publish({provider:'instagram',format:'reel',caption:'Hello'},{kind:'video',url:'https://cloud.example/video'},{account:'ig',access_token:'token'});
 assert.equal(result.state,'published');assert.equal(calls[0].opts.body.get('media_type'),'REELS');assert.match(calls[1].url,/status_code/);assert.equal(calls[2].opts.body.get('creation_id'),'container');
});
test('YouTube refuses a forged upload endpoint instead of sending a token',async()=>{
 const p=new Publishers(async()=>response({},200,{location:'https://evil.example/upload'}));
 await assert.rejects(()=>p.publish({...target,provider:'youtube'},{bytes:Buffer.from('mp4')},{access_token:'private'}),/invalid upload/);
});
test('TikTok direct privacy mismatch is rejected without changing privacy',async()=>{
 let calls=0;const p=new Publishers(async()=>{calls++;return response({error:{code:'ok'},data:{privacy_level_options:['SELF_ONLY'],max_video_post_duration_sec:60}});});
 await assert.rejects(()=>p.publish({provider:'tiktok',publishMode:'direct',privacyLevel:'PUBLIC_TO_EVERYONE',consent:true},{bytes:Buffer.from('mp4'),duration:8},{access_token:'token'}),/not allowed/);assert.equal(calls,1);
});
test('proxy rejects unauthorized requests and scopes job reads to the authenticated user',async()=>{
 let readUser;const cloud={user:async token=>{if(token!=='valid')throw Object.assign(new Error('Unauthorized'),{status:401});return 'owner';},get:async(t,user)=>{readUser=user;return undefined;}};
 const app=createApp(cloud,{},{});await new Promise(r=>app.listen(0,'127.0.0.1',r));
 try {
  const origin='http://127.0.0.1:'+app.address().port;
  const unauth=await fetch(origin+'/v1/connections');assert.equal(unauth.status,401);
  const missing=await fetch(origin+'/v1/jobs/'+uuid,{headers:{Authorization:'Bearer valid'}});assert.equal(missing.status,404);assert.equal(readUser,'owner');
  const catalog=await fetch(origin+'/v1/providers');assert.equal((await catalog.json()).length,7);
 }finally{await new Promise(r=>app.close(r));}
});
test('private proxy JSON resolves environment references without putting secrets in public assets',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'social-config-test-'));
 try{const file=join(directory,'config.json');await writeFile(file,JSON.stringify({schemaVersion:1,serviceRoleKey:'$SERVICE',apps:{x:{clientId:'client',clientSecret:'$SECRET'}}}));const env=await loadProxyConfig({SOCIAL_PROXY_CONFIG:file,SERVICE:'service-secret',SECRET:'app-secret'});assert.equal(env.SNAP_CLOUD_SERVICE_ROLE_KEY,'service-secret');assert.equal(env.X_CLIENT_SECRET,'app-secret');}finally{await rm(directory,{recursive:true,force:true});}
});
test('real FFmpeg creates a playable portrait H.264 MP4 with AAC microphone audio',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'social-render-test-'));let stored;
 try {
  const image=join(directory,'frame.jpg');await runTool('ffmpeg',['-y','-f','lavfi','-i','color=c=blue:s=320x240','-frames:v','1',image]);const jpeg=await readFile(image);
  const wav=join(directory,'audio.wav');await runTool('ffmpeg',['-y','-f','lavfi','-i','sine=frequency=440:sample_rate=16000','-t','1.1','-ac','1','-c:a','pcm_s16le',wav]);const audio=await readFile(wav);
  const cloud={readObject:async(user,key)=>key.endsWith('.wav')?audio:jpeg,writeObject:async(user,key,bytes,type)=>{stored={user,key,bytes,type};},insert:async(t,row)=>({id:'encoded',...row})};
  const result=await finalizeMedia(cloud,'u1',{kind:'video',aspect:'portrait',audioKey:'u1/audio.wav',frames:[{key:'u1/a.jpg',time:0},{key:'u1/b.jpg',time:0.5},{key:'u1/c.jpg',time:1}]});
  assert.equal(result.width,720);assert.equal(result.height,1280);assert.ok(result.duration>=1);assert.equal(stored.type,'video/mp4');assert.ok(stored.bytes.includes(Buffer.from('ftyp')));
  const file=join(directory,'clip.mp4');await writeFile(file,stored.bytes);const probe=JSON.parse(await runTool('ffprobe',['-v','error','-show_entries','stream=codec_name,pix_fmt,codec_type','-of','json',file]));const video=probe.streams.find(s=>s.codec_type==='video'),sound=probe.streams.find(s=>s.codec_type==='audio');assert.equal(video.codec_name,'h264');assert.equal(video.pix_fmt,'yuv420p');assert.equal(sound.codec_name,'aac');
 }finally{await rm(directory,{recursive:true,force:true});}
});
