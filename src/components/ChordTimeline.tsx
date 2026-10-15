import { useState } from 'react'
import { LABELS,labelText,editSegment,splitSegment,joinSegment,labelChord } from '../transcription'
import type { ChordSegment } from '../transcription'
import { generateFingerings, fingeringPitches } from '../fingerings'
import type { Tuning } from '../pitch'
import FingeringDiagram from './FingeringDiagram'
function Row({s,current,time,duration,onChange,onSeek,segments,onError}:{s:ChordSegment;current:boolean;time:number;duration:number;onChange:(s:ChordSegment[])=>void;onSeek:(s:ChordSegment)=>void;segments:ChordSegment[];onError:(m:string)=>void}){
 const [start,setStart]=useState(String(s.start.toFixed(2))),[end,setEnd]=useState(String(s.end.toFixed(2)))
 const attempt=(action:()=>ChordSegment[])=>{try{onChange(action());onError('')}catch(e){onError(e instanceof Error?e.message:'修改失败')}}
 return <article className={`trans-segment ${current?'trans-current':''}`} aria-label={`和弦段 ${s.start.toFixed(2)}秒`}><button className="plain-button" onClick={()=>onSeek(s)} aria-label={`跳转 ${labelText(s.label)} ${s.start.toFixed(2)}秒`}>{labelText(s.label)} · {s.source==='manual'?'人工修订':'自动结果'}</button>
 <label>和弦<select aria-label={`修改 ${s.id} 和弦`} value={s.label} onChange={e=>attempt(()=>editSegment(segments,s.id,{label:e.target.value},duration))}>{LABELS.map(label=><option key={label} value={label}>{labelText(label)}</option>)}</select></label>
 <label>起点（秒）<input type="number" step="0.01" min="0" max={duration} value={start} onChange={e=>setStart(e.target.value)} onBlur={()=>{const n=start.trim()?Number(start):NaN;if(!Number.isFinite(n)||Math.abs(n-s.start)>1e-6)attempt(()=>editSegment(segments,s.id,{start:n},duration))}}/></label>
 <label>终点（秒）<input type="number" step="0.01" min="0" max={duration} value={end} onChange={e=>setEnd(e.target.value)} onBlur={()=>{const n=end.trim()?Number(end):NaN;if(!Number.isFinite(n)||Math.abs(n-s.end)>1e-6)attempt(()=>editSegment(segments,s.id,{end:n},duration))}}/></label>
 <button className="plain-button" onClick={()=>attempt(()=>splitSegment(segments,s.id,time))}>在播放头拆分</button><button className="plain-button" onClick={()=>attempt(()=>joinSegment(segments,s.id))}>与下一段合并（保留本和弦）</button></article>
}
export default function ChordTimeline({segments,time,duration,tuning,onChange,onSeek,onError,onPreview}:{segments:ChordSegment[];time:number;duration:number;tuning:Tuning;onChange:(s:ChordSegment[])=>void;onSeek:(s:ChordSegment)=>void;onError:(m:string)=>void;onPreview:(p:ReturnType<typeof fingeringPitches>)=>void}){
 const [limit,setLimit]=useState(40),[selected,setSelected]=useState<string|null>(null)
 const current=segments.find(s=>s.start<=time&&s.end>time),chosen=segments.find(s=>s.id===selected)??current
 const visible=segments.slice(0,limit),shown=current&&!visible.includes(current)?[current,...visible]:visible
 const chord=chosen?labelChord(chosen.label):null,shapes=chord?generateFingerings(chord,tuning).slice(0,3):[]
 return <section className="chord-card"><h2>和弦时间轴</h2><p aria-live="polite">当前：{current?labelText(current.label):'未分析'} · {segments.length} 段</p><p>仅自动估计大／小三和弦，不确定结果请人工核对。重新分析会保护人工修订；合并采用左段名称。</p>
 {!segments.length&&<p>选择可解码媒体后，点击分析生成真实结果。</p>}
 <div className="trans-timeline">{shown.map(s=><Row key={`${s.id}:${s.start}:${s.end}`} s={s} current={s.id===current?.id} time={time} duration={duration} segments={segments} onChange={onChange} onSeek={s=>{setSelected(s.id);onSeek(s)}} onError={onError}/>)}</div>
 {segments.length>limit&&<button className="plain-button" onClick={()=>setLimit(limit+40)}>加载更多（{limit}/{segments.length}）</button>}
 {chord&&<div><h3>{chord.name} 常用指型建议</h3><p>基于当前调弦，不代表原曲实际按法。</p><div className="trans-shapes">{shapes.map(shape=><button className="fingering-card" key={shape.id} onClick={()=>onPreview(fingeringPitches(shape,tuning,chord))} aria-label={`试听 ${chord.name} 指型 ${shape.templateLabel}`}><FingeringDiagram shape={shape} chord={chord} tuning={tuning}/><span>{shape.templateLabel}</span></button>)}</div>{!shapes.length&&<p>当前调弦暂无已验证常用指型。</p>}</div>}
 </section>
}
