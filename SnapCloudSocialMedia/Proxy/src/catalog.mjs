// Public capability contract shared with the editor and Lens. Never infer support
// from a provider name; validate the exact format before creating a publish job.
export const providers = [
  {id:'snapchat', name:'Snapchat', color:'#FFFC00', formats:['story','spotlight'], mode:'publish', note:'Public Profile API: Business Manager OAuth app and Snap allowlisting required. Stories: 5–60 seconds. Spotlight: 6–60 seconds, caption max 160.'},
  {id:'x', name:'X', color:'#FFFFFF', formats:['video','photo'], mode:'publish', note:'User access token with tweet.write and media.write; paid API access may be required.'},
  {id:'youtube', name:'YouTube', color:'#FF3636', formats:['video','short'], mode:'publish', note:'youtube.upload authorization. Shorts classification is decided by YouTube. Uploads default to private.'},
  {id:'linkedin', name:'LinkedIn', color:'#38A7FF', formats:['video','photo'], mode:'publish', note:'Member URN and w_member_social permission required.'},
  {id:'instagram', name:'Instagram', color:'#F66CAE', formats:['reel','story','photo'], mode:'publish', note:'Professional account, Instagram Login publishing permissions and app review required. Account eligibility varies.'},
  {id:'threads', name:'Threads', color:'#DED8FF', formats:['video','photo'], mode:'publish', note:'threads_basic and threads_content_publish authorization required.'},
  {id:'tiktok', name:'TikTok', color:'#55F0E8', formats:['video'], mode:'draft', note:'Inbox upload by default. Direct Post needs video.publish authorization, creator privacy selection and explicit consent.'}
];
export function provider(id) {
  const p = providers.find(p=>p.id===id);
  if (!p) throw Object.assign(new Error('Unknown provider'), {status:400});
  return p;
}
export function validateTargets(targets, media) {
  if (!Array.isArray(targets) || !targets.length || targets.length>7) throw Object.assign(new Error('Select 1–7 destinations'), {status:400});
  const seen=new Set();
  return targets.map(t=>{
    const p=provider(t.provider);
    if (seen.has(p.id) || !p.formats.includes(t.format)) throw Object.assign(new Error(`Unsupported or duplicate destination: ${p.name}/${t.format}`), {status:400});
    seen.add(p.id);
    if ((t.format==='photo') !== (media.kind==='photo')) throw Object.assign(new Error('Media type does not match destination format'), {status:400});
    const caption=String(t.caption??'');
    const limit=({x:280,youtube:5000,linkedin:3000,instagram:2200,threads:500,tiktok:2200,snapchat:160})[p.id];
    if ([...caption].length>limit) throw Object.assign(new Error(`${p.name} caption exceeds ${limit} characters`), {status:400});
    if (p.id==='youtube' && !String(t.title??'').trim()) throw Object.assign(new Error('YouTube needs a title'), {status:400});
    if (p.id==='youtube' && [...String(t.title)].length>100) throw Object.assign(new Error('YouTube title exceeds 100 characters'), {status:400});
    if ((t.format==='reel'||t.format==='story'||t.format==='short'||t.format==='spotlight') && media.width>=media.height) throw Object.assign(new Error('Choose portrait recording for this destination'), {status:400});
    if(p.id==='snapchat' && media.duration<(t.format==='spotlight'?6:5))throw Object.assign(new Error('Record at least 6 seconds for Spotlight or 5 for Story'),{status:400});
    if(p.id==='tiktok' && t.publishMode==='direct' && (!t.privacyLevel || t.consent!==true))throw Object.assign(new Error('Choose TikTok privacy and confirm the upload before Direct Post'),{status:400});
    return {provider:p.id,format:t.format,caption,title:String(t.title??''),privacy:['public','unlisted','private'].includes(t.privacy)?t.privacy:'private',...(p.id==='tiktok'?{publishMode:t.publishMode==='direct'?'direct':'inbox',privacyLevel:String(t.privacyLevel||''),consent:t.consent===true,disableComment:t.disableComment===true,disableDuet:t.disableDuet===true,disableStitch:t.disableStitch===true}:{})};
  });
}
