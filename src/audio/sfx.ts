import {EraConfig} from '../eras';
export interface EraAudioBuffers {ambient:AudioBuffer;traffic:AudioBuffer;events:AudioBuffer[]}
const noise=(ctx:AudioContext,seconds:number,filter:number,frequency=0)=>{const b=ctx.createBuffer(1,ctx.sampleRate*seconds,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*.16+Math.sin(i/ctx.sampleRate*frequency*6.28)*.04;return b};
export function generateEraAudioBuffers(ctx:AudioContext,data:EraConfig['audioProfile']):EraAudioBuffers{return {ambient:noise(ctx,4,data.ambientFilter,data.tonalLayers[0]),traffic:noise(ctx,3,data.ambientFilter/2,data.tonalLayers[1]),events:[noise(ctx,.18,data.ambientFilter*2,440),noise(ctx,.3,data.ambientFilter*2,880)]};}
export function generateAllEraBuffers(ctx:AudioContext){return Object.fromEntries((Object.keys(SFX_ERA_DATA) as EraConfig['id'][]).map(id=>[id,generateEraAudioBuffers(ctx,SFX_ERA_DATA[id])]));}
import {SFX_ERA_DATA} from '../eras';
