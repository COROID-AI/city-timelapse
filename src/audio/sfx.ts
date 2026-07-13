import type{EraId,SfxEraData}from'../eras';import{ERA_IDS,SFX_ERA_DATA}from'../eras';
export interface EraAudioBuffers{ambient:AudioBuffer;traffic:AudioBuffer;events:AudioBuffer[]}
const make=(c:AudioContext,s:number,f:(i:number,r:number)=>number)=>{const b=c.createBuffer(1,c.sampleRate*s,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=f(i,c.sampleRate);return b};
export const generateEraAudioBuffers=(c:AudioContext,d:SfxEraData):EraAudioBuffers=>({ambient:make(c,2,(i,r)=>(Math.random()*2-1)*.03+Math.sin(i/r*d.ambient*6.28)*.02),traffic:make(c,1,(i,r)=>Math.sin(i/r*72*6.28)*.04),events:d.eventTypes.map((_,n)=>make(c,.2,(i,r)=>Math.sin(i/r*(440+n*100)*6.28)*Math.exp(-i/r*7)*.1))});
export const generateAllEraBuffers=(c:AudioContext)=>Object.fromEntries(ERA_IDS.map(id=>[id,generateEraAudioBuffers(c,SFX_ERA_DATA[id])])) as Record<EraId,EraAudioBuffers>;
