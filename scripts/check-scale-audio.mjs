import assert from 'node:assert/strict'
import {createModuleLoader,dataUrl} from './load-ts.mjs'
let now=0,fail=false,resume=null,sources=[],intervals=new Map(),serial=0
const param=()=>({setValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){}})
const context={get currentTime(){return now},sampleRate:8000,destination:{},createBuffer(c,n){return {length:n,copyToChannel(samples){this.samples=samples}}},createGain(){return {gain:param(),connect(){},disconnect(){}}},createBufferSource(){if(fail)throw Error('failed');const s={buffer:null,startAt:null,endAt:null,connect(){},disconnect(){},start(t){this.startAt=t},stop(t){this.endAt=t}};sources.push(s);return s}}
globalThis.__scaleContext=context
globalThis.__scaleResume=()=>resume
const chord=dataUrl(`export class ChordPlayer {async prepare(){const pending=globalThis.__scaleResume();if(pending)await pending;return globalThis.__scaleContext}dispose(){}}`)
const load=createModuleLoader({'./chordAudio':chord})
const {ScalePlayer}=await import(load('src/scaleAudio.ts'))
const {createPluckSamples,midiToFrequency}=await import(load('src/audio.ts'))
const {sixteenthSeconds,validBpm}=await import(load('src/scaleRhythm.ts'))
const realSet=globalThis.setInterval,realClear=globalThis.clearInterval
globalThis.setInterval=fn=>{intervals.set(++serial,fn);return serial};globalThis.clearInterval=id=>intervals.delete(id)
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve()}
function advance(seconds){const target=now+seconds;while(now<target){now=Math.min(target,now+.01);for(const source of sources)if(source.endAt!==null&&source.endAt<=now&&!source.ended){source.ended=true;source.onended?.()}for(const fn of [...intervals.values()])fn()}}
const pitches=[48,50,52,53,55,57,59,60].map(midi=>({midi,noteName:'C',octave:3,label:'C3'}))
try{
 for(const value of ['',59,301,'NaN',Infinity])assert.equal(validBpm(value),null)
 for(const bpm of [60,120,300]){
  assert.equal(validBpm(bpm),bpm)
  assert.equal(sixteenthSeconds(bpm),60/bpm/4)
  const player=new ScalePlayer(),events=[],offset=sources.length;const run=player.play(pitches,bpm,midi=>events.push(midi));await flush();advance(4);assert.equal(await run,true)
  const notes=sources.slice(offset);assert.equal(notes.length,8);for(let i=1;i<8;i++)assert.ok(Math.abs(notes[i].startAt-notes[i-1].startAt-60/bpm/4)<1e-9)
  assert.deepEqual(events.filter(m=>m!==null),pitches.map(p=>p.midi));assert.equal(events.at(-1),null);assert.equal(intervals.size,0);player.dispose()
 }
 // 四种模式：相同的绝对十六分音符起音网格，播放超过两个周期仍不结束。
 const {buildScale,scalePlayback,stablePitchClasses}=await import(load('src/scales.ts'))
 const {STANDARD_TUNING}=await import(load('src/pitch.ts'))
 for(const bpm of [60,120,300])for(const mode of ['up','down','both','random']){
  now=0;sources=[];const player=new ScalePlayer(),events=[],scale=buildScale('C','major'),sequence=scalePlayback(scale,STANDARD_TUNING,mode==='random'?'up':mode).pitches
  const run=player.play(sequence,bpm,midi=>events.push(midi),{loop:true,random:mode==='random',rootClass:0,stableClasses:stablePitchClasses(scale)})
  await flush();advance(10);assert.equal(intervals.size,1);assert.ok(sources.length>sequence.length*2)
  for(let i=1;i<sources.length;i++)assert.ok(Math.abs(sources[i].startAt-sources[i-1].startAt-60/bpm/4)<1e-9)
  assert.ok(events.filter(m=>m!==null).every(m=>sequence.some(p=>p.midi===m)))
  player.stop();assert.equal(await run,false);assert.equal(events.at(-1),null);assert.equal(intervals.size,0);player.dispose()
 }
 now=0;sources=[];let seed=4;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32}
 const player=new ScalePlayer();let run=player.play(pitches,300,()=>{},{loop:true,random:true,randomSource:random});await flush();advance(180);assert.equal(intervals.size,1)
 const prefixes=pitches.map(p=>Array.from(createPluckSamples(midiToFrequency(p.midi),8000).slice(0,10)))
 assert.ok(sources.every(s=>prefixes.some(prefix=>prefix.every((v,i)=>v===s.buffer.samples[i]))))
 assert.ok(sources.every(s=>Math.abs((s.startAt-.04)/.05-Math.round((s.startAt-.04)/.05))<1e-6))
 player.setBpm(60);advance(2);player.setBpm(120);advance(2);assert.equal(intervals.size,1);const tail=sources.slice(-5);for(let i=1;i<tail.length;i++)assert.ok(Math.abs(tail[i].startAt-tail[i-1].startAt-.125)<1e-9)
 player.stop();assert.equal(await run,false);assert.equal(intervals.size,0)
 for(let i=0;i<100;i++){run=player.play(pitches,300,()=>{},{loop:true,random:true,randomSource:random});await flush();player.stop();assert.equal(await run,false)}
 const before=sources.length;advance(1);assert.equal(sources.length,before)
 run=player.play(pitches,120,()=>{},{loop:true});await flush();const replace=player.play(pitches,120,()=>{},{loop:true,random:true});await flush();assert.equal(await run,false);assert.equal(intervals.size,1);player.stop();await replace
 fail=true;await assert.rejects(player.play(pitches,120,()=>{}));fail=false;assert.equal(intervals.size,0)
 let wake;resume=new Promise(resolve=>wake=resolve);run=player.play(pitches,120,()=>{});player.stop();wake();assert.equal(await run,false);resume=null;player.dispose();assert.equal(await player.play(pitches,120,()=>{}),false)
 await assert.rejects(player.play(pitches,301,()=>{}),RangeError)
 console.log('通过：60/120/300 BPM四模式循环十六分间隔、三分钟旋律无时钟漂移、100次启停/切换与改速、旧调度取消及错误清理')
}finally{globalThis.setInterval=realSet;globalThis.clearInterval=realClear}
