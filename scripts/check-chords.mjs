import assert from 'node:assert/strict'
import { createModuleLoader } from './load-ts.mjs'
const load=createModuleLoader()
const {CHORD_TYPES,buildChord}=await import(load('src/chords.ts'))
const {REFERENCE_SCALES,scaleSuggestions,degreeAt,toRoman}=await import(load('src/referenceScales.ts'))
const {NOTE_OPTIONS}=await import(load('src/pitch.ts'))
const formulas={major:[0,4,7],minor:[0,3,7],dim:[0,3,6],aug:[0,4,8],sus2:[0,2,7],sus4:[0,5,7],power:[0,7],maj7:[0,4,7,11],min7:[0,3,7,10],dom7:[0,4,7,10],dim7:[0,3,6,9],'half-dim7':[0,3,6,10],mMaj7:[0,3,7,11],augMaj7:[0,4,8,11],aug7:[0,4,8,10],'7sus4':[0,5,7,10],'6':[0,4,7,9],m6:[0,3,7,9],'6/9':[0,4,7,9,14],'m6/9':[0,3,7,9,14],add9:[0,4,7,14],madd9:[0,3,7,14],add11:[0,4,7,17],madd11:[0,3,7,17],'9':[0,4,7,10,14],maj9:[0,4,7,11,14],m9:[0,3,7,10,14],mMaj9:[0,3,7,11,14],'11':[0,4,7,10,14,17],maj11:[0,4,7,11,14,17],m11:[0,3,7,10,14,17],'13':[0,4,7,10,14,17,21],maj13:[0,4,7,11,14,17,21],m13:[0,3,7,10,14,17,21],'7b5':[0,4,6,10],'7#5':[0,4,8,10],'7b9':[0,4,7,10,13],'7#9':[0,4,7,10,15],'7#11':[0,4,7,10,18],'7b13':[0,4,7,10,20],'7b9#11':[0,4,7,10,13,18],'7#9b13':[0,4,7,10,15,20],'7b9b13':[0,4,7,10,13,20],'7b9#11b13':[0,4,7,10,13,18,20]}
assert.equal(CHORD_TYPES.length,Object.keys(formulas).length)
const letters=['C','D','E','F','G','A','B'],natural=[0,2,4,5,7,9,11]
for(const type of CHORD_TYPES){
 assert.deepEqual(type.semitones,formulas[type.id])
 for(const root of NOTE_OPTIONS){const chord=buildChord(root,type.id);for(const [i,tone] of chord.tones.entries()){
  const degree=Number(tone.degree.match(/\d+/)[0]),acc=[...tone.degree.replace(/\d+/,'')].reduce((n,a)=>n+(a==='♯'?1:-1),0)
  const diatonic=[0,2,4,5,7,9,11][(degree-1)%7]+12*Math.floor((degree-1)/7)+acc
  assert.equal(tone.offset,diatonic,`${root}${type.id} ${tone.degree}`)
  assert.equal(tone.noteName[0],letters[(letters.indexOf(root[0])+degree-1)%7])
  const spelling=[...tone.noteName.slice(1)].reduce((n,a)=>n+(a==='♯'?1:-1),0)
  assert.equal((natural[letters.indexOf(tone.noteName[0])]+spelling+24)%12,tone.pitchClass)
 }}
}
assert.deepEqual(buildChord('C','13').tones.map(t=>t.noteName),['C','E','G','B♭','D','F','A'])
assert.deepEqual(buildChord('C','dim7').tones.map(t=>t.noteName),['C','E♭','G♭','B♭♭'])
assert.deepEqual(buildChord('C','7#9').tones.map(t=>t.noteName),['C','E','G','B♭','D♯'])
assert.deepEqual(buildChord('F♯','maj13').tones.map(t=>t.noteName),['F♯','A♯','C♯','E♯','G♯','B','D♯'])
assert.ok(!buildChord('C','add9').tones.some(t=>t.degree.includes('7')))
assert.ok(buildChord('C','9').tones.some(t=>t.degree==='♭7'))
assert.deepEqual(buildChord('C','13').type.optional,['5','11'])
assert.equal(toRoman('♭13'),'♭VI');assert.equal(toRoman('♭♭7'),'♭♭VII')
const cm=buildChord('C','minor'),minor=REFERENCE_SCALES.find(s=>s.id==='minor')
assert.ok(scaleSuggestions(cm).length>1)
for(const type of CHORD_TYPES)for(const scale of scaleSuggestions(buildChord('C',type.id)))assert.ok(type.semitones.every(offset=>scale.offsets.some(n=>n===offset%12)))
assert.deepEqual(degreeAt(cm,minor,51),{label:'III',inScale:true})
assert.deepEqual(degreeAt(cm,minor,49),{label:'D♭',inScale:false})
assert.equal(degreeAt(cm,undefined,46).label,'♭VII')
assert.ok(scaleSuggestions(buildChord('C','7#9b13')).length===0,'无合适已实现音阶时使用无音阶模式')
console.log(`通过：${CHORD_TYPES.length} 种独立公式、21 根音拼写、9/11/13 含义、add 与七音区别、变化组合及省略规则`)
console.log('通过：参考音阶建议不唯一、仅推荐完整包含组成音的音阶、参考音阶调内三和弦性质级数、外音和无匹配模式')
