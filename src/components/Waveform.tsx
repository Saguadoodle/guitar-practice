import { useRef } from 'react'
export default function Waveform({peaks,duration,time,selection,zoom,onSeek,onSelection}:{peaks:Float32Array;duration:number;time:number;selection:[number,number]|null;zoom:number;onSeek:(t:number)=>void;onSelection:(r:[number,number])=>void}){
 const gesture=useRef<{x:number;time:number}|null>(null)
 const at=(x:number,rect:DOMRect)=>Math.max(0,Math.min(duration,(x-rect.left)/rect.width*duration))
 const path=Array.from({length:peaks.length/2},(_,i)=>{const x=i/(peaks.length/2)*1000;return `M${x.toFixed(2)},${(50-peaks[i*2]*46).toFixed(2)}V${(50-peaks[i*2+1]*46).toFixed(2)}`}).join('')
 return <div className="wave-scroll"><div className="wave-track" style={{width:`${zoom*100}%`}}><svg role="img" aria-label="原始时间波形，拖动选择A–B，点击定位" viewBox="0 0 1000 100" preserveAspectRatio="none" tabIndex={0}
 onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();onSeek(time+(e.key==='ArrowLeft'?-.1:.1))}}}
 onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);gesture.current={x:e.clientX,time:at(e.clientX,e.currentTarget.getBoundingClientRect())}}}
 onPointerUp={e=>{const g=gesture.current;gesture.current=null;if(!g)return;const end=at(e.clientX,e.currentTarget.getBoundingClientRect());if(Math.abs(e.clientX-g.x)<5)onSeek(end);else{const range:[number,number]=[Math.min(g.time,end),Math.max(g.time,end)];if(range[1]-range[0]>=.05)onSelection(range)}if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}} onPointerCancel={()=>{gesture.current=null}} onLostPointerCapture={()=>{gesture.current=null}}>
 <path d={path} className="wave-peaks"/>{selection&&<rect x={selection[0]/duration*1000} width={(selection[1]-selection[0])/duration*1000} y="0" height="100" className="wave-selection"/>}<line x1={time/duration*1000} x2={time/duration*1000} y1="0" y2="100" className="wave-playhead"/></svg><span className="wave-times">0 s <span>{duration.toFixed(2)} s（原始媒体时间）</span></span></div></div>
}
