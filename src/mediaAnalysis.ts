import type { ChordSegment } from './transcription'
export type DecodedMedia={samples:Float32Array;rate:number;duration:number;peaks:Float32Array}
export class MediaAnalysis{
 private makeWorker:()=>Worker
 constructor(factory:()=>Worker=()=>new Worker(new URL('./analysis.worker.ts',import.meta.url),{type:'module'})){this.makeWorker=factory}
 private generation=0;private worker:Worker|null=null;private context:AudioContext|null=null;private reject:((error:Error)=>void)|null=null
 cancel(){++this.generation;this.worker?.terminate();this.worker=null;this.reject?.(new Error('分析已取消'));this.reject=null;void this.context?.close().catch(()=>{});this.context=null}
 async decode(file:File,duration:number):Promise<DecodedMedia>{
  this.cancel();const token=this.generation
  if(file.size>128*1024*1024)throw Error('文件超过128 MiB：仍可播放；本版不解码波形／识别。请先裁剪或转为较小音频。')
  if(duration>1800)throw Error('超过30分钟：仍可播放；请先裁剪后解码分析。')
  const Context=window.AudioContext
  if(!Context)throw Error('浏览器不支持 Web Audio：可尝试播放，但无法解码分析。')
  let context:AudioContext;try{context=new Context({sampleRate:11025})}catch{context=new Context()}
  this.context=context
  if(duration*context.sampleRate*2*4>256*1024*1024){await context.close().catch(()=>{});this.context=null;throw Error('预计解码内存超过256 MiB预算，请裁剪文件。')}
  try{
   const buffer=await context.decodeAudioData(await file.arrayBuffer())
   if(token!==this.generation)throw Error('分析已取消')
   if(buffer.length*buffer.numberOfChannels*4>256*1024*1024)throw Error('解码数据超过256 MiB内存预算，请裁剪文件。')
   const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i)),samples=new Float32Array(buffer.length)
   for(let start=0;start<samples.length;start+=131072){if(token!==this.generation)throw Error('分析已取消');for(let i=start;i<Math.min(samples.length,start+131072);i++){for(const channel of channels)samples[i]+=channel[i]/channels.length}await new Promise(r=>setTimeout(r,0))}
   const count=Math.min(6000,samples.length),peaks=new Float32Array(count*2),size=Math.ceil(samples.length/count)
   for(let p=0;p<count;p++){let min=0,max=0;for(let i=p*size;i<Math.min(samples.length,(p+1)*size);i++){min=Math.min(min,samples[i]);max=Math.max(max,samples[i])}peaks[p*2]=min;peaks[p*2+1]=max}
   return {samples,rate:buffer.sampleRate,duration:buffer.duration,peaks}
  }catch(error){if(token!==this.generation)throw new Error('分析已取消',{cause:error});throw new Error(error instanceof Error&&error.message.includes('预算')?error.message:'可播放不等于可分析：浏览器无法解码此容器／音轨，或资源不足。可转为 PCM WAV、MP3 后重试。',{cause:error})}
  finally{await context.close().catch(()=>{});if(this.context===context)this.context=null}
 }
 async analyze(decoded:DecodedMedia,start:number,end:number,onProgress:(p:number)=>void):Promise<ChordSegment[]>{
  this.cancel();const token=this.generation,worker=this.makeWorker();this.worker=worker
  const result:ChordSegment[]=[]
  try{for(let cursor=start;cursor<end;cursor+=30){
   if(token!==this.generation)throw Error('分析已取消')
   const duration=Math.min(30,end-cursor),samples=decoded.samples.slice(Math.round(cursor*decoded.rate),Math.ceil((cursor+duration)*decoded.rate)+8192)
   const segments=await new Promise<ChordSegment[]>((resolve,reject)=>{this.reject=reject;worker.onmessage=e=>e.data.error?reject(Error(e.data.error)):resolve(e.data.segments);worker.onerror=()=>reject(Error('分析Worker无法运行，请检查浏览器及站点资源加载。'));worker.postMessage({samples,rate:decoded.rate,start:cursor,duration},[samples.buffer])})
   for(const s of segments){const last=result.at(-1);if(last&&last.label===s.label&&Math.abs(last.end-s.start)<.01)last.end=s.end;else result.push(s)}onProgress(Math.min(1,(cursor+duration-start)/(end-start)))
  }return result}
  finally{worker.terminate();if(this.worker===worker){this.worker=null;this.reject=null}}
 }
}
