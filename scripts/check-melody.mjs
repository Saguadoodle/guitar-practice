import assert from 'node:assert/strict'
import {createModuleLoader} from './load-ts.mjs'
const load=createModuleLoader(),{createMelody}=await import(load('src/melody.ts'))
const {EXPLORER_SCALES,buildScale,scalePlayback,stablePitchClasses}=await import(load('src/scales.ts'))
const {TUNING_PRESETS}=await import(load('src/pitch.ts'))
let steps=0,total=0,reversals=0,recoveries=0,leaps=0
for(const definition of EXPLORER_SCALES)for(const root of ['C','D','A','F♯'])for(const preset of TUNING_PRESETS){
 let seed=1245;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32}
 const scale=buildScale(root,definition.id),pitches=scalePlayback(scale,preset.tuning,'up').pitches
 const melody=createMelody(pitches,scale.rootClass,stablePitchClasses(scale),random)
 let prev=melody.next(),prevDirection=0,prevLeap=false
 for(let i=0;i<500;i++){
  const next=melody.next(),distance=Math.abs(next.midi-prev.midi),delta=Math.sign(next.midi-prev.midi)
  assert.ok(pitches.some(p=>p.midi===next.midi));assert.ok(scale.tones.some(t=>t.pitchClass===next.midi%12));assert.ok(distance>0)
  const adjacent=Math.abs(melody.pool.findIndex(p=>p.midi===next.midi)-melody.pool.findIndex(p=>p.midi===prev.midi))===1
  assert.ok(adjacent&&distance<=3 || [3,4,5,7,8,9].includes(distance))
  if(adjacent)steps++;else leaps++
  if(prevLeap){assert.ok(adjacent,'较大跳进后级进');assert.equal(delta,-prevDirection,'大跳后反向级进');recoveries++}
  if(prevDirection && delta!==prevDirection)reversals++
  prevLeap=distance>=5;prevDirection=delta;prev=next;total++
 }
}
assert.ok(steps/total>.65&&steps/total<.95);assert.ok(reversals/total<.6);assert.ok(recoveries>0&&leaps>0)
// 极端随机源、稀疏/单音输入有限结束且不生成新音。
for(const rnd of [()=>0,()=>.999999]){const pitches=[48,50,52,53,55,57,59,60].map(midi=>({midi}));const m=createMelody(pitches,0,[],rnd);for(let i=0;i<1000;i++){const note=m.next();assert.ok(pitches.some(p=>p.midi===note.midi))}}
assert.throws(()=>createMelody([],0));assert.equal(createMelody([{midi:48}],0).next().midi,48)
console.log(`通过：${total}个旋律相邻转移、四预设/13音阶、实际音高限跳、无重复、边界转向、大跳反向恢复；级进 ${(100*steps/total).toFixed(1)}%，非每音折返`)
