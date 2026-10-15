import { getPitch, MAX_FRET } from './pitch'
import type { Tuning } from './pitch'
import { CHROMATIC_DEGREES, modulo, rootPitchClass, spellTone, toRoman } from './intervals'
export const SCALE_DEFINITIONS = [
  { id: 'major', name: '大调／伊奥尼亚（Major / Ionian）', category: '七声音阶', offsets: [0,2,4,5,7,9,11], degrees: ['1','2','3','4','5','6','7'] },
  { id: 'minor', name: '自然小调／爱奥利亚（Natural Minor / Aeolian）', category: '七声音阶', offsets: [0,2,3,5,7,8,10], degrees: ['1','2','♭3','4','5','♭6','♭7'] },
  { id: 'dorian', name: '多利亚（Dorian）', category: '七声音阶', offsets: [0,2,3,5,7,9,10], degrees: ['1','2','♭3','4','5','6','♭7'] },
  { id: 'phrygian', name: '弗里几亚（Phrygian）', category: '七声音阶', offsets: [0,1,3,5,7,8,10], degrees: ['1','♭2','♭3','4','5','♭6','♭7'] },
  { id: 'lydian', name: '利底亚（Lydian）', category: '七声音阶', offsets: [0,2,4,6,7,9,11], degrees: ['1','2','3','♯4','5','6','7'] },
  { id: 'mixolydian', name: '混合利底亚（Mixolydian）', category: '七声音阶', offsets: [0,2,4,5,7,9,10], degrees: ['1','2','3','4','5','6','♭7'] },
  { id: 'locrian', name: '洛克里亚（Locrian）', category: '七声音阶', offsets: [0,1,3,5,6,8,10], degrees: ['1','♭2','♭3','4','♭5','♭6','♭7'] },
  { id: 'harmonic-minor', name: '和声小调（Harmonic Minor）', category: '七声音阶', offsets: [0,2,3,5,7,8,11], degrees: ['1','2','♭3','4','5','♭6','7'] },
  { id: 'melodic-minor', name: '旋律小调（Melodic Minor）', category: '七声音阶', offsets: [0,2,3,5,7,9,11], degrees: ['1','2','♭3','4','5','6','7'] },
  { id: 'whole-tone', name: '全音音阶（Whole Tone）', category: '和弦参考', offsets: [0,2,4,6,8,10], degrees: ['1','2','3','♯4','♯5','♭7'] },
  { id: 'half-whole', name: '半全减音阶（Half–Whole Diminished）', category: '和弦参考', offsets: [0,1,3,4,6,7,9,10], degrees: ['1','♭2','♯2','3','♯4','5','6','♭7'] },
  { id: 'whole-half', name: '全半减音阶（Whole–Half Diminished）', category: '和弦参考', offsets: [0,2,3,5,6,8,9,11], degrees: ['1','2','♭3','4','♭5','♭6','♭♭7','7'] },
  { id: 'major-pentatonic', name: '大调五声音阶（Major Pentatonic）', category: '五声音阶', offsets: [0,2,4,7,9], degrees: ['1','2','3','5','6'] },
  { id: 'minor-pentatonic', name: '小调五声音阶（Minor Pentatonic）', category: '五声音阶', offsets: [0,3,5,7,10], degrees: ['1','♭3','4','5','♭7'] },
  { id: 'major-blues', name: '大调布鲁斯音阶（Major Blues）', category: '布鲁斯音阶', offsets: [0,2,3,4,7,9], degrees: ['1','2','♭3','3','5','6'] },
  { id: 'minor-blues', name: '小调布鲁斯音阶（Minor Blues）', category: '布鲁斯音阶', offsets: [0,3,5,6,7,10], degrees: ['1','♭3','4','♭5','5','♭7'] },
] as const
export type ScaleDefinition = typeof SCALE_DEFINITIONS[number]
export const EXPLORER_SCALES = SCALE_DEFINITIONS.filter(scale => scale.category !== '和弦参考')
export function buildScale(root: string, id: string) {
  root = root.trim().replace('#','♯').replace('b','♭')
  const definition = SCALE_DEFINITIONS.find(scale => scale.id === id)
  if (!definition) throw new RangeError('未知音阶')
  return {root, rootClass: rootPitchClass(root), definition, tones: definition.offsets.map((offset,index) => spellTone(root,offset,definition.degrees[index]))}
}
export type Scale = ReturnType<typeof buildScale>
export function diatonicTriad(definition: ScaleDefinition, index: number) {
  if (definition.offsets.length !== 7 || index < 0 || index > 6) return null
  const at = (n:number) => definition.offsets[n%7]+12*Math.floor(n/7)
  const intervals = [0,at(index+2)-at(index),at(index+4)-at(index)]
  const quality = intervals[1]===4 && intervals[2]===7 ? 'major'
    : intervals[1]===3 && intervals[2]===7 ? 'minor'
    : intervals[1]===3 && intervals[2]===6 ? 'diminished'
    : intervals[1]===4 && intervals[2]===8 ? 'augmented' : null
  const roman = toRoman(String(index+1))
  const label = quality==='major' ? roman : quality==='minor' ? roman.toLowerCase()
    : quality==='diminished' ? roman.toLowerCase()+'°' : quality==='augmented' ? roman+'+' : null
  return {intervals,quality,label}
}
const PARENTS:Record<string,string> = {'major-pentatonic':'major','minor-pentatonic':'minor','major-blues':'major','minor-blues':'minor'}
export function scaleDegreeLabel(root:string, definition:ScaleDefinition, midi:number) {
  const relative=modulo(midi-rootPitchClass(root))
  const index=definition.offsets.findIndex(offset=>offset===relative)
  const tone=index<0 ? spellTone(root,relative,CHROMATIC_DEGREES[relative]) : spellTone(root,relative,definition.degrees[index])
  const parentId=PARENTS[definition.id]
  const parent=parentId ? SCALE_DEFINITIONS.find(s=>s.id===parentId)! : definition
  const parentIndex=parent.offsets.findIndex(offset=>offset===relative)
  const triad=index>=0 && parentIndex>=0 ? diatonicTriad(parent,parentIndex) : null
  return {label:triad?.label??tone.noteName,triad,spelling:tone}
}
export function stablePitchClasses(scale:Scale) {
  const parentId=PARENTS[scale.definition.id]
  const parent=parentId ? SCALE_DEFINITIONS.find(s=>s.id===parentId)! : scale.definition
  return (diatonicTriad(parent,0)?.intervals.filter(interval=>interval!==6)??[0]).map(offset=>modulo(offset+scale.rootClass))
}
export function scaleToneAt(scale: Scale, midi: number) {
  const relative = modulo(midi-scale.rootClass)
  const tone = scale.tones.find(tone => tone.pitchClass === modulo(midi))
  const info=scaleDegreeLabel(scale.root,scale.definition,midi)
  return {tone, spelling:info.spelling, degree:info.label, isRoot: relative === 0}
}
export type ScalePitch = ReturnType<typeof getPitch>
export function scalePlayback(scale: Scale, tuning: Tuning, direction: 'up'|'down'|'both') {
  const board = new Map<number,ScalePitch>()
  for (let string=1;string<=6;string++) for(let fret=0;fret<=MAX_FRET;fret++) {
    const pitch = getPitch(string,fret,tuning)
    board.set(pitch.midi,pitch)
  }
  const offsets = [...scale.definition.offsets,12]
  const starts = [...board.keys()].filter(midi => modulo(midi) === scale.rootClass && offsets.every(offset=>board.has(midi+offset)))
  const start = starts.sort((a,b)=>Math.abs(a-48)-Math.abs(b-48)||a-b)[0]
  if (start === undefined) return null
  const up = offsets.map(offset=> {
    const pitch = board.get(start+offset)!
    const tone = scale.tones.find(t=>t.pitchClass===modulo(pitch.midi))!
    const octave = (pitch.midi-tone.natural-tone.accidental)/12-1
    return {...pitch,noteName:tone.noteName,octave,label:`${tone.noteName}${octave}`}
  })
  const pitches = direction === 'up' ? up : direction === 'down' ? [...up].reverse() : [...up,...up.slice(0,-1).reverse()]
  return {pitches,range:`${up[0].label}—${up.at(-1)!.label}`}
}
