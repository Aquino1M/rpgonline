export const WORLD = {
  chunkSize: 48,
  renderDistance: 2,
  renderDistanceMin: 1,
  renderDistanceMax: 4,
  mobDistance: 82,
  decorDistance: 115,
  waterDistance: 125,
  worldLimit: 1560,
  mapCellSize: 56,
  minimapRange: 150,
  worldScale: 4,
  cityDistanceScale: 3,
  detailDensity: 2,
  seed: 1337,
}

export const ZONES = [
  { id:'aurora', name:'Vila Aurora', subtitle:'Refúgio dos Despertos', min:1, max:10, x0:-72, x1:72, z0:-72, z1:72, ground:0x67934f, accent:'#b6df7e', sky:'#8ec9ee', mobs:['Javali de Musgo','Slime Lúmen'], boss:'Guardião da Aurora', village:true },
  { id:'meadow', name:'Pradaria Lúmen', subtitle:'Campos de vento dourado', min:8, max:30, x0:72, x1:235, z0:-165, z1:170, ground:0x78aa5b, accent:'#d8f58e', sky:'#8bc8ef', mobs:['Lobo Lúmen','Besouro Couraçado','Raposa Rúnica'], boss:'Alfa Lúmen' },
  { id:'forest', name:'Bosque Cinéreo', subtitle:'Raízes que guardam segredos', min:25, max:60, x0:-235, x1:-72, z0:-180, z1:175, ground:0x365c3f, accent:'#80a58a', sky:'#708f9a', mobs:['Treant Jovem','Corvo Cinzento','Aranha de Casca'], boss:'Cervo Espectral' },
  { id:'coast', name:'Costa Safira', subtitle:'Falésias e marés arcanas', min:55, max:95, x0:-140, x1:145, z0:170, z1:340, ground:0xb8ad73, accent:'#4bc1df', sky:'#7ed0f6', mobs:['Caranguejo Rúnico','Serpente de Maré','Gaivota Abissal'], boss:'Leviatã de Espuma' },
  { id:'highlands', name:'Altos de Veyra', subtitle:'Montanhas acima das nuvens', min:90, max:145, x0:145, x1:345, z0:105, z1:345, ground:0x707968, accent:'#c7d2c6', sky:'#b9cfdf', mobs:['Golem de Xisto','Harpia de Veyra','Bode de Cristal'], boss:'Roc Tempestuoso' },
  { id:'ember', name:'Ermos Rubros', subtitle:'Pedra quente e cinzas vivas', min:140, max:205, x0:175, x1:365, z0:-190, z1:105, ground:0x7f4d34, accent:'#ef8650', sky:'#bd7964', mobs:['Lagarto de Brasa','Cavaleiro Oco','Escorpião Magmático'], boss:'Colosso Rubro' },
  { id:'void', name:'Fronteira Umbral', subtitle:'Onde a luz se curva', min:200, max:265, x0:-370, x1:-180, z0:-230, z1:230, ground:0x302a44, accent:'#9c86d6', sky:'#4f496d', mobs:['Sentinela Umbral','Fera do Vazio','Mímico Sombrio'], boss:'Arconte Sem Nome' },
  { id:'crown', name:'Coroa Celeste', subtitle:'Ruínas no limite do céu', min:260, max:300, x0:-190, x1:190, z0:-370, z1:-190, ground:0x8b98a7, accent:'#e8f2ff', sky:'#bcd4f6', mobs:['Serafim Partido','Dragão Névoa','Cavaleiro Celeste'], boss:'Soberano Celeste' },
]

// V0.6 expands the open world fourfold while keeping chunk streaming local.
// Zone extents are scaled 4x; city positions are scaled separately below (3x).
for(const zone of ZONES){zone.x0*=WORLD.worldScale;zone.x1*=WORLD.worldScale;zone.z0*=WORLD.worldScale;zone.z1*=WORLD.worldScale}

export const CITIES = [
  {id:'aurora-city',zoneId:'aurora',name:'Cidadela Aurora',x:0,z:0,halfW:32,halfH:29,radius:34,wallRadius:34,style:'meadow',accent:'#f0d690',wall:0xa59b86,roof:0x8f4939,npcNames:['Lyra','Orin','Brann'],services:[
    {id:'aurora-quest',role:'quest',name:'Lyra',title:'Capitã dos Exploradores',x:7,z:8,color:0x6d8fd6},
    {id:'aurora-merchant',role:'merchant',name:'Orin',title:'Mercador de Aurora',x:-8,z:5,color:0xd6a76d},
    {id:'aurora-blacksmith',role:'blacksmith',name:'Brann',title:'Ferreiro Rúnico',x:10,z:-9,color:0xb8654b},
    {id:'aurora-stable',role:'stable',name:'Mira',title:'Mestra dos Estábulos',x:-11,z:-10,color:0x83a65e},
    {id:'aurora-traveler',role:'traveler',name:'Moço Viajante',title:'Caravaneiro de Asterra',x:-5,z:18,color:0x38bdf8},
  ]},
  {id:'lumen-city',zoneId:'meadow',name:'Bastião Lúmen',x:152,z:18,halfW:27,halfH:25,radius:29,wallRadius:29,style:'meadow',accent:'#d8f58e',wall:0xc1ad72,roof:0xa66f35,services:[
    {id:'lumen-quest',role:'quest',name:'Cael',title:'Batedor da Pradaria',x:148,z:14,color:0x7e9bd8},
    {id:'lumen-merchant',role:'merchant',name:'Tessa',title:'Mercadora Lúmen',x:160,z:22,color:0xe0bd72},
    {id:'lumen-blacksmith',role:'blacksmith',name:'Hagan',title:'Ferreiro Solar',x:154,z:28,color:0xc87552},
    {id:'lumen-traveler',role:'traveler',name:'Moço Viajante',title:'Caravaneiro de Asterra',x:165,z:12,color:0x38bdf8},
  ]},
  {id:'cinerea-city',zoneId:'forest',name:'Refúgio Cinéreo',x:-154,z:0,halfW:25,halfH:26,radius:28,wallRadius:28,style:'forest',accent:'#80a58a',wall:0x6f7766,roof:0x4f5944,services:[
    {id:'forest-quest',role:'quest',name:'Eira',title:'Guardiã das Raízes',x:-160,z:5,color:0x668d75},
    {id:'forest-merchant',role:'merchant',name:'Mork',title:'Coletor Cinéreo',x:-147,z:-5,color:0x9c895f},
    {id:'forest-blacksmith',role:'blacksmith',name:'Doran',title:'Ferreiro de Casca',x:-150,z:10,color:0x9d6047},
    {id:'forest-traveler',role:'traveler',name:'Moço Viajante',title:'Caravaneiro de Asterra',x:-145,z:16,color:0x38bdf8},
  ]},
  {id:'safira-city',zoneId:'coast',name:'Porto Safira',x:0,z:252,halfW:31,halfH:24,radius:33,wallRadius:33,style:'coast',accent:'#4bc1df',wall:0xb7b295,roof:0x477b92,services:[
    {id:'coast-quest',role:'quest',name:'Neris',title:'Capitã do Porto',x:-7,z:248,color:0x5f8ab4},
    {id:'coast-merchant',role:'merchant',name:'Pella',title:'Mercadora das Marés',x:8,z:248,color:0xb89063},
    {id:'coast-blacksmith',role:'blacksmith',name:'Rul',title:'Ferreiro Naval',x:10,z:260,color:0xb45f48},
    {id:'coast-traveler',role:'traveler',name:'Moço Viajante',title:'Caravaneiro de Asterra',x:12,z:240,color:0x38bdf8},
  ]},
  {id:'veyra-city',zoneId:'highlands',name:'Fortaleza Veyra',x:245,z:225,halfW:28,halfH:27,radius:30,wallRadius:30,style:'stone',accent:'#c7d2c6',wall:0x969b91,roof:0x6d7383,services:[
    {id:'veyra-quest',role:'quest',name:'Sera',title:'Sentinela de Veyra',x:239,z:219,color:0x8196b8},
    {id:'veyra-merchant',role:'merchant',name:'Ivo',title:'Mercador das Alturas',x:252,z:221,color:0xb9a16f},
    {id:'veyra-blacksmith',role:'blacksmith',name:'Karn',title:'Ferreiro de Xisto',x:247,z:234,color:0xa46655},
    {id:'veyra-traveler',role:'traveler',name:'Moço Viajante',title:'Caravaneiro de Asterra',x:255,z:214,color:0x38bdf8},
  ]},
  {id:'rubro-city',zoneId:'ember',name:'Cidadela Rubra',x:270,z:-55,halfW:29,halfH:26,radius:31,wallRadius:31,style:'ember',accent:'#ef8650',wall:0x865a48,roof:0x6f3326,services:[
    {id:'ember-quest',role:'quest',name:'Rhea',title:'Caçadora Carmesim',x:265,z:-61,color:0xa55f5e},
    {id:'ember-merchant',role:'merchant',name:'Vek',title:'Mercador de Cinzas',x:278,z:-58,color:0xbc8e5e},
    {id:'ember-blacksmith',role:'blacksmith',name:'Boros',title:'Ferreiro Magmático',x:272,z:-45,color:0xc75739},
    {id:'ember-traveler',role:'traveler',name:'Moço Viajante',title:'Caravaneiro de Asterra',x:280,z:-48,color:0x38bdf8},
  ]},
  {id:'noctis-city',zoneId:'void',name:'Refúgio Noctis',x:-280,z:0,halfW:27,halfH:27,radius:29,wallRadius:29,style:'void',accent:'#9c86d6',wall:0x565066,roof:0x453b59,services:[
    {id:'void-quest',role:'quest',name:'Nyx',title:'Vigia Umbral',x:-285,z:6,color:0x7a69a6},
    {id:'void-merchant',role:'merchant',name:'Solan',title:'Mercador do Vazio',x:-273,z:-6,color:0x8e789f},
    {id:'void-blacksmith',role:'blacksmith',name:'Morv',title:'Ferreiro Umbral',x:-277,z:12,color:0x77506d},
    {id:'void-traveler',role:'traveler',name:'Moço Viajante',title:'Caravaneiro de Asterra',x:-270,z:10,color:0x38bdf8},
  ]},
  {id:'celeste-city',zoneId:'crown',name:'Santuário Celeste',x:0,z:-280,halfW:30,halfH:25,radius:32,wallRadius:32,style:'crown',accent:'#e8f2ff',wall:0xb7c3d0,roof:0x7b8aa6,services:[
    {id:'crown-quest',role:'quest',name:'Astra',title:'Oráculo Celeste',x:-6,z:-284,color:0xa9b9dc},
    {id:'crown-merchant',role:'merchant',name:'Elios',title:'Mercador Astral',x:7,z:-286,color:0xd1c59c},
    {id:'crown-blacksmith',role:'blacksmith',name:'Orrin',title:'Ferreiro Estelar',x:8,z:-273,color:0xb18d80},
    {id:'crown-traveler',role:'traveler',name:'Moço Viajante',title:'Caravaneiro de Asterra',x:14,z:-275,color:0x38bdf8},
  ]},
]

// Cities are three times farther apart than V0.5. Service NPC coordinates are absolute,
// so they move with their city using the same distance scale.
for(const city of CITIES){
  const oldX=city.x,oldZ=city.z,localServices=(city.services||[]).map(s=>({s,dx:s.x-oldX,dz:s.z-oldZ}))
  city.x*=WORLD.cityDistanceScale;city.z*=WORLD.cityDistanceScale
  // Move each service with its city while preserving the original internal city layout.
  for(const {s,dx,dz} of localServices){s.x=city.x+dx;s.z=city.z+dz}
}

export const ROADS = [
  {a:'aurora-city',b:'lumen-city'},
  {a:'aurora-city',b:'cinerea-city'},
  {a:'aurora-city',b:'safira-city'},
  {a:'lumen-city',b:'rubro-city'},
  {a:'lumen-city',b:'veyra-city'},
  {a:'safira-city',b:'veyra-city'},
  {a:'cinerea-city',b:'noctis-city'},
  {a:'aurora-city',b:'celeste-city'},
]

export const LANDMARKS = [
  {id:'moon-shrine',name:'Santuário da Lua',x:-95,z:-118,type:'shrine'},
  {id:'lumen-bridge',name:'Ponte de Lúmen',x:92,z:72,type:'bridge'},
  {id:'sapphire-ruins',name:'Ruínas Safira',x:-70,z:214,type:'ruins'},
  {id:'veyra-spire',name:'Agulha de Veyra',x:202,z:285,type:'spire'},
  {id:'ember-crater',name:'Cratera Rubra',x:325,z:-128,type:'crater'},
  {id:'void-obelisk',name:'Obelisco Noctis',x:-330,z:112,type:'obelisk'},
  {id:'celestial-altar',name:'Altar Celeste',x:82,z:-330,type:'altar'},
]
for(const lm of LANDMARKS){lm.x*=WORLD.cityDistanceScale;lm.z*=WORLD.cityDistanceScale}

export const RARITIES = [
  {name:'Comum', tier:0, color:'#cbd5e1', weight:46, floors:[1,2], power:1.0},
  {name:'Incomum', tier:1, color:'#86efac', weight:28, floors:[2,3], power:1.18},
  {name:'Rara', tier:2, color:'#60a5fa', weight:15, floors:[3,5], power:1.38},
  {name:'Épica', tier:3, color:'#c084fc', weight:7.5, floors:[5,7], power:1.72},
  {name:'Lendária', tier:4, color:'#f59e0b', weight:3, floors:[7,10], power:2.15},
  {name:'Mítica', tier:5, color:'#fb7185', weight:.5, floors:[10,12], power:2.8},
]

export const EQUIPMENT_SLOTS = ['weapon','armor','boots','talisman']

export const WORLD_MAP = {
  width: WORLD.worldLimit*2,
  height: WORLD.worldLimit*2,
  limit: WORLD.worldLimit,
  zones: ZONES.map(z => ({ id:z.id, name:z.name, min:z.min, max:z.max, x0:z.x0, x1:z.x1, z0:z.z0, z1:z.z1, accent:z.accent })),
  cities: CITIES.map(c=>({id:c.id,zoneId:c.zoneId,name:c.name,x:c.x,z:c.z,halfW:c.halfW,halfH:c.halfH,services:c.services.map(s=>({id:s.id,role:s.role,name:s.name,title:s.title,x:s.x,z:s.z}))})),
}

const dialogueForRole=(role,cityName)=>role==='merchant'?`Bem-vindo a ${cityName}. Eu compro os espólios dos monstros e vendo suprimentos.`:role==='blacksmith'?`A forja de ${cityName} transforma drops e minério em equipamentos dignos de um caçador.`:role==='stable'?'Cuide de sua montaria e ela levará você além das muralhas.':role==='traveler'?'Minha caravana viaja entre os postos e cidadelas de Asterra. Para onde deseja viajar?':`As muralhas seguram as criaturas, mas os portais continuam surgindo do lado de fora.`
export const NPC_DEFS = CITIES.flatMap(c=>c.services.map(s=>({...s,cityId:c.id,zoneId:c.zoneId,cityName:c.name,dialogue:dialogueForRole(s.role,c.name)})))

export const PORTAL_NAMES = ['Fenda do Eco','Portal Astral','Fenda da Lua Negra','Ruptura do Vigia','Portal de Veyra','Fenda Carmesim','Abismo Errante']

export const MODEL_MANIFEST = {
  // Characters / NPCs
  wizard: '',
  king: '',

  // Bosses
  dragon: '',
  giant: '',
  yeti: '',

  // Mobs
  slime: '',
  goblin: '',
  skeleton: '',
  golem: '',
  ghost: '',
  ghost_skull: '',
  brute: '',
  big_arm: '',
  cactoro: '',
  stone_golem: '',
  dark_knight: '',
  dwarf: '',

  // Weapons
  bow: '',
  arrow: '',
  quiver: '',
  sword_1h: '',
  sword_2h: '',
  spellbook: '',
  dagger: '',
  shield: '',
  spear: '',
  wand: '',

  // Bundled & Imported Packs Manifests
  bundledManifest: '/models/bundled/manifest.json',
  packsManifest: '',
  pack2Manifest: '',

  // Legacy/Fallbacks
  player: '', // Protegido: o personagem jogavel e sempre o avatar humanoide de alta fidelidade
  mount: '',
  wolf: '',
}


export const ABILITIES = [
  {id:'astral-cut',slot:1,key:'1',name:'Corte Astral',short:'Corte',icon:'✦',cost:14,stamina:14,cooldown:2.6,range:6,description:'Golpe de energia guiado pela mira.'},
  {id:'astral-wave',slot:2,key:'2',name:'Onda Astral',short:'Onda',icon:'✹',cost:28,stamina:28,cooldown:4.8,range:6.5,description:'Explosão circular contra inimigos próximos.'},
  {id:'shadow-step',slot:3,key:'3',name:'Passo Etéreo',short:'Passo',icon:'➠',cost:22,stamina:22,cooldown:3.2,range:0,description:'Esquiva longa com invulnerabilidade curta.'},
]


export const GUILD_RANKS = [
  {id:'E',label:'E',name:'Baixo',minLevel:1,mult:1.0},
  {id:'D',label:'D',name:'Baixo-médio',minLevel:8,mult:1.25},
  {id:'C',label:'C',name:'Médio',minLevel:20,mult:1.6},
  {id:'B',label:'B',name:'Médio-alto',minLevel:40,mult:2.05},
  {id:'A',label:'A',name:'Alto',minLevel:70,mult:2.65},
  {id:'S',label:'S',name:'Top',minLevel:100,mult:3.5},
  {id:'S+',label:'S+',name:'Ascendido',minLevel:125,mult:4.2},
  {id:'SS',label:'SS',name:'Supremo',minLevel:145,mult:5.1},
  {id:'SS+',label:'SS+',name:'Supremo+',minLevel:165,mult:6.0},
  {id:'SSS',label:'SSS',name:'Lendário',minLevel:185,mult:7.2},
  {id:'SSS+',label:'SSS+',name:'Lendário+',minLevel:205,mult:8.4},
  {id:'EX',label:'EX',name:'Excepcional',minLevel:225,mult:9.8},
  {id:'EX+',label:'EX+',name:'Excepcional+',minLevel:240,mult:11.3},
  {id:'Z',label:'Z',name:'Transcendente',minLevel:250,mult:13.0},
  {id:'Z+',label:'Z+',name:'Transcendente+',minLevel:260,mult:15.0},
  {id:'ZZ',label:'ZZ',name:'Absoluto',minLevel:270,mult:17.2},
  {id:'ZZ+',label:'ZZ+',name:'Absoluto+',minLevel:278,mult:19.6},
  {id:'ZZZ',label:'ZZZ',name:'Além do Limite',minLevel:288,mult:22.5},
  {id:'ZZZ+',label:'ZZZ+',name:'Ascensão Máxima',minLevel:300,mult:26.0},
]

// Original configurable analogue of RPG Leveling's per-entity overrides.
// Dungeon overrides take precedence over open-world overrides.
export const ENTITY_LEVEL_OVERRIDES = {
  openWorld: {
    'Guardião da Aurora': {level:12,xp:420,disableLevelScaling:false},
    'Alfa Lúmen': {level:35,xp:1450,disableLevelScaling:false},
    'Arconte Sem Nome': {level:270,xp:18000,disableLevelScaling:false},
    'Soberano Celeste': {level:300,xp:32000,disableLevelScaling:false},
  },
  dungeon: {
    'Chefe — Fenda da Lua Negra': {level:120,xp:6000,disableLevelScaling:false},
  },
}



// V0.8 city economies: each settlement specializes in materials and gear appropriate
// to its progression band. Shops still refresh every 10 minutes, but their identity
// and price multipliers now come from the city instead of a global generic stock.
export const CITY_ECONOMIES = {
  'aurora-city': {
    zoneId: 'aurora',
    tier: 1,
    label: 'Mercado dos Despertos',
    material: 'Essência Lúmen',
    theme: 'Aurora',
    buyMult: 0.92,
    sellMult: 1.08,
    prosperity: 5,
    demands: ['ore', 'iron', 'coal', 'metal'],
    demandLabel: 'Minérios & Metais',
    demandBonus: 1.55,
    tradeHint: 'Compradores de Aurora pagam +55% por Minérios de Veyra!',
    specialties: ['consumable', 'boots', 'talisman'],
    description: 'Grande centro comercial dos Despertos. Alta demanda por ferro e carvão para fortificação.'
  },
  'lumen-city': {
    zoneId: 'meadow',
    tier: 2,
    label: 'Mercado Dourado',
    material: 'Presa Lúmen',
    theme: 'Lúmen',
    buyMult: 0.98,
    sellMult: 1.10,
    prosperity: 4,
    demands: ['wood', 'tree', 'potion'],
    demandLabel: 'Madeiras Raras & Poções',
    demandBonus: 1.50,
    tradeHint: 'Lúmen paga +50% por madeiras nobres das florestas cinzentas!',
    specialties: ['weapon', 'boots'],
    description: 'Pousada central dos viajantes. Escassez de suprimentos alquímicos e madeira de construção.'
  },
  'cinerea-city': {
    zoneId: 'forest',
    tier: 3,
    label: 'Empório das Raízes',
    material: 'Casca Cinérea',
    theme: 'Cinéreo',
    buyMult: 1.02,
    sellMult: 1.12,
    prosperity: 3,
    demands: ['fish', 'scale', 'monster-drop'],
    demandLabel: 'Pescados & Escamas Marinhas',
    demandBonus: 1.60,
    tradeHint: 'Cinérea paga +60% por espólios aquáticos trazidos de Safira!',
    specialties: ['armor', 'talisman'],
    description: 'Enclave botânico isolado nas brumas. Comerciantes pagam fortunas por recursos das marés.'
  },
  'safira-city': {
    zoneId: 'coast',
    tier: 4,
    label: 'Bolsa das Marés',
    material: 'Escama Safira',
    theme: 'Safira',
    buyMult: 1.04,
    sellMult: 1.15,
    prosperity: 4,
    demands: ['wood', 'coal', 'weapon'],
    demandLabel: 'Madeira Naval & Combustível',
    demandBonus: 1.55,
    tradeHint: 'Estaleiros de Safira pagam +55% por Carvão e Madeira!',
    specialties: ['boots', 'talisman', 'weapon'],
    description: 'Porto comercial agitado. Os estaleiros navais buscam continuamente lenha e carvão.'
  },
  'veyra-city': {
    zoneId: 'highlands',
    tier: 5,
    label: 'Feira das Alturas',
    material: 'Xisto Rúnico',
    theme: 'Veyra',
    buyMult: 1.08,
    sellMult: 1.18,
    prosperity: 4,
    demands: ['potion', 'herb', 'consumable'],
    demandLabel: 'Poções de Cura & Elixires',
    demandBonus: 1.65,
    tradeHint: 'Guerreiros de Veyra pagam +65% por poções e tônicos de Aurora!',
    specialties: ['armor', 'weapon'],
    description: 'Fortaleza rochosa inóspita nas montanhas. O frio intenso valoriza elixires e poções vitais.'
  },
  'rubro-city': {
    zoneId: 'ember',
    tier: 6,
    label: 'Mercado Carmesim',
    material: 'Núcleo de Brasa',
    theme: 'Rubro',
    buyMult: 1.10,
    sellMult: 1.20,
    prosperity: 3,
    demands: ['talisman', 'ice', 'water'],
    demandLabel: 'Talismãs Refrescantes & Água',
    demandBonus: 1.70,
    tradeHint: 'Cidadela Vulcânica paga +70% por Talismãs e artefatos de Safira!',
    specialties: ['weapon', 'armor'],
    description: 'Terras áridas de cinzas e lava. Ferreiros locais trocam armas potentes por água e talismãs.'
  },
  'noctis-city': {
    zoneId: 'void',
    tier: 7,
    label: 'Bazar Umbral',
    material: 'Fragmento do Vazio',
    theme: 'Noctis',
    buyMult: 1.14,
    sellMult: 1.24,
    prosperity: 3,
    demands: ['light', 'aurora', 'grimoire'],
    demandLabel: 'Grimórios & Essências de Luz',
    demandBonus: 1.75,
    tradeHint: 'Ermitões de Noctis pagam +75% por Essências Lúmen e Grimórios!',
    specialties: ['talisman', 'weapon', 'armor'],
    description: 'Santuário sombrio nas fendas do vácuo. Pagam preços absurdos por itens iluminados.'
  },
  'celeste-city': {
    zoneId: 'crown',
    tier: 8,
    label: 'Mercado Celestial',
    material: 'Pluma Celeste',
    theme: 'Celeste',
    buyMult: 1.18,
    sellMult: 1.28,
    prosperity: 5,
    demands: ['legendary', 'epic', 'boss-drop'],
    demandLabel: 'Relíquias de Chefes & Épicos',
    demandBonus: 1.80,
    tradeHint: 'Corte Celestial paga +80% por espólios de Chefes mundiais!',
    specialties: ['weapon', 'armor', 'talisman'],
    description: 'Pináculo sagrado no ápice do mundo. Colecionadores reais financiam expedições lendárias.'
  },
}

export const SAFE_SPAWNS = {
  'aurora-city': {x:0,z:22},
  'lumen-city': {x:CITIES.find(c=>c.id==='lumen-city')?.x||456,z:(CITIES.find(c=>c.id==='lumen-city')?.z||54)+10},
  'cinerea-city': {x:CITIES.find(c=>c.id==='cinerea-city')?.x||-462,z:(CITIES.find(c=>c.id==='cinerea-city')?.z||0)+10},
  'safira-city': {x:CITIES.find(c=>c.id==='safira-city')?.x||0,z:(CITIES.find(c=>c.id==='safira-city')?.z||756)+10},
  'veyra-city': {x:CITIES.find(c=>c.id==='veyra-city')?.x||735,z:(CITIES.find(c=>c.id==='veyra-city')?.z||675)+10},
  'rubro-city': {x:CITIES.find(c=>c.id==='rubro-city')?.x||810,z:(CITIES.find(c=>c.id==='rubro-city')?.z||-165)+10},
  'noctis-city': {x:CITIES.find(c=>c.id==='noctis-city')?.x||-840,z:(CITIES.find(c=>c.id==='noctis-city')?.z||0)+10},
  'celeste-city': {x:CITIES.find(c=>c.id==='celeste-city')?.x||0,z:(CITIES.find(c=>c.id==='celeste-city')?.z||-840)+10},
}

export const RESPAWN_RULES = {
  mobMinMs: 18000,
  mobMaxMs: 34000,
  bossMs: 210000,
  adventurerMs: 65000,
}

// 24 Aventureiros de IA vagando pelas cidades e estradas
export const ADVENTURER_BOTS = [
  {id:'bot-iris',name:'Iris',cityId:'aurora-city',level:3,rank:'E',temperament:'balanced'},
  {id:'bot-ren',name:'Ren',cityId:'aurora-city',level:6,rank:'E',temperament:'aggressive'},
  {id:'bot-rowan',name:'Rowan',cityId:'aurora-city',level:9,rank:'E',temperament:'cautious'},
  {id:'bot-lyra',name:'Lyra',cityId:'aurora-city',level:12,rank:'D',temperament:'balanced'},
  {id:'bot-kai',name:'Kai',cityId:'lumen-city',level:18,rank:'D',temperament:'balanced'},
  {id:'bot-theron',name:'Theron',cityId:'lumen-city',level:22,rank:'D',temperament:'aggressive'},
  {id:'bot-maya',name:'Maya',cityId:'lumen-city',level:27,rank:'C',temperament:'cautious'},
  {id:'bot-zephyr',name:'Zephyr',cityId:'lumen-city',level:33,rank:'C',temperament:'balanced'},
  {id:'bot-helga',name:'Helga',cityId:'cinerea-city',level:42,rank:'B',temperament:'aggressive'},
  {id:'bot-kaelen',name:'Kaelen',cityId:'cinerea-city',level:50,rank:'B',temperament:'balanced'},
  {id:'bot-silas',name:'Silas',cityId:'cinerea-city',level:60,rank:'B',temperament:'cautious'},
  {id:'bot-nilo',name:'Nilo',cityId:'safira-city',level:72,rank:'A',temperament:'balanced'},
  {id:'bot-valeri',name:'Valeri',cityId:'safira-city',level:85,rank:'A',temperament:'aggressive'},
  {id:'bot-marina',name:'Marina',cityId:'safira-city',level:96,rank:'A',temperament:'cautious'},
  {id:'bot-vey',name:'Vey',cityId:'veyra-city',level:112,rank:'S',temperament:'cautious'},
  {id:'bot-brian',name:'Brian',cityId:'veyra-city',level:128,rank:'S',temperament:'aggressive'},
  {id:'bot-morgan',name:'Morgan',cityId:'veyra-city',level:145,rank:'SS',temperament:'balanced'},
  {id:'bot-runa',name:'Runa',cityId:'rubro-city',level:166,rank:'SS+',temperament:'aggressive'},
  {id:'bot-cassian',name:'Cassian',cityId:'rubro-city',level:188,rank:'SSS',temperament:'balanced'},
  {id:'bot-ignis',name:'Ignis',cityId:'rubro-city',level:205,rank:'SSS',temperament:'aggressive'},
  {id:'bot-noct',name:'Noct',cityId:'noctis-city',level:225,rank:'EX',temperament:'balanced'},
  {id:'bot-soren',name:'Soren',cityId:'noctis-city',level:250,rank:'EX+',temperament:'cautious'},
  {id:'bot-aeris',name:'Aeris',cityId:'celeste-city',level:285,rank:'ZZZ',temperament:'cautious'},
  {id:'bot-astrid',name:'Astrid',cityId:'celeste-city',level:295,rank:'ZZZ',temperament:'aggressive'},
]

// Configuração de Guardas de IA que defendem as Cidades contra Monstros
export const CITY_GUARDS_CONFIG = [
  {id:'guard-aurora-1',name:'Guarda de Aurora',cityId:'aurora-city',angle:0,dist:18,level:25},
  {id:'guard-aurora-2',name:'Guarda de Aurora',cityId:'aurora-city',angle:Math.PI,dist:18,level:25},
  {id:'guard-lumen-1',name:'Sentinela Dourado',cityId:'lumen-city',angle:Math.PI*0.5,dist:20,level:40},
  {id:'guard-lumen-2',name:'Sentinela Dourado',cityId:'lumen-city',angle:Math.PI*1.5,dist:20,level:40},
  {id:'guard-cinerea-1',name:'Protetor Cinéreo',cityId:'cinerea-city',angle:Math.PI*0.25,dist:20,level:60},
  {id:'guard-cinerea-2',name:'Protetor Cinéreo',cityId:'cinerea-city',angle:Math.PI*1.25,dist:20,level:60},
  {id:'guard-safira-1',name:'Guardião das Marés',cityId:'safira-city',angle:0,dist:22,level:85},
  {id:'guard-safira-2',name:'Guardião das Marés',cityId:'safira-city',angle:Math.PI,dist:22,level:85},
  {id:'guard-veyra-1',name:'Defensor das Alturas',cityId:'veyra-city',angle:Math.PI*0.5,dist:22,level:125},
  {id:'guard-rubro-1',name:'Guarda Carmesim',cityId:'rubro-city',angle:0,dist:22,level:180},
  {id:'guard-noctis-1',name:'Vigilante Umbral',cityId:'noctis-city',angle:Math.PI,dist:22,level:230},
  {id:'guard-celeste-1',name:'Cavaleiro Celestial',cityId:'celeste-city',angle:0,dist:24,level:290},
]

export const ATTRIBUTE_DEFS = [
  {id:'strength',name:'Força',icon:'⚔',description:'+2 ATK por ponto'},
  {id:'vitality',name:'Vitalidade',icon:'♥',description:'+12 HP e +0,35 DEF por ponto'},
  {id:'agility',name:'Agilidade',icon:'➠',description:'+0,045 velocidade e +0,18% crítico'},
  {id:'intellect',name:'Intelecto',icon:'✦',description:'+1,2% dano de habilidade e +2 vigor'},
]
