// Awakening / economy / NPC audit V6
// Loaded last. Adds awakening reroll, durability growth, one-use city teleport totems,
// and hardens shop/NPC interactions across every city.

import { CITIES, SAFE_SPAWNS, CITY_ECONOMIES, ZONES } from './config.js'
import { CLASSES_LIST, CLASS_TIERS, rollDestinyClass } from './classesData.js'
import { defaultTravelState } from './fastTravel.js'
import { refreshGuildBoard } from './rpgSystems.js'

export const REROLL_GOLD_COST = 6000
export const TELEPORT_TOTEM_BASE_COST = 4000
export const TELEPORT_TOTEM_SUBTYPE = 'town_teleport_totem'
export const TELEPORT_TOTEM_NAME = 'Totem de Teleporte'

const clamp=(v,min,max)=>Math.max(min,Math.min(max,v))

function save(game){
  game?.saveGame?.()
  game?.saveCloudGame?.()
}

export function nearestCityForPosition(x=0,z=0){
  let best=null,bestD=Infinity
  for(const city of CITIES||[]){
    const d=Math.hypot((Number(x)||0)-city.x,(Number(z)||0)-city.z)
    if(d<bestD){bestD=d;best=city}
  }
  return best
}

export function durabilityAfterUpgrade(maxDurability=0,currentDurability=0){
  const oldMax=Math.max(0,Math.round(Number(maxDurability)||0))
  if(!oldMax)return{maxDurability:0,durability:0,increase:0}
  const current=clamp(Math.round(Number.isFinite(Number(currentDurability))?Number(currentDurability):oldMax),0,oldMax)
  const increase=Math.max(6,Math.round(oldMax*.08))
  const nextMax=oldMax+increase
  return{maxDurability:nextMax,durability:Math.min(nextMax,current+increase),increase}
}

function reputationDiscountPct(game,cityId){
  const rep=clamp(Number(game?.state?.cityReputation?.[cityId])||0,0,100)
  return Math.min(25,Math.floor(rep/20)*5)
}

export function makeTeleportTotemItem(game,cityId=null){
  const resolvedCityId=cityId||game?.currentMerchantCityId||game?.state?.currentCityId||'aurora-city'
  const pct=reputationDiscountPct(game,resolvedCityId)
  const value=Math.max(1,Math.round(TELEPORT_TOTEM_BASE_COST*(1-pct/100)))
  const cycle=Math.floor(Date.now()/600000)
  const zoneId=(CITIES||[]).find(c=>c.id===resolvedCityId)?.zoneId||game?.currentMerchantZoneId||'aurora'
  return{
    id:`shop-town-totem-${resolvedCityId}-${cycle}`,
    name:TELEPORT_TOTEM_NAME,
    type:'consumable',
    subtype:TELEPORT_TOTEM_SUBTYPE,
    rarity:'Rara',
    color:'#a78bfa',
    icon:'🗿',
    level:1,
    power:0,
    qty:1,
    zoneId,
    value,
    reputationBaseValue:TELEPORT_TOTEM_BASE_COST,
    reputationDiscountPct:pct,
    description:`Item de uso único. Teleporta você para a cidade mais próxima. Preço base: ${TELEPORT_TOTEM_BASE_COST}◈.`,
  }
}

function totalGrimoires(game){
  return (game?.state?.inventory||[])
    .filter(item=>item?.subtype==='grimoire')
    .reduce((sum,item)=>sum+Math.max(1,Number(item.qty)||1),0)
}

function consumeOneGrimoire(game){
  const inventory=game?.state?.inventory||[]
  const index=inventory.findIndex(item=>item?.subtype==='grimoire'&&Math.max(1,Number(item.qty)||1)>0)
  if(index<0)return false
  const item=inventory[index]
  item.qty=Math.max(1,Number(item.qty)||1)-1
  if(item.qty<=0)inventory.splice(index,1)
  return true
}

function rerollDifferentClass(activeId){
  let result=null
  for(let i=0;i<12;i++){
    const candidate=rollDestinyClass()
    result=candidate
    if(candidate?.cls?.id&&candidate.cls.id!==activeId)return candidate
  }
  const alternatives=(CLASSES_LIST||[]).filter(cls=>cls?.id&&cls.id!==activeId)
  if(!alternatives.length)return result
  const cls=alternatives[Math.floor(Math.random()*alternatives.length)]
  return{cls,tierInfo:CLASS_TIERS?.[cls.tier]||{name:cls.tier||'Classe'},roll:null}
}

function installAwakeningReroll(game){
  game.redoAwakening=()=>{
    const state=game.state
    if(!state?.classState)return null
    if(totalGrimoires(game)<1){game.toast?.('📖 Você precisa de 1 Grimório do Despertar para refazer o despertar.');return null}
    if((Number(state.gold)||0)<REROLL_GOLD_COST){game.toast?.(`◈ Você precisa de ${REROLL_GOLD_COST} moedas para refazer o despertar.`);return null}

    const oldId=state.classState.activeClassId||CLASSES_LIST?.[0]?.id
    const oldClass=CLASSES_LIST.find(c=>c.id===oldId)
    const result=rerollDifferentClass(oldId)
    const next=result?.cls
    if(!next?.id){game.toast?.('Não foi possível sortear uma nova classe. Tente novamente.');return null}

    if(!consumeOneGrimoire(game))return null
    state.gold=Math.max(0,(Number(state.gold)||0)-REROLL_GOLD_COST)
    state.classState.unlockedClassIds=Array.isArray(state.classState.unlockedClassIds)?state.classState.unlockedClassIds:[]
    if(!state.classState.unlockedClassIds.includes(next.id))state.classState.unlockedClassIds.push(next.id)
    state.classState.rollsCount=(Number(state.classState.rollsCount)||0)+1
    state.classState.rerollCount=(Number(state.classState.rerollCount)||0)+1
    state.classState.lastRerollAt=Date.now()
    game.switchClass?.(next.id)
    game.recalcStats?.()
    game.updateClassAura?.()
    game.updateAbilityCooldowns?.(0)
    save(game)
    const tierName=result?.tierInfo?.name||CLASS_TIERS?.[next.tier]?.name||next.tier||'Classe'
    game.showCenterAnnouncement?.('📖 REDESPERTAR CONCLUÍDO',`${oldClass?.name||'Classe anterior'} → ${next.name}`)
    game.toast?.(`✨ Nova classe equipada: ${next.name} (${tierName}). Consumido 1 Grimório + ${REROLL_GOLD_COST}◈.`)
    return result
  }
}

function installDurabilityUpgrade(game){
  if(game.__auditV6UpgradeWrapped||typeof game.upgrade!=='function')return
  game.__auditV6UpgradeWrapped=true
  const oldUpgrade=game.upgrade.bind(game)
  game.upgrade=slot=>{
    const item=game.state?.equipment?.[slot]
    const oldLevel=Number(item?.upgrade)||0
    const oldMax=Number(item?.maxDurability)||0
    const oldCurrent=Number.isFinite(Number(item?.durability))?Number(item.durability):oldMax
    const result=oldUpgrade(slot)
    if(!result||!item||(Number(item.upgrade)||0)<=oldLevel)return result

    if(oldMax>0){
      const next=durabilityAfterUpgrade(oldMax,oldCurrent)
      item.maxDurability=next.maxDurability
      item.durability=next.durability
      item.broken=item.durability<=0
      game.toast?.(`⚒️ ${item.name} +${item.upgrade} • Durabilidade +${next.increase} (${Math.round(item.durability)}/${item.maxDurability})`)
    }
    game.recalcStats?.()
    save(game)
    return true
  }
}

function setMerchantContext(game,city){
  if(!game||!city)return null
  const zone=(ZONES||[]).find(z=>z.id===city.zoneId)
  game.currentMerchantZoneMin=zone?.min||1
  game.currentMerchantZoneMax=zone?.max||300
  game.currentMerchantZoneId=city.zoneId||'aurora'
  game.currentMerchantCityId=city.id||'aurora-city'
  if(game.state){
    game.state.currentCity=city.name
    game.state.currentCityId=city.id
    const eco=CITY_ECONOMIES?.[city.id]
    if(eco)game.state.economy={cityId:city.id,...eco}
  }
  return city
}

function contextFromPlayer(game){
  const pos=game?.player?.position
  if(!pos)return null
  return setMerchantContext(game,nearestCityForPosition(pos.x,pos.z))
}

function ensureTeleportTotemStock(game){
  if(!game?.state||game.state.uiPanel==='blacksmith')return
  const city=contextFromPlayer(game)||CITIES?.find(c=>c.id===game.currentMerchantCityId)
  const existing=(game.state.merchant||[]).find(item=>item?.subtype===TELEPORT_TOTEM_SUBTYPE)
  const item=makeTeleportTotemItem(game,city?.id)
  if(existing){
    Object.assign(existing,item,{id:existing.id})
  }else{
    game.state.merchant=[...(game.state.merchant||[]),item]
  }
}

function cacheShop(game){
  game.__auditV6ShopCache ||= new Map()
  for(const item of game?.state?.merchant||[]){
    if(item?.id)game.__auditV6ShopCache.set(item.id,{...item})
  }
  if(game.__auditV6ShopCache.size>600){
    const keys=[...game.__auditV6ShopCache.keys()].slice(0,game.__auditV6ShopCache.size-450)
    keys.forEach(key=>game.__auditV6ShopCache.delete(key))
  }
}

function installShopHardening(game){
  if(!game.__auditV6RefreshWrapped&&typeof game.refreshShop==='function'){
    game.__auditV6RefreshWrapped=true
    const oldRefresh=game.refreshShop.bind(game)
    game.refreshShop=(kind=game.state?.uiPanel)=>{
      if(kind==='merchant'||kind==='blacksmith'||game.state?.uiPanel==='merchant'||game.state?.uiPanel==='blacksmith')contextFromPlayer(game)
      const result=oldRefresh(kind)
      if(kind==='merchant'||game.state?.uiPanel==='merchant')ensureTeleportTotemStock(game)
      cacheShop(game)
      return result
    }
  }

  if(!game.__auditV6BuyWrapped&&typeof game.buyItem==='function'){
    game.__auditV6BuyWrapped=true
    const oldBuy=game.buyItem.bind(game)
    game.buyItem=shopId=>{
      let item=(game.state?.merchant||[]).find(x=>x?.id===shopId)
      if(!item&&game.__auditV6ShopCache?.has(shopId)){
        item={...game.__auditV6ShopCache.get(shopId)}
        game.state.merchant=[...(game.state.merchant||[]),item]
      }
      if(!item){
        game.toast?.('Item indisponível. A loja foi atualizada; tente novamente.')
        game.refreshShop?.(game.state?.uiPanel)
        return false
      }
      if(item.subtype!==TELEPORT_TOTEM_SUBTYPE)return oldBuy(shopId)

      const price=Math.max(1,Math.round(Number(item.value)||TELEPORT_TOTEM_BASE_COST))
      if((Number(game.state.gold)||0)<price){game.toast?.('Ouro insuficiente.');return false}
      game.state.gold-=price
      const stack=(game.state.inventory||[]).find(x=>x?.subtype===TELEPORT_TOTEM_SUBTYPE)
      if(stack)stack.qty=Math.max(1,Number(stack.qty)||1)+1
      else game.state.inventory.unshift({...item,id:`town-totem-${Date.now()}`,qty:1,value:TELEPORT_TOTEM_BASE_COST,reputationBaseValue:TELEPORT_TOTEM_BASE_COST})
      game.toast?.(`🗿 ${TELEPORT_TOTEM_NAME} comprado por ${price}◈. Uso único.`)
      save(game)
      return true
    }
  }

  if(game.state?.uiPanel==='merchant'){
    contextFromPlayer(game)
    ensureTeleportTotemStock(game)
    cacheShop(game)
  }
}

function installTeleportUse(game){
  game.useTownTeleportTotem=(itemId=null)=>{
    if(game.state?.dungeon){game.toast?.('🗿 O Totem de Teleporte só pode ser usado no mundo aberto.');return false}
    const inventory=game.state?.inventory||[]
    const item=itemId
      ?inventory.find(i=>i?.id===itemId&&i.subtype===TELEPORT_TOTEM_SUBTYPE)
      :inventory.find(i=>i?.subtype===TELEPORT_TOTEM_SUBTYPE)
    if(!item){game.toast?.('Você não possui um Totem de Teleporte.');return false}
    const pos=game.player?.position
    if(!pos)return false
    const city=nearestCityForPosition(pos.x,pos.z)
    if(!city)return false
    const spawn=SAFE_SPAWNS?.[city.id]||{x:city.x,z:city.z}

    item.qty=Math.max(1,Number(item.qty)||1)-1
    if(item.qty<=0)game.state.inventory=inventory.filter(i=>i!==item)

    game.player.position.set(Number(spawn.x)||city.x,0,Number(spawn.z)||city.z)
    game.savedPosition={x:game.player.position.x,z:game.player.position.z}
    game.state.playerPosition={x:game.player.position.x,z:game.player.position.z}
    game.state.currentCity=city.name
    game.state.currentCityId=city.id
    game.state.zoneId=city.zoneId
    game.state.target=null
    game.state.inCombat=false
    game.state.combatTimer=0
    game.inCombat=false
    game.combatCooldown=0
    game.petTarget=null
    setMerchantContext(game,city)

    if(game.petVisual){game.petVisual.position.set(game.player.position.x+1.25,.55,game.player.position.z-1.05)}
    const pet=game.activePet?.()
    if(pet){pet.inCombat=false;pet.combatUntil=0}
    if(game.state.mount?.active&&game.mountModel){game.mountModel.position.copy(game.player.position)}

    game.closePanel?.()
    save(game)
    game.showCenterAnnouncement?.('🗿 TELEPORTE CONCLUÍDO',`Você retornou para ${city.name}.`)
    game.toast?.(`🗿 Totem consumido • ${city.name} era a cidade mais próxima.`)
    return true
  }
}

function fallbackOpenNpc(game,npc){
  const def=npc?.def
  if(!def)return false
  const city=CITIES.find(c=>c.id===def.cityId)||nearestCityForPosition(def.x,def.z)
  if(city)setMerchantContext(game,city)
  game.suspendCombatForUI?.()
  game.state.dialogue={name:def.name,title:def.title,text:def.dialogue||''}

  if(def.role==='traveler'){
    game.state.travelState ||= defaultTravelState()
    game.state.travelState.nodes ||= {}
    const nodeId=def.zoneId||city?.zoneId||'aurora'
    game.state.travelState.nodes[nodeId]={...(game.state.travelState.nodes[nodeId]||{}),unlocked:true,vipPass:!!game.state.travelState.nodes[nodeId]?.vipPass}
    game.state.uiPanel='travel'
    save(game)
    return true
  }

  game.state.uiPanel=def.role==='quest'?'quests':def.role
  if(def.role==='merchant'||def.role==='blacksmith')game.refreshShop?.(def.role)
  if(def.role==='guild')refreshGuildBoard(game.state)
  return true
}

function installNpcInteractionFallback(game){
  if(game.__auditV6InteractWrapped||typeof game.interact!=='function')return
  game.__auditV6InteractWrapped=true
  const oldInteract=game.interact.bind(game)
  game.interact=(...args)=>{
    const hadPanel=!!game.state?.uiPanel
    const result=oldInteract(...args)
    if(hadPanel||game.state?.uiPanel||game.state?.dungeon)return result
    let near=null,best=6.25
    for(const npc of game.npcs||[]){
      if(!npc?.g?.position)continue
      const d=npc.g.position.distanceTo(game.player.position)
      if(d<best){best=d;near=npc}
    }
    if(near)return fallbackOpenNpc(game,near)
    return result
  }
}

function patchGrimoireDom(game){
  if(typeof document==='undefined'||game.state?.uiPanel!=='grimoire')return
  const root=document.querySelector('.grimoire-layout')
  const anchor=root?.querySelector('.gacha-roll-btn')
  if(!root||!anchor)return
  let box=root.querySelector('.audit-v6-reroll-box')
  if(!box){
    box=document.createElement('div')
    box.className='audit-v6-reroll-box'
    box.style.cssText='margin:10px 0;padding:11px;border:1px solid rgba(167,139,250,.55);background:rgba(76,29,149,.18);border-radius:12px;display:grid;gap:7px'
    anchor.insertAdjacentElement('afterend',box)
  }
  const grim=totalGrimoires(game)
  const gold=Number(game.state?.gold)||0
  const activeId=game.state?.classState?.activeClassId
  const active=CLASSES_LIST.find(c=>c.id===activeId)
  box.innerHTML=`<b style="color:#ddd6fe">🔄 Refazer Despertar</b><small style="color:#c4b5fd">Substitui a classe equipada por uma nova classe sorteada. Sua coleção de classes desbloqueadas é preservada.</small><small style="color:#fde68a">Custo fixo: 1 Grimório + ${REROLL_GOLD_COST}◈ • Atual: ${active?.name||'Classe'} • Grimórios: ${grim}</small>`
  const btn=document.createElement('button')
  btn.type='button'
  btn.className='audit-v6-reroll-btn'
  btn.disabled=grim<1||gold<REROLL_GOLD_COST
  btn.textContent=grim<1?'Precisa de 1 Grimório':gold<REROLL_GOLD_COST?`Precisa de ${REROLL_GOLD_COST}◈`:`🔄 Refazer Despertar • 1 Grimório + ${REROLL_GOLD_COST}◈`
  btn.style.cssText='border:1px solid #a78bfa;background:rgba(124,58,237,.28);color:#f5f3ff;border-radius:10px;padding:10px;font-weight:900;cursor:pointer;opacity:'+(btn.disabled?'.45':'1')
  btn.addEventListener('click',()=>{
    if(!window.confirm(`Refazer o despertar por 1 Grimório + ${REROLL_GOLD_COST}◈? A classe equipada será substituída.`))return
    game.redoAwakening?.()
  })
  box.appendChild(btn)
}

function patchInventoryTotemDom(game){
  if(typeof document==='undefined'||game.state?.uiPanel!=='inventory')return
  const cards=[...document.querySelectorAll('.bag-rpg .item-card')]
  for(const card of cards){
    const title=card.querySelector('b')?.textContent?.trim()
    if(title!==TELEPORT_TOTEM_NAME)continue
    if(card.querySelector('.audit-v6-use-totem'))continue
    const btn=document.createElement('button')
    btn.type='button'
    btn.className='audit-v6-use-totem'
    btn.textContent='🗿 Usar • Ir para cidade mais próxima'
    btn.style.cssText='margin-top:7px;border:1px solid #a78bfa;background:rgba(124,58,237,.18);color:#ede9fe;border-radius:8px;padding:7px 9px;font-weight:900;cursor:pointer'
    btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();game.useTownTeleportTotem?.()})
    card.appendChild(btn)
  }
}

function patchMerchantTotemHint(game){
  if(typeof document==='undefined'||game.state?.uiPanel!=='merchant')return
  const root=document.querySelector('.merchant-modern')
  if(!root)return
  let hint=root.querySelector('.audit-v6-totem-hint')
  if(!hint){
    hint=document.createElement('div')
    hint.className='audit-v6-totem-hint'
    hint.style.cssText='margin:7px 12px;padding:7px 9px;border:1px solid rgba(167,139,250,.45);border-radius:9px;color:#ddd6fe;background:rgba(76,29,149,.12);font-size:12px'
    hint.textContent='🗿 Totem de Teleporte: preço base 4.000◈, uso único, retorna para a cidade mais próxima.'
    root.prepend(hint)
  }
}

function installAuditPersistence(game){
  // Audit finding: some instant inventory/equipment operations relied only on the 10s autosave.
  // Persist unequip/potion immediately so a reload cannot revert a just-used action.
  if(!game.__auditV6UnequipWrapped&&typeof game.unequip==='function'){
    game.__auditV6UnequipWrapped=true
    const old=game.unequip.bind(game)
    game.unequip=(slot,...rest)=>{const before=game.state?.equipment?.[slot];const result=old(slot,...rest);if(before&&!game.state?.equipment?.[slot])save(game);return result}
  }
  if(!game.__auditV6PotionWrapped&&typeof game.usePotion==='function'){
    game.__auditV6PotionWrapped=true
    const old=game.usePotion.bind(game)
    game.usePotion=(...args)=>{const before=Number(game.state?.hp)||0;const result=old(...args);if((Number(game.state?.hp)||0)>before)save(game);return result}
  }
}

export function installAwakeningEconomyNpcAuditV6(game){
  if(!game||game.__awakeningEconomyNpcAuditV6Installed)return false
  game.__awakeningEconomyNpcAuditV6Installed=true
  installAwakeningReroll(game)
  installDurabilityUpgrade(game)
  installTeleportUse(game)
  installShopHardening(game)
  installNpcInteractionFallback(game)
  installAuditPersistence(game)

  if(typeof window!=='undefined'){
    game.__auditV6UiTimer=window.setInterval(()=>{
      if(window.game!==game){window.clearInterval(game.__auditV6UiTimer);return}
      patchGrimoireDom(game)
      patchInventoryTotemDom(game)
      patchMerchantTotemHint(game)
    },260)
  }
  return true
}

function installWhenReady(){
  if(typeof window==='undefined')return
  const attempt=()=>{
    if(!window.game)return false
    window.setTimeout(()=>installAwakeningEconomyNpcAuditV6(window.game),980)
    return true
  }
  if(attempt())return
  const timer=window.setInterval(()=>{if(!attempt())return;window.clearInterval(timer)},100)
  window.setTimeout(()=>window.clearInterval(timer),60000)
}

installWhenReady()
