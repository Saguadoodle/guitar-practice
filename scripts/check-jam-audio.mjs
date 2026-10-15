import assert from 'node:assert/strict'
import {createModuleLoader,dataUrl} from './load-ts.mjs'
let now=0,state='running',resume=null,fail=false,sourceId=0,gainId=0,sources=[],gains=[],listeners=new Set(),timers=new Map(),serial=0
const context={get currentTime(){return now},get state(){return state},sampleRate:8000,destination:{id:'destination'},addEventListener(t,fn){listeners.add(fn)},removeEventListener(t,fn){listeners.delete(fn)},createBuffer(c,n){return {id:++sourceId,length:n,copyToChannel(samples){this.samples=samples}}},createGain(){const node={id:++gainId,targets:[],connections:[],gain:{cancelScheduledValues(){},setValueAtTime(value,time){node.targets.push({value,time})},linearRampToValueAtTime(value,time){node.targets.push({value,time})},setTargetAtTime(value,time){node.targets.push({value,time})}},connect(target){node.connections.push(target)},disconnect(){}};gains.push(node);return node},createBufferSource(){if(fail)throw Error('failed');const source={buffer:null,connections:[],startAt:null,endAt:null,connect(target){this.connections.push(target)},disconnect(){},start(time){this.startAt=time},stop(time){this.endAt=time}};sources.push(source);return source}}
globalThis.__jamContext=context;globalThis.__jamResume=()=>resume
const provider=dataUrl(`export class ChordPlayer {async prepare(){if(globalThis.__jamResume())await globalThis.__jamResume();return globalThis.__jamContext}dispose(){}}`)
const load=createModuleLoader({'./chordAudio':provider})
const {JamPlayer,defaultJamMixer,drumSamples}=await import(load('src/jamAudio.ts'))
const {compileJam}=await import(load('src/jamArrangement.ts'))
const {DEFAULT_JAM,jamPreset}=await import(load('src/jam.ts'))
const realSet=globalThis.setInterval,realClear=globalThis.clearInterval
globalThis.setInterval=fn=>{timers.set(++serial,fn);return serial};globalThis.clearInterval=id=>timers.delete(id)
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve()}
function advance(seconds){const end=now+seconds;while(now<end){now=Math.min(end,now+.01);for(const source of sources)if(!source.ended&&source.endAt!==null&&source.endAt<=now){source.ended=true;source.onended?.()}for(const fn of [...timers.values()])fn()}}
const cycle=compileJam(DEFAULT_JAM)
try{
 for(const drum of ['kick','snare','hat','click']){const a=drumSamples(drum,8000,.2),b=drumSamples(drum,8000,.2);assert.deepEqual(a,b);assert.ok(a.every(x=>Number.isFinite(x)&&Math.abs(x)<.4));assert.ok(a.some(x=>x!==0))}
 // 使用实际合成波形验证三声部满音量同时混合，不仅检查MIDI。
 const {createPluckSamples,midiToFrequency}=await import(load('src/audio.ts'))
 for(const kind of ['minor','13']){
  const compiled=compileJam([{id:'mix',root:'A',type:kind,beats:4}]),rate=8000,seconds=60/90,output=new Float32Array(Math.ceil(4*seconds*rate))
  for(const event of compiled.events){const duration=Math.max(.025,Math.min(.95,event.duration*seconds*.95)),wave=event.drum?drumSamples(event.drum,rate,duration):createPluckSamples(midiToFrequency(event.midi),rate,duration),offset=Math.round(event.beat*seconds*rate);for(let i=0;i<wave.length&&offset+i<output.length;i++)output[offset+i]+=wave[i]*event.level}
  assert.ok(output.every(v=>Number.isFinite(v)&&Math.abs(v)<.95),'三声部满音量无数字削波')
  assert.ok(output.some(v=>Math.abs(v)>.01))
 }
 for(const bpm of [60,90,300]){
  now=0;sources=[];gains=[];const progress=[],statuses=[],player=new JamPlayer()
  await player.start(cycle,bpm,true,{onProgress:p=>{if(p)progress.push({time:now,p})},onState:s=>statuses.push(s)})
  advance(301)
  assert.equal(timers.size,1);assert.equal(statuses.at(-1),'playing')
  assert.deepEqual(progress.slice(0,4).map(e=>e.p.phase),['count-in','count-in','count-in','count-in'])
  const first=progress.find(e=>e.p.phase==='playing');assert.ok(Math.abs(first.time-(.04+4*60/bpm))<=.011)
  assert.ok(progress.at(-1).p.loop>5)
  const seen=new Set();for(const source of sources){const beat=(source.startAt-.04)/(60/bpm/2);assert.ok(Math.abs(beat-Math.round(beat))<1e-7,'五分钟起音保持半拍网格');const bus=source.connections[0].connections[0];const key=`${source.buffer.id}:${source.startAt.toFixed(7)}:${bus.id}`;assert.ok(!seen.has(key),'不重复调度');seen.add(key)}
  assert.ok(sources.filter(s=>!s.ended).length<65,'当前和下一小节的声源数有界')
  const nodeCount=gains.length,sourceCount=sources.length,mix=defaultJamMixer();mix.master=.25;mix.muted.bass=true;mix.chords=.1;player.setMixer(mix)
  assert.equal(gains.length,nodeCount);assert.equal(sources.length,sourceCount)
  const buses=gains.slice(0,5);assert.equal(buses[0].targets.at(-1).value,.25);assert.equal(buses[2].targets.at(-1).value,0);assert.equal(buses[3].targets.at(-1).value,.1)
  player.stop();assert.equal(statuses.at(-1),'idle');assert.equal(timers.size,0);const n=sources.length;advance(1);assert.equal(sources.length,n);player.dispose()
 }
 now=0;sources=[];const progress=[],statuses=[],player=new JamPlayer(),callbacks={onProgress:p=>{if(p)progress.push({time:now,p})},onState:(s,message)=>statuses.push({s,message})}
 await player.start(cycle,90,false,callbacks);advance(2.65)
 player.updateBpm(120);player.updateProgression(compileJam(jamPreset('D','major',true)))
 advance(.1);assert.equal(progress.at(-1).p.bpm,120);assert.equal(progress.at(-1).p.current,'F')
 advance(5.8);assert.equal(progress.at(-1).p.cycle.revision,cycle.revision)
 // 下一轮已提前安排时再次编辑，旧的下一轮不能漏出。
 advance(.13);player.updateProgression(compileJam(jamPreset('E','major',true)));advance(.1)
 assert.equal(progress.at(-1).p.current,'E');assert.equal(progress.at(-1).p.bar,1)
 player.updateProgression(cycle);player.cancelPendingProgression();advance(2.1);assert.equal(progress.at(-1).p.current,'E')
 state='suspended';for(const fn of [...listeners])fn();assert.equal(timers.size,0);assert.equal(statuses.at(-1).s,'error');state='running'
 for(let i=0;i<100;i++){await player.start(cycle,300,false,callbacks);player.stop();assert.equal(timers.size,0)}
 let wake;resume=new Promise(resolve=>wake=resolve);const pending=player.start(cycle,90,true,callbacks);player.stop();wake();await pending;resume=null;assert.equal(timers.size,0)
 fail=true;await player.start(cycle,90,false,callbacks);assert.equal(statuses.at(-1).s,'error');assert.equal(timers.size,0);fail=false;player.dispose();assert.equal(listeners.size,0)
 // J2: 同一个播放器在小节与轮边界更新，不启动第二个任务。
 const {defaultJamConfig,applyStyle,regenerate}=await import(load('src/jamConfig.ts'))
 const {STANDARD_TUNING}=await import(load('src/pitch.ts'))
 const {pitchedJamSamples}=await import(load('src/jamTimbres.ts'))
 const c=defaultJamConfig(),j2=compileJam(DEFAULT_JAM,c)
 assert.notDeepEqual(drumSamples('snare',8000,.3,'dry'),drumSamples('snare',8000,.3,'electronic'))
 assert.notDeepEqual(drumSamples('kick',8000,.3,'dry'),drumSamples('kick',8000,.3,'electronic'))
 assert.notDeepEqual(drumSamples('hat',8000,.3,'dry'),drumSamples('hat',8000,.3,'electronic'))
 for(const style of ['pop','funk','ambient']){
  const cfg=applyStyle(c,style),compiled=compileJam(DEFAULT_JAM,cfg),rate=8000,seconds=60/90,output=new Float32Array(Math.ceil(compiled.beats*seconds*rate)+rate*8)
  for(const event of compiled.events){const duration=Math.max(.025,Math.min(8,event.duration*seconds*.95)),wave=event.drum?drumSamples(event.drum,rate,duration,event.timbre):pitchedJamSamples(event.midi,rate,duration,event.timbre),offset=Math.round((event.beat*seconds+(event.delay??0))*rate);for(let i=0;i<wave.length&&offset+i<output.length;i++)output[offset+i]+=wave[i]*event.level}
  assert.ok(output.every(x=>Number.isFinite(x)&&Math.abs(x)<.95),style+' 满音量混合不削波')
 }
 now=0;sources=[];gains=[];const jp=new JamPlayer(),jprogress=[],jstates=[],jcb={onState:(s,m)=>jstates.push({s,m}),onProgress:p=>{if(p)jprogress.push(p)}}
 await jp.start(j2,120,false,jcb);advance(.1)
 const edited=structuredClone(c);edited.parts.drums.timbre='electronic';edited.parts.bass.pattern='long'
 jp.updateProgression(compileJam(DEFAULT_JAM,edited));jp.updateParts(edited,STANDARD_TUNING,'drums')
 advance(1.85);assert.equal(jprogress.at(-1).cycle.config.parts.drums.timbre,'dry')
 advance(.12);assert.equal(jprogress.at(-1).cycle.config.parts.drums.timbre,'electronic');assert.equal(jprogress.at(-1).cycle.config.parts.bass.pattern,'fifth','只有修改的鼓参数下小节应用')
 const whole=applyStyle(edited,'funk');jp.updateWhole(compileJam(DEFAULT_JAM,whole));advance(2)
 assert.equal(jprogress.at(-1).cycle.config.style,'pop','整套编配不在中间小节提前生效')
 advance(4);assert.equal(jprogress.at(-1).cycle.config.style,'funk');assert.equal(timers.size,1)

 // 整套待下轮期间再次编辑单声部，不能把其他声部永久留在旧风格。
 const ambient=applyStyle(whole,'ambient');jp.updateWhole(compileJam(DEFAULT_JAM,ambient))
 const changed=structuredClone(ambient);changed.parts.bass.pattern='quarter';jp.updateParts(changed,STANDARD_TUNING,'bass')
 advance(8.1);assert.equal(jprogress.at(-1).cycle.config.style,'ambient');assert.equal(jprogress.at(-1).cycle.config.parts.drums.pattern,'half');assert.equal(jprogress.at(-1).cycle.config.parts.bass.pattern,'quarter')
 // 反复改速、换音色、重新编配，回收旧排程和声源。
 for(let i=0;i<50;i++){const cfg=regenerate(whole);cfg.parts.drums.timbre=i%2?'dry':'electronic';jp.updateParts(cfg,STANDARD_TUNING,'drums');jp.updateBpm(i%2?60:300);if(i%5===0)jp.updateWhole(compileJam(DEFAULT_JAM,cfg));advance(.15);assert.equal(timers.size,1);assert.ok(sources.filter(s=>!s.ended).length<200)}
 jp.stop();const n=sources.length;advance(1);assert.equal(sources.length,n);assert.equal(timers.size,0);jp.dispose()
 for(const bpm of [60,120,300]){
  now=0;sources=[];gains=[];const p=new JamPlayer();await p.start(compileJam(DEFAULT_JAM,{...c,variation:'subtle'}),bpm,false,jcb);advance(301)
  assert.equal(jstates.at(-1).s,'playing');assert.equal(timers.size,1);assert.ok(sources.filter(s=>!s.ended).length<200)
  const expected=Math.floor((now-.04)/(4*60/bpm));assert.equal((jprogress.at(-1).loop-1)*4+jprogress.at(-1).bar-1,expected)
  p.stop();advance(.1);assert.equal(sources.filter(s=>!s.ended).length,0);p.dispose()
 }
 console.log('通过：J2各音色实际波形不同、三风格满音量混合、单声部下小节/整套下轮、反复改速换音色/编配无叠加、60/120/300 BPM各五分钟有界声源')
 console.log('通过：60/90/300 BPM分别连续模拟五分钟无漂移/重复/堆积，预备拍、边界改速/下轮改进行、撤回提前排程、即时音量静音、100次启停及暂停/失败')
}finally{globalThis.setInterval=realSet;globalThis.clearInterval=realClear}
