// 用与页面相同的旋律生成器和拨弦合成渲染可试听片段，不声称代替主观听感验收。
import fs from 'node:fs'
import path from 'node:path'
import {createModuleLoader} from './load-ts.mjs'
const load=createModuleLoader()
const {createMelody}=await import(load('src/melody.ts'))
const {buildScale,scalePlayback,stablePitchClasses}=await import(load('src/scales.ts'))
const {STANDARD_TUNING}=await import(load('src/pitch.ts'))
const {createPluckSamples,midiToFrequency}=await import(load('src/audio.ts'))
const output=path.resolve(process.argv[2]??'/private/tmp/saguadlib-melody-samples')
fs.mkdirSync(output,{recursive:true})
const manifest=[]
for(const [root,id,bpm,seedValue]of [['C','major',120,42],['A','harmonic-minor',100,731],['D','dorian',120,1234]]){
 let seed=seedValue;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/2**32}
 const scale=buildScale(root,id),sequence=scalePlayback(scale,STANDARD_TUNING,'up')
 const melody=createMelody(sequence.pitches,scale.rootClass,stablePitchClasses(scale),random)
 const notes=Array.from({length:64},()=>melody.next()),sampleRate=24000,interval=60/bpm/4
 const samples=new Float32Array(Math.ceil((notes.length*interval+.1)*sampleRate))
 notes.forEach((pitch,i)=>{const wave=createPluckSamples(midiToFrequency(pitch.midi),sampleRate,interval*.92),start=Math.round(i*interval*sampleRate);samples.set(wave,start)})
 const wave=Buffer.alloc(44+samples.length*2)
 wave.write('RIFF');wave.writeUInt32LE(36+samples.length*2,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(sampleRate,24);wave.writeUInt32LE(sampleRate*2,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(samples.length*2,40)
 for(let i=0;i<samples.length;i++){if(!Number.isFinite(samples[i])||Math.abs(samples[i])>1)throw Error('无效音频幅度');wave.writeInt16LE(Math.round(samples[i]*32767),44+i*2)}
 const file=`${root}-${id}-${bpm}.wav`;fs.writeFileSync(path.join(output,file),wave)
 const notesText=notes.map(n=>n.label).join(' ')
 manifest.push({root,id,bpm,file,range:sequence.range,notes:notes.map(n=>n.midi),labels:notes.map(n=>n.label),seconds:notes.length*interval})
 console.log(`${file} (${notes.length*interval}s): ${notesText}`)
}
fs.writeFileSync(path.join(output,'notes.json'),JSON.stringify(manifest,null,2))
