import {randomBytes,createCipheriv} from 'node:crypto';
// Actual provider calls are isolated here so contract tests can substitute HTTP.
// A receipt means published, processing, draft, or handoff; those are distinct.
export class Publishers {
 constructor(fetcher=fetch,wait=ms=>new Promise(r=>setTimeout(r,ms)),env=process.env) {this.fetch=fetcher;this.wait=wait;this.env=env;}
 async call(url,token,options={}) {
  const r=await this.fetch(url,{...options,headers:{Authorization:`Bearer ${token}`, ...options.headers},signal:AbortSignal.timeout(90000)});
  if(!r.ok) {const e=new Error(`Provider request failed (${r.status}); check authorization, quota and format`);e.uncertain=r.status>=500;e.status=r.status;throw e;}
  if(r.status===204)return{};
  const text=await r.text();return text?JSON.parse(text):{};
 }
 json(url,token,value,headers={}) {return this.call(url,token,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(value)});}
 form(url,token,value) {return this.call(url,token,{method:'POST',body:new URLSearchParams(value)});}
 async publish(target,media,credential) {
  const fn=this[target.provider];if(!fn)throw new Error('Unsupported destination');
  return fn.call(this,target,media,credential);
 }
 async snapchat(t,m,c) {
  const base='https://businessapi.snapchat.com',profile=encodeURIComponent(c.account),key=randomBytes(32),iv=randomBytes(16),cipher=createCipheriv('aes-256-cbc',key,iv);
  const bytes=Buffer.concat([cipher.update(m.bytes),cipher.final()]);
  const check=value=>{if(value.request_status!=='SUCCESS')throw new Error('Snapchat rejected the request; check Public Profile allowlisting');return value;};
  const created=check(await this.json(`${base}/v1/public_profiles/${profile}/media`,c.access_token,{type:m.kind==='photo'?'IMAGE':'VIDEO',name:'specs-clip.mp4',key:key.toString('base64'),iv:iv.toString('base64')}));
  if(!created.media_id||!created.add_path||!created.finalize_path)throw new Error('Snapchat returned no upload instructions');
  const endpoint=path=>{if(typeof path!=='string'||!path.startsWith('/v1/'))throw new Error('Snapchat returned an invalid upload path');return base+path;};
  for(let offset=0,part=1;offset<bytes.length;offset+=32*1024*1024,part++) {
   const body=new FormData();body.append('action','ADD');body.append('part_number',String(part));body.append('file',new Blob([bytes.subarray(offset,offset+32*1024*1024)]),'clip.mp4');
   check(await this.call(endpoint(created.add_path),c.access_token,{method:'POST',body}));
  }
  const body=new FormData();body.append('action','FINALIZE');check(await this.call(endpoint(created.finalize_path),c.access_token,{method:'POST',body}));
  const spotlight=t.format==='spotlight';
  const receipt=check(await this.json(`${base}/v1/public_profiles/${profile}/${spotlight?'spotlights':'stories'}`,c.access_token,{media_id:created.media_id,...(spotlight?{description:t.caption,locale:'en_US',skip_save_to_profile:false}:{})}));
  return spotlight?{state:'processing',id:receipt.spotlight_id||created.media_id,message:'Spotlight submitted for processing and moderation.'}:{state:'published',id:created.media_id,message:'Public Profile Story published. Story captions are not supported by this API.'};
 }
 async x(t,m,c) {
  if(m.kind==='photo') {
   const body=new FormData();body.append('media',new Blob([m.bytes],{type:'image/jpeg'}),'photo.jpg');body.append('media_type','image/jpeg');body.append('media_category','tweet_image');
   const media=await this.call('https://api.x.com/2/media/upload',c.access_token,{method:'POST',body});if(!media.data?.id)throw new Error('X returned no photo receipt');
   const post=await this.json('https://api.x.com/2/tweets',c.access_token,{text:t.caption,media:{media_ids:[String(media.data.id)]}});if(!post.data?.id)throw Object.assign(new Error('X returned no post receipt'),{uncertain:true});return{state:'published',id:post.data.id,url:`https://x.com/i/status/${post.data.id}`};
  }
  const init=await this.json('https://api.x.com/2/media/upload/initialize',c.access_token,{media_type:m.kind==='photo'?'image/jpeg':'video/mp4',total_bytes:m.bytes.length,media_category:m.kind==='photo'?'tweet_image':'tweet_video'});
  const id=init.data?.id;if(!id)throw new Error('X returned no media id');
  for(let offset=0,index=0;offset<m.bytes.length;offset+=4*1024*1024,index++) {
   const body=new FormData();body.append('segment_index',String(index));body.append('media',new Blob([m.bytes.subarray(offset,offset+4*1024*1024)]),'segment');
   await this.call(`https://api.x.com/2/media/upload/${id}/append`,c.access_token,{method:'POST',body});
  }
  let result=await this.json(`https://api.x.com/2/media/upload/${id}/finalize`,c.access_token,{});
  for(let i=0;result.data?.processing_info && result.data.processing_info.state!=='succeeded';i++) {
   if(i>=30||result.data.processing_info.state==='failed')throw new Error('X media processing failed or timed out');
   await this.wait(Math.min(10,Math.max(1,result.data.processing_info.check_after_secs||2))*1000);
   result=await this.call(`https://api.x.com/2/media/upload?command=STATUS&media_id=${encodeURIComponent(id)}`,c.access_token);
  }
  const post=await this.json('https://api.x.com/2/tweets',c.access_token,{text:t.caption,media:{media_ids:[id]}});
  if(!post.data?.id)throw new Error('X returned no post receipt');return{state:'published',id:post.data.id,url:`https://x.com/i/status/${post.data.id}`};
 }
 async youtube(t,m,c) {
  const r=await this.fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',{method:'POST',headers:{Authorization:`Bearer ${c.access_token}`,'Content-Type':'application/json','X-Upload-Content-Type':'video/mp4','X-Upload-Content-Length':String(m.bytes.length)},body:JSON.stringify({snippet:{title:t.title,description:t.caption},status:{privacyStatus:t.privacy,selfDeclaredMadeForKids:false}}),signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw new Error(`YouTube upload initialization failed (${r.status})`);
  const location=r.headers.get('location');if(!location||!/^https:\/\/([a-z0-9-]+\.)*googleapis\.com\//i.test(location))throw new Error('YouTube returned an invalid upload endpoint');
  const post=await this.call(location,c.access_token,{method:'PUT',headers:{'Content-Type':'video/mp4'},body:m.bytes});
  if(!post.id)throw new Error('YouTube returned no video receipt');return{state:'processing',id:post.id,url:`https://youtu.be/${post.id}`,message:`Uploaded (${t.privacy}); YouTube is processing the video.`};
 }
 async linkedin(t,m,c) {
  const headers={'LinkedIn-Version':this.env.LINKEDIN_VERSION||'202609','X-Restli-Protocol-Version':'2.0.0'},owner=`urn:li:person:${c.account}`;
  const photo=m.kind==='photo',resource=photo?'images':'videos';
  const value={owner,...(!photo?{fileSizeBytes:m.bytes.length,uploadCaptions:false,uploadThumbnail:false}:{})};
  const init=await this.json(`https://api.linkedin.com/rest/${resource}?action=initializeUpload`,c.access_token,{initializeUploadRequest:value},headers);
  const data=init.value,asset=photo?data?.image:data?.video;if(!asset)throw new Error('LinkedIn returned no media asset');
  const parts=photo?[{uploadUrl:data.uploadUrl,firstByte:0,lastByte:m.bytes.length-1}]:data.uploadInstructions;
  const ids=[];
  for(const part of parts) {
   if(!/^https:\/\/([a-z0-9-]+\.)*linkedin\.com\//i.test(part.uploadUrl))throw new Error('LinkedIn returned an invalid upload endpoint');
   const r=await this.fetch(part.uploadUrl,{method:'PUT',headers:{Authorization:`Bearer ${c.access_token}`,'Content-Type':photo?'image/jpeg':'application/octet-stream'},body:m.bytes.subarray(part.firstByte,part.lastByte+1),signal:AbortSignal.timeout(90000)});
   if(!r.ok)throw new Error(`LinkedIn media upload failed (${r.status})`);ids.push(r.headers.get('etag'));
  }
  if(!photo)await this.json('https://api.linkedin.com/rest/videos?action=finalizeUpload',c.access_token,{finalizeUploadRequest:{video:asset,uploadToken:data.uploadToken,uploadedPartIds:ids}},headers);
  // A successful upload is not yet publishable; wait for AVAILABLE.
  for(let i=0;i<30;i++) {
   const status=await this.call(`https://api.linkedin.com/rest/${resource}/${encodeURIComponent(asset)}`,c.access_token,{headers});
   if(status.status==='AVAILABLE')break;
   if(i===29||['PROCESSING_FAILED','FAILED'].includes(status.status))throw new Error('LinkedIn media processing failed or timed out');
   await this.wait(2000);
  }
  const r=await this.fetch('https://api.linkedin.com/rest/posts',{method:'POST',headers:{Authorization:`Bearer ${c.access_token}`,'Content-Type':'application/json',...headers},body:JSON.stringify({author:owner,commentary:t.caption,visibility:'PUBLIC',distribution:{feedDistribution:'MAIN_FEED',targetEntities:[],thirdPartyDistributionChannels:[]},content:{media:{id:asset,...(!photo?{title:t.title||'Recorded on Specs'}:{})}},lifecycleState:'PUBLISHED',isReshareDisabledByAuthor:false}),signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw Object.assign(new Error(`LinkedIn publish failed (${r.status})`),{uncertain:r.status>=500});
  const id=r.headers.get('x-restli-id');if(!id)throw Object.assign(new Error('LinkedIn returned no post receipt'),{uncertain:true});return{state:'published',id,url:`https://www.linkedin.com/feed/update/${id}`};
 }
 async instagram(t,m,c) {
  const base=`https://graph.instagram.com/${this.env.INSTAGRAM_VERSION||'v23.0'}`;
  const payload=m.kind==='photo'?{image_url:m.url,caption:t.caption}:{media_type:t.format==='story'?'STORIES':'REELS',video_url:m.url,...(t.format!=='story'?{caption:t.caption}:{})};
  const container=await this.form(`${base}/${c.account}/media`,c.access_token,payload);if(!container.id)throw new Error('Instagram returned no media container');
  await this.metaReady(base,container.id,c.access_token,'status_code');
  const receipt=await this.form(`${base}/${c.account}/media_publish`,c.access_token,{creation_id:container.id});if(!receipt.id)throw Object.assign(new Error('Instagram returned no post receipt'),{uncertain:true});
  return{state:'published',id:receipt.id,message:t.format==='story'?'Story published; API does not apply caption text to video pixels.':'Instagram post published.'};
 }
 async threads(t,m,c) {
  const base='https://graph.threads.net/v1.0',payload={media_type:m.kind==='photo'?'IMAGE':'VIDEO',text:t.caption,[m.kind==='photo'?'image_url':'video_url']:m.url};
  const container=await this.form(`${base}/${c.account}/threads`,c.access_token,payload);if(!container.id)throw new Error('Threads returned no media container');
  await this.metaReady(base,container.id,c.access_token,'status');
  const receipt=await this.form(`${base}/${c.account}/threads_publish`,c.access_token,{creation_id:container.id});if(!receipt.id)throw Object.assign(new Error('Threads returned no post receipt'),{uncertain:true});return{state:'published',id:receipt.id};
 }
 async metaReady(base,id,token,field) {
  for(let i=0;i<30;i++) {
   const r=await this.call(`${base}/${id}?fields=${field}`,token);
   if(r[field]==='FINISHED')return;
   if(['ERROR','EXPIRED'].includes(r[field]))throw new Error('Provider media processing failed');
   await this.wait(2000);
  }
  throw new Error('Provider media processing timed out; no publish request was sent');
 }
 async tiktok(t,m,c) {
  const direct=t.publishMode==='direct',base='https://open.tiktokapis.com/v2/post/publish';
  let info;
  if(direct) {
   if(!t.consent||!t.privacyLevel)throw new Error('TikTok Direct Post needs privacy selection and consent');
   info=await this.creator(c);
   if(!info.privacy_level_options?.includes(t.privacyLevel))throw new Error('TikTok privacy is not allowed for this account; choose again');
   if(m.duration>info.max_video_post_duration_sec)throw new Error('Clip exceeds this creator’s duration limit');
  }
  const result=await this.json(`${base}/${direct?'video':'inbox/video'}/init/`,c.access_token,{...(direct?{post_info:{title:t.caption,privacy_level:t.privacyLevel,disable_comment:!!info.comment_disabled||t.disableComment,disable_duet:!!info.duet_disabled||t.disableDuet,disable_stitch:!!info.stitch_disabled||t.disableStitch}}:{}),source_info:{source:'FILE_UPLOAD',video_size:m.bytes.length,chunk_size:m.bytes.length,total_chunk_count:1}});
  if(result.error?.code && result.error.code!=='ok')throw new Error('TikTok rejected upload; check video.upload/video.publish permissions');
  const {publish_id:id,upload_url:upload}=result.data||{};
  if(!id||!upload||!/^https:\/\/([a-z0-9-]+\.)*(tiktokapis|tiktokcdn)\.com\//i.test(upload))throw new Error('TikTok returned invalid upload instructions');
  const r=await this.fetch(upload,{method:'PUT',headers:{'Content-Type':'video/mp4','Content-Length':String(m.bytes.length),'Content-Range':`bytes 0-${m.bytes.length-1}/${m.bytes.length}`},body:m.bytes,signal:AbortSignal.timeout(90000)});
  if(!r.ok)throw Object.assign(new Error(`TikTok upload failed (${r.status})`),{uncertain:r.status>=500});
  return direct?{state:'processing',id,message:`TikTok upload submitted (${t.privacyLevel}); processing not yet confirmed.`}:{state:'draft',id,message:'Uploaded for TikTok inbox delivery. Open TikTok to finish caption, privacy and posting.',suggestedCaption:t.caption};
 }
 async creator(c) {
  const r=await this.json('https://open.tiktokapis.com/v2/post/publish/creator_info/query/',c.access_token,{});
  if(r.error?.code!=='ok'||!r.data)throw new Error('TikTok creator settings unavailable');return r.data;
 }
}
