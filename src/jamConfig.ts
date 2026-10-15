import type { JamPart } from './jamArrangement'
export const PARTS:JamPart[]=['drums','bass','chords']
export const TIMBRES={drums:[['dry','干燥原声（合成）'],['electronic','电子鼓（合成）']],bass:[['round','圆润贝斯（合成）'],['pick','拨片感贝斯（合成）'],['synth','合成贝斯']],chords:[['bright','吉他 · 明亮清音（合成）'],['soft','吉他 · 柔和清音（合成）'],['palm','吉他 · 闷音（合成）'],['keys','键盘／合成器']]} as const
export const PATTERNS={drums:[['backbeat','基础反拍'],['rock','八分摇滚'],['sixteenth','十六分律动'],['half','半拍感'],['sync','切分律动']],bass:[['long','根音长音'],['quarter','四分根音'],['eighth','八分根音'],['fifth','根音与五音'],['octave','八度交替'],['sync','切分']],chords:[['long','每小节长和弦'],['quarter','四分短和弦'],['eighth','八分扫弦'],['sync','反拍切分'],['arp','分解和弦']]} as const
export type PartConfig={timbre:string;pattern:string;density:number;length:number;velocity:number;hat:number;fill:number;register:number;approach:number;direction:'down'|'up'|'alternate';spread:number;arp:'up'|'down'|'bounce';seed:number;locked:boolean}
export type JamConfig={version:2;seed:number;variation:'fixed'|'subtle';style:'pop'|'funk'|'ambient'|'custom';parts:Record<JamPart,PartConfig>}
export function defaultJamConfig():JamConfig{
 const base:PartConfig={timbre:'dry',pattern:'backbeat',density:.65,length:.7,velocity:.15,hat:2,fill:4,register:0,approach:.35,direction:'alternate',spread:35,arp:'up',seed:1,locked:false}
 return {version:2,seed:114514,variation:'fixed',style:'pop',parts:{drums:{...base,seed:11},bass:{...base,timbre:'round',pattern:'fifth',seed:22},chords:{...base,timbre:'bright',pattern:'sync',seed:33}}}
}
export function applyStyle(config:JamConfig,style:'pop'|'funk'|'ambient'):JamConfig{
 const next=defaultJamConfig();next.seed=config.seed;next.variation=config.variation;next.style=style
 if(style==='funk'){
  Object.assign(next.parts.drums,{pattern:'sync',hat:4,density:.85,velocity:.3})
  Object.assign(next.parts.bass,{pattern:'sync',timbre:'pick',length:.4,density:.8,approach:.55})
  Object.assign(next.parts.chords,{timbre:'palm',pattern:'sync',length:.3,density:.55,spread:15})
 }else if(style==='ambient'){
  Object.assign(next.parts.drums,{pattern:'half',hat:1,density:.2,fill:0,velocity:.1})
  Object.assign(next.parts.bass,{pattern:'long',length:.95,density:.25,approach:0})
  Object.assign(next.parts.chords,{timbre:'soft',pattern:'arp',arp:'bounce',length:1.8,density:.35,spread:100})
 }
 for(const part of PARTS)next.parts[part]={...next.parts[part],seed:config.parts[part].seed,locked:config.parts[part].locked}
 return next
}
/** 无时钟/全局随机依赖；同一 seed 与坐标产生相同值。 */
export function randomAt(seed:number,...coordinates:number[]){let x=seed>>>0;for(const n of coordinates){x=Math.imul(x^n^0x9e3779b9,0x85ebca6b);x^=x>>>13}x=Math.imul(x^(x>>>16),0x7feb352d);return (x>>>0)/4294967296}
export function regenerate(config:JamConfig,part?:JamPart):JamConfig{
 const parts={...config.parts}
 for(const name of part?[part]:PARTS)if(!parts[name].locked)parts[name]={...parts[name],seed:(parts[name].seed+1)>>>0}
 return {...config,parts}
}
export function normalizeJamConfig(raw:unknown):JamConfig{
 const defaults=defaultJamConfig(),obj=raw&&typeof raw==='object'?raw as Partial<JamConfig>:{}
 const result={...defaults,seed:Number.isInteger(obj.seed)?Number(obj.seed)>>>0:defaults.seed,variation:obj.variation==='subtle'?'subtle':'fixed',style:['pop','funk','ambient','custom'].includes(obj.style??'')?obj.style:defaults.style,parts:{...defaults.parts}} as JamConfig
 for(const part of PARTS){
  const source=obj.parts?.[part];if(!source||typeof source!=='object')continue
  const p={...defaults.parts[part]}
  if(TIMBRES[part].some(([id])=>id===source.timbre))p.timbre=source.timbre
  if(PATTERNS[part].some(([id])=>id===source.pattern))p.pattern=source.pattern
  for(const [key,min,max] of [['density',0,1],['length',.15,2],['velocity',0,1],['approach',0,1],['spread',0,120]] as const)if(typeof source[key]==='number'&&Number.isFinite(source[key]))p[key]=Math.max(min,Math.min(max,source[key]))
  if([1,2,4].includes(source.hat))p.hat=source.hat
  if([0,4,8].includes(source.fill))p.fill=source.fill
  if([-12,0,12].includes(source.register))p.register=source.register
  if(['down','up','alternate'].includes(source.direction))p.direction=source.direction
  if(['up','down','bounce'].includes(source.arp))p.arp=source.arp
  if(Number.isInteger(source.seed))p.seed=source.seed>>>0
  p.locked=source.locked===true;result.parts[part]=p
 }
 return result
}

/** UI 状态（风格标签／锁定）不作为待播放声音差异。 */
export function soundSignature(config?:JamConfig){
 if(!config)return ''
 return JSON.stringify([config.seed,config.variation,PARTS.map(p=>{const {locked,...sound}=config.parts[p];void locked;return sound})])
}
