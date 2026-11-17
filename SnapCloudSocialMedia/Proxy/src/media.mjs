import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {assertOwnedKey} from './security.mjs';
const bad=message=>Object.assign(new Error(message),{status:400});
export function validateRecording(user,input) {
 if(input.kind==='photo') {assertOwnedKey(user,input.key);return input;}
 if(input.kind!=='video'||!Array.isArray(input.frames)||input.frames.length<2||input.frames.length>180)throw bad('Video needs 2–180 JPEG frames');
 let previous=-1;
 for(const f of input.frames) {
  assertOwnedKey(user,f.key);
  if(!f.key.endsWith('.jpg')||!Number.isFinite(f.time)||f.time<0||f.time<=previous||f.time>15)throw bad('Invalid frame timestamp or path');
  previous=f.time;
 }
 if(!['portrait','landscape','square'].includes(input.aspect))throw bad('Choose portrait, landscape or square');
 if(input.audioKey){assertOwnedKey(user,input.audioKey);if(!input.audioKey.endsWith('.wav'))throw bad('Microphone input must be WAV')}
 return input;
}
export function runTool(binary,args,timeout=120000) {
 return new Promise((resolve,reject)=>{
  const process=spawn(binary,args,{stdio:['ignore','pipe','pipe']});let out='',err='';
  const timer=setTimeout(()=>{process.kill('SIGKILL');reject(new Error('Media encoding timed out'));},timeout);
  process.stdout.on('data',b=>{out=(out+b).slice(-8192);});process.stderr.on('data',b=>{err=(err+b).slice(-8192);});
  process.on('error',()=>{clearTimeout(timer);reject(new Error(`Install ${binary} on the proxy host`));});
  process.on('close',code=>{clearTimeout(timer);code===0?resolve(out):reject(new Error('Media encoding failed; verify camera frames and encoder installation'));});
 });
}
export async function finalizeMedia(cloud,user,input) {
 validateRecording(user,input);
 const directory=await mkdtemp(join(tmpdir(),'snap-social-'));
 try {
  let bytes,kind=input.kind,width,height,duration=0;
  const output=join(directory,kind==='photo'?'photo.jpg':'video.mp4');
  if(kind==='photo') {
   const source=join(directory,'source.jpg');await writeFile(source,await cloud.readObject(user,input.key));
   // Decode/re-encode the image rather than trusting its extension or metadata.
   await runTool('ffmpeg',['-y','-i',source,'-frames:v','1','-q:v','3',output]);
  } else {
   const [w,h]=({portrait:[720,1280],landscape:[1280,720],square:[960,960]})[input.aspect];
   const lines=[];let total=0;
   for(let i=0;i<input.frames.length;i++) {
    const f=input.frames[i],name=`frame-${String(i).padStart(4,'0')}.jpg`;
    const bytes=await cloud.readObject(user,f.key);total+=bytes.length;if(total>40*1024*1024)throw bad('Recording exceeds 40 MB; shorten the clip');
    if(bytes[0]!==0xff||bytes[1]!==0xd8)throw bad('Recording contains an invalid JPEG frame');
    await writeFile(join(directory,name),bytes);
    const delta=i+1<input.frames.length?input.frames[i+1].time-f.time:1/12;
    lines.push(`file '${name}'`,`duration ${delta.toFixed(6)}`);
   }
   lines.push(`file 'frame-${String(input.frames.length-1).padStart(4,'0')}.jpg'`);
   const manifest=join(directory,'frames.txt');await writeFile(manifest,lines.join('\n'));
   // Safe fixed filter: retain full field of view and pad to the selected aspect.
   const audioArgs=[];
   if(input.audioKey){const audio=await cloud.readObject(user,input.audioKey);if(audio.length>4*1024*1024||audio.toString('ascii',0,4)!=='RIFF'||audio.toString('ascii',8,12)!=='WAVE')throw bad('Invalid microphone WAV');const file=join(directory,'audio.wav');await writeFile(file,audio);audioArgs.push('-i',file,'-map','0:v:0','-map','1:a:0','-af','apad','-c:a','aac','-b:a','96k','-shortest');}
   await runTool('ffmpeg',['-y','-f','concat','-safe','1','-i',manifest,...audioArgs,'-vf',`scale=${w}:${h}:force_original_aspect_ratio=decrease:in_range=pc:out_range=tv,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p`,'-r','24','-c:v','libx264','-preset','veryfast','-crf','23','-pix_fmt','yuv420p','-color_range','tv','-movflags','+faststart',output]);
  }
  const probe=JSON.parse(await runTool('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height:format=duration','-of','json',output]));
  width=probe.streams?.[0]?.width;height=probe.streams?.[0]?.height;duration=Number(probe.format?.duration||0);
  if(!width||!height||duration>16)throw bad('Invalid encoded media');
  bytes=await readFile(output);if(bytes.length>50*1024*1024)throw bad('Encoded media exceeds 50 MB');
  const key=`${user}/rendered/${randomUUID()}.${kind==='photo'?'jpg':'mp4'}`;
  await cloud.writeObject(user,key,bytes,kind==='photo'?'image/jpeg':'video/mp4');
  return cloud.insert('social_media',{user_id:user,object_key:key,kind,width,height,duration});
 } finally {await rm(directory,{recursive:true,force:true});}
}
