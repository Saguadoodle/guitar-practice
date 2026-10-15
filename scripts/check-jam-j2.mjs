import assert from 'node:assert/strict'
import {createModuleLoader} from './load-ts.mjs'
const load=createModuleLoader()
const {JAM_PRESETS,presetCards,generateProgression}=await import(load('src/jamPresets.ts'))
const {JAM_MODES}=await import(load('src/jamPresets.ts'))
const {analyzeJamCard,DEFAULT_JAM,validateProgression,transposeProgression}=await import(load('src/jam.ts'))
const {compileJam,barEvents}=await import(load('src/jamArrangement.ts'))
const {defaultJamConfig,applyStyle,regenerate,normalizeJamConfig,PATTERNS,TIMBRES}=await import(load('src/jamConfig.ts'))
const {TUNING_PRESETS,NOTE_OPTIONS,STANDARD_TUNING}=await import(load('src/pitch.ts'))
const {buildChord,CHORD_TYPES}=await import(load('src/chords.ts'))
const {pitchedJamSamples}=await import(load('src/jamTimbres.ts'))
const storage=await import(load('src/jamStorage.ts'))
const config=defaultJamConfig()
for(const p of JAM_PRESETS)for(const root of NOTE_OPTIONS){
 const cards=presetCards(p,root);assert.equal(validateProgression(cards).errors.length,0,p.id)
 assert.deepEqual(cards.map(c=>c.beats),p.entries.map(e=>e[2]??4))
 cards.forEach((c,i)=>{const chord=buildChord(c.root,c.type);assert.equal(chord.rootClass,(buildChord(root,'major').rootClass+p.entries[i][0])%12);assert.equal(c.type,p.entries[i][1]);assert.ok(analyzeJamCard(c,root,p.mode).roman,`${p.id} ${root} ${c.root} 级数`)})
}
assert.equal(presetCards(JAM_PRESETS.find(p=>p.id==='blues'),'C').length,12)
for(const [id,root,expected] of [['dorian','D',['i7','IV7']],['mixolydian','C',['I','♭VII','IV']],['minor','A',['i','VI','III','VII']],['jazz-minor','A',['iiø7','V7','i']]]){const p=JAM_PRESETS.find(p=>p.id===id);assert.deepEqual(presetCards(p,root).map(c=>analyzeJamCard(c,root,p.mode).roman),expected)}
const jazz=presetCards(JAM_PRESETS.find(p=>p.id==='jazz-minor'),'A')
assert.deepEqual(jazz.map(c=>buildChord(c.root,c.type).name),['Bm7♭5','E7','Am'])
assert.ok(buildChord(jazz[1].root,jazz[1].type).tones.some(t=>t.noteName==='G♯'))
for(const [mode] of JAM_MODES){const cards=presetCards(JAM_PRESETS.find(p=>p.mode===mode),'A');cards[0].locked=true;cards[0].beats=8;cards[1]&&(cards[1].locked=true)
 const generated=generateProgression(cards,'A',mode,123);assert.deepEqual(generated[0],cards[0]);if(cards[1])assert.deepEqual(generated[1],cards[1]);assert.equal(validateProgression(generated).errors.length,0)}
for(const [mode] of JAM_MODES){const initial=presetCards(JAM_PRESETS.find(p=>p.mode===mode),'A'),next=generateProgression(initial,'A',mode,15);assert.notDeepEqual(next.map(c=>[c.root,c.type,c.beats]),initial.map(c=>[c.root,c.type,c.beats]),mode+' 有未锁定可生成方案')}
const locked=structuredClone(config);locked.parts.drums.locked=true
const regen=regenerate(locked);assert.deepEqual(regen.parts.drums,locked.parts.drums);assert.notEqual(regen.parts.bass.seed,locked.parts.bass.seed);assert.deepEqual(regenerate(locked,'drums'),locked)
assert.deepEqual(compileJam(DEFAULT_JAM,locked).events.filter(e=>e.part==='drums'),compileJam(DEFAULT_JAM,regen).events.filter(e=>e.part==='drums'),'锁定鼓的实际事件保持，不仅是参数相同')
const regenerated=regenerate(config,'bass');assert.deepEqual(regenerated.parts.drums,config.parts.drums);assert.deepEqual(regenerated.parts.chords,config.parts.chords)
for(const style of ['pop','funk','ambient']){
 const c=applyStyle(config,style),a=compileJam(DEFAULT_JAM,c),b=compileJam(DEFAULT_JAM,structuredClone(c));assert.deepEqual(a,b);assert.equal(a.issues.length,0)
 for(const event of a.events){assert.ok(event.duration>0&&event.level>0&&Number.isFinite(event.duration));assert.ok(event.beat>=0&&event.beat<a.beats)}
}
assert.notDeepEqual(compileJam(DEFAULT_JAM,applyStyle(config,'pop')).events,compileJam(DEFAULT_JAM,applyStyle(config,'funk')).events)
assert.notDeepEqual(compileJam(DEFAULT_JAM,applyStyle(config,'funk')).events,compileJam(DEFAULT_JAM,applyStyle(config,'ambient')).events)
// 每个节奏型确实改变事件；各参数在对应节奏下生效。
const eventPart=(c,part)=>compileJam(DEFAULT_JAM,c).events.filter(e=>e.part===part)
for(const part of ['drums','bass','chords']){
 const signatures=new Set(PATTERNS[part].map(([pattern])=>{const c=structuredClone(config);c.parts[part].pattern=pattern;c.parts[part].density=1;return JSON.stringify(eventPart(c,part))}));assert.equal(signatures.size,PATTERNS[part].length,part)
 for(const [timbre] of TIMBRES[part]){const c=structuredClone(config);c.parts[part].timbre=timbre;assert.ok(eventPart(c,part).every(e=>e.timbre===timbre))}
 const c=structuredClone(config);c.parts[part].density=0;const sparse=eventPart(c,part);c.parts[part].density=1;assert.ok(eventPart(c,part).length>sparse.length,`${part} density`)
}
for(const [part,key,values,pattern] of [['drums','hat',[1,2,4],'backbeat'],['drums','hat',[1,2,4],'sixteenth'],['drums','fill',[0,4,8],'backbeat'],['drums','velocity',[0,1],'rock'],['bass','register',[-12,0,12],'fifth'],['bass','length',[.2,.9],'quarter'],['bass','approach',[0,1],'eighth'],['chords','length',[.2,1.5],'arp'],['chords','direction',['up','down','alternate'],'eighth'],['chords','spread',[0,100],'eighth'],['chords','arp',['up','down','bounce'],'arp']]){
 const signatures=new Set(values.map(value=>{const c=structuredClone(config);c.parts[part][key]=value;c.parts[part].pattern=pattern;c.parts[part].density=1;const eight=[...DEFAULT_JAM,...DEFAULT_JAM.map(c=>({...c,id:'second-'+c.id}))];return JSON.stringify(compileJam(eight,c).events.filter(e=>e.part===part))}));assert.equal(signatures.size,values.length,`${part} ${key}`)
}
const silentDrums=structuredClone(config);silentDrums.parts.drums.density=0
for(let bar=0;bar<4;bar++){const events=barEvents(compileJam(DEFAULT_JAM,silentDrums),bar);assert.ok(events.some(e=>e.drum==='kick'&&e.beat===0));assert.ok(events.some(e=>e.drum==='snare'&&e.beat===1));assert.ok(events.some(e=>e.drum==='snare'&&e.beat===3))}
// 吉他事件来自同一实际指型，按弦序扫弦，不是按 MIDI 排序冒充扫弦。
for(const tuning of TUNING_PRESETS.slice(0,3).map(p=>p.tuning)){
 const cycle=compileJam(DEFAULT_JAM,config,tuning);assert.equal(cycle.issues.length,0)
 for(let i=0;i<cycle.cards.length;i++){const g=cycle.guitars[i];assert.equal(g.midis.length,new Set(g.strings).size);g.midis.forEach((m,j)=>assert.equal(m,tuning[g.strings[j]-1].midi+g.frets[g.strings[j]-1]));cycle.events.filter(e=>e.part==='chords'&&e.beat>=cycle.starts[i]&&e.beat<cycle.starts[i]+cycle.cards[i].beats).forEach(e=>assert.ok(g.midis.includes(e.midi)))}
}
for(const tuning of [TUNING_PRESETS[3].tuning,STANDARD_TUNING.map((o,i)=>({...o,midi:o.midi+(i===3?1:0)}))])assert.equal(compileJam(DEFAULT_JAM,config,tuning).issues.length,4)
const keys=structuredClone(config);keys.parts.chords.timbre='keys';assert.equal(compileJam(DEFAULT_JAM,keys,TUNING_PRESETS[3].tuning).issues.length,0)
for(const type of CHORD_TYPES){const card={id:'all-types',root:'C',type:type.id,beats:4},cycle=compileJam([card],keys),pcs=buildChord('C',type.id).tones.map(t=>t.pitchClass);assert.equal(cycle.issues.length,0);cycle.events.filter(e=>e.part==='chords').forEach(e=>{assert.ok(pcs.includes(e.midi%12));assert.ok(e.midi>=55&&e.midi<=79)})}
for(const part of ['bass','chords']){const waves=TIMBRES[part].map(([id])=>pitchedJamSamples(57,8000,.4,id));for(let i=0;i<waves.length;i++){assert.ok(waves[i].every(v=>Number.isFinite(v)&&Math.abs(v)<=.25));for(let j=0;j<i;j++)assert.notDeepEqual(waves[i],waves[j])}}
// 短进行也遵守每4/8小节过门，完整编配周期原样重复。
for(const fill of [4,8]){const c=structuredClone(config);c.parts.drums.fill=fill;const cycle=compileJam([DEFAULT_JAM[0]],c);assert.equal(cycle.bars,fill);assert.equal(cycle.sourceCards.length,1);const rolls=cycle.events.filter(e=>e.drum==='snare'&&e.beat%4===3.25);assert.equal(rolls.length,1);assert.equal(Math.floor(rolls[0].beat/4)+1,fill);assert.deepEqual(barEvents(cycle,fill-1,1),barEvents(cycle,fill-1,2))}
const fixed=compileJam(DEFAULT_JAM,config);assert.deepEqual(barEvents(fixed,0,1),barEvents(fixed,0,9))
const varied=compileJam(DEFAULT_JAM,{...config,variation:'subtle'});assert.notDeepEqual(barEvents(varied,0,1),barEvents(varied,0,2));assert.deepEqual(barEvents(varied,0,1),barEvents(varied,0,9))
assert.deepEqual(compileJam(DEFAULT_JAM,config),compileJam(DEFAULT_JAM,normalizeJamConfig(config)))
const map=new Map();globalThis.localStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)}
const snapshot={...storage.defaultSnapshot(),config:regen,cards:transposeProgression(DEFAULT_JAM,'A','C'),bpm:123};snapshot.cards[0].locked=true
assert.equal(storage.writeJamStorage(storage.JAM_PREFERENCE_KEY,snapshot),true);assert.deepEqual(storage.readJamPreferences(),storage.normalizeSnapshot(snapshot))
const saved=[{id:'test',name:'Am–F–C–G',data:snapshot}];storage.writeJamStorage(storage.JAM_SAVED_KEY,saved);assert.deepEqual(storage.readSavedJams(),saved.map(s=>({...s,data:storage.normalizeSnapshot(s.data)})))
map.delete(storage.JAM_PREFERENCE_KEY);assert.deepEqual(storage.readSavedJams(),saved.map(s=>({...s,data:storage.normalizeSnapshot(s.data)})),'重置偏好不删除收藏')
const old=storage.normalizeSnapshot({version:1,root:'C',bpm:120,cards:DEFAULT_JAM,config:{parts:{bass:{timbre:'round',pattern:'not-known',density:100}}}});assert.equal(old.root,'C');assert.equal(old.bpm,120);assert.equal(old.config.parts.bass.density,1);assert.equal(old.config.parts.bass.pattern,config.parts.bass.pattern)
for(const value of ['broken','{}','null','[{"id":"bad"}]']){map.set(storage.JAM_SAVED_KEY,value);assert.deepEqual(storage.readSavedJams(),[])}
globalThis.localStorage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};assert.deepEqual(storage.readJamPreferences(),storage.defaultSnapshot());assert.equal(storage.writeJamStorage('x',snapshot),false)
console.log('通过：19套进行/21主音/准确级数与时长、锁定、三风格与全部节奏/音色/参数参与事件、模板吉他/无模板提示、固定/八轮变化、种子复现、收藏与旧字段兼容')
