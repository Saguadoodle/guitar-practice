import assert from'node:assert/strict'
import{createModuleLoader}from'./load-ts.mjs'
const{LoopTransport}=await import(createModuleLoader()('src/LoopTransport.ts'))
let frames=new Map(),timers=new Map(),id=0,now=0
const old={requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout}
globalThis.requestAnimationFrame=f=>{frames.set(++id,f);return id};globalThis.cancelAnimationFrame=i=>frames.delete(i);globalThis.setTimeout=(f,ms)=>{timers.set(++id,{f,at:now+ms/1000});return id};globalThis.clearTimeout=i=>timers.delete(i)
const updates=[],errors=[];let plays=0,pauses=0,wake=null
const m={currentTime:0,duration:12,ended:false,paused:true,playbackRate:1,preservesPitch:false,async play(){plays++;if(wake)await wake;this.paused=false},pause(){pauses++;this.paused=true},removeAttribute(){this.src=null},load(){}}
const flush=async()=>{for(let i=0;i<5;i++)await Promise.resolve()}
async function advance(seconds){for(let i=0;i<Math.ceil(seconds*100);i++){now+=.01;if(!m.paused){m.currentTime+=.01*m.playbackRate;if(m.currentTime>=m.duration)m.ended=true}const current=[...frames.values()];frames.clear();current.forEach(f=>f());for(const[k,t]of timers)if(t.at<=now){timers.delete(k);t.f()}await flush()}}
try{
 const player=new LoopTransport(m,(time,p)=>updates.push({time,p}),(s)=>errors.push(s))
 for(const rate of [.25,.5,.75,1,2]){player.setRate(rate);assert.equal(m.preservesPitch,true);assert.equal(m.playbackRate,rate)}assert.throws(()=>player.setRate(0));assert.throws(()=>player.setRate(NaN))
 for(const gap of [0,.2,1]){m.currentTime=0;m.ended=false;player.configure({enabled:true,range:[1,2],gap});await player.play();await advance(10);assert.ok(updates.filter(v=>v.p).every(v=>v.time>=1&&v.time<=2.03));assert.ok(frames.size+timers.size<=1);player.stop();assert.equal(frames.size+timers.size,0);updates.length=0}
 await player.play();await advance(.3);player.configure({enabled:false,range:null,gap:0});player.seek(11.9);await advance(.2);assert.equal(updates.at(-1).p,false);assert.equal(frames.size,0)
 m.currentTime=0;m.ended=false;for(let i=0;i<100;i++){await player.play();player.stop();assert.equal(frames.size+timers.size,0)}
 let resolve;wake=new Promise(r=>resolve=r);const stale=player.play();player.stop();const fresh=player.play();resolve();await stale;await fresh;wake=null;assert.equal(m.paused,false);assert.equal(frames.size,1);player.stop();assert.equal(frames.size+timers.size,0)
 delete m.preservesPitch;assert.throws(()=>player.setRate(.5));player.setRate(1);player.dispose();assert.equal(frames.size+timers.size,0);assert.ok(pauses>0&&plays>0);console.log('通过：单媒体时钟、0.25/0.5/0.75/1/2倍率、A–B/间隔/清除、结束、100次启停、异步播放竞争、释放与不支持保调反馈')
}finally{Object.assign(globalThis,old)}
