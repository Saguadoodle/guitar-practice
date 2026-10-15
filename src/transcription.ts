import { buildChord } from './chords'
export type ChordLabel=string // 'N' 无明确和弦，'?' 不确定，其余 C / Cm 等。
export const ROOTS=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B']
export const LABELS=['?','N',...ROOTS.flatMap(r=>[r,r+'m'])]
export const labelText=(s:string)=>s==='N'?'无明确和弦':s==='?'?'不确定':s
export function labelChord(s:string){if(!LABELS.includes(s)||s==='N'||s==='?')return null;return buildChord(s.endsWith('m')?s.slice(0,-1):s,s.endsWith('m')?'minor':'major')}
export type ChordSegment={id:string;start:number;end:number;label:ChordLabel;source:'auto'|'manual'}
export type Clip={id:string;name:string;start:number;end:number}
export type MediaIdentity={name:string;size:number;hash:string;sampled:boolean;duration:number}
export type WorkProject={version:1;name:string;media:MediaIdentity;segments:ChordSegment[];clips:Clip[];rate:number;volume:number;originalBpm:string;loop:boolean;gap:number;selection:[number,number]|null;zoom:number}
export function validRange(start:number,end:number,duration:number){return Number.isFinite(start)&&Number.isFinite(end)&&start>=0&&end<=duration+.001&&end-start>=.05}
export function mergeAnalysis(old:ChordSegment[],fresh:ChordSegment[],start:number,end:number){
 const manual=old.filter(s=>s.source==='manual'),result=old.flatMap(s=>s.source==='manual'||s.end<=start||s.start>=end?[s]:[...(s.start<start?[{...s,id:s.id+'L',end:start}]:[]),...(s.end>end?[{...s,id:s.id+'R',start:end}]:[])])
 for(const segment of fresh){let pieces=[segment];for(const m of manual)pieces=pieces.flatMap(s=>s.end<=m.start||s.start>=m.end?[s]:[...(s.start<m.start?[{...s,id:s.id+'L',end:m.start}]:[]),...(s.end>m.end?[{...s,id:s.id+'R',start:m.end}]:[])]);result.push(...pieces.filter(s=>s.end-s.start>=.05))}
 return result.sort((a,b)=>a.start-b.start)
}
export function editSegment(segments:ChordSegment[],id:string,patch:Partial<ChordSegment>,duration:number){
 const next=segments.map(s=>s.id===id?{...s,...patch,id,source:'manual' as const}:s).sort((a,b)=>a.start-b.start)
 if(next.some((s,i)=>!LABELS.includes(s.label)||!validRange(s.start,s.end,duration)||i>0&&s.start<next[i-1].end-.001))throw Error('边界无效或与相邻片段重叠，请先调整相邻片段。')
 return next
}
export function splitSegment(segments:ChordSegment[],id:string,time:number){const s=segments.find(s=>s.id===id);if(!s||time<=s.start+.05||time>=s.end-.05)throw Error('拆分点需位于片段内部（离两端至少0.05秒）。');return segments.flatMap(s=>s.id===id?[{...s,end:time,source:'manual' as const},{...s,id:s.id+'-split-'+time,start:time,source:'manual' as const}]:[s])}
export function joinSegment(segments:ChordSegment[],id:string){const i=segments.findIndex(s=>s.id===id),a=segments[i],b=segments[i+1];if(!a||!b||Math.abs(a.end-b.start)>.05)throw Error('只能合并紧邻的片段。');return segments.flatMap((s,j)=>j===i?[{...a,end:b.end,source:'manual' as const}]:j===i+1?[]:[s])}
export function readProject(raw:unknown):WorkProject{
 if(!raw||typeof raw!=='object')throw Error('项目文件无效。')
 const p=raw as WorkProject
 if(p.version!==1||!p.media||typeof p.media.name!=='string'||!Number.isFinite(p.media.size)||p.media.size<0||typeof p.media.hash!=='string'||!/^[a-f0-9]{64}$/.test(p.media.hash)||!Number.isFinite(p.media.duration)||p.media.duration<=0||!Array.isArray(p.segments)||!Array.isArray(p.clips)||p.segments.length>20000||p.clips.length>500)throw Error('不支持的项目版本或缺少媒体信息。')
 const ids=new Set<string>();for(const s of p.segments){if(!s||typeof s.id!=='string'||ids.has(s.id)||!LABELS.includes(s.label)||!validRange(s.start,s.end,p.media.duration)||!['auto','manual'].includes(s.source))throw Error('和弦时间轴数据无效。');ids.add(s.id)}
 const segments=p.segments.map(s=>({id:s.id,start:s.start,end:s.end,label:s.label,source:s.source})).sort((a,b)=>a.start-b.start);if(segments.some((s,i)=>i>0&&s.start<segments[i-1].end-.001))throw Error('和弦段重叠。')
 if(p.clips.some(c=>!c||typeof c.id!=='string'||typeof c.name!=='string'||!validRange(c.start,c.end,p.media.duration)))throw Error('片段标记无效。')
 return {...p,media:{name:p.media.name.slice(0,300),size:p.media.size,hash:p.media.hash,sampled:p.media.sampled===true,duration:p.media.duration},name:typeof p.name==='string'?p.name.slice(0,80):'扒谱项目',segments,clips:p.clips.slice(0,500).map(c=>({id:c.id,name:c.name.slice(0,80),start:c.start,end:c.end})),rate:Number.isFinite(p.rate)&&p.rate>=.25&&p.rate<=2?p.rate:1,volume:Number.isFinite(p.volume)?Math.max(0,Math.min(1,p.volume)): .8,originalBpm:typeof p.originalBpm==='string'&&/^\d+(\.\d+)?$/.test(p.originalBpm)&&Number(p.originalBpm)>=20&&Number(p.originalBpm)<=400?p.originalBpm:'',loop:p.loop===true,gap:Number.isFinite(p.gap)?Math.max(0,Math.min(10,p.gap)):0,selection:Array.isArray(p.selection)&&p.selection.length===2&&validRange(p.selection[0],p.selection[1],p.media.duration)?[p.selection[0],p.selection[1]]:null,zoom:Number.isFinite(p.zoom)?Math.max(1,Math.min(20,p.zoom)):1}
}
export async function identifyFile(file:File,duration:number):Promise<MediaIdentity>{
 const sampled=file.size>128*1024*1024
 const bytes=sampled?await new Blob([file.slice(0,1024*1024),file.slice(-1024*1024),String(file.size)]).arrayBuffer():await file.arrayBuffer()
 if(!crypto.subtle)throw Error('当前环境无法校验文件；请使用 localhost 或 HTTPS。')
 const digest=await crypto.subtle.digest('SHA-256',bytes)
 return {name:file.name,size:file.size,hash:Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join(''),sampled,duration}
}
export function matchesMedia(a:MediaIdentity,b:MediaIdentity){return a.size===b.size&&a.hash===b.hash&&Math.abs(a.duration-b.duration)<.1}
