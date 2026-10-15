export function validBpm(value: string|number) {
  if(typeof value==='string' && !value.trim()) return null
  const bpm=Number(value)
  return Number.isFinite(bpm)&&bpm>=60&&bpm<=300?bpm:null
}
export function sixteenthSeconds(bpm:number){return 60/bpm/4}
