import { compileJam } from './jamArrangement'
import type { JamConfig } from './jamConfig'
import type { Tuning } from './pitch'
import { pitchedJamSamples } from './jamTimbres'
import { ChordPlayer } from './chordAudio'
import { createPluckSamples, midiToFrequency } from './audio'
import { validBpm } from './scaleRhythm'
import { barEvents, cardAtBeat } from './jamArrangement'
import type { JamCycle, JamEvent, JamPart, Drum } from './jamArrangement'
import { buildChord } from './chords'
export type JamMixer={master:number;drums:number;bass:number;chords:number;muted:Record<JamPart,boolean>}
export const defaultJamMixer=():JamMixer=>({master:.7,drums:.65,bass:.65,chords:.6,muted:{drums:false,bass:false,chords:false}})
export type JamProgress={phase:'count-in'|'playing';beat:number;bar:number;loop:number;cardId:string;current:string;next:string;bpm:number;cycle:JamCycle}
export type JamCallbacks={onProgress:(value:JamProgress|null)=>void;onState:(state:'starting'|'playing'|'idle'|'error',message?:string)=>void}
type Voice={source:AudioBufferSourceNode;gain:GainNode;start:number;level:number;part:JamPart|'click'}
type Cursor={cycle:JamCycle;bar:number;countIn:boolean;loop:number;bpm:number}
type Plan={start:number;before:Cursor;voices:Voice[]}
export function drumSamples(kind:Drum,rate:number,duration:number,kit='dry'){
 const samples=new Float32Array(Math.ceil(rate*duration));let seed=kind==='snare'?572:913,phase=0,previous=0
 for(let i=0;i<samples.length;i++){
  const t=i/rate,attack=Math.min(t/.002,1),release=Math.min((duration-t)/.012,1)
  seed=(seed*1664525+1013904223)>>>0;const noise=seed/2**31-1
  let value:number
  if(kind==='kick'){phase+=2*Math.PI*(45+100*Math.exp(-t*45))/rate;value=Math.sin(phase)*Math.exp(-t*16)*.23}
  else if(kind==='snare')value=((noise-previous)*.6+Math.sin(2*Math.PI*180*t)*.3)*Math.exp(-t*23)*.16
  else if(kind==='hat')value=(noise-previous)*Math.exp(-t*65)*.09
  else value=Math.sin(2*Math.PI*1300*t)*Math.exp(-t*70)*.12
  if(kit==='electronic'){if(kind==='kick')value=Math.sin(phase)*Math.exp(-t*10)*.26;else if(kind==='snare')value=(Math.sign(Math.sin(2*Math.PI*210*t))*.35+noise*.5)*Math.exp(-t*35)*.17;else if(kind==='hat')value=(Math.sign(Math.sin(2*Math.PI*3100*t))+Math.sign(Math.sin(2*Math.PI*2700*t)))*Math.exp(-t*90)*.055}
  samples[i]=value*attack*release;previous=noise
 }
 return samples
}
/** 每个小节只安排一次；所有声部与进度使用同一 AudioContext 时间线。 */
export class JamPlayer{
 private engine=new ChordPlayer()
 private context:AudioContext|null=null
 private request=0
 private timer:ReturnType<typeof setInterval>|undefined
 private active=new Set<Voice>()
 private tails=new Set<Voice>()
 private buses:Record<JamPart|'click'|'master',GainNode>|null=null
 private buffers=new Map<string,AudioBuffer>()
 private mixer=defaultJamMixer()
 private desiredCycle:JamCycle|null=null
 private desiredBpm=90
 private barConfig:{config:JamConfig;tuning:Tuning}|null=null
 private barCache=new Map<string,JamCycle>()
 private cursor:Cursor|null=null
 private nextTime=0
 private lastPlan:Plan|null=null
 private progress:{time:number;value:JamProgress}[]=[]
 private callbacks:JamCallbacks|null=null
 private detach:(()=>void)|null=null
 private running=false
 private disposed=false
 setMixer(mixer:JamMixer){
  for(const value of [mixer.master,mixer.drums,mixer.bass,mixer.chords])if(!Number.isFinite(value)||value<0||value>1)throw new RangeError('音量须为 0—1')
  this.mixer={...mixer,muted:{...mixer.muted}}
  if(!this.buses||!this.context)return
  const now=this.context.currentTime
  for(const part of ['master','drums','bass','chords','click'] as const){const gain=this.buses[part].gain;gain.cancelScheduledValues(now);gain.setTargetAtTime(part==='click'?.75:part==='master'?mixer.master:mixer.muted[part]?0:mixer[part],now,.01)}
 }
 updateBpm(bpm:number){if(validBpm(bpm)===null)throw new RangeError('BPM 须为 60—300');this.rewindFuture();this.desiredBpm=bpm}
 updateProgression(cycle:JamCycle){this.rewindFuture();this.desiredCycle=cycle}
 updateParts(config:JamConfig,tuning:Tuning,part?:JamPart){
  this.rewindFuture()
  const base=this.barConfig?.config??this.cursor?.cycle.config
  const next=part&&base?{...base,parts:{...base.parts,[part]:config.parts[part]}}:config
  this.barConfig={config:next,tuning}
  if(this.desiredCycle?.config){const desired=part?{...this.desiredCycle.config,parts:{...this.desiredCycle.config.parts,[part]:config.parts[part]}}:config;this.desiredCycle=compileJam(this.desiredCycle.sourceCards??this.desiredCycle.cards,desired,tuning)}
 }
 /** 整套编配在下轮应用；清除之前小节级参数快照。 */
 updateWhole(cycle:JamCycle){this.rewindFuture();this.barConfig=null;this.desiredCycle=cycle}
 private withParts(cycle:JamCycle){
  if(!this.barConfig)return cycle
  const {config,tuning}=this.barConfig,key=JSON.stringify([cycle.cards,config,tuning])
  let compiled=this.barCache.get(key)
  if(!compiled){compiled=compileJam(cycle.sourceCards??cycle.cards,config,tuning);if(this.barCache.size>=16)this.barCache.delete(this.barCache.keys().next().value!);this.barCache.set(key,compiled)}
  if(compiled.issues?.length)throw Error(compiled.issues.join(' '))
  return compiled
 }
 private releasePart(part:JamPart,time:number){
  for(const voice of this.active)if(voice.part===part){voice.gain.gain.cancelScheduledValues(time);voice.gain.gain.setValueAtTime(voice.start>=time?0:voice.level,time);voice.gain.gain.linearRampToValueAtTime(0,time+.02);voice.source.stop(voice.start>=time?time:time+.02)}
 }
 cancelPendingProgression(){this.rewindFuture();if(this.cursor)this.desiredCycle=this.cursor.cycle}
 private rewindFuture(){
  const plan=this.lastPlan,context=this.context
  if(!plan||!context||plan.start<=context.currentTime)return
  for(const voice of plan.voices){voice.source.stop(context.currentTime);voice.source.disconnect();voice.gain.disconnect();this.active.delete(voice)}
  this.progress=this.progress.filter(event=>event.time<plan.start)
  this.cursor={...plan.before};this.nextTime=plan.start;this.lastPlan=null
 }
 stop(message?:string){
  ++this.request;this.running=false;clearInterval(this.timer);this.timer=undefined;this.detach?.();this.detach=null
  const now=this.context?.currentTime??0
  for(const voice of this.tails){try{voice.source.stop(now)}catch{/* 已结束 */}voice.source.disconnect();voice.gain.disconnect()}this.tails.clear()
  for(const voice of this.active){
   voice.gain.gain.cancelScheduledValues(now)
   if(voice.start>now){voice.gain.gain.setValueAtTime(0,now);voice.source.stop(now);voice.source.disconnect();voice.gain.disconnect()}
   else {voice.gain.gain.setValueAtTime(voice.level,now);voice.gain.gain.linearRampToValueAtTime(0,now+.025);voice.source.stop(now+.025);this.tails.add(voice)}
  }
  this.active.clear();this.progress=[];this.lastPlan=null;this.cursor=null
  this.callbacks?.onProgress(null);this.callbacks?.onState(message?'error':'idle',message)
 }
 dispose(){this.stop();this.disposed=true;this.engine.dispose();this.buffers.clear();this.tails.clear();this.buses=null}
 private schedule(event:JamEvent,start:number,secondsPerBeat:number){
  const context=this.context!,duration=Math.max(.025,Math.min(8,event.duration*secondsPerBeat*.95)),cacheKey=`${event.timbre??"legacy"}:${event.drum??event.midi}:${duration.toFixed(6)}`
  let buffer=this.buffers.get(cacheKey)
  if(!buffer){const samples=event.drum?drumSamples(event.drum,context.sampleRate,duration,event.timbre):event.timbre?pitchedJamSamples(event.midi!,context.sampleRate,duration,event.timbre):createPluckSamples(midiToFrequency(event.midi!),context.sampleRate,duration);buffer=context.createBuffer(1,samples.length,context.sampleRate);buffer.copyToChannel(samples,0);if(this.buffers.size>=128)this.buffers.delete(this.buffers.keys().next().value!);this.buffers.set(cacheKey,buffer)}
  const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;gain.gain.setValueAtTime(event.level,context.currentTime);source.connect(gain);gain.connect(this.buses![event.part])
  const voice={source,gain,start,level:event.level,part:event.part};this.active.add(voice)
  source.onended=()=>{this.active.delete(voice);this.tails.delete(voice);source.disconnect();gain.disconnect()}
  source.start(start);source.stop(start+duration)
  return voice
 }
 async start(cycle:JamCycle,bpm:number,countIn:boolean,callbacks:JamCallbacks){
  this.stop();this.barConfig=null;this.barCache.clear();if(this.disposed)return
  if(cycle.issues?.length){callbacks.onState('error',cycle.issues.join(' '));return}
  if(validBpm(bpm)===null)throw new RangeError('BPM 须为 60—300')
  const request=this.request;this.callbacks=callbacks;callbacks.onState('starting')
  try{
   const context=await this.engine.prepare()
   if(request!==this.request||this.disposed)return
   this.context=context
   if(!this.buses){const buses={} as NonNullable<JamPlayer['buses']>;for(const part of ['master','drums','bass','chords','click'] as const)buses[part]=context.createGain();buses.master.connect(context.destination);for(const part of ['drums','bass','chords','click'] as const)buses[part].connect(buses.master);this.buses=buses}
   this.setMixer(this.mixer);this.desiredCycle=cycle;this.desiredBpm=bpm;this.cursor={cycle,bar:0,countIn,loop:1,bpm};this.nextTime=context.currentTime+.04;this.running=true
   const suspended=()=>{if(this.running&&context.state!=='running')this.stop('浏览器已暂停声音，请再次点击开始。')}
   context.addEventListener('statechange',suspended);this.detach=()=>context.removeEventListener('statechange',suspended)
   callbacks.onState('playing')
   const pump=()=>{
    if(!this.running||request!==this.request)return
    if(context.state!=='running'){suspended();return}
    try{
     if(this.nextTime<context.currentTime-.12){this.stop('页面响应中断，伴奏已停止，请重新开始。');return}
     while(this.nextTime<context.currentTime+.08){
      const before={...this.cursor!},current={...before,bpm:this.desiredBpm}
      if(!current.countIn&&current.bar===0){current.cycle=this.desiredCycle!;this.barConfig=null}
      if(!current.countIn){current.cycle=this.withParts(current.cycle);current.bar%=current.cycle.bars;if(current.cycle.issues?.length)throw Error(current.cycle.issues.join(' '))}
      if(current.cycle.config&&before.cycle.config)for(const part of ['drums','bass','chords'] as const)if(current.cycle.config.parts[part].timbre!==before.cycle.config.parts[part].timbre)this.releasePart(part,this.nextTime)
      const seconds=60/current.bpm,start=this.nextTime,voices:Voice[]=[]
      const events:JamEvent[]=current.countIn?Array.from({length:4},(_,beat)=>({beat,part:'click',drum:'click',duration:.15,level:beat===0?1:.65})):barEvents(current.cycle,current.bar,current.loop)
      for(const event of events)voices.push(this.schedule(event,start+event.beat*seconds+(event.delay??0),seconds))
      for(let beat=0;beat<4;beat++){
       const index=cardAtBeat(current.cycle,current.bar*4+beat),card=current.cycle.cards[index],next=current.cycle.cards[(index+1)%current.cycle.cards.length]
       this.progress.push({time:start+beat*seconds,value:{phase:current.countIn?'count-in':'playing',beat:beat+1,bar:current.bar+1,loop:current.loop,cardId:card.id.split('::repeat-')[0],current:buildChord(card.root,card.type).name,next:buildChord(next.root,next.type).name,bpm:current.bpm,cycle:current.cycle}})
      }
      this.lastPlan={start,before,voices};this.nextTime=start+4*seconds
      this.cursor=current.countIn?{...current,countIn:false,bar:0}:current.bar+1===current.cycle.bars?{...current,bar:0,loop:current.loop+1}:{...current,bar:current.bar+1}
     }
     let latest:JamProgress|undefined
     while(this.progress.length&&this.progress[0].time<=context.currentTime)latest=this.progress.shift()!.value
     if(latest)callbacks.onProgress(latest)
    }catch(error){this.stop(error instanceof Error?error.message:'伴奏播放失败，请重新开始。')}
   }
   this.timer=setInterval(pump,20);pump()
  }catch{if(request===this.request)this.stop('无法启动音频，请检查浏览器声音权限后重试。')}
 }
}
