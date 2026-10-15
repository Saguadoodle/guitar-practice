import type { ScalePitch } from './scales'
export type MelodyState={index:number;direction:number;run:number;recover:boolean;count:number}
/** 音域内有方向的旋律；实际 MIDI 限制跳进，非独立洗牌。 */
export function createMelody(pitches:readonly ScalePitch[],rootClass:number,stableClasses:readonly number[]=[],random:()=>number=Math.random){
  const pool=[...new Map(pitches.map(p=>[p.midi,p])).values()].sort((a,b)=>a.midi-b.midi)
  if(!pool.length)throw new RangeError('旋律需要可用音域')
  const roots=pool.map((p,i)=>p.midi%12===rootClass?i:-1).filter(i=>i>=0)
  const state:MelodyState={index:roots[0]??0,direction:1,run:0,recover:false,count:0}
  const weighted=(choices:number[],preferredDirection:number)=>{
    const weights=choices.map(i=>{
      let weight=Math.sign(i-state.index)===preferredDirection?3:1
      // 每个八音片段的后半段温和倾向主音、主和弦稳定音；不强制终止或回主音。
      if(state.count%8>=5 && (pool[i].midi%12===rootClass||stableClasses.includes(pool[i].midi%12)))weight*=1.6
      return weight
    })
    let value=random()*weights.reduce((a,b)=>a+b,0)
    for(let i=0;i<choices.length;i++){value-=weights[i];if(value<=0)return choices[i]}
    return choices.at(-1)!
  }
  return {pool,state,next(){
    if(state.count++===0)return pool[state.index]
    if(pool.length===1)return pool[0]
    const before=state.index
    if(before===0)state.direction=1
    else if(before===pool.length-1)state.direction=-1
    let direction=state.direction
    if(state.run>=3 && random()<.25)direction*=-1
    const adjacent=[before-1,before+1].filter(i=>i>=0&&i<pool.length&&Math.abs(pool[i].midi-pool[before].midi)<=3)
    const leaps=pool.map((_,i)=>i).filter(i=>Math.abs(i-before)>1&&[3,4,5,7,8,9].includes(Math.abs(pool[i].midi-pool[before].midi)))
    let choices:number[]
    if(state.recover){choices=adjacent.filter(i=>Math.sign(i-before)===-state.direction);if(!choices.length)choices=adjacent}
    else choices=adjacent.length && (!leaps.length||random()<.7)?adjacent:leaps
    if(!state.recover && state.run<2 && choices===adjacent){
      const forward=choices.filter(i=>Math.sign(i-before)===direction)
      if(forward.length)choices=forward
    }
    if(!choices.length)choices=adjacent.length?adjacent:leaps
    // 非本页面的稀疏输入也必须有限退出，绝不造调外音。
    if(!choices.length)choices=pool.map((_,i)=>i).filter(i=>i!==before).sort((a,b)=>Math.abs(pool[a].midi-pool[before].midi)-Math.abs(pool[b].midi-pool[before].midi)).slice(0,1)
    const index=weighted(choices,state.recover?-state.direction:direction)
    const nextDirection=Math.sign(index-before)
    state.run=nextDirection===state.direction?state.run+1:1
    state.direction=nextDirection;state.recover=Math.abs(pool[index].midi-pool[before].midi)>=5;state.index=index
    return pool[index]
  }}
}
