import { buildScale } from './scales'
import { rootPitchClass, modulo } from './intervals'
import { transposeProgression, validateProgression } from './jam'
import type { JamCard, JamMode } from './jam'
import type { ChordTypeId } from './chords'
import { randomAt } from './jamConfig'
type Entry=readonly [number,ChordTypeId,(2|4|8)?]
export type JamPreset={id:string;category:string;label:string;mode:JamMode;entries:readonly Entry[]}
const preset=(id:string,category:string,label:string,mode:JamMode,entries:readonly Entry[]):JamPreset=>({id,category,label,mode,entries})
export const JAM_PRESETS:JamPreset[]=[
 preset('pop','大调流行','I–V–vi–IV','major',[[0,'major'],[7,'major'],[9,'minor'],[5,'major']]),
 preset('pop-vi','大调流行','vi–IV–I–V','major',[[9,'minor'],[5,'major'],[0,'major'],[7,'major']]),
 preset('pop-old','大调流行','I–vi–IV–V','major',[[0,'major'],[9,'minor'],[5,'major'],[7,'major']]),
 preset('basic','大调基础','I–IV–V–I','major',[[0,'major'],[5,'major'],[7,'major'],[0,'major']]),
 preset('basic-v','大调基础','I–IV–I–V','major',[[0,'major'],[5,'major'],[0,'major'],[7,'major']]),
 preset('minor','小调','i–VI–III–VII','minor',[[0,'minor'],[8,'major'],[3,'major'],[10,'major']]),
 preset('minor-vii','小调','i–VII–VI–VII','minor',[[0,'minor'],[10,'major'],[8,'major'],[10,'major']]),
 preset('minor-v','小调','i–iv–v–i','minor',[[0,'minor'],[5,'minor'],[7,'minor'],[0,'minor']]),
 preset('dominant','小调属功能','i–iv–V–i · 大属和弦','harmonic-minor',[[0,'minor'],[5,'minor'],[7,'major'],[0,'minor']]),
 preset('jazz','爵士大调','ii7–V7–Imaj7','major',[[2,'min7',4],[7,'dom7',4],[0,'maj7',8]]),
 preset('jazz-turn','爵士大调','Imaj7–vi7–ii7–V7','major',[[0,'maj7'],[9,'min7'],[2,'min7'],[7,'dom7']]),
 preset('jazz-minor','爵士小调','iiø7–V7–i · 升七级属功能','harmonic-minor',[[2,'half-dim7',4],[7,'dom7',4],[0,'minor',8]]),
 preset('dorian','调式循环','多利亚 · i7–IV7','dorian',[[0,'min7'],[5,'dom7']]),
 preset('mixolydian','调式循环','混合利底亚 · I–♭VII–IV','mixolydian',[[0,'major',4],[10,'major',4],[5,'major',8]]),
 preset('single-major','单和弦','I · 大三和弦','major',[[0,'major']]),
 preset('single-minor','单和弦','i · 小三和弦','minor',[[0,'minor']]),
 preset('single-dom7','单和弦','I7 · 属七和弦','blues',[[0,'dom7']]),
 preset('single-min7','单和弦','i7 · 小七和弦','minor',[[0,'min7']]),
 preset('blues','十二小节布鲁斯','I7×4 | IV7×2 I7×2 | V7 IV7 I7 V7','blues',[[0,'dom7'],[0,'dom7'],[0,'dom7'],[0,'dom7'],[5,'dom7'],[5,'dom7'],[0,'dom7'],[0,'dom7'],[7,'dom7'],[5,'dom7'],[0,'dom7'],[7,'dom7']]),
]
export const JAM_MODES:readonly (readonly [JamMode,string])[]=[['major','大调（Major）'],['minor','自然小调（Natural Minor）'],['harmonic-minor','和声小调／属功能（Harmonic Minor）'],['dorian','多利亚（Dorian）'],['mixolydian','混合利底亚（Mixolydian）'],['blues','大调布鲁斯属七语汇（Blues）']]
export function presetCards(p:JamPreset,root:string):JamCard[]{
 // 先在 C 上建立音级，再复用带字母拼写的移调；模态七级优先用对应音阶拼写。
 const scale=buildScale(root,p.mode==='blues'?'mixolydian':p.mode)
 return p.entries.map(([offset,type,beats=4],i)=>{
  const pc=modulo(rootPitchClass(root)+offset),tone=scale.tones.find(t=>t.pitchClass===pc)
  const fallback=transposeProgression([{id:'x',root:['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'][offset],type,beats}], 'C',root)[0].root
  return {id:`preset-${i}`,root:tone&&tone.noteName.length<=2?tone.noteName:fallback,type,beats}
 })
}
/** 仅在同一调式的已设计模板间选择；锁定卡片及其时长逐项保留。 */
export function generateProgression(cards:JamCard[],root:string,mode:JamMode,seed:number){
 const pool=JAM_PRESETS.filter(p=>p.mode===mode).flatMap(p=>p.entries.length>1&&p.entries.length<=4?[p,{...p,id:p.id+'-rotation',entries:[...p.entries.slice(1),p.entries[0]]}]:[p])
 const start=Math.floor(randomAt(seed,987)*pool.length)
 for(let attempt=0;attempt<pool.length;attempt++){
  const candidate=presetCards(pool[(start+attempt)%pool.length],root)
  const count=Math.max(candidate.length,...cards.map((c,i)=>c.locked?i+1:0))
  const merged=Array.from({length:count},(_,i)=>cards[i]?.locked?{...cards[i]}:{...candidate[i%candidate.length],id:`generated-${i}`})
  if(!validateProgression(merged).errors.length&&JSON.stringify(merged.map(c=>[c.root,c.type,c.beats]))!==JSON.stringify(cards.map(c=>[c.root,c.type,c.beats])))return merged
 }
 return cards.map(c=>({...c}))
}
