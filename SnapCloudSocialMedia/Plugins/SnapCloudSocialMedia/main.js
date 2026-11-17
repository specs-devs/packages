import {PanelPlugin} from 'LensStudio:PanelPlugin';
import * as Ui from 'LensStudio:Ui';
import * as Network from 'LensStudio:Network';
import * as FileSystem from 'LensStudio:FileSystem';
import * as Shell from 'LensStudio:Shell';
import {PROVIDERS, parseConfig} from './SocialConfig.js';

const CONFIG='SnapCloudSocialMedia.lspkg/social.config.json';
export class SnapCloudSocialMediaPanel extends PanelPlugin {
 static descriptor() {
  return {id:'Com.Specs.SnapCloudSocialMedia',name:'Snap Cloud Social Media',description:'Connect social accounts and configure the recording prefab',dependencies:[Ui.IGui,Editor.Model.IModel]};
 }
 constructor(pluginSystem,descriptor) {
  super(pluginSystem,descriptor);
  this.model=pluginSystem.findInterface(Editor.Model.IModel);
  this.authorization=pluginSystem.findInterface(Editor.IAuthorization);
  this.signals=[];this.session=null;this.sessionContext='';this.sessionExpiration=0;this.rows={};this.alive=true;
 }
 createWidget(parent) {
  this.widget=new Ui.Widget(parent);const layout=this.column(this.widget);
  const title=this.label(this.widget,layout,'Snap Cloud Social Media');title.fontRole=Ui.FontRole.Title;
  this.label(this.widget,layout,'Configure once. Record and share from your Lens.');
  this.status=this.label(this.widget,layout,'Load the public JSON configuration to begin.');
  const tabs=new Ui.TabBar(this.widget),stack=new Ui.StackedWidget(this.widget);layout.addWidget(tabs);layout.addWidget(stack);
  this.connect(tabs.onCurrentChange,i=>{stack.currentIndex=i;});
  const setup=this.page(stack,'Connections',tabs),compose=this.page(stack,'Capture & captions',tabs),json=this.page(stack,'Config JSON',tabs);
  this.connectionPage(setup.widget,setup.layout);
  this.composerPage(compose.widget,compose.layout);
  this.jsonPage(json.widget,json.layout);
  this.button(this.widget,layout,'Save public config to Lens',()=>this.save(),true);
  this.button(this.widget,layout,'Add prefab to scene',()=>this.addPrefab());
  this.connect(this.model.onProjectChanged,()=>{this.session=null;this.sessionContext='';this.run(()=>this.load());});
  this.connect(this.authorization.onAuthorizationChange,()=>{this.session=null;this.sessionContext='';});
  this.run(()=>this.load());return this.widget;
 }
 page(stack,name,tabs) {
  tabs.addTab(name);const outer=new Ui.Widget(stack),layout=this.column(outer),scroll=new Ui.VerticalScrollArea(outer),body=new Ui.Widget(outer);
  const column=this.column(body);scroll.setWidget(body);layout.addWidget(scroll);stack.addWidget(outer);return {widget:body,layout:column};
 }
 column(widget) {const layout=new Ui.BoxLayout();layout.setDirection(Ui.Direction.TopToBottom);layout.spacing=8;layout.setContentsMargins(12,12,12,12);widget.layout=layout;return layout;}
 label(parent,layout,text) {const label=new Ui.Label(parent);label.text=text;label.wordWrap=true;layout.addWidget(label);return label;}
 line(parent,layout,title,placeholder='') {this.label(parent,layout,title);const input=new Ui.LineEdit(parent);input.placeholderText=placeholder;layout.addWidget(input);return input;}
 check(parent,layout,title) {const input=new Ui.CheckBox(parent);input.text=title;layout.addWidget(input);return input;}
 combo(parent,layout,title,items) {this.label(parent,layout,title);const input=new Ui.ComboBox(parent);for(const item of items)input.addItem(item);layout.addWidget(input);return input;}
 connect(signal,fn) {if(signal)this.signals.push(signal.connect(fn));}
 button(parent,layout,title,fn,primary=false) {const b=new Ui.PushButton(parent);b.text=title;b.primary=primary;this.connect(b.onClick,()=>this.run(fn));layout.addWidget(b);return b;}
 async run(fn) {try{await fn();}catch(error){if(this.alive)this.status.text=String(error.message||error);}}
 connectionPage(parent,layout) {
  this.proxy=this.line(parent,layout,'Publishing proxy URL','https://your-social-proxy.example.com');
  this.cloudUrl=this.line(parent,layout,'Snap Cloud project URL','https://YOUR_PROJECT.snapcloud.dev');
  this.cloudKey=this.line(parent,layout,'Snap Cloud publishable key','Public key only');
  this.button(parent,layout,'Sign in with Lens Studio account',()=>this.login(),true);
  this.button(parent,layout,'Refresh account connections',()=>this.refresh());
  this.label(parent,layout,'Provider app credentials are configured on your proxy using proxy.config.json. OAuth uses your own apps and official APIs.');
  for(const p of PROVIDERS) {
   const card=new Ui.Widget(parent),column=this.column(card);layout.addWidget(card);
   const image=new Ui.ImageView(card);image.pixmap=new Ui.Pixmap(new Editor.Path(import.meta.resolve('./resources/'+p.id+'.svg')));image.setFixedWidth(52);image.setFixedHeight(52);column.addWidget(image);
   const label=this.label(card,column,p.name+' · Not connected');label.fontRole=Ui.FontRole.DefaultBold;
   this.button(card,column,'Connect '+p.name+' · Sign in',()=>this.oauth(p.id));
   this.button(card,column,'Disconnect '+p.name,()=>this.disconnect(p.id));
   const token=this.line(card,column,'Existing user access token (optional)','Paste once; cleared immediately after submission');
   this.button(card,column,'Connect with token',async()=>{const value=token.text;token.text='';if(!value)throw new Error('Enter a user-authorized access token');await this.api('/v1/connections/'+p.id+'/token','POST',{access_token:value});await this.refresh();});
   this.rows[p.id]={label,token};
  }
 }
 composerPage(parent,layout) {
  this.demo=this.check(parent,layout,'Demo mode · simulate sharing without publishing');
  this.aspect=this.combo(parent,layout,'Recording aspect',['portrait','landscape','square']);
  this.audio=this.check(parent,layout,'Include microphone audio');
  this.fps=this.line(parent,layout,'Capture FPS (1–12)');this.seconds=this.line(parent,layout,'Maximum clip length (1–15 seconds)');
  this.caption=this.line(parent,layout,'Default caption');this.videoTitle=this.line(parent,layout,'Video title');
  this.label(parent,layout,'Assign Composite Texture on the prefab to include rendered AR content. Enable microphone to record sound.');
  for(const p of PROVIDERS) {
   const row=this.rows[p.id];row.enabled=this.check(parent,layout,'Enable '+p.name+' as a share destination');
   row.format=this.combo(parent,layout,p.name+' format',p.formats);
   row.caption=this.line(parent,layout,p.name+' caption override (blank uses default)');
   if(p.id==='youtube')row.privacy=this.combo(parent,layout,'YouTube upload privacy',['private','unlisted','public']);
   if(p.id==='tiktok') {
    row.mode=this.combo(parent,layout,'TikTok delivery',['inbox','direct']);
    this.label(parent,layout,'Direct Post requires video.publish access. In the Lens select TikTok, choose a creator-supported privacy level, then press Share to consent. Inbox uploads are finished in TikTok.');
   }
   if(p.id==='snapchat')this.label(parent,layout,'Public Profile API requires a Business Manager app allowlisted by Snap. Story ≥5s; Spotlight ≥6s. Story captions are omitted.');
   if(p.id==='instagram')this.label(parent,layout,'Professional account and publishing permissions required. Story captions are not burned into the recording.');
  }
 }
 jsonPage(parent,layout) {
  this.label(parent,layout,'Paste a complete public config JSON, then Apply. This is the same file that the prefab reads. Private tokens and client secrets are rejected.');
  this.json=new Ui.TextEdit(parent);this.json.acceptRichText=false;this.json.setMinimumHeight(360);layout.addWidget(this.json);
  this.button(parent,layout,'Apply pasted JSON to controls',()=>this.apply(parseConfig(this.json.plainText)));
  this.button(parent,layout,'Show controls as JSON',()=>{this.json.plainText=JSON.stringify(this.collect(),null,2);});
  this.button(parent,layout,'Reload saved config',()=>this.load());
 }
 path() {
  const project=this.model.project;if(!project||Editor.isNull(project))throw new Error('Open the SnapCloudSocialMedia example project first');
  return project.projectDirectory.appended(new Editor.Path('Assets/'+CONFIG));
 }
 async ensureEditable() {
  if(FileSystem.exists(this.path()))return;
  const am=this.model.project.assetManager,meta=am.getFileMeta(new Editor.Model.SourcePath(new Editor.Path('SnapCloudSocialMedia.lspkg'),Editor.Model.SourceRootDirectory.Packages));
  if(!meta||Editor.isNull(meta))throw new Error('Import SnapCloudSocialMedia.lspkg first');
  await am.unpack(meta);
  if(!FileSystem.exists(this.path()))throw new Error('Unpack the package into Assets to edit its JSON config');
 }
 async load() {
  try{await this.ensureEditable();this.apply(parseConfig(FileSystem.readFile(this.path())));this.status.text='Configuration loaded · demo is safe to preview';}
  catch(error){if(this.status)this.status.text=String(error.message||error);}
 }
 apply(config) {
  this.config=config;this.proxy.text=config.proxyUrl;this.cloudUrl.text=config.cloud.url;this.cloudKey.text=config.cloud.publishableKey;
  this.demo.checkState=config.demoMode?Ui.CheckState.Checked:Ui.CheckState.Unchecked;
  this.audio.checkState=config.capture.includeAudio?Ui.CheckState.Checked:Ui.CheckState.Unchecked;
  this.aspect.currentText=config.capture.aspect;this.fps.text=String(config.capture.fps);this.seconds.text=String(config.capture.maxSeconds);this.caption.text=config.composer.caption;this.videoTitle.text=config.composer.title;
  for(const p of PROVIDERS) {
   const row=this.rows[p.id],d=config.destinations[p.id];row.enabled.checkState=d.enabled?Ui.CheckState.Checked:Ui.CheckState.Unchecked;row.format.currentText=d.format;row.caption.text=d.caption;
   if(row.privacy)row.privacy.currentText=d.privacy||'private';if(row.mode)row.mode.currentText=d.publishMode||'inbox';
  }
  this.json.plainText=JSON.stringify(config,null,2);
 }
 collect() {
  if(!this.config)throw new Error('Load a config first');
  const config=JSON.parse(JSON.stringify(this.config));
  config.proxyUrl=this.proxy.text.trim();config.cloud={url:this.cloudUrl.text.trim(),publishableKey:this.cloudKey.text.trim()};
  config.demoMode=this.demo.checkState===Ui.CheckState.Checked;config.capture={aspect:this.aspect.currentText,fps:Number(this.fps.text),maxSeconds:Number(this.seconds.text),includeAudio:this.audio.checkState===Ui.CheckState.Checked};config.composer={caption:this.caption.text,title:this.videoTitle.text};
  for(const p of PROVIDERS){const row=this.rows[p.id],d=config.destinations[p.id];d.enabled=row.enabled.checkState===Ui.CheckState.Checked;d.format=row.format.currentText;d.caption=row.caption.text;if(row.privacy)d.privacy=row.privacy.currentText;if(row.mode){d.publishMode=row.mode.currentText;d.privacyLevel='';}}
  return parseConfig(JSON.stringify(config));
 }
 save() {const config=this.collect();FileSystem.writeFile(this.path(),JSON.stringify(config,null,2)+'\n');this.config=config;this.json.plainText=JSON.stringify(config,null,2);this.status.text='Saved public config. Restart Preview to load it.';}
 async login() {
  if(this.model.project.targetPlatform!==Editor.TargetPlatform.Spectacles)throw new Error('Set project Target Platform to SPECS');
  if(!this.authorization.isAuthorized||!this.authorization.idToken)throw new Error('Sign in for SPECS in the Lens Studio profile menu, then click this button again');
  const url=this.cloudUrl.text.trim().replace(/\/$/,''),key=this.cloudKey.text.trim();
  if(!/^https:\/\//.test(url)||!key)throw new Error('Enter the Snap Cloud project URL and publishable key');
  const response=await http(url+'/auth/v1/token?grant_type=id_token','POST',{apikey:key,'Content-Type':'application/json'},{provider:'snapchat',id_token:this.authorization.idToken});
  if(!response.access_token)throw new Error('Snap Cloud returned no session; check account access');
  this.session=response;this.sessionContext=url+'|'+key;this.sessionExpiration=Date.now()+Number(response.expires_in||3600)*1000;await this.refresh();this.status.text='Signed in to Snap Cloud. Connect the social accounts you want.';
 }
 async api(path,method='GET',body) {
  const context=this.cloudUrl.text.trim().replace(/\/$/,'')+'|'+this.cloudKey.text.trim();
  if(!this.session||this.sessionContext!==context)throw new Error('Sign in to this Snap Cloud project first');
  if(this.sessionExpiration<Date.now()+60000) {
   if(!this.session.refresh_token)throw new Error('Session expired; sign in again');
   this.session=await http(this.cloudUrl.text.trim().replace(/\/$/,'')+'/auth/v1/token?grant_type=refresh_token','POST',{apikey:this.cloudKey.text.trim(),'Content-Type':'application/json'},{refresh_token:this.session.refresh_token});
   if(!this.session.access_token)throw new Error('Session refresh failed; sign in again');
   this.sessionExpiration=Date.now()+Number(this.session.expires_in||3600)*1000;
  }
  const url=this.proxy.text.trim().replace(/\/$/,'');
  if(!/^https:\/\//.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url))throw new Error('Use an HTTPS proxy URL or localhost for desktop development');
  return http(url+path,method,{Authorization:'Bearer '+this.session.access_token,'Content-Type':'application/json'},body);
 }
 async refresh() {
  const connections=await this.api('/v1/connections');
  for(const c of connections){const row=this.rows[c.id||c.provider];if(row)row.label.text=c.name+' · '+(c.connected?'Connected':'Not connected')+(c.account_id?' · '+c.account_id:'');}
  this.status.text='Account connections refreshed';
 }
 async oauth(id) {const auth=await this.api('/v1/connections/'+id+'/oauth','POST',{});Shell.openUrl(auth.url,{});this.status.text='Complete sign-in in your browser, then Refresh connections.';}
 async disconnect(id) {await this.api('/v1/connections/'+id,'DELETE');await this.refresh();}
 async addPrefab() {
  await this.ensureEditable();
  const am=this.model.project.assetManager,source=new Editor.Model.SourcePath(new Editor.Path('SnapCloudSocialMedia.lspkg/SnapCloudSocialMedia__PLACE_IN_SCENE.prefab'),Editor.Model.SourceRootDirectory.Assets);
  const meta=am.getFileMeta(source);if(!meta||Editor.isNull(meta))throw new Error('Import SnapCloudSocialMedia.lspkg first');
  await am.instantiate([meta.primaryAsset]);this.status.text='Prefab added. Position it in front of your camera; restart Preview.';
 }
 deinit() {this.alive=false;this.session=null;for(const c of this.signals)try{c.disconnect();}catch{}this.signals=[];}
}

function http(url,method,headers,body) {
 return new Promise((resolve,reject)=>{
  const request=new Network.HttpRequest();request.url=url;request.headers=headers;request.method=({GET:Network.HttpRequest.Method.Get,POST:Network.HttpRequest.Method.Post,DELETE:Network.HttpRequest.Method.Delete})[method];
  if(body!==undefined){request.contentType='application/json';request.body=JSON.stringify(body);}
  const reply=Network.performHttpRequestWithReply(request);let text='',ended=false;const signals=[];
  const clean=()=>{clearTimeout(timer);for(const c of signals)try{c.disconnect();}catch{}};
  const timer=setTimeout(()=>{if(!ended){ended=true;clean();reject(new Error('Request timed out. Check the proxy connection.'));}},30000);
  signals.push(reply.onData.connect(data=>{text+=data.toString();}));
  signals.push(reply.onEnd.connect(result=>{if(ended)return;ended=true;clean();if(result.statusCode<200||result.statusCode>=300){reject(new Error('Request failed ('+result.statusCode+'). Check login and proxy/provider setup.'));return;}try{resolve(JSON.parse(text));}catch{reject(new Error('Invalid server response'));}}));
 });
}
