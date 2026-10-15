import { midiToFrequency } from './audio'
/** 浏览器内基础合成；音色参数改变谐波、起音与衰减，不使用外部采样。 */
export function pitchedJamSamples(midi:number,rate:number,duration:number,timbre:string){
 const samples=new Float32Array(Math.ceil(rate*duration)),frequency=midiToFrequency(midi)
 const bass=['round','pick','synth'].includes(timbre)
 const settings:Record<string,number[]>={round:[1,.25,.08],pick:[1,.6,.35,.18,.1],synth:[1,.5,.33,.25,.2,.16],bright:[1,.65,.4,.24,.15,.1],soft:[1,.2,.09,.03],palm:[1,.4,.2,.08],keys:[1,.35,.2,.12]}
 const partials=settings[timbre]??settings.keys,norm=partials.reduce((a,b)=>a+b,0)
 for(let i=0;i<samples.length;i++){
  const t=i/rate,attack=Math.min(1,t/(timbre==='soft'?.015:.003)),release=Math.min(1,(duration-t)/Math.min(.04,duration*.25))
  const decay=timbre==='palm'?Math.exp(-t*20):timbre==='keys'?.75+.25*Math.exp(-t*3):timbre==='synth'?.8+.2*Math.exp(-t*5):Math.exp(-t*(bass?2:3))
  let value=0;for(let h=0;h<partials.length;h++)if(frequency*(h+1)<rate*.45)value+=partials[h]*Math.sin(2*Math.PI*frequency*(h+1)*t)
  samples[i]=value/norm*(bass?.24:.2)*attack*release*decay
 }
 return samples
}
