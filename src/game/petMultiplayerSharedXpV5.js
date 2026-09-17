// Pet Multiplayer + Shared XP V5
// Loaded after petEvolutionCombatV4. Adds remote pet visibility and shared combat XP.

import * as THREE from 'three'
import { calculateKillXP } from './rpgSystems.js'

const now=()=>Date.now()
const perfNow=()=>typeof performance!=='undefined'?performance.now():Date.now()
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v))

function activePet(game){return game?.activePet?.()||null}

function petSpecies(pet){return String(pet?.speciesName||pet?.name||'Companheiro')}

function petEvolutionStage(pet){return Math.max(0,Math.floor(Number(pet?.evolutionStage)||Math.floor((Number(pet?.level)||1)/20)))}

function safePetState(game){
  const pet=activePet(game)
  const recovering=!!pet&&Number(pet.recoverUntil)>now()
  const visual=game?.petVisual
  if(!pet||recovering||!visual){
    return {active:false,petId:pet?.id||null,recovering,world:game?.currentWorldId?.()||'open'}
  }
  const p=new THREE.Vector3()
  visual.getWorldPosition(p)
  return{
    active:true,
    petId:String(pet.id||''),
    name:String(pet.name||'Companheiro').slice(0,24),
    species:String(petSpecies(pet)).slice(0,36),
    level:clamp(Math.round(Number(pet.level)||1),1,999),
    hp:Math.max(0,Math.round(Number(pet.hp)||0)),
    maxHp:Math.max(1,Math.round(Number(pet.maxHp)||1)),
    evolutionStage:petEvolutionStage(pet),
    evolutionTitle:String(pet.evolutionTitle||'Forma Base').slice(0,28),
    color:String(pet.evolutionColor||pet.color||'#60a5fa').slice(0,16),
    inCombat:!!pet.inCombat,
    x:p.x,y:p.y,z:p.z,
    r:Number(visual.rotation?.y)||0,
    world:game?.currentWorldId?.()||'open'
  }
}

function makeLabel(){
  if(typeof document==='undefined')return null
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=72
  const texture=new THREE.CanvasTexture(canvas);texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:true,depthWrite:false,toneMapped:false}))
  sprite.position.set(0,0.95,0);sprite.scale.set(1.35,0.38,1);sprite.renderOrder=80
  sprite.userData.canvas=canvas;sprite.userData.texture=texture;sprite.userData.signature=''
  return sprite
}

function drawLabel(sprite,state){
  if(!sprite||!state)return
  const sig=`${state.name}|${state.level}|${state.hp}|${state.maxHp}|${state.evolutionStage}|${state.inCombat}`
  if(sprite.userData.signature===sig)return
  sprite.userData.signature=sig
  const canvas=sprite.userData.canvas,ctx=canvas?.getContext?.('2d'),texture=sprite.userData.texture
  if(!ctx||!texture)return
  const hpPct=clamp((Number(state.hp)||0)/Math.max(1,Number(state.maxHp)||1),0,1)
  ctx.clearRect(0,0,canvas.width,canvas.height)
  ctx.fillStyle='rgba(4,10,18,.9)';ctx.fillRect(10,8,400,92)
  ctx.strokeStyle=state.inCombat?'#ef4444':'#60a5fa';ctx.lineWidth=4;ctx.strokeRect(10,8,400,92)
  ctx.textAlign='center';ctx.fillStyle='#fff';ctx.font='900 22px Inter,Arial'
  ctx.fillText(`🐾 ${state.name} • Nv.${state.level}`,210,34)
  ctx.font='800 13px Inter,Arial';ctx.fillStyle='#dbeafe'
  ctx.fillText(`Evolução ${state.evolutionStage||0}${state.inCombat?' • ⚔ combate':''}`,210,54)
  ctx.fillStyle='#172033';ctx.fillRect(34,66,352,16)
  ctx.fillStyle=hpPct>.55?'#22c55e':hpPct>.25?'#f59e0b':'#ef4444';ctx.fillRect(34,66,352*hpPct,16)
  ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=1;ctx.strokeRect(34,66,352,16)
  ctx.font='700 12px Inter,Arial';ctx.fillStyle='#f8fafc';ctx.fillText(`HP ${state.hp}/${state.maxHp}`,210,96)
  texture.needsUpdate=true
}

function makeRemotePet(state){
  const g=new THREE.Group();g.name='RemotePetV5'
  const color=new THREE.Color(state.color||'#60a5fa')
  const bodyMat=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.34,roughness:.55})
  const body=new THREE.Mesh(new THREE.DodecahedronGeometry(.42,0),bodyMat);body.castShadow=true;body.receiveShadow=true
  const earMat=new THREE.MeshStandardMaterial({color:color.clone().multiplyScalar(.78),roughness:.6})
  const ear=new THREE.Mesh(new THREE.ConeGeometry(.16,.38,5),earMat);ear.position.set(0,.5,0);ear.castShadow=true
  g.add(body,ear)
  const label=makeLabel();if(label)g.add(label)
  g.userData.body=body;g.userData.label=label;g.userData.petId=state.petId||''
  applyRemotePetAppearance(g,state)
  return g
}

function applyRemotePetAppearance(g,state){
  if(!g||!state)return
  const stage=Math.max(0,Number(state.evolutionStage)||0)
  const scale=1+Math.min(stage,8)*.065
  g.scale.setScalar(scale)
  const color=new THREE.Color(state.color||'#60a5fa')
  const mat=g.userData?.body?.material
  if(mat?.color){mat.color.copy(color);mat.emissive?.copy?.(color);mat.emissiveIntensity=.34+Math.min(.36,stage*.045)}
  drawLabel(g.userData?.label,state)
}

function disposeRemotePet(game,ownerId){
  const g=game?.__remotePetVisualsV5?.get(ownerId)
  if(!g)return
  g.parent?.remove(g)
  g.traverse?.(o=>{o.geometry?.dispose?.();o.material?.map?.dispose?.();o.material?.dispose?.()})
  game.__remotePetVisualsV5.delete(ownerId)
}

function clearRemotePets(game){
  for(const id of [...(game?.__remotePetVisualsV5?.keys?.()||[])])disposeRemotePet(game,id)
  game?.__remotePetStatesV5?.clear?.()
}

function receiveRemotePetState(game,event){
  const ownerId=String(event?.from||event?.ownerId||'')
  if(!ownerId||ownerId===game?.multiplayer?.id)return true
  if(!game.__remotePetStatesV5)game.__remotePetStatesV5=new Map()
  const pet=event?.pet||{}
  game.__remotePetStatesV5.set(ownerId,{...pet,world:event.world||pet.world||'open',receivedAt:now()})
  if(!pet.active)disposeRemotePet(game,ownerId)
  return true
}

function updateRemotePets(game,dt){
  if(!game?.scene)return
  const states=game.__remotePetStatesV5||new Map()
  if(!game.__remotePetVisualsV5)game.__remotePetVisualsV5=new Map()
  const world=game.currentWorldId?.()||'open'
  const stamp=now()
  for(const [ownerId,state] of states){
    if(!state?.active||stamp-(Number(state.receivedAt)||0)>6000){disposeRemotePet(game,ownerId);continue}
    const owner=game.remotePlayers?.get?.(ownerId)
    if(!owner){continue}
    let g=game.__remotePetVisualsV5.get(ownerId)
    if(!g||g.userData?.petId!==state.petId){
      if(g)disposeRemotePet(game,ownerId)
      g=makeRemotePet(state);game.scene.add(g);game.__remotePetVisualsV5.set(ownerId,g)
      g.position.set(Number(state.x)||owner.g?.position?.x||0,Number(state.y)||.55,Number(state.z)||owner.g?.position?.z||0)
    }
    const visible=owner.g?.visible!==false&&String(state.world||'open')===world
    g.visible=visible
    if(!visible)continue
    applyRemotePetAppearance(g,state)
    const target=new THREE.Vector3(Number(state.x)||0,Number(state.y)||.55,Number(state.z)||0)
    const d=g.position.distanceTo(target)
    if(d>18)g.position.copy(target)
    else g.position.lerp(target,1-Math.exp(-Math.max(0,Number(dt)||0)*12))
    g.rotation.y=Number(state.r)||0
  }
}

function broadcastLocalPet(game){
  const mp=game?.multiplayer
  if(!mp?.connected||mp.transport!=='supabase'||typeof mp._broadcast!=='function')return
  const t=perfNow(),interval=(typeof document!=='undefined'&&document.hidden)?900:170
  if(t-(game.__petV5LastBroadcast||0)<interval)return
  game.__petV5LastBroadcast=t
  const pet=safePetState(game)
  mp._broadcast('game',{type:'pet_state_wire',from:mp.id||mp.playerId,ownerId:mp.id||mp.playerId,world:pet.world,pet})
}

function markCombatContribution(target,fromPet,petId=null){
  if(!target||target.dead)return
  const t=now()
  const mark=target.__petSharedXpV5||(target.__petSharedXpV5={playerAt:0,petAt:0,petId:null,awarded:false})
  if(fromPet){mark.petAt=t;mark.petId=petId||mark.petId}
  else mark.playerAt=t
}

function levelPetFromSharedXp(game,pet){
  if(!pet)return false
  pet.level=Math.max(1,Math.round(Number(pet.level)||1))
  pet.xp=Math.max(0,Number(pet.xp)||0)
  pet.nextXp=Math.max(35,Math.round(Number(pet.nextXp)||pet.level*85))
  let leveled=false
  while(pet.xp>=pet.nextXp){
    pet.xp-=pet.nextXp
    pet.level+=1
    pet.nextXp=Math.max(35,Math.round(pet.nextXp*1.24))
    pet.maxHp=Math.max(1,Number(pet.maxHp)||30)+Math.max(10,Math.round(pet.level*1.9))
    pet.hp=pet.maxHp
    pet.damage=Math.max(1,Number(pet.damage)||4)+Math.max(2,Math.round(pet.level*.3))
    leveled=true
    if(pet.level===10)game.showCenterAnnouncement?.('✨ PODER DO PET LIBERADO',`${pet.name} chegou ao Nv.10!`)
    if(pet.level%20===0)game.showCenterAnnouncement?.('🌟 EVOLUÇÃO DE PET',`${pet.name} alcançou o Nv.${pet.level}!`)
  }
  if(leveled)game.toast?.(`🐾 ${pet.name} agora é Nv.${pet.level}!`)
  return leveled
}

function calculateSharedKillXp(game,target){
  const playerLevel=Math.max(1,Number(game?.state?.level)||1)
  const mobLevel=Math.max(1,Number(target?.level)||1)
  const fixed=Number.isFinite(Number(target?.fixedXP))?Number(target.fixedXP):Number.isFinite(Number(target?.xpReward))?Number(target.xpReward):null
  try{
    return calculateKillXP(playerLevel,mobLevel,{boss:!!target?.boss,fixedXP:fixed,disableLevelScaling:!!target?.disableLevelScaling,rate:1,zoneRate:1})
  }catch{
    return Math.max(20,Math.round(mobLevel*Math.sqrt(mobLevel)*2.35+24)*(target?.boss?3:1))
  }
}

function awardSharedXpIfEligible(game,target){
  const mark=target?.__petSharedXpV5
  if(!mark||mark.awarded)return 0
  const t=now()
  const both=mark.playerAt>0&&mark.petAt>0&&t-mark.playerAt<=15000&&t-mark.petAt<=15000
  if(!both)return 0
  const pet=activePet(game)
  if(!pet||Number(pet.recoverUntil)>t||mark.petId&&pet.id!==mark.petId)return 0
  mark.awarded=true
  const shared=Math.max(20,Math.round(calculateSharedKillXp(game,target)))
  pet.xp=Math.max(0,Number(pet.xp)||0)+shared
  levelPetFromSharedXp(game,pet)
  game.toast?.(`🤝 XP compartilhado! Você e ${pet.name} participaram da luta • Pet +${shared} XP`)
  game.saveGame?.();game.saveCloudGame?.()
  return shared
}

function installSharedXp(game){
  if(game.__petSharedXpV5Installed)return
  game.__petSharedXpV5Installed=true
  const oldDamage=game.damageEnemy?.bind(game)
  if(oldDamage){
    game.damageEnemy=(target,amount,opts={})=>{
      const fromPet=!!opts?.fromPet
      markCombatContribution(target,fromPet,fromPet?activePet(game)?.id:null)
      const result=oldDamage(target,amount,opts)
      if(target&&(target.dead||Number(target.hp)<=0))awardSharedXpIfEligible(game,target)
      return result
    }
  }
  const oldKill=game.kill?.bind(game)
  if(oldKill){
    game.kill=(target,...rest)=>{
      awardSharedXpIfEligible(game,target)
      return oldKill(target,...rest)
    }
  }
}

function installRemotePetMultiplayer(game){
  if(game.__petRemoteMultiplayerV5Installed)return
  game.__petRemoteMultiplayerV5Installed=true
  game.__remotePetStatesV5=new Map();game.__remotePetVisualsV5=new Map()

  const oldEvent=game.onMultiplayerEvent?.bind(game)
  if(oldEvent){
    game.onMultiplayerEvent=event=>{
      if(event?.type==='pet_state_wire')return receiveRemotePetState(game,event)
      const result=oldEvent(event)
      if(event?.type==='leave'){
        game.__remotePetStatesV5.delete(event.id);disposeRemotePet(game,event.id)
      }
      if(event?.type==='connection'&&!event.connected&&!event.reconnecting)clearRemotePets(game)
      return result
    }
  }

  const oldUpdate=game.updateMultiplayer?.bind(game)
  if(oldUpdate){
    game.updateMultiplayer=dt=>{
      const result=oldUpdate(dt)
      broadcastLocalPet(game)
      updateRemotePets(game,dt)
      return result
    }
  }
}

export function installPetMultiplayerSharedXpV5(game){
  if(!game||game.__petMultiplayerSharedXpV5Installed)return false
  game.__petMultiplayerSharedXpV5Installed=true
  installSharedXp(game)
  installRemotePetMultiplayer(game)
  return true
}

function installWhenReady(){
  if(typeof window==='undefined')return
  const attempt=()=>{
    if(!window.game)return false
    window.setTimeout(()=>installPetMultiplayerSharedXpV5(window.game),920)
    return true
  }
  if(attempt())return
  const timer=window.setInterval(()=>{if(!attempt())return;window.clearInterval(timer)},100)
  window.setTimeout(()=>window.clearInterval(timer),60000)
}

installWhenReady()
