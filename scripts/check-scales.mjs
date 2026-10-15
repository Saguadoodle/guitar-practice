import assert from 'node:assert/strict'
import {createModuleLoader} from './load-ts.mjs'
const load=createModuleLoader()
const {EXPLORER_SCALES,buildScale,scaleToneAt,scalePlayback}=await import(load('src/scales.ts'))
const {REFERENCE_SCALES}=await import(load('src/referenceScales.ts'))
const {NOTE_OPTIONS,TUNING_PRESETS,STANDARD_TUNING,getPitch,validateTuning}=await import(load('src/pitch.ts'))
const expected={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],dorian:[0,2,3,5,7,9,10],phrygian:[0,1,3,5,7,8,10],lydian:[0,2,4,6,7,9,11],mixolydian:[0,2,4,5,7,9,10],locrian:[0,1,3,5,6,8,10],'harmonic-minor':[0,2,3,5,7,8,11],'melodic-minor':[0,2,3,5,7,9,11],'major-pentatonic':[0,2,4,7,9],'minor-pentatonic':[0,3,5,7,10],'major-blues':[0,2,3,4,7,9],'minor-blues':[0,3,5,6,7,10]}
assert.equal(EXPLORER_SCALES.length,13)
for(const definition of EXPLORER_SCALES){assert.deepEqual(definition.offsets,expected[definition.id]);assert.ok(REFERENCE_SCALES.includes(definition));assert.match(definition.name,/（.+）/)}
for(const [root,id,names]of [['C','major','C D E F G A B'],['D','dorian','D E F G A B C'],['A','minor-pentatonic','A C D E G'],['F','major','F G A B♭ C D E'],['F♯','major','F♯ G♯ A♯ B C♯ D♯ E♯'],['C♯','harmonic-minor','C♯ D♯ E F♯ G♯ A B♯']])assert.equal(buildScale(root,id).tones.map(t=>t.noteName).join(' '),names)
assert.deepEqual(buildScale('C♯','major').tones.map(t=>t.pitchClass),buildScale('D♭','major').tones.map(t=>t.pitchClass))
assert.deepEqual(buildScale('A','minor-pentatonic').tones.map(t=>scaleToneAt(buildScale('A','minor-pentatonic'),t.pitchClass).degree),['i','III','iv','v','VII'])
const natural={C:0,D:2,E:4,F:5,G:7,A:9,B:11},steps=[0,2,4,5,7,9,11],letters='CDEFGAB'
const custom=validateTuning(STANDARD_TUNING.map((p,i)=>({noteName:i===5?'F♯':p.noteName,octave:String(p.octave)}))).tuning
let cells=0
for(const root of NOTE_OPTIONS)for(const definition of EXPLORER_SCALES){
 const scale=buildScale(root,definition.id)
 for(const tone of scale.tones){const acc=[...tone.noteName.slice(1)].reduce((v,a)=>v+(a==='♯'?1:-1),0);assert.equal((natural[tone.noteName[0]]+acc+24)%12,tone.pitchClass);const degree=Number(tone.degree.match(/\d+/)[0]);const alter=[...tone.degree.replace(/\d+/,'')].reduce((v,a)=>v+(a==='♯'?1:-1),0);assert.equal(steps[degree-1]+alter,tone.offset);assert.equal(tone.noteName[0],letters[(letters.indexOf(root[0])+degree-1)%7])}
 for(const tuning of [TUNING_PRESETS[0].tuning,TUNING_PRESETS[1].tuning,TUNING_PRESETS[3].tuning,custom]){
   const mids=new Set()
   for(let string=1;string<=6;string++)for(let fret=0;fret<=24;fret++){const pitch=getPitch(string,fret,tuning);mids.add(pitch.midi);const info=scaleToneAt(scale,pitch.midi);assert.equal(Boolean(info.tone),definition.offsets.includes((pitch.midi-scale.rootClass+120)%12));assert.equal(info.isRoot,pitch.midi%12===scale.rootClass);cells++}
   const up=scalePlayback(scale,tuning,'up'),down=scalePlayback(scale,tuning,'down'),both=scalePlayback(scale,tuning,'both');assert.ok(up)
   assert.equal(up.pitches.length,definition.offsets.length+1);assert.equal(up.pitches.at(-1).midi-up.pitches[0].midi,12)
   assert.equal(new Set(up.pitches.map(p=>p.midi)).size,up.pitches.length)
   assert.deepEqual(down.pitches.map(p=>p.midi),up.pitches.map(p=>p.midi).reverse())
   assert.deepEqual(both.pitches.map(p=>p.midi),[...up.pitches.map(p=>p.midi),...down.pitches.slice(1).map(p=>p.midi)])
   for(const p of up.pitches){assert.ok(mids.has(p.midi));const tone=scale.tones.find(t=>t.noteName===p.noteName);assert.equal(12*(p.octave+1)+tone.natural+tone.accidental,p.midi)}
 }
}
assert.throws(()=>buildScale('C','missing'))
console.log(`通过：13 音阶独立公式、21 主音移调/等音/拼写、三组验收、${cells} 个标准/Drop D/FACGCE/自定义位置及完整八度播放顺序`)
