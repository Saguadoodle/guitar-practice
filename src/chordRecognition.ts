import { ROOTS } from './transcription'
import type { ChordSegment } from './transcription'
/** 原创 radix-2 FFT；只依赖 JS，不加载模型、远程素材或第三方 DSP。 */
export function spectrum(signal:Float32Array,offset:number,size=8192){
 const re=new Float64Array(size),im=new Float64Array(size)
 for(let i=0;i<size;i++)re[i]=(signal[offset+i]??0)*(.5-.5*Math.cos(2*Math.PI*i/(size-1)))
 for(let i=1,j=0;i<size;i++){let bit=size>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j)[re[i],re[j]]=[re[j],re[i]]}
 for(let len=2;len<=size;len<<=1){const angle=-2*Math.PI/len;for(let i=0;i<size;i+=len){for(let j=0;j<len/2;j++){const c=Math.cos(angle*j),s=Math.sin(angle*j),k=i+j,h=k+len/2,tr=re[h]*c-im[h]*s,ti=re[h]*s+im[h]*c;re[h]=re[k]-tr;im[h]=im[k]-ti;re[k]+=tr;im[k]+=ti}}}
 return Float64Array.from(re.slice(0,size/2),(v,i)=>Math.hypot(v,im[i]))
}
export function classifyFrame(signal:Float32Array,offset:number,rate:number){
 let energy=0;for(let i=0;i<8192;i++)energy+=(signal[offset+i]??0)**2
 if(Math.sqrt(energy/8192)<.001)return 'N'
 const mag=spectrum(signal,offset),chroma=new Float64Array(12),peaks:{f:number;a:number}[]=[]
 let sum=0,log=0,count=0
 for(let k=Math.ceil(65*8192/rate);k<Math.min(mag.length-1,Math.floor(2000*8192/rate));k++){
  sum+=mag[k]**2;log+=Math.log(mag[k]**2+1e-12);count++
  if(mag[k]>mag[k-1]&&mag[k]>=mag[k+1]){const shift=.5*(mag[k-1]-mag[k+1])/(mag[k-1]-2*mag[k]+mag[k+1]);peaks.push({f:(k+Math.max(-.5,Math.min(.5,shift)))*rate/8192,a:mag[k]})}
 }
 if(Math.exp(log/count)/(sum/count+1e-12)>.18)return 'N'
 const maximum=Math.max(...peaks.map(p=>p.a),0)
 for(const p of peaks){if(p.a<maximum*.04)continue;const midi=69+12*Math.log2(p.f/440),rounded=Math.round(midi);if(Math.abs(midi-rounded)>.35)continue
  const harmonic=peaks.some(lower=>lower.f<p.f*.6&&lower.a>p.a*.18&&[2,3,4,5,6].some(h=>Math.abs(12*Math.log2(p.f/(lower.f*h)))<.24))
  chroma[(rounded%12+12)%12]+=p.a*(harmonic?.06:1)
 }
 const total=chroma.reduce((a,b)=>a+b,0),top=Math.max(...chroma)
 if(!total||[...chroma].filter(v=>v>top*.16).length<3)return 'N'
 const scores=ROOTS.flatMap((root,r)=>[false,true].map(minor=>{const values=[chroma[r],chroma[(r+(minor?3:4))%12],chroma[(r+7)%12]];return {label:root+(minor?'m':''),coverage:values.reduce((a,b)=>a+b,0)/total,minimum:Math.min(...values)/total}})).sort((a,b)=>b.coverage-a.coverage)
 const best=scores[0];return best.coverage>=.82&&best.minimum>=.055&&best.coverage-scores[1].coverage>=.085?best.label:'?'
}
export function recognizeChunk(samples:Float32Array,rate:number,start:number,duration:number):ChordSegment[]{
 const hop=Math.round(rate*.2),frames=Math.max(1,Math.ceil(duration/.2)),labels:string[]=[]
 for(let i=0;i<frames;i++)labels.push(classifyFrame(samples,Math.max(0,i*hop-4096),rate))
 // 局部多数平滑，不允许强势邻帧抹掉无声区。
 const smooth=labels.map((label,i)=>{if(label==='N')return label;const neighbors=labels.slice(Math.max(0,i-1),i+2);return neighbors.find(l=>neighbors.filter(n=>n===l).length>=2)??'?'})
 const segments:ChordSegment[]=[]
 smooth.forEach((label,i)=>{const end=start+Math.min(duration,(i+1)*.2),last=segments.at(-1);if(last?.label===label)last.end=end;else segments.push({id:`auto-${start.toFixed(4)}-${i}`,start:start+i*.2,end,label,source:'auto'})})
 return segments.filter(s=>s.end>s.start)
}
