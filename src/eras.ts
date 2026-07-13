export type EraId='1945'|'1965'|'1985'|'2005'|'2025'|'2055';
export interface EraSpec{id:EraId;year:number;label:string;description:string}
export interface SfxEraData{ambient:number;traffic:number;eventTypes:string[];musicStyle:string}
export const ERA_REGISTRY:EraSpec[]=[{id:'1945',year:1945,label:'Postwar',description:'Brick, steam & swing'},{id:'1965',year:1965,label:'Modernism',description:'Chrome, concrete & soul'},{id:'1985',year:1985,label:'Neon age',description:'Synths, arcades & neon'},{id:'2005',year:2005,label:'Connected',description:'Glass, Wi-Fi & pop'},{id:'2025',year:2025,label:'Now',description:'Green tech & city life'},{id:'2055',year:2055,label:'Tomorrow',description:'Solar, skyways & AI'}];
export const ERA_IDS=ERA_REGISTRY.map(e=>e.id) as EraId[];
export const SFX_ERA_DATA:Record<EraId,SfxEraData>={'1945':{ambient:110,traffic:.2,eventTypes:['horn'],musicStyle:'swing'},'1965':{ambient:150,traffic:.35,eventTypes:['bell'],musicStyle:'soul'},'1985':{ambient:220,traffic:.5,eventTypes:['arcade'],musicStyle:'synth'},'2005':{ambient:180,traffic:.6,eventTypes:['phone'],musicStyle:'house'},'2025':{ambient:130,traffic:.45,eventTypes:['bike'],musicStyle:'ambient'},'2055':{ambient:280,traffic:.25,eventTypes:['drone'],musicStyle:'future'}};
export const getEraSpec=(id:EraId)=>ERA_REGISTRY.find(e=>e.id===id)??ERA_REGISTRY[0];
