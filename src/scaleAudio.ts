import { createPluckSamples, midiToFrequency } from './audio'
import { ChordPlayer } from './chordAudio'
import { sixteenthSeconds, validBpm } from './scaleRhythm'
import { createMelody } from './melody'
import type { ScalePitch } from './scales'
type Voice={source:AudioBufferSourceNode;gain:GainNode;start:number;end:number}
export type ScalePlaybackOptions={loop?:boolean;random?:boolean;rootClass?:number;stableClasses?:readonly number[];randomSource?:()=>number}
/** 定时器只填充提前量及刷新界面；所有起音和结束均由 AudioContext 时钟安排。 */
export class ScalePlayer {
  private engine=new ChordPlayer()
  private context:AudioContext|null=null
  private request=0
  private timer:ReturnType<typeof setInterval>|undefined
  private voices=new Set<Voice>()
  private tail:Voice|null=null
  private events:{time:number;midi:number;end:number}[]=[]
  private resolve:((value:boolean)=>void)|undefined
  private callback:((midi:number|null)=>void)|undefined
  private bpm=120
  private nextTime=0
  private buffers=new Map<string,AudioBuffer>()
  private disposed=false
  stop() {
    ++this.request;clearInterval(this.timer);this.timer=undefined
    const now=this.context?.currentTime??0
    if(this.tail){try{this.tail.source.stop(now)}catch{ /* 已结束 */ }this.tail.source.disconnect();this.tail.gain.disconnect();this.tail=null}
    for(const voice of this.voices){
      voice.gain.gain.cancelScheduledValues(now)
      if(voice.start<=now && voice.end>now){voice.gain.gain.setValueAtTime(1,now);voice.gain.gain.linearRampToValueAtTime(0,now+.005);voice.source.stop(now+.005);this.tail=voice}
      else {try{voice.source.stop(now)}catch{ /* 已结束 */ }voice.source.disconnect();voice.gain.disconnect()}
    }
    this.voices.clear();this.events=[];this.callback?.(null);this.callback=undefined
    this.resolve?.(false);this.resolve=undefined
  }
  dispose(){this.stop();this.disposed=true;this.buffers.clear();this.engine.dispose();this.tail=null}
  setBpm(bpm:number){
    if(validBpm(bpm)===null) throw new RangeError('BPM 须为 60—300')
    this.bpm=bpm
  }

  private schedule(pitch:ScalePitch,start:number,interval:number){
    const context=this.context!,duration=Math.max(.012,Math.min(2,interval*.92))
    const cacheKey=`${pitch.midi}:${duration}`
    let buffer=this.buffers.get(cacheKey)
    if(!buffer){buffer=context.createBuffer(1,Math.ceil(context.sampleRate*duration),context.sampleRate);buffer.copyToChannel(createPluckSamples(midiToFrequency(pitch.midi),context.sampleRate,duration),0);if(this.buffers.size>=128)this.buffers.delete(this.buffers.keys().next().value!);this.buffers.set(cacheKey,buffer)}
    const source=context.createBufferSource(),gain=context.createGain();source.buffer=buffer;source.connect(gain);gain.connect(context.destination)
    const voice={source,gain,start,end:start+duration};this.voices.add(voice)
    source.onended=()=>{this.voices.delete(voice);if(this.tail===voice)this.tail=null;source.disconnect();gain.disconnect()}
    source.start(start);source.stop(voice.end)
    this.events.push({time:start,midi:pitch.midi,end:start+interval})
    return voice
  }
  async play(pitches:readonly ScalePitch[],bpm:number,onNote:(midi:number|null)=>void,options:ScalePlaybackOptions={}):Promise<boolean>{
    if(validBpm(bpm)===null || !pitches.length || pitches.some(p=>!Number.isInteger(p.midi)||p.midi<0||p.midi>127))throw new RangeError('需要有效音高及 60—300 BPM')
    this.stop();const request=this.request
    if(this.disposed)return false
    this.bpm=bpm
    const context=await this.engine.prepare()
    if(request!==this.request||this.disposed)return false
    this.context=context;this.callback=onNote;this.nextTime=context.currentTime+.04
    const loop=options.loop??false,random=options.random??false
    const melody=random ? createMelody(pitches,options.rootClass??pitches[0].midi%12,options.stableClasses,options.randomSource) : null
    const sequence=loop && pitches.length>1 && pitches[0].midi===pitches.at(-1)!.midi ? pitches.slice(0,-1) : pitches
    let index=0,lastMidi:number|null=null,lastEnd=0
    return new Promise<boolean>((resolve,reject)=>{
      this.resolve=resolve
      const pump=()=>{
        if(request!==this.request)return
        try{
          const now=context.currentTime
          // 页面线程停顿时不补播一串过期音；从新起音点恢复，不密集补播。
          if(this.nextTime<now-.1){this.nextTime=now+.04}
          while(this.nextTime<now+.08 && (loop||index<sequence.length)){
            const interval=sixteenthSeconds(this.bpm)
            const pitch=melody ? melody.next() : sequence[index%sequence.length]
            this.schedule(pitch,this.nextTime,interval);index++;this.nextTime+=interval
          }
          while(this.events.length&&this.events[0].time<=now){const event=this.events.shift()!;lastMidi=event.midi;lastEnd=event.end;onNote(lastMidi)}
          if(lastMidi!==null && now>=lastEnd && !this.events.length){lastMidi=null;onNote(null)}
          if(!loop && index===sequence.length && now>=this.nextTime){clearInterval(this.timer);this.timer=undefined;this.callback=undefined;this.resolve=undefined;onNote(null);resolve(true)}
        }catch(error){this.resolve=undefined;this.stop();reject(error)}
      }
      this.timer=setInterval(pump,15);pump()
    })
  }
}
