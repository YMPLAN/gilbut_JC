// Bundles keep the original MP3 bytes and load only the selected activity.
export function hasOriginalAudio(item){return !!(item&&typeof item.audio==='string'&&/^audio\/[a-z0-9_]+\.mp3$/.test(item.audio));}
export class ReferencePlayer {
  constructor({onState=()=>{},onError=()=>{}}={}){this.audio=new Audio();this.audio.preload='none';this.audio.id='referenceAudio';this.audio.hidden=true;this.cache=new Map();this.version=0;this.active=false;this.onState=onState;this.onError=onError;this.audio.onended=()=>this.stop();this.audio.onerror=()=>{if(this.active){this.stop();this.onError();}};}
  stop(){this.version++;this.active=false;this.audio.pause();this.audio.removeAttribute('src');this.audio.load();if(this.url){URL.revokeObjectURL(this.url);this.url=null;}this.onState(false);}
  setRate(rate){this.audio.playbackRate=rate;this.audio.preservesPitch=true;}
  async play(item,rate=1){this.stop();const version=this.version;this.active=true;this.onState(true);try{let url;
    if(item.audioBundle){const {path,offset,length}=item.audioBundle;if(!/^audio\/activities\/u1-\d{3}b?\.bin$/.test(path)||!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<1)throw Error('Invalid audio');
      if(!this.cache.has(path)){const request=fetch(new URL(path,import.meta.url),{credentials:'omit',signal:AbortSignal.timeout(20000)}).then(async r=>{if(!r.ok)throw Error('Audio unavailable');const b=await r.arrayBuffer();if(b.byteLength>3000000)throw Error('Audio too large');return b;}).catch(e=>{this.cache.delete(path);throw e;});this.cache.set(path,request);}
      const data=await this.cache.get(path);if(version!==this.version)return;if(offset+length>data.byteLength)throw Error('Invalid audio range');url=URL.createObjectURL(new Blob([data.slice(offset,offset+length)],{type:'audio/mpeg'}));this.url=url;
    }else{if(!hasOriginalAudio(item))throw Error('No audio');url=new URL(item.audio,import.meta.url).href;}
    if(version!==this.version)return;this.audio.src=url;this.setRate(rate);await this.audio.play();
  }catch(e){if(version===this.version){this.stop();this.onError();}}}
}

