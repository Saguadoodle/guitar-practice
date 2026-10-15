export function bpmDragValue(start:number,deltaY:number,min:number,max:number){return Math.max(min,Math.min(max,Math.round(start-deltaY/3)))}
