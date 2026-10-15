import { useEffect, useMemo, useRef, useState } from 'react'
import { buildScale, EXPLORER_SCALES, scalePlayback, scaleToneAt, stablePitchClasses } from '../scales'
import { ScalePlayer } from '../scaleAudio'
import { validBpm } from '../scaleRhythm'
import { toRoman } from '../intervals'
import { getPitch, MAX_FRET, NOTE_OPTIONS } from '../pitch'
import type { SharedSettings } from '../useAppSettings'
type PlaybackMode='up'|'down'|'both'|'random'
const FRETS = Array.from({length:MAX_FRET+1},(_,i)=>i)
export default function ScalesPage({shared,active}: {shared:SharedSettings;active:boolean}) {
  const {tuning,soundEnabled} = shared.preferences
  const [root,setRoot] = useState('C'), [id,setId] = useState('major')
  const [display,setDisplay] = useState('degree'), [bpm,setBpm] = useState(120)
  const [tempoInput,setTempoInput] = useState('120')
  const tempoValid = validBpm(tempoInput) !== null
  const [mode,setMode] = useState<{key:string;value:PlaybackMode|null}>({key:'',value:null})
  const scale = useMemo(()=>buildScale(root,id),[root,id])
  const audition = useMemo(()=>scalePlayback(scale,tuning,'up'),[scale,tuning])
  const player = useRef<ScalePlayer|null>(null)
  const [playing,setPlaying] = useState<{key:string;midi:number|null}>({key:'',midi:null})
  const [message,setMessage] = useState<{key:string;text:string}>({key:'',text:''})
  const key = JSON.stringify([root,id,tuning,soundEnabled,active])
  const request = useRef(0)
  const stop = () => { ++request.current; player.current?.stop(); setMode({key,value:null});setPlaying({key,midi:null}) }
  useEffect(()=> {
    const requests = request
    ++requests.current; player.current?.stop()
    const cancel = () => { ++request.current; player.current?.stop();setMode({key,value:null});setPlaying({key,midi:null}) }
    window.addEventListener('blur',cancel)
    window.addEventListener('pagehide',cancel)
    const visibility = () => { if(document.hidden) cancel() }
    document.addEventListener?.('visibilitychange',visibility)
    return ()=> {cancel();window.removeEventListener('blur',cancel);window.removeEventListener('pagehide',cancel);document.removeEventListener?.('visibilitychange',visibility)}
  },[key])
  useEffect(()=>()=>player.current?.dispose(),[])
  const play = async (pitches: NonNullable<typeof audition>['pitches'],playbackMode:PlaybackMode|null=null) => {
    stop()
    if(!active || !soundEnabled || !tempoValid) return
    const token = request.current
    player.current ??= new ScalePlayer()
    setMessage({key,text:''});setMode({key,value:playbackMode})
    try {
      const completed = await player.current.play(pitches,bpm,midi=>{if(token===request.current)setPlaying({key,midi})},{loop:playbackMode!==null,random:playbackMode==='random',rootClass:scale.rootClass,stableClasses:stablePitchClasses(scale)})
      if(completed && token===request.current){setMode({key,value:null})}
    } catch {if(token===request.current){setMode({key,value:null});setPlaying({key,midi:null});setMessage({key,text:'浏览器暂时无法播放声音，请再次点击试听。'})}}
  }
  const changeRoot = (value:string)=> {stop();setRoot(value)}
  const changeScale = (value:string)=> {stop();setId(value)}
  return <>
    <div className="intro"><span className="eyebrow">认识音阶</span><details className="chord-help"><summary><h1>音阶探索</h1><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 7l6 6 6-6" /></svg><span className="sr-only">展开或收起说明</span></summary><div>
      <p>通过选择控件改变主音。指板点击只演奏单音，音阶外位置也能试听。主音为双圈，其他音阶音为实线圈，正在播放的音以辅助强调色圆环突出。</p>
      <p>七声音阶在每个音上隔级叠音构建三和弦：大三大写，小三小写，减三加 °，增三加 +。例如 C 大调 I、ii、iii、IV、V、vi、vii°。公式另行显示常规相对主音音程，不与和弦性质混淆。</p>
      <p>大调五声映射大调，小调五声映射自然小调；布鲁斯的原有音沿用对应母音阶，附加音和调外音仅显示音名，不强行赋予和弦性质。旋律小调采用爵士用法，上下行同一组音。</p>
      <p>四个按钮均持续循环，再次点击正在播放的按钮停止，点击其他模式替换。BPM 60—300，四分音符为一拍，所有模式均为连续十六分音符（60 / BPM / 4 秒）。有效改速在后续起音应用，无效输入沿用上次速度。</p>
      <p>随机旋律优先调内相邻音级进，次选实际音高相隔大小三度、纯四／五度或大小六度；短暂保持方向，大跳后优先反向级进，边界自然折返，适度偏向稳定音。停止、切换主音／音阶／调弦、静音、失焦或离开页面取消旧播放。</p>
    </div></details></div>
    <section className="chord-card scale-card" aria-label="音阶选择与组成">
      <div className="chord-controls"><label>主音<select aria-label="音阶主音" value={root} onChange={e=>changeRoot(e.target.value)}>{NOTE_OPTIONS.map(note=><option key={note}>{note}</option>)}</select></label>
        <label>音阶<select aria-label="音阶类型" value={id} onChange={e=>changeScale(e.target.value)}>{[...new Set(EXPLORER_SCALES.map(s=>s.category))].map(category=><optgroup key={category} label={category}>{EXPLORER_SCALES.filter(s=>s.category===category).map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</optgroup>)}</select></label>
        <label>显示<select aria-label="音阶显示方式" value={display} onChange={e=>setDisplay(e.target.value)}><option value="degree">级数</option><option value="name">音名</option><option value="both">音名＋级数</option></select></label>
      </div>
      <h2>{root} · {scale.definition.name}</h2><p className="scale-formula">公式：{scale.tones.map(t=>toRoman(t.degree)).join('、')}</p>
      <ul className="chord-tones scale-tones">{scale.tones.map(t=><li key={t.degree}><strong>{t.noteName}</strong><span>{scaleToneAt(scale,t.pitchClass).degree===t.noteName?'附加音':scaleToneAt(scale,t.pitchClass).degree}</span></li>)}</ul>
      <div className="chord-controls"><label>BPM<input type="number" aria-label="试听速度" min={60} max={300} step={1} inputMode="decimal" value={tempoInput} aria-invalid={!tempoValid} aria-describedby="tempo-feedback" onChange={e=>{const value=e.target.value;setTempoInput(value);const valid=validBpm(value);if(valid!==null){setBpm(valid);player.current?.setBpm(valid)}}}/></label><span className="scale-range">试听音域：{audition?.range??'当前指板无法提供完整八度'}</span></div>
      <p id="tempo-feedback" role={tempoValid?undefined:'status'} className={tempoValid?'tempo-hint':'audio-error'}>{tempoValid?'四分音符 = 1 拍；所有模式为十六分音符。':`请输入 60—300 的有效 BPM；正在播放时沿用 ${bpm} BPM。`}</p>
      <div className="chord-playback">{([['up','上行'],['down','下行'],['both','上行＋下行'],['random','随机']] as const).map(([value,label])=>{
        const selected=mode.key===key&&mode.value===value
        return <button className={`sound-button ${selected?'playback-active':''}`} key={value} aria-pressed={selected} disabled={!selected&&(!soundEnabled||!audition||!tempoValid)} onClick={()=>{if(selected){stop();return}const sequence=scalePlayback(scale,tuning,value==='random'?'up':value);if(sequence)void play(sequence.pitches,value)}}>{label}{selected?' · 播放中':''}</button>
      })}</div>
      {!soundEnabled && <div role="status"><p>全局声音已关闭。</p><button className="sound-button" onClick={()=>shared.setSoundEnabled(true)}>启用声音</button></div>}
      {mode.key===key&&mode.value&&<p role="status">循环播放中 · 再次点击当前按钮停止</p>}
      {message.key===key && message.text && <p role="status" className="scale-status">{message.text}</p>}
    </section>
    <section className="workspace scale-workspace" aria-labelledby="scale-board-title"><div className="workspace-header"><h2 id="scale-board-title">音阶指板 · {root}</h2></div>
      <div className="board-scroll" role="region" aria-label="音阶指板，可横向滚动" tabIndex={0}><div className="board"><div className="fret-heading"><span>弦 / 品</span>{FRETS.map(fret=><span key={fret} className={fret===0?'open-heading':''}>{fret}<small>{fret===0?'空弦':'品'}</small></span>)}</div>
        <div className="strings">{tuning.map((_,index)=><div className={`string-row string-${index+1}`} key={index}><div className="string-label"><strong>{index+1} 弦</strong><span>{getPitch(index+1,0,tuning).label}</span></div>{FRETS.map(fret=>{
          const pitch=getPitch(index+1,fret,tuning), info=scaleToneAt(scale,pitch.midi), name=info.spelling.noteName
          const current=playing.key===key && playing.midi===pitch.midi
          const label=display==='degree'?info.degree:display==='name'?name:info.degree===name?name:`${name} ${info.degree}`
          return <button type="button" key={fret} className={`fret-cell ${fret===0?'open-cell':''} ${info.isRoot?'chord-root':info.tone?'chord-member':'chord-outside'} ${current?'scale-playing':''}`} aria-label={`第 ${index+1} 弦 ${fret} 品，${name}${info.degree===name?'':`，${info.degree}`}${info.tone?'，音阶内':'，音阶外'}${current?'，正在播放':''}`} aria-pressed={current} onClick={()=>void play([pitch])}><span className="note scale-note">{display==='both'&&info.degree!==name?<><strong>{name}</strong><small>{info.degree}</small></>:label}</span></button>
        })}</div>)}</div><div className="fret-markers" aria-hidden="true"><span/>{FRETS.map(fret=><span key={fret}>{[12,24].includes(fret)?'● ●':[3,5,7,9,15,17,19,21].includes(fret)?'●':''}</span>)}</div>
      </div></div>
    </section>
  </>
}
