// Node.js 22.13+. Executes production methods with controlled engine events/timers.
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {stripTypeScriptTypes} = require('node:module');
const root = process.argv[2] || join(__dirname, '../Assets/AiPreviewAgentInteract.lspkg/interactor');
let timers = [];
const unhandled = [];
process.on('unhandledRejection', error => unhandled.push(error));
function load(file, deps, symbol) {
  const source = readFileSync(join(root, file + '.ts'), 'utf8')
    .replace(/^import .*$/gm, '').replace(/^export /gm, '');
  return new Function(...Object.keys(deps), stripTypeScriptTypes(source, {mode:'transform'}) + '\nreturn ' + symbol)(...Object.values(deps));
}
const AiBaseInteractor = load('BaseInteractor', {setTimeout:fn=>timers.push(fn)}, 'AiBaseInteractor');
const AiHandInteractor = load('HandInteractor', {
  AiBaseInteractor, nextFrame:async()=>{}, sleep:async()=>{}, isNull:o=>o == null || o.destroyed
}, 'AiHandInteractor');
function event() {
  const listeners = new Set();
  return {listeners, add:fn=>{listeners.add(fn);return ()=>listeners.delete(fn)}, emit:()=>{for(const fn of listeners) fn()}};
}
async function check(mode) {
  const start=event(), end=event();
  const vector={add(){return this}, uniformScale(){return this}};
  const target={onTriggerStart:start,onTriggerEnd:end,getSceneObject:()=>({name:'Target',getTransform:()=>({getWorldPosition:()=>vector,forward:vector})})};
  const calls={cancel:0,hide:0,restore:0,gesture:0};
  const ai=Object.create(AiHandInteractor.prototype);
  ai.sikInteractor={currentInteractable:mode==='destroyed' ? {
    destroyed:true,getSceneObject(){throw new Error('destroyed object accessed')}
  } : mode==='diagnosticThrows' ? {getSceneObject(){throw new Error('diagnostic failed')}} : null};
  ai.getInteractableAncestors=()=>[{}];
  ai.silenceAncestorColliders=()=>()=>calls.restore++;
  ai.preparePinchOffset=async()=>{if(mode!=='endAbandoned')throw new Error('gesture failed');return vector};
  ai.handWrapper={firePinchCancel:()=>calls.cancel++,firePinchDown(){},firePinchUp(){},hand:{
    setWorldPosition(){},setPosition:async()=>start.emit(),
    makeGesture:async()=>{if(mode==='endAbandoned' && ++calls.gesture===1)throw new Error('retraction failed')},
    hide:async()=>{calls.hide++}
  }};
  await assert.rejects(ai.pinchInteractable(target), error=>{
    assert.match(error.message, mode==='endAbandoned'?/retraction failed/:/gesture failed/);
    assert.match(error.message, mode==='diagnosticThrows'?/SIK target at failure: "unavailable"/:/SIK target at failure: "none"/);
    return true;
  });
  assert.equal(calls.cancel,1,'failure must cancel pinch');
  assert.equal(calls.hide,1,'failure must retract hand');
  assert.equal(calls.restore,1,'ancestor colliders must be restored');
  for(const fn of timers)fn();
  timers=[];
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(start.listeners.size,0,'start listener must expire');
  assert.equal(end.listeners.size,0,'end listener must expire');
  assert.deepEqual(unhandled,[],'abandoned event waits must not reject globally');
}
(async()=>{
  await check('destroyed');
  await check('diagnosticThrows');
  await check('startAbandoned');
  await check('endAbandoned');
  console.log('PASS: destroyed-target diagnostics, failure cleanup, abandoned start/end waits');
})().catch(error=>{console.error(error);process.exitCode=1});
