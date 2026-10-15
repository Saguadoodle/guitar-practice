import { buildChord, CHORD_TYPES } from './chords'
import type { ChordTypeId } from './chords'
import { buildScale, diatonicTriad } from './scales'
import { modulo, rootPitchClass, spellTone } from './intervals'
export type JamMode='major'|'minor'
export type JamCard={id:string;root:string;type:ChordTypeId;beats:2|4|8}
const ENGLISH:Record<string,string>={major:'Major',minor:'Minor',dim:'Diminished',aug:'Augmented',sus2:'Suspended 2',sus4:'Suspended 4',power:'Power',maj7:'Major 7',min7:'Minor 7',dom7:'Dominant 7','half-dim7':'Half-diminished 7',dim7:'Diminished 7',mMaj7:'Minor Major 7',augMaj7:'Augmented Major 7',aug7:'Augmented 7','7sus4':'Dominant 7 sus4','6':'Major 6',m6:'Minor 6','6/9':'Major 6/9','m6/9':'Minor 6/9',add9:'Add 9',madd9:'Minor Add 9',add11:'Add 11',madd11:'Minor Add 11','9':'Dominant 9',maj9:'Major 9',m9:'Minor 9',mMaj9:'Minor Major 9','11':'Dominant 11',maj11:'Major 11',m11:'Minor 11','13':'Dominant 13',maj13:'Major 13',m13:'Minor 13'}
export const chordTypeName=(type:typeof CHORD_TYPES[number])=>`${type.label}（${ENGLISH[type.id]??type.id.replace(/^7/,'Dominant 7 ').replaceAll('b',' flat ').replaceAll('#',' sharp ')}）`
export function jamPreset(root:string,mode:JamMode,single=false):JamCard[]{
 const scale=buildScale(root,mode)
 return (single?[0]:mode==='major'?[0,4,5,3]:[0,5,2,6]).map((index,i)=>({id:`preset-${i}`,root:scale.tones[index].noteName.length<=2?scale.tones[index].noteName:(root.includes('♭')?['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B']:['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'])[scale.tones[index].pitchClass],type:diatonicTriad(scale.definition,index)!.quality==='minor'?'minor':'major',beats:4}))
}
export const DEFAULT_JAM=jamPreset('A','minor')
export function validateProgression(cards:readonly JamCard[]){
 const errors:string[]=[]
 if(!cards.length)errors.push('请至少添加一个和弦。')
 if(cards.length>32)errors.push('第一版最多支持 32 张和弦卡片。')
 if(new Set(cards.map(c=>c.id)).size!==cards.length)errors.push('和弦卡片标识不能重复。')
 cards.forEach((card,i)=>{try{buildChord(card.root,card.type)}catch{errors.push(`第 ${i+1} 张卡片的根音或类型无效。`)}if(![2,4,8].includes(card.beats))errors.push(`第 ${i+1} 张卡片时长无效。`)})
 const beats=cards.reduce((sum,c)=>sum+c.beats,0)
 if(beats%4!==0)errors.push(`当前共 ${beats} 拍，需组成完整的 4/4 小节；可再补半小节或调整时长。`)
 return {errors,beats,bars:beats/4}
}
export function transposeProgression(cards:readonly JamCard[],from:string,to:string):JamCard[]{
 const distance=modulo(rootPitchClass(to)-rootPitchClass(from)),letters='CDEFGAB'
 const names=to.includes('♭')?['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B']:['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B']
 return cards.map(card=>{const relative=modulo(rootPitchClass(card.root)-rootPitchClass(from)),degree=String((letters.indexOf(card.root[0])-letters.indexOf(from[0])+7)%7+1)
 const spelling=spellTone(to,relative,degree).noteName
 return {...card,root:spelling.length<=2?spelling:names[modulo(rootPitchClass(card.root)+distance)]}})
}
export function analyzeJamCard(card:JamCard,root:string,mode:JamMode){
 const scale=buildScale(root,mode),chord=buildChord(card.root,card.type)
 const inKey=chord.tones.every(t=>scale.tones.some(s=>s.pitchClass===t.pitchClass))
 const index=scale.tones.findIndex(t=>t.pitchClass===chord.rootClass),triad=index<0?null:diatonicTriad(scale.definition,index)
 const exact=triad&&triad.intervals.every(interval=>chord.tones.some(t=>t.pitchClass===modulo(chord.rootClass+interval)))
 let roman:string|null=null
 if(inKey&&exact){if(['major','minor','dim','aug'].includes(card.type))roman=triad!.label
 else if(['maj7','min7','dom7','dim7','half-dim7'].includes(card.type))roman=card.type==='half-dim7'?triad!.label!.replace('°','')+'ø7':triad!.label+(card.type==='maj7'?'maj7':'7')}
 return {name:chord.name,roman,inKey,note:!inKey?'调外和弦':roman?'调内和弦':'调内音组成 · 暂不标级数'}
}
