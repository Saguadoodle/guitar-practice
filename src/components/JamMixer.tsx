import type { JamMixer as Mixer } from '../jamAudio'
export default function JamMixer({value,onChange}:{value:Mixer;onChange:(value:Mixer)=>void}){
 return <section className="chord-card" aria-labelledby="jam-mixer-title"><h2 id="jam-mixer-title">声部与音量</h2><div className="jam-mixer">{([['master','主音量'],['drums','鼓'],['bass','贝斯'],['chords','和弦']] as const).map(([part,label])=><div className="jam-mixer-channel" key={part}>
  <label>{label}<input type="range" aria-label={part==='master'?'主音量':`${label}音量`} min="0" max="100" value={Math.round(value[part]*100)} onChange={e=>onChange({...value,[part]:Number(e.target.value)/100})}/><output>{Math.round(value[part]*100)}%</output></label>
  {part!=='master'&&<label className="jam-mute"><input type="checkbox" aria-label={`静音${label}`} checked={value.muted[part]} onChange={e=>onChange({...value,muted:{...value.muted,[part]:e.target.checked}})}/>静音</label>}
 </div>)}</div></section>
}
