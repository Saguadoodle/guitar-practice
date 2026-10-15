import assert from 'node:assert/strict'
import {createModuleLoader} from './load-ts.mjs'
const load=createModuleLoader()
const {toRoman}=await import(load('src/intervals.ts'))
const {buildScale,scaleToneAt,diatonicTriad,EXPLORER_SCALES}=await import(load('src/scales.ts'))
const {buildChord}=await import(load('src/chords.ts'))
const {degreeAt}=await import(load('src/referenceScales.ts'))
for(const [root,id,expected]of [
 ['C','major',['I','ii','iii','IV','V','vi','vii°']],
 ['A','minor',['i','ii°','III','iv','v','VI','VII']],
 ['A','harmonic-minor',['i','ii°','III+','iv','V','VI','vii°']],
 ['D','dorian',['i','ii','III','IV','v','vi°','VII']],
 ['A','melodic-minor',['i','ii','III+','IV','V','vi°','vii°']],
 ['C','major-pentatonic',['I','ii','iii','V','vi']],
 ['A','minor-pentatonic',['i','III','iv','v','VII']],
 ['C','major-blues',['I','ii','E♭','iii','V','vi']],
 ['A','minor-blues',['i','III','iv','E♭','v','VII']],
]){
 const scale=buildScale(root,id),chord=buildChord(root,'major')
 for(const octave of [0,12,24])assert.deepEqual(scale.tones.map(t=>scaleToneAt(scale,t.pitchClass+octave).degree),expected)
 assert.deepEqual(scale.tones.map(t=>degreeAt(chord,scale.definition,t.pitchClass).label),expected)
}
for(const d of EXPLORER_SCALES.filter(s=>s.offsets.length===7))for(let i=0;i<7;i++){
 const triad=diatonicTriad(d,i)
 assert.ok(triad.quality);assert.deepEqual(triad.intervals,[0,(d.offsets[(i+2)%7]+12*Math.floor((i+2)/7))-d.offsets[i],(d.offsets[(i+4)%7]+12*Math.floor((i+4)/7))-d.offsets[i]])
}
assert.equal(toRoman('♭3'),'♭III');assert.equal(buildChord('C','minor').tones[1].degree,'♭3')
assert.equal(degreeAt(buildChord('C','7b5'),undefined,54).label,'♭V')
assert.equal(scaleToneAt(buildScale('C','major'),49).degree,'D♭')
console.log('通过：C大调/A自然小调/A和声小调/D多利亚及旋律小调真实叠三度性质、跨八度、母音阶五声/布鲁斯、两页一致，音程公式独立')
