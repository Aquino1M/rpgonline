import * as THREE from 'three'
import { ShadowGame } from './engine.js'
import { MODEL_MANIFEST } from './config.js'
import { damp } from './utils.js'

const PATCH_FLAG = Symbol.for('shadow-ascension.mobile-online-v094')

// The procedural mount is deterministic, lightweight and has a known origin/seat height.
// Keeping it local avoids the scale/origin bugs that affected imported scenery/mobs before.
for (const key of ['mount','wizard','king']) if (key in MODEL_MANIFEST) MODEL_MANIFEST[key] = ''

const material = (color, opts={}) => new THREE.MeshStandardMaterial({color, roughness:.66, metalness:.04, ...opts})
const mesh = (geo, mat) => { const m=new THREE.Mesh(geo,mat); m.castShadow=true; m.receiveShadow=true; return m }

function decorateMount(game, g){
  if(!g || g.userData?.v094Decorated) return g
  g.userData ||= {}
  g.userData.v094Decorated = true
  const coat = material(0x72503a)
  const dark = material(0x251c18)
  const leather = material(0x5b2d22,{roughness:.78})
  const metal = material(0xd8c27b,{metalness:.55,roughness:.3})

  // Saddle blanket makes the riding position easy to read on a small phone screen.
  const blanket=mesh(new THREE.BoxGeometry(1.02,.07,.96),material(0x203f63,{roughness:.84}))
  blanket.position.set(0,1.47,-.07); g.add(blanket)
  const cinch=mesh(new THREE.TorusGeometry(.52,.035,6,18,Math.PI),leather)
  cinch.position.set(0,1.12,-.02);cinch.rotation.set(0,Math.PI/2,Math.PI/2);g.add(cinch)

  // Mane and tail use very cheap geometry but make the mount silhouette clearer.
  const mane=new THREE.Group();mane.position.set(0,1.55,.69)
  for(let i=0;i<5;i++){
    const tuft=mesh(new THREE.ConeGeometry(.10,.34,5),dark)
    tuft.position.set(0,i*.15,.02-i*.09);tuft.rotation.x=-.55;mane.add(tuft)
  }
  g.add(mane)
  const tail=new THREE.Group();tail.position.set(0,1.24,-.88)
  for(let i=0;i<3;i++){
    const seg=mesh(new THREE.ConeGeometry(.12-i*.02,.48,6),dark)
    seg.position.y=-.22-i*.34;seg.rotation.x=.20+i*.10;tail.add(seg)
  }
  g.add(tail)

  // Bridle/reins.
  const reinPoints=[new THREE.Vector3(-.22,1.64,.05),new THREE.Vector3(-.18,.72,.12),new THREE.Vector3(0,.18,-.02)]
  const reins=new THREE.Line(new THREE.BufferGeometry().setFromPoints(reinPoints),new THREE.LineBasicMaterial({color:0x2b1712}))
  reins.position.set(0,1.15,.58);g.add(reins)
  const brow=mesh(new THREE.TorusGeometry(.25,.025,5,14,Math.PI),leather);brow.position.set(0,2.03,.93);brow.rotation.set(Math.PI/2,0,0);g.add(brow)
  const badge=mesh(new THREE.OctahedronGeometry(.055,0),metal);badge.position.set(0,1.61,.40);g.add(badge)

  if(game.mountRig){game.mountRig.tail=tail;game.mountRig.mane=mane;game.mountRig.reins=reins}
  return g
}

function roleAction(game, npc){
  const role=npc?.def?.role
  const name=npc?.def?.name||'NPC'
  if(role==='merchant') return {type:'npc',role,icon:'🛒',label:'Abrir loja',detail:name}
  if(role==='blacksmith') return {type:'npc',role,icon:'⚒️',label:'Abrir forja',detail:name}
  if(role==='stable') return {type:'npc',role,icon:'🐎',label:'Abrir estábulo',detail:name}
  if(role==='traveler') return {type:'npc',role,icon:'🧭',label:'Viajar',detail:name}
  if(role==='quest') return {type:'npc',role,icon:'📜',label:'Falar / Missões',detail:name}
  return {type:'npc',role,icon:'💬',label:'Falar',detail:name}
}

function makeRemoteMount(){
  const g=new THREE.Group();g.name='RemoteMountV094'
  const coat=material(0x6f4c36),dark=material(0x30221c),saddle=material(0x7a352d)
  const body=mesh(new THREE.CapsuleGeometry(.48,1.05,4,7),coat);body.rotation.z=Math.PI/2;body.position.y=1.02;g.add(body)
  const neck=mesh(new THREE.CapsuleGeometry(.22,.62,4,7),coat);neck.position.set(0,1.47,.58);neck.rotation.x=-.36;g.add(neck)
  const head=mesh(new THREE.BoxGeometry(.38,.4,.58),coat);head.position.set(0,1.82,.82);g.add(head)
  const seat=mesh(new THREE.BoxGeometry(.75,.13,.64),saddle);seat.position.set(0,1.45,-.05);g.add(seat)
  for(const [x,z] of [[-.31,.43],[.31,.43],[-.31,-.43],[.31,-.43]]){const leg=mesh(new THREE.CapsuleGeometry(.08,.55,3,5),coat);leg.position.set(x,.55,z);g.add(leg)}
  const tail=mesh(new THREE.ConeGeometry(.11,.65,5),dark);tail.position.set(0,1.0,-.82);tail.rotation.x=.35;g.add(tail)
  g.position.y=-1.47
  g.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false}})
  return g
}

if(!ShadowGame.prototype[PATCH_FLAG]){
  const proto=ShadowGame.prototype
  Object.defineProperty(proto,PATCH_FLAG,{value:true})

  const previousMakeMount=proto.makeMount
  proto.makeMount=function v094MakeMount(...args){return decorateMount(this,previousMakeMount.apply(this,args))}

  const previousToggleMount=proto.toggleMount
  proto.toggleMount=function v094ToggleMount(...args){
    const was=!!this.state.mount?.active
    if(!was&&this.isWaterAt?.(this.player.position.x,this.player.position.z,.15)){this.toast?.('A montaria precisa ser invocada em terra firme.');this.haptic?.(8);return false}
    const result=previousToggleMount.apply(this,args)
    const active=!!this.state.mount?.active
    if(active){
      this.player.position.y=1.47
      this.cameraDistance=Math.max(this.cameraDistance||5.2,6.15)
      this.haptic?.(18)
    }else if(was){
      this.player.position.y=0
      this.haptic?.(10)
    }
    this.state.mountButtonLabel=active?'Desmontar':'Montar'
    return result
  }

  const previousUpdatePlayer=proto.updatePlayer
  proto.updatePlayer=function v094UpdatePlayer(dt,t){
    const result=previousUpdatePlayer.apply(this,arguments)
    const mounted=!!this.state.mount?.active
    if(mounted){
      // Keep boots around saddle height and use a readable seated pose.
      this.player.position.y=damp(this.player.position.y,1.47,18,dt)
      if(this.rig?.legL){this.rig.legL.rotation.x=damp(this.rig.legL.rotation.x,-.48,14,dt);this.rig.legL.rotation.z=damp(this.rig.legL.rotation.z,-.23,14,dt)}
      if(this.rig?.legR){this.rig.legR.rotation.x=damp(this.rig.legR.rotation.x,-.48,14,dt);this.rig.legR.rotation.z=damp(this.rig.legR.rotation.z,.23,14,dt)}
      if(this.rig?.shoulderL)this.rig.shoulderL.rotation.x=damp(this.rig.shoulderL.rotation.x,-.18,10,dt)
      this.state.mountButtonLabel='Desmontar'
    }else{
      if(this.rig?.legL)this.rig.legL.rotation.z=damp(this.rig.legL.rotation.z,0,10,dt)
      if(this.rig?.legR)this.rig.legR.rotation.z=damp(this.rig.legR.rotation.z,0,10,dt)
      this.state.mountButtonLabel='Montar'
    }
    return result
  }

  const previousAnimateMount=proto.animateMount
  proto.animateMount=function v094AnimateMount(t,moving){
    const result=previousAnimateMount.apply(this,arguments)
    const rig=this.mountRig
    if(rig?.neck)rig.neck.rotation.z=Math.sin(t*(moving?4.2:1.5))*(moving?.035:.018)
    if(rig?.tail){rig.tail.rotation.x=.12+Math.sin(t*(moving?7:2.5))*.14;rig.tail.rotation.z=Math.sin(t*3.2)*.11}
    if(rig?.mane)rig.mane.rotation.z=Math.sin(t*4.8)*.018
    return result
  }

  const previousInteractions=proto.updateInteractions
  proto.updateInteractions=function v094Interactions(...args){
    const result=previousInteractions.apply(this,args)
    if(this.state.dungeon)return result
    if(this.state.actionButton?.type==='npc'){
      let near=null,dist=4.5
      for(const n of this.npcs||[]){const d=n.g.position.distanceTo(this.player.position);if(d<dist){near=n;dist=d}}
      if(near){
        const action=roleAction(this,near)
        this.state.actionButton=action
        this.state.interactionPrompt=this.isTouchDevice?`${action.icon} ${action.label} — ${action.detail}`:`E — ${action.label.toLowerCase()} com ${action.detail}`
      }
    }else if(this.state.actionButton?.type==='fish'){
      this.state.actionButton={...this.state.actionButton,detail:'Peixe próximo',icon:'🐟',label:'Pescar'}
      if(this.isTouchDevice)this.state.interactionPrompt='🐟 Toque em PESCAR'
    }else if(this.state.actionButton?.type==='portal'&&this.isTouchDevice){
      this.state.interactionPrompt=`🌀 Toque para ${String(this.state.actionButton.label||'entrar').toLowerCase()}`
    }else if(this.state.actionButton?.type==='resource'&&this.isTouchDevice){
      this.state.interactionPrompt=`${this.state.actionButton.icon||'⛏'} Toque para ${String(this.state.actionButton.label||'coletar').toLowerCase()}`
    }
    return result
  }

  const previousOnMultiplayerEvent=proto.onMultiplayerEvent
  proto.onMultiplayerEvent=function v094MultiplayerEvent(e){
    if(e?.type==='network'){
      this.state.multiplayer={...this.state.multiplayer,latencyMs:e.latencyMs??this.state.multiplayer.latencyMs??0,quality:e.quality||'offline',reconnecting:!!e.reconnecting,lastPacketAt:e.lastPacketAt||Date.now()}
      return
    }
    const result=previousOnMultiplayerEvent.apply(this,arguments)
    if(e?.type==='connection')this.state.multiplayer={...this.state.multiplayer,reconnecting:!e.connected&&!!this.multiplayer?.wanted,quality:e.connected?(this.state.multiplayer.quality||'boa'):'offline'}
    return result
  }

  const previousUpdateMultiplayer=proto.updateMultiplayer
  proto.updateMultiplayer=function v094UpdateMultiplayer(dt){
    const result=previousUpdateMultiplayer.apply(this,arguments)
    for(const r of this.remotePlayers?.values?.()||[]){
      if(!r.remoteMount){r.remoteMount=makeRemoteMount();r.g.add(r.remoteMount)}
      const mounted=!!r.data?.mountActive
      r.remoteMount.visible=mounted && r.g.visible
      if(mounted){
        if(r.legL){r.legL.rotation.x=damp(r.legL.rotation.x,-.48,14,dt);r.legL.rotation.z=damp(r.legL.rotation.z,-.23,14,dt)}
        if(r.legR){r.legR.rotation.x=damp(r.legR.rotation.x,-.48,14,dt);r.legR.rotation.z=damp(r.legR.rotation.z,.23,14,dt)}
      }else{
        if(r.legL)r.legL.rotation.z=damp(r.legL.rotation.z,0,10,dt)
        if(r.legR)r.legR.rotation.z=damp(r.legR.rotation.z,0,10,dt)
      }
    }
    return result
  }
}
