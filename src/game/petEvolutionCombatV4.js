// Pet Evolution / Combat V4
// Loaded after petEconomyGuildV3 so these companion rules take precedence.

import { petPowerProfile } from './requestedGameplayFixes.js'

const perfNow=()=>typeof performance!=='undefined'?performance.now():Date.now()
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v))

const EVOLUTION_RULES=[
  {re:/slime/i,titles:['Prismático','Real','Arcano','Imperial','Primordial'],colors:['#34d399','#22c55e','#14b8a6','#06b6d4','#67e8f9']},
  {re:/lobo|wolf|raposa|fox/i,titles:['Alfa','Lunar','Rúnico','Ancestral','Celestial'],colors:['#60a5fa','#818cf8','#8b5cf6','#a78bfa','#e0e7ff']},
  {re:/javali|bode|fera|boar|goat|beast/i,titles:['Feral','Couraçado','Ancestral','Colosso','Primordial'],colors:['#84cc16','#65a30d','#a3e635','#eab308','#fde047']},
  {re:/aranha|besouro|escorpi|spider|beetle|scorpion/i,titles:['Caçador','Venenoso','Rúnico','Abissal','Imperador'],colors:['#4ade80','#22c55e','#a855f7','#7e22ce','#d946ef']},
  {re:/corvo|gaivota|harpia|roc|bird|crow|harpy/i,titles:['Tempestuoso','Celeste','Rúnico','Soberano','Primordial'],colors:['#38bdf8','#0ea5e9','#818cf8','#c084fc','#f8fafc']},
  {re:/caranguejo|serpente|leviat|crab|serpent|maré/i,titles:['da Maré','Abissal','Leviatã','Soberano','Primordial'],colors:['#06b6d4','#0284c7','#2563eb','#4338ca','#a5f3fc']},
  {re:/golem|treant|pedra|xisto|cristal/i,titles:['Guardião','Rúnico','Colosso','Ancestral','Primordial'],colors:['#94a3b8','#64748b','#78716c','#a8a29e','#e7e5e4']},
  {re:/brasa|magm|rubro|fogo|fire|ember|lava/i,titles:['Ígneo','Magmático','Infernal','Rubro','Primordial'],colors:['#fb923c','#f97316','#ef4444','#dc2626','#fca5a5']},
  {re:/umbral|vazio|sombrio|arconte|void|shadow|mímico|mimic/i,titles:['Umbral','Abissal','Arconte','Eclipse','Primordial'],colors:['#8b5cf6','#7c3aed','#6d28d9','#4c1d95','#c4b5fd']},
  {re:/serafim|celeste|soberano|dragão|dragon|celestial|seraph/i,titles:['Radiante','Serafim','Astral','Soberano','Primordial'],colors:['#facc15','#fef08a','#c4b5fd','#e9d5ff','#ffffff']},
]

function petSpecies(pet){
  if(!pet)return'Companheiro'
  if(!pet.speciesName)pet.speciesName=String(pet.name||'Companheiro')
  return String(pet.speciesName||pet.name||'Companheiro')
}

function evolutionRule(pet){
  const species=petSpecies(pet)
  return EVOLUTION_RULES.find(rule=>rule.re.test(species))||{
    titles:['Desperto','Veterano','Arcano','Ascendido','Primordial'],
    colors:['#60a5fa','#38bdf8','#8b5cf6','#c084fc','#f8fafc']
  }
}

function evolutionTitleForStage(rule,stage){
  if(stage<=0)return'Forma Base'
  if(stage<=rule.titles.length)return rule.titles[stage-1]
  return `Ascensão ${stage}`
}

function refreshEvolutionFields(pet){
  if(!pet)return
  const level=Math.max(1,Math.round(Number(pet.level)||1))
  const stage=Math.floor(level/20)
  const rule=evolutionRule(pet)
  const species=petSpecies(pet)
  pet.evolutionStage=stage
  pet.evolutionTitle=evolutionTitleForStage(rule,stage)
  pet.evolutionName=stage>0?`${species} • ${pet.evolutionTitle}`:species
  pet.nextEvolutionLevel=(stage+1)*20
  pet.evolutionColor=rule.colors[Math.min(Math.max(0,stage-1),rule.colors.length-1)]||pet.color||'#60a5fa'
  const power=petPowerProfile(species)
  pet.specialName=power.name
  pet.specialType=power.type
  pet.specialUnlocked=level>=10
  pet.specialUnlockLevel=10
}

function applyEvolutionStages(game,pet,{silent=false}={}){
  if(!pet)return false
  refreshEvolutionFields(pet)
  const desired=Math.max(0,Number(pet.evolutionStage)||0)
  let applied=Math.max(0,Math.floor(Number(pet.evolutionStageApplied)||0))
  if(desired<=applied)return false
  const oldStage=applied
  while(applied<desired){
    applied+=1
    pet.maxHp=Math.max(1,Math.round((Number(pet.maxHp)||30)*1.18+applied*4))
    pet.damage=Math.max(1,Math.round((Number(pet.damage)||4)*1.16+applied*1.5))
  }
  pet.evolutionStageApplied=applied
  pet.hp=pet.maxHp
  refreshEvolutionFields(pet)
  if(!silent&&desired>oldStage){
    game.toast?.(`🌟 EVOLUÇÃO! ${pet.name} alcançou ${pet.evolutionTitle} • Evolução ${desired}!`)
    game.showCenterAnnouncement?.('🌟 EVOLUÇÃO DE PET',`${pet.name} evoluiu para ${pet.evolutionName}!`)
  }
  return true
}

function applyPetVisualEvolution(game,pet){
  const visual=game?.petVisual
  if(!visual||!pet)return
  refreshEvolutionFields(pet)
  const stage=Math.max(0,Number(pet.evolutionStage)||0)
  // Crescer apenas 2% a 5% por estágio de evolução (3.5% por evolução)
  const scale=1+Math.min(stage,10)*0.035
  visual.userData.baseScale=scale
  if(visual.userData?.petEvolutionStage===stage&&visual.userData?.petEvolutionId===pet.id){
    if(!visual.userData?.pulseTimer)visual.scale.setScalar(scale)
    return
  }
  visual.userData.petEvolutionStage=stage
  visual.userData.petEvolutionId=pet.id
  if(!visual.userData?.pulseTimer)visual.scale.setScalar(scale)
  if(stage>0){
    const body=visual.children?.find?.(child=>child?.material?.color)
    if(body?.material?.color){
      body.material.color.set(pet.evolutionColor||'#60a5fa')
      body.material.emissive?.set?.(pet.evolutionColor||'#60a5fa')
      if('emissiveIntensity'in body.material)body.material.emissiveIntensity=.42+Math.min(.38,stage*.05)
    }
  }
}

function save(game){
  game?.saveGame?.()
  game?.saveCloudGame?.()
}

function levelPetFromXp(game,pet){
  if(!pet)return false
  pet.level=Math.max(1,Math.round(Number(pet.level)||1))
  pet.xp=Math.max(0,Number(pet.xp)||0)
  pet.nextXp=Math.max(30,Math.round(Number(pet.nextXp)||pet.level*85))
  let leveled=false
  while(pet.xp>=pet.nextXp){
    pet.xp-=pet.nextXp
    pet.level+=1
    pet.nextXp=Math.max(35,Math.round(pet.nextXp*1.24))
    pet.maxHp=Math.max(1,Number(pet.maxHp)||30)+Math.max(10,Math.round(pet.level*1.9))
    pet.hp=pet.maxHp
    pet.damage=Math.max(1,Number(pet.damage)||4)+Math.max(2,Math.round(pet.level*.3))
    leveled=true
    if(pet.level===10){
      refreshEvolutionFields(pet)
      game.toast?.(`✨ ${pet.name} chegou ao Nv.10 e liberou ${pet.specialName}!`)
      game.showCenterAnnouncement?.('✨ PODER ESPECIAL LIBERADO',`${pet.name}: ${pet.specialName}`)
    }
    if(pet.level%20===0)applyEvolutionStages(game,pet,{silent:false})
    else refreshEvolutionFields(pet)
  }
  if(leveled)game.toast?.(`🐾 ${pet.name} agora é Nv.${pet.level}!`)
  return leveled
}

function grantPetXp(game,pet,target,{kill=false}={}){
  if(!pet||!target)return 0
  const targetLevel=Math.max(1,Number(target.level)||1)
  const petLevel=Math.max(1,Number(pet.level)||1)
  // Roughly 4x the old per-hit gain, plus a meaningful finishing bonus.
  const gain=Math.max(kill?30:15,Math.round(targetLevel*(kill?8:3.6)+petLevel*(kill?.8:.25)))
  pet.xp=Math.max(0,Number(pet.xp)||0)+gain
  levelPetFromXp(game,pet)
  return gain
}

function directDamage(game,target,amount){
  if(!target||target.dead||!Number.isFinite(Number(target.hp)))return 0
  const before=Number(target.hp)
  game.damageEnemy?.(target,Math.max(1,Math.round(amount)),{knockback:.12,fromPet:true})
  let after=Number(target.hp)
  if(after<before)return before-after
  const def=Math.max(0,Number(target.def)||0)
  const dealt=Math.max(1,Math.round(Math.max(1,amount)*100/(100+def*.7)))
  target.hp=Math.max(0,before-dealt)
  after=target.hp
  if(game.state)game.state.target={name:target.name,level:target.level,hp:after,maxHp:target.maxHp,boss:target.boss,crit:false}
  game.spawnDamageText?.(target.g?.position,dealt,false)
  game.flashEnemy?.(target,false)
  if(after<=0){target.hp=0;game.kill?.(target)}
  return dealt
}

function recentAttacker(game){
  if(!game?.player?.position)return null
  const now=perfNow()
  const candidates=(game.enemies||[]).filter(e=>e&&!e.dead&&e.g?.position&&e.g.visible!==false&&e.g.position.distanceTo(game.player.position)<=32)
  if(!candidates.length)return null
  candidates.sort((a,b)=>{
    const ar=now-(Number(a.last)||0),br=now-(Number(b.last)||0)
    const aRecent=ar>=0&&ar<900?0:1,bRecent=br>=0&&br<900?0:1
    if(aRecent!==bRecent)return aRecent-bRecent
    return a.g.position.distanceTo(game.player.position)-b.g.position.distanceTo(game.player.position)
  })
  return candidates[0]||null
}

function commandPetDefense(game){
  const pet=game?.activePet?.()
  if(!pet||Number(pet.recoverUntil)>Date.now())return false
  const attacker=recentAttacker(game)
  if(!attacker)return false
  game.petTarget=attacker
  pet.inCombat=true
  pet.combatUntil=Date.now()+7000
  game.petAttackTarget?.(attacker)
  if(!game.__petDefenseToastAt||Date.now()-game.__petDefenseToastAt>2800){
    game.__petDefenseToastAt=Date.now()
    game.toast?.(`🛡️ ${pet.name} entrou em defesa e foi atrás de ${attacker.name}!`)
  }
  return true
}

function installAutoDefense(game){
  const oldDamagePlayer=game.damagePlayer?.bind(game)
  if(!oldDamagePlayer||game.__petV4DamageWrapped)return
  game.__petV4DamageWrapped=true
  game.damagePlayer=(amount,...rest)=>{
    const before=Number(game.state?.hp)||0
    const dealt=oldDamagePlayer(amount,...rest)
    const after=Number(game.state?.hp)||0
    if(after<before&&Number(dealt)>0)commandPetDefense(game)
    return dealt
  }
}

function installDeletePet(game){
  game.deletePet=petId=>{
    const pets=game.state?.pets?.owned||[]
    const index=pets.findIndex(p=>p.id===petId)
    if(index<0)return false
    const [removed]=pets.splice(index,1)
    if(game.state.pets.activeId===petId){
      game.state.pets.activeId=pets[0]?.id||null
      game.petTarget=null
      if(game.petVisual){game.petVisual.parent?.remove(game.petVisual);game.petVisual=null}
      if(game.petNameplate){game.petNameplate.parent?.remove(game.petNameplate);game.petNameplate=null}
      game.petVisualKey=''
      game.syncPetVisual?.()
    }
    save(game)
    game.toast?.(`🗑️ ${removed?.name||'Pet'} foi removido dos seus companheiros.`)
    return true
  }
}

function patchPetPanelDom(game){
  if(typeof document==='undefined'||game.state?.uiPanel!=='pets')return
  const pets=game.state?.pets?.owned||[]
  const cards=[...document.querySelectorAll('.stable-catalog-section .horse-card')]
  cards.forEach((card,index)=>{
    const pet=pets[index]
    if(!pet)return
    refreshEvolutionFields(pet)
    card.dataset.petId=pet.id

    let evo=card.querySelector('.pet-v4-evolution')
    if(!evo){
      evo=document.createElement('div')
      evo.className='pet-v4-evolution'
      evo.style.cssText='margin-top:8px;padding:8px 9px;border:1px solid rgba(168,85,247,.45);background:rgba(88,28,135,.15);border-radius:9px;font-size:12px;line-height:1.45;color:#e9d5ff'
      const p=card.querySelector('p')
      p?.insertAdjacentElement('afterend',evo)
    }
    const stage=Math.max(0,Number(pet.evolutionStage)||0)
    evo.innerHTML=`<b>🌟 ${pet.evolutionName}</b><br>XP ${Math.floor(Number(pet.xp)||0)}/${Math.max(1,Math.floor(Number(pet.nextXp)||1))} • Evolução ${stage}${stage<99?` • próxima Nv.${pet.nextEvolutionLevel}`:''}<br>${pet.specialUnlocked?`✨ <b>${pet.specialName}</b> liberado`:'🔒 Poder especial libera no Nv.10'}`

    let del=card.querySelector('.pet-v4-delete')
    if(!del){
      del=document.createElement('button')
      del.type='button'
      del.className='pet-v4-delete'
      del.textContent='🗑️ Excluir pet'
      del.style.cssText='margin-top:7px;margin-left:6px;border:1px solid #ef4444;background:rgba(239,68,68,.13);color:#fecaca;border-radius:8px;padding:7px 9px;font-weight:900;cursor:pointer'
      del.addEventListener('click',()=>{
        const id=card.dataset.petId
        const current=(game.state?.pets?.owned||[]).find(p=>p.id===id)
        if(!current)return
        if(!window.confirm(`Excluir ${current.name}? Esta ação remove o pet da sua coleção.`))return
        game.deletePet?.(id)
      })
      card.appendChild(del)
    }
  })
}

function installCombatAndProgression(game){
  const oldUpdate=game.updatePets?.bind(game)
  if(!oldUpdate||game.__petV4UpdateWrapped)return
  game.__petV4UpdateWrapped=true

  game.updatePets=dt=>{
    const petBefore=game.activePet?.()
    if(petBefore){
      refreshEvolutionFields(petBefore)
    }
    const targetBefore=game.petTarget
    const hpBefore=Number(targetBefore?.hp)
    const xpBefore=Number(petBefore?.xp)||0
    const levelBefore=Number(petBefore?.level)||1

    oldUpdate(dt)

    const pet=game.activePet?.()
    if(!pet)return
    refreshEvolutionFields(pet)
    applyEvolutionStages(game,pet,{silent:true})
    applyPetVisualEvolution(game,pet)

    const target=game.petTarget||((targetBefore&&!targetBefore.dead&&Number(targetBefore.hp)>0)?targetBefore:null)
    const visual=game.petVisual
    const targetRadius=Number(target?.radius)||1.1
    const attackRange=Math.max(2.8,targetRadius+1.5)
    const inRange=!!(target&&visual&&target.g?.position&&target.g.position.distanceTo(visual.position)<=attackRange)
    const now=perfNow()
    if((Number(pet.v4NextAttackAt)||0)>now+3000)pet.v4NextAttackAt=0
    if((Number(pet.v4NextSpecialAt)||0)>now+12000)pet.v4NextSpecialAt=0
    let hpAfter=Number(target?.hp)
    let causedDamage=!!(targetBefore&&Number.isFinite(hpBefore)&&Number(targetBefore.hp)<hpBefore)

    // Safety net: if a commanded pet reaches melee range, apply companion hit
    if(target&&!target.dead&&Number(target.hp)>0&&inRange&&!causedDamage&&now>=(Number(pet.v4NextAttackAt)||0)){
      pet.v4NextAttackAt=now+900
      const dealt=directDamage(game,target,(Number(pet.damage)||4)*(1+Math.min(.4,(Number(pet.evolutionStage)||0)*.04)))
      causedDamage=dealt>0
      hpAfter=Number(target.hp)
    }

    if(causedDamage&&targetBefore){
      const already=Math.max(0,(Number(pet.xp)||0)-xpBefore)
      const desired=Math.max(15,Math.round((Number(targetBefore.level)||1)*3.6+(Number(pet.level)||1)*.25))
      if(already<desired){
        pet.xp+=(desired-already)
        levelPetFromXp(game,pet)
      }
      if(Number.isFinite(hpBefore)&&hpBefore>0&&Number(targetBefore.hp)<=0)grantPetXp(game,pet,targetBefore,{kill:true})
    }

    // Special skill is a real unlock at level 10 and scales with each 20-level evolution.
    if(pet.specialUnlocked&&target&&!target.dead&&Number(target.hp)>0&&inRange&&now>=(Number(pet.v4NextSpecialAt)||0)){
      pet.v4NextSpecialAt=now+5200
      const profile=petPowerProfile(petSpecies(pet))
      const stage=Math.max(0,Number(pet.evolutionStage)||0)
      const specialRaw=(Number(pet.damage)||4)*profile.multiplier*(1+stage*.08)
      const center=target.g?.position
      const targets=profile.radius>2.5&&center
        ?(game.enemies||[]).filter(e=>e&&!e.dead&&e.g?.position&&e.g.position.distanceTo(center)<=profile.radius)
        :[target]
      let hitAny=false
      for(const enemy of targets.length?targets:[target]){
        const dealt=directDamage(game,enemy,specialRaw)
        if(dealt>0)hitAny=true
      }
      if(hitAny){
        grantPetXp(game,pet,target,{kill:target.dead||Number(target.hp)<=0})
        game.spawnAbilityRing?.(profile.color,profile.radius,.4)
        game.toast?.(`✨ ${pet.name} usou ${profile.name}!`)
      }
    }

    // Strong, integer-safe regeneration out of combat.
    if(!game.petTarget&&!pet.inCombat&&Number(pet.recoverUntil)<=Date.now()&&pet.hp>0&&pet.hp<pet.maxHp){
      pet.v4RegenCarry=(Number(pet.v4RegenCarry)||0)+pet.maxHp*.12*Math.max(0,Number(dt)||0)
      if(pet.v4RegenCarry>=1){
        const heal=Math.floor(pet.v4RegenCarry)
        pet.v4RegenCarry-=heal
        pet.hp=Math.min(pet.maxHp,pet.hp+heal)
      }
    }else if(game.petTarget||pet.inCombat){
      pet.v4RegenCarry=0
    }

    if((Number(pet.level)||1)!==levelBefore||Number(pet.xp)!==xpBefore)save(game)
  }
}

export function installPetEvolutionCombatV4(game){
  if(!game||game.__petEvolutionCombatV4Installed)return false
  game.__petEvolutionCombatV4Installed=true

  for(const pet of game.state?.pets?.owned||[]){
    refreshEvolutionFields(pet)
    applyEvolutionStages(game,pet,{silent:true})
  }
  installDeletePet(game)
  installAutoDefense(game)
  installCombatAndProgression(game)

  const oldSync=game.syncPetVisual?.bind(game)
  if(oldSync&&!game.__petV4SyncWrapped){
    game.__petV4SyncWrapped=true
    game.syncPetVisual=(...args)=>{
      const result=oldSync(...args)
      const pet=game.activePet?.()
      if(pet)applyPetVisualEvolution(game,pet)
      return result
    }
  }

  game.__petV4PanelTimer=window.setInterval(()=>patchPetPanelDom(game),280)
  save(game)
  return true
}

function installWhenReady(){
  if(typeof window==='undefined')return
  const attempt=()=>{
    if(!window.game)return false
    window.setTimeout(()=>installPetEvolutionCombatV4(window.game),720)
    return true
  }
  if(attempt())return
  const timer=window.setInterval(()=>{if(!attempt())return;window.clearInterval(timer)},100)
  window.setTimeout(()=>window.clearInterval(timer),60000)
}

installWhenReady()
