// 执行组件事件并检查可见 React 元素树；浏览器布局另行验收。
import assert from 'node:assert/strict'
import { createModuleLoader, dataUrl } from './load-ts.mjs'

const initialTheme = process.argv[2] === 'dark' ? 'dark' : 'light'
const savedTheme = new Map([['saguadlib-theme', initialTheme]])
const listeners = new Map()
let hash = '#/fretboard'
const media = { matches: initialTheme === 'dark', addEventListener() {}, removeEventListener() {} }
globalThis.window = {
  localStorage: { getItem: (key) => savedTheme.get(key), setItem: (key, value) => savedTheme.set(key, value) },
  matchMedia: () => media,
  addEventListener(type, callback) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(callback) },
  removeEventListener(type, callback) { listeners.get(type)?.delete(callback) },
  location: { get hash() { return hash }, set hash(value) { hash = value.startsWith('#') ? value : `#${value}`; listeners.get('hashchange')?.forEach((fn) => fn()) } },
}
globalThis.localStorage=window.localStorage
globalThis.document = { documentElement: { dataset: {} } }
const instances = new Map()
let currentSlots, cursor = 0, effects = []
const useState = (initial) => {
  const slots = currentSlots
  const index = cursor++
  if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
  return [slots[index], (next) => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
}
globalThis.__guitarTestHooks = {
  useState,
  useMemo(factory) { return factory() },
  useSyncExternalStore(subscribe, getSnapshot) { void subscribe; return getSnapshot() },
  useRef(initial) { return useState(() => ({ current: initial }))[0] },
  useEffect(callback, dependencies) {
    const slots = currentSlots
    const index = cursor++
    const previous = slots[index]
    if (!previous || dependencies.some((item, i) => !Object.is(item, previous.dependencies[i]))) {
      slots[index] = { dependencies }
      effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = callback() })
    }
  },
}
const hookUrl = dataUrl('export const { useState, useRef, useEffect, useMemo, useSyncExternalStore } = globalThis.__guitarTestHooks')
globalThis.__chordAudioChecks = { plays: [], stops: 0 }
const chordAudioUrl = dataUrl(`export class ChordPlayer { async prepare() {} async hold(pitches) { return this.play(pitches,"hold") } release() { this.stop() } async play(pitches, mode) { globalThis.__chordAudioChecks.plays.push({pitches, mode}); return true } stop() { globalThis.__chordAudioChecks.stops++ } dispose() { this.stop() } }`)
globalThis.__scaleUI = {plays:[],stops:0,fail:false,bpm:120}
const scaleAudioUrl = dataUrl(`export class ScalePlayer {setBpm(bpm){globalThis.__scaleUI.bpm=bpm}async play(pitches,bpm,onNote,options={}){const state=globalThis.__scaleUI;if(state.fail)throw Error('failed');state.plays.push({pitches,bpm,...options});onNote(pitches[0].midi);return !options.loop}stop(){globalThis.__scaleUI.stops++}dispose(){this.stop()}}`)
globalThis.__jamUI={starts:[],stops:0,updates:[],mixers:[],fail:false,callbacks:null}
const jamAudioUrl=dataUrl(`export const defaultJamMixer=()=>({master:.7,drums:.65,bass:.65,chords:.6,muted:{drums:false,bass:false,chords:false}});export class JamPlayer {async start(cycle,bpm,countIn,callbacks){const state=globalThis.__jamUI;state.starts.push({cycle,bpm,countIn});state.callbacks=callbacks;callbacks.onState('starting');if(state.fail){callbacks.onState('error','启动失败');return}callbacks.onState('playing');callbacks.onProgress({phase:countIn?'count-in':'playing',beat:1,bar:1,loop:1,cardId:cycle.cards[0].id,current:'C',next:'G',cycle,bpm})}updateBpm(bpm){globalThis.__jamUI.bpm=bpm}updateProgression(cycle){globalThis.__jamUI.updates.push(cycle)}cancelPendingProgression(){}updateParts(config){globalThis.__jamUI.parts=config}updateWhole(cycle){globalThis.__jamUI.updates.push(cycle)}setMixer(mixer){globalThis.__jamUI.mixers.push(mixer)}stop(){const state=globalThis.__jamUI;state.stops++;state.callbacks?.onProgress(null);state.callbacks?.onState('idle')}dispose(){this.stop()}}`)
const moduleUrl = createModuleLoader({ react: hookUrl, '../jamAudio':jamAudioUrl, '../chordAudio': chordAudioUrl, '../scaleAudio': scaleAudioUrl })
const { default: App } = await import(moduleUrl('src/App.tsx'))
let tree
function expand(node, path = 'root') {
  if (!node || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map((child, index) => expand(child, `${path}/${index}`))
  if (typeof node.type === 'function') {
    const id = `${path}:${node.type.name}:${node.key ?? ''}`
    if (!instances.has(id)) instances.set(id, [])
    currentSlots = instances.get(id); cursor = 0
    return expand(node.type(node.props), id)
  }
  return { ...node, props: { ...node.props, children: expand(node.props?.children, `${path}/children`) } }
}
function render() {
  effects = []
  tree = expand({ type: App, props: {} })
  effects.forEach((effect) => effect())
}
function nodes(node) {
  if (!node || typeof node !== 'object' || node.props?.hidden) return []
  if (Array.isArray(node)) return node.flatMap((item) => nodes(item))
  return [node, ...nodes(node.props?.children)]
}
const find = (predicate) => { const result = nodes(tree).find(predicate); assert.ok(result); return result }
const byClass = (name) => find((node) => node.props?.className === name)
const text = (node) => {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node !== 'object') return String(node)
  if (Array.isArray(node)) return node.map(text).join('')
  return text(node.props?.children)
}
const boardButtons = () => nodes(tree).filter((node) => node.type === 'button' && node.props.className?.startsWith('fret-cell'))
const click = async (string, fret) => { await boardButtons()[(string - 1) * 25 + fret].props.onClick(); render() }
const choose = (value) => { find((node) => node.type === 'select' && node.props.value !== undefined && node.props.onChange && node.props.children.length === 2).props.onChange({ target: { value } }); render() }
function navigate(id) {
  find((node) => node.type === 'select' && node.props['aria-label'] === '板块导航').props.onChange({ target: { value: id } })
  render()
}
function chooseTheme(value) {
  navigate('settings')
  find((node) => node.type === 'select' && node.props['aria-label'] === '主题').props.onChange({ target: { value } })
  render()
  navigate('fretboard')
}
const toggleNotes = (checked) => { find((node) => node.type === 'input' && node.props.type === 'checkbox').props.onChange({ target: { checked } }); render() }
const detail = () => byClass('selection')
const reveal = () => { detail().props.onClick(); render() }
const keyReveal = (key) => {
  let prevented = false
  detail().props.onKeyDown({ key, preventDefault() { prevented = true } })
  render()
  return prevented
}
const assertHidden = () => {
  assert.match(text(detail()), /点击查看答案/)
  assert.ok(!/[A-G][♯♭]?/.test(text(detail())))
  assert.ok(!/[A-G][♯♭]?\d/.test(detail().props['aria-label']))
  assert.ok(!/音名|八度|频率|MIDI/.test(text(detail())))
}
render()
assert.match(text(byClass('brand')), /SaguaNoodle/)
const themeSelect = () => find((node) => node.type === 'select' && node.props['aria-label'] === '主题')
navigate('settings')
assert.equal(themeSelect().props.value, initialTheme)
chooseTheme(initialTheme)
assert.equal(document.documentElement.dataset.theme, initialTheme)
assert.equal(boardButtons().length, 150)
assert.match(boardButtons()[24].props['aria-label'], /E6/)
assert.match(boardButtons()[149].props['aria-label'], /E4/)
assert.equal(nodes(byClass('fret-markers')).filter((node) => text(node) === '● ●').length, 2)
assert.equal(text(detail()), '请先点击指板选择位置')
byClass('sound-button').props.onClick(); render()
toggleNotes(false)
assert.equal(text(detail()), '请先点击指板选择位置')
assert.equal(detail().props['aria-disabled'], true)
reveal()
assert.equal(text(detail()), '请先点击指板选择位置')
assert.equal(keyReveal('Enter'), true)
assert.equal(text(detail()), '请先点击指板选择位置')
assert.ok(boardButtons().every((button) => !/[A-G][♯♭]?\d/.test(button.props['aria-label'])))
assert.ok(!/[A-G]/.test(text(byClass('strings'))))
assert.equal(text(byClass('guess-hint')), '先猜音名，再点击下方详情窗口核对。')

// 用户指定的标准调弦验收流程，包含鼠标/触屏点击、Enter 和空格。
await click(6, 3)
assertHidden()
chooseTheme(initialTheme === 'dark' ? 'light' : 'dark')
assertHidden()
chooseTheme(initialTheme)
assertHidden()
assert.match(text(detail()), /第 6 弦/)
assert.match(text(detail()), /3 品/)
assert.equal(detail().props.role, 'button')
assert.equal(detail().props.tabIndex, 0)
assert.equal(keyReveal('Escape'), false)
assertHidden()
reveal()
assert.equal(text(byClass('selection-note')), '当前音高G2')
await click(5, 3)
assertHidden()
reveal()
assert.equal(text(byClass('selection-note')), '当前音高C3')
await click(6, 3)
assertHidden()
assert.equal(keyReveal('Enter'), true)
assert.equal(text(byClass('selection-note')), '当前音高G2')
await click(5, 3)
assertHidden()
assert.equal(keyReveal(' '), true)
assert.equal(text(byClass('selection-note')), '当前音高C3')
await click(5, 3) // 即使再次点相同位置，也重置答案。
assertHidden()
assert.ok(boardButtons().every((button) => !/[A-G]/.test(text(button))))
byClass('sound-button').props.onClick(); render()
assertHidden()
byClass('sound-button').props.onClick(); render()
assertHidden()
assert.equal(tree.props.onClick, undefined)

choose('drop-d')
assertHidden()
assert.match(text(byClass('open-summary')), /D2/)
await click(6, 24); assertHidden(); reveal()
assert.equal(text(byClass('selection-note')), '当前音高D4')
choose('half-step'); assertHidden()
await click(6, 0); assertHidden(); reveal()
assert.equal(text(byClass('selection-note')), '当前音高E♭2')
choose('facgce'); assertHidden()
await click(2, 0); assertHidden(); reveal()
assert.equal(text(byClass('selection-note')), '当前音高C4')
toggleNotes(true)
assert.equal(detail().props.role, undefined)
await click(6, 0)
assert.equal(text(byClass('selection-note')), '当前音高F2')
toggleNotes(false); assertHidden()
choose('custom'); assertHidden()
const sixthField = () => nodes(tree).filter((node) => node.type === 'fieldset')[5]
let input = nodes(sixthField()).find((node) => node.type === 'input')
input.props.onChange({ target: { value: '' } }); render()
find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} }); render()
assert.match(text(byClass('tuning-errors')), /第 6 弦：八度/)
assert.match(text(byClass('applied-tuning')), /FACGCE/)
input = nodes(sixthField()).find((node) => node.type === 'input')
input.props.onChange({ target: { value: '2' } }); render()
nodes(sixthField()).find((node) => node.type === 'select').props.onChange({ target: { value: 'F♯' } }); render()
reveal()
find((node) => node.type === 'form').props.onSubmit({ preventDefault() {} }); render()
assertHidden()
assert.match(text(byClass('applied-tuning')), /自定义调弦/)
for (const [fret, octave] of [[0, 2], [12, 3], [24, 4]]) {
  await click(6, fret); assertHidden(); reveal()
  assert.equal(text(byClass('selection-note')), `当前音高F♯${octave}`)
}
// 扒谱初始状态不能伪装可用媒体或编造BPM。
navigate('transcription')
assert.equal(find(n=>n.type==='button'&&text(n)==='播放').props.disabled,true)
assert.equal(find(n=>n.type==='button'&&text(n)==='分析整段').props.disabled,true)
assert.match(text(tree),/原曲BPM未知/)
assert.match(text(tree),/不包含媒体/)
assert.equal(nodes(tree).filter(n=>n.type==='video').length,1)
// 七个地址、占位页与共享设置，以及返回指板后的局部练习状态。
for (const id of ['about']) {
  navigate(id)
  assert.match(text(byClass('site-footer')), /1145141919810/)
  assert.match(text(byClass('placeholder-page')), /筹备中/)
  assert.equal(boardButtons().length, 0)
  assert.equal(nodes(tree).filter((node) => node.type === 'button').length, 0)
  assert.match(text(byClass('shared-summary')), /自定义调弦/)
}
navigate('fretboard')
assert.equal(text(byClass('selection-note')), '当前音高F♯4')
navigate('settings')
choose('drop-d')
const soundCheckbox = () => find((node) => node.type === 'label' && text(node).startsWith('点击发声')).props.children[1]
soundCheckbox().props.onChange({ target: { checked: false } }); render()
navigate('fretboard'); assertHidden()
assert.match(text(byClass('open-summary')), /D2/)
assert.match(text(byClass('sound-button')), /声音关/)
await click(6, 0); assertHidden(); reveal()
assert.equal(text(byClass('selection-note')), '当前音高D2')
// 刷新：全局偏好恢复，但练习中的选中位置不被持久化。
for (const slots of instances.values()) for (const slot of slots) if (slot?.cleanup) slot.cleanup()
instances.clear(); render()
assert.equal(text(detail()), '请先点击指板选择位置')
assert.match(text(byClass('open-summary')), /D2/)
assert.match(text(byClass('sound-button')), /声音关/)
assert.ok(boardButtons().every((button) => !/[A-G]/.test(button.props['aria-label'])))
navigate('settings')
find((node) => node.type === 'button' && text(node) === '恢复默认设置').props.onClick(); render()
assert.equal(themeSelect().props.value, 'system')
navigate('fretboard')
assert.match(text(byClass('open-summary')), /E2/)
assert.match(text(byClass('sound-button')), /声音开/)
assert.match(boardButtons()[149].props['aria-label'], /E4/)
// J1：默认体验、编辑/移调、边界待应用、混音及共享设置。
navigate('jam')
const jamSelect=(name,value)=>{find(n=>n.type==='select'&&n.props['aria-label']===name).props.onChange({target:{value}});render()}
const jamButton=()=>find(n=>n.type==='button'&&n.props.className?.includes('jam-start'))
const jamAction=name=>find(n=>n.type==='button'&&(n.props['aria-label']===name||text(n)===name))
const jamRoots=()=>nodes(tree).filter(n=>n.type==='select'&&/^和弦 \d+ 根音$/.test(n.props['aria-label']??'')).map(n=>n.props.value)
assert.deepEqual(jamRoots(),['A','F','C','G']);assert.equal(find(n=>n.type==='input'&&n.props['aria-label']==='Jam BPM').props.value,'90')
assert.equal(find(n=>n.type==='details').props.open,undefined)
jamSelect('Jam 主音','C');assert.deepEqual(jamRoots(),['C','A♭','E♭','B♭'])
const original=jamRoots();jamSelect('Jam 调式','major');assert.deepEqual(jamRoots(),original)
jamSelect('Jam 预设','pop');jamAction('应用预设').props.onClick();render();assert.deepEqual(jamRoots(),['C','G','A','F']);jamSelect('吉他音色','keys')
jamSelect('和弦 1 时长','2');assert.equal(jamButton().props.disabled,true);assert.match(text(tree),/完整的 4\/4/)
jamSelect('和弦 2 时长','2');assert.equal(jamButton().props.disabled,false)
jamSelect('和弦 3 时长','8');jamAction('复制和弦 1').props.onClick();render();assert.equal(jamRoots().length,5)
jamAction('删除和弦 2').props.onClick();render();assert.equal(jamRoots().length,4)
jamAction('下移和弦 1').props.onClick();render();assert.equal(jamRoots()[0],'G');jamAction('上移和弦 2').props.onClick();render()
jamSelect('和弦 2 根音','F♯');assert.match(text(tree),/调外和弦/);jamSelect('和弦 2 根音','G')
await jamButton().props.onClick();render();assert.equal(jamButton().props['aria-pressed'],true);assert.equal(globalThis.__jamUI.starts.at(-1).countIn,true);assert.match(text(tree),/预备拍/)
const applied=globalThis.__jamUI.starts.at(-1).cycle
jamSelect('和弦 1 根音','D');assert.match(text(tree),/待下一轮/)
find(n=>n.type==='input'&&n.props['aria-label']==='Jam BPM').props.onChange({target:{value:'120'}});render();assert.equal(globalThis.__jamUI.bpm,120);assert.match(text(tree),/待下一小节/)
find(n=>n.type==='input'&&n.props['aria-label']==='静音贝斯').props.onChange({target:{checked:true}});render();assert.equal(globalThis.__jamUI.mixers.at(-1).muted.bass,true)
find(n=>n.type==='input'&&n.props['aria-label']==='主音量').props.onChange({target:{value:'35'}});render();assert.equal(globalThis.__jamUI.mixers.at(-1).master,.35)
find(n=>n.type==='input'&&n.props['aria-label']==='Jam BPM').props.onChange({target:{value:''}});render();assert.equal(jamButton().props.disabled,false,'空速度也能停止')
await jamButton().props.onClick();render();assert.equal(jamButton().props['aria-pressed'],false);assert.equal(jamButton().props.disabled,true)
find(n=>n.type==='input'&&n.props['aria-label']==='Jam BPM').props.onChange({target:{value:'90'}});render()
const rootsBeforeTuning=jamRoots();await jamButton().props.onClick();render();const stopCount=globalThis.__jamUI.stops
navigate('settings');choose('drop-d');navigate('jam');assert.ok(globalThis.__jamUI.stops>stopCount);assert.deepEqual(jamRoots(),rootsBeforeTuning);assert.equal(jamButton().props['aria-pressed'],false)
navigate('settings');soundCheckbox().props.onChange({target:{checked:false}});render();navigate('jam');assert.equal(jamButton().props.disabled,true);jamAction('启用声音').props.onClick();render();assert.equal(jamButton().props.disabled,false)
globalThis.__jamUI.fail=true;await jamButton().props.onClick();render();assert.match(text(tree),/启动失败/);assert.equal(jamButton().props['aria-pressed'],false);globalThis.__jamUI.fail=false
jamSelect('Jam 预设','single-major');jamAction('应用预设').props.onClick();render();assert.equal(jamRoots().length,1)
assert.equal(applied.bars,4)
navigate('settings');choose('standard');navigate('fretboard')
// J2 controls dispatch actual configuration and preserve independent locks.
navigate('jam')
jamSelect('Jam 预设','minor');jamAction('应用预设').props.onClick();render()
jamSelect('Jam 风格','pop');jamSelect('吉他音色','keys')
const checked=(label,value)=>{find(n=>n.type==='input'&&n.props['aria-label']===label).props.onChange({target:{checked:value}});render()}
checked('锁定和弦 1',true);const lockedRoot=jamRoots()[0]
jamAction('换一组进行').props.onClick();render();assert.equal(jamRoots()[0],lockedRoot);assert.equal(find(n=>n.type==='input'&&n.props['aria-label']==='锁定和弦 1').props.checked,true)
jamSelect('Jam 预设','minor');jamAction('应用预设').props.onClick();render()
jamSelect('Jam 风格','funk');assert.equal(find(n=>n.type==='select'&&n.props['aria-label']==='鼓节奏型').props.value,'sync');assert.equal(find(n=>n.type==='select'&&n.props['aria-label']==='贝斯节奏型').props.value,'sync')
checked('锁定鼓声部',true);await jamButton().props.onClick();render()
const beforeRegenerate=globalThis.__jamUI.starts.at(-1).cycle.config
jamAction('重新编配').props.onClick();render();const afterRegenerate=globalThis.__jamUI.updates.at(-1).config
assert.deepEqual(afterRegenerate.parts.drums,beforeRegenerate.parts.drums);assert.notEqual(afterRegenerate.parts.bass.seed,beforeRegenerate.parts.bass.seed)
jamSelect('贝斯节奏型','long');assert.equal(globalThis.__jamUI.parts.parts.bass.pattern,'long');assert.equal(find(n=>n.type==='select'&&n.props['aria-label']==='Jam 风格').props.value,'custom')
jamAction('保存此伴奏').props.onClick();render();assert.match(text(tree),/已保存到此浏览器/)
jamAction('加载').props.onClick();render();assert.equal(jamButton().props['aria-pressed'],false);assert.match(text(tree),/已加载/)
const rename=find(n=>n.type==='input'&&String(n.props['aria-label']).startsWith('重命名 '));rename.props.onChange({target:{value:'测试伴奏'}});render();assert.ok(savedTheme.get('saguadlib-jam-saved-v2').includes('测试伴奏'))
jamAction('删除收藏 测试伴奏').props.onClick();render();assert.match(text(tree),/还没有保存的伴奏/)
jamSelect('Jam 预设','jazz-minor');jamAction('应用预设').props.onClick();render();assert.equal(find(n=>n.type==='select'&&n.props['aria-label']==='Jam 调式').props.value,'harmonic-minor')
console.log('通过：J2分类预设同步调式、换进行保留锁定、三风格实际参数、声部锁定重新编配、单声部下小节操作、收藏保存/加载/重命名/删除及加载停止')

console.log('通过：J1默认/显式预设、整体移调/调式不覆盖、卡片增删复制排序、半小节无效提示、预备拍/开始停止/待应用、即时混音、调弦独立/静音/失败及离页停止')
// 音阶独立选择、共享设置、单音不改主音、试听及显示状态。
assert.deepEqual(nodes(byClass('desktop-navigation')).filter(n=>n.type==='a').map(text),['指板与音准','音阶','和弦','Jam Session','扒谱','设置','简介'])
navigate('scales')
const scaleSelect=(name,value)=>{find(n=>n.type==='select'&&n.props['aria-label']===name).props.onChange({target:{value}});render()}
const scaleButton=name=>find(n=>n.type==='button'&&(text(n)===name||text(n)===name+' · 播放中'))
const scaleNames=()=>nodes(tree).filter(n=>n.type==='strong'&&nodes(byClass('chord-tones scale-tones')).includes(n)).map(text)
assert.deepEqual(scaleNames(),['C','D','E','F','G','A','B']);assert.equal(boardButtons().length,150)
assert.equal(find(n=>n.type==='select'&&n.props['aria-label']==='音阶显示方式').props.value,'degree')
assert.equal(find(n=>n.type==='details').props.open,undefined)
scaleSelect('音阶主音','D');scaleSelect('音阶类型','dorian');assert.deepEqual(scaleNames(),['D','E','F','G','A','B','C'])
assert.equal(text(byClass('scale-formula')),'公式：I、II、♭III、IV、V、VI、♭VII')
scaleSelect('音阶主音','A');scaleSelect('音阶类型','minor-pentatonic');assert.deepEqual(scaleNames(),['A','C','D','E','G'])
await click(6,3);assert.equal(find(n=>n.type==='select'&&n.props['aria-label']==='音阶主音').props.value,'A');assert.equal(globalThis.__scaleUI.plays.at(-1).pitches[0].midi,43)
assert.ok(boardButtons().filter(n=>n.props.className.includes('scale-playing')).length>0)
scaleButton('上行').props.onClick();await Promise.resolve();render();scaleButton('上行').props.onClick();render();assert.ok(boardButtons().every(n=>!n.props.className.includes('scale-playing')))
scaleSelect('音阶显示方式','both');assert.match(text(boardButtons()[0]),/[A-G]/)
find(n=>n.type==='input'&&n.props['aria-label']==='试听速度').props.onChange({target:{value:'300'}});render();scaleButton('上行＋下行').props.onClick();await Promise.resolve();render()
const sequence=globalThis.__scaleUI.plays.at(-1);assert.equal(sequence.bpm,300);assert.equal(sequence.pitches.length,11);assert.equal(sequence.pitches[0].midi,sequence.pitches.at(-1).midi)
const beforeLeave=globalThis.__scaleUI.stops;navigate('chords');assert.ok(globalThis.__scaleUI.stops>beforeLeave)
assert.match(text(byClass('chord-description')),/C · 大三和弦/)
navigate('scales');assert.deepEqual(scaleNames(),['A','C','D','E','G'])
navigate('settings');choose('facgce');navigate('scales');await click(6,0);assert.equal(globalThis.__scaleUI.plays.at(-1).pitches[0].midi,41)
navigate('settings');soundCheckbox().props.onChange({target:{checked:false}});render();navigate('scales');assert.equal(scaleButton('上行').props.disabled,true)
scaleButton('启用声音').props.onClick();render();assert.equal(scaleButton('上行').props.disabled,false)
assert.ok(!text(tree).includes('试听结束'))
scaleButton('随机').props.onClick();await Promise.resolve();render();assert.equal(globalThis.__scaleUI.plays.at(-1).random,true)
const randomCount=globalThis.__scaleUI.plays.length
find(n=>n.type==='input'&&n.props['aria-label']==='试听速度').props.onChange({target:{value:'120'}});render();assert.equal(globalThis.__scaleUI.bpm,120);assert.equal(globalThis.__scaleUI.plays.length,randomCount)
for(const value of ['', '59','301','invalid']){find(n=>n.type==='input'&&n.props['aria-label']==='试听速度').props.onChange({target:{value}});render();assert.equal(scaleButton('随机').props.disabled,false,'无效输入时当前播放按钮仍能停止');assert.equal(scaleButton('上行').props.disabled,true);assert.equal(globalThis.__scaleUI.bpm,120)}
find(n=>n.type==='input'&&n.props['aria-label']==='试听速度').props.onChange({target:{value:'60'}});render();scaleButton('随机').props.onClick();render();assert.equal(scaleButton('随机').props['aria-pressed'],false)
for(const label of ['上行','下行','上行＋下行','随机']){
 scaleButton(label).props.onClick();await Promise.resolve();render();assert.equal(scaleButton(label).props['aria-pressed'],true);assert.equal(globalThis.__scaleUI.plays.at(-1).loop,true)
 scaleButton(label).props.onClick();render();assert.equal(scaleButton(label).props['aria-pressed'],false)
}
assert.equal(nodes(tree).some(n=>n.type==='button'&&text(n)==='停止'),false)
scaleButton('上行').props.onClick();await Promise.resolve();render();scaleButton('随机').props.onClick();await Promise.resolve();render();assert.equal(scaleButton('上行').props['aria-pressed'],false);assert.equal(scaleButton('随机').props['aria-pressed'],true);scaleButton('随机').props.onClick();render()
globalThis.__scaleUI.fail=true;scaleButton('上行').props.onClick();await Promise.resolve();await Promise.resolve();render();assert.match(text(byClass('scale-status')),/无法播放/);globalThis.__scaleUI.fail=false
navigate('settings');choose('standard');navigate('scales');scaleSelect('音阶主音','C');scaleSelect('音阶类型','major')
console.log('通过：导航顺序、音阶三组组成音、150位置、单音不改变主音、试听速度/高亮/停止、独立页面状态、FACGCE/静音/播放失败')
// 升级和弦页：真实指型、单双击、锁定后单音、参考音阶、分页及共享设置。
navigate('chords')
const chordSelect=(name,value)=>{find(node=>node.type==='select'&&node.props['aria-label']===name).props.onChange({target:{value}});render()}
const chordButton=name=>find(node=>node.type==='button'&&text(node)===name)
const chordCell=(string,fret)=>boardButtons()[(string-1)*25+fret]
const sounding=()=>boardButtons().flatMap((button,index)=>button.props.className.includes('shape-sounding')?[{string:Math.floor(index/25)+1,fret:index%25}]:[])
const assertPlayedPositions=()=>{
  const actual=globalThis.__chordAudioChecks.plays.at(-1).pitches
  assert.deepEqual(actual.map(p=>[p.string,p.fret]).sort(),sounding().map(p=>[p.string,p.fret]).sort())
  assert.equal(new Set(actual.map(p=>p.string)).size,actual.length)
}
chordSelect('和弦类型','minor')
assert.match(text(byClass('chord-description')),/Cm · 小三和弦/)
assert.equal(text(byClass('chord-tones')),'C1E♭♭3G5')
assert.equal(boardButtons().length,150)
assert.equal(find(node=>node.type==='details').props.open,undefined,'说明默认折叠')
assert.ok(!nodes(tree).some(node=>node.props?.className==='chord-legend'||node.props?.className==='chord-voicing'))
await click(6,0);assert.match(text(byClass('chord-description')),/Em · 小三和弦/)
assert.equal(text(chordCell(6,1)),'F','未锁定显示实际音名')
assertPlayedPositions()
const anchorButton=chordCell(6,0), playsBeforeDouble=globalThis.__chordAudioChecks.plays.length
anchorButton.props.onClick({detail:1,timeStamp:1000});anchorButton.props.onClick({detail:2,timeStamp:1100});render()
chordCell(6,0).props.onDoubleClick({timeStamp:1101});render()
assert.equal(globalThis.__chordAudioChecks.plays.length,playsBeforeDouble,'双击不触发两次整组播放')
assert.match(text(byClass('root-lock')),/已锁定/)
await click(6,1)
assert.match(text(byClass('root-lock')),/已锁定 · E/)
assert.equal(globalThis.__chordAudioChecks.plays.at(-1).pitches.length,1)
assert.equal(globalThis.__chordAudioChecks.plays.at(-1).pitches[0].midi,41)
assert.match(chordCell(6,1).props.className,/chord-outside/)
assert.equal(text(chordCell(6,1)),'F')
chordSelect('参考音阶','lydian');assert.match(text(byClass('reference-control')),/E · 利底亚/)
assert.match(text(byClass('root-lock')),/已锁定 · E/)
chordButton('解锁根音').props.onClick();render();assert.match(text(byClass('root-lock')),/未锁定/)
await chordButton('播放').props.onClick({detail:0});render();assertPlayedPositions()
await chordButton('琶音 arpeggio').props.onClick();render();assertPlayedPositions()
assert.equal(globalThis.__chordAudioChecks.plays.at(-1).mode,'sequence')
const totalPagesText=text(byClass('candidate-pages'))
chordButton('下一页').props.onClick();render();assert.notEqual(text(byClass('candidate-pages')),totalPagesText)
find(node=>node.type==='button'&&node.props.className?.startsWith('fingering-card')).props.onClick();render();assertPlayedPositions()
chordSelect('和弦类别','扩展');chordSelect('和弦类型','13')
await click(5,3);assert.match(text(byClass('chord-description')),/C13/)
assert.match(text(byClass('current-fingering')),/省略音/)
assertPlayedPositions()
chordSelect('和弦类别','基础');chordSelect('和弦类型','major')
navigate('settings');choose('drop-d');navigate('chords')
await click(6,0);assert.match(text(byClass('root-lock')),/未锁定 · D/)
assertPlayedPositions()
const actual=globalThis.__chordAudioChecks.plays.at(-1).pitches
assert.ok(actual.every(p=>p.midi===[64,59,55,50,45,38][p.string-1]+p.fret))
// 有其他位置的常用模板，不代表任意所选位置都能用；不自动换成虚拟配音。
chordSelect('和弦类别','基础');chordSelect('和弦类型','major')
navigate('settings');choose('standard');navigate('chords')
await click(6,24);assert.match(text(byClass('chord-control-panel')),/该位置暂无常用指型/)
assert.equal(chordButton('播放').props.disabled,true)
navigate('settings');choose('drop-d');navigate('chords')
await click(6,0)
const bandSelect=find(node=>node.type==='select'&&node.props['aria-label']==='指型把位')
bandSelect.props.onChange({target:{value:'open'}});render()
assert.ok(nodes(tree).filter(node=>node.type==='button'&&node.props.className?.startsWith('fingering-card')).every(node=>text(node).includes('开放')))
find(node=>node.type==='select'&&node.props['aria-label']==='指型把位').props.onChange({target:{value:'all'}});render()

// 鼠标/触屏取消、键盘长按及窗口失焦都走同一取消路径。
const originalSetTimeout=globalThis.setTimeout, originalClearTimeout=globalThis.clearTimeout
let holdCallback=null
// 只在这段手势检查中推进 220ms，不等待真实墙钟时间。
globalThis.setTimeout=(callback,ms)=>{assert.equal(ms,220);holdCallback=callback;return 1}
globalThis.clearTimeout=()=>{holdCallback=null}
const pointer={button:0,pointerId:1,preventDefault(){},currentTarget:{focus(){},setPointerCapture(){},getBoundingClientRect(){return {left:0,right:100,top:0,bottom:40}}}}
for(const eventName of ['onPointerCancel','onPointerLeave','onLostPointerCapture']){
 chordButton('播放').props.onPointerDown(pointer)
 holdCallback();render()
 assert.equal(globalThis.__chordAudioChecks.plays.at(-1).mode,'hold')
 const stops=globalThis.__chordAudioChecks.stops
 chordButton('播放').props[eventName]();render()
 assert.ok(globalThis.__chordAudioChecks.stops>stops)
}
chordButton('播放').props.onPointerDown(pointer);holdCallback();render()
chordButton('播放').props.onPointerMove({...pointer,clientX:101,clientY:20});render()
assert.equal(chordButton('播放').props['aria-pressed'],false)
chordButton('播放').props.onPointerDown(pointer);holdCallback();render()
listeners.get('blur').forEach(fn=>fn());render();assert.equal(chordButton('播放').props['aria-pressed'],false)
let prevented=0
chordButton('播放').props.onKeyDown({key:' ',repeat:false,preventDefault(){prevented++}});holdCallback();render()
const repeatedPlays=globalThis.__chordAudioChecks.plays.length
chordButton('播放').props.onKeyDown({key:' ',repeat:true,preventDefault(){prevented++}})
assert.equal(globalThis.__chordAudioChecks.plays.length,repeatedPlays)
chordButton('播放').props.onKeyUp({key:' ',preventDefault(){prevented++}});render()
assert.equal(prevented,3);assert.equal(chordButton('播放').props['aria-pressed'],false)
globalThis.setTimeout=originalSetTimeout;globalThis.clearTimeout=originalClearTimeout
// 小图从同一个指型生成：左侧6弦、右侧1弦、五品窗口、横按与根音标记。
const diagramSvg=nodes(tree).find(node=>node.type==='svg'&&node.props.className==='fingering-diagram')
assert.ok(diagramSvg)
const markers=nodes(diagramSvg).filter(node=>node.type==='g'&&['diagram-root','diagram-member'].includes(node.props.className))
assert.equal(markers.filter(node=>['diagram-root','diagram-member'].includes(node.props.className)).length,6)
assert.deepEqual(markers.filter(node=>['diagram-root','diagram-member'].includes(node.props.className)).map(node=>node.key),['1','2','3','4','5','6'])
assert.equal(nodes(diagramSvg).filter(node=>node.type==='text'&&node.props.className==='diagram-string').map(text).join(''),'654321')
console.log('通过：长按移出/取消/捕获丢失/失焦、键盘重复键保护、释放，六弦 SVG 顺序与同源图示')

chordSelect('和弦类别','变化');chordSelect('和弦类型','7b9#11b13')
assert.match(text(byClass('chord-control-panel')),/暂无已验证常用指型/)
chordSelect('和弦类别','基础');chordSelect('和弦类型','major')
navigate('settings');choose('facgce');navigate('chords')
assert.match(text(byClass('chord-control-panel')),/当前调弦暂无已验证常用指型/)
chordButton('锁定根音').props.onClick();render();const beforeSingle=globalThis.__chordAudioChecks.plays.length
await click(6,0);assert.equal(globalThis.__chordAudioChecks.plays.length,beforeSingle+1)
assert.equal(globalThis.__chordAudioChecks.plays.at(-1).pitches.length,1)
assert.equal(globalThis.__chordAudioChecks.plays.at(-1).pitches[0].midi,41)
chordSelect('和弦类别','基础');chordSelect('和弦类型','major')
navigate('settings');choose('drop-d');navigate('chords')

navigate('settings');soundCheckbox().props.onChange({target:{checked:false}});render();navigate('chords')
assert.equal(chordButton('播放').props.disabled,true)
for(const id of ['fretboard','chords','scales','jam','transcription','settings','about']) {navigate(id);assert.match(text(byClass('site-footer')),/1145141919810/)}
navigate('settings');find(node=>node.type==='button'&&text(node)==='恢复默认设置').props.onClick();render();navigate('fretboard')
console.log('通过：实际指型/大指板/播放一致、双击不重播、锁定单音、参考音阶、候选分页、13 省略、Drop D、静音与页脚')

window.location.hash = '#/unknown'; render()
assert.equal(boardButtons().length, 150)
assert.equal(nodes(tree).filter((node) => node.type === 'a' && node.props['aria-current'] === 'page').length, 1)
console.log('通过：七板块导航、占位无假按钮、跨页共享调弦/主题/声音、返回保留位置、刷新偏好与恢复默认')
console.log(`主题 ${initialTheme}：品牌及主题切换通过，功能检查如下`)
console.log('通过：隐藏 → 6 弦 3 品不揭晓 → 点击详情 G2 → 5 弦 3 品重置 → 点击详情 C3')
console.log('通过：未选位置不揭晓、鼠标/触屏点击处理器、Enter/空格、其他按键及控件不揭晓')
console.log('通过：显示模式直接显示、隐藏模式与调弦重置、无声猜音、150 个按钮、自定义验证与应用')
delete globalThis.__chordAudioChecks
delete globalThis.__guitarTestHooks

delete globalThis.window
delete globalThis.document
