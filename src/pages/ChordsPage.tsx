import { useEffect, useMemo, useRef, useState } from 'react'
import { CHORD_TYPES, CHORD_CATEGORIES, buildChord, chordToneAt } from '../chords'
import type { ChordTypeId } from '../chords'
import { ChordPlayer } from '../chordAudio'
import type { ChordPlaybackMode } from '../chordAudio'
import { getPitch, MAX_FRET, NOTE_OPTIONS } from '../pitch'
import type { SharedSettings } from '../useAppSettings'
import { contains, generateFingerings, rankedFingerings, rootPosition, fingeringPitches, tuningProfile } from '../fingerings'
import type { Position, Fingering } from '../fingerings'
import { REFERENCE_SCALES, degreeAt, scaleSuggestions } from '../referenceScales'
import { HoldGesture } from '../holdGesture'
import FingeringBrowser from '../components/FingeringBrowser'
const FRETS = Array.from({ length: MAX_FRET + 1 },(_,index) => index)
export default function ChordsPage({ shared, active }: { shared: SharedSettings; active: boolean }) {
  const { tuning, soundEnabled, showNotes } = shared.preferences
  const [root,setRoot] = useState('C'), [type,setType] = useState<ChordTypeId>('major')
  const [point,setPoint] = useState<Position | null>(null), [locked,setLocked] = useState(false)
  const [chosen,setChosen] = useState<{ key: string; id: string } | null>(null)
  const chord = useMemo(() => buildChord(root,type),[root,type])
  const shapes = useMemo(() => generateFingerings(chord,tuning),[chord,tuning])
  const anchor = useMemo(() => rootPosition(chord,tuning,point),[chord,tuning,point])
  const near = useMemo(() => rankedFingerings(shapes,anchor,true),[shapes,anchor])
  const contextKey = JSON.stringify([root,type,tuning])
  const current = (chosen?.key === contextKey ? shapes.find((shape) => shape.id === chosen.id) : near[0]) ?? null
  const suggestions = scaleSuggestions(chord)
  const [reference,setReference] = useState<{ key: string; id: string } | null>(null)
  const referenceKey = root + type
  const scaleId = reference?.key === referenceKey ? reference.id : suggestions[0]?.id ?? 'none'
  const scale = locked ? REFERENCE_SCALES.find((item) => item.id === scaleId) : undefined
  const player = useRef<ChordPlayer | null>(null), request = useRef(0)
  const [gesture] = useState(() => new HoldGesture())
  const [heldKey,setHeldKey] = useState<string | null>(null)
  const [message,setMessage] = useState<{ key: string; text: string } | null>(null)
  const audioKey = JSON.stringify([contextKey,current?.id,soundEnabled,active])
  const pendingClick = useRef<{ timer: ReturnType<typeof setTimeout>; point: Position } | null>(null)
  const lastDouble = useRef({ key: '', time: 0 })
  useEffect(() => {
    const cancel = () => { if (pendingClick.current) clearTimeout(pendingClick.current.timer); pendingClick.current = null; gesture.end(true); ++request.current; player.current?.stop() }
    cancel()
    const blur = () => { cancel(); setHeldKey(null) }
    const visibility = () => { if (document.hidden) blur() }
    window.addEventListener('blur',blur); window.addEventListener('pagehide',blur)
    document.addEventListener?.('visibilitychange',visibility)
    return () => { cancel(); window.removeEventListener('blur',blur); window.removeEventListener('pagehide',blur); document.removeEventListener?.('visibilitychange',visibility) }
  },[active,tuning,soundEnabled,gesture])
  useEffect(() => () => { ++request.current; player.current?.dispose(); player.current = null },[])
  function stopAudio() { ++request.current; player.current?.stop(); setHeldKey(null); setMessage(null) }
  function stop() { if (pendingClick.current) clearTimeout(pendingClick.current.timer); pendingClick.current = null; gesture.end(true); stopAudio() }
  function ensurePlayer() { player.current ??= new ChordPlayer(); return player.current }
  async function playPitches(pitches: ReturnType<typeof getPitch>[], mode: ChordPlaybackMode, hold = false, key = audioKey) {
    if (!soundEnabled || !active || !pitches.length) return
    const id = ++request.current
    try {
      const played = hold ? await ensurePlayer().hold(pitches) : await ensurePlayer().play(pitches,mode)
      if (played && id === request.current) setMessage({ key, text: hold ? '持续播放中，松开后衰减停止。' : '已播放。' })
    } catch { if (id === request.current) setMessage({ key, text: '暂时无法播放，请检查浏览器声音权限；仍可浏览指型。' }) }
  }
  function playShape(shape: Fingering | null, mode: ChordPlaybackMode, hold = false, rootValue = root, typeValue = type) { if (shape) void playPitches(fingeringPitches(shape,tuning,buildChord(rootValue,typeValue)),mode,hold,JSON.stringify([JSON.stringify([rootValue,typeValue,tuning]),shape.id,soundEnabled,active])) }
  function setRootAt(next: Position) {
    if (locked) { stop(); void playPitches([getPitch(next.string,next.fret,tuning)],'together'); return }
    stop()
    const nextRoot = getPitch(next.string,next.fret,tuning).noteName, nextChord = buildChord(nextRoot,type)
    const nextShape = rankedFingerings(generateFingerings(nextChord,tuning),next,true)[0] ?? null
    setRoot(nextRoot); setPoint(next); setChosen(null)
    playShape(nextShape,'together',false,nextRoot,type)
  }
  function doubleRoot(next: Position, now: number) {
    const key = `${next.string}:${next.fret}`
    if (lastDouble.current.key === key && now-lastDouble.current.time < 100) return
    lastDouble.current = {key,time:now}
    stop()
    if (next.string === anchor.string && next.fret === anchor.fret) setLocked((value) => !value)
    else setRootAt(next)
  }
  function boardClick(next: Position, detail: number, time: number) {
    if (locked && (next.string !== anchor.string || next.fret !== anchor.fret)) { setRootAt(next); return }
    if (detail === 0) { setRootAt(next); return } // 键盘产生的单击无需等待双击窗口。
    const pending = pendingClick.current
    if (detail >= 2 || (pending && pending.point.string === next.string && pending.point.fret === next.fret)) { doubleRoot(next,time); return }
    if (pending) clearTimeout(pending.timer)
    pendingClick.current = { point: next, timer: setTimeout(() => { pendingClick.current = null; setRootAt(next) },350) }
  }
  function change(rootValue: string, typeValue: ChordTypeId) {
    stop(); const nextChord = buildChord(rootValue,typeValue), nextAnchor = rootPosition(nextChord,tuning,rootValue === root ? anchor : null)
    const nextShape = rankedFingerings(generateFingerings(nextChord,tuning),nextAnchor,true)[0] ?? null
    setRoot(rootValue); setType(typeValue); setPoint(nextAnchor); setChosen(null)
    playShape(nextShape,'together',false,rootValue,typeValue)
  }
  function chooseShape(shape: Fingering) {
    stop(); setChosen({ key: contextKey, id: shape.id })
    if (!contains(shape,anchor)) {
      const rootPoint = shape.frets.flatMap((fret,index) => fret !== null && getPitch(index+1,fret,tuning).midi % 12 === chord.rootClass ? [{string:index+1,fret}] : [])[0]
      if (rootPoint) setPoint(rootPoint)
    }
    playShape(shape,'together')
  }
  function beginHold() {
    if (!soundEnabled || !current) return
    gesture.begin({
      prime: () => { const id = request.current; void ensurePlayer().prepare().catch(() => { if (id === request.current) setMessage({key:audioKey,text:'暂时无法启动声音，请检查浏览器权限。'}) }) },
      short: () => { setHeldKey(null); playShape(current,'together') },
      hold: () => { setHeldKey(audioKey); playShape(current,'together',true) },
      release: () => { ++request.current; player.current?.release(); setHeldKey(null); setMessage(null) },
      cancel: stopAudio,
    })
  }
  const holding = heldKey === audioKey
  return <>
    <div className="intro chord-intro"><span className="eyebrow">认识和弦</span><details className="chord-help"><summary><h1>和弦探索</h1><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 7l6 6 6-6" /></svg><span className="sr-only">展开或收起说明</span></summary><div>
      <p>未锁定时，点击大指板选择根音位置，寻找包含该位置的常用模板并播放；没有时提示“该位置暂无常用指型”。双击当前根音或使用锁定按钮锁定／解锁；双击会取消等待中的单击试听。</p>
      <p>锁定后点击任意位置只播放单音。参考音阶主音为当前根音，可以自由选择；建议仅表示包含和弦音，不是唯一对应调式。参考音阶标记按实际调内三和弦性质：大三大写、小三小写、减三加 °、增三加 +。五声映射对应大调／自然小调；布鲁斯附加音和音阶外音只显示音名，不强行指定和弦性质。未选参考音阶时仅显示常规相对根音音程。</p>
      <p>最明显的填色标记是实际发声位置；细圈是其他和弦音，虚线圈是参考音阶内音，较弱标记是音阶外音。外音也能演奏。小图左侧为 6 弦、右侧为 1 弦，○ 空弦，× 不弹；圆点内 1—4 为食指到小拇指，不使用拇指；横条只采用模板记录的真实横按。</p>
      <p>单击“播放”发短音，按住超过 220ms 持续稳定音高，松开自然衰减；鼠标、触屏与 Enter／空格都可操作。移出、取消、失焦、静音或离开会停止。</p>
      <p>仅展示常用 CAGED 开放、E／A 横按和局部模板，及已收录的七和弦／扩展握法。每个按弦位置有四指分配，横按不能误压空弦；跨度只是辅助检查。扩展握法仅按各模板明确的规则省略五、九或十一音，卡片列出实际音和省略音。没有模板的调弦／类型不生成组合，锁定后仍可单音探索；模板不代表所有人体工学都适合。</p>
    </div></details></div>
    <section className="chord-card chord-layout" aria-label="和弦设置与组成"><div className="chord-control-panel">
      <div className="chord-controls"><label>根音<select aria-label="和弦根音" value={root} onChange={(event) => { setLocked(false); change(event.target.value,type) }}>{NOTE_OPTIONS.map((note) => <option key={note}>{note}</option>)}</select></label><label>类别<select aria-label="和弦类别" value={chord.type.category} onChange={(event) => change(root,CHORD_TYPES.find((item) => item.category === event.target.value)!.id)}>{CHORD_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label>类型<select aria-label="和弦类型" value={type} onChange={(event) => change(root,event.target.value as ChordTypeId)}>{CHORD_TYPES.filter((item) => item.category === chord.type.category).map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label></div>
      <div className="root-lock"><strong>{locked ? '根音已锁定' : '根音未锁定'} · {root}<small>第 {anchor.string} 弦 {anchor.fret} 品</small></strong><button className="plain-button" type="button" aria-pressed={locked} onClick={() => {stop();setLocked(!locked)}}>{locked ? '解锁根音' : '锁定根音'}</button></div>
      <div className="chord-description" aria-live="polite"><h2>{chord.name} · {chord.type.label}</h2><p>音程公式：{chord.type.degrees.join('、')}（半音：{chord.type.semitones.join('、')}）</p><ul className="chord-tones">{chord.tones.map((tone) => <li key={tone.degree}><strong>{tone.noteName}</strong><span>{tone.degree}</span></li>)}</ul></div>
      {locked && <div className="reference-control"><label>参考音阶<select aria-label="参考音阶" value={scaleId} onChange={(event) => setReference({key:referenceKey,id:event.target.value})}><option value="none">仅相对根音音程</option><optgroup label="包含和弦音的建议">{suggestions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup><optgroup label="其他已实现参考音阶">{REFERENCE_SCALES.filter((item) => !suggestions.some((suggestion) => suggestion.id === item.id)).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup></select></label><p>当前：{root} · {scale?.name ?? '仅相对根音音程'}{scale && !suggestions.some((item) => item.id === scale.id) ? '（不完全包含和弦组成音）' : ''}</p></div>}
      <div className="challenge-actions"><button type="button" className="sound-button" aria-pressed={holding} disabled={!soundEnabled || !current} onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); beginHold() }} onPointerUp={() => gesture.end()} onPointerCancel={() => gesture.end(true)} onLostPointerCapture={() => gesture.end(true)} onPointerLeave={() => gesture.end(true)} onPointerMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) gesture.end(true) }} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') {event.preventDefault();if (!event.repeat) beginHold()} }} onKeyUp={(event) => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault();gesture.end()} }} onBlur={() => gesture.end(true)} onClick={(event) => {if (event.detail === 0) playShape(current,'together')}}>播放</button><button type="button" className="sound-button" disabled={!soundEnabled || !current} onClick={() => {stop();playShape(current,'sequence')}}>琶音 arpeggio</button><button type="button" className="plain-button" onClick={stop}>停止播放</button></div>
      {!soundEnabled && <div role="status"><p>全局声音已关闭。</p><button className="sound-button" onClick={() => shared.setSoundEnabled(true)}>启用声音</button></div>}
      {message?.key === audioKey && <p role="status">{message.text}</p>}
      {current ? <div className="current-fingering" aria-live="polite"><p>当前指型（6 → 1 弦）：{[...current.frets].reverse().map((fret) => fret === null ? '×' : fret).join('、')} · 跨度 {current.span} 品</p><p>实际演奏：{fingeringPitches(current,tuning,chord).map((pitch) => pitch.label).join('、')}</p>{current.omitted.length > 0 && <p>省略音：{current.omitted.join('、')}</p>}</div> : <p role="status">{!tuningProfile(tuning) ? '当前调弦暂无已验证常用指型；锁定根音后仍可单音探索。' : shapes.length ? '该位置暂无常用指型。' : '暂无已验证常用指型；仍可查看公式并锁定根音进行单音探索。'}</p>}
    </div><FingeringBrowser key={`${contextKey}:${anchor.string}:${anchor.fret}`} shapes={shapes} current={current} anchor={anchor} chord={chord} tuning={tuning} onChoose={chooseShape} /></section>
    <section className="workspace chord-workspace" aria-labelledby="chord-board-title"><div className="workspace-header"><h2 id="chord-board-title">和弦指板 · {chord.name}</h2></div>
      <div className="board-scroll" role="region" aria-label="和弦指板，可横向滚动" tabIndex={0}><div className="board"><div className="fret-heading"><span>弦 / 品</span>{FRETS.map((fret) => <span key={fret} className={fret === 0 ? 'open-heading' : ''}>{fret}<small>{fret === 0 ? '空弦' : '品'}</small></span>)}</div><div className="strings">{tuning.map((_,index) => <div className={`string-row string-${index+1}`} key={index}><div className="string-label"><strong>{index+1} 弦</strong><span>{showNotes ? getPitch(index+1,0,tuning).label : '—'}</span></div>{FRETS.map((fret) => {
        const position = {string:index+1,fret}, {pitch,tone} = chordToneAt(chord,index+1,fret,tuning)
        const degree = degreeAt(chord,scale,pitch.midi), sounding = current ? contains(current,position) : false
        const isAnchor = anchor.string === index+1 && anchor.fret === fret
        return <button key={fret} type="button" className={`fret-cell ${fret === 0 ? 'open-cell' : ''} ${tone ? tone.degree === '1' ? 'chord-root' : 'chord-member' : degree.inScale ? 'scale-member' : 'chord-outside'} ${sounding ? 'shape-sounding' : ''} ${isAnchor ? 'root-anchor' : ''} ${scale ? degree.inScale ? 'reference-inside' : 'reference-outside' : ''}`} aria-label={`第 ${index+1} 弦 ${fret} 品，${locked ? degree.label : tone?.noteName ?? pitch.noteName}${sounding ? '，实际发声' : ''}${isAnchor ? '，当前根音位置' : ''}${scale && !degree.inScale ? '，参考音阶外' : ''}`} aria-pressed={sounding} onClick={(event) => boardClick(position,event?.detail ?? 0,event?.timeStamp ?? 0)} onDoubleClick={(event) => doubleRoot(position,event.timeStamp)}><span className="note">{locked ? degree.label : tone?.noteName ?? pitch.noteName}</span></button>
      })}</div>)}</div><div className="fret-markers" aria-hidden="true"><span />{FRETS.map((fret) => <span key={fret}>{[12,24].includes(fret) ? '● ●' : [3,5,7,9,15,17,19,21].includes(fret) ? '●' : ''}</span>)}</div></div></div>
    </section>
  </>
}
