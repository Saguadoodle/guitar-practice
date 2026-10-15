import { useEffect, useRef, useState } from 'react'
import { bpmDragValue } from '../bpm'
export default function BpmInput({value,onValue,min=60,max=300,label,describedBy}:{value:string;onValue:(value:string)=>void;min?:number;max?:number;label:string;describedBy?:string}){
 const [editing,setEditing]=useState(false),input=useRef<HTMLInputElement|null>(null)
 const gesture=useRef<{id:number;y:number;base:number;dragged:boolean}|null>(null)
 const finish=()=>{const g=gesture.current;gesture.current=null;if(g&&input.current?.hasPointerCapture?.(g.id))input.current.releasePointerCapture(g.id);return g}
 useEffect(()=>{const cancel=()=>{const g=gesture.current;gesture.current=null;if(g&&input.current?.hasPointerCapture?.(g.id))input.current.releasePointerCapture(g.id);input.current?.blur();setEditing(false)};window.addEventListener('blur',cancel);return()=>{cancel();window.removeEventListener('blur',cancel)}},[])
 const valid=value.trim()!==''&&Number.isFinite(Number(value))&&Number(value)>=min&&Number(value)<=max
 return <span className="bpm-control"><input ref={input} type="number" inputMode="decimal" aria-label={label} aria-describedby={describedBy} aria-invalid={!valid} min={min} max={max} step="1" value={value} readOnly={!editing} data-editing={editing} onChange={e=>onValue(e.target.value)}
 onFocus={()=>setEditing(true)} onBlur={()=>{finish();setEditing(false)}}
 onKeyDown={e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();onValue(String(Math.max(min,Math.min(max,(valid?Number(value):min)+(e.key==='ArrowUp'?1:-1)))))}else if(e.key==='Enter'||e.key==='Escape'){finish();setEditing(false);e.currentTarget.blur()}}}
 onPointerDown={e=>{if(e.button!==0||editing)return;e.preventDefault();gesture.current={id:e.pointerId,y:e.clientY,base:valid?Number(value):min,dragged:false};e.currentTarget.setPointerCapture(e.pointerId)}}
 onPointerMove={e=>{const g=gesture.current;if(!g||g.id!==e.pointerId)return;if(Math.abs(e.clientY-g.y)>=6)g.dragged=true;if(g.dragged){e.preventDefault();onValue(String(bpmDragValue(g.base,e.clientY-g.y,min,max)))}}}
 onPointerUp={e=>{if(gesture.current?.id!==e.pointerId)return;const g=finish();if(g&&!g.dragged){setEditing(true);input.current?.focus();input.current?.select()}}}
 onPointerCancel={()=>finish()} onLostPointerCapture={()=>{gesture.current=null}}/>
 <small>上下拖动 · 点击输入</small></span>
}
