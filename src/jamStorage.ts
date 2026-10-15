import { defaultJamConfig, normalizeJamConfig } from './jamConfig'
import type { JamConfig } from './jamConfig'
import { DEFAULT_JAM, validateProgression } from './jam'
import type { JamCard, JamMode } from './jam'
import { defaultJamMixer } from './jamAudio'
import type { JamMixer } from './jamAudio'
import { JAM_MODES } from './jamPresets'
import { NOTE_OPTIONS, STANDARD_TUNING, parseOpenString } from './pitch'
import type { Tuning } from './pitch'
export const JAM_PREFERENCE_KEY='saguadlib-jam-preferences-v2'
export const JAM_SAVED_KEY='saguadlib-jam-saved-v2'
export type JamSnapshot={version:2;root:string;mode:JamMode;cards:JamCard[];bpm:number;countIn:boolean;config:JamConfig;mixer:JamMixer;tuning:Tuning}
export type SavedJam={id:string;name:string;data:JamSnapshot}
export function defaultSnapshot():JamSnapshot{return {version:2,root:'A',mode:'minor',cards:DEFAULT_JAM.map(c=>({...c})),bpm:90,countIn:true,config:defaultJamConfig(),mixer:defaultJamMixer(),tuning:STANDARD_TUNING}}
/** 字段独立校验；未知版本保留已知合法字段，非法值使用默认。 */
export function normalizeSnapshot(raw:unknown):JamSnapshot{
 const d=defaultSnapshot(),s=raw&&typeof raw==='object'?raw as Partial<JamSnapshot>:{}
 const mixer={...d.mixer,muted:{...d.mixer.muted}}
 if(s.mixer&&typeof s.mixer==='object'){
  for(const key of ['master','drums','bass','chords'] as const)if(Number.isFinite(s.mixer[key]))mixer[key]=Math.max(0,Math.min(1,s.mixer[key]))
  for(const key of ['drums','bass','chords'] as const)mixer.muted[key]=s.mixer.muted?.[key]===true
 }
 let cards=d.cards
 if(Array.isArray(s.cards)&&s.cards.every(c=>c&&typeof c==='object')&&!validateProgression(s.cards).errors.length)cards=s.cards.map(c=>({id:String(c.id),root:c.root,type:c.type,beats:c.beats,locked:c.locked===true}))
 let tuning:Tuning=d.tuning
 try{if(Array.isArray(s.tuning)&&s.tuning.length===6&&s.tuning.every(o=>o&&parseOpenString(o.noteName,String(o.octave)).midi===o.midi))tuning=s.tuning.map(o=>({...o}))}catch{/* 旧收藏没有有效调弦时使用标准调弦。 */}
 return {version:2,tuning,root:NOTE_OPTIONS.some(n=>n===s.root)?s.root!:d.root,mode:JAM_MODES.some(([id])=>id===s.mode)?s.mode!:d.mode,cards,bpm:typeof s.bpm==='number'&&Number.isFinite(s.bpm)&&s.bpm>=60&&s.bpm<=300?s.bpm:d.bpm,countIn:typeof s.countIn==='boolean'?s.countIn:d.countIn,config:normalizeJamConfig(s.config),mixer}
}
export function readJamPreferences(){try{return normalizeSnapshot(JSON.parse(localStorage.getItem(JAM_PREFERENCE_KEY)??'null'))}catch{return defaultSnapshot()}}
export function readSavedJams():SavedJam[]{try{const value=JSON.parse(localStorage.getItem(JAM_SAVED_KEY)??'[]');if(!Array.isArray(value))return [];const seen=new Set();return value.filter(v=>{if(!v||typeof v.id!=='string'||typeof v.name!=='string'||!v.data||seen.has(v.id))return false;seen.add(v.id);return true}).slice(0,100).map(v=>({id:v.id,name:v.name.slice(0,80),data:normalizeSnapshot(v.data)}))}catch{return []}}
export function writeJamStorage(key:string,value:unknown){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}}
