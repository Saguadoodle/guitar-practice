import { useState } from 'react'
import type { SavedJam } from '../jamStorage'
export default function JamLibrary({items,onSave,onLoad,onRename,onDelete}:{items:SavedJam[];onSave:(name:string)=>void;onLoad:(item:SavedJam)=>void;onRename:(id:string,name:string)=>void;onDelete:(id:string)=>void}){
 const [name,setName]=useState('我的伴奏')
 return <section className="chord-card jam-library"><h2>保存的伴奏</h2><div className="jam-library-save"><label>伴奏名称<input maxLength={80} aria-label="伴奏名称" value={name} onChange={e=>setName(e.target.value)}/></label><button className="plain-button" disabled={!name.trim()||items.length>=100} onClick={()=>onSave(name.trim())}>保存此伴奏</button></div>
 {!items.length?<p>还没有保存的伴奏。</p>:<ul>{items.map(item=><li key={item.id}><label className="sr-only" htmlFor={`saved-${item.id}`}>重命名 {item.name}</label><input id={`saved-${item.id}`} aria-label={`重命名 ${item.name}`} maxLength={80} value={item.name} onChange={e=>onRename(item.id,e.target.value)}/><button className="plain-button" onClick={()=>onLoad(item)}>加载</button><button className="plain-button" aria-label={`删除收藏 ${item.name}`} onClick={()=>onDelete(item.id)}>删除</button></li>)}</ul>}
 </section>
}
