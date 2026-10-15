import { PARTS, PATTERNS, TIMBRES } from '../jamConfig'
import type { JamConfig, PartConfig } from '../jamConfig'
import type { JamPart } from '../jamArrangement'
import type { JamMixer } from '../jamAudio'
export default function JamParts({config,mixer,onPart,onMixer,onRegenerate}:{config:JamConfig;mixer:JamMixer;onPart:(part:JamPart,patch:Partial<PartConfig>)=>void;onMixer:(m:JamMixer)=>void;onRegenerate:(p:JamPart)=>void}){
 const label={drums:'鼓',bass:'贝斯',chords:config.parts.chords.timbre==='keys'?'和声 · 键盘／合成器':'吉他'}
 const range=(part:JamPart,key:keyof PartConfig,title:string,min:number,max:number,step:number)=> <label key={key}>{title}<input aria-label={`${label[part]}${title}`} type="range" min={min} max={max} step={step} value={Number(config.parts[part][key])} onChange={e=>onPart(part,{[key]:Number(e.target.value)})}/><output>{config.parts[part][key]}{key==='spread'?' ms':''}</output></label>
 const select=(part:JamPart,key:keyof PartConfig,title:string,options:readonly (readonly [string|number,string])[],numeric=false)=><label key={key}>{title}<select aria-label={`${label[part]}${title}`} value={String(config.parts[part][key])} onChange={e=>onPart(part,{[key]:numeric?Number(e.target.value):e.target.value})}>{options.map(([value,name])=><option key={value} value={value}>{name}</option>)}</select></label>
 return <section className="chord-card" aria-labelledby="jam-parts-title"><h2 id="jam-parts-title">声部编配</h2><label className="jam-master">主音量<input aria-label="主音量" type="range" min="0" max="100" value={Math.round(mixer.master*100)} onChange={e=>onMixer({...mixer,master:Number(e.target.value)/100})}/><output>{Math.round(mixer.master*100)}%</output></label>
 <div className="jam-parts">{PARTS.map(part=><details open key={part} className="jam-part"><summary>{label[part]} <span>{config.parts[part].locked?'已锁定':'可重新编配'}</span></summary><div className="jam-part-fields">
 <label>音量<input aria-label={`${part==='chords'?'和弦':label[part]}音量`} type="range" min="0" max="100" value={Math.round(mixer[part]*100)} onChange={e=>onMixer({...mixer,[part]:Number(e.target.value)/100})}/><output>{Math.round(mixer[part]*100)}%</output></label>
 <label><input aria-label={`静音${part==='chords'?'和弦':label[part]}`} type="checkbox" checked={mixer.muted[part]} onChange={e=>onMixer({...mixer,muted:{...mixer.muted,[part]:e.target.checked}})}/>静音</label>
 {select(part,'timbre','音色',TIMBRES[part])}{select(part,'pattern','节奏型',PATTERNS[part])}
 <label><input type="checkbox" checked={config.parts[part].locked} aria-label={`锁定${label[part]}声部`} onChange={e=>onPart(part,{locked:e.target.checked})}/>锁定声部</label>
 <button className="plain-button" disabled={config.parts[part].locked} onClick={()=>onRegenerate(part)}>重新生成{label[part]}</button>
 <details><summary>高级选项</summary><p className="jam-param-help">{part==='drums'?'密度保留底鼓／军鼓骨架；选十六分律动时默认设十六分踩镲，仍可单独修改。':'音长以拍计；长音节奏则为段落拍长的比例，末端截断，避免跨和弦拖音。'}</p>{range(part,'density','密度',0,1,.05)}
 {part==='drums'?<>{range(part,'velocity','力度变化',0,1,.05)}{select(part,'hat','踩镲细分',[[1,'四分'],[2,'八分'],[4,'十六分']],true)}{select(part,'fill','过门',[[0,'关闭'],[4,'每 4 小节'],[8,'每 8 小节']],true)}</>:<>{range(part,'length','音符长度',.15,2,.05)}{part==='bass'?<>{select(part,'register','音区',[[-12,'低八度'],[0,'标准'],[12,'高八度']],true)}{range(part,'approach','连接音',0,1,.05)}</>:<>{select(part,'direction','扫弦方向',[['down','下扫（6→1弦）'],['up','上扫（1→6弦）'],['alternate','交替']])}{range(part,'spread','扫弦展开',0,120,5)}{select(part,'arp','分解音型',[['up','上行'],['down','下行'],['bounce','往返']])}</>}</>}
 </details></div></details>)}</div></section>
}
