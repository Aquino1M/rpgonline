// Pet / economy / guild V3 fixes.
// Loaded last so these rules win over older compatibility patches.

import { GUILD_RANKS } from './config.js'
import { CLASSES_LIST } from './classesData.js'
import { guildRankRequirement, refreshGuildBoard } from './rpgSystems.js'
import { petPowerProfile } from './requestedGameplayFixes.js'

const FOOD_RANKS = [
  { rank:'E', name:'Ração de Domação E', rarity:'Comum',    color:'#94a3b8', tameBonus:.05, cost:180 },
  { rank:'D', name:'Ração de Domação D', rarity:'Incomum', color:'#22c55e', tameBonus:.10, cost:650 },
  { rank:'C', name:'Ração de Domação C', rarity:'Rara',     color:'#38bdf8', tameBonus:.18, cost:2200 },
  { rank:'B', name:'Ração de Domação B', rarity:'Épica',    color:'#a855f7', tameBonus:.28, cost:7000 },
  { rank:'A', name:'Ração de Domação A', rarity:'Lendária', color:'#f59e0b', tameBonus:.40, cost:22000 },
  { rank:'S', name:'Ração de Domação S', rarity:'Mítica',   color:'#ef4444', tameBonus:.55, cost:65000 },
]

const perfNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
const clamp = (v,min,max) => Math.max(min,Math.min(max,v))

export function reputationDiscountPct(reputation=0){
  const rep=clamp(Number(reputation)||0,0,100)
  return Math.min(25,Math.floor(rep/20)*5)
}

export function rankedTamingFoodCatalog(){
  return FOOD_RANKS.map(x=>({...x}))
}

export function underlevelGuildPromotionStatus(state={}){
  const currentIndex=clamp(Number(state.guildRankIndex)||0,0,GUILD_RANKS.length-1)
  const nextIndex=currentIndex+1
  const next=GUILD_RANKS[nextIndex]
  if(!next)return{eligible:false,currentIndex,nextIndex:null,next:null,missingLevels:0,missingGuildPoints:0}
  const level=Math.max(1,Number(state.level)||1)
  const guildPoints=Math.max(0,Number(state.guildPoints)||0)
  const requirement=guildRankRequirement(nextIndex)
  const missingLevels=Math.max(0,next.minLevel-level)
  const missingGuildPoints=Math.max(0,requirement-guildPoints)
  const eligible=missingLevels>0&&missingGuildPoints===0
  return{
    eligible,currentIndex,nextIndex,next,level,guildPoints,requirement,missingLevels,missingGuildPoints,
    bonusXp:Math.max(100,Math.round((180+missingLevels*70)*next.mult)),
    bonusGold:Math.max(120,Math.round((240+missingLevels*95)*next.mult)),
  }
}

function currentCityId(game){
  return game?.currentMerchantCityId||game?.state?.currentCityId||game?.state?.economy?.cityId||'aurora-city'
}

function currentDiscount(game){
  const cityId=currentCityId(game)
  const rep=Number(game?.state?.cityReputation?.[cityId])||0
  return{cityId,rep:clamp(rep,0,100),pct:reputationDiscountPct(rep)}
}

function applyShopDiscount(game){
  const {pct}=currentDiscount(game)
  const mult=1-pct/100
  for(const item of game?.state?.merchant||[]){
    if(!item)continue
    if(!Number.isFinite(Number(item.reputationBaseValue)))item.reputationBaseValue=Math.max(1,Math.round(Number(item.value)||1))
    item.reputationDiscountPct=pct
    item.value=Math.max(1,Math.round(item.reputationBaseValue*mult))
  }
}

function ensureRankedRations(game){
  if(!game?.state)return
  const kind=game.state.uiPanel
  if(kind==='blacksmith')return
  const stock=(game.state.merchant||[]).filter(item=>item?.subtype!=='pet_food')
  const zoneId=game.currentMerchantZoneId||game.state.zoneId||'aurora'
  const {pct}=currentDiscount(game)
  const mult=1-pct/100
  const cycle=Math.floor(Date.now()/600000)
  for(const food of FOOD_RANKS){
    const base=Math.round(food.cost*(1+(Number(game.state.level)||1)/900))
    stock.push({
      id:`shop-pet-food-${food.rank}-${cycle}-${zoneId}`,
      name:food.name,type:'consumable',subtype:'pet_food',foodRank:food.rank,
      rarity:food.rarity,color:food.color,level:1,power:0,qty:1,zoneId,
      tameBonus:food.tameBonus,reputationBaseValue:base,reputationDiscountPct:pct,
      value:Math.max(1,Math.round(base*mult)),
      description:`Ração Rank ${food.rank}: +${Math.round(food.tameBonus*100)}% de chance de domação. Quanto maior o rank, maior o custo e a eficiência.`
    })
  }
  game.state.merchant=stock
}

function rationInventory(game){
  return (game?.state?.inventory||[]).filter(item=>item?.subtype==='pet_food'&&(Number(item.qty)||1)>0)
}

function chosenRation(game,id=null){
  const foods=rationInventory(game)
  if(!foods.length)return null
  if(id){const exact=foods.find(f=>f.id===id);if(exact)return exact}
  const saved=game?.state?.pets?.tamingFoodId
  if(saved){const exact=foods.find(f=>f.id===saved);if(exact)return exact}
  return [...foods].sort((a,b)=>(Number(b.tameBonus)||0)-(Number(a.tameBonus)||0))[0]
}

function consumeRation(game,food){
  if(!food)return
  food.qty=(Number(food.qty)||1)-1
  if(food.qty<=0)game.state.inventory=game.state.inventory.filter(item=>item!==food)
}

function save(game){
  game?.saveGame?.()
  game?.saveCloudGame?.()
}

function safePetName(name){
  return String(name||'').replace(/[<>\n\r]/g,'').replace(/\s+/g,' ').trim().slice(0,22)
}

function gainPetXp(game,pet,target){
  pet.xp=Math.max(0,Number(pet.xp)||0)+Math.max(1,Math.round((Number(target?.level)||1)*.75))
  pet.nextXp=Math.max(30,Number(pet.nextXp)||Math.max(50,(Number(pet.level)||1)*85))
  while(pet.xp>=pet.nextXp){
    pet.xp-=pet.nextXp
    pet.level=Math.max(1,Number(pet.level)||1)+1
    pet.nextXp=Math.round(pet.nextXp*1.28)
    pet.maxHp=Math.max(1,Number(pet.maxHp)||30)+Math.max(8,Math.round(pet.level*1.7))
    pet.hp=pet.maxHp
    pet.damage=Math.max(1,Number(pet.damage)||4)+Math.max(2,Math.round(pet.level*.22))
    game.toast?.(`🐾 ${pet.name} subiu para Nv.${pet.level}!`)
  }
}

function directPetDamage(game,pet,target,raw){
  if(!target||target.dead||!Number.isFinite(Number(target.hp)))return 0
  const before=Number(target.hp)
  const amount=Math.max(1,Math.round(raw))
  game.damageEnemy?.(target,amount,{knockback:.12,fromPet:true})
  let after=Number(target.hp)
  if(after<before)return before-after

  // Safety path: older wrappers can report an attack without mutating mob HP.
  const def=Math.max(0,Number(target.def)||0)
  const dealt=Math.max(1,Math.round(amount*100/(100+def*.65)))
  target.hp=Math.max(0,before-dealt)
  after=target.hp
  if(game.state)game.state.target={name:target.name,level:target.level,hp:after,maxHp:target.maxHp,boss:target.boss,crit:false}
  game.spawnDamageText?.(target.g?.position,dealt,false)
  game.flashEnemy?.(target,false)
  if(after<=0){target.hp=0;game.kill?.(target)}
  return dealt
}

function installPetCombatGuarantee(game){
  const oldUpdate=game.updatePets?.bind(game)
  if(!oldUpdate)return
  game.updatePets=dt=>{
    const petBefore=game.activePet?.()
    const targetBefore=game.petTarget
    const hpBefore=Number(targetBefore?.hp)
    const petHpBefore=Number(petBefore?.hp)
    oldUpdate(dt)

    const pet=game.activePet?.()
    if(!pet)return
    pet.maxHp=Math.max(1,Number(pet.maxHp)||30)
    if(!Number.isFinite(Number(pet.hp)))pet.hp=pet.maxHp

    const wallNow=Date.now()
    if(Number(pet.recoverUntil)>wallNow){
      pet.hp=0
      pet.inCombat=false
      pet.regenCarry=0
      return
    }
    if(Number(pet.recoverUntil)>0&&Number(pet.recoverUntil)<=wallNow){
      pet.recoverUntil=0;pet.hp=pet.maxHp;pet.regenCarry=0;pet.inCombat=false
    }

    const target=game.petTarget||((targetBefore&&!targetBefore.dead&&Number(targetBefore.hp)>0)?targetBefore:null)
    const visual=game.petVisual
    const inRange=!!(target&&visual&&target.g?.position&&target.g.position.distanceTo(visual.position)<=2.35)
    if(target&&!target.dead&&Number(target.hp)>0){
      pet.inCombat=true
      pet.combatUntil=wallNow+5000
      pet.regenCarry=0
      const now=perfNow()
      if(inRange&&now>=(Number(pet.v3NextAttackAt)||0)){
        const afterOld=Number(target.hp)
        pet.v3NextAttackAt=now+950
        if(!Number.isFinite(hpBefore)||afterOld>=hpBefore){
          const raw=Math.max(1,(Number(pet.damage)||4)*(.92+Math.random()*.16))
          const dealt=directPetDamage(game,pet,target,raw)
          if(dealt>0){
            gainPetXp(game,pet,target)
            if(!target.dead&&Number(target.hp)>0&&now>=(Number(pet.v3NextSpecialAt)||0)){
              pet.v3NextSpecialAt=now+5200
              const profile=petPowerProfile(pet.name)
              directPetDamage(game,pet,target,(Number(pet.damage)||4)*profile.multiplier)
              game.spawnAbilityRing?.(profile.color,profile.radius,.35)
              game.toast?.(`🐾 ${pet.name}: ${profile.name}!`)
            }
          }
        }
      }

      // Guarantee the pet also participates defensively in combat if the older combat path missed the hit.
      if(inRange&&perfNow()>=(Number(pet.v3NextHurtAt)||0)){
        pet.v3NextHurtAt=perfNow()+1600
        const hpAfterOld=Number(pet.hp)
        if(Number.isFinite(petHpBefore)&&hpAfterOld>=petHpBefore){
          const enemyAtk=Math.max(5,Number(target.atk)||Number(target.damage)||7)
          pet.hp=Math.max(0,hpAfterOld-Math.max(1,Math.round(enemyAtk*.24)))
          if(pet.hp<=0){
            pet.hp=0;pet.recoverUntil=wallNow+45000;pet.inCombat=false;game.petTarget=null;pet.regenCarry=0
            game.toast?.(`🐾 ${pet.name} caiu em combate. Recuperação: 45s.`)
            save(game)
          }
        }
      }
    }else{
      if(wallNow>=(Number(pet.combatUntil)||0))pet.inCombat=false
      if(!pet.inCombat&&pet.hp>0&&pet.hp<pet.maxHp){
        // Integer carry fixes the old per-frame rounding bug: small regeneration is never lost.
        pet.regenCarry=(Number(pet.regenCarry)||0)+pet.maxHp*.08*Math.max(0,Number(dt)||0)
        if(pet.regenCarry>=1){
          const heal=Math.floor(pet.regenCarry)
          pet.regenCarry-=heal
          pet.hp=Math.min(pet.maxHp,pet.hp+heal)
        }
      }
    }
  }
}

function installPetRules(game){
  game.renamePet=(petId,newName)=>{
    const pet=(game.state?.pets?.owned||[]).find(p=>p.id===petId)
    if(!pet)return false
    const name=safePetName(newName)
    if(name.length<2){game.toast?.('O nome do pet precisa ter pelo menos 2 caracteres.');return false}
    pet.name=name
    if(game.petNameplate?.userData)game.petNameplate.userData.signature=''
    game.petVisualKey=''
    game.syncPetVisual?.()
    save(game)
    game.toast?.(`🐾 Seu companheiro agora se chama ${name}.`)
    return true
  }

  game.armPetTaming=(foodId=null)=>{
    if((game.state?.pets?.owned||[]).length>=5){game.toast?.('Você já possui o limite de 5 pets.');return false}
    const food=chosenRation(game,foodId)
    if(!food){game.state.pets.tamingArmed=false;game.toast?.('Você não possui Ração de Domação.');return false}
    game.state.pets.tamingArmed=true
    game.state.pets.tamingFoodId=food.id
    game.toast?.(`🍖 ${food.name} equipada • +${Math.round((Number(food.tameBonus)||.05)*100)}% de chance.`)
    save(game)
    return true
  }

  game.tryTamePet=enemy=>{
    if(!game.state?.pets?.tamingArmed||!enemy||enemy.dead||enemy.boss||(game.state.pets.owned||[]).length>=5)return false
    const food=chosenRation(game,game.state.pets.tamingFoodId)
    if(!food){game.state.pets.tamingArmed=false;game.state.pets.tamingFoodId=null;return false}
    const hpPct=Number(enemy.hp)/Math.max(1,Number(enemy.maxHp)||1)
    if(hpPct>.55)return false

    const cls=CLASSES_LIST.find(c=>c.id===game.state.classState?.activeClassId)
    const foodBonus=Math.max(0,Number(food.tameBonus)||.05)
    const chance=Math.min(.95,.18+(1-hpPct)*.42+(Number(cls?.passive?.tameChance)||0)+foodBonus)
    const rank=food.foodRank||'E'
    consumeRation(game,food)
    const sameRank=rationInventory(game).find(f=>(f.foodRank||'E')===rank)
    game.state.pets.tamingFoodId=sameRank?.id||null
    game.state.pets.tamingArmed=!!sameRank

    if(Math.random()>chance){
      game.toast?.(`❌ Domação falhou com Ração ${rank} (${Math.round(chance*100)}%). ${sameRank?'A próxima ração ficou equipada.':'Equipe outra ração para tentar novamente.'}`)
      save(game)
      return false
    }

    const pet={
      id:`pet-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      name:enemy.name,speciesName:enemy.name,level:Math.max(1,Number(enemy.level)||1),xp:0,
      nextXp:Math.max(50,Math.round((Number(enemy.level)||1)*85)),
      hp:Math.max(20,Math.round((Number(enemy.maxHp)||50)*.55)),
      maxHp:Math.max(20,Math.round((Number(enemy.maxHp)||50)*.55)),
      damage:Math.max(4,Math.round((Number(enemy.atk)||8)*.48)),
      color:'#60a5fa',specialName:`Poder de ${enemy.name}`,recoverUntil:0,inCombat:false,combatUntil:0,regenCarry:0,
    }
    game.state.pets.owned=[...(game.state.pets.owned||[]),pet]
    game.state.pets.activeId=pet.id
    game.state.pets.tamingArmed=false
    game.state.pets.tamingFoodId=null
    enemy.dead=true
    enemy.g?.parent?.remove(enemy.g)
    game.enemies=(game.enemies||[]).filter(e=>e!==enemy)
    game.petTarget=null
    game.petVisualKey=''
    game.syncPetVisual?.()
    game.toast?.(`🐾 DOMAÇÃO CONCLUÍDA! ${pet.name} Nv.${pet.level} agora luta ao seu lado.`)
    save(game)
    return true
  }

  installPetCombatGuarantee(game)
}

function installShopRules(game){
  const oldRefresh=game.refreshShop?.bind(game)
  if(oldRefresh){
    game.refreshShop=(kind=game.state?.uiPanel)=>{
      const result=oldRefresh(kind)
      if(kind==='merchant'||game.state?.uiPanel==='merchant')ensureRankedRations(game)
      applyShopDiscount(game)
      return result
    }
  }

  const oldBuy=game.buyItem?.bind(game)
  if(oldBuy){
    game.buyItem=shopId=>{
      const item=(game.state?.merchant||[]).find(x=>x.id===shopId)
      if(item?.subtype!=='pet_food')return oldBuy(shopId)
      const price=Math.max(1,Math.round(Number(item.value)||1))
      if((Number(game.state.gold)||0)<price){game.toast?.('Ouro insuficiente.');return false}
      game.state.gold-=price
      const existing=(game.state.inventory||[]).find(x=>x.subtype==='pet_food'&&(x.foodRank||'E')===(item.foodRank||'E'))
      if(existing)existing.qty=(Number(existing.qty)||1)+1
      else game.state.inventory.unshift({...item,id:`pet-food-${item.foodRank||'E'}-${Date.now()}`,qty:1})
      const {pct}=currentDiscount(game)
      game.toast?.(`🍖 ${item.name} comprada por ${price}◈${pct?` • ${pct}% de desconto por reputação`:''}.`)
      save(game)
      return true
    }
  }

  if(game.state?.uiPanel==='merchant')ensureRankedRations(game)
  applyShopDiscount(game)
}

function installGuildRules(game){
  game.guildEarlyPromotionStatus=()=>underlevelGuildPromotionStatus(game.state)
  game.promoteGuildEarly=()=>{
    const status=underlevelGuildPromotionStatus(game.state)
    if(!status.next){game.toast?.('Você já está no Rank máximo da Guilda.');return null}
    if(status.missingLevels<=0){game.toast?.(`Você já possui o nível necessário para o Rank ${status.next.id}. Complete os requisitos normais da Guilda.`);return null}
    if(status.missingGuildPoints>0){game.toast?.(`Faltam ${status.missingGuildPoints} XP da Guilda para a promoção antecipada.`);return null}

    game.state.guildRankIndex=status.nextIndex
    game.state.guildRank=status.next.id
    game.state.guildEarlyPromotionRank=status.next.id
    game.state.guildEarlyPromotionMinLevel=status.next.minLevel
    game.state.gold=Math.max(0,Number(game.state.gold)||0)+status.bonusGold
    game.state.guildMissionCycle=null
    refreshGuildBoard(game.state)
    for(const mission of game.state.guildMissions||[]){
      if((Number(mission.rankIndex)||0)<=status.nextIndex)mission.minLevel=Math.min(Number(mission.minLevel)||status.level,status.level)
    }
    game.gainXp?.(status.bonusXp,'Promoção antecipada da Guilda')
    save(game)
    game.toast?.(`🏆 PREMIAÇÃO ANTECIPADA! Rank ${status.next.id} com ${status.missingLevels} níveis de antecedência: +${status.bonusXp} XP e +${status.bonusGold}◈.`)
    return status
  }
}

function patchPetPanelDom(game){
  if(typeof document==='undefined'||game.state?.uiPanel!=='pets')return
  const pets=game.state?.pets?.owned||[]
  const cards=[...document.querySelectorAll('.stable-catalog-section .horse-card')]
  cards.forEach((card,index)=>{
    const pet=pets[index]
    if(!pet)return
    const tag=card.querySelector('.horse-tag')
    if(tag&&pet.inCombat)tag.textContent='⚔ Em combate'
    let rename=card.querySelector('.pet-v3-rename')
    if(!rename){
      rename=document.createElement('button')
      rename.type='button';rename.className='pet-v3-rename';rename.textContent='✏️ Editar nome'
      rename.style.cssText='margin-top:7px;border:1px solid #38bdf8;background:rgba(56,189,248,.12);color:#bae6fd;border-radius:8px;padding:7px 9px;font-weight:800;cursor:pointer'
      rename.addEventListener('click',()=>{
        const current=(game.state?.pets?.owned||[])[index]
        if(!current)return
        const next=window.prompt('Novo nome do pet:',current.name||'Companheiro')
        if(next!==null)game.renamePet?.(current.id,next)
      })
      card.appendChild(rename)
    }
  })

  const box=document.querySelector('.tamed-horse-card')
  if(!box)return
  let rack=box.querySelector('.pet-v3-food-rack')
  if(!rack){rack=document.createElement('div');rack.className='pet-v3-food-rack';rack.style.cssText='margin:12px;padding:12px;border:1px solid rgba(251,146,60,.45);border-radius:12px;background:rgba(15,23,42,.72)';box.appendChild(rack)}
  const foods=rationInventory(game)
  const selected=game.state.pets?.tamingFoodId
  rack.innerHTML=`<b style="color:#fdba74">🍖 Rações por Rank</b><div style="font-size:12px;color:#cbd5e1;margin:4px 0 8px">Rações superiores custam mais e aumentam a chance de domação.</div><div class="pet-v3-food-buttons" style="display:flex;gap:6px;flex-wrap:wrap"></div>`
  const row=rack.querySelector('.pet-v3-food-buttons')
  for(const spec of FOOD_RANKS){
    const owned=foods.filter(f=>(f.foodRank||'E')===spec.rank).reduce((s,f)=>s+(Number(f.qty)||1),0)
    const food=foods.find(f=>(f.foodRank||'E')===spec.rank)
    const b=document.createElement('button');b.type='button';b.disabled=!food
    b.textContent=`${spec.rank} • +${Math.round(spec.tameBonus*100)}% (${owned})${food?.id===selected?' ✓':''}`
    b.style.cssText=`border:1px solid ${spec.color};background:${food?.id===selected?'rgba(239,68,68,.20)':'rgba(2,6,23,.70)'};color:${spec.color};border-radius:8px;padding:6px 8px;font-weight:900;cursor:${food?'pointer':'not-allowed'};opacity:${food?'1':'.4'}`
    if(food)b.addEventListener('click',()=>game.armPetTaming?.(food.id))
    row.appendChild(b)
  }
}

function patchMerchantDom(game){
  if(typeof document==='undefined'||game.state?.uiPanel!=='merchant')return
  const root=document.querySelector('.merchant-modern')
  if(!root)return
  const {rep,pct}=currentDiscount(game)
  let banner=root.querySelector('.rep-discount-v3')
  if(!banner){banner=document.createElement('div');banner.className='rep-discount-v3';banner.style.cssText='margin:8px 12px;padding:8px 10px;border-radius:9px;border:1px solid #facc15;background:rgba(250,204,21,.10);color:#fde68a;font-weight:800;font-size:12px';root.prepend(banner)}
  banner.textContent=`⭐ Reputação da cidade: ${Math.round(rep)}/100 • Desconto nas compras: ${pct}%`
}

function syncEarlyRankBadge(game){
  const rank=game.state?.guildRank
  const marked=game.state?.guildEarlyPromotionRank===rank
  const min=Number(game.state?.guildEarlyPromotionMinLevel)||GUILD_RANKS[Number(game.state?.guildRankIndex)||0]?.minLevel||1
  if(marked&&(Number(game.state?.level)||1)>=min){
    game.state.guildEarlyPromotionRank=null;game.state.guildEarlyPromotionMinLevel=null;save(game)
  }
  if(typeof document==='undefined')return
  const active=game.state?.guildEarlyPromotionRank===game.state?.guildRank
  const rankTag=document.querySelector('.player-card .identity-line span')
  if(rankTag){
    if(active){rankTag.style.color='#ff3b3b';rankTag.style.textShadow='0 0 12px rgba(239,68,68,.85)';rankTag.style.fontWeight='1000';rankTag.textContent=`RANK ${game.state.guildRank} ★ PREMIAÇÃO`}
    else{rankTag.style.color='';rankTag.style.textShadow='';rankTag.style.fontWeight=''}
  }
  const card=document.querySelector('.window-guild .guild-rank-card')||document.querySelector('.guild-layout .guild-rank-card')
  if(!card)return
  let btn=card.querySelector('.underlevel-rank-v3')
  const status=underlevelGuildPromotionStatus(game.state)
  if(status.missingLevels<=0||!status.next){btn?.remove();return}
  if(!btn){btn=document.createElement('button');btn.type='button';btn.className='underlevel-rank-v3';btn.style.cssText='width:100%;margin-top:10px;padding:10px;border-radius:9px;border:1px solid #ef4444;background:rgba(239,68,68,.15);color:#fecaca;font-weight:1000;cursor:pointer';btn.addEventListener('click',()=>game.promoteGuildEarly?.());card.appendChild(btn)}
  btn.disabled=!status.eligible
  btn.style.opacity=status.eligible?'1':'.62'
  btn.textContent=status.eligible?`🏆 Subir cedo para Rank ${status.next.id} (${status.missingLevels} níveis antes) • +${status.bonusXp} XP +${status.bonusGold}◈`:`Rank ${status.next.id} antecipado: faltam ${status.missingGuildPoints} XP da Guilda • nível não bloqueia mais`
}

export function installPetEconomyGuildV3(game){
  if(!game||game.__petEconomyGuildV3Installed)return false
  game.__petEconomyGuildV3Installed=true
  installShopRules(game)
  installPetRules(game)
  installGuildRules(game)
  const timer=typeof window!=='undefined'?window.setInterval(()=>{
    if(window.game!==game){window.clearInterval(timer);return}
    patchPetPanelDom(game)
    patchMerchantDom(game)
    syncEarlyRankBadge(game)
  },250):null
  game.__petEconomyGuildV3Timer=timer
  return true
}

function installWhenReady(){
  if(typeof window==='undefined')return
  const install=()=>{if(!window.game)return false;window.setTimeout(()=>installPetEconomyGuildV3(window.game),420);return true}
  if(install())return
  const timer=window.setInterval(()=>{if(!install())return;window.clearInterval(timer)},100)
  window.setTimeout(()=>window.clearInterval(timer),60000)
}

installWhenReady()
