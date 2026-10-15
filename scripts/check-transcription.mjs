import assert from 'node:assert/strict'
import {createModuleLoader} from './load-ts.mjs'
const load=createModuleLoader(),{recognizeChunk}=await import(load('src/chordRecognition.ts')),{bpmDragValue}=await import(load('src/bpm.ts'))
const {ROOTS,mergeAnalysis,editSegment,splitSegment,joinSegment,readProject,matchesMedia,validRange}=await import(load('src/transcription.ts'))
const rate=11025
const signal=(notes,seconds=3)=>Float32Array.from({length:Math.ceil(rate*seconds)},(_,i)=>notes.reduce((v,n)=>v+.11*Math.sin(2*Math.PI*440*2**((n-69)/12)*i/rate),0))
for(let r=0;r<12;r++)for(const minor of [false,true]){const output=recognizeChunk(signal([48+r,48+r+(minor?3:4),55+r]),rate,0,3);assert.deepEqual(output.map(s=>s.label),[ROOTS[r]+(minor?'m':'')]);assert.equal(output[0].start,0);assert.equal(output[0].end,3)}
for(const notes of [[],[60]])assert.ok(recognizeChunk(signal(notes),rate,0,3).every(s=>s.label==='N'))
for(const notes of [[48,52,55,59],[48,49,52,55,58]])assert.ok(recognizeChunk(signal(notes),rate,0,3).every(s=>s.label==='?'))
let seed=12;const noise=Float32Array.from({length:rate*3},()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed/2**32-.5)*.3});assert.ok(recognizeChunk(noise,rate,0,3).every(s=>s.label==='N'))
const progression=new Float32Array(rate*12);[[48,52,55],[45,48,52],[41,45,48],[43,47,50]].forEach((ns,i)=>progression.set(signal(ns),i*3*rate));const found=recognizeChunk(progression,rate,0,12);for(const [i,label] of ['C','Am','F','G'].entries())assert.equal(found.find(s=>s.start<=i*3+1.5&&s.end>i*3+1.5).label,label)
const auto=[{id:'a',start:0,end:3,label:'C',source:'auto'},{id:'b',start:3,end:6,label:'Am',source:'auto'}]
const edited=editSegment(auto,'a',{label:'Cm'},6);assert.equal(edited[0].source,'manual');assert.throws(()=>editSegment(auto,'a',{end:4},6));assert.throws(()=>editSegment(auto,'a',{start:NaN},6))
const split=splitSegment(edited,'a',1.5);assert.equal(split.length,3);assert.ok(split.slice(0,2).every(s=>s.source==='manual'));assert.throws(()=>splitSegment(auto,'a',0));assert.equal(joinSegment(split,'a').length,2)
const merged=mergeAnalysis(edited,[{id:'x',start:0,end:6,label:'G',source:'auto'}],0,6);assert.equal(merged[0].label,'Cm');assert.equal(merged[0].source,'manual');assert.equal(merged[1].start,3)
const partial=mergeAnalysis(auto,[{id:'x',start:1,end:2,label:'D',source:'auto'}],1,2);assert.deepEqual(partial.map(s=>[s.start,s.end]),[[0,1],[1,2],[2,3],[3,6]])
assert.equal(bpmDragValue(120,-30,60,300),130);assert.equal(bpmDragValue(120,30,60,300),110);assert.equal(bpmDragValue(299,-3000,60,300),300);assert.equal(bpmDragValue(61,3000,60,300),60)
const identity={name:'a.wav',hash:'a'.repeat(64),size:123,sampled:false,duration:6},p={version:1,name:'test',media:identity,segments:edited,clips:[{id:'c',name:'riff',start:1,end:2}],rate:.5,volume:.8,originalBpm:'100',loop:true,gap:.5,selection:[1,2],zoom:3}
assert.deepEqual(readProject(JSON.parse(JSON.stringify(p))),p);assert.ok(matchesMedia(identity,{...identity,name:'renamed.wav'}));assert.equal(matchesMedia(identity,{...identity,hash:'b'}),false);assert.throws(()=>readProject({...p,version:2}));assert.throws(()=>readProject({...p,segments:[...edited,{...edited[0]}]}));assert.equal(readProject({...p,rate:30}).rate,1);assert.equal(validRange(2,1,6),false)
console.log('通过：24种合成三和弦、已知进行、静音/单音/噪声/七和弦/复杂混音、时间平滑、人工保护、边界/拆分/合并、项目往返/校验和BPM拖动范围')
