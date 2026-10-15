import { recognizeChunk } from './chordRecognition'
self.onmessage=(event:MessageEvent<{samples:Float32Array;rate:number;start:number;duration:number}>)=>{
 try{const {samples,rate,start,duration}=event.data;self.postMessage({segments:recognizeChunk(samples,rate,start,duration)})}catch(error){self.postMessage({error:error instanceof Error?error.message:'分析失败'})}
}
