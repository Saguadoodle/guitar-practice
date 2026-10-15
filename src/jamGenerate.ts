import { buildChord } from './chords'
import { modulo } from './intervals'
import { fingeringPitches, generateFingerings } from './fingerings'
import { randomAt } from './jamConfig'
import type { JamConfig } from './jamConfig'
import type { JamCard } from './jam'
import type { JamEvent, JamPart } from './jamArrangement'
import type { Tuning } from './pitch'
export type GuitarVoicing={midis:number[];strings:number[];frets:(number|null)[];omitted:string[]}
export function guitarVoicings(cards:readonly JamCard[],tuning:Tuning){
 let previous:(number|null)[]=[]
 return cards.map(card=>{
  const chord=buildChord(card.root,card.type),shapes=generateFingerings(chord,tuning)
  const cost=(frets:(number|null)[])=>frets.reduce<number>((sum,f,i)=>sum+(f===null?2:previous[i]===null||previous[i]===undefined?f*.35:Math.abs(f-previous[i]!)),0)
  const shape=[...shapes].sort((a,b)=>cost(a.frets)-cost(b.frets)||a.span-b.span)[0]
  if(!shape)return null
  previous=shape.frets;const notes=fingeringPitches(shape,tuning,chord)
  return {midis:notes.map(n=>n.midi),strings:notes.map(n=>n.string),frets:[...shape.frets],omitted:shape.omitted} satisfies GuitarVoicing
 })
}
export function arrangeEvents(cards:readonly JamCard[],starts:number[],beats:number,voicings:number[][],guitars:(GuitarVoicing|null)[],config:JamConfig,phase=0):JamEvent[]{
 const events:JamEvent[]=[]
 const variation=config.variation==='subtle'?phase:0
 const random=(p:JamPart,bar:number,n:number)=>randomAt(config.seed,config.parts[p].seed,bar,n,variation)
 const level=(p:JamPart,bar:number,n:number,base:number)=>base*(1+(random(p,bar,n)*2-1)*config.parts[p].velocity*.3)
 const add=(part:JamPart,beat:number,duration:number,base:number,extra:Partial<JamEvent>)=>events.push({part,beat,duration,level:level(part,Math.floor(beat/4),Math.round(beat*100),base),timbre:config.parts[part].timbre,...extra})
 const drum=config.parts.drums
 for(let bar=0;bar<beats/4;bar++){
  const start=bar*4
  // 强拍底鼓与反拍军鼓不受密度随机删除影响。
  const kicks=drum.pattern==='half'?[0]:drum.pattern==='sync'?[0,1.75,2.5]:drum.pattern==='rock'?[0,1.5,2]:[0,2]
  for(const offset of kicks)add('drums',start+offset,.35,.85,{drum:'kick'})
  for(const offset of drum.pattern==='half'?[2]:[1,3])add('drums',start+offset,.25,.65,{drum:'snare'})
  const subdivision=drum.hat
  for(let i=0;i<4*subdivision;i++)if(i%subdivision===0||random('drums',bar,i+100)<drum.density)add('drums',start+i/subdivision,.12,i%subdivision?.24:.35,{drum:'hat'})
  if(drum.pattern==='rock'||drum.density>.7&&drum.pattern!=='sync')add('drums',start+2.5,.25,.5,{drum:'kick'})
  if(drum.density>.5&&drum.pattern==='sixteenth')add('drums',start+2.75,.12,.24,{drum:'snare'})
  // 周期在多轮间累计，不要求进行本身长于过门周期。
  const absoluteBar=phase*(beats/4)+bar+1
  if(drum.fill>0&&absoluteBar%drum.fill===0)for(const offset of [3.25,3.5,3.75])add('drums',start+offset,.16,.4,{drum:'snare'})
 }
 cards.forEach((card,index)=>{
  const chord=buildChord(card.root,card.type),next=buildChord(cards[(index+1)%cards.length].root,cards[(index+1)%cards.length].type)
  const b=config.parts.bass,c=config.parts.chords,start=starts[index],root=36+chord.rootClass+b.register
  const fifth=chord.tones.find(t=>Number(t.degree.match(/\d+/)?.[0])===5)
  const fifthOffset=fifth?modulo(fifth.pitchClass-chord.rootClass):0
  for(let segment=0;segment<card.beats;segment+=4){
   const remaining=Math.min(4,card.beats-segment),base=start+segment,bar=Math.floor(base/4)
   const bassOffsets=b.pattern==='long'?[0]:b.pattern==='eighth'?Array.from({length:8},(_,i)=>i/2):b.pattern==='sync'?[0,.75,1.75,2.5,3.5]:b.pattern==='fifth'?[0,1.5,2,3.5]:[0,1,2,3]
   bassOffsets.forEach((offset,n)=>{
    if(offset>=remaining||n>0&&random('bass',bar,n+index*100)>b.density)return
    let midi=root+(b.pattern==='fifth'&&n%2?fifthOffset:b.pattern==='octave'&&n%2?12:0)
    // 末拍连接只走向下一根音的上下半音，优先选择当前和弦的近邻方向。
    if(segment+remaining===card.beats&&offset>=remaining-.5&&n>0&&random('bass',bar,700+index)<b.approach){const target=36+next.rootClass+b.register;const options=[target-1,target+1];midi=options.sort((a,z)=>Math.abs(a-root)-Math.abs(z-root))[0]}
    add('bass',base+offset,Math.min(remaining-offset,b.pattern==='long'?remaining*b.length:Math.min(b.length,.95*(bassOffsets[n+1]===undefined?remaining-offset:bassOffsets[n+1]-offset))),.85,{midi})
   })
   const pitches=c.timbre==='keys'?voicings[index]:guitars[index]?.midis??[]
   const strings=c.timbre==='keys'?undefined:guitars[index]?.strings
   if(!pitches.length)return
   const offsets=c.pattern==='long'?[0]:c.pattern==='quarter'?[0,1,2,3]:c.pattern==='eighth'?Array.from({length:8},(_,i)=>i/2):c.pattern==='arp'?Array.from({length:8},(_,i)=>i/2):[.5,1.5,2.5,3.5]
   offsets.forEach((offset,n)=>{
    if(offset>=remaining||n>0&&random('chords',bar,index*100+n)>c.density)return
    const duration=Math.min(remaining-offset,c.pattern==='long'?remaining*c.length:c.length)
    if(c.pattern==='arp'){
     const order=pitches.map((_,i)=>i).sort((a,b)=>pitches[a]-pitches[b]);if(c.arp==='down')order.reverse();if(c.arp==='bounce')order.push(...order.slice(1,-1).reverse())
     const note=order[n%order.length];add('chords',base+offset,duration,.45,{midi:pitches[note],string:strings?.[note]})
    }else{
     // fingeringPitches 按第6到第1弦返回；反向扫弦仅逆转弦序，不按音高重排。
     const order=pitches.map((_,i)=>i);if(c.direction==='up'||c.direction==='alternate'&&n%2)order.reverse()
     order.forEach((note,i)=>add('chords',base+offset,duration,.8/pitches.length,{midi:pitches[note],string:strings?.[note],delay:c.pattern==='eighth'?i/(Math.max(1,pitches.length-1))*c.spread/1000:0}))
    }
   })
  }
 })
 return events.sort((a,b)=>a.beat-b.beat)
}
