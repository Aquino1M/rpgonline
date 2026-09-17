import { CITIES, ZONES } from './config.js'

const TOTEM_COST=4000
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v))
const save=game=>{game?.saveGame?.();game?.saveCloudGame?.()}

function capacity(game){try{return Math.max(1,Number(game?.inventoryCapacity?.())||40)}catch{return 40}}
function nearestCity(game){
  const p=game?.player?.position;if(!p)return CITIES[0]||null
  let best=null,bestD=Infinity
  for(const c of CITIES||[]){const d=Math.hypot((Number(p.x)||0)-c.x,(Number(p.z)||0)-c.z);if(d<bestD){bestD=d;best=c}}
  return best
}
function cityDiscount(game){
  const id=game?.currentMerchantCityId||game?.state?.currentCityId||nearestCity(game)?.id||'aurora-city'
  const rep=clamp(Number(game?.state?.cityReputation?.[id])||0,0,100)
  return Math.min(25,Math.floor(rep/20)*5)
}
function setMerchantContext(game,city,role){
  if(!city)return
  const z=ZONES.find(x=>x.id===city.zoneId)
  game.currentMerchantZoneMin=z?.min||1;game.currentMerchantZoneMax=z?.max||300;game.currentMerchantZoneId=city.zoneId||'aurora';game.currentMerchantCityId=city.id||'aurora-city'
  game.state.currentCity=city.name;game.state.currentCityId=city.id;game.state.zoneId=city.zoneId
  game.refreshShop?.(role)
}
function ensureTotem(game){
  if(game.state?.uiPanel!=='merchant')return
  const stock=game.state.merchant||[];if(stock.some(i=>i?.subtype==='teleport_totem'))return
  const pct=cityDiscount(game),cycle=game.state.shopRefresh?.cycle||Math.floor(Date.now()/600000)
  stock.push({id:`teleport-totem-${game.currentMerchantCityId||'city'}-${cycle}`,name:'Totem de Retorno',icon:'🗿',type:'consumable',subtype:'teleport_totem',rarity:'Rara',color:'#38bdf8',level:1,power:0,qty:1,reputationBaseValue:TOTEM_COST,reputationDiscountPct:pct,value:Math.max(1,Math.round(TOTEM_COST*(1-pct/100))),description:'Uso único. Teleporta para a cidade mais próxima. Preço base: 4.000◈.'})
  game.state.merchant=stock
}
function buyFallback(game,item,shopId){
  if(!item)return false
  const price=Math.max(1,Math.round(Number(item.value)||1));if((Number(game.state.gold)||0)<price){game.toast?.('Ouro insuficiente.');return false}
  const inv=game.state.inventory||[],realType=item.originalType||item.type,stackable=['potion','pet_food','teleport_totem'].includes(item.subtype)
  const stack=stackable?inv.find(x=>x.subtype===item.subtype&&(item.subtype!=='pet_food'||x.foodRank===item.foodRank)):null
  if(!stack&&inv.length>=capacity(game)){game.toast?.('Mochila cheia.');return false}
  game.state.gold-=price
  if(stack)stack.qty=(Number(stack.qty)||1)+1
  else inv.unshift({...item,type:realType,id:`buy-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,qty:1})
  if(item.subtype!=='teleport_totem')game.state.merchant=(game.state.merchant||[]).filter(x=>x.id!==shopId)
  save(game);game.toast?.(`${item.name} comprado.`);return true
}

function installShopFixes(game){
  const oldRefresh=game.refreshShop?.bind(game)
  if(oldRefresh&&!game.__v6ShopRefresh){game.__v6ShopRefresh=true;game.refreshShop=(kind=game.state?.uiPanel)=>{
    const r=oldRefresh(kind)
    if(kind==='merchant')ensureTotem(game)
    if(kind==='blacksmith')for(const item of game.state.merchant||[])if(['boots','talisman'].includes(item?.type)&&!item.originalType){item.originalType=item.type;item.type='armor'}
    return r
  }}
  const oldBuy=game.buyItem?.bind(game)
  if(oldBuy&&!game.__v6ShopBuy){game.__v6ShopBuy=true;game.buyItem=id=>{
    const item=(game.state.merchant||[]).find(x=>x.id===id);if(!item){game.toast?.('Item indisponível. Atualize a loja.');return false}
    if(item.subtype==='teleport_totem'||item.originalType)return buyFallback(game,item,id)
    const gold=Number(game.state.gold)||0,count=(game.state.inventory||[]).length
    const r=oldBuy(id)
    if(r===true||Number(game.state.gold)<gold||(game.state.inventory||[]).length!==count)return true
    if((Number(game.state.gold)||0)>=Math.max(1,Number(item.value)||1))return buyFallback(game,item,id)
    return r
  }}
  const oldInteract=game.interact?.bind(game)
  if(oldInteract&&!game.__v6NpcInteract){game.__v6NpcInteract=true;game.interact=(...args)=>{
    let near=null,dist=4.4
    for(const n of game.npcs||[]){const d=n?.g?.position?.distanceTo?.(game.player.position);if(Number.isFinite(d)&&d<dist){near=n;dist=d}}
    const r=oldInteract(...args),role=near?.def?.role
    if(role==='traveler'&&game.state.uiPanel==='traveler')game.state.uiPanel='travel'
    if(role==='merchant'||role==='blacksmith')setMerchantContext(game,(CITIES||[]).find(c=>c.id===near?.def?.cityId)||nearestCity(game),role)
    return r
  }}
  const oldPotion=game.usePotion?.bind(game)
  if(oldPotion&&!game.__v6PotionSave){game.__v6PotionSave=true;game.usePotion=(...args)=>{const hp=Number(game.state.hp)||0,r=oldPotion(...args);if(Number(game.state.hp)!==hp)save(game);return r}}
  const oldUnequip=game.unequip?.bind(game)
  if(oldUnequip&&!game.__v6UnequipSave){game.__v6UnequipSave=true;game.unequip=(...args)=>{const before=JSON.stringify(game.state.equipment||{}),r=oldUnequip(...args);if(JSON.stringify(game.state.equipment||{})!==before)save(game);return r}}
  const oldAccept=game.acceptQuest?.bind(game)
  if(oldAccept&&!game.__v6QuestSave){game.__v6QuestSave=true;game.acceptQuest=(...args)=>{const r=oldAccept(...args);save(game);return r}}
}

function installTotem(game){
  game.useTeleportTotem=()=>{
    const item=(game.state?.inventory||[]).find(i=>i?.subtype==='teleport_totem'&&(Number(i.qty)||1)>0)
    if(!item){game.toast?.('🗿 Você não possui um Totem de Retorno.');return false}
    if(game.state?.dungeon){game.toast?.('🗿 O Totem não funciona dentro de Portal/Dungeon.');return false}
    const city=nearestCity(game);if(!city)return false
    const d=Math.hypot(game.player.position.x-city.x,game.player.position.z-city.z)
    if(d<=(Number(city.radius)||30)+4){game.toast?.(`Você já está em ${city.name}. O Totem não foi consumido.`);return false}
    item.qty=Math.max(0,(Number(item.qty)||1)-1);if(item.qty<=0)game.state.inventory=game.state.inventory.filter(x=>x!==item)
    game.player.position.set(city.x,0,city.z+6.8);game.verticalVelocity=0;game.petTarget=null;game.state.target=null;game.state.currentCity=city.name;game.state.currentCityId=city.id;game.state.zoneId=city.zoneId
    game.combatCooldown=0;game.inCombat=false;game.state.inCombat=false
    if(game.petVisual)game.petVisual.position.set(city.x+1.3,.55,city.z+5.8)
    const pet=game.activePet?.();if(pet){pet.inCombat=false;pet.combatUntil=0}
    game.syncPetVisual?.();save(game);game.showCenterAnnouncement?.('🗿 TOTEM DE RETORNO',`Você retornou para ${city.name}.`);game.toast?.(`🗿 Totem consumido • ${city.name}`);return true
  }
}
function patchTotemButton(game){
  if(typeof document==='undefined'||game.state?.uiPanel!=='inventory')return
  if(!(game.state.inventory||[]).some(i=>i?.subtype==='teleport_totem'))return
  for(const card of document.querySelectorAll('.item-card')){
    if(!card.textContent?.includes('Totem de Retorno'))continue
    const footer=card.querySelector('footer')||card;if(footer.querySelector('.v6-use-totem'))continue
    const b=document.createElement('button');b.type='button';b.className='v6-use-totem';b.textContent='🗿 Usar Totem';b.style.cssText='border:1px solid #38bdf8;background:rgba(14,165,233,.18);color:#e0f2fe;border-radius:8px;padding:7px 10px;font-weight:900;cursor:pointer';b.addEventListener('click',e=>{e.stopPropagation();game.useTeleportTotem?.()});footer.appendChild(b)
  }
}
function audit(game){
  const issues=[],ids=new Set()
  for(const city of CITIES||[])for(const s of city.services||[]){if(ids.has(s.id))issues.push(`NPC duplicado: ${s.id}`);ids.add(s.id);if(!s.role)issues.push(`NPC sem função: ${s.id}`)}
  if(typeof game.buyItem!=='function')issues.push('Compra de loja indisponível')
  if(typeof game.upgrade!=='function')issues.push('Upgrade do ferreiro indisponível')
  game.__v6Audit={ranAt:Date.now(),issues};if(issues.length)console.warn('[V6 Audit]',issues);else console.info('[V6 Audit] Lojas, NPCs, cidades e persistência básica validados.')
}

export function installShopTeleportNpcAuditV6(game){
  if(!game||game.__shopTeleportNpcAuditV6)return false;game.__shopTeleportNpcAuditV6=true
  installShopFixes(game);installTotem(game);audit(game)
  game.__v6ShopUiTimer=window.setInterval(()=>{if(game.state?.uiPanel==='traveler')game.state.uiPanel='travel';if(game.state?.uiPanel==='merchant')ensureTotem(game);patchTotemButton(game)},280)
  return true
}
function ready(){if(typeof window==='undefined')return;const a=()=>{if(!window.game)return false;setTimeout(()=>installShopTeleportNpcAuditV6(window.game),1180);return true};if(a())return;const t=setInterval(()=>{if(a())clearInterval(t)},100);setTimeout(()=>clearInterval(t),60000)}
ready()
