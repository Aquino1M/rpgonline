// Shadow Ascension — UI/UX Overhaul V7
// This module intentionally lives outside App.jsx. It layers a cohesive RPG HUD,
// pet progression UX, QoL interactions and responsive controls over the existing game.

import '../ui/rpgHudThemeV7.css'
import { CITIES, GUILD_RANKS } from './config.js'
import { CLASSES_LIST } from './classesData.js'

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v))
const now=()=>Date.now()
const perfNow=()=>typeof performance!=='undefined'?performance.now():Date.now()
const save=game=>{game?.saveGame?.();game?.saveCloudGame?.()}
const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch]))
const pct=(a,b)=>clamp((Number(a)||0)/Math.max(1,Number(b)||1)*100,0,100)

const CITY_THEMES={
  'aurora-city':'#f0d690','lumen-city':'#d8f58e','cinerea-city':'#80a58a','safira-city':'#4bc1df',
  'veyra-city':'#c7d2c6','rubro-city':'#ef8650','noctis-city':'#9c86d6','celeste-city':'#e8f2ff'
}
const ROLE_INFO={
  merchant:{icon:'🛒',label:'Mercador',subtitle:'Comércio regional'},blacksmith:{icon:'⚒️',label:'Ferreiro',subtitle:'Forja e manutenção'},
  guild:{icon:'🏛️',label:'Guilda',subtitle:'Contratos e progressão'},pets:{icon:'🐾',label:'Guardião dos Pets',subtitle:'Companheiros e evolução'},
  stable:{icon:'🐴',label:'Estábulo',subtitle:'Montarias'},travel:{icon:'🧭',label:'Viajante',subtitle:'Rotas de Asterra'},traveler:{icon:'🧭',label:'Viajante',subtitle:'Rotas de Asterra'},
  quests:{icon:'📜',label:'Missões',subtitle:'Contratos locais'},townhall:{icon:'🏰',label:'Prefeitura',subtitle:'Assuntos da cidade'}
}
const RARITY={Comum:0,Incomum:1,Rara:2,'Épica':3,'Lendária':4,'Mítica':5}

const EVOLUTION_LINES=[
  {re:/slime/i,titles:['Prismático','Real','Arcano','Imperial','Primordial']},
  {re:/lobo|wolf|raposa|fox/i,titles:['Alfa','Lunar','Rúnico','Ancestral','Celestial']},
  {re:/javali|bode|fera|boar|goat|beast/i,titles:['Feral','Couraçado','Ancestral','Colosso','Primordial']},
  {re:/aranha|besouro|escorpi|spider|beetle|scorpion/i,titles:['Caçador','Venenoso','Rúnico','Abissal','Imperador']},
  {re:/corvo|gaivota|harpia|roc|bird|crow|harpy/i,titles:['Tempestuoso','Celeste','Rúnico','Soberano','Primordial']},
  {re:/caranguejo|serpente|leviat|crab|serpent|maré/i,titles:['da Maré','Abissal','Leviatã','Soberano','Primordial']},
  {re:/golem|treant|pedra|xisto|cristal/i,titles:['Guardião','Rúnico','Colosso','Ancestral','Primordial']},
  {re:/brasa|magm|rubro|fogo|fire|ember|lava/i,titles:['Ígneo','Magmático','Infernal','Rubro','Primordial']},
  {re:/umbral|vazio|sombrio|arconte|void|shadow|mímico|mimic/i,titles:['Umbral','Abissal','Arconte','Eclipse','Primordial']},
  {re:/serafim|celeste|soberano|dragão|dragon|celestial|seraph/i,titles:['Radiante','Serafim','Astral','Soberano','Primordial']},
]
const GENERIC_EVOS=['Desperto','Veterano','Arcano','Ascendido','Primordial']
const PET_TALENTS=[
  {id:'ferocity',icon:'⚔️',name:'Fúria Instintiva',desc:'+12% de dano permanente.',apply:pet=>{pet.damage=Math.max(1,Math.round((Number(pet.damage)||1)*1.12))}},
  {id:'guardian',icon:'🛡️',name:'Coração Guardião',desc:'+16% de HP máximo e cura completa.',apply:pet=>{pet.maxHp=Math.max(1,Math.round((Number(pet.maxHp)||1)*1.16));pet.hp=pet.maxHp}},
  {id:'soul',icon:'✨',name:'Sinergia de Alma',desc:'+8% dano, +8% HP e especial fortalecido.',apply:pet=>{pet.damage=Math.max(1,Math.round((Number(pet.damage)||1)*1.08));pet.maxHp=Math.max(1,Math.round((Number(pet.maxHp)||1)*1.08));pet.hp=Math.min(pet.maxHp,(Number(pet.hp)||0)+Math.ceil(pet.maxHp*.08));pet.specialPowerBonus=(Number(pet.specialPowerBonus)||0)+.15}},
]

function activePet(game){return game?.activePet?.()||null}
function cityForGame(game){
  const id=game?.state?.currentCityId||game?.currentMerchantCityId
  return (CITIES||[]).find(c=>c.id===id)||(CITIES||[]).find(c=>c.zoneId===game?.state?.zoneId)||null
}
function ensureEl(id,tag='div',parent=document.body){
  let el=document.getElementById(id)
  if(!el){el=document.createElement(tag);el.id=id;parent.appendChild(el)}
  return el
}
function removeEl(id){document.getElementById(id)?.remove()}
function toastFeed(text,type='player'){
  if(typeof document==='undefined')return
  const feed=ensureEl('v7-combat-feed')
  const el=document.createElement('div');el.className=`v7-combat-float ${type}`;el.textContent=text;feed.prepend(el)
  while(feed.children.length>5)feed.lastElementChild?.remove()
  setTimeout(()=>el.remove(),1000)
}

/* ---------- Combat feedback ---------- */
function installCombatFeedback(game){
  if(game.__v7CombatFeedback)return;game.__v7CombatFeedback=true
  const oldDamage=game.damageEnemy?.bind(game)
  if(oldDamage){game.damageEnemy=(target,amount,opts={})=>{
    const before=Number(target?.hp),result=oldDamage(target,amount,opts),after=Number(target?.hp)
    const dealt=Number.isFinite(before)&&Number.isFinite(after)?Math.max(0,Math.round(before-after)):Math.max(0,Math.round(Number(result)||0))
    if(dealt>0){
      const fromPet=!!opts?.fromPet,crit=!!opts?.crit||(!fromPet&&dealt>(Number(game.state?.atk)||1)*1.55)
      toastFeed(`${fromPet?'🐾 PET ':crit?'💥 CRÍTICO ':''}${dealt}`,fromPet?'pet':crit?'crit':'player')
    }
    return result
  }}
  const oldPlayer=game.damagePlayer?.bind(game)
  if(oldPlayer){game.damagePlayer=(amount,...rest)=>{
    const before=Number(game.state?.hp)||0,r=oldPlayer(amount,...rest),after=Number(game.state?.hp)||0
    if(after<before)toastFeed(`−${Math.round(before-after)} HP`,'hurt')
    return r
  }}
  const oldPotion=game.usePotion?.bind(game)
  if(oldPotion){game.usePotion=(...args)=>{const before=Number(game.state?.hp)||0,r=oldPotion(...args),after=Number(game.state?.hp)||0;if(after>before)toastFeed(`+${Math.round(after-before)} HP`,'heal');return r}}
}

/* ---------- Inventory sorting, favorites and locks ---------- */
function installInventoryRules(game){
  if(game.__v7InventoryRules)return;game.__v7InventoryRules=true
  game.sortInventoryV7=mode=>{
    const inv=game.state?.inventory||[]
    const rarity=x=>Number.isFinite(Number(x?.rarityTier))?Number(x.rarityTier):(RARITY[x?.rarity]??0)
    const cmp={
      rarity:(a,b)=>rarity(b)-rarity(a),
      type:(a,b)=>String(a.type||'').localeCompare(String(b.type||''))||rarity(b)-rarity(a),
      name:(a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR'),
      level:(a,b)=>(Number(b.level)||0)-(Number(a.level)||0)||rarity(b)-rarity(a),
    }[mode]||((a,b)=>0)
    inv.sort((a,b)=>(Number(!!b.v7Favorite)-Number(!!a.v7Favorite))||cmp(a,b))
    game.state.inventory=[...inv];save(game);game.toast?.(`🎒 Inventário ordenado por ${mode}.`);return true
  }
  game.toggleItemFavoriteV7=id=>{const item=(game.state?.inventory||[]).find(i=>i.id===id);if(!item)return false;item.v7Favorite=!item.v7Favorite;save(game);return item.v7Favorite}
  game.toggleItemLockV7=id=>{const item=(game.state?.inventory||[]).find(i=>i.id===id);if(!item)return false;item.v7Locked=!item.v7Locked;save(game);return item.v7Locked}
  const oldSell=game.sellItem?.bind(game)
  if(oldSell){game.sellItem=id=>{const item=(game.state?.inventory||[]).find(i=>i.id===id);if(item?.v7Locked){game.toast?.(`🔒 ${item.name} está bloqueado e não pode ser vendido.`);return false}return oldSell(id)}}
  const oldMulti=game.sellMultipleItems?.bind(game)
  if(oldMulti){game.sellMultipleItems=ids=>{const allowed=(ids||[]).filter(id=>!(game.state?.inventory||[]).find(i=>i.id===id)?.v7Locked);const blocked=(ids||[]).length-allowed.length;if(blocked)game.toast?.(`🔒 ${blocked} item(ns) bloqueado(s) foram protegidos da venda.`);return oldMulti(allowed)}}
}

/* ---------- Pet talents ---------- */
function installPetTalents(game){
  if(game.__v7PetTalents)return;game.__v7PetTalents=true
  game.choosePetTalentV7=(stage,talentId,petId=null)=>{
    const pet=(game.state?.pets?.owned||[]).find(p=>p.id===(petId||game.state.pets.activeId))||activePet(game)
    if(!pet)return false
    stage=Math.max(1,Math.floor(Number(stage)||1))
    if((Number(pet.level)||1)<stage*20){game.toast?.(`Esse talento libera na Evolução ${stage} (Nv.${stage*20}).`);return false}
    pet.evolutionTalents=pet.evolutionTalents||{}
    if(pet.evolutionTalents[stage]){game.toast?.('Essa evolução já possui um talento escolhido.');return false}
    const talent=PET_TALENTS.find(t=>t.id===talentId);if(!talent)return false
    pet.evolutionTalents[stage]=talent.id;talent.apply(pet);save(game)
    game.toast?.(`🌟 ${pet.name} aprendeu ${talent.name}!`)
    game.showCenterAnnouncement?.('🐾 TALENTO DO PET',`${talent.name} • Evolução ${stage}`)
    return true
  }
}

/* ---------- Awakening cinematic ---------- */
function awakeningCinematic(game,label='DESPERTAR CONCLUÍDO'){
  const activeId=game.state?.classState?.activeClassId,cls=CLASSES_LIST.find(c=>c.id===activeId)
  if(!cls||typeof document==='undefined')return
  removeEl('v7-awakening-cinematic')
  const el=ensureEl('v7-awakening-cinematic')
  el.innerHTML=`<div class="soul"><div class="sigil">✦</div><small>${esc(label)}</small><h2>${esc(cls.name)}</h2><p>${esc(cls.tier||'ALMA DESPERTADA')} • Poderes e atributos atualizados</p></div>`
  setTimeout(()=>el.remove(),2300)
}
function installAwakeningCinematic(game){
  if(game.__v7AwakeningCinematic)return;game.__v7AwakeningCinematic=true
  const oldAwaken=game.awakenClass?.bind(game)
  if(oldAwaken){game.awakenClass=(...args)=>{const result=oldAwaken(...args);if(result)setTimeout(()=>awakeningCinematic(game,'ALMA DESPERTADA'),20);return result}}
  const oldReroll=game.rerollAwakeningClass?.bind(game)
  if(oldReroll){game.rerollAwakeningClass=(...args)=>{const result=oldReroll(...args);if(result)setTimeout(()=>awakeningCinematic(game,'NOVO DESPERTAR'),20);return result}}
}

/* ---------- HUD surfaces ---------- */
function renderCityTheme(game){
  const app=document.querySelector('.app');if(!app)return
  const city=cityForGame(game),color=CITY_THEMES[city?.id]||city?.accent||'#60a5fa'
  app.dataset.v7City=city?.id||game.state?.zoneId||'wild';app.style.setProperty('--v7-city-color',color)
  document.documentElement.style.setProperty('--v7-city',color)
  document.querySelector('.player-card')?.classList.add('v7-hud-upgraded')
}
function renderMenuToggle(game){
  const app=document.querySelector('.app'),menu=document.querySelector('.side-menu');if(!app||!menu)return
  const btn=ensureEl('v7-menu-toggle','button',app);btn.type='button';btn.title='Recolher/abrir menu';btn.textContent=app.classList.contains('v7-menu-collapsed')?'›':'‹'
  if(!btn.dataset.bound){btn.dataset.bound='1';btn.addEventListener('click',()=>{const off=app.classList.toggle('v7-menu-collapsed');localStorage.setItem('shadow-v7-menu-collapsed',off?'1':'0');btn.textContent=off?'›':'‹'})}
  if(!app.dataset.v7MenuLoaded){app.dataset.v7MenuLoaded='1';if(localStorage.getItem('shadow-v7-menu-collapsed')==='1')app.classList.add('v7-menu-collapsed')}
}
function renderPetHud(game){
  const pet=activePet(game)
  if(!pet){removeEl('v7-pet-hud');return}
  const el=ensureEl('v7-pet-hud'),recover=Math.max(0,Math.ceil((Number(pet.recoverUntil)-now())/1000)),specialRemain=Math.max(0,Math.ceil(((Number(pet.v4NextSpecialAt)||0)-perfNow())/1000))
  const hp=pct(pet.hp,pet.maxHp),xp=pct(pet.xp,pet.nextXp)
  el.innerHTML=`<div class="v7-pet-title"><strong>🐾 ${esc(pet.name)} • Nv.${Math.max(1,Number(pet.level)||1)}</strong><span class="v7-pet-state">${recover?`RECUPERA ${recover}s`:pet.inCombat?'⚔ combate':'● pronto'}</span></div><div class="v7-pet-meta"><span>HP ${Math.ceil(Number(pet.hp)||0)}/${Math.ceil(Number(pet.maxHp)||1)}</span><span>Dano ${Math.round(Number(pet.damage)||0)}</span></div><div class="v7-mini-bar"><i style="width:${hp}%"></i></div><div class="v7-pet-meta"><span>XP ${Math.floor(Number(pet.xp)||0)}/${Math.max(1,Math.floor(Number(pet.nextXp)||1))}</span><span>${pet.specialUnlocked===false?'🔒 especial Nv.10':specialRemain?`✨ ${specialRemain}s`:`✨ ${esc(pet.specialName||'Especial')}`}</span></div><div class="v7-mini-bar xp"><i style="width:${xp}%"></i></div>`
}
function renderBossBar(game){
  const t=game.state?.target,boss=t?.boss?t:(game.state?.boss?.active?game.state.boss:null)
  if(!boss){removeEl('v7-boss-bar');return}
  const el=ensureEl('v7-boss-bar'),hp=pct(boss.hp,boss.maxHp)
  const phase=hp<=25?'FASE FINAL':hp<=55?'FASE 2':'FASE 1'
  el.innerHTML=`<header><strong>☠ ${esc(boss.name||'CHEFE')}</strong><span>NV.${Math.max(1,Number(boss.level)||1)} • ${phase}</span></header><div class="v7-boss-hp"><i style="width:${hp}%"></i></div><footer><span>HP ${Math.ceil(Number(boss.hp)||0)} / ${Math.ceil(Number(boss.maxHp)||1)}</span><span>${Math.round(hp)}%</span></footer>`
}
function renderWanted(game){
  const level=clamp(Math.round(Number(game.state?.wantedLevel)||0),0,5)
  if(!level){removeEl('v7-wanted');return}
  const el=ensureEl('v7-wanted'),stars='★'.repeat(level)+'☆'.repeat(5-level),bounty=level*500
  el.innerHTML=`🚨 ${stars}<small>PROCURADO ${level}/5 • recompensa estimada ${bounty}◈</small>`
}
function renderTotemQuick(game){
  const item=(game.state?.inventory||[]).find(i=>i?.subtype==='teleport_totem'&&(Number(i.qty)||1)>0)
  if(!item){removeEl('v7-totem-quick');return}
  const el=ensureEl('v7-totem-quick','button');el.type='button';el.innerHTML=`<span>🗿</span>×${Math.max(1,Number(item.qty)||1)}<small>RETORNO</small>`
  if(!el.dataset.bound){el.dataset.bound='1';el.addEventListener('click',()=>game.useTeleportTotem?.())}
}

/* ---------- Smart quest tracker ---------- */
function questPoint(game,q){
  const data=game.state?.mapSnapshot||{}
  const named=[...(data.bosses||[]),...(data.services||[]),...(data.landmarks||[])].find(x=>q?.target&&String(x.name||'').toLowerCase().includes(String(q.target).toLowerCase()))
  if(named)return named
  const giver=(data.services||[]).find(x=>x.name===q?.giver);if(giver)return giver
  const city=(CITIES||[]).find(c=>c.zoneId===q?.zoneId)||(CITIES||[]).find(c=>String(q?.location||'').includes(c.name));return city||null
}
function renderQuestFocus(game){
  const quests=(game.state?.quests||[]).filter(q=>q.status==='active'||q.status==='ready').slice(0,3)
  if(!quests.length){removeEl('v7-quest-focus');return}
  const p=game.player?.position||{x:0,z:0},el=ensureEl('v7-quest-focus')
  el.innerHTML=`<header><span>📜 OBJETIVOS ATIVOS</span><span>${quests.length}/3</span></header>${quests.map(q=>{const point=questPoint(game,q),d=point?Math.round(Math.hypot((point.x||0)-p.x,(point.z||0)-p.z)):null;return `<article data-qid="${esc(q.id)}"><b>${esc(q.title||q.name||'Missão')}</b><span class="${q.status==='ready'?'ready':''}">${q.status==='ready'?'✓ Pronta para receber':`${Math.max(0,Number(q.progress)||0)}/${Math.max(1,Number(q.goal)||1)} • ${esc(q.target||q.description||'Objetivo')}`}</span>${d!=null?` <span class="distance">• ${d}m</span>`:''}</article>`}).join('')}`
  for(const node of el.querySelectorAll('[data-qid]')){node.style.cursor='pointer';node.addEventListener('click',()=>{const q=quests.find(x=>String(x.id)===node.dataset.qid),point=questPoint(game,q);if(point)game.setDestinationMarker?.({x:point.x,z:point.z,name:q.title||q.name||'Missão',color:'#facc15'})},{once:true})}
}

/* ---------- NPC identity ---------- */
function renderNpcBanner(game){
  const role=game.state?.uiPanel,info=ROLE_INFO[role];if(!info)return
  const body=document.querySelector(`.window-${role} .window-body`)||document.querySelector(`.window-${role==='travel'?'traveler':role} .window-body`);if(!body)return
  let banner=body.querySelector(':scope > .v7-npc-banner')
  if(!banner){banner=document.createElement('div');banner.className='v7-npc-banner';body.prepend(banner)}
  const dlg=game.state?.dialogue,city=cityForGame(game)
  banner.innerHTML=`<div class="icon">${info.icon}</div><div><small>${esc(info.subtitle)} • ${esc(city?.name||game.state?.currentCity||'Asterra')}</small><b>${esc(dlg?.name||info.label)}</b></div>`
}

/* ---------- Shop comparison ---------- */
function gearSlot(item){const t=item?.originalType||item?.type;if(t==='weapon'||t==='tool')return'weapon';if(['armor','boots','talisman'].includes(t))return t;return null}
function gearPower(item){if(!item)return 0;const s=item.stats||{};return Math.round((Number(s.attack)||0)*1.1+(Number(s.defense)||0)+(Number(s.speed)||0)*4+(Number(item.upgrade)||0)*2)}
function shopCompareHtml(game,item){
  const slot=gearSlot(item);if(!slot)return''
  const old=game.state?.equipment?.[slot],a=gearPower(item),b=gearPower(old),diff=a-b,cls=diff>0?'up':diff<0?'down':'same'
  return `<div class="v7-gear-compare"><div>${old?`Equipado: <b>${esc(old.name)}</b> • poder ${b}`:`Slot ${slot} vazio`}</div><div class="${cls}">${diff>0?'▲':diff<0?'▼':'◆'} ${diff>0?'+':''}${diff} poder ${diff>0?'• melhoria':diff<0?'• inferior':'• equivalente'}</div></div>`
}
function renderShopCompare(game){
  if(!['merchant','blacksmith'].includes(game.state?.uiPanel))return
  const cards=[...document.querySelectorAll(game.state.uiPanel==='merchant'?'.window-merchant .merchant-card':'.window-blacksmith .shop-scroll-card')]
  const stock=game.state?.merchant||[]
  const used=new Set()
  for(const card of cards){
    if(card.querySelector('.v7-gear-compare'))continue
    const item=stock.find(i=>!used.has(i.id)&&card.textContent?.includes(i.name));if(!item)continue;used.add(item.id)
    const html=shopCompareHtml(game,item);if(!html)continue
    const temp=document.createElement('div');temp.innerHTML=html;const node=temp.firstElementChild
    const button=[...card.querySelectorAll('button')].find(b=>/Comprar/i.test(b.textContent||''));if(button)button.before(node);else card.appendChild(node)
  }
}

/* ---------- Inventory toolbar and item flags ---------- */
function renderInventoryTools(game){
  if(game.state?.uiPanel!=='inventory')return
  const root=document.querySelector('.window-inventory .window-body');if(!root)return
  let bar=root.querySelector(':scope > .v7-inventory-toolbar')
  if(!bar){
    bar=document.createElement('div');bar.className='v7-inventory-toolbar';bar.innerHTML='<span>ORGANIZAR:</span><button data-sort="rarity">Raridade</button><button data-sort="level">Nível</button><button data-sort="type">Tipo</button><button data-sort="name">Nome</button><span>★ favoritos ficam primeiro • 🔒 protege da venda</span>';root.prepend(bar)
    for(const b of bar.querySelectorAll('[data-sort]'))b.addEventListener('click',()=>game.sortInventoryV7?.(b.dataset.sort))
  }
  const cards=[...root.querySelectorAll('.item-card')],available=[...(game.state?.inventory||[])],used=new Set()
  for(const card of cards){
    let item=available.find(i=>!used.has(i.id)&&card.textContent?.includes(i.name));if(!item)continue;used.add(item.id);card.dataset.v7ItemId=item.id
    card.classList.toggle('v7-favorite',!!item.v7Favorite);card.classList.toggle('v7-locked',!!item.v7Locked)
    let tools=card.querySelector('.v7-item-tools')
    if(!tools){tools=document.createElement('div');tools.className='v7-item-tools';tools.innerHTML='<button class="fav" title="Favoritar">★</button><button class="lock" title="Bloquear contra venda">🔒</button>';card.appendChild(tools)
      tools.querySelector('.fav').addEventListener('click',e=>{e.stopPropagation();game.toggleItemFavoriteV7?.(card.dataset.v7ItemId)})
      tools.querySelector('.lock').addEventListener('click',e=>{e.stopPropagation();game.toggleItemLockV7?.(card.dataset.v7ItemId)})
    }
    tools.querySelector('.fav')?.classList.toggle('on',!!item.v7Favorite);tools.querySelector('.lock')?.classList.toggle('locked',!!item.v7Locked)
  }
}

/* ---------- Guild progression ---------- */
function renderGuildRoad(game){
  if(game.state?.uiPanel!=='guild')return
  const card=document.querySelector('.window-guild .guild-rank-card');if(!card)return
  let road=card.querySelector('.v7-guild-road');if(!road){road=document.createElement('div');road.className='v7-guild-road';card.appendChild(road)}
  const idx=clamp(Number(game.state.guildRankIndex)||0,0,GUILD_RANKS.length-1),early=game.guildEarlyPromotionStatus?.()
  road.innerHTML=GUILD_RANKS.map((r,i)=>`${i?'<i class="v7-guild-line"></i>':''}<span class="v7-guild-node ${i<idx?'done':i===idx?'current':early?.eligible&&i===idx+1?'early':''}" title="${esc(r.name||r.id)} • Nv.${r.minLevel||1}">${esc(r.id)}</span>`).join('')
  let prize=card.querySelector('.v7-guild-prize')
  if(early?.eligible){if(!prize){prize=document.createElement('div');prize.className='v7-guild-prize';card.appendChild(prize)}prize.textContent=`🏆 Promoção antecipada disponível: Rank ${early.next.id} • ${early.missingLevels} nível(is) antes • bônus ${early.bonusXp} XP + ${early.bonusGold}◈`}
  else prize?.remove()
}

/* ---------- Pet evolution and talent tree ---------- */
function evoTitles(pet){const species=String(pet?.speciesName||pet?.name||'Companheiro'),rule=EVOLUTION_LINES.find(r=>r.re.test(species));return rule?.titles||GENERIC_EVOS}
function renderPetEvolution(game){
  if(game.state?.uiPanel!=='pets')return
  const section=document.querySelector('.window-pets .stable-catalog-section');if(!section)return
  const pet=activePet(game);let panel=section.querySelector(':scope > .v7-pet-evolution-panel')
  if(!panel){panel=document.createElement('div');panel.className='v7-pet-evolution-panel';const grid=section.querySelector('.horse-grid');grid?section.insertBefore(panel,grid):section.appendChild(panel)}
  if(!pet){panel.innerHTML='<b>🌟 Evolução do Companheiro</b><p style="font-size:10px;color:#94a3b8">Equipe um pet para visualizar a linha evolutiva e talentos.</p>';return}
  const stage=Math.max(0,Math.floor((Number(pet.level)||1)/20)),titles=evoTitles(pet),species=String(pet.speciesName||pet.name||'Companheiro'),maxShow=Math.min(5,Math.max(stage+1,3))
  const forms=[{stage:0,name:species,level:1},...titles.slice(0,maxShow).map((name,i)=>({stage:i+1,name:`${species} ${name}`,level:(i+1)*20}))]
  pet.evolutionTalents=pet.evolutionTalents||{}
  const talentStage=Math.max(1,[...Array(stage).keys()].map(i=>i+1).find(s=>!pet.evolutionTalents[s])||stage||1)
  const choiceOpen=stage>=1&&!pet.evolutionTalents[talentStage]
  const chosen=stage>=1?pet.evolutionTalents[Math.max(1,Math.min(stage,talentStage))]:null
  panel.innerHTML=`<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><div><small style="color:#c4b5fd;font-weight:1000;letter-spacing:.1em">LINHA DE EVOLUÇÃO</small><h3 style="margin:3px 0;color:#fff">🐾 ${esc(pet.name)} • Evolução ${stage}</h3></div><span style="font-size:10px;color:#ddd6fe">Próxima: Nv.${(stage+1)*20}</span></div><div class="v7-evo-track">${forms.map((f,i)=>`${i?'<span class="v7-evo-arrow">→</span>':''}<div class="v7-evo-form ${f.stage<stage?'done':f.stage===stage?'current':''}"><b>${esc(f.name)}</b>Nv.${f.level}${f.stage>stage?' • 🔒':''}</div>`).join('')}</div>${stage<1?'<p style="font-size:10px;color:#94a3b8">O primeiro talento libera junto da evolução no Nv.20.</p>':`<div style="font-size:10px;color:#cbd5e1"><b>🌟 Talento da Evolução ${talentStage}</b>${choiceOpen?' • escolha permanente:':chosen?` • ${esc(PET_TALENTS.find(t=>t.id===chosen)?.name||chosen)}`:' • todos escolhidos'}</div>${choiceOpen?`<div class="v7-talents">${PET_TALENTS.map(t=>`<div class="v7-talent"><b>${t.icon} ${esc(t.name)}</b>${esc(t.desc)}<button data-v7-talent="${t.id}" data-stage="${talentStage}">Escolher</button></div>`).join('')}</div>`:''}`}`
  for(const b of panel.querySelectorAll('[data-v7-talent]'))b.addEventListener('click',()=>{if(window.confirm(`Escolher este talento para a Evolução ${b.dataset.stage}? A escolha é permanente.`))game.choosePetTalentV7?.(Number(b.dataset.stage),b.dataset.v7Talent,pet.id)})
}

/* ---------- World map helper legend ---------- */
const MAP_KINDS=[['merchant','🛒 Loja'],['blacksmith','⚒ Ferreiro'],['pets','🐾 Pets'],['guild','🏛 Guilda'],['traveler','🧭 Viagem'],['quest','📜 Missão'],['boss','☠ Boss'],['gate','🌀 Fenda'],['caravan','🚚 Caravana']]
function nearestPoint(game,kind){
  const data=game.state?.mapSnapshot||{},p=game.player?.position||{x:0,z:0};let list=[]
  if(['merchant','blacksmith','pets','guild','traveler','quest'].includes(kind))list=(data.services||[]).filter(x=>x.role===kind||(kind==='traveler'&&x.role==='travel'))
  else if(kind==='boss')list=data.bosses||[];else if(kind==='gate')list=[...(data.gates||[]),...(data.portals||[])];else if(kind==='caravan')list=data.caravans||[]
  return [...list].sort((a,b)=>Math.hypot((a.x||0)-p.x,(a.z||0)-p.z)-Math.hypot((b.x||0)-p.x,(b.z||0)-p.z))[0]||null
}
function renderMapLegend(game){
  if(game.state?.uiPanel!=='map')return
  const body=document.querySelector('.window-map .window-body');if(!body)return;body.style.position='relative'
  let legend=body.querySelector(':scope > .v7-map-legend');if(!legend){legend=document.createElement('div');legend.className='v7-map-legend';body.appendChild(legend)}
  legend.innerHTML=MAP_KINDS.map(([id,label])=>`<button data-map-kind="${id}">${label}</button>`).join('')
  for(const b of legend.querySelectorAll('[data-map-kind]'))b.addEventListener('click',()=>{const point=nearestPoint(game,b.dataset.mapKind);if(!point){game.toast?.('Nenhum ponto desse tipo foi localizado no mapa atual.');return}game.setDestinationMarker?.({x:point.x,z:point.z,name:point.name||b.textContent,color:point.color||'#38bdf8'});game.toast?.(`🎯 Destino marcado: ${point.name||b.textContent}`)},{once:true})
}

/* ---------- Dungeon cinematic ---------- */
function renderDungeonIntro(game){
  const d=game.state?.dungeon
  if(!d){game.__v7DungeonKey='';return}
  const key=`${d.worldSeed||d.name}:${d.floor||d.round||1}`
  if(game.__v7DungeonKey===key)return
  game.__v7DungeonKey=key;removeEl('v7-dungeon-intro')
  const el=ensureEl('v7-dungeon-intro');el.innerHTML=`<div><small>FENDA DETECTADA</small><h1>${esc(d.name||'MASMORRA')}</h1><p>Rank ${esc(d.rank||'E')} • Nv.${Math.max(1,Number(d.level)||1)} • ${d.totalRounds||d.rounds||4} rounds</p></div>`;setTimeout(()=>el.remove(),2450)
}

/* ---------- Mobile HUD editor ---------- */
function mobilePrefs(){try{return JSON.parse(localStorage.getItem('shadow-v7-mobile-ui')||'{}')}catch{return{}}}
function applyMobilePrefs(p){const root=document.documentElement;root.style.setProperty('--v7-mobile-scale',String(clamp(Number(p.scale)||1,.75,1.35)));root.style.setProperty('--v7-mobile-opacity',String(clamp(Number(p.opacity)||.96,.4,1)));root.style.setProperty('--v7-mobile-actions-x',`${clamp(Number(p.x)||0,-120,120)}px`);root.style.setProperty('--v7-mobile-actions-y',`${clamp(Number(p.y)||0,-160,80)}px`)}
function renderMobileEditor(game){
  const app=document.querySelector('.app');if(!app?.classList.contains('touch-ui')){removeEl('v7-mobile-edit');removeEl('v7-mobile-panel');return}
  const btn=ensureEl('v7-mobile-edit','button');btn.type='button';btn.textContent='✥';btn.title='Personalizar controles'
  if(!btn.dataset.bound){btn.dataset.bound='1';btn.addEventListener('click',()=>{const old=document.getElementById('v7-mobile-panel');if(old){old.remove();return}const p=mobilePrefs(),panel=ensureEl('v7-mobile-panel');panel.innerHTML=`<h4>🎮 Personalizar Controles</h4><label>Tamanho <input data-k="scale" type="range" min="0.75" max="1.35" step="0.05" value="${clamp(Number(p.scale)||1,.75,1.35)}"><b></b></label><label>Opacidade <input data-k="opacity" type="range" min="0.4" max="1" step="0.05" value="${clamp(Number(p.opacity)||.96,.4,1)}"><b></b></label><label>Horizontal <input data-k="x" type="range" min="-120" max="120" step="5" value="${clamp(Number(p.x)||0,-120,120)}"><b></b></label><label>Vertical <input data-k="y" type="range" min="-160" max="80" step="5" value="${clamp(Number(p.y)||0,-160,80)}"><b></b></label><button type="button" data-reset>Restaurar posição padrão</button>`
      const sync=()=>{const next={};for(const input of panel.querySelectorAll('input[data-k]')){next[input.dataset.k]=Number(input.value);input.nextElementSibling.textContent=input.dataset.k==='opacity'?`${Math.round(input.value*100)}%`:input.dataset.k==='scale'?`${Math.round(input.value*100)}%`:`${input.value}px`}localStorage.setItem('shadow-v7-mobile-ui',JSON.stringify(next));applyMobilePrefs(next)}
      for(const input of panel.querySelectorAll('input[data-k]'))input.addEventListener('input',sync);panel.querySelector('[data-reset]')?.addEventListener('click',()=>{localStorage.removeItem('shadow-v7-mobile-ui');applyMobilePrefs({});panel.remove()});sync()})}
  if(!game.__v7MobilePrefsApplied){game.__v7MobilePrefsApplied=true;applyMobilePrefs(mobilePrefs())}
}

/* ---------- Responsive overlay cleanup ---------- */
function compactLegacySurfaces(game){
  const status=document.querySelector('.world-status');if(status)status.dataset.v7='1'
  const dungeon=document.querySelector('.dungeon-card');if(dungeon){dungeon.style.maxWidth='230px';dungeon.style.opacity='.92'}
  const portal=document.querySelector('.portal-card');if(portal){portal.style.maxWidth='230px';portal.style.opacity='.92'}
}

function renderAll(game){
  if(typeof document==='undefined'||!document.querySelector('.app'))return
  renderCityTheme(game);renderMenuToggle(game);renderPetHud(game);renderBossBar(game);renderWanted(game);renderTotemQuick(game);renderQuestFocus(game)
  renderNpcBanner(game);renderShopCompare(game);renderInventoryTools(game);renderGuildRoad(game);renderPetEvolution(game);renderMapLegend(game);renderDungeonIntro(game);renderMobileEditor(game);compactLegacySurfaces(game)
}

export function installUiOverhaulV7(game){
  if(!game||game.__uiOverhaulV7)return false;game.__uiOverhaulV7=true
  installCombatFeedback(game);installInventoryRules(game);installPetTalents(game);installAwakeningCinematic(game)
  game.__v7UiTimer=window.setInterval(()=>renderAll(game),220)
  setTimeout(()=>renderAll(game),40)
  return true
}

function ready(){
  if(typeof window==='undefined')return
  const attempt=()=>{if(!window.game)return false;setTimeout(()=>installUiOverhaulV7(window.game),1380);return true}
  if(attempt())return
  const timer=setInterval(()=>{if(attempt())clearInterval(timer)},100);setTimeout(()=>clearInterval(timer),60000)
}
ready()
