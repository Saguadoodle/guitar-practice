import { buildChord } from './chords'
import { modulo } from './intervals'
import { validateProgression } from './jam'
import type { JamCard } from './jam'
export type JamPart='drums'|'bass'|'chords'
export type Drum='kick'|'snare'|'hat'|'click'
export type JamEvent={beat:number;part:JamPart|'click';midi?:number;drum?:Drum;duration:number;level:number}
export type JamCycle={cards:JamCard[];beats:number;bars:number;events:JamEvent[];starts:number[];voicings:number[][];revision:string}
/** 保留共同音，其余音在 G3—G5 内就近选择；这是键盘配音，不冒充吉他指型。 */
export function voiceChord(card:JamCard,previous:readonly number[]=[]){
 return buildChord(card.root,card.type).tones.map(t=>{
  const candidates=Array.from({length:25},(_,i)=>55+i).filter(m=>m%12===t.pitchClass)
  return candidates.sort((a,b)=>{
   const cost=(n:number)=>previous.includes(n)?-100:(previous.length?Math.min(...previous.map(p=>Math.abs(p-n))):0)+Math.abs(n-64)*.35
   return cost(a)-cost(b)||a-b
  })[0]
 }).sort((a,b)=>a-b)
}
export function compileJam(cards:readonly JamCard[]):JamCycle{
 const validation=validateProgression(cards)
 if(validation.errors.length)throw new RangeError(validation.errors.join(' '))
 const copy=cards.map(c=>({...c})),starts:number[]=[],events:JamEvent[]=[]
 let cursor=0;for(const card of copy){starts.push(cursor);cursor+=card.beats}
 let previous:number[]=[],voicings:number[][]=[]
 for(let pass=0;pass<2;pass++){voicings=copy.map(card=>{const voices=voiceChord(card,previous);previous=voices;return voices})}
 for(let bar=0;bar<validation.bars;bar++){
  for(let eighth=0;eighth<8;eighth++)events.push({beat:bar*4+eighth/2,part:'drums',drum:'hat',duration:.13,level:eighth%2?.25:.35})
  for(const beat of [0,2,2.5])events.push({beat:bar*4+beat,part:'drums',drum:'kick',duration:.35,level:beat===2.5?.55:.85})
  for(const beat of [1,3])events.push({beat:bar*4+beat,part:'drums',drum:'snare',duration:.25,level:.65})
 }
 copy.forEach((card,index)=>{
  const chord=buildChord(card.root,card.type),root=36+chord.rootClass
  const fifth=chord.tones.find(t=>Number(t.degree.match(/\d+/)?.[0])===5)
  const fifthOffset=fifth?modulo(fifth.pitchClass-chord.rootClass):0
  for(let beat=0;beat<card.beats;beat+=4){
   const remaining=Math.min(4,card.beats-beat),start=starts[index]+beat
   const bass=[{beat:0,midi:root},{beat:1.5,midi:root+fifthOffset},{beat:2,midi:root},{beat:3.5,midi:root+12}]
   for(const note of bass)if(note.beat<remaining)events.push({beat:start+note.beat,part:'bass',midi:note.midi,duration:Math.min(.7,remaining-note.beat),level:.9})
   for(const offset of [0,2.5])if(offset<remaining)for(const midi of voicings[index])events.push({beat:start+offset,part:'chords',midi,duration:Math.min(offset===0?1.25:.75,remaining-offset),level:.75/voicings[index].length})
  }
 })
 return {cards:copy,beats:validation.beats,bars:validation.bars,events:events.sort((a,b)=>a.beat-b.beat),starts,voicings,revision:JSON.stringify(copy)}
}
export function cardAtBeat(cycle:JamCycle,beat:number){
 const relative=moduloBeat(beat,cycle.beats)
 return Math.max(0,cycle.starts.findLastIndex(start=>start<=relative+1e-7))
}
const moduloBeat=(beat:number,total:number)=>(beat%total+total)%total
export function barEvents(cycle:JamCycle,bar:number){return cycle.events.filter(e=>e.beat>=bar*4&&e.beat<(bar+1)*4).map(e=>({...e,beat:e.beat-bar*4}))}
