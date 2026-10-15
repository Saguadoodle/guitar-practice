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
 console.log('通过：60/90/300 BPM分别连续模拟五分钟无漂移/重复/堆积，预备拍、边界改速/下轮改进行、撤回提前排程、即时音量静音、100次启停及暂停/失败')
}finally{globalThis.setInterval=realSet;globalThis.clearInterval=realClear}
