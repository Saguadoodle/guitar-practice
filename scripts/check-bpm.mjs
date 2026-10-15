import assert from'node:assert/strict'
import{createModuleLoader,dataUrl}from'./load-ts.mjs'
let slots=[],cursor=0,cleanup=[];globalThis.__bpmHooks={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>slots[i]=v]},useRef(initial){const i=cursor++;return slots[i]??=( {current:initial})},useEffect(fn){cleanup.push(fn())}}
const hook=dataUrl('export const {useState,useRef,useEffect}=globalThis.__bpmHooks'),load=createModuleLoader({react:hook}),{default:BpmInput}=await import(load('src/components/BpmInput.tsx'))
const listeners=new Map();globalThis.window={addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)}
let value='120',capture=null,prevented=0,blurred=0
const element={setPointerCapture:id=>capture=id,hasPointerCapture:id=>capture===id,releasePointerCapture:()=>capture=null,focus(){},select(){},blur(){blurred++}}
const render=()=>{cursor=0;const tree=BpmInput({value,onValue:v=>value=v,min:60,max:300,label:'test'});const input=tree.props.children[0];input.props.ref.current=element;return input.props}
const event=(y,id=1)=>({button:0,pointerId:id,clientY:y,currentTarget:element,preventDefault(){prevented++}})
let p=render();p.onPointerDown(event(100));p.onPointerMove(event(70));assert.equal(value,'130');p.onPointerUp(event(70));assert.equal(capture,null)
p=render();p.onPointerDown(event(100));p.onPointerMove(event(101));p.onPointerUp(event(101));p=render();assert.equal(p.readOnly,false);p.onChange({target:{value:''}});assert.equal(value,'');p.onBlur();p=render();assert.equal(p['aria-invalid'],true)
p.onKeyDown({key:'ArrowUp',preventDefault(){},currentTarget:element});assert.equal(value,'61');p=render();p.onPointerDown(event(100));p.onPointerCancel();p.onPointerMove(event(0));assert.equal(value,'61')
p=render();p.onPointerDown(event(100));listeners.get('blur')();assert.equal(capture,null);p.onPointerMove(event(0));assert.equal(value,'61');p.onLostPointerCapture();p.onKeyDown({key:'Enter',currentTarget:element});assert.ok(blurred);assert.ok(prevented);cleanup.forEach(c=>c?.());console.log('通过：共享BPM鼠标/触控Pointer事件、点击编辑/拖动阈值、方向键、非法输入、取消/失焦/失去捕获清理')
