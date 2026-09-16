import { RARITIES, EQUIPMENT_SLOTS, GUILD_RANKS, ENTITY_LEVEL_OVERRIDES, CITY_ECONOMIES, CITIES } from './config.js'
import { uid } from './utils.js'
import { defaultTravelState } from './fastTravel.js'

export function defaultClassState(){
  return {
    activeClassId: 'mercenary_swordsman',
    unlockedClassIds: ['mercenary_swordsman'],
    classRanks: { 'mercenary_swordsman': 1 },
    bossPowersAbsorbed: 0,
    rollsCount: 0,
    awakeningCount: 0
  }
}

export function calculateGrimoireCost(awakeningCount = 0){
  return Math.round(250 * Math.pow(1.85, awakeningCount || 0))
}

export function getNextGrimoireLevel(awakeningCount = 0){
  return (awakeningCount || 0) === 0 ? 1 : (awakeningCount || 0) * 50
}

export function makeTool(subtype='axe', level=1, rarityName='Comum'){
  const isAxe = subtype === 'axe'
  const rarity = getRarity(rarityName)
  const baseName = isAxe ? 'Machado do Lenhador' : 'Picareta de Mineração'
  const power = Math.round(15 * rarity.power)
  return {
    id: uid('tool'),
    name: `${baseName} ${rarity.name !== 'Comum' ? rarity.name : ''}`.trim(),
    type: 'tool',
    subtype,
    rarity: rarity.name,
    rarityTier: rarity.tier,
    color: rarity.color,
    level: Math.max(1, Math.round(level)),
    power,
    harvestBonus: isAxe ? { tree: 2.8 } : { ore: 2.8 },
    icon: isAxe ? '🪓' : '⛏️',
    description: isAxe ? 'Ferramenta para cortar árvores e obter Madeira.' : 'Ferramenta para minerar jazidas de Carvão e Ferro.',
    value: Math.round((isAxe ? 65 : 75) * rarity.power),
    maxDurability: Math.round(105 + Math.max(1, level) * 2.5 + rarity.tier * 24),
    durability: Math.round(105 + Math.max(1, level) * 2.5 + rarity.tier * 24)
  }
}

export function makeResourceDrop(kind='wood', qty=1){
  if(kind === 'coal'){
    return { id: uid('res'), name: 'Carvão Mineral', type: 'material', subtype: 'coal', rarity: 'Comum', color: '#475569', icon: '⚫', qty: Math.max(1, qty), value: 14, description: 'Carvão puro extraído de veios minerais.' }
  }
  if(kind === 'iron'){
    return { id: uid('res'), name: 'Minério de Ferro', type: 'material', subtype: 'iron', rarity: 'Incomum', color: '#94a3b8', icon: '⚙️', qty: Math.max(1, qty), value: 24, description: 'Minério bruto de ferro de alta qualidade.' }
  }
  return { id: uid('res'), name: 'Madeira de Carvalho', type: 'material', subtype: 'wood', rarity: 'Comum', color: '#b45309', icon: '🪵', qty: Math.max(1, qty), value: 8, description: 'Tronco de carvalho cortado de árvores de Asterra.' }
}

export function starterInventory(){
  return [
    {...makeItem('weapon',1,'Comum','Espada do Desperto'), subtype:'sword'},
    {...makeItem('weapon',1,'Comum','Arco do Caçador'), subtype:'bow'},
    makeItem('armor',1,'Comum','Túnica de Aurora'),
    makeTool('axe', 1, 'Comum'),
    makeTool('pickaxe', 1, 'Comum'),
    {id:uid('item'), name:'Poção Rubra', type:'consumable', subtype:'potion', rarity:'Comum', color:'#cbd5e1', level:1, power:45, qty:3, value:35},
    {id:uid('grimoire'), name:'Grimório do Despertar', type:'consumable', subtype:'grimoire', rarity:'Rara', color:'#a855f7', level:1, qty:2, value:220},
  ]
}

export const QUESTS = [
  {id:'first_hunt', title:'Primeira Patrulha', giver:'Lyra', type:'kill', target:'any', goal:5, minLevel:1, reward:{xp:240,gold:220}, text:'Elimine 5 criaturas fora da Cidadela Aurora.'},
  {id:'lumen_alpha', title:'Uivo na Pradaria', giver:'Lyra', type:'boss', target:'Alfa Lúmen', goal:1, minLevel:8, reward:{xp:900,gold:520,item:'Rara'}, text:'Derrote o Alfa Lúmen que domina a Pradaria.'},
  {id:'forge_trial', title:'Aço e Éter', giver:'Brann', type:'upgrade', target:'weapon', goal:1, minLevel:4, reward:{xp:420,gold:180}, text:'Melhore uma arma no ferreiro.'},
  {id:'rider_oath', title:'Juramento do Cavaleiro', giver:'Lorde Aldrich', role:'townhall', type:'kill', target:'any', goal:3, minLevel:1, reward:{xp:400,gold:350,mountPermission:true}, text:'Elimine 3 monstros invasores para prestar o Juramento na Prefeitura e obter a Permissão Real de Doma no Estábulo.'},
  {id:'ascension_rank_2', title:'Provação dos Chefes: Grau II', giver:'Grimório', role:'grimoire', type:'boss', target:'any', goal:5, minLevel:20, reward:{xp:1200,gold:600}, text:'Elimine 5 bosses do mapa para provar sua perícia e desbloquear o Grau II de classe.'},
  {id:'ascension_rank_3', title:'Provação dos Chefes: Grau III', giver:'Grimório', role:'grimoire', type:'boss', target:'any', goal:5, minLevel:50, reward:{xp:3500,gold:1500}, text:'Elimine 5 bosses do mapa para demonstrar seu poder e desbloquear o Grau III de classe.'},
  {id:'ascension_rank_4', title:'Provação dos Chefes: Grau IV', giver:'Grimório', role:'grimoire', type:'boss', target:'any', goal:5, minLevel:90, reward:{xp:7000,gold:3500}, text:'Elimine 5 bosses do mapa para desbloquear a maestria Grau IV de classe.'},
  {id:'ascension_rank_5', title:'Provação dos Chefes: Grau V', giver:'Grimório', role:'grimoire', type:'boss', target:'any', goal:5, minLevel:150, reward:{xp:18000,gold:8000}, text:'Elimine 5 bosses do mapa para alcançar o Grau Divino/Soberano de classe.'},
  {id:'lumen_patrol', title:'Patrulha de Lúmen', giver:'Cael', type:'kill', target:'any', goal:8, minLevel:8, reward:{xp:720,gold:420}, text:'Elimine 8 criaturas nos arredores do Bastião Lúmen.'},
  {id:'forest_guard', title:'Raízes em Perigo', giver:'Eira', type:'boss', target:'Cervo Espectral', goal:1, minLevel:25, reward:{xp:1800,gold:900,item:'Rara'}, text:'Derrote o Cervo Espectral e proteja o Refúgio Cinéreo.'},
  {id:'coast_guard', title:'Maré Abissal', giver:'Neris', type:'boss', target:'Leviatã de Espuma', goal:1, minLevel:55, reward:{xp:3600,gold:1750,item:'Épica'}, text:'Enfrente o Leviatã de Espuma que ameaça Porto Safira.'},
  {id:'veyra_guard', title:'Céus de Veyra', giver:'Sera', type:'boss', target:'Roc Tempestuoso', goal:1, minLevel:90, reward:{xp:6200,gold:2900,item:'Épica'}, text:'Derrube o Roc Tempestuoso sobre as muralhas de Veyra.'},
  {id:'ember_guard', title:'Coração Rubro', giver:'Rhea', type:'boss', target:'Colosso Rubro', goal:1, minLevel:140, reward:{xp:9800,gold:4700,item:'Lendária'}, text:'Derrote o Colosso Rubro nos Ermos.'},
  {id:'void_guard', title:'O Nome Proibido', giver:'Nyx', type:'boss', target:'Arconte Sem Nome', goal:1, minLevel:200, reward:{xp:15000,gold:7200,item:'Lendária'}, text:'Elimine o Arconte Sem Nome antes que alcance Noctis.'},
  {id:'crown_guard', title:'Última Ascensão', giver:'Astra', type:'boss', target:'Soberano Celeste', goal:1, minLevel:260, reward:{xp:24000,gold:12000,item:'Mítica'}, text:'Derrote o Soberano Celeste e alcance o auge de Asterra.'},
]

const PREFIX = {
  Comum:['Gasta','Simples','de Campo'],
  Incomum:['Reforçada','do Caçador','Rúnica'],
  Rara:['Safira','Astral','do Vigia'],
  Épica:['Umbral','Arcana','do Eclipse'],
  Lendária:['Solar','do Soberano','Celestial'],
  Mítica:['da Ascensão','do Vazio Eterno','Primordial'],
}

const BASE_NAMES={
  weapon:['Espada','Lâmina','Sabre','Arco','Cetro','Machado','Adaga'],
  armor:['Armadura','Túnica','Couraça','Peitoral'],
  boots:['Botas','Grevas','Passos'],
  talisman:['Talismã','Selo','Amuleto']
}

export function getRarity(name='Comum'){return RARITIES.find(r=>r.name===name)||RARITIES[0]}

export function itemStats(type,level,rarityName='Comum',powerOverride=null,subtype=null){
  const rarity=getRarity(rarityName),lv=Math.max(1,Number(level)||1)
  const power=powerOverride??Math.max(1,Math.round((4+lv*1.58)*rarity.power))
  if(type==='weapon'){
    if(subtype==='bow') return {attack:Math.round(power*1.02),defense:0,speed:0.06,crit:Math.min(22,4+rarity.tier*2.2),range:24,ranged:true}
    if(subtype==='dagger') return {attack:Math.round(power*0.96),defense:0,speed:0.12,crit:Math.min(25,6+rarity.tier*2.5),range:3.5,ranged:false}
    if(subtype==='spellbook') return {attack:Math.round(power*1.12),defense:0,speed:0,crit:Math.min(15,2+rarity.tier*1.8),range:18,ranged:true}
    return {attack:Math.round(power*1.08),defense:0,speed:0,crit:Math.min(14,1+rarity.tier*1.6),range:4.2,ranged:false}
  }
  if(type==='armor')return {attack:Math.round(power*.16),defense:Math.round(power*.88),speed:0,crit:0}
  if(type==='boots')return {attack:0,defense:Math.round(power*.28),speed:Number(Math.min(2.8,.12+power*.018).toFixed(2)),crit:0}
  if(type==='talisman')return {attack:Math.round(power*.38),defense:Math.round(power*.3),speed:0,crit:Math.min(8,rarity.tier*1.1)}
  return {attack:0,defense:0,speed:0,crit:0}
}

export function makeItem(type, level, rarityName='Comum', customName=null, customSubtype=null){
  const rarity=getRarity(rarityName),names=BASE_NAMES[type]||['Equipamento']
  const base=Math.max(1,Math.round((4+Math.max(1,level)*1.58)*rarity.power))
  const adjective=PREFIX[rarity.name]?.[Math.floor(Math.random()*(PREFIX[rarity.name]?.length||1))]||rarity.name
  const chosenBase=names[Math.floor(Math.random()*names.length)]
  const itemName=customName||`${chosenBase} ${adjective}`
  let subtype=customSubtype
  if(type==='weapon'&&!subtype){
    const lower=itemName.toLowerCase()
    if(lower.includes('arco')) subtype='bow'
    else if(lower.includes('cetro')||lower.includes('tomo')||lower.includes('varinha')) subtype='spellbook'
    else if(lower.includes('adaga')) subtype='dagger'
    else if(lower.includes('machado')) subtype='axe'
    else subtype='sword'
  }
  const stats=itemStats(type,level,rarity.name,base,subtype)
  const gearLevel=Math.max(1,Math.round(level))
  const durabilityBase=type==='armor'?180:type==='boots'?145:type==='weapon'?125:0
  const maxDurability=durabilityBase?Math.round(durabilityBase+gearLevel*2.25+rarity.tier*28):0
  return {
    id:uid('gear'),
    name:itemName,
    type,
    subtype,
    rarity:rarity.name,
    rarityTier:rarity.tier,
    color:rarity.color,
    level:gearLevel,
    power:base,
    stats,
    upgrade:0,
    value:Math.round(28+base*(4.3+rarity.tier*.85)),
    ...(maxDurability?{maxDurability,durability:maxDurability}:{})
  }
}

export function makeMaterialDrop(level,source='Monstro',zoneId='aurora'){
  const lv=Math.max(1,Math.round(level)),economy=Object.values(CITY_ECONOMIES).find(e=>e.zoneId===zoneId)
  const key=String(source).toLowerCase()
  const family=key.includes('slime')?['Núcleo Gelatinoso','#34d399',1.0]:key.includes('goblin')||key.includes('javali')?['Presa Selvagem','#a3e635',1.08]:key.includes('esqueleto')||key.includes('espectro')?['Essência Espectral','#a78bfa',1.28]:key.includes('golem')||key.includes('colosso')||key.includes('gigante')?['Fragmento de Pedra Rúnica','#94a3b8',1.42]:key.includes('drag')||key.includes('soberano')||key.includes('arconte')?['Escama Primordial','#f59e0b',1.9]:[economy?.material||'Presa de Monstro','#cbd5e1',1.16]
  const rarity=lv>=220?'Épica':lv>=130?'Rara':lv>=55?'Incomum':'Comum'
  return {id:uid('drop'),name:`${family[0]} Nv.${lv}`,type:'material',subtype:'monster-drop',rarity,color:family[1],level:lv,source,zoneId,qty:1,value:Math.round((12+lv*2.2)*family[2]*(economy?.sellMult||1))}
}

export function rollLootRarity(level=1,boss=false,rnd=Math.random()){
  const progress=Math.min(1,Math.max(0,(level-1)/299))
  const weights=RARITIES.map((r,i)=>{
    const lowDecay=i===0?1-progress*.83:i===1?1-progress*.48:1
    const highBoost=i>=2?1+progress*(i-1)*1.75:1
    const bossBoost=boss?(i>=2?1.7+i*.32:(i===0?.18:.55)):1
    return Math.max(.02,r.weight*lowDecay*highBoost*bossBoost)
  })
  const total=weights.reduce((a,b)=>a+b,0);let t=rnd*total
  for(let i=0;i<RARITIES.length;i++){t-=weights[i];if(t<=0)return RARITIES[i]}
  return RARITIES[0]
}

export function defaultQuestState(){
  return QUESTS.map(q=>({...q, progress:0, status:'available'}))
}

export function merchantStock(level=1,zoneMin=1,cycle=Math.floor(Date.now()/600000),shopKind='all',zoneId='aurora',zoneMax=300){
  const lv=Math.max(1,Math.round(Math.max(zoneMin,Math.min(zoneMax,level)))),economy=Object.values(CITY_ECONOMIES).find(e=>e.zoneId===zoneId)||CITY_ECONOMIES['aurora-city'],rng=seededRng((cycle+1)*7919+lv*131+zoneMin*17+(economy?.tier||1)*401)
  const pickRarity=()=>{
    const progress=Math.min(1,lv/300),roll=rng()
    if(roll<.004+progress*.045)return 'Mítica'
    if(roll<.025+progress*.10)return 'Lendária'
    if(roll<.10+progress*.18)return 'Épica'
    if(roll<.28+progress*.24)return 'Rara'
    if(roll<.62)return 'Incomum'
    return 'Comum'
  }
  const specialty=economy?.specialties||[],baseTypes=['weapon','armor','boots','talisman','weapon','armor','weapon','armor']
  const types=baseTypes.map((type,i)=>specialty.length&&i<Math.min(4,specialty.length*2)?specialty[i%specialty.length]:type).filter(t=>t!=='consumable')
  const gear=[]
  for(let i=0;i<types.length;i++){
    const type=types[i],jitter=Math.round((rng()-.45)*Math.max(2,lv*.16)),itemLevel=Math.max(zoneMin,Math.min(zoneMax,lv+jitter)),rarity=pickRarity()
    const baseName=BASE_NAMES[type]?.[Math.floor(rng()*(BASE_NAMES[type]?.length||1))]||'Equipamento',theme=economy?.theme||rarity
    const it=makeItem(type,itemLevel,rarity,`${baseName} ${theme} ${rarity} Nv.${itemLevel}`)
    gear.push({...it,id:`shop-${cycle}-${zoneMin}-${zoneId}-${i}`,zoneId,value:Math.round(it.value*(1.08+rarityTier(rarity)*.08)*(economy?.buyMult||1))})
  }
  const consumables=[
    {id:`shop-potion-${cycle}-${zoneId}`,name:`Poção ${economy?.theme||'Rubra'}`,type:'consumable',subtype:'potion',rarity:'Comum',color:'#cbd5e1',level:1,power:Math.round(55+lv*.38),qty:1,zoneId,value:Math.round((50+lv*.5)*(economy?.buyMult||1))},
    {id:`shop-grimoire-${cycle}-${zoneId}`,name:'Grimório do Despertar',type:'consumable',subtype:'grimoire',rarity:'Rara',color:'#a855f7',level:1,power:0,qty:1,zoneId,value:Math.round(220*(economy?.buyMult||1))},
    {id:`shop-pet-food-${cycle}-${zoneId}`,name:'Ração de Domação',type:'consumable',subtype:'pet_food',rarity:'Incomum',color:'#fb923c',level:Math.max(1,Math.floor(lv*.65)),power:0,qty:1,zoneId,value:Math.round((95+lv*.7)*(economy?.buyMult||1)),description:'Equipe e ataque um monstro enfraquecido para tentar domá-lo.'},
  ]
  const tools=[
    {id:`shop-axe-${cycle}-${zoneId}`,name:'Machado do Lenhador',type:'tool',subtype:'axe',rarity:'Comum',color:'#cbd5e1',level:1,harvestBonus:{tree:2.8},icon:'🪓',description:'Corta árvores rapidamente para coletar Madeira.',zoneId,value:Math.round(65*(economy?.buyMult||1))},
    {id:`shop-pickaxe-${cycle}-${zoneId}`,name:'Picareta de Mineração',type:'tool',subtype:'pickaxe',rarity:'Comum',color:'#cbd5e1',level:1,harvestBonus:{ore:2.8},icon:'⛏️',description:'Minera veios de Carvão e Ferro pelo mapa.',zoneId,value:Math.round(75*(economy?.buyMult||1))},
  ]
  if(shopKind==='blacksmith')return [...gear.filter(x=>x.type==='weapon'||x.type==='armor'), ...tools]
  if(shopKind==='merchant')return [...consumables,...tools,...gear.filter(x=>x.type==='boots'||x.type==='talisman').slice(0,3)]
  return [...consumables,...tools,...gear]
}

function rarityTier(name){return Math.max(0,RARITIES.findIndex(r=>r.name===name))}
function seededRng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

export function shopRefreshInfo(now=Date.now()){
  const cycle=Math.floor(now/600000),next=(cycle+1)*600000
  return {cycle,next,remainingMs:Math.max(0,next-now)}
}

export function getGuildRank(index=0){return GUILD_RANKS[Math.max(0,Math.min(GUILD_RANKS.length-1,index|0))]}
export function guildRankRequirement(index=0){if(index<=0)return 0;return Math.round(60*Math.pow(index,1.72))}
export function updateGuildRank(state){
  state.guildRankIndex=Math.max(0,state.guildRankIndex||0);state.guildPoints=Math.max(0,state.guildPoints||0)
  let advanced=false
  while(state.guildRankIndex<GUILD_RANKS.length-1){const next=state.guildRankIndex+1,rank=GUILD_RANKS[next];if(state.level<rank.minLevel||state.guildPoints<guildRankRequirement(next))break;state.guildRankIndex=next;advanced=true}
  state.guildRank=getGuildRank(state.guildRankIndex).id;return advanced
}

export function generateGuildMissions(state,cycle=Math.floor(Date.now()/600000)){
  const rankIndex=Math.max(0,state.guildRankIndex||0),rng=seededRng(cycle*31337+(state.level||1)*97+rankIndex*997)
  const maxRank=Math.min(GUILD_RANKS.length-1,rankIndex+1),missions=[]
  for(let i=0;i<6;i++){
    const idx=Math.max(0,Math.min(maxRank,rankIndex-(i%3===2?1:0)+(i===5?1:0))),rank=GUILD_RANKS[idx]
    const levelBase=Math.max(rank.minLevel,Math.min(300,Math.round((state.level||1)+(rng()-.25)*(10+idx*2))))
    const type=i%5===4?'dungeon':i%4===3?'boss':'kill',goal=type==='kill'?Math.max(4,Math.round(5+idx*1.35+rng()*6)):1
    const rewardScale=rank.mult*(1+levelBase/180),xp=Math.round((120+levelBase*18)*rewardScale*(type==='boss'?1.8:type==='dungeon'?2.4:1)),gold=Math.round((90+levelBase*9)*rewardScale*(type==='boss'?1.65:type==='dungeon'?2.1:1)),guildPoints=Math.round((12+idx*6)*(type==='boss'?1.5:type==='dungeon'?2:1))
    missions.push({id:`guild-${cycle}-${i}`,cycle,rank:rank.id,rankIndex:idx,minLevel:rank.minLevel,type,target:type==='kill'?'any':type==='boss'?'boss':'clear',goal,progress:0,status:'available',repeatable:true,title:type==='kill'?`Contrato ${rank.id} — Caçada ${i+1}`:type==='boss'?`Contrato ${rank.id} — Alvo de Elite`:`Contrato ${rank.id} — Fenda Instável`,text:type==='kill'?`Elimine ${goal} monstros adequados ao seu nível.`:type==='boss'?'Derrote um boss regional ou de evento.':'Conclua uma masmorra ativa.',reward:{xp,gold,guildPoints}})
  }
  return missions
}

export function refreshGuildBoard(state,cycle=Math.floor(Date.now()/600000)){
  if(state.guildMissionCycle!==cycle||!Array.isArray(state.guildMissions)||!state.guildMissions.length){state.guildMissionCycle=cycle;state.guildMissions=generateGuildMissions(state,cycle)}
  return state.guildMissions
}
export function activateGuildMission(state,id){refreshGuildBoard(state);state.guildMissions=state.guildMissions.map(m=>m.id===id&&m.status==='available'&&state.level>=m.minLevel&&(state.guildRankIndex||0)>=m.rankIndex?{...m,status:'active',progress:0}:m)}
export function progressGuildMissions(state,type,target='any',amount=1){refreshGuildBoard(state);state.guildMissions=state.guildMissions.map(m=>{if(m.status!=='active'||m.type!==type)return m;if(m.target!=='any'&&m.target!==target&&!(m.target==='boss'&&target!=='any'))return m;const progress=Math.min(m.goal,(m.progress||0)+amount);return {...m,progress,status:progress>=m.goal?'ready':'active'}})}
export function claimGuildMission(state,id){refreshGuildBoard(state);const m=state.guildMissions.find(x=>x.id===id);if(!m||m.status!=='ready')return null;state.gold+=(m.reward.gold||0);state.guildPoints=(state.guildPoints||0)+(m.reward.guildPoints||0);const advanced=updateGuildRank(state);m.progress=0;m.status='available';m.completions=(m.completions||0)+1;if(advanced){state.guildMissionCycle=null;refreshGuildBoard(state)}return {...m.reward,advanced,rank:getGuildRank(state.guildRankIndex).id}}

export function levelDifferenceMultiplier(playerLevel,mobLevel){
  const diff=mobLevel-playerLevel,ad=Math.abs(diff)
  if(ad===0)return 1.5
  if(diff>0){if(ad<=5)return 1.5-ad*.08;if(ad<=25)return 1;if(ad<=30)return .5;if(ad<=40)return .4;if(ad<=50)return .3;return .2}
  if(ad<=5)return Math.max(1,1.5-ad*.1);if(ad<=25)return Math.max(.2,1-(ad-5)*.04);return .1
}
export function resolveEntityProgression(name,baseLevel,{dungeon=false}={}){
  const override=(dungeon?ENTITY_LEVEL_OVERRIDES.dungeon?.[name]:null)||ENTITY_LEVEL_OVERRIDES.openWorld?.[name]||null
  return {level:override?.level??baseLevel,fixedXP:override?.xp??null,disableLevelScaling:!!override?.disableLevelScaling}
}
export function calculateKillXP(playerLevel,mobLevel,{boss=false,fixedXP=null,disableLevelScaling=false,rate=1,zoneRate=1}={}){
  if(fixedXP!=null)return Math.max(1,Math.round(fixedXP*rate*zoneRate))
  const base=Math.max(8,Math.round(mobLevel*Math.sqrt(Math.max(1,mobLevel))*2.35+24))*(boss?2.5:1)
  const gap=disableLevelScaling?1:levelDifferenceMultiplier(playerLevel,mobLevel)
  return Math.max(1,Math.round(base*gap*rate*zoneRate))
}

export function attributeBonuses(attributes={}){
  const strength=attributes.strength||0,vitality=attributes.vitality||0,agility=attributes.agility||0,intellect=attributes.intellect||0
  return {atk:strength*2,def:vitality*.35,maxHp:vitality*12,maxStamina:agility*1.5+intellect*2,speed:agility*.045,crit:agility*.18,abilityMult:1+intellect*.012}
}

export function normalizeSaveState(state){
  const equipment={weapon:null,armor:null,boots:null,talisman:null,...(state.equipment||{})}
  const baseQuests=defaultQuestState()
  const existingQuests=Array.isArray(state.quests)?state.quests:[]
  const existingMap=new Map(existingQuests.map(q=>[q.id,q]))
  const quests=baseQuests.map(bq=>existingMap.get(bq.id)?{...bq,...existingMap.get(bq.id)}:bq)
  for(const eq of existingQuests){if(!quests.some(q=>q.id===eq.id))quests.push(eq)}
  const normalizeItem=it=>{
    if(!it||!['weapon','armor','boots','talisman'].includes(it.type))return it
    let subtype=it.subtype
    if(it.type==='weapon'&&!subtype){
      const lower=(it.name||'').toLowerCase()
      if(lower.includes('arco')) subtype='bow'
      else if(lower.includes('cetro')||lower.includes('tomo')||lower.includes('varinha')) subtype='spellbook'
      else if(lower.includes('adaga')) subtype='dagger'
      else if(lower.includes('machado')) subtype='axe'
      else subtype='sword'
    }
    return {...it,subtype:subtype||it.subtype,stats:it.stats||itemStats(it.type,it.level||1,it.rarity||'Comum',it.power,subtype)}
  }
  let inventory=(Array.isArray(state.inventory)&&state.inventory.length?state.inventory:starterInventory()).map(normalizeItem)
  const normalizedEquipment=Object.fromEntries(Object.entries(equipment).map(([k,v])=>[k,normalizeItem(v)]))
  const hasBow=inventory.some(it=>it?.subtype==='bow')||normalizedEquipment.weapon?.subtype==='bow'
  if(!hasBow){
    inventory=[{...makeItem('weapon',Math.max(1,state.level||1),'Comum','Arco do Caçador'), subtype:'bow'},...inventory]
  }
  const rawMount=state.mount||{}
  const initialTamed=Array.isArray(rawMount.tamedHorses)?rawMount.tamedHorses:(rawMount.unlocked?['horse_aurora']:[])
  const rawPets=state.pets||{}
  const ownedPets=(Array.isArray(rawPets.owned)?rawPets.owned:[]).filter(p=>p&&p.id).slice(0,5)
  const rawReputation=state.cityReputation&&typeof state.cityReputation==='object'?state.cityReputation:{}
  const cityReputation=Object.fromEntries(CITIES.map(city=>[city.id,Math.max(0,Math.min(100,Math.round(Number(rawReputation[city.id])||0)))]))
  return {
    ...state,
    inventory,
    inventoryCapacity:Math.max(40,Math.min(100,Math.round(Number(state.inventoryCapacity)||40))),
    backpackLevel:Math.max(0,Math.min(6,Math.round(Number(state.backpackLevel)||0))),
    equipment:normalizedEquipment,
    quests,
    mount:{
      unlocked:false,
      active:false,
      oathCompleted:false,
      name:'Corcel de Aurora',
      currentHorseId:'horse_aurora',
      speedBonus:4.7,
      tamedHorses:initialTamed,
      ...rawMount,
      tamedHorses:initialTamed
    },
    pets:{owned:ownedPets,activeId:ownedPets.some(p=>p.id===rawPets.activeId)?rawPets.activeId:null,tamingArmed:!!rawPets.tamingArmed},
    cityReputation,
    wantedLevel:Math.max(0,Math.min(5,Math.round(Number(state.wantedLevel)||0))),
    classState:{...defaultClassState(),...(state.classState||{})},
    travelState:{...defaultTravelState(),...(state.travelState||{}),vipCost:5000},
    attributes:{strength:0,vitality:0,agility:0,intellect:0,...(state.attributes||{})},
    attributePoints:Number.isFinite(state.attributePoints)?state.attributePoints:Math.max(0,(state.level||1)-1),
    guildRankIndex:Math.max(0,state.guildRankIndex||0),guildRank:state.guildRank||'E',guildPoints:Math.max(0,state.guildPoints||0),guildMissions:Array.isArray(state.guildMissions)?state.guildMissions:[],guildMissionCycle:state.guildMissionCycle||null,
    baseMaxHp:state.baseMaxHp||state.maxHp||120,baseMaxStamina:state.baseMaxStamina||state.maxStamina||100,
    uiPanel:null,
    dialogue:null,
  }
}

export function totalEquipmentStats(state){
  let atk=0,def=0,speed=0,crit=0
  for(const slot of EQUIPMENT_SLOTS){
    const it=state.equipment?.[slot];if(!it)continue
    const up=1+(it.upgrade||0)*.12,stats=it.stats||itemStats(it.type,it.level||1,it.rarity||'Comum',it.power)
    atk+=(stats.attack||0)*up;def+=(stats.defense||0)*up;speed+=(stats.speed||0)*(1+(it.upgrade||0)*.025);crit+=(stats.crit||0)
  }
  return {atk:Math.round(atk),def:Math.round(def),speed:Number(speed.toFixed(2)),crit:Number(crit.toFixed(1))}
}

export function progressQuest(state,type,target='any',amount=1){
  let changed=false
  state.quests=state.quests.map(q=>{
    if(q.status!=='active'||q.type!==type)return q
    if(q.target!=='any'&&q.target!==target)return q
    const progress=Math.min(q.goal,(q.progress||0)+amount);changed=true
    return {...q,progress,status:progress>=q.goal?'ready':'active'}
  })
  return changed
}

export function activateQuest(state,id){
  state.quests=state.quests.map(q=>q.id===id&&q.status==='available'&&state.level>=q.minLevel?{...q,status:'active',progress:q.type==='level'?Math.min(q.goal,state.level):q.progress}:q)
}

export function claimQuest(state,id){
  const q=state.quests.find(x=>x.id===id)
  if(!q||q.status!=='ready')return null
  q.status='done';state.gold+=q.reward.gold||0
  if(q.reward.mount||q.reward.mountPermission){
    state.mount.unlocked=true
    state.mount.oathCompleted=true
  }
  if(q.reward.item)state.inventory.unshift(makeItem('talisman',Math.max(1,state.level),q.reward.item,`${q.reward.item} — Selo do Explorador`))
  return q.reward
}
