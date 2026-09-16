import * as THREE from 'three'
import { ShadowGame } from './engine.js'
import { clamp, damp } from './utils.js'

const PATCH_FLAG = Symbol.for('shadow-ascension.mobile-gameplay-v095')

const rarityTierOf = (item) => Number.isFinite(Number(item?.rarityTier)) ? Number(item.rarityTier) : ({'Comum':0,'Incomum':1,'Rara':2,'Épica':3,'Lendária':4,'Mítica':5}[item?.rarity] ?? 0)

function ensureDurability(item){
  if(!item) return item
  const durable = item.type==='weapon'||item.type==='tool'||item.type==='armor'||item.type==='boots'
  if(!durable) return item
  const base=item.type==='armor'?180:item.type==='boots'?145:item.type==='tool'?110:125
  const max=Math.max(40,Math.round(Number(item.maxDurability)||base+(Number(item.level)||1)*2.25+rarityTierOf(item)*28))
  item.maxDurability=max
  if(!Number.isFinite(Number(item.durability))) item.durability=max
  item.durability=clamp(Math.round(Number(item.durability)||0),0,max)
  item.broken=item.durability<=0
  return item
}

function isStackable(item){
  if(!item) return false
  if(item.type==='material'||item.type==='resource'||item.type==='consumable') return true
  return ['monster-drop','fish','wood','coal','iron','potion','grimoire'].includes(item.subtype)
}

function sameStack(a,b){
  return !!a&&!!b&&a.name===b.name&&a.type===b.type&&(a.subtype||'')===(b.subtype||'')&&(a.rarity||'')===(b.rarity||'')
}

function powerColor(name='',boss=false){
  if(boss)return 0xef4444
  const n=String(name).toLowerCase()
  if(n.includes('slime'))return 0x22c55e
  if(n.includes('golem')||n.includes('gigante')||n.includes('bruto')||n.includes('colosso')||n.includes('xisto'))return 0xf59e0b
  if(n.includes('esqueleto')||n.includes('espectro')||n.includes('fantasma')||n.includes('umbral')||n.includes('cavaleiro'))return 0xa855f7
  if(n.includes('dragão')||n.includes('dragao'))return 0x38bdf8
  return 0x60a5fa
}

if(!ShadowGame.prototype[PATCH_FLAG]){
  const proto=ShadowGame.prototype
  Object.defineProperty(proto,PATCH_FLAG,{value:true})

  proto.ensureItemDurability=ensureDurability
  proto.degradeEquipment=function(slot='weapon',amount=1,reason='uso'){
    const item=this.state?.equipment?.[slot]
    if(!item)return false
    ensureDurability(item)
    if(!item.maxDurability)return false
    const before=item.durability
    item.durability=Math.max(0,before-Math.max(1,Math.round(amount||1)))
    item.broken=item.durability<=0
    if(before>0&&item.durability<=0){
      this.toast?.(`⚠️ ${item.name} quebrou. Repare no ferreiro.`)
      this.haptic?.(35)
      this.recalcStats?.()
    }
    return true
  }
  proto.repairItem=function(slot='weapon'){
    const item=this.state?.equipment?.[slot]
    if(!item)return false
    ensureDurability(item)
    const missing=Math.max(0,item.maxDurability-item.durability)
    if(!missing){this.toast?.(`${item.name} já está com durabilidade máxima.`);return false}
    const cost=Math.max(8,Math.round(missing*(.22+(Number(item.level)||1)*.012+rarityTierOf(item)*.09)))
    if((this.state.gold||0)<cost){this.toast?.(`Faltam ${cost-(this.state.gold||0)}◈ para reparar.`);return false}
    this.state.gold-=cost;item.durability=item.maxDurability;item.broken=false
    this.recalcStats?.();this.saveGame?.();this.toast?.(`🔧 ${item.name} reparado por ${cost}◈.`);this.haptic?.(15)
    return true
  }
  proto.repairCost=function(item){
    if(!item)return 0;ensureDurability(item)
    const missing=Math.max(0,item.maxDurability-item.durability)
    return Math.max(0,Math.round(missing*(.22+(Number(item.level)||1)*.012+rarityTierOf(item)*.09)))
  }

  const prevAdd=proto.addInventoryItem
  proto.addInventoryItem=function v095AddInventoryItem(item){
    if(!item)return false
    ensureDurability(item)
    if(isStackable(item)){
      const found=(this.state.inventory||[]).find(x=>sameStack(x,item))
      if(found){found.qty=(found.qty||1)+(item.qty||1);return true}
      item.qty=Math.max(1,item.qty||1)
    }
    return prevAdd.call(this,item)
  }

  const prevEquip=proto.equipItem
  proto.equipItem=function v095EquipItem(id){
    const item=this.state?.inventory?.find(x=>x.id===id);ensureDurability(item)
    return prevEquip.call(this,id)
  }

  const prevRecalc=proto.recalcStats
  proto.recalcStats=function v095RecalcStats(...args){
    for(const it of Object.values(this.state?.equipment||{}))ensureDurability(it)
    const out=prevRecalc.apply(this,args)
    const w=this.state?.equipment?.weapon,a=this.state?.equipment?.armor
    if(w?.broken&&w?.stats?.attack)this.state.atk=Math.max(1,Math.round(this.state.atk-Math.max(1,w.stats.attack*.78)))
    if(a?.broken&&a?.stats?.defense)this.state.def=Math.max(0,Math.round(this.state.def-Math.max(1,a.stats.defense*.85)))
    return out
  }

  const prevDamageResource=proto.damageResourceNode
  proto.damageResourceNode=function v095DamageResource(node,amount,opts={}){
    if(!node||node.hp<=0)return false
    const tool=this.state?.equipment?.weapon
    ensureDurability(tool)
    const isAxe=tool?.subtype==='axe'
    const isPickaxe=tool?.subtype==='pickaxe'
    const tree=node.type==='tree'
    const ore=String(node.type||'').startsWith('ore')
    const now=performance.now()
    if(tree&&!isAxe){if(now-(this._v095ToolToast||0)>900){this._v095ToolToast=now;this.toast?.('🪓 Equipe um machado para cortar madeira.');this.haptic?.(8)}this._v095ResourceHit=true;return false}
    if(ore&&!isPickaxe){if(now-(this._v095ToolToast||0)>900){this._v095ToolToast=now;this.toast?.('⛏️ Equipe uma picareta para quebrar minério.');this.haptic?.(8)}this._v095ResourceHit=true;return false}
    if(tool?.broken){if(now-(this._v095ToolToast||0)>900){this._v095ToolToast=now;this.toast?.(`🔧 ${tool.name} está quebrado. Repare no ferreiro.`)}this._v095ResourceHit=true;return false}
    this._v095ResourceHit=true
    const boosted=Math.max(1,Math.round(amount*(tree?1.28:ore?1.34:1)))
    const result=prevDamageResource.call(this,node,boosted,{...opts,isAxe,isPickaxe})
    this.degradeEquipment('weapon',1,'coleta')
    return result
  }

  const prevDamageEnemy=proto.damageEnemy
  proto.damageEnemy=function v095DamageEnemy(enemy,amount,opts={}){
    let adjusted=amount
    if(this._v095BasicAttackActive){
      const subtype=this.state?.equipment?.weapon?.subtype||'unarmed'
      const mult=subtype==='axe'?1.18:subtype==='pickaxe'?1.08:subtype==='sword'?0.92:subtype==='dagger'?0.88:1
      adjusted=Math.max(1,Math.round((Number(amount)||0)*mult))
    }
    return prevDamageEnemy.call(this,enemy,adjusted,opts)
  }

  const prevAttack=proto.attack
  proto.attack=function v095Attack(force=false){
    const weapon=this.state?.equipment?.weapon;ensureDurability(weapon)
    if(weapon?.broken){const now=performance.now();if(now-(this._v095BrokenToast||0)>1000){this._v095BrokenToast=now;this.toast?.(`🔧 ${weapon.name} está quebrado. Repare no ferreiro.`)}return false}
    const before=this.attackClock||0;this._v095ResourceHit=false;this._v095BasicAttackActive=true
    let out
    try{out=prevAttack.call(this,force)}finally{this._v095BasicAttackActive=false}
    if((this.attackClock||0)>before){
      if(!this._v095ResourceHit&&weapon?.maxDurability)this.degradeEquipment('weapon',1,'ataque')
    }
    return out
  }

  const prevUpdatePlayer=proto.updatePlayer
  proto.updatePlayer=function v095UpdatePlayer(dt,t){
    const beforeX=this.player?.position?.x||0,beforeZ=this.player?.position?.z||0
    const result=prevUpdatePlayer.apply(this,arguments)
    // Boots wear slowly while travelling so every durable equipment slot has
    // meaningful use. The cadence is intentionally low to avoid micromanagement.
    const boots=this.state?.equipment?.boots
    if(boots){
      ensureDurability(boots)
      const dx=(this.player?.position?.x||0)-beforeX,dz=(this.player?.position?.z||0)-beforeZ
      this._v095BootTravel=(this._v095BootTravel||0)+Math.hypot(dx,dz)
      if(this._v095BootTravel>=95){
        this._v095BootTravel%=95
        this.degradeEquipment('boots',1,'movimento')
      }
    }
    return result
  }

  const prevDash=proto.dash
  proto.dash=function v095Dash(...args){
    const before=this.dashTime||0
    const out=prevDash.apply(this,args)
    if((this.dashTime||0)>before&&this.state?.equipment?.boots)this.degradeEquipment('boots',1,'esquiva')
    return out
  }

  const prevEnemies=proto.updateEnemies
  proto.updateEnemies=function v095UpdateEnemies(dt,t){
    const hpBefore=Number(this.state?.hp)||0
    const out=prevEnemies.apply(this,arguments)
    const loss=Math.max(0,hpBefore-(Number(this.state?.hp)||0))
    if(loss>0&&this.state?.equipment?.armor)this.degradeEquipment('armor',Math.max(1,Math.min(5,Math.ceil(loss/24))),'dano')
    for(const e of this.enemies||[]){
      if(e.powerAura){
        const pulse=1+Math.sin(t*3.2+(e.phase||0))*.08
        e.powerAura.scale.setScalar(pulse)
        e.powerAura.material.opacity=e.boss?.42:.18+Math.sin(t*2.4+(e.phase||0))*.045
        e.powerAura.visible=!!e.g.visible&&!e.dead
      }
    }
    return out
  }

  const prevMakeEnemy=proto.makeEnemy
  proto.makeEnemy=function v095MakeEnemy(...args){
    const e=prevMakeEnemy.apply(this,args);if(!e?.g)return e
    const color=powerColor(e.name,e.boss)
    const aura=new THREE.Mesh(new THREE.TorusGeometry(e.boss?1.15:.62,.035,5,18),new THREE.MeshBasicMaterial({color,transparent:true,opacity:e.boss?.42:.20,depthWrite:false}))
    aura.rotation.x=Math.PI/2;aura.position.y=.06;aura.renderOrder=2;e.g.add(aura);e.powerAura=aura
    return e
  }

  // Roblox-like third-person orbit: supports independent horizontal (sides) and vertical (up/down) camera inversion.
  proto.rotateCamera=function v097RotateCamera(dx=0,dy=0){
    const invertX = !!(this.settings?.invertCameraX ?? this.settings?.invertCamera)
    const invertY = !!(this.settings?.invertCameraY ?? false)
    const dirX = invertX ? -1 : 1
    const dirY = invertY ? -1 : 1
    const sensitivityX = (this.isTouchDevice ? .0027 : .00305) * dirX
    const sensitivityY = (this.isTouchDevice ? .00235 : .00255) * dirY
    this.yaw += dx * sensitivityX
    this.pitch = clamp(this.pitch + dy * sensitivityY, -.46, .76)
  }

  proto.cameraFollow=function v095CameraFollow(dt){
    if(!this.camera||!this.player)return
    if(this.camera.fov!==68){this.camera.fov=68;this.camera.updateProjectionMatrix?.()}
    const mounted=!!this.state?.mount?.active
    const pitch=clamp(this.pitch,-.46,.76)
    const dist=clamp((this.cameraDistance||5.2)+(mounted?.8:0),4.2,10.5)
    const forward=new THREE.Vector3(Math.sin(this.yaw),0,Math.cos(this.yaw)).normalize()
    const right=new THREE.Vector3(Math.cos(this.yaw),0,-Math.sin(this.yaw)).normalize()
    const shoulder=(mounted?1.15:.88)*Math.min(1.25,Math.max(.75,dist/5.2))
    const target=new THREE.Vector3(this.player.position.x,this.player.position.y+(mounted?1.62:1.42),this.player.position.z)
    const horizontal=Math.max(2.6,Math.cos(pitch)*dist)
    const desired=target.clone().addScaledVector(forward,-horizontal).addScaledVector(right,shoulder)
    desired.y=target.y+Math.sin(pitch)*dist+1.2
    desired.y=Math.max(this.player.position.y+.68,desired.y)
    let safe=desired.clone()
    if(!this.state?.dungeon&&this.canOccupy){
      let previous=target.clone().addScaledVector(right,shoulder*.3);let hit=false
      for(let i=1;i<=16;i++){
        const k=i/16,probe=target.clone().addScaledVector(right,shoulder*(1-k*.3)).lerp(desired,k)
        if(i>3&&!this.canOccupy(probe.x,probe.z,.15)){safe=previous.clone();hit=true;break}
        previous=probe
      }
      if(hit&&safe.distanceTo(target)<2.5){safe=target.clone().addScaledVector(forward,-2.5).addScaledVector(right,shoulder*.35);safe.y=Math.max(this.player.position.y+1.1,target.y+.6)}
    }
    this.camera.position.lerp(safe,1-Math.exp(-(this.combatMode?16:12)*dt))
    const lookTarget=target.clone().addScaledVector(forward,26.0).addScaledVector(right,shoulder*.15)
    lookTarget.y=target.y-Math.sin(pitch)*26.0
    this.camera.lookAt(lookTarget)
    if(this.sun?.target){this.sun.target.position.copy(this.player.position);this.sun.target.updateMatrixWorld?.()}
  }

  const prevMpEvent=proto.onMultiplayerEvent
  proto.onMultiplayerEvent=function v095MultiplayerEvent(e){
    if((e?.type==='state'||e?.type==='join')&&e.player?.id){
      this._v095RemoteSeq ||= new Map()
      const seq=Number(e.player.seq)||0,last=this._v095RemoteSeq.get(e.player.id)||0
      if(seq&&last&&seq<last)return
      if(seq)this._v095RemoteSeq.set(e.player.id,seq)
    }
    if(e?.type==='leave'&&e.id)this._v095RemoteSeq?.delete(e.id)
    return prevMpEvent.apply(this,arguments)
  }

  const prevInteractions=proto.updateInteractions
  proto.updateInteractions=function v095Interactions(...args){
    const result=prevInteractions.apply(this,args)
    if(this.state?.actionButton?.type==='resource'){
      const node=this.getCrosshairResourceNode?.(4.8,.52)
      const weapon=this.state?.equipment?.weapon
      if(node?.type==='tree'&&weapon?.subtype!=='axe')this.state.actionButton={...this.state.actionButton,label:'Precisa de Machado',icon:'🪓',blocked:true,detail:'Equipe um machado'}
      else if(String(node?.type||'').startsWith('ore')&&weapon?.subtype!=='pickaxe')this.state.actionButton={...this.state.actionButton,label:'Precisa de Picareta',icon:'⛏️',blocked:true,detail:'Equipe uma picareta'}
    }
    return result
  }
}
