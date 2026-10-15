import { CHORD_TYPES, CHORD_CATEGORIES } from '../chords'
import { NOTE_OPTIONS } from '../pitch'
import { analyzeJamCard, chordTypeName } from '../jam'
import type { JamCard, JamMode } from '../jam'
export default function JamProgressionEditor({cards,root,mode,currentId,onChange,onAdd,onCopy}:{cards:JamCard[];root:string;mode:JamMode;currentId?:string;onChange:(cards:JamCard[])=>void;onAdd:()=>void;onCopy:(index:number)=>void}){
 const update=(index:number,patch:Partial<JamCard>)=>onChange(cards.map((c,i)=>i===index?{...c,...patch}:c))
 const move=(index:number,direction:number)=>{const next=[...cards];[next[index],next[index+direction]]=[next[index+direction],next[index]];onChange(next)}
 return <section className="chord-card" aria-labelledby="jam-editor-title"><div className="jam-section-heading"><h2 id="jam-editor-title">和弦进行</h2><button className="plain-button" disabled={cards.length>=32} onClick={onAdd}>增加和弦</button></div>
  <div className="jam-cards">{cards.map((card,index)=>{const analysis=analyzeJamCard(card,root,mode);return <article className={`jam-card ${card.id===currentId?'jam-card-current':''}`} key={card.id} aria-label={`和弦卡片 ${index+1}`} aria-current={card.id===currentId?'true':undefined}>
   <div className="jam-card-heading"><strong>{index+1}. {analysis.name}</strong><span>{analysis.roman??analysis.note}</span></div>
   <label>根音<select aria-label={`和弦 ${index+1} 根音`} value={card.root} onChange={e=>update(index,{root:e.target.value})}>{NOTE_OPTIONS.map(note=><option key={note}>{note}</option>)}</select></label>
   <label>类型<select aria-label={`和弦 ${index+1} 类型`} value={card.type} onChange={e=>update(index,{type:e.target.value as JamCard['type']})}>{CHORD_CATEGORIES.map(category=><optgroup label={category} key={category}>{CHORD_TYPES.filter(t=>t.category===category).map(type=><option value={type.id} key={type.id}>{chordTypeName(type)}</option>)}</optgroup>)}</select></label>
   <label>时长<select aria-label={`和弦 ${index+1} 时长`} value={card.beats} onChange={e=>update(index,{beats:Number(e.target.value) as JamCard['beats']})}><option value="2">半小节 · 2 拍</option><option value="4">一小节 · 4 拍</option><option value="8">两小节 · 8 拍</option></select></label>
   <label className="jam-lock"><input type="checkbox" aria-label={`锁定和弦 ${index+1}`} checked={!!card.locked} onChange={e=>update(index,{locked:e.target.checked})}/>锁定此卡片（生成时保留）</label><div className="jam-card-actions"><button aria-label={`上移和弦 ${index+1}`} disabled={index===0} onClick={()=>move(index,-1)}>↑</button><button aria-label={`下移和弦 ${index+1}`} disabled={index===cards.length-1} onClick={()=>move(index,1)}>↓</button><button disabled={cards.length>=32} onClick={()=>onCopy(index)} aria-label={`复制和弦 ${index+1}`}>复制</button><button onClick={()=>onChange(cards.filter((_,i)=>i!==index))} aria-label={`删除和弦 ${index+1}`}>删除</button></div>
  </article>})}</div>
 </section>
}
