import BpmInput from '../components/BpmInput'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { SharedSettings } from '../useAppSettings'
import { NOTE_OPTIONS } from '../pitch'
import { transposeProgression, validateProgression } from '../jam'
import type { JamCard, JamMode } from '../jam'
import { compileJam } from '../jamArrangement'
import { JamPlayer } from '../jamAudio'
import type { JamMixer as Mixer, JamProgress } from '../jamAudio'
import { validBpm } from '../scaleRhythm'
import JamProgressionEditor from '../components/JamProgressionEditor'
import JamParts from '../components/JamParts'
import JamLibrary from '../components/JamLibrary'
import { applyStyle, normalizeJamConfig, regenerate, soundSignature } from '../jamConfig'
import type { JamConfig, PartConfig } from '../jamConfig'
import type { JamPart } from '../jamArrangement'
import { JAM_MODES, JAM_PRESETS, generateProgression, presetCards } from '../jamPresets'
import { JAM_PREFERENCE_KEY, JAM_SAVED_KEY, readJamPreferences, readSavedJams, writeJamStorage } from '../jamStorage'
import type { JamSnapshot, SavedJam } from '../jamStorage'
import { buildChord } from '../chords'
type State='idle'|'starting'|'playing'|'error'
export default function JamPage({shared,active}:{shared:SharedSettings;active:boolean}){
 const {soundEnabled,tuning}=shared.preferences
 const [initial]=useState(readJamPreferences)
 const [root,setRoot]=useState(initial.root),[mode,setMode]=useState<JamMode>(initial.mode),[preset,setPreset]=useState(initial.mode==='major'?'pop':'minor')
 const [cards,setCards]=useState<JamCard[]>(initial.cards)
 const [tempo,setTempo]=useState(String(initial.bpm)),[bpm,setBpm]=useState(initial.bpm),[countIn,setCountIn]=useState(initial.countIn),[mixer,setMixer]=useState(initial.mixer)
 const [config,setConfig]=useState(initial.config),[favorites,setFavorites]=useState(readSavedJams),[storageMessage,setStorageMessage]=useState(''),[applyTiming,setApplyTiming]=useState<'bar'|'loop'>('loop')
 const validation=useMemo(()=>validateProgression(cards),[cards])
 const cycle=useMemo(()=>validation.errors.length?null:compileJam(cards,config,tuning),[cards,validation,config,tuning])
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
 const lastTuning=useRef(tuning)
 useEffect(()=>{if(lastTuning.current!==tuning){lastTuning.current=tuning;if(cycle?.config)player.current?.updateParts(cycle.config,tuning,'chords')}},[tuning,cycle])
 useEffect(()=>()=>player.current?.dispose(),[])
 const snapshot:JamSnapshot={version:2,root,mode,cards,bpm,countIn,config,mixer,tuning}
 const preferenceData=JSON.stringify(snapshot)
 useEffect(()=>{if(!validateProgression(cards).errors.length)writeJamStorage(JAM_PREFERENCE_KEY,JSON.parse(preferenceData))},[preferenceData,cards])
 const applyWhole=(next:JamConfig)=>{setApplyTiming('loop');setConfig(next);if(!validation.errors.length)player.current?.updateWhole(compileJam(cards,next,tuning))}
 const changePart=(part:JamPart,patch:Partial<PartConfig>)=>{
  if(part==='drums'&&patch.pattern==='sixteenth')patch={...patch,hat:4}
  const next={...config,style:Object.keys(patch).every(k=>k==='locked')?config.style:'custom' as const,parts:{...config.parts,[part]:{...config.parts[part],...patch}}};setConfig(next)
  if(Object.keys(patch).some(k=>k!=='locked')){setApplyTiming('bar');player.current?.updateParts(next,tuning,part)}
 }
 const regeneratePart=(part:JamPart)=>{const next=regenerate(config,part);setApplyTiming('bar');setConfig(next);player.current?.updateParts(next,tuning,part)}
 const store=(next:SavedJam[])=>{setFavorites(next);setStorageMessage(writeJamStorage(JAM_SAVED_KEY,next)?'已保存到此浏览器。':'浏览器无法保存；请勿刷新，当前内容仍可使用。')}
 const loadSaved=(item:SavedJam)=>{stop();const s=item.data;shared.applyTuning(s.tuning,'custom','收藏调弦');setRoot(s.root);setMode(s.mode);setCards(s.cards.map(c=>({...c})));setBpm(s.bpm);setTempo(String(s.bpm));setCountIn(s.countIn);setConfig(normalizeJamConfig(s.config));changeMixer(s.mixer);setStorageMessage(`已加载「${item.name}」及保存时的调弦，点击开始播放。`)}
 const changeMixer=(value:Mixer)=>{setMixer(value);player.current?.setMixer(value)}
 const toggle=async()=>{
  if(playing){stop();return}
  if(!soundEnabled||!active||!cycle||cycle.issues?.length||validBpm(tempo)===null)return
  ++request.current;const token=request.current
  player.current??=new JamPlayer();player.current.setMixer(mixer)
  setState({key,value:'starting'});setProgress({key,value:null})
  await player.current.start(cycle,bpm,countIn,{
   onState:(value,message)=>{if(request.current===token)setState({key,value,message})},
   onProgress:value=>{if(request.current===token)setProgress({key,value})},
  })
 }
 const pending=current&&cycle&&JSON.stringify((current.cycle.sourceCards??current.cycle.cards).map(c=>[c.root,c.type,c.beats]))!==JSON.stringify((cycle.sourceCards??cycle.cards).map(c=>[c.root,c.type,c.beats]))
 const partsPending=current&&cycle&&soundSignature(current.cycle.config)!==soundSignature(cycle.config)
 const nextName=current&&cycle&&current.cardId===current.cycle.sourceCards?.at(-1)?.id&&current.bar===current.cycle.bars?buildChord(cycle.cards[0].root,cycle.cards[0].type).name:current?.next
 const nextId=(prefix:string)=>{let id:string;do{id=`${prefix}-${++serial.current}`}while(cards.some(c=>c.id===id)||favorites.some(f=>f.id===id));return id}
 const add=()=>setCards([...cards,{id:nextId('card'),root,type:mode==='minor'?'minor':'major',beats:4}])
 return <>
 <div className="intro"><span className="eyebrow">一起练习</span><details className="chord-help"><summary><h1>Jam Session</h1><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 7l6 6 6-6"/></svg><span className="sr-only">展开或收起说明</span></summary><div>
  <p>选择预设后点击应用，同步预设所属调式；手动切换调式只改分析。主音整体移调进行。小调按自身级序分析；调式保留相对大调的降号（如 ♭VII），布鲁斯独立用 I7／IV7／V7。换一组进行保留锁定卡片和时长；重新编配保留锁定声部。风格只改变声部参数。</p>
  <p>音量／静音立即生效；BPM、单独声部参数及单声部重新生成在下小节生效，进行、风格、种子、变化模式及整套重新编配在下轮生效。再次点击开始停止。关闭声音、离页、隐藏窗口会停止。</p>
  <p>所有音色都是浏览器合成，吉他只使用已验证常用指型（并不保证每个手型都适合每个人）。不支持的和弦／调弦需主动选键盘。歌曲主音不随共享调弦移调，但吉他按法会随调弦更新。</p>
  <p>固定每轮完全重复；轻微变化按八轮确定性周期改变力度、装饰和密度。过门只出现在完整小节结尾；过门周期纳入伴奏周期：例如一小节进行、每四小节过门，会以四遍进行组成完整重复周期。种子与各声部种子共同决定结果；保存内容含生成参数，不包含音频文件。收藏含保存时的调弦，加载后同步共享调弦。收藏与界面偏好分别保存，恢复全局默认不删除收藏。</p>
 </div></details></div>
 <section className="chord-card" aria-label="Jam 设置"><div className="chord-controls jam-controls">
  <label>歌曲主音<select aria-label="Jam 主音" value={root} onChange={e=>{setCards(transposeProgression(cards,root,e.target.value));setRoot(e.target.value)}}>{NOTE_OPTIONS.map(note=><option key={note}>{note}</option>)}</select></label>
  <label>调式<select aria-label="Jam 调式" value={mode} onChange={e=>setMode(e.target.value as JamMode)}>{JAM_MODES.map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label>
  <label>进行预设<select aria-label="Jam 预设" value={preset} onChange={e=>setPreset(e.target.value)}>{[...new Set(JAM_PRESETS.map(p=>p.category))].map(category=><optgroup label={category} key={category}>{JAM_PRESETS.filter(p=>p.category===category).map(p=><option value={p.id} key={p.id}>{p.label}</option>)}</optgroup>)}</select></label>
  <button className="plain-button" onClick={()=>{const p=JAM_PRESETS.find(p=>p.id===preset)!;setCards(presetCards(p,root));setMode(p.mode)}}>应用预设</button>
  <button className="plain-button" onClick={()=>{const next=generateProgression(cards,root,mode,config.seed);setCards(next);if(JSON.stringify(next)===JSON.stringify(cards))setStorageMessage('在当前锁定与调式条件下没有另一组进行；可解锁卡片或选择其他预设。')}}>换一组进行</button>
  <label>BPM<BpmInput label="Jam BPM" value={tempo} onValue={next=>{setTempo(next);const valid=validBpm(next);if(valid!==null){setBpm(valid);player.current?.updateBpm(valid)}}}/></label>
  <label className="jam-count-toggle"><input type="checkbox" checked={countIn} onChange={e=>setCountIn(e.target.checked)}/>一小节预备拍</label>
 </div><p className="jam-style">{({pop:'流行／轻摇滚',funk:'放克',ambient:'氛围',custom:'自定义'})[config.style]} · 4/4 · {validation.bars%1===0?`${validation.bars} 小节`:`${validation.beats} 拍`} · 四分音符 = 1 拍</p>
 <div className="chord-controls jam-controls">
 <label>风格<select aria-label="Jam 风格" value={config.style} onChange={e=>{if(e.target.value!=='custom')applyWhole(applyStyle(config,e.target.value as 'pop'|'funk'|'ambient'))}}><option value="pop">流行／轻摇滚</option><option value="funk">放克</option><option value="ambient">氛围</option><option value="custom" disabled>自定义</option></select></label>
 <label>变化程度<select aria-label="Jam 变化程度" value={config.variation} onChange={e=>applyWhole({...config,variation:e.target.value as JamConfig['variation']})}><option value="fixed">固定</option><option value="subtle">轻微变化</option></select></label>
 <label>随机种子<input type="number" min="0" max="4294967295" step="1" aria-label="Jam 随机种子" value={config.seed} onChange={e=>{if(e.target.value!==''&&Number.isInteger(Number(e.target.value))&&Number(e.target.value)>=0&&Number(e.target.value)<=4294967295)applyWhole({...config,seed:Number(e.target.value)})}}/></label>
 <button className="plain-button" onClick={()=>applyWhole(regenerate(config))}>重新编配</button></div>
 {cycle&&cycle.bars!==validation.bars&&<p>完整伴奏周期：{cycle.bars} 小节（进行重复 {cycle.bars/validation.bars} 遍，含过门周期）。</p>}
 <p className="jam-preset-preview">预设预览（点击应用后使用）：{(()=>{const p=JAM_PRESETS.find(p=>p.id===preset)!;return `${JAM_MODES.find(([m])=>m===p.mode)?.[1]} · ${p.label} · ${presetCards(p,root).map(c=>`${buildChord(c.root,c.type).name} [${c.beats/4}小节]`).join(' → ')}`})()}</p>
 {!!cycle?.issues?.length&&<div className="audio-error" role="status">{cycle.issues.map(issue=><p key={issue}>{issue}</p>)}<button className="plain-button" onClick={()=>changePart('chords',{timbre:'keys'})}>使用键盘配音</button></div>}
 {validBpm(tempo)===null&&<p className="audio-error" role="status">请输入 60—300 的有效 BPM；播放中沿用上次有效速度，仍可点击按钮停止。</p>}
 {validation.errors.map(error=><p className="audio-error" role="status" key={error}>{error}</p>)}
 <button className={`sound-button jam-start ${playing?'playback-active':''}`} aria-pressed={playing} disabled={!playing&&(!soundEnabled||!cycle||!!cycle.issues?.length||validBpm(tempo)===null)} onClick={()=>void toggle()}>{status==='starting'?'正在启动 · 点击停止':playing?'正在播放 · 点击停止':'开始'}</button>
 {!soundEnabled&&<div role="status"><p>全局声音已关闭，请先启用声音。</p><button className="sound-button" onClick={()=>shared.setSoundEnabled(true)}>启用声音</button></div>}
 {state.key===key&&state.message&&<p className="audio-error" role="status">{state.message}</p>}
 {pending&&<p className="jam-pending" role="status">和弦进行待下一轮开始应用；当前仍播放原进行。</p>}
 {partsPending&&<p className="jam-pending" role="status">{applyTiming==='bar'?'声部参数待下小节应用；此前待应用的整套编配仍在下轮应用。':'整套编配待下轮应用。'}</p>}
 {playing&&!cycle&&<p className="jam-pending" role="status">当前编辑无效，继续播放已开始的进行。</p>}
 {current&&current.bpm!==bpm&&<p className="jam-pending" role="status">{bpm} BPM 待下一小节应用，当前 {current.bpm} BPM。</p>}
 </section>
 <section className="chord-card jam-transport" aria-label="播放进度"><div className="jam-now" aria-live="polite">{!current?<strong>{status==='starting'?'正在启动音频…':'准备就绪'}</strong>:current.phase==='count-in'?<strong>预备拍 · {5-current.beat}</strong>:<><strong>当前 {current.current}</strong><span>下一和弦 {nextName}</span><span>第 {current.loop} 轮 · 第 {current.bar} / {current.cycle.bars} 小节 · {current.bpm} BPM</span></>}</div>
 <div className="jam-beats" aria-label="四拍指示">{[1,2,3,4].map(beat=><span key={beat} className={current?.beat===beat?'beat-current':''} aria-current={current?.beat===beat?'step':undefined}>{beat}</span>)}</div>
 {current?.phase==='playing'&&<div className="jam-playing-strip" aria-label="实际播放的进行">{(current.cycle.sourceCards??current.cycle.cards).map(card=><span key={card.id} className={card.id===current.cardId?'strip-current':''}>{buildChord(card.root,card.type).name}</span>)}</div>}
 </section>
 <JamProgressionEditor cards={cards} root={root} mode={mode} currentId={current?.phase==='playing'?current.cardId:undefined} onChange={setCards} onAdd={add} onCopy={index=>setCards([...cards.slice(0,index+1),{...cards[index],id:nextId('card')},...cards.slice(index+1)])}/>
 <JamParts config={config} mixer={mixer} onPart={changePart} onMixer={changeMixer} onRegenerate={regeneratePart}/>
 <JamLibrary items={favorites} onSave={name=>{if(validation.errors.length){setStorageMessage('请先修正进行再保存。');return}store([...favorites,{id:nextId('saved'),name,data:JSON.parse(JSON.stringify(snapshot))}])}} onLoad={loadSaved} onRename={(id,name)=>store(favorites.map(f=>f.id===id?{...f,name}:f))} onDelete={id=>store(favorites.filter(f=>f.id!==id))}/>
 {storageMessage&&<p role="status">{storageMessage}</p>}
 </>
}
