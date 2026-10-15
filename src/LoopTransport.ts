export type LoopSettings={enabled:boolean;range:[number,number]|null;gap:number}
/** 单一媒体元素；原始媒体秒为唯一时钟。RAF只观察，不生成第二路音频。 */
export class LoopTransport{
 private frame=0;private gapTimer:ReturnType<typeof setTimeout>|undefined;private playing=false;private generation=0
 loop:LoopSettings={enabled:false,range:null,gap:0}
 private media:HTMLMediaElement;private update:(time:number,playing:boolean)=>void;private failure:(message:string)=>void
 constructor(media:HTMLMediaElement,update:(time:number,playing:boolean)=>void,failure:(message:string)=>void){this.media=media;this.update=update;this.failure=failure}
 private clear(){cancelAnimationFrame(this.frame);clearTimeout(this.gapTimer);this.gapTimer=undefined}
 configure(loop:LoopSettings){const gapPending=this.gapTimer!==undefined;this.loop=loop;if(gapPending&&this.playing){this.clear();void this.resume(this.generation)}}
 setRate(value:number){if(!Number.isFinite(value)||value<.25||value>2)throw Error('倍率须为0.25—2.00。');if(!('preservesPitch' in this.media)&&value!==1)throw Error('此浏览器不支持保调变速，本版只允许1×。');this.media.preservesPitch=true;try{this.media.playbackRate=value}catch{throw Error('浏览器拒绝此播放倍率。')}if(Math.abs(this.media.playbackRate-value)>.001)throw Error('浏览器未接受此倍率。')}
 async play(){this.stop();this.playing=true;const token=this.generation;if(this.loop.enabled&&this.loop.range&&(this.media.currentTime<this.loop.range[0]||this.media.currentTime>=this.loop.range[1]))this.media.currentTime=this.loop.range[0];await this.resume(token)}
 private async resume(token:number){try{await this.media.play();if(token!==this.generation){if(!this.playing)this.media.pause();return}this.tick()}catch(error){if(token===this.generation){this.stop();this.failure('无法播放：'+(error instanceof Error?error.message:'浏览器不支持该媒体。'))}}}
 private tick=()=>{
  if(!this.playing)return
  const {enabled,range,gap}=this.loop
  if(enabled&&range&&(this.media.currentTime>=range[1]-.008||this.media.ended)){
   this.media.pause();this.media.currentTime=range[0];this.update(this.media.currentTime,true)
   if(gap>0){const token=this.generation;this.gapTimer=setTimeout(()=>{this.gapTimer=undefined;if(token===this.generation&&this.playing)void this.resume(token)},gap*1000);return}
   void this.resume(this.generation);return
  }
  if(this.media.ended){this.stop();return}
  this.update(this.media.currentTime,this.playing);this.frame=requestAnimationFrame(this.tick)
 }
 seek(time:number){const pending=this.gapTimer!==undefined;clearTimeout(this.gapTimer);this.gapTimer=undefined;this.media.currentTime=Math.max(0,Math.min(this.media.duration||0,time));this.update(this.media.currentTime,this.playing);if(pending&&this.playing)void this.resume(this.generation)}
 stop(){++this.generation;this.playing=false;this.clear();this.media.pause();this.update(this.media.currentTime,false)}
 dispose(){this.stop();this.media.removeAttribute('src');this.media.load()}
}
