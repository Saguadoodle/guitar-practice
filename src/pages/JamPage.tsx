import { useEffect, useMemo, useRef, useState } from 'react'
import type { SharedSettings } from '../useAppSettings'
import { NOTE_OPTIONS } from '../pitch'
import { DEFAULT_JAM, jamPreset, transposeProgression, validateProgression } from '../jam'
import type { JamCard, JamMode } from '../jam'
import { compileJam } from '../jamArrangement'
import { JamPlayer, defaultJamMixer } from '../jamAudio'
import type { JamMixer as Mixer, JamProgress } from '../jamAudio'
import { validBpm } from '../scaleRhythm'
import JamProgressionEditor from '../components/JamProgressionEditor'
import JamMixer from '../components/JamMixer'
import { buildChord } from '../chords'
type State='idle'|'starting'|'playing'|'error'
export default function JamPage({shared,active}:{shared:SharedSettings;active:boolean}){
 const {soundEnabled}=shared.preferences
 const [root,setRoot]=useState('A'),[mode,setMode]=useState<JamMode>('minor'),[single,setSingle]=useState(false)
 const [cards,setCards]=useState<JamCard[]>(()=>DEFAULT_JAM.map(c=>({...c})))
 const [tempo,setTempo]=useState('90'),[bpm,setBpm]=useState(90),[countIn,setCountIn]=useState(true),[mixer,setMixer]=useState(defaultJamMixer)
 const validation=useMemo(()=>validateProgression(cards),[cards])
 const cycle=useMemo(()=>validation.errors.length?null:compileJam(cards),[cards,validation])
 const key=JSON.stringify([active,soundEnabled]),request=useRef(0),serial=useRef(0),player=useRef<JamPlayer|null>(null)
 const [state,setState]=useState<{key:string;value:State;message?:string}>({key,value:'idle'})
 const [progress,setProgress]=useState<{key:string;value:JamProgress|null}>({key,value:null})
 const status=state.key===key?state.value:'idle',playing=status==='playing'||status==='starting'
 const current=progress.key===key?progress.value:null
 const stop=()=>{++request.current;player.current?.stop();setState({key,value:'idle'});setProgress({key,value:null})}
 useEffect(()=>{
  const requests=request;++requests.current;player.current?.stop()
  const cancel=()=>{++requests.current;player.current?.stop();setState({key,value:'idle'});setProgress({key,value:null})}
  window.addEventListener('pagehide',cancel)
  const visibility=()=>{if(document.hidden)cancel()}
  document.addEventListener?.('visibilitychange',visibility)
  return ()=>{cancel();window.removeEventListener('pagehide',cancel);document.removeEventListener?.('visibilitychange',visibility)}
 },[key])
 useEffect(()=>{if(cycle)player.current?.updateProgression(cycle);else player.current?.cancelPendingProgression()},[cycle])
 useEffect(()=>()=>player.current?.dispose(),[])
 const changeMixer=(value:Mixer)=>{setMixer(value);player.current?.setMixer(value)}
 const toggle=async()=>{
  if(playing){stop();return}
  if(!soundEnabled||!active||!cycle||validBpm(tempo)===null)return
  ++request.current;const token=request.current
  player.current??=new JamPlayer();player.current.setMixer(mixer)
  setState({key,value:'starting'});setProgress({key,value:null})
  await player.current.start(cycle,bpm,countIn,{
   onState:(value,message)=>{if(request.current===token)setState({key,value,message})},
   onProgress:value=>{if(request.current===token)setProgress({key,value})},
  })
 }
 const pending=current&&cycle&&current.cycle.revision!==cycle.revision
 const nextName=current&&cycle&&current.cardId===current.cycle.cards.at(-1)?.id?buildChord(cycle.cards[0].root,cycle.cards[0].type).name:current?.next
 const add=()=>setCards([...cards,{id:`card-${++serial.current}`,root,type:mode==='minor'?'minor':'major',beats:4}])
 return <>
 <div className="intro"><span className="eyebrow">一起练习</span><details className="chord-help"><summary><h1>Jam Session</h1><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 7l6 6 6-6"/></svg><span className="sr-only">展开或收起说明</span></summary><div>
  <p>基础轻摇滚：鼓、贝斯和键盘式和弦共用同一 4/4 时间线，开始前可用一小节预备拍。再次点击开始按钮停止。四分音符为一拍，各声部按自己的固定节奏演奏。</p>
  <p>改变主音整体移调进行；改变大调／自然小调只更新调内分析，不覆盖卡片。需要重置进行时点击“应用预设”。允许调外和弦；只给可明确分析的三／七和弦标级数。总长度必须为完整小节。</p>
  <p>有效 BPM 在下一小节应用，进行编辑在下一轮首小节应用；无效编辑继续播放旧进行并提示。声部音量和静音立即生效。共享吉他调弦不会改变歌曲调性或伴奏音高。主音量在此控制 Jam；声音总开关仍在共享设置中。</p>
  <p>后台隐藏、离开板块或全局静音会停止；音频暂停或页面线程严重中断时停止并提示重启，避免密集补播。第一版只提供固定、可重复的基础轻摇滚模板，自动生成和完整指板留到后续阶段。</p>
 </div></details></div>
 <section className="chord-card" aria-label="Jam 设置"><div className="chord-controls jam-controls">
  <label>歌曲主音<select aria-label="Jam 主音" value={root} onChange={e=>{setCards(transposeProgression(cards,root,e.target.value));setRoot(e.target.value)}}>{NOTE_OPTIONS.map(note=><option key={note}>{note}</option>)}</select></label>
  <label>调式<select aria-label="Jam 调式" value={mode} onChange={e=>setMode(e.target.value as JamMode)}><option value="major">大调（Major）</option><option value="minor">自然小调（Natural Minor）</option></select></label>
  <label>预设<select aria-label="Jam 预设" value={single?'single':'progression'} onChange={e=>setSingle(e.target.value==='single')}><option value="progression">{mode==='minor'?'i–VI–III–VII':'I–V–vi–IV'}</option><option value="single">单和弦循环：{mode==='minor'?'i':'I'}</option></select></label>
  <button className="plain-button" onClick={()=>setCards(jamPreset(root,mode,single))}>应用预设</button>
  <label>BPM<input type="number" min="60" max="300" step="1" inputMode="decimal" aria-label="Jam BPM" aria-invalid={validBpm(tempo)===null} value={tempo} onChange={e=>{setTempo(e.target.value);const valid=validBpm(e.target.value);if(valid!==null){setBpm(valid);player.current?.updateBpm(valid)}}}/></label>
  <label className="jam-count-toggle"><input type="checkbox" checked={countIn} onChange={e=>setCountIn(e.target.checked)}/>一小节预备拍</label>
 </div><p className="jam-style">基础轻摇滚（Light Rock） · 4/4 · {validation.bars%1===0?`${validation.bars} 小节`:`${validation.beats} 拍`} · 四分音符 = 1 拍</p>
 {validBpm(tempo)===null&&<p className="audio-error" role="status">请输入 60—300 的有效 BPM；播放中沿用上次有效速度，仍可点击按钮停止。</p>}
 {validation.errors.map(error=><p className="audio-error" role="status" key={error}>{error}</p>)}
 <button className={`sound-button jam-start ${playing?'playback-active':''}`} aria-pressed={playing} disabled={!playing&&(!soundEnabled||!cycle||validBpm(tempo)===null)} onClick={()=>void toggle()}>{status==='starting'?'正在启动 · 点击停止':playing?'正在播放 · 点击停止':'开始'}</button>
 {!soundEnabled&&<div role="status"><p>全局声音已关闭，请先启用声音。</p><button className="sound-button" onClick={()=>shared.setSoundEnabled(true)}>启用声音</button></div>}
 {state.key===key&&state.message&&<p className="audio-error" role="status">{state.message}</p>}
 {pending&&<p className="jam-pending" role="status">和弦进行待下一轮开始应用；当前仍播放原进行。</p>}
 {playing&&!cycle&&<p className="jam-pending" role="status">当前编辑无效，继续播放已开始的进行。</p>}
 {current&&current.bpm!==bpm&&<p className="jam-pending" role="status">{bpm} BPM 待下一小节应用，当前 {current.bpm} BPM。</p>}
 </section>
 <section className="chord-card jam-transport" aria-label="播放进度"><div className="jam-now" aria-live="polite">{!current?<strong>{status==='starting'?'正在启动音频…':'准备就绪'}</strong>:current.phase==='count-in'?<strong>预备拍 · {5-current.beat}</strong>:<><strong>当前 {current.current}</strong><span>下一和弦 {nextName}</span><span>第 {current.loop} 轮 · 第 {current.bar} / {current.cycle.bars} 小节 · {current.bpm} BPM</span></>}</div>
 <div className="jam-beats" aria-label="四拍指示">{[1,2,3,4].map(beat=><span key={beat} className={current?.beat===beat?'beat-current':''} aria-current={current?.beat===beat?'step':undefined}>{beat}</span>)}</div>
 {current?.phase==='playing'&&<div className="jam-playing-strip" aria-label="实际播放的进行">{current.cycle.cards.map(card=><span key={card.id} className={card.id===current.cardId?'strip-current':''}>{buildChord(card.root,card.type).name}</span>)}</div>}
 </section>
 <JamProgressionEditor cards={cards} root={root} mode={mode} currentId={current?.phase==='playing'?current.cardId:undefined} onChange={setCards} onAdd={add} onCopy={index=>setCards([...cards.slice(0,index+1),{...cards[index],id:`card-${++serial.current}`},...cards.slice(index+1)])}/>
 <JamMixer value={mixer} onChange={changeMixer}/>
 </>
}
