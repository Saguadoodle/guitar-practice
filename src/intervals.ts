import { parseOpenString } from './pitch'
const LETTERS = ['C','D','E','F','G','A','B']
const NATURALS = [0,2,4,5,7,9,11]
export const modulo = (value: number) => (value % 12 + 12) % 12
export function rootPitchClass(root: string) { return modulo(parseOpenString(root,'3').midi) }
export function spellTone(root: string, offset: number, degree: string) {
  const letter = (LETTERS.indexOf(root[0]) + Number(degree.match(/\d+/)?.[0]) - 1) % 7
  const pitchClass = modulo(rootPitchClass(root) + offset)
  const accidental = modulo(pitchClass - NATURALS[letter] + 6) - 6
  const noteName = LETTERS[letter] + (accidental >= 0 ? '♯'.repeat(accidental) : '♭'.repeat(-accidental))
  return { noteName, degree, offset, pitchClass, natural: NATURALS[letter], accidental }
}
export function toRoman(degree: string) {
  const number = Number(degree.match(/\d+/)?.[0])
  return degree.replace(/\d+/, ['I','II','III','IV','V','VI','VII'][(number-1)%7])
}
export const CHROMATIC_DEGREES = ['1','♭2','2','♭3','3','4','♯4','5','♭6','6','♭7','7']
