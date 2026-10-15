import assert from'node:assert/strict'
import{createModuleLoader}from'./load-ts.mjs'
const{MediaAnalysis}=await import(createModuleLoader()('src/mediaAnalysis.ts'))
let workers=[]
class WorkerMock{constructor(){this.terminated=false;workers.push(this)}postMessage(message){this.message=message;if(!globalThis.holdAnalysis)queueMicrotask(()=>this.onmessage?.({data:{segments:[{id:String(message.start),label:'C',source:'auto',start:message.start,end:message.start+message.duration}]}}))}terminate(){this.terminated=true}}
const manager=new MediaAnalysis(()=>new WorkerMock()),decoded={samples:new Float32Array(11025*65),rate:11025,duration:65,peaks:new Float32Array()},progress=[]
const result=await manager.analyze(decoded,2,64,p=>progress.push(p));assert.equal(result.length,1);assert.equal(result[0].start,2);assert.equal(result[0].end,64);assert.equal(progress.at(-1),1);assert.equal(progress.length,3);assert.equal(workers[0].terminated,true)
globalThis.holdAnalysis=true;const cancelled=manager.analyze(decoded,0,65,()=>{});manager.cancel();await assert.rejects(cancelled,/取消/);assert.equal(workers.at(-1).terminated,true);globalThis.holdAnalysis=false
let closeCount=0,releaseDecode
const pendingBuffer=new Promise(r=>releaseDecode=r)
globalThis.window={AudioContext:class{sampleRate=11025;async decodeAudioData(){return await pendingBuffer}async close(){closeCount++}}}
const fakeFile={size:100,arrayBuffer:async()=>new ArrayBuffer(1)}
const pending=manager.decode(fakeFile,3);manager.cancel();releaseDecode({length:100,numberOfChannels:1,sampleRate:11025,duration:1,getChannelData:()=>new Float32Array(100)});await assert.rejects(pending,/取消/);assert.ok(closeCount>=1)
await assert.rejects(manager.decode({...fakeFile,size:129*1024*1024},30),/128/);await assert.rejects(manager.decode(fakeFile,1801),/30分钟/)
console.log('通过：原始选区坐标、30秒分段/进度、合并边缘、Worker取消/终止、解码取消与资源预算')
