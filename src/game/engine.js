import * as THREE from 'three'
import { WORLD, ZONES, RARITIES, CITIES, ROADS, LANDMARKS, NPC_DEFS, PORTAL_NAMES, MODEL_MANIFEST, WORLD_MAP, ABILITIES, GUILD_RANKS, CITY_ECONOMIES, SAFE_SPAWNS, RESPAWN_RULES, ADVENTURER_BOTS, CITY_GUARDS_CONFIG, HORSE_BREEDS } from './config.js'
import { hash2, clamp, damp, zoneAt, weightedPick, fmtTime } from './utils.js'
import { AssetLibrary } from './assetLoader.js'
import { defaultClassState, starterInventory, defaultQuestState, merchantStock, shopRefreshInfo, makeItem, makeMaterialDrop, makeResourceDrop, makeTool, rollLootRarity, normalizeSaveState, totalEquipmentStats, progressQuest, activateQuest, claimQuest, refreshGuildBoard, activateGuildMission, progressGuildMissions, claimGuildMission, getGuildRank, guildRankRequirement, updateGuildRank, calculateKillXP, resolveEntityProgression, attributeBonuses, calculateGrimoireCost, getNextGrimoireLevel } from './rpgSystems.js'
import { MultiplayerClient } from './supabaseMultiplayerV3.js'
import { CLASSES_LIST, rollDestinyClass, CLASS_RANKS, getClassRankInfo } from './classesData.js'
import { TRAVEL_NODES, calculateTravelCost, rollRoadAmbush, defaultTravelState } from './fastTravel.js'
import { GateManager } from './dungeons/GateManager.js'
import { XPFeedbackManager } from './dungeons/XPFeedbackManager.js'
import { CaravanManager } from './caravans/CaravanManager.js'
import { WorldEnvironment } from './world/WorldEnvironment.js'
import { saveCloudProfile, signOutAccount } from './supabaseService.js'

const V3=()=>new THREE.Vector3()
const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.72,...extra})
const mesh=(geo,material)=>{const m=new THREE.Mesh(geo,material);m.castShadow=true;m.receiveShadow=true;return m}

const mixHex=(a,b,t=.5)=>{const ca=new THREE.Color(a),cb=new THREE.Color(b);ca.lerp(cb,t);return ca.getHex()}
const rankColor=rank=>rank?.startsWith('ZZZ')?0xff4fd8:rank?.startsWith('ZZ')?0xc84fff:rank?.startsWith('Z')?0x9d62ff:rank?.startsWith('EX')?0xff6b77:rank?.startsWith('SSS')?0xffa233:rank?.startsWith('SS')?0xffcf45:rank?.startsWith('S')?0xf5df71:rank==='A'?0xd18cff:rank==='B'?0x68b9ff:rank==='C'?0x72d89c:rank==='D'?0xa7bdcc:0x7f98a8
const normalizeTradeOffer=offer=>({gold:Math.max(0,Math.min(100000000,Math.round(Number(offer?.gold)||0))),items:(Array.isArray(offer?.items)?offer.items:[]).slice(0,20).filter(item=>item&&item.id).map(item=>({...item,id:String(item.id).slice(0,128),name:String(item.name||'Item').slice(0,80)})),updatedAt:Number(offer?.updatedAt)||Date.now()})
const tradeOfferHash=offer=>`${Math.max(0,Math.round(Number(offer?.gold)||0))}|${(offer?.items||[]).map(item=>`${item.id}:${Math.max(1,Number(item.qty)||1)}`).sort().join('|')}`

export class ShadowGame {
  constructor(canvas,onHud){
    this.canvas=canvas; this.onHud=onHud; this.assets=new AssetLibrary()
    const isMobUA = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
    this.keys={}; this.enemies=[]; this.bots=[]; this.guards=[]; this.respawnQueue=[]; this.respawnLocks=new Map(); this.chunks=new Map(); this.portals=[]; this.projectiles=[]; this.npcs=[]; this.remotePlayers=new Map(); this.effects=[]; this.virtualMove={x:0,z:0}; this.combatMode=false; this.specialAnim=0; this.lastTouch=null; this.freeLook=false; this.freeLookPointer=null; this.freeLookLast=null; this.uiSuspendedCombat=false; this.isTouchDevice=isMobUA && !window.matchMedia?.('(pointer: fine)').matches; this.verticalVelocity=0; this.grounded=true; this.aimNdcX=0; this.combatCooldown=0; this.inCombat=false;
    this.resourceNodes=[]; this.mobSpecialCooldowns=new Map()
    this.clock=new THREE.Timer(); if(typeof document!=='undefined') this.clock.connect(document); this.yaw=Math.PI; this.pitch=0.14; this.cameraDistance=5.2; this.drag=false; this.pointerLocked=false
    this.weatherClock=0; this.weatherIndex=0; this.dayHours=8.25; this.lastHud=0; this.attackClock=0; this.specialClock=0; this.dashTime=0; this.invuln=0
    this.abilityCooldowns=Object.fromEntries(ABILITIES.map(a=>[a.id,0])); this.petVisual=null; this.petVisualKey=''; this.petTarget=null; this.raycaster=new THREE.Raycaster(); this.discovered=new Set(); this.savedDiscovered=[]; this.currentMerchantZoneMin=1; this.currentMerchantZoneMax=10; this.currentMerchantZoneId='aurora'; this.currentMerchantCityId='aurora-city'; this.localUpdatedAt=0; this.serverProfileTimestamp=0; this.accountId=''; this.cloudSaveInFlight=null; this.cloudSaveQueued=false; this.persistCloudProfile=saveCloudProfile
    let savedSession = null
    try { savedSession = JSON.parse(localStorage.getItem('shadow_rpg_account_session') || 'null') } catch {}
    const savedNick = (savedSession?.username || localStorage.getItem('shadow-ascension-nick') || '').trim()
    const savedLobby = (savedSession?.server || localStorage.getItem('shadow-ascension-last-lobby') || '').trim() || 'asterra-global'
    const hasValidLogin = Boolean(savedSession?.accountId && savedSession?.username)
    this.accountId=savedSession?.accountId||''
    if (savedSession?.accountId) localStorage.setItem('shadow-ascension-player-id', savedSession.accountId)
    this.settings={renderDistance:2,pixelRatio:Math.min(window.devicePixelRatio||1,1.5),uiScale:1.2,visualQuality:'equilibrado',shadows:true,invertCameraX:false,invertCameraY:false,invertCamera:false,multiplayerUrl:localStorage.getItem('shadow-ascension-mp-url')||''}
    this.state={
      version:8,playerName:savedNick,needsNickname:true,level:1,xp:0,nextXp:120,hp:120,maxHp:120,baseMaxHp:120,stamina:100,maxStamina:100,baseMaxStamina:100,gold:220,
      baseAtk:16,baseDef:5,atk:16,def:5,speed:7.1,zone:'Vila Aurora',zoneId:'aurora',target:null,dungeon:null,boss:null,
      inventory:starterInventory(),inventoryCapacity:40,backpackLevel:0,equipment:{weapon:null,armor:null,boots:null,talisman:null},quests:defaultQuestState(),
      mount:{unlocked:false,active:false,oathCompleted:false,name:'Corcel de Aurora',currentHorseId:'horse_aurora',speedBonus:4.7,tamedHorses:[]},pets:{owned:[],activeId:null,tamingArmed:false},wantedLevel:0,classState:defaultClassState(),travelState:defaultTravelState(),ambush:null,uiPanel:null,dialogue:null,interactionPrompt:null,
      weather:'Céu limpo',time:'08:15',timeHours:8.25,portal:null,merchant:[],toast:null,settings:this.settings,
      worldMap:WORLD_MAP,playerPosition:{x:0,z:0},playerHeading:0,stats:{kills:0,dungeons:0,bosses:0},ores:2,
      abilities:ABILITIES.map(a=>({...a,remaining:0,ready:true})),currentCity:null,combatMode:false,inCombat:false,combatTimer:0,
      attributes:{strength:0,vitality:0,agility:0,intellect:0},attributePoints:0,
      guildRankIndex:0,guildRank:'E',guildPoints:0,guildMissions:[],guildMissionCycle:null,shopRefresh:null,
      economy:{cityId:'aurora-city',...CITY_ECONOMIES['aurora-city']},party:{id:null,leaderId:null,members:[],totalXP:0},onlinePlayers:[],trade:null,
      multiplayer:{connected:false,url:this.settings.multiplayerUrl,room:savedLobby,players:0,serverSave:false,transport:'offline',reason:'',latencyMs:0,quality:'offline',reconnecting:false},mobileRunning:false,
    }
    this.savedPosition={...SAFE_SPAWNS['aurora-city']}; this.loadGame(); this.state.party={id:null,leaderId:null,members:[],totalXP:0}; this.discovered=new Set(this.savedDiscovered||[]); this.init()
  }

  init(){
    const maxPr = this.isTouchDevice ? 1.15 : 1.5
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:!this.isTouchDevice,powerPreference:'high-performance',alpha:false})
    this.renderer.setPixelRatio(Math.min(this.settings.pixelRatio, maxPr)); this.renderer.shadowMap.enabled=this.settings.shadows; this.renderer.shadowMap.type=THREE.PCFShadowMap
    this.renderer.outputColorSpace=THREE.SRGBColorSpace; this.renderer.toneMapping=THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure=1.05
    this.scene=new THREE.Scene(); this.scene.background=new THREE.Color(0x8bc8ee); this.scene.fog=new THREE.Fog(0x8bc8ee,65,155)
    this.camera=new THREE.PerspectiveCamera(60,1,.1,650)
    this.hemi=new THREE.HemisphereLight(0xeaf6ff,0x29412a,1.3); this.scene.add(this.hemi)
    const shadowRes = this.isTouchDevice ? 1024 : 1536
    this.sun=new THREE.DirectionalLight(0xffefc9,2.45); this.sun.position.set(50,82,25); this.sun.castShadow=true; this.sun.shadow.mapSize.set(shadowRes,shadowRes); this.sun.shadow.camera.left=-48;this.sun.shadow.camera.right=48;this.sun.shadow.camera.top=48;this.sun.shadow.camera.bottom=-48;this.sun.shadow.camera.far=180; this.scene.add(this.sun); this.scene.add(this.sun.target)
    this.moon=new THREE.DirectionalLight(0x8db4ff,.15); this.moon.position.set(-40,50,-30); this.scene.add(this.moon)

    this.worldRoot=new THREE.Group(); this.scene.add(this.worldRoot); this.externalModels={wolf:null,dragon:null,mount:null,packMobs:[],packMobEntries:[]}; this.externalScenery=[]; this.externalSceneryEntries=[]; this.externalCitySceneryEntries=[]; this.packCityDecor=[]; this.packsManifest=null; this.pack2Manifest=null
    this.player=this.makePlayer(); this.player.position.set(Number.isFinite(this.savedPosition.x)?this.savedPosition.x:SAFE_SPAWNS['aurora-city'].x,0,Number.isFinite(this.savedPosition.z)?this.savedPosition.z:SAFE_SPAWNS['aurora-city'].z); this.scene.add(this.player)
    this.localPlayerLabel=this.makePlayerNameplate({name:this.state.playerName||'Aventureiro',level:this.state.level,hp:this.state.hp,maxHp:this.state.maxHp,guildRank:this.state.guildRank},true);this.localPlayerLabel.position.y=2.76;this.player.add(this.localPlayerLabel)
    this.mountModel=this.makeMount(); this.mountModel.visible=false; this.scene.add(this.mountModel); this.state.mount.active=false
    this.auraRoot=new THREE.Group(); this.scene.add(this.auraRoot); this.updateClassAura(); this.recalcStats()
    this.cityGroups=[]; this.cityById=new Map(); this.buildWorldCities(); this.ensureSafeSpawn(); this.buildRoadNetwork(); this.buildLandmarks()
    this.village=this.cityGroups.find(c=>c.city.id==='aurora-city')?.group||new THREE.Group()
    this.makeNPCs(); this.spawnAdventurerBots(); this.spawnCityGuards(); this.seedPortals(); this.createWeatherSystem(); this.bind(); this.createDungeonArena(); this.resize(); refreshGuildBoard(this.state)
    this.gateManager=new GateManager(this); this.xpFeedback=new XPFeedbackManager(this); this.gateManager.init()
    this.worldEnv=new WorldEnvironment(this); this.worldEnv.init()
    this.caravanManager=new CaravanManager(this); this.caravanManager.init()
    this.resizeObserver=new ResizeObserver(()=>this.resize()); this.resizeObserver.observe(this.canvas)
    this.autoSave=setInterval(()=>this.saveGame(),10000)
    this.cloudSave=setInterval(()=>this.saveCloudGame(),5*60*1000)
    this.multiplayer=new MultiplayerClient({room:'asterra-global',name:this.state.playerName||'Aventureiro',onEvent:e=>this.onMultiplayerEvent(e)});this.settings.multiplayerUrl=this.multiplayer.url||this.settings.multiplayerUrl;this.state.settings=this.settings;this.state.multiplayer.url=this.settings.multiplayerUrl;this.state.multiplayer.room=this.multiplayer.room;if(this.multiplayer.url)this.multiplayer.connect()
    if(this.isTouchDevice)this.setTouchDeviceMode(true)
    if(typeof window!=='undefined')window.game=this
    this.loadExternalVisuals(); this.loop()
  }

  destroy(){
    this.saveCloudGame({force:true}); cancelAnimationFrame(this.raf); clearInterval(this.autoSave); clearInterval(this.cloudSave); this.resizeObserver?.disconnect(); this.multiplayer?.disconnect(); this.clock?.disconnect?.();
    this._unbind?.forEach(([t,n,f,o])=>t.removeEventListener(n,f,o)); this.renderer?.dispose()
  }

  makePlayer(){
    const root=new THREE.Group(); root.name='Player'
    const visual=new THREE.Group(); root.add(visual); this.playerVisual=visual
    const skin=mat(0xe8b78f), hair=mat(0x2b211d), cloth=mat(0x355f9f), dark=mat(0x1d2a3b), leather=mat(0x6b4026), metal=mat(0xd6dee8,{metalness:.68,roughness:.24})
    const hips=new THREE.Group(); hips.position.y=1.03; visual.add(hips)
    const torso=mesh(new THREE.CapsuleGeometry(.36,.64,5,10),cloth); torso.position.y=.35; hips.add(torso)
    const belt=mesh(new THREE.BoxGeometry(.8,.13,.34),leather); belt.position.y=.05; hips.add(belt)
    const neck=new THREE.Group(); neck.position.y=.92; hips.add(neck)
    const head=mesh(new THREE.SphereGeometry(.29,16,12),skin); head.position.y=.28; neck.add(head)
    const hairCap=mesh(new THREE.SphereGeometry(.305,12,8,0,Math.PI*2,0,Math.PI*.58),hair); hairCap.position.y=.36; neck.add(hairCap)
    for(let i=0;i<4;i++){const lock=mesh(new THREE.ConeGeometry(.07,.35,6),hair);lock.position.set((i-1.5)*.12,.34,-.2);lock.rotation.x=-.45;neck.add(lock)}
    const eyeMat=new THREE.MeshBasicMaterial({color:0x1b2430})
    const eyeL=mesh(new THREE.BoxGeometry(.055,.055,.02),eyeMat), eyeR=mesh(new THREE.BoxGeometry(.055,.055,.02),eyeMat)
    eyeL.position.set(-.1,.29,.27); eyeR.position.set(.1,.29,.27); neck.add(eyeL,eyeR)
    const shoulderL=new THREE.Group(), shoulderR=new THREE.Group(); shoulderL.position.set(-.46,.7,0); shoulderR.position.set(.46,.7,0); hips.add(shoulderL,shoulderR)
    const armGeo=new THREE.CapsuleGeometry(.105,.48,4,7); const handGeo=new THREE.SphereGeometry(.12,8,7)
    const armL=mesh(armGeo,skin),armR=mesh(armGeo,skin); armL.position.y=-.31;armR.position.y=-.31;shoulderL.add(armL);shoulderR.add(armR)
    const handL=mesh(handGeo,skin),handR=mesh(handGeo,skin);handL.position.y=-.63;handR.position.y=-.63;shoulderL.add(handL);shoulderR.add(handR)
    const legL=new THREE.Group(),legR=new THREE.Group();legL.position.set(-.2,-.02,0);legR.position.set(.2,-.02,0);hips.add(legL,legR)
    const legGeo=new THREE.CapsuleGeometry(.14,.65,4,7);const legMeshL=mesh(legGeo,dark),legMeshR=mesh(legGeo,dark);legMeshL.position.y=-.5;legMeshR.position.y=-.5;legL.add(legMeshL);legR.add(legMeshR)
    const bootGeo=new THREE.BoxGeometry(.28,.22,.48);const bootL=mesh(bootGeo,leather),bootR=mesh(bootGeo,leather);bootL.position.set(0,-.93,.08);bootR.position.set(0,-.93,.08);legL.add(bootL);legR.add(bootR)
    const cape=mesh(new THREE.PlaneGeometry(.72,1.18,2,4),mat(0x1d4b72,{side:THREE.DoubleSide}));cape.position.set(0,.48,-.38);cape.rotation.x=.12;hips.add(cape)

    const swordPivot=new THREE.Group(); swordPivot.position.set(.08,-.56,.02); shoulderR.add(swordPivot)
    const blade=mesh(new THREE.BoxGeometry(.085,.95,.055),metal);blade.position.y=-.48;swordPivot.add(blade)
    const guard=mesh(new THREE.BoxGeometry(.42,.07,.09),mat(0xb99645,{metalness:.5}));guard.position.y=.02;swordPivot.add(guard)
    const grip=mesh(new THREE.CylinderGeometry(.045,.045,.28,8),leather);grip.position.y=.17;swordPivot.add(grip)
    swordPivot.userData.proceduralParts=[blade,guard,grip]
    this.weaponVisual=swordPivot
    const shield=mesh(new THREE.CylinderGeometry(.34,.34,.075,12),mat(0x4d6b92,{metalness:.3})); shield.rotation.x=Math.PI/2; shield.position.set(-.1,-.3,-.18); shoulderL.add(shield); this.shieldVisual=shield
    const chestPlate=mesh(new THREE.BoxGeometry(.72,.72,.2),mat(0x6a7b8c,{metalness:.45}));chestPlate.position.set(0,.45,.22);hips.add(chestPlate);this.armorVisual=chestPlate
    this.rig={root,visual,hips,torso,neck,head,shoulderL,shoulderR,legL,legR,cape,swordPivot,bootL,bootR,chestPlate,shield}
    root.userData.motion='idle'; return root
  }

  makeMount(){
    const g=new THREE.Group(); g.name='Mount'
    const coat=mat(0x6d4b35), dark=mat(0x34251d), saddleMat=mat(0x853d2e)
    const body=mesh(new THREE.CapsuleGeometry(.58,1.25,5,10),coat);body.rotation.z=Math.PI/2;body.position.y=1.05;g.add(body)
    const neck=new THREE.Group();neck.position.set(0,1.18,.72);neck.rotation.x=-.35;g.add(neck)
    const neckMesh=mesh(new THREE.CapsuleGeometry(.28,.75,5,9),coat);neckMesh.position.y=.38;neck.add(neckMesh)
    const head=mesh(new THREE.BoxGeometry(.46,.48,.72),coat);head.position.set(0,.8,.18);neck.add(head)
    const ear1=mesh(new THREE.ConeGeometry(.1,.32,5),dark),ear2=ear1.clone();ear1.position.set(-.14,1.12,.15);ear2.position.set(.14,1.12,.15);neck.add(ear1,ear2)
    const saddle=mesh(new THREE.BoxGeometry(.9,.18,.8),saddleMat);saddle.position.set(0,1.55,-.08);g.add(saddle)
    const legs=[];for(const [x,z] of [[-.38,.52],[.38,.52],[-.38,-.52],[.38,-.52]]){const p=new THREE.Group();p.position.set(x,.86,z);const l=mesh(new THREE.CapsuleGeometry(.11,.68,4,6),coat);l.position.y=-.42;p.add(l);g.add(p);legs.push(p)}
    this.mountRig={body,neck,neckMesh,head,legs,coat}; return g
  }

  makeHouse(x,z,scale=1,color=0xe7d5ad,roofColor=0x8c4739){
    const g=new THREE.Group(); g.position.set(x,0,z);g.scale.setScalar(scale)
    const base=mesh(new THREE.BoxGeometry(5.2,3.1,4.3),mat(color));base.position.y=1.55;g.add(base)
    const timber=mat(0x5a3a26);for(const sx of [-2.35,2.35])for(const sz of [-1.95,1.95]){const b=mesh(new THREE.BoxGeometry(.18,3.2,.18),timber);b.position.set(sx,1.6,sz);g.add(b)}
    const roof=mesh(new THREE.ConeGeometry(3.7,2.25,4),mat(roofColor));roof.position.y=4.0;roof.rotation.y=Math.PI/4;roof.scale.z=.82;g.add(roof)
    const door=mesh(new THREE.BoxGeometry(.9,1.75,.12),mat(0x5a331f));door.position.set(0,.92,2.18);g.add(door)
    for(const wx of [-1.45,1.45]){const w=mesh(new THREE.BoxGeometry(.78,.75,.09),mat(0x78c8e8,{emissive:0x18313d,emissiveIntensity:.25}));w.position.set(wx,1.9,2.19);g.add(w)}
    const chimney=mesh(new THREE.BoxGeometry(.48,1.55,.48),mat(0x6c5d54));chimney.position.set(1.55,4.18,-.45);g.add(chimney)
    return g
  }

  buildWorldCities(){
    for(const city of CITIES){
      const group=this.makeCity(city);group.position.set(city.x,0,city.z);group.userData.cityId=city.id
      this.worldRoot.add(group);const entry={city,group};this.cityGroups.push(entry);this.cityById.set(city.id,entry)
    }
  }

  makeCity(city){
    const g=new THREE.Group();g.name=city.name
    const style={
      meadow:{wall:0x9d9274,house:0xe7d5ad,roof:0x8c4739,road:0xb7a57f},
      forest:{wall:0x5e6358,house:0xb5ad8e,roof:0x4e5547,road:0x80765f},
      coast:{wall:0xa79d82,house:0xe8ddc4,roof:0x4f7c93,road:0xc7b98f},
      stone:{wall:0x7d837e,house:0xc8c8bd,roof:0x657075,road:0x9b9d93},
      ember:{wall:0x694d43,house:0xaf8069,roof:0x613a34,road:0x875a45},
      void:{wall:0x4d465e,house:0x686078,roof:0x393447,road:0x5d566a},
      crown:{wall:0xa9b3bd,house:0xd8e0e4,roof:0x8aa0b4,road:0xbfc7cb},
    }[city.style]||{wall:0x9d9274,house:0xe7d5ad,roof:0x8c4739,road:0xb7a57f}
    const roadMat=mat(style.road);const plaza=mesh(new THREE.CylinderGeometry(10.5,11.8,.16,24),roadMat);plaza.position.y=.055;g.add(plaza)
    const roadX=mesh(new THREE.BoxGeometry(city.wallRadius*1.82,.12,4.2),roadMat);roadX.position.y=.04;g.add(roadX)
    const roadZ=mesh(new THREE.BoxGeometry(4.2,.12,city.wallRadius*1.82),roadMat);roadZ.position.y=.04;g.add(roadZ)

    const wallMat=mat(style.wall,{roughness:.92});const r=city.wallRadius,segments=24
    for(let i=0;i<segments;i++){
      if([0,6,12,18].includes(i))continue
      const a=i/segments*Math.PI*2;const w=mesh(new THREE.BoxGeometry(r*Math.PI*2/segments+.35,2.8,1.05),wallMat)
      w.position.set(Math.cos(a)*r,1.4,Math.sin(a)*r);w.rotation.y=-a+Math.PI/2;g.add(w)
    }
    for(const a of [Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4]){
      const tower=mesh(new THREE.CylinderGeometry(1.5,1.75,4.7,8),wallMat);tower.position.set(Math.cos(a)*r,2.35,Math.sin(a)*r);g.add(tower)
      const cap=mesh(new THREE.ConeGeometry(2.05,1.7,8),mat(style.roof));cap.position.set(Math.cos(a)*r,5.55,Math.sin(a)*r);g.add(cap)
    }
    for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
      const postL=mesh(new THREE.BoxGeometry(1.2,4.2,1.2),wallMat),postR=postL.clone();const tangent=new THREE.Vector3(-Math.sin(a),0,Math.cos(a))
      const center=new THREE.Vector3(Math.cos(a)*r,0,Math.sin(a)*r);postL.position.copy(center).addScaledVector(tangent,3);postR.position.copy(center).addScaledVector(tangent,-3);postL.position.y=2.1;postR.position.y=2.1;g.add(postL,postR)
      const arch=mesh(new THREE.BoxGeometry(7.1,.65,1.1),wallMat);arch.position.copy(center);arch.position.y=4.15;arch.rotation.y=-a+Math.PI/2;g.add(arch)
    }

    const houseOffsets=[[-17,-10,.92],[-17,11,.85],[17,11,.94],[18,-11,.86],[-5,19,.78],[6,-19,.8]]
    houseOffsets.forEach((h,i)=>g.add(this.makeHouse(h[0],h[1],h[2],style.house,i%2?style.roof:mixHex(style.roof,0x7b4a3d,.25))))

    const well=new THREE.Group();const wb=mesh(new THREE.CylinderGeometry(1.2,1.45,.88,12),mat(style.wall));wb.position.y=.44;well.add(wb);const hole=mesh(new THREE.CylinderGeometry(.75,.75,.94,16),mat(0x101820));hole.position.y=.49;well.add(hole);well.position.set(0,0,0);g.add(well)
    for(let i=0;i<10;i++){const a=i/10*Math.PI*2,rr=13.8;const lamp=new THREE.Group();lamp.position.set(Math.cos(a)*rr,0,Math.sin(a)*rr);const pole=mesh(new THREE.CylinderGeometry(.045,.065,2.25,6),mat(0x40352d));pole.position.y=1.12;lamp.add(pole);const glow=mesh(new THREE.SphereGeometry(.14,8,8),new THREE.MeshBasicMaterial({color:0xffcf76}));glow.position.y=2.2;lamp.add(glow);g.add(lamp)}

    // Service stalls / guild boards use the same coordinates as the actual NPCs.
    for(const svc of city.services||[]){
      const role=svc.role,c=role==='merchant'?0xc9944c:role==='blacksmith'?0xa94f3f:role==='stable'?0x6290a8:role==='townhall'?0x3b82f6:role==='guild'?0xeab308:role==='quest'?0x60a5fa:0x5e79ad
      const stall=new THREE.Group();stall.userData.service=role
      const table=mesh(new THREE.BoxGeometry(role==='blacksmith'?3.4:3,.18,1.5),mat(0x6b482d));table.position.y=1;stall.add(table)
      const canopy=mesh(new THREE.BoxGeometry(3.4,.12,1.9),mat(c));canopy.position.y=2.5;stall.add(canopy)
      for(const xx of [-1.45,1.45]){const pole=mesh(new THREE.CylinderGeometry(.05,.05,2.6,6),mat(0x5b3d28));pole.position.set(xx,1.3,0);stall.add(pole)}
      if(role==='blacksmith'){const anvil=mesh(new THREE.BoxGeometry(.8,.35,.45),mat(0x606770,{metalness:.6,roughness:.35}));anvil.position.set(0,.72,.95);stall.add(anvil)}
      const signText=role==='merchant'?'LOJA • MERCADOR':role==='blacksmith'?'FERREIRO RÚNICO':role==='stable'?'ESTÁBULOS':role==='traveler'?'CARAVANA • VIAGENS':role==='townhall'?'🏛️ PREFEITURA':role==='guild'?'⚔️ GUILDA DE AVENTUREIROS':role==='quest'?'📜 QUADRO DE MISSÕES':'SERVIÇOS'
      const signBorder=role==='merchant'?'#72f0ad':role==='blacksmith'?'#ff9270':role==='stable'||role==='traveler'?'#7dd3fc':role==='townhall'?'#60a5fa':role==='guild'?'#fbbf24':'#a78bfa'
      const signCanvas=document.createElement('canvas');signCanvas.width=512;signCanvas.height=128
      const signCtx=signCanvas.getContext('2d');signCtx.clearRect(0,0,512,128);signCtx.fillStyle='rgba(4,16,26,.88)';signCtx.strokeStyle=signBorder;signCtx.lineWidth=8;signCtx.beginPath();signCtx.roundRect?.(12,14,488,100,28);if(!signCtx.roundRect){signCtx.rect(12,14,488,100)}signCtx.fill();signCtx.stroke();signCtx.font='900 38px Inter,Arial';signCtx.textAlign='center';signCtx.textBaseline='middle';signCtx.fillStyle='#ffffff';signCtx.fillText(signText,256,65)
      const signTexture=new THREE.CanvasTexture(signCanvas);signTexture.colorSpace=THREE.SRGBColorSpace;signTexture.minFilter=THREE.LinearFilter
      const sign=new THREE.Sprite(new THREE.SpriteMaterial({map:signTexture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));sign.position.set(0,3.75,0);sign.scale.set(5.0,1.18,1);sign.renderOrder=25;sign.userData.serviceLabel=true;stall.add(sign)
      stall.position.set(svc.x-city.x,0,svc.z-city.z);g.add(stall)
    }
    return g
  }

  buildRoadNetwork(){
    this.roadMeshes=[];const byId=new Map(CITIES.map(c=>[c.id,c]))
    for(const road of ROADS){const a=byId.get(road.a),b=byId.get(road.b);if(!a||!b)continue
      const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),midX=(a.x+b.x)/2,midZ=(a.z+b.z)/2
      const strip=mesh(new THREE.BoxGeometry(4.1,.055,len),mat(0x9a8c6c,{roughness:1}));strip.position.set(midX,.025,midZ);strip.rotation.y=Math.atan2(dx,dz);strip.receiveShadow=true;strip.castShadow=false;this.worldRoot.add(strip)
      this.roadMeshes.push({mesh:strip,a,b,midX,midZ,len})
    }
  }

  buildLandmarks(){
    this.landmarkMeshes=[]
    for(const lm of LANDMARKS){
      const g=new THREE.Group();g.name=lm.name;g.position.set(lm.x,0,lm.z)
      const zone=zoneAt(lm.x,lm.z,ZONES),stone=mat(zone.id==='void'?0x625879:zone.id==='ember'?0x7b4b3b:0x87908b,{roughness:.9})
      if(lm.type==='bridge'){
        const deck=mesh(new THREE.BoxGeometry(13,.55,4.2),mat(0x76553a));deck.position.y=.7;g.add(deck)
        for(const x of [-5,0,5]){const p=mesh(new THREE.BoxGeometry(.6,2.2,.6),stone);p.position.set(x,-.1,0);g.add(p)}
      }else if(lm.type==='crater'){
        const ring=mesh(new THREE.TorusGeometry(4.6,.72,8,22),mat(0x4f2b25));ring.rotation.x=Math.PI/2;ring.position.y=.35;g.add(ring)
        const glow=mesh(new THREE.CircleGeometry(3.8,24),new THREE.MeshBasicMaterial({color:0xd95331,transparent:true,opacity:.45,side:THREE.DoubleSide}));glow.rotation.x=-Math.PI/2;glow.position.y=.12;g.add(glow)
      }else{
        const base=mesh(new THREE.CylinderGeometry(2.5,3.1,.8,10),stone);base.position.y=.4;g.add(base)
        const pillar=mesh(new THREE.CylinderGeometry(.7,1.05,5.4,7),stone);pillar.position.y=3;g.add(pillar)
        const crystal=mesh(new THREE.OctahedronGeometry(.75),new THREE.MeshStandardMaterial({color:new THREE.Color(zone.accent),emissive:new THREE.Color(zone.accent),emissiveIntensity:.55,roughness:.28}));crystal.position.y=6.2;g.add(crystal)
      }
      g.visible=false;this.worldRoot.add(g);this.landmarkMeshes.push({def:lm,group:g})
    }
  }

  cityAt(x,z,pad=0){
    let best=null,bd=Infinity
    for(const city of CITIES){const d=Math.hypot(x-city.x,z-city.z);if(d<=city.radius+pad&&d<bd){best=city;bd=d}}
    return best
  }

  isInsideCitySafeZone(x,z,pad=0){return !!this.cityAt(x,z,pad)}

  isOnRoad(x,z,pad=3.5){
    const byId=new Map(CITIES.map(c=>[c.id,c]))
    for(const road of ROADS){
      const a=byId.get(road.a),b=byId.get(road.b)
      if(!a||!b)continue
      const ax=a.x,az=a.z,bx=b.x,bz=b.z
      const dx=bx-ax,dz=bz-az,l2=dx*dx+dz*dz
      if(l2===0)continue
      const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/l2))
      const px=ax+t*dx,pz=az+t*dz
      if(Math.hypot(x-px,z-pz)<=(2.2+pad))return true
    }
    for(const city of CITIES){
      const d=Math.hypot(x-city.x,z-city.z)
      if(d<=city.radius+pad*2){
        if(Math.abs(x-city.x)<=3.5+pad||Math.abs(z-city.z)<=3.5+pad)return true
      }
    }
    return false
  }

  ensureSafeSpawn(){
    const aurora=CITIES.find(c=>c.id==='aurora-city'),safe=SAFE_SPAWNS['aurora-city']||{x:0,z:22}
    const d=aurora?Math.hypot(this.player.position.x-aurora.x,this.player.position.z-aurora.z):0
    const nearWell=d<3.2
    if(nearWell||d>aurora.radius*0.75||!this.canOccupy(this.player.position.x,this.player.position.z,.55)){
      this.player.position.set(safe.x,0,safe.z)
      this.savedPosition={x:safe.x,z:safe.z}
    }
  }

  respawnPlayerAt(cityId='aurora-city'){
    const safe=SAFE_SPAWNS[cityId]||SAFE_SPAWNS['aurora-city']||{x:0,z:22};this.player.position.set(safe.x,0,safe.z);this.verticalVelocity=0;this.grounded=true
  }

  canOccupy(x,z,radius=.55){
    for(const c of this.chunks.values())for(const o of c.colliders||[]){if(o.active===false)continue;const rr=radius+o.r;if((x-o.x)*(x-o.x)+(z-o.z)*(z-o.z)<rr*rr)return false}
    const houseOffsets=[[-17,-10,.92],[-17,11,.85],[17,11,.94],[18,-11,.86],[-5,19,.78],[6,-19,.8]]
    for(const city of CITIES){
      const lx=x-city.x,lz=z-city.z,d=Math.hypot(lx,lz),r=city.wallRadius
      if(d<r+7){
        // 4 Corner towers
        for(const a of [Math.PI/4, 3*Math.PI/4, 5*Math.PI/4, 7*Math.PI/4]){
          const tx=Math.cos(a)*r,tz=Math.sin(a)*r,tr=radius+1.85
          if((lx-tx)*(lx-tx)+(lz-tz)*(lz-tz)<tr*tr)return false
        }
        // Gate posts at 4 gates: center ± 3 * tangent (thickness 1.2)
        for(const a of [0, Math.PI/2, Math.PI, Math.PI*1.5]){
          const cx=Math.cos(a)*r,cz=Math.sin(a)*r,tx=-Math.sin(a),tz=Math.cos(a)
          for(const s of [-3, 3]){
            const px=cx+tx*s,pz=cz+tz*s,pr=radius+0.95
            if((lx-px)*(lx-px)+(lz-pz)*(lz-pz)<pr*pr)return false
          }
        }
        // Wall ring: from r - 1.15 to r + 1.25
        if(d>r-1.15 && d<r+1.25){
          let isGateOpening=false
          for(const a of [0, Math.PI/2, Math.PI, Math.PI*1.5]){
            const gx=Math.cos(a)*r,gz=Math.sin(a)*r,tx=-Math.sin(a),tz=Math.cos(a)
            const dot=(lx-gx)*tx+(lz-gz)*tz,norm=(lx-gx)*Math.cos(a)+(lz-gz)*Math.sin(a)
            if(Math.abs(dot)<2.2 && Math.abs(norm)<2.4){isGateOpening=true;break}
          }
          if(!isGateOpening)return false
        }
        for(const [hx,hz,sc] of houseOffsets){const dx=lx-hx,dz=lz-hz,rr=radius+2.45*sc;if(dx*dx+dz*dz<rr*rr)return false}
        if(lx*lx+lz*lz<(radius+1.35)*(radius+1.35))return false
        for(const svc of city.services||[]){const dx=x-svc.x,dz=z-svc.z,rr=radius+1.25;if(dx*dx+dz*dz<rr*rr)return false}
      }
    }
    return true
  }
  moveWithCollisions(delta){
    const p=this.player.position,r=this.state.mount.active?.85:.55
    if(this.state.dungeon){p.add(delta);return}
    const x=p.x+delta.x,z=p.z+delta.z
    if(this.canOccupy(x,z,r)){p.x=x;p.z=z;return}
    if(this.canOccupy(x,p.z,r))p.x=x
    if(this.canOccupy(p.x,z,r))p.z=z
  }

  updateCityVisibility(){
    const px=this.player.position.x,pz=this.player.position.z,limit=WORLD.decorDistance*1.45
    for(const entry of this.cityGroups){entry.group.visible=!this.state.dungeon&&Math.hypot(px-entry.city.x,pz-entry.city.z)<limit}
    for(const r of this.roadMeshes||[]){r.mesh.visible=!this.state.dungeon&&Math.hypot(px-r.midX,pz-r.midZ)<Math.max(limit,r.len*.62)}
    for(const n of this.npcs){n.g.visible=!this.state.dungeon&&Math.hypot(px-n.g.position.x,pz-n.g.position.z)<limit}
    for(const lm of this.landmarkMeshes||[]){lm.group.visible=!this.state.dungeon&&Math.hypot(px-lm.def.x,pz-lm.def.z)<limit}
  }

  makeNPCs(){
    for(const def of NPC_DEFS){const n=this.makeNpc(def);this.worldRoot.add(n.g);this.npcs.push(n)}
  }

  makeNpc(def){
    const g=new THREE.Group();g.position.set(def.x,0,def.z)
    const body=mesh(new THREE.CapsuleGeometry(.32,.8,5,9),mat(def.color));body.position.y=1.05;g.add(body)
    const head=mesh(new THREE.SphereGeometry(.26,12,10),mat(0xe6b38c));head.position.y=1.78;g.add(head)
    const hair=mesh(new THREE.SphereGeometry(.275,10,7,0,Math.PI*2,0,Math.PI*.55),mat(def.id==='brann'?0x5b2d23:0x342b27));hair.position.y=1.87;g.add(hair)
    const markerColor=def.role==='quest'?0x38bdf8:def.role==='merchant'?0x70e1a1:def.role==='blacksmith'?0xff855e:def.role==='townhall'?0x60a5fa:def.role==='guild'?0xfbbf24:def.role==='stable'?0xa3e635:0x8bd5ff
    const marker=mesh(new THREE.OctahedronGeometry(.14),new THREE.MeshBasicMaterial({color:markerColor}));marker.position.y=2.55;g.add(marker)

    // Overhead nameplate sprite for NPC
    const c=document.createElement('canvas');c.width=384;c.height=96
    const ctx=c.getContext('2d');ctx.clearRect(0,0,384,96)
    ctx.textAlign='center';ctx.textBaseline='middle'
    ctx.fillStyle='rgba(5,12,22,0.85)';ctx.strokeStyle=def.role==='townhall'?'#60a5fa':def.role==='guild'?'#fbbf24':def.role==='quest'?'#38bdf8':'#ffffff'
    ctx.lineWidth=4;ctx.beginPath();ctx.roundRect?.(12,12,360,72,20);if(!ctx.roundRect){ctx.rect(12,12,360,72)}ctx.fill();ctx.stroke()
    ctx.font='900 28px Inter,Arial';ctx.fillStyle='#ffffff';ctx.fillText(def.name,192,36)
    ctx.font='700 18px Inter,Arial';ctx.fillStyle=def.role==='townhall'?'#93c5fd':def.role==='guild'?'#fde047':def.role==='quest'?'#7dd3fc':'#cbd5e1'
    const sub=def.role==='townhall'?'[Prefeitura]':def.role==='guild'?'[Guilda]':def.role==='quest'?'[Missões]':def.role==='merchant'?'[Mercador]':def.role==='blacksmith'?'[Ferreiro]':def.role==='stable'?'[Estábulos]':'[NPC]'
    ctx.fillText(sub,192,66)
    const tx=new THREE.CanvasTexture(c);tx.minFilter=THREE.LinearFilter;tx.colorSpace=THREE.SRGBColorSpace
    const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:tx,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}))
    tag.position.y=2.95;tag.scale.set(2.4,0.6,1);tag.renderOrder=32;g.add(tag)

    return {g,def,marker,body,head,hair,tag}
  }

  createWeatherSystem(){
    const count=this.isTouchDevice?(Math.min(window.innerWidth,window.innerHeight)<700?260:380):650, geo=new THREE.BufferGeometry(),pos=new Float32Array(count*3)
    for(let i=0;i<count;i++){pos[i*3]=(Math.random()-.5)*50;pos[i*3+1]=Math.random()*28;pos[i*3+2]=(Math.random()-.5)*50}
    geo.setAttribute('position',new THREE.BufferAttribute(pos,3));const material=new THREE.PointsMaterial({color:0xbfe7ff,size:.075,transparent:true,opacity:.65,depthWrite:false});this.rain=new THREE.Points(geo,material);this.rain.visible=false;this.scene.add(this.rain)
  }

  createDungeonArena(){
    this.dungeonArena=new THREE.Group();this.dungeonArena.name='DungeonWorld';this.dungeonArena.visible=false;this.scene.add(this.dungeonArena)
    const floor=mesh(new THREE.CylinderGeometry(30,32,1.1,40),mat(0x242637));floor.position.y=-.55;this.dungeonArena.add(floor)
    const ring=mesh(new THREE.TorusGeometry(22,.45,8,40),mat(0x4b405f,{emissive:0x140b25,emissiveIntensity:.4}));ring.rotation.x=Math.PI/2;ring.position.y=.08;this.dungeonArena.add(ring)
    for(let i=0;i<18;i++){const a=i/18*Math.PI*2,r=22+(i%3)*2;const p=mesh(new THREE.BoxGeometry(1.4+(i%2),4+(i%4),1.4),mat(i%3===0?0x43364d:0x313445));p.position.set(Math.cos(a)*r,(4+(i%4))/2,Math.sin(a)*r);p.rotation.y=-a;this.dungeonArena.add(p)}
    for(let i=0;i<12;i++){const a=i/12*Math.PI*2,r=13+(i%2)*4;const crystal=mesh(new THREE.OctahedronGeometry(.45+(i%3)*.12),new THREE.MeshStandardMaterial({color:0x8b5cf6,emissive:0x4c1d95,emissiveIntensity:1.1}));crystal.position.set(Math.cos(a)*r,.8,Math.sin(a)*r);this.dungeonArena.add(crystal)}
  }


  normalizePackManifest(data,legacy=false){
    if(!data||typeof data!=='object')return null
    const mobRecords=(data.mobs||[]).map((x,i)=>typeof x==='string'?{url:x,name:`mob-${i}`,source:legacy?'PACK2':'PACK',path:x,tags:[],bossCandidate:/boss|dragon|drag[aã]o|giant|coloss/i.test(x)}:{...x,tags:Array.isArray(x.tags)?x.tags:[]})
    const sceneryRecords=(data.scenery||[]).map((x,i)=>typeof x==='string'?{url:x,name:`scenery-${i}`,source:legacy?'PACK2':'PACK',path:x,kind:'generic',tags:['generic']}:{...x,tags:Array.isArray(x.tags)?x.tags:[],kind:x.kind||'generic'})
    return {...data,mobs:mobRecords,scenery:sceneryRecords}
  }

  async readPacksManifest(){
    const candidates=[
      {url:'/models/bundled/manifest.json',legacy:false,bundled:true},
      {url:MODEL_MANIFEST.packsManifest||'/models/packs/manifest.json',legacy:false},
      {url:MODEL_MANIFEST.pack2Manifest||'/models/pack2/manifest.json',legacy:true},
    ]
    const manifests=[]
    for(const c of candidates){
      try{
        const res=await fetch(c.url,{cache:'no-store'})
        if(!res.ok)continue
        const data=this.normalizePackManifest(await res.json(),c.legacy)
        if(data)manifests.push({...data,_url:c.url,_bundled:!!c.bundled})
      }catch{}
    }
    if(!manifests.length)return null
    const dedupe=(list,keyFn)=>{
      const map=new Map()
      for(const x of list){if(!x)continue;const k=keyFn(x);if(!map.has(k))map.set(k,x)}
      return [...map.values()]
    }
    const merged={
      version:'0.8.4',
      generatedAt:new Date().toISOString(),
      playerPolicy:'LOCKED - PACK/PACK2 never replace the playable character',
      sources:[...new Set(manifests.flatMap(m=>m.sources||[]))],
      mobs:dedupe(manifests.flatMap(m=>m.mobs||[]),x=>`${x.url}|${x.nodeName||''}`),
      scenery:dedupe(manifests.flatMap(m=>m.scenery||[]),x=>`${x.url}|${x.nodeName||''}`),
      ignoredCharacters:manifests.flatMap(m=>m.ignoredCharacters||[]),
      ignored:manifests.flatMap(m=>m.ignored||[]),
    }
    this.packsManifest=merged
    this.pack2Manifest=merged
    return merged
  }

  mobSearchTags(name,zone,boss=false){
    const low=String(name||'').toLowerCase(),tags=[]
    const add=(tag,re)=>{if(re.test(low))tags.push(tag)}
    add('wolf',/lobo|wolf/);add('dragon',/drag[aã]o|dragon/);add('slime',/slime/);add('boar',/javali|boar/);add('golem',/golem/);add('spider',/aranha|spider/);add('bird',/corvo|gaivota|harpia|roc|bird|crow|harpy/);add('beast',/raposa|cervo|bode|fera|fox|deer|goat|beast/);add('insect',/besouro|escorpi[aã]o|beetle|scorpion/);add('sea',/caranguejo|serpente|leviat|crab|serpent/);add('treant',/treant/);add('mimic',/m[ií]mico|mimic/);add('knight',/cavaleiro|knight/);add('void',/umbral|vazio|sombrio|arconte|void|shadow/);add('celestial',/serafim|celeste|soberano|celestial|seraph/);add('fire',/brasa|magm|rubro|colosso|fire|ember|lava/);
    if(zone?.id)tags.push(zone.id);if(zone?.id==='forest')tags.push('forest');if(zone?.id==='coast')tags.push('sea','coast');if(zone?.id==='ember')tags.push('fire','ember');if(zone?.id==='crown')tags.push('celestial','crown');if(zone?.id==='void')tags.push('void');if(boss)tags.push('boss')
    return [...new Set(tags)]
  }

  choosePackMob(name,zone,boss=false){
    const entries=this.externalModels.packMobEntries||[];if(!entries.length)return null
    const wanted=this.mobSearchTags(name,zone,boss)
    let hash=0;const str=`${name}:${zone?.id||'dungeon'}:${boss}`
    for(let i=0;i<str.length;i++)hash=((hash<<5)-hash)+str.charCodeAt(i)|0
    const seed=Math.abs(hash),low=String(name||'').toLowerCase()
    let best=-Infinity,candidates=[]
    for(const e of entries){
      let score=0;const tags=e.tags||[]
      for(const m of e.match||[])if(low.includes(String(m).toLowerCase()))score+=32
      for(const t of wanted)if(tags.includes(t))score+=t==='boss'?7:4
      if(zone?.id&&tags.includes(zone.id))score+=5
      if(boss&&e.bossCandidate)score+=14;if(!boss&&e.bossCandidate)score-=3
      if(boss&&/(boss|giant|gigante|coloss|colosso|king|rei|lord|soberano)/i.test(`${e.name||''} ${e.url||''} ${(e.tags||[]).join(' ')}`))score+=18
      if(e.source==='PACK2')score+=.2
      if(score>best){best=score;candidates=[e]}else if(score===best)candidates.push(e)
    }
    return candidates[seed%Math.max(1,candidates.length)]||entries[seed%entries.length]
  }

  choosePackScenery(zone,cx,cz,i){
    const entries=(this.externalSceneryEntries||[]).filter(e=>!e.usage||e.usage==='world'||e.usage==='both');if(!entries.length)return null
    const preferred=zone?.id==='forest'?['forest','nature']:zone?.id==='coast'?['coast','nature','rock','road']:zone?.id==='highlands'?['highlands','rock','ruin','fortification']:zone?.id==='ember'?['ember','rock','ruin','fortification']:zone?.id==='void'?['void','ruin','fortification','rock']:zone?.id==='crown'?['crown','ruin','rock','fortification']:zone?.id==='aurora'?['aurora','meadow','nature','prop']:['meadow','nature','rock']
    let best=-1,candidates=[]
    for(const e of entries){
      let score=0;for(const t of preferred)if((e.tags||[]).includes(t)||e.kind===t)score+=3
      if(e.kind==='generic')score+=.2
      if(score>best){best=score;candidates=[e]}else if(score===best)candidates.push(e)
    }
    let hash=0;const str=`${zone?.id}:${cx}:${cz}:${i}`
    for(let j=0;j<str.length;j++)hash=((hash<<5)-hash)+str.charCodeAt(j)|0
    const seed=Math.abs(hash)
    return candidates[seed%Math.max(1,candidates.length)]||entries[seed%entries.length]
  }

  assetColliderRadius(root,fallback=1){
    try{const b=new THREE.Box3().setFromObject(root),s=new THREE.Vector3();b.getSize(s);return clamp(Math.max(s.x,s.z)*.42,.45,2.8)}catch{return fallback}
  }

  refreshChunksForPackVisuals(){
    if(this.state.dungeon||(!this.externalModels.packMobEntries.length&&!this.externalSceneryEntries.length))return
    const loadedKeys=new Set(this.chunks.keys());if(!loadedKeys.size)return
    for(const [key,c] of [...this.chunks]){if(!loadedKeys.has(key))continue;this.worldRoot.remove(c.group);this.chunks.delete(key)}
    this.enemies=this.enemies.filter(e=>{if(e.chunkKey&&loadedKeys.has(e.chunkKey)){e.g.parent?.remove(e.g);return false}return true})
    this.ensureChunks()
  }

  decorateCitiesWithPackAssets(){
    for(const d of this.packCityDecor||[])d.parent?.remove(d)
    this.packCityDecor=[]
    const entries=this.externalCitySceneryEntries||[];if(!entries.length)return
    const by=(pred)=>entries.filter(pred)
    const gates=by(e=>/port[aã]o|gate|porta/i.test(e.name||'')),towers=by(e=>/torre/i.test(e.name||'')),flags=by(e=>/bandeira|flag/i.test(e.name||''))
    const strHash=(str)=>{let h=0;for(let i=0;i<str.length;i++)h=((h<<5)-h)+str.charCodeAt(i)|0;return Math.abs(h)}
    const pick=(arr,seed)=>arr.length?arr[strHash(seed)%arr.length]:null
    for(const entry of this.cityGroups||[]){
      const {city,group}=entry,add=(asset,x,z,scale=1,rot=0)=>{if(!asset?.model)return;const c=this.assets.clone(asset.model);c.position.set(x,0,z);c.rotation.y+=rot;c.scale.multiplyScalar(scale);c.userData.packCityDecor=true;group.add(c);this.packCityDecor.push(c)}
      const gate=pick(gates,city.id),tower=pick(towers,`${city.id}:tower`),flag=pick(flags,`${city.id}:flag`)
      if(gate){
        add(gate,0,-city.wallRadius+1.2,0.9,0)
        add(gate,0,city.wallRadius-1.2,0.9,Math.PI)
      }
      if(tower){
        add(tower,-city.wallRadius+2,-city.wallRadius+2,0.85,Math.PI/4)
        add(tower,city.wallRadius-2,-city.wallRadius+2,0.85,-Math.PI/4)
        add(tower,-city.wallRadius+2,city.wallRadius-2,0.85,3*Math.PI/4)
        add(tower,city.wallRadius-2,city.wallRadius-2,0.85,-3*Math.PI/4)
      }
      if(flag){
        add(flag,-6,8,1,0)
        add(flag,6,8,1,0)
      }
    }
  }

  isHumanoidModel(m){
    if(!m)return false
    const name=String(m.name||'').toLowerCase()
    if(/tree|plant|rock|market|castle|kit|scenery|building|cactoro|monster|spider|slime|dragon|prop|nature|naturepack/i.test(name))return false
    let hasBones=false,hasHumanLimbs=false
    m.traverse?.(obj=>{
      if(obj.isBone||obj.isSkinnedMesh){
        hasBones=true
        const bName=String(obj.name||'').toLowerCase()
        if(/arm|hand|leg|foot|head|spine|hips|shoulder|neck/i.test(bName))hasHumanLimbs=true
      }
    })
    return hasBones && hasHumanLimbs
  }

  async loadExternalVisuals(){
    const entries=Object.entries(MODEL_MANIFEST)
    await Promise.all(entries.map(async ([key,url])=>{
      try{
        if(!url)return
        const m=await this.assets.load(url)
        if(!m)return
        if(key==='player'){
          if(this.isHumanoidModel(m)){
            this.assets.fit(m,2.1)
            m.position.y=0
            this.playerVisual.visible=false
            this.player.add(m)
            this.externalPlayer=m
            this.setupPlayerMixer(m)
          }else{
            console.warn('[Shadow Ascension] Modelo de player ignorado por nao ser humanoide valido. Mantendo avatar humano procedural.',m)
            this.playerVisual.visible=true
          }
        }else if(key==='mount'){
          this.assets.fit(m,2.1)
          this.externalModels.mount=m
          this.mountModel.clear()
          this.mountModel.add(m)
        }else{
          const heights={
            dragon:4.2, giant:3.4, yeti:3.1,
            golem:2.3, stone_golem:2.4, brute:2.3,
            skeleton:1.9, goblin:1.4, dark_knight:2.1, dwarf:1.5,
            ghost:1.8, ghost_skull:1.8,
            slime:0.95, big_arm:2.4, cactoro:2.1,
            wizard:2.1, king:2.15,
            bow:1.15, arrow:0.85, quiver:0.7,
            sword_1h:1.05, sword_2h:1.35, spellbook:0.55, dagger:0.65,
            shield:0.8, spear:1.6, wand:0.75,
            market:3.2, castle_kit:4.0, medieval_kit:3.5,
          }
          this.assets.fit(m,heights[key]||2.0)
          this.externalModels[key]=m
        }
      }catch(err){
        console.warn('AssetLibrary: error loading visual asset',key,err)
      }
    }))

    const pack=await this.readPacksManifest()
    if(pack){
      const mobEntries=(pack.mobs||[]).filter(x=>x?.url).slice(0,48),sceneryEntries=(pack.scenery||[]).filter(x=>x?.url).slice(0,80)
      const mobModels=await Promise.all(mobEntries.map(async e=>({entry:e,model:await this.assets.loadEntry(e)})))
      this.externalModels.packMobEntries=mobModels.filter(x=>x.model).map(({entry,model})=>({...entry,model:this.assets.fit(model,Number(entry.targetHeight)||1.85)}))
      this.externalModels.packMobs=this.externalModels.packMobEntries.map(x=>x.model)
      const sceneryModels=await Promise.all(sceneryEntries.map(async e=>({entry:e,model:await this.assets.loadEntry(e)})))
      const loadedScenery=sceneryModels.filter(x=>x.model).map(({entry,model})=>{
        const fallback=entry.kind==='building'||entry.kind==='fortification'?4.6:entry.kind==='nature'?3.2:entry.kind==='ruin'?3.6:2.6
        return {...entry,model:this.assets.fit(model,Number(entry.targetHeight)||fallback)}
      })
      this.externalSceneryEntries=loadedScenery.filter(e=>!e.usage||e.usage==='world'||e.usage==='both')
      this.externalCitySceneryEntries=loadedScenery.filter(e=>e.usage==='city'||e.usage==='both'||e.usage==='citySetpiece')
      this.externalScenery=loadedScenery.map(x=>x.model)
      console.info(`[Shadow Ascension] PACK/PACK2 reais: ${this.externalModels.packMobEntries.length} mobs + ${this.externalSceneryEntries.length} props de mundo + ${this.externalCitySceneryEntries.length} props de cidade. Player preservado.`)
      this.decorateCitiesWithPackAssets()
      this.refreshChunksForPackVisuals()
    }
    this.updateEquipmentVisuals()

    this.upgradeCityMarketStalls()
    this.upgradeSceneryVisuals()
    this.upgradeNpcVisuals()
  }

  upgradeCityMarketStalls(){
    if(!this.externalModels.market||!this.cityGroups)return
    for(const entry of this.cityGroups){
      entry.group.traverse(obj=>{
        if(obj.userData?.service==='merchant'&&!obj.userData.hasMarketMesh){
          obj.userData.hasMarketMesh=true
          const marketClone=this.assets.clone(this.externalModels.market)
          if(marketClone){
            marketClone.scale.setScalar(0.7)
            marketClone.position.set(0,0,-0.6)
            obj.add(marketClone)
          }
        }
      })
    }
  }

  upgradeSceneryVisuals(){
    // Nao adiciona kits inteiros compostos no centro das cidades para nao sobrepor ruas e jogadores
  }

  upgradeNpcVisuals(){
    if(!this.npcs)return
    for(const n of this.npcs){
      if(!n||!n.g||n.g.userData?.hasModel)continue
      let model=null
      if(n.def?.id==='crown-quest'||n.def?.name==='Astra'||n.def?.title?.includes('Oráculo')||n.def?.role==='quest'||n.def?.role==='oracle'){
        model=this.externalModels.wizard
      }else if(n.def?.id?.includes('king')||n.def?.title?.includes('Rei')||n.def?.title?.includes('Comandante')||n.def?.id==='aurora-guild'||n.def?.id==='eldoria-guild'){
        model=this.externalModels.king
      }else if(n.def?.role==='blacksmith'||n.def?.id==='brann'){
        model=this.externalModels.dwarf
      }
      if(model){
        const clone=this.assets.clone(model)
        if(clone){
          clone.position.y=0
          clone.scale.setScalar(0.95)
          n.g.add(clone)
          n.g.userData.hasModel=true
          if(n.body)n.body.visible=false
          if(n.head)n.head.visible=false
          if(n.hair)n.hair.visible=false
          if(clone.animations?.length){
            const mixer=new THREE.AnimationMixer(clone)
            const idle=clone.animations.find(c=>/idle/i.test(c.name))||clone.animations[0]
            if(idle)mixer.clipAction(idle).play()
            n.mixer=mixer
          }
        }
      }
    }
  }

  setupPlayerMixer(root){
    const clips=root.animations||[];if(!clips.length)return
    this.playerMixer=new THREE.AnimationMixer(root);this.playerActions={}
    for(const clip of clips){const n=clip.name.toLowerCase();let key=n.includes('spell')||n.includes('cast')||n.includes('special')?'special':n.includes('attack')||n.includes('slash')?'attack':n.includes('run')?'run':n.includes('walk')?'walk':n.includes('dash')||n.includes('roll')?'dash':n.includes('idle')?'idle':null;if(key&&!this.playerActions[key])this.playerActions[key]=this.playerMixer.clipAction(clip)}
    if(!this.playerActions.idle&&clips[0])this.playerActions.idle=this.playerMixer.clipAction(clips[0]);this.playerAnimState=null;this.playPlayerAction('idle')
  }
  playPlayerAction(state){
    if(!this.playerActions)return;const mapped=state==='special'?(this.playerActions.special?'special':'attack'):state==='attack'?'attack':state==='dash'?(this.playerActions.dash?'dash':'run'):state==='run'?'run':state==='walk'?'walk':'idle';const next=this.playerActions[mapped]||this.playerActions.idle;if(!next||this.playerAnimState===mapped)return
    const prev=this.playerActions[this.playerAnimState];prev?.fadeOut(.14);next.reset().fadeIn(.14).play();this.playerAnimState=mapped
  }

  bind(){
    this._unbind=[];const on=(t,n,f,o)=>{t.addEventListener(n,f,o);this._unbind.push([t,n,f,o])}
    on(window,'keydown',e=>{
      if(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable))return
      if(this.state.needsNickname)return
      if(['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ControlLeft'].includes(e.code))e.preventDefault()
      this.keys[e.code]=true
      if(e.repeat)return
      if(e.code==='KeyQ')this.toggleCombatMode()
      if(e.code==='Space')this.jump(); if(e.code==='ShiftLeft')this.dash(); if(e.code==='KeyE')this.interact(); if(e.code==='KeyF')this.castAbility(2); if(e.code==='KeyR')this.usePotion(); if(e.code==='KeyH')this.toggleMount()
      if(e.code==='Digit1')this.castAbility(1); if(e.code==='Digit2')this.castAbility(2); if(e.code==='Digit3')this.castAbility(3)
      if(e.code==='KeyI')this.togglePanel('inventory'); if(e.code==='KeyJ')this.togglePanel('quests'); if(e.code==='KeyG')this.togglePanel('grimoire'); if(e.code==='KeyU')this.togglePanel('guild'); if(e.code==='KeyK')this.togglePanel('attributes'); if(e.code==='KeyM')this.togglePanel('map'); if(e.code==='KeyO')this.togglePanel('settings'); if(e.code==='Escape'){if(this.isTouchDevice)this.closePanel();else if(this.combatMode)this.toggleCombatMode(false);else this.closePanel()}
    },{passive:false})
    on(window,'keyup',e=>{
      if(e.target&&(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA'||e.target.isContentEditable))return
      this.keys[e.code]=false
    })
    on(this.canvas,'pointerdown',e=>{
      if(this.state.needsNickname)return
      this.canvas.focus()
      if(e.pointerType==='touch'){this.lastTouch={x:e.clientX,y:e.clientY,id:e.pointerId};return}
      if(e.button===2&&!this.combatMode&&!this.state.uiPanel){
        this.freeLook=true;this.freeLookPointer=e.pointerId;this.freeLookLast={x:e.clientX,y:e.clientY};this.canvas.setPointerCapture?.(e.pointerId);e.preventDefault();return
      }
      if(!this.combatMode||this.state.uiPanel)return
      if(e.button===0)this.attack();if(e.button===2)this.setBlocking(true)
    })
    on(window,'pointerup',e=>{
      if(e.button===2){this.setBlocking(false);this.freeLook=false;this.freeLookPointer=null;this.freeLookLast=null}
      if(this.lastTouch?.id===e.pointerId)this.lastTouch=null
    })
    on(window,'pointermove',e=>{
      if(e.pointerType==='touch'&&this.lastTouch?.id===e.pointerId&&!this.state.uiPanel){const dx=e.clientX-this.lastTouch.x,dy=e.clientY-this.lastTouch.y;this.lastTouch={x:e.clientX,y:e.clientY,id:e.pointerId};this.rotateCamera(dx,dy);return}
      if(this.pointerLocked&&this.combatMode)this.rotateCamera(e.movementX,e.movementY)
      else if(this.freeLook&&!this.combatMode&&!this.state.uiPanel){const last=this.freeLookLast||{x:e.clientX,y:e.clientY},dx=e.clientX-last.x,dy=e.clientY-last.y;this.freeLookLast={x:e.clientX,y:e.clientY};this.rotateCamera(dx,dy)}
    })
    on(this.canvas,'wheel',e=>{this.cameraDistance=clamp(this.cameraDistance+e.deltaY*.008,4.8,12.5)},{passive:true})
    on(document,'pointerlockchange',()=>{this.pointerLocked=document.pointerLockElement===this.canvas;if(!this.isTouchDevice&&this.combatMode&&!this.pointerLocked&&document.visibilityState==='visible'){this.combatMode=false;this.state.combatMode=false}})
    on(this.canvas,'contextmenu',e=>e.preventDefault())
    on(window,'beforeunload',()=>{try{this.saveGame();this.saveCloudGame({force:true})}catch{}})
    on(document,'visibilitychange',()=>{if(document.visibilityState==='hidden'){this.saveGame();this.saveCloudGame({force:true})}else this.multiplayer?.ensureConnected?.()})
    on(window,'online',()=>this.multiplayer?.ensureConnected?.())
  }

  rotateCamera(dx=0,dy=0){
    const invertX = !!(this.settings?.invertCameraX ?? this.settings?.invertCamera)
    const invertY = !!(this.settings?.invertCameraY ?? false)
    const dirX = invertX ? -1 : 1
    const dirY = invertY ? -1 : 1
    this.yaw += dx * .00315 * dirX
    this.pitch = clamp(this.pitch + dy * .00245 * dirY, -.42, .72)
  }
  toggleCombatMode(force=null){
    this.freeLook=false;this.freeLookPointer=null;this.freeLookLast=null
    if(this.isTouchDevice){
      const gameplay=!this.state.uiPanel;this.combatMode=gameplay;this.state.combatMode=gameplay;this.pointerLocked=false
      if(document.pointerLockElement===this.canvas)document.exitPointerLock?.()
      return
    }
    const next=force==null?!this.combatMode:!!force;this.combatMode=next;this.state.combatMode=next
    if(next){
      this.closePanel();this.canvas.focus()
      this.yaw=this.player?.rotation?.y??this.yaw
      this.pitch=clamp(this.pitch,.02,.42)
      this.canvas.requestPointerLock?.()
      this.toast('Modo combate: mira travada • Q para liberar o cursor')
    }else{
      if(document.pointerLockElement===this.canvas)document.exitPointerLock?.()
      this.state.blocking=false;this.state.mobileRunning=false
      this.toast('Cursor livre: use menus e inventário • Q volta ao combate')
    }
  }
  setTouchDeviceMode(active){
    this.isTouchDevice=!!active
    if(this.isTouchDevice){
      const gameplay=!this.state.uiPanel
      this.combatMode=gameplay;this.state.combatMode=gameplay;this.pointerLocked=false;this.freeLook=false
      if(document.pointerLockElement===this.canvas)document.exitPointerLock?.()
    }
    this.resize?.()
  }
  setVirtualMove(x=0,z=0){this.virtualMove.x=clamp(Number(x)||0,-1,1);this.virtualMove.z=clamp(Number(z)||0,-1,1)}
  setMobileRun(active){this.state.mobileRunning=!!active;if(active)this.haptic(8)}
  setMobileJump(){this.haptic(8);this.jump()}
  jump(){if(this.state.uiPanel||this.state.mount.active||!this.grounded)return false;this.verticalVelocity=7.6;this.grounded=false;this.player.userData.motion='jump';return true}
  mobileAttack(){this.haptic(12);return this.attack(true)}
  setBlocking(active){this.state.blocking=!!active&&!this.state.uiPanel;if(this.state.blocking)this.haptic(7);return this.state.blocking}
  setMobileBlock(active){return this.setBlocking(active)}
  haptic(ms=10){try{navigator.vibrate?.(ms)}catch{}}

  resize(){
    const r=this.canvas.getBoundingClientRect();const w=Math.max(1,Math.floor(r.width)),h=Math.max(1,Math.floor(r.height))
    const short=Math.min(w,h),touchCap=this.isTouchDevice?(short<700?1.1:1.35):2
    this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setPixelRatio(Math.min(this.settings.pixelRatio,touchCap));this.renderer.setSize(w,h,false)
  }

  seedPortals(){
    const spots=[[92,45],[165,-52],[-122,95],[35,220],[230,180],[-245,-40],[80,-250],[-305,150],[310,-120]].map(([x,z])=>[x*WORLD.cityDistanceScale,z*WORLD.cityDistanceScale])
    spots.forEach((p,i)=>this.createPortal(p[0],p[1],i))
  }

  createPortal(x,z,i){
    const rarity=weightedPick(RARITIES,hash2(i,77));const zone=zoneAt(x,z,ZONES);const floors=Math.max(1,Math.round(rarity.floors[0]+hash2(i,91)*(rarity.floors[1]-rarity.floors[0])))
    const g=new THREE.Group();const col=new THREE.Color(rarity.color)
    const ring=mesh(new THREE.TorusGeometry(1.45,.16,10,30),new THREE.MeshStandardMaterial({color:col,emissive:col,emissiveIntensity:1.5,metalness:.45,roughness:.25}));ring.position.y=1.7;g.add(ring)
    const core=mesh(new THREE.CircleGeometry(1.2,32),new THREE.MeshBasicMaterial({color:0x0a0d18,transparent:true,opacity:.84,side:THREE.DoubleSide}));core.position.y=1.7;g.add(core)
    const sparks=[];for(let s=0;s<5;s++){const sp=mesh(new THREE.SphereGeometry(.05,6,6),new THREE.MeshBasicMaterial({color:col}));sp.userData.phase=s/5*Math.PI*2;g.add(sp);sparks.push(sp)}
    g.position.set(x,0,z);g.visible=false;this.worldRoot.add(g)
    this.portals.push({g,ring,core,sparks,x,z,zone,rarity,floors,level:Math.max(zone.min,Math.round((zone.min+zone.max)/2)),name:PORTAL_NAMES[i%PORTAL_NAMES.length]})
  }

  zoneForChunk(cx,cz){return zoneAt(cx*WORLD.chunkSize,cz*WORLD.chunkSize,ZONES)}
  ensureChunks(){
    const requestedRd=this.settings.renderDistance,rd=this.isTouchDevice?Math.min(requestedRd,Math.min(window.innerWidth,window.innerHeight)<700?2:3):requestedRd,pcx=Math.floor(this.player.position.x/WORLD.chunkSize),pcz=Math.floor(this.player.position.z/WORLD.chunkSize),need=new Set()
    for(let dx=-rd;dx<=rd;dx++)for(let dz=-rd;dz<=rd;dz++){const cx=pcx+dx,cz=pcz+dz,k=`${cx},${cz}`;need.add(k);if(!this.chunks.has(k))this.buildChunk(cx,cz,k)}
    for(const [k,c] of [...this.chunks])if(!need.has(k)){
      this.worldRoot.remove(c.group);
      c.group.traverse(o=>{o.geometry?.dispose?.();if(o.material&&!Array.isArray(o.material))o.material.dispose?.()});
      this.chunks.delete(k);
      this.enemies=this.enemies.filter(e=>{if(e.chunkKey===k){this.worldRoot.remove(e.g);return false}return true})
      this.resourceNodes=this.resourceNodes.filter(rn=>{if(rn.chunkKey===k){if(rn.durabilitySprite)this.scene.remove(rn.durabilitySprite);return false}return true})
    }
  }

  buildChunk(cx,cz,key){
    const size=WORLD.chunkSize,zone=this.zoneForChunk(cx,cz),group=new THREE.Group();group.position.set(cx*size,0,cz*size);group.userData.chunkKey=key
    const ground=mesh(new THREE.PlaneGeometry(size,size,8,8),mat(zone.ground));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;group.add(ground)
    const waterChance=hash2(cx,cz)
    const midX=cx*size,midZ=cz*size
    const hasWater=(zone.id==='coast'||waterChance>.91)&&!this.isOnRoad(midX,midZ,size*0.62)&&!this.isInsideCitySafeZone(midX,midZ,34)
    if(hasWater){
      const water=mesh(new THREE.PlaneGeometry(size*.86,size*.42,12,8),new THREE.MeshStandardMaterial({color:0x1e88e5,transparent:true,opacity:.82,roughness:.15,metalness:.05,depthWrite:false}));water.rotation.x=-Math.PI/2;water.position.y=.12;water.userData.water=true;group.add(water)
    }
    const decorCount=(zone.id==='void'?4:6+Math.floor(hash2(cx+11,cz+5)*8))*WORLD.detailDensity,colliders=[]
    for(let i=0;i<decorCount;i++){
      const rx=(hash2(cx*19+i,cz*31)-.5)*size*.88,rz=(hash2(cx*7,cz*13+i)-.5)*size*.88,gx=cx*size+rx,gz=cz*size+rz
      if(this.isInsideCitySafeZone(gx,gz,42)||this.isOnRoad(gx,gz,7.5))continue
      const rr=hash2(i,cx+cz)
      const isOreZone=zone.id==='ember'||zone.id==='crown'||zone.id==='highlands'||rr>.62
      if(isOreZone){
        const isIron=zone.id==='highlands'||zone.id==='crown'||hash2(gx*7,gz*13)>.5
        const oreMesh=this.makeOreVein(rx,rz,isIron,rr)
        group.add(oreMesh)
        const col={x:gx,z:gz,r:.85+rr*.6,type:'ore',active:true}
        colliders.push(col)
        this.resourceNodes.push({
          id:`res:${Math.round(gx)}:${Math.round(gz)}`,
          type:isIron?'ore_iron':'ore_coal',
          name:isIron?'Veio de Minério de Ferro':'Veio de Carvão Mineral',
          icon:isIron?'⚙️':'⚫',
          dropKind:isIron?'iron':'coal',
          gx,gz,
          hp:isIron?90:70,
          maxHp:isIron?90:70,
          mesh:oreMesh,
          collider:col,
          chunkKey:key,
          respawnAt:0,
          lastHit:0
        })
      }else{
        const tree=this.makeTree(rr,zone);tree.position.set(rx,0,rz);group.add(tree)
        const col={x:gx,z:gz,r:.72,type:'tree',active:true}
        colliders.push(col)
        this.resourceNodes.push({
          id:`res:${Math.round(gx)}:${Math.round(gz)}`,
          type:'tree',
          name:zone.id==='forest'?'Carvalho Ancestral':'Carvalho Silvestre',
          icon:'🪵',
          dropKind:'wood',
          gx,gz,
          hp:zone.id==='forest'?80:60,
          maxHp:zone.id==='forest'?80:60,
          mesh:tree,
          collider:col,
          chunkKey:key,
          respawnAt:0,
          lastHit:0
        })
      }
    }
    this.worldRoot.add(group);this.chunks.set(key,{group,zone,cx,cz,key,hasWater,colliders});this.spawnChunkMobs(cx,cz,zone,key)
  }

  makeTree(r,zone){
    const g=new THREE.Group(),trunk=mesh(new THREE.CylinderGeometry(.22,.40,2.6,6),mat(zone.id==='forest'?0x4d3528:0x6b4423));trunk.position.y=1.3;g.add(trunk)
    const col=zone.id==='forest'?(r>.5?0x355f45:0x294d38):(r>.5?0x4c8a4f:0x3f7b45);const crown=mesh(new THREE.IcosahedronGeometry(1.2+r*.65,1),mat(col,{flatShading:true}));crown.position.y=2.95;g.add(crown)
    if(zone.id==='forest'){const c2=crown.clone();c2.scale.set(.7,.7,.7);c2.position.set(.75,3.35,.25);g.add(c2)}
    return g
  }

  makeOreVein(x,z,isIron,r){
    const g=new THREE.Group()
    const baseMat=mat(isIron?0x525862:0x282a30,{roughness:.85,metalness:.2})
    const rock=mesh(new THREE.DodecahedronGeometry(.7+r*1.0,1),baseMat)
    rock.scale.y=.7+r*.4
    rock.position.y=.4+r*.2
    g.add(rock)
    const oreMat=isIron
      ? new THREE.MeshStandardMaterial({color:0xd4af37,roughness:.3,metalness:.9,emissive:0x4a3b10,emissiveIntensity:.35})
      : new THREE.MeshStandardMaterial({color:0x181920,roughness:.35,metalness:.2,emissive:0x2a2b34,emissiveIntensity:.4})
    for(let i=0;i<4;i++){
      const a=i*Math.PI*.5+r,rr=.46+r*.35
      const gem=mesh(new THREE.OctahedronGeometry(.20+i*.03),oreMat)
      gem.position.set(Math.cos(a)*rr,.4+(i%2)*.22,Math.sin(a)*rr)
      gem.rotation.set(r*i,i*.8,r)
      g.add(gem)
    }
    g.position.set(x,0,z)
    return g
  }

  makeRock(x,z,zone,r){const rock=mesh(new THREE.DodecahedronGeometry(.65+r*1.3,0),mat(zone.id==='ember'?0x5f3c32:zone.id==='crown'?0x8191a5:0x5e665e,{flatShading:true}));rock.position.set(x,.45+r*.3,z);rock.scale.y=.65+r*.55;return rock}

  spawnChunkMobs(cx,cz,zone,chunkKey){
    const size=WORLD.chunkSize,n=3+Math.floor(hash2(cx+70,cz+90)*3)
    for(let i=0;i<n;i++){
      const x=cx*size+(hash2(cx,i+12)-.5)*size*.72,z=cz*size+(hash2(cz,i+44)-.5)*size*.72,netId=`${chunkKey}:mob:${i}`
      if(this.isInsideCitySafeZone(x,z,zone.id==='aurora'?12:9))continue
      if((this.respawnLocks.get(netId)||0)>Date.now())continue
      const lvl=Math.round(zone.min+hash2(i+cx,cz)*(zone.max-zone.min));this.enemies.push(this.makeEnemy(x,z,lvl,zone.mobs[i%zone.mobs.length],false,zone,chunkKey,netId))
    }
    const bx=zone.x0+(zone.x1-zone.x0)*.78,bz=zone.z0+(zone.z1-zone.z0)*.72,bossCx=Math.floor(bx/size),bossCz=Math.floor(bz/size),bossId=`${chunkKey}:boss`
    if(cx===bossCx&&cz===bossCz&&!this.isInsideCitySafeZone(bx,bz,12)&&(this.respawnLocks.get(bossId)||0)<=Date.now()){
      if(!this.enemies.some(e=>!e.dead&&e.boss&&e.zoneId===zone.id))this.enemies.push(this.makeEnemy(bx,bz,zone.max+5,zone.boss,true,zone,chunkKey,bossId))
    }
  }

  makeMobLabel(enemy,scale=1){
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=82;const texture=new THREE.CanvasTexture(canvas);texture.minFilter=THREE.LinearFilter
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));sprite.position.set(0,2.65*scale,0);sprite.scale.set(3.8*scale,.98*scale,1);sprite.renderOrder=20
    const label={canvas,texture,sprite,lastHp:-1,lastLevel:-1};enemy.label=label;this.updateMobLabel(enemy);return sprite
  }
  updateMobLabel(e){
    const l=e.label;if(!l)return;const ctx=l.canvas.getContext('2d'),pct=Math.max(0,Math.min(1,e.hp/e.maxHp));ctx.clearRect(0,0,320,82)
    ctx.fillStyle='rgba(3,8,14,.88)';ctx.roundRect(4,4,312,72,12);ctx.fill()
    const rank = e.level >= 10 ? (1 + Math.floor((e.level - 10) / 20)) : 0
    const rankRom = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][rank] || (rank ? `★${rank}` : '')
    const rankTag = rankRom ? ` [Rank ${rankRom}]` : ''
    ctx.strokeStyle=e.boss?'#d78cff':(rank>0?'#38bdf8':'rgba(180,220,245,.42)');ctx.lineWidth=2;ctx.stroke()
    ctx.font='700 22px Inter,Arial';ctx.fillStyle=e.boss?'#d78cff':(rank>0?'#38bdf8':'#fff');ctx.textAlign='center';ctx.fillText(`${e.boss?'★ ':''}${e.name}${rankTag}  •  Lv.${e.level}`,160,31)
    ctx.fillStyle='#141b24';ctx.fillRect(22,43,276,18);ctx.fillStyle=e.boss?'#b746e0':'#e54d5d';ctx.fillRect(22,43,276*pct,18);ctx.strokeStyle='rgba(255,255,255,.5)';ctx.strokeRect(22,43,276,18)
    ctx.font='700 13px Inter,Arial';ctx.fillStyle='#fff';ctx.fillText(`${Math.max(0,Math.ceil(e.hp))} / ${Math.ceil(e.maxHp)}`,160,57);l.texture.needsUpdate=true;l.lastHp=e.hp;l.lastLevel=e.level
  }

  makeEnemy(x,z,level,name,boss,zone,chunkKey=null,netId=null){
    const g=new THREE.Group();const scale=boss?1.55:1;const bodyColor=boss?0x7c3aed:(zone?.id==='ember'?0xc04e34:zone?.id==='forest'?0x5f7040:zone?.id==='coast'?0x3487a6:0xb84f56)
    const body=mesh(new THREE.CapsuleGeometry(.42*scale,.62*scale,4,8),mat(bodyColor,{emissive:boss?0x25004f:0x190304,emissiveIntensity:.32}));const baseBodyY=.82*scale;body.position.y=baseBodyY;g.add(body)
    const head=mesh(new THREE.DodecahedronGeometry(.34*scale,0),mat(bodyColor,{flatShading:true}));head.position.y=1.62*scale;g.add(head)
    const leg1=new THREE.Group(),leg2=new THREE.Group();leg1.position.set(-.24*scale,.45,0);leg2.position.set(.24*scale,.45,0);const lg=new THREE.CapsuleGeometry(.1*scale,.42*scale,3,6);const lm=mat(0x332b31);const l1=mesh(lg,lm),l2=mesh(lg,lm);l1.position.y=-.35;l2.position.y=-.35;leg1.add(l1);leg2.add(l2);g.add(leg1,leg2)
    if(boss){for(const sx of [-.36,.36]){const horn=mesh(new THREE.ConeGeometry(.12*scale,.65*scale,6),mat(0xe9ddff));horn.position.set(sx*scale,2.0*scale,0);horn.rotation.z=sx>0?-.35:.35;g.add(horn)}}
    
    const keyName=name.toLowerCase()
    let ext=null
    if(keyName.includes('slime')){
      ext=this.externalModels.slime
    }else if(keyName.includes('dragão')||keyName.includes('dragon')||(boss&&zone?.id==='crown')){
      ext=this.externalModels.dragon
    }else if(keyName.includes('soberano')||keyName.includes('rei')){
      ext=this.externalModels.king||this.externalModels.dragon
    }else if(keyName.includes('mago')||keyName.includes('arcano')||keyName.includes('oráculo')){
      ext=this.externalModels.wizard
    }else if(keyName.includes('yeti')||(boss&&zone?.id==='coast')){
      ext=this.externalModels.yeti||this.externalModels.giant
    }else if(keyName.includes('gigante')||(boss&&(zone?.id==='highlands'||zone?.id==='ember'))){
      ext=this.externalModels.giant||this.externalModels.brute
    }else if(keyName.includes('golem')||keyName.includes('xisto')){
      ext=this.externalModels.golem||this.externalModels.stone_golem
    }else if(keyName.includes('esqueleto')||keyName.includes('cinzento')){
      ext=this.externalModels.skeleton
    }else if(keyName.includes('cavaleiro')||keyName.includes('oco')||keyName.includes('sentinela')||keyName.includes('arconte')){
      ext=this.externalModels.dark_knight
    }else if(keyName.includes('espectro')||keyName.includes('fantasma')||keyName.includes('vazio')||(zone?.id==='void'&&!boss)){
      ext=this.externalModels.ghost||this.externalModels.ghost_skull
    }else if(keyName.includes('espinho')||keyName.includes('cactoro')){
      ext=this.externalModels.cactoro||this.externalModels.goblin
    }else if(keyName.includes('braço')||keyName.includes('fera')||keyName.includes('colosso')){
      ext=this.externalModels.big_arm||this.externalModels.brute
    }else if(keyName.includes('anão')||keyName.includes('bode')){
      ext=this.externalModels.dwarf
    }else if(keyName.includes('bruto')){
      ext=this.externalModels.brute
    }else if(keyName.includes('goblin')||keyName.includes('javali')){
      ext=this.externalModels.goblin
    }else if(boss){
      ext=this.externalModels.giant||this.externalModels.king||this.externalModels.dragon
    }else if(zone?.id==='forest'){
      ext=this.externalModels.skeleton||this.externalModels.goblin
    }else if(zone?.id==='ember'){
      ext=this.externalModels.cactoro||this.externalModels.brute||this.externalModels.dark_knight
    }else if(zone?.id==='highlands'){
      ext=this.externalModels.golem||this.externalModels.dwarf
    }else{
      ext=this.externalModels.goblin||this.externalModels.slime||this.externalModels.skeleton
    }

    let packMob=null
    if(!ext&&this.externalModels.packMobEntries?.length){
      packMob=this.choosePackMob(name,zone,boss)
      if(packMob?.model)ext=packMob.model
    }


    let mixer=null,customMesh=null
    if(ext){
      const clone=this.assets.clone(ext)
      if(clone){
        clone.position.set(0,0,0)
        let hasMesh=false
        clone.traverse(o=>{
          if(o.isMesh||o.isSkinnedMesh){
            hasMesh=true
            o.castShadow=true
            o.receiveShadow=true
            if(o.material){
              if(Array.isArray(o.material))for(const m of o.material){if(m)m.needsUpdate=true}
              else o.material.needsUpdate=true
            }
          }
        })
        if(hasMesh){
          const meshScale=boss?1.35:(scale||1.0)
          clone.scale.multiplyScalar(meshScale)
          g.add(clone)
          customMesh=clone
          body.visible=false;head.visible=false;leg1.visible=false;leg2.visible=false
          if(clone.animations?.length){
            mixer=new THREE.AnimationMixer(clone)
            const clip=clone.animations.find(c=>/walk|run|move/i.test(c.name))||clone.animations.find(c=>/idle/i.test(c.name))||clone.animations[0]
            if(clip)mixer.clipAction(clip).play()
          }
        }
      }
    }

    if(!customMesh){
      // Styled procedural fallback
      if(keyName.includes('slime')){
        body.material=new THREE.MeshStandardMaterial({color:0x34d399,roughness:.25,metalness:.05,transparent:true,opacity:.88,emissive:0x059669,emissiveIntensity:.25})
        body.scale.set(1.15,.82,1.15)
        leg1.visible=false;leg2.visible=false
        head.position.y=1.1*scale;head.scale.set(.45,.45,.45)
      }else if(keyName.includes('esqueleto')||keyName.includes('cinzento')){
        body.material=mat(0xede9fe,{roughness:.9})
        head.material=mat(0xf8fafc,{roughness:.95})
      }else if(keyName.includes('goblin')||keyName.includes('javali')){
        body.material=mat(0x4d7c0f,{roughness:.75})
        head.material=mat(0x65a30d,{roughness:.75})
      }else if(keyName.includes('golem')||keyName.includes('xisto')){
        body.material=mat(0x475569,{roughness:.95,metalness:.2})
        body.scale.set(1.25,1,1.25)
      }
    }

    const progression=resolveEntityProgression(name,level,{dungeon:!!this.state.dungeon});level=progression.level
    g.position.set(x,0,z);(this.state.dungeon?this.dungeonArena:this.worldRoot).add(g);const maxHp=(boss?460:112)+level*(boss?32:16)
    const enemy={
      g,body,head,legs:[leg1,leg2],level,name,boss,zoneId:zone?.id||'dungeon',
      hp:maxHp,maxHp,atk:(boss?18:12)+level*(boss?2.6:1.9),def:Math.round((boss?7:3)+level*(boss?.42:.28)),last:0,dead:false,chunkKey,
      netId:netId||`enemy:${Math.round(x)}:${Math.round(z)}:${level}:${name}`,
      phase:Math.random()*6.28,baseBodyY,mixer,customMesh,attackAnim:0,
      specialTimer:boss?(2.8+Math.random()*2):(3.8+Math.random()*3),
      specialCooldown:boss?5.5:Math.max(4.2,8.2-Math.min(4,level*0.04))
    }
    g.add(this.makeMobLabel(enemy,scale));return enemy
  }


  spawnAdventurerBots(){
    for(const bot of this.bots||[])bot.g?.parent?.remove(bot.g)
    this.bots=[]
    ADVENTURER_BOTS.forEach((def,i)=>{const bot=this.makeAdventurerBot(def,i);if(bot)this.bots.push(bot)})
  }

  makeAdventurerBot(def,index=0){
    const city=CITIES.find(c=>c.id===def.cityId);if(!city)return null
    const g=new THREE.Group();g.name=`AI-${def.name}`
    const rankHex=rankColor(def.rank),cloth=mat(rankHex,{roughness:.68}),skin=mat(0xe1ad86),dark=mat(0x202938),metal=mat(0xd6dee8,{metalness:.55,roughness:.3})
    const body=mesh(new THREE.CapsuleGeometry(.32,.68,4,8),cloth);body.position.y=1.02;g.add(body)
    const head=mesh(new THREE.SphereGeometry(.255,12,9),skin);head.position.y=1.78;g.add(head)
    const sword=mesh(new THREE.BoxGeometry(.07,.82,.045),metal);sword.position.set(.42,1.05,.12);sword.rotation.z=-.18;g.add(sword)
    const a=(index%4)*Math.PI/2,rr=city.wallRadius+9+(index%3)*3,home={x:city.x+Math.cos(a)*rr,z:city.z+Math.sin(a)*rr}
    g.position.set(home.x,0,home.z);this.worldRoot.add(g)
    const level=Math.max(1,def.level|0),maxHp=105+level*8.5,maxStamina=Math.round(100+level*2),rarity=level>=240?'Lendária':level>=150?'Épica':level>=70?'Rara':level>=20?'Incomum':'Comum'
    const bot={adventurer:true,id:def.id,netId:def.id,name:def.name,level,guildRank:def.rank||'E',temperament:def.temperament||'balanced',cityId:def.cityId,zoneId:city.zoneId,g,body,head,sword,hp:maxHp,maxHp,stamina:maxStamina,maxStamina,atk:12+level*1.72,def:4+level*.58,xp:0,nextXp:Math.round(120*Math.pow(level,1.38)),gold:70+level*5,lootItem:makeItem(index%2?'armor':'weapon',level,rarity,`${index%2?'Armadura':'Lâmina'} de ${def.name}`),dead:false,hostileToPlayer:false,lastAttack:0,respawnAt:0,home,patrol:null,target:null,phase:index*1.71}
    const label=this.makePlayerNameplate({name:`${def.name} [IA]`,level,hp:maxHp,maxHp,guildRank:bot.guildRank},false);label.position.y=2.58;g.add(label);bot.label=label
    return bot
  }

  botGainXp(bot,amount){
    if(!bot||bot.dead)return
    bot.xp+=Math.max(0,Math.round(amount||0))
    while(bot.xp>=bot.nextXp&&bot.level<300){
      bot.xp-=bot.nextXp;bot.level++;
      bot.nextXp=Math.round(120*Math.pow(bot.level,1.38));
      bot.maxHp+=8;bot.hp=bot.maxHp;
      bot.maxStamina=Math.round(100+bot.level*2);bot.stamina=bot.maxStamina;
      bot.atk+=2;bot.def+=.6
      const rank=[...GUILD_RANKS].reverse().find(r=>bot.level>=r.minLevel);if(rank)bot.guildRank=rank.id
    }
    this.updatePlayerNameplate(bot.label,{name:`${bot.name} [IA]`,level:bot.level,hp:bot.hp,maxHp:bot.maxHp,guildRank:bot.guildRank},false)
  }

  updateBots(dt,t){
    if(this.state.dungeon){for(const bot of this.bots)bot.g.visible=false;return}
    const now=performance.now()
    for(const bot of this.bots){
      if(bot.dead){
        if(now>=bot.respawnAt){
          bot.dead=false;bot.hostileToPlayer=false;
          bot.hp=bot.maxHp;
          bot.stamina=bot.maxStamina;
          bot.g.position.set(bot.home.x,0,bot.home.z);
          bot.g.visible=true;
          this.updatePlayerNameplate(bot.label,{name:`${bot.name} [IA]`,level:bot.level,hp:bot.hp,maxHp:bot.maxHp,guildRank:bot.guildRank},false)
        }
        continue
      }

      // Recuperação de vigor (stamina)
      bot.maxStamina = bot.maxStamina || Math.round(100 + bot.level * 2)
      bot.stamina = Math.min(bot.maxStamina, (bot.stamina !== undefined ? bot.stamina : bot.maxStamina) + 16 * dt)

      // Regeneração de HP quando o vigor estiver em 100%
      if(bot.stamina >= bot.maxStamina - 0.5 && bot.hp < bot.maxHp){
        bot.hp = Math.min(bot.maxHp, bot.hp + Math.max(3.5, bot.maxHp * 0.045) * dt)
      }

      const distanceToPlayer=bot.g.position.distanceTo(this.player.position)
      bot.g.visible=distanceToPlayer<WORLD.mobDistance*2.2

      let target=null,targetIsPlayer=false
      if(bot.hostileToPlayer&&distanceToPlayer<22){target=this.player;targetIsPlayer=true}
      else{
        let bd=28
        for(const mob of this.enemies){
          if(mob.dead||!mob.g.visible)continue
          const d=mob.g.position.distanceTo(bot.g.position)
          if(d<bd){target=mob;bd=d}
        }
      }

      if(!target){
        // Bot anda pelo mundo aberto em busca de aventuras e exploração
        if(!bot.patrol || Math.hypot(bot.g.position.x-bot.patrol.x, bot.g.position.z-bot.patrol.z) < 2.0){
          const roamAngle = Math.random() * Math.PI * 2
          const roamDist = 38 + Math.random() * 110
          let px = bot.g.position.x + Math.cos(roamAngle) * roamDist
          let pz = bot.g.position.z + Math.sin(roamAngle) * roamDist
          px = Math.max(-500, Math.min(500, px))
          pz = Math.max(-500, Math.min(500, pz))
          bot.patrol = { x: px, z: pz }
        }

        const dx=bot.patrol.x-bot.g.position.x, dz=bot.patrol.z-bot.g.position.z, d=Math.hypot(dx,dz)
        if(d>1){
          const nx=dx/d, nz=dz/d
          const speed = (2.4 + Math.min(2.2, bot.level/110)) * dt
          const px=bot.g.position.x+nx*speed, pz=bot.g.position.z+nz*speed
          if(this.canOccupy(px,pz,.48)){
            bot.g.position.x=px
            bot.g.position.z=pz
            bot.g.rotation.y=Math.atan2(nx,nz)
            bot.phase = (bot.phase || 0) + dt * 6.5
            if(bot.sword) bot.sword.rotation.z = -0.18 + Math.sin(bot.phase) * 0.18
            if(bot.body) bot.body.position.y = 1.02 + Math.abs(Math.sin(bot.phase)) * 0.06
          } else {
            bot.patrol = null
          }
        }
      }else{
        const targetPos=targetIsPlayer?this.player.position:target.g.position
        const dx=targetPos.x-bot.g.position.x, dz=targetPos.z-bot.g.position.z
        const d=Math.hypot(dx,dz), nx=d?dx/d:0, nz=d?dz/d:0
        bot.g.rotation.y=Math.atan2(nx,nz)
        if(d>2.2){
          const step=(bot.temperament==='aggressive'?4.6:3.8)*dt
          const px=bot.g.position.x+nx*step, pz=bot.g.position.z+nz*step
          if(this.canOccupy(px,pz,.48)){bot.g.position.x=px;bot.g.position.z=pz}
        }else if(now-bot.lastAttack>780){
          // Ataque do bot gasta vigor (energia)
          const botAttackCost = 14
          if(bot.stamina >= botAttackCost){
            bot.stamina -= botAttackCost
            bot.lastAttack=now
            bot.body.rotation.x=-.32
            if(bot.sword) bot.sword.rotation.x = 0.6
            setTimeout(()=>{
              if(!bot.dead){
                bot.body.rotation.x=0
                if(bot.sword) bot.sword.rotation.x = 0
              }
            },130)
            const dmg=Math.max(3,Math.round(bot.atk*(.82+Math.random()*.38)))
            if(targetIsPlayer){
              if(this.invuln<=0){
                this.damagePlayer(Math.max(1,Math.round(dmg-this.state.def*.42)))
              }
            }else{
              target.hp-=dmg
              this.spawnDamageText(target.g.position,dmg,false)
              this.flashEnemy(target,false)
              this.updateMobLabel(target)
              if(target.hp<=0)this.killByBot(target,bot)
            }
          }
        }
      }
      if(bot.g.visible){
        this.updatePlayerNameplate(bot.label,{name:`${bot.name} [IA]`,level:bot.level,hp:Math.round(bot.hp),maxHp:bot.maxHp,guildRank:bot.guildRank},false)
      }
    }
  }

  enterCombat(seconds=8){
    this.combatCooldown=Math.max(this.combatCooldown||0,seconds)
    this.inCombat=true
    this.state.inCombat=true
    this.state.combatTimer=Math.ceil(this.combatCooldown)
  }

  damagePlayer(amount){
    const incoming=Math.max(1,Math.round(amount)),blockCost=8
    const blocked=!!this.state.blocking&&this.state.stamina>=blockCost
    if(blocked)this.state.stamina=Math.max(0,this.state.stamina-blockCost)
    const barrier=performance.now()<(this.classBarrierUntil||0)
    const dealt=barrier?Math.max(1,Math.round(incoming*.2)):blocked?Math.max(1,Math.round(incoming*.45)):incoming
    if(this.state.blocking&&!blocked&&(!this._lastBlockWarn||performance.now()-this._lastBlockWarn>1200)){
      this._lastBlockWarn=performance.now();this.toast('⚡ Sem vigor para defender!')
    }
    this.state.hp=Math.max(0,this.state.hp-dealt)
    this.enterCombat(8)
    return dealt
  }

  damageBot(bot,amount,{crit=false}={}){
    if(!bot||bot.dead)return false;this.enterCombat(8);const dealt=Math.max(1,Math.round(amount));bot.hp-=dealt;bot.hostileToPlayer=true;this.state.target={name:`${bot.name} [IA]`,level:bot.level,hp:Math.max(0,bot.hp),maxHp:bot.maxHp,boss:false,adventurer:true,crit};this.spawnDamageText(bot.g.position,dealt,crit);this.updatePlayerNameplate(bot.label,{name:`${bot.name} [IA]`,level:bot.level,hp:bot.hp,maxHp:bot.maxHp,guildRank:bot.guildRank},false);if(bot.hp<=0)this.killBot(bot);return true
  }

  killBot(bot,{byPlayer=true}={}){
    if(bot.dead)return;bot.dead=true;bot.g.visible=false;bot.respawnAt=performance.now()+RESPAWN_RULES.adventurerMs;if(this.state.target?.adventurer&&this.state.target?.name?.startsWith(bot.name))this.state.target=null
    if(byPlayer){const xp=Math.max(18,Math.round(bot.level*7.5));this.awardCombatXp(xp);if(Math.random()<.38&&bot.lootItem){const drop={...bot.lootItem,zoneId:bot.zoneId,id:`botdrop-${Date.now()}-${Math.random()}`};if(this.addInventoryItem(drop))this.toast(`${bot.name} deixou cair ${drop.name}`)}else this.toast(`${bot.name} foi derrotado. Ele retornará depois.`)}
  }

  killByBot(enemy,bot){
    if(!enemy||enemy.dead)return;enemy.dead=true;enemy.g.parent?.remove(enemy.g);const respawnAt=this.scheduleEnemyRespawn(enemy);if(enemy.netId)this.multiplayer?.send({type:'enemy_dead',netId:enemy.netId,world:this.currentWorldId(),respawnAt});const progression=resolveEntityProgression(enemy.name,enemy.level,{dungeon:false}),xp=calculateKillXP(bot.level||1,progression.level,{boss:enemy.boss,fixedXP:progression.fixedXP,disableLevelScaling:progression.disableLevelScaling});if(!bot.isGuard){this.botGainXp(bot,xp);bot.gold=(bot.gold||0)+Math.round(6+enemy.level*1.3)}this.enemies=this.enemies.filter(e=>e!==enemy)
  }

  spawnCityGuards(){
    for(const g of this.guards||[])g.g?.parent?.remove(g.g)
    this.guards=[]
    CITY_GUARDS_CONFIG.forEach((def,i)=>{
      const guard=this.makeCityGuard(def,i)
      if(guard)this.guards.push(guard)
    })
  }

  makeCityGuard(def,index=0){
    const city=CITIES.find(c=>c.id===def.cityId);if(!city)return null
    const g=new THREE.Group();g.name=`Guard-${def.name}`
    const armorMat=mat(0xa8b8c8,{metalness:.75,roughness:.25}),goldMat=mat(0xeab308,{metalness:.8,roughness:.3}),skin=mat(0xe1ad86)
    const body=mesh(new THREE.CapsuleGeometry(.36,.72,4,8),armorMat);body.position.y=1.04;g.add(body)
    const chestPlate=mesh(new THREE.BoxGeometry(.52,.5,.35),goldMat);chestPlate.position.y=1.08;g.add(chestPlate)
    const head=mesh(new THREE.SphereGeometry(.26,12,9),skin);head.position.y=1.82;g.add(head)
    const helmet=mesh(new THREE.ConeGeometry(.28,.35,8),armorMat);helmet.position.y=2.02;g.add(helmet)
    const shield=mesh(new THREE.BoxGeometry(.1,.62,.42),goldMat);shield.position.set(-.46,1.05,.12);g.add(shield)
    const spear=mesh(new THREE.CylinderGeometry(.025,.025,1.75,6),armorMat);spear.position.set(.44,1.18,.08);spear.rotation.x=.15;g.add(spear)
    const wallR = (city.wallRadius || 24) + 1.2
    const homeX=city.x+Math.cos(def.angle)*wallR,homeZ=city.z+Math.sin(def.angle)*wallR
    g.position.set(homeX,0,homeZ);this.worldRoot.add(g)
    const level=def.level||30,maxHp=450+level*20
    const guard={
      isGuard:true,id:def.id,name:def.name,cityId:def.cityId,level,g,body,spear,shield,city,
      hp:maxHp,maxHp,atk:32+level*3.0,def:24+level*1.5,home:{x:homeX,z:homeZ},
      target:null,lastAttack:0,patrolAngle:def.angle,patrolSpeed:0.24+(index%2)*0.08,respawnAt:0,dead:false,phase:index*1.5
    }
    const label=this.makePlayerNameplate({name:`[DEFESA] ${def.name}`,level,hp:maxHp,maxHp,guildRank:'SSS'},false)
    label.position.y=2.68;g.add(label);guard.label=label
    return guard
  }

  updateCityGuards(dt,t){
    if(this.state.dungeon){for(const g of this.guards)g.g.visible=false;return}
    const now=performance.now()
    for(const guard of this.guards){
      if(guard.dead){
        if(now>=guard.respawnAt){
          guard.dead=false;guard.hp=guard.maxHp;guard.g.position.set(guard.home.x,0,guard.home.z);guard.g.visible=true;
          this.updatePlayerNameplate(guard.label,{name:`[DEFESA] ${guard.name}`,level:guard.level,hp:guard.hp,maxHp:guard.maxHp,guildRank:'SSS'},false)
        }
        continue
      }
      const distToPlayer=guard.g.position.distanceTo(this.player.position)
      guard.g.visible=distToPlayer<WORLD.mobDistance*2.0
      if(!guard.g.visible)continue

      if(guard.hp<guard.maxHp){
        guard.hp=Math.min(guard.maxHp,guard.hp+guard.maxHp*0.06*dt)
      }

      const city=guard.city||CITIES.find(c=>c.id===guard.cityId)
      let targetMob=null,minMobDist=45
      for(const mob of this.enemies){
        if(mob.dead||!mob.g.visible)continue
        const dGuard=mob.g.position.distanceTo(guard.g.position)
        const dCity=city?Math.hypot(mob.g.position.x-city.x,mob.g.position.z-city.z):999
        if(dGuard<minMobDist || (city && dCity < city.wallRadius + 20)){
          if(dGuard<minMobDist){
            targetMob=mob
            minMobDist=dGuard
          }
        }
      }

      if(!targetMob){
        // Ronda ativa ao longo de todo o perímetro da muralha
        const wallR=(city?.wallRadius||24)+1.4
        guard.patrolAngle=(guard.patrolAngle||0)+guard.patrolSpeed*dt
        const targetX=city.x+Math.cos(guard.patrolAngle)*wallR
        const targetZ=city.z+Math.sin(guard.patrolAngle)*wallR
        const dx=targetX-guard.g.position.x,dz=targetZ-guard.g.position.z
        const d=Math.hypot(dx,dz)
        if(d>0.3){
          const nx=dx/d,nz=dz/d,step=3.8*dt
          guard.g.position.x+=nx*step;guard.g.position.z+=nz*step;guard.g.rotation.y=Math.atan2(nx,nz)
          guard.phase=(guard.phase||0)+dt*7.5
          if(guard.spear)guard.spear.rotation.x=0.15+Math.sin(guard.phase)*0.14
        }
      }else{
        // Persegue e elimina monstros próximos da muralha
        const dx=targetMob.g.position.x-guard.g.position.x,dz=targetMob.g.position.z-guard.g.position.z
        const d=Math.hypot(dx,dz),nx=d?dx/d:0,nz=d?dz/d:0
        guard.g.rotation.y=Math.atan2(nx,nz)
        if(d>2.3){
          const step=6.4*dt
          guard.g.position.x+=nx*step;guard.g.position.z+=nz*step
        }else if(now-guard.lastAttack>600){
          guard.lastAttack=now
          guard.spear.rotation.x=-.75
          setTimeout(()=>{if(!guard.dead&&guard.spear)guard.spear.rotation.x=.15},140)
          const dmg=Math.max(28,Math.round(guard.atk*(1.25+Math.random()*.4)))
          targetMob.hp-=dmg
          this.spawnDamageText(targetMob.g.position,dmg,true,'#fbbf24')
          this.flashEnemy(targetMob,false)
          this.updateMobLabel(targetMob)
          if(targetMob.hp<=0){
            this.killByBot(targetMob,guard)
          }
        }
      }
      this.updatePlayerNameplate(guard.label,{name:`[DEFESA] ${guard.name}`,level:guard.level,hp:guard.hp,maxHp:guard.maxHp,guildRank:'SSS'},false)
    }
  }

  scheduleEnemyRespawn(enemy){
    if(!enemy||this.state.dungeon||!enemy.chunkKey)return 0
    const delay=enemy.boss?RESPAWN_RULES.bossMs:Math.round(RESPAWN_RULES.mobMinMs+Math.random()*(RESPAWN_RULES.mobMaxMs-RESPAWN_RULES.mobMinMs)),due=Date.now()+delay
    const blueprint={due,x:enemy.g.position.x,z:enemy.g.position.z,level:enemy.level,name:enemy.name,boss:enemy.boss,zoneId:enemy.zoneId,chunkKey:enemy.chunkKey,netId:enemy.netId};this.respawnLocks.set(enemy.netId,due);this.respawnQueue.push(blueprint)
    return due
  }

  updateRespawns(){
    const now=Date.now()
    if(!this.state.dungeon&&this.respawnQueue.length){
      const keep=[]
      for(const r of this.respawnQueue){if(now<r.due){keep.push(r);continue}this.respawnLocks.delete(r.netId);const chunk=this.chunks.get(r.chunkKey),zone=ZONES.find(z=>z.id===r.zoneId);if(chunk&&zone&&!this.isInsideCitySafeZone(r.x,r.z,9)&&!this.enemies.some(e=>!e.dead&&e.netId===r.netId))this.enemies.push(this.makeEnemy(r.x,r.z,r.level,r.name,r.boss,zone,r.chunkKey,r.netId))}
      this.respawnQueue=keep
    }
    for(const rn of this.resourceNodes){
      if(rn.hp<=0&&rn.respawnAt&&now>=rn.respawnAt){
        rn.hp=rn.maxHp
        rn.respawnAt=0
        if(rn.mesh)rn.mesh.visible=true
        if(rn.collider)rn.collider.active=true
        if(rn.durabilitySprite)rn.durabilitySprite.visible=false
      }
    }
  }

  updateEquipmentVisuals(){
    const eq=this.state.equipment
    this.weaponVisual.visible=!!eq.weapon || this.state.level<3
    this.armorVisual.visible=!!eq.armor
    this.shieldVisual.visible=!!eq.talisman

    if(this.weaponVisual){
      const weaponSubtype=eq.weapon?.subtype||'sword'
      const key=weaponSubtype==='bow'?'bow':weaponSubtype==='spellbook'?'spellbook':weaponSubtype==='dagger'?'dagger':'sword_1h'
      if(this.weaponVisual.userData?.currentAttachedKey!==key){
        if(this.weaponVisual.userData?.attachedMesh){
          this.weaponVisual.remove(this.weaponVisual.userData.attachedMesh)
          this.weaponVisual.userData.attachedMesh=null
        }
        const model=this.externalModels?.[key]
        if(model){
          const weaponClone=this.assets.clone(model)
          if(weaponClone){
            if(weaponSubtype==='bow'){
              weaponClone.scale.setScalar(0.7)
              weaponClone.position.set(0.04,-0.22,0.12)
              weaponClone.rotation.set(0,Math.PI/2,0)
            }else if(weaponSubtype==='spellbook'){
              weaponClone.scale.setScalar(0.55)
              weaponClone.position.set(0.05,-0.15,0.1)
              weaponClone.rotation.set(0,0,0)
            }else if(weaponSubtype==='dagger'){
              weaponClone.scale.setScalar(0.65)
              weaponClone.position.set(0,-0.25,0)
              weaponClone.rotation.set(0,0,0)
            }else{
              weaponClone.scale.setScalar(0.75)
              weaponClone.position.set(0,-0.32,0)
              weaponClone.rotation.set(0,0,0)
            }
            this.weaponVisual.add(weaponClone)
            this.weaponVisual.userData.attachedMesh=weaponClone
            this.weaponVisual.userData.currentAttachedKey=key
            for(const part of this.weaponVisual.userData.proceduralParts||[])part.visible=false
          }
        }else{
          for(const part of this.weaponVisual.userData.proceduralParts||[])part.visible=true
          this.weaponVisual.userData.currentAttachedKey=null
        }
      }
    }

    if(eq.weapon)this.weaponVisual.scale.setScalar(1+Math.min(.35,(eq.weapon.upgrade||0)*.035))
    if(eq.armor){const color=new THREE.Color(eq.armor.color||'#94a3b8');this.armorVisual.material.color.lerp(color,.75)}
    const bootScale=eq.boots?1.08:1;this.rig.bootL.scale.setScalar(bootScale);this.rig.bootR.scale.setScalar(bootScale)
  }

  recalcStats(){
    const gear=totalEquipmentStats(this.state),attr=attributeBonuses(this.state.attributes)
    const activeId=this.state.classState?.activeClassId||'mercenary_swordsman'
    const cls=CLASSES_LIST.find(c=>c.id===activeId)||CLASSES_LIST[0]
    const classRanks=this.state.classState?.classRanks||{}
    const currentRank=classRanks[activeId]||1
    const { current: rankInfo } = getClassRankInfo(currentRank)

    let baseAtk=this.state.baseAtk*(cls.stats?.atkMult||1.0)*(1+(rankInfo?.atkBonus||0))
    let baseDef=this.state.baseDef+(cls.stats?.defBonus||0)
    let baseSpd=7.1+(cls.stats?.spdBonus||0)
    if(cls.id==='chaos_sovereign'){
      const bossBonus=(this.state.classState.bossPowersAbsorbed||0)*0.01
      baseAtk*=(1+bossBonus)
      baseDef+=Math.round(bossBonus*50)
    }
    this.state.atk=Math.round(baseAtk+gear.atk+attr.atk);this.state.def=Math.round(baseDef+gear.def+attr.def)
    this.state.speed=baseSpd+gear.speed+attr.speed+(this.state.mount.active?(this.state.mount.speedBonus||4.7):0)
    this.state.critChance=Number(((gear.crit||0)+attr.crit+(cls.stats?.critChance?cls.stats.critChance*100:0)+(rankInfo?.critBonus||0)).toFixed(1))
    this.state.abilityDamageMult=(attr.abilityMult||1)*(1+(rankInfo?.abilityBonus||0))
    this.state.maxHp=Math.round((this.state.baseMaxHp||120)+attr.maxHp);this.state.maxStamina=Math.round((this.state.baseMaxStamina||100)+attr.maxStamina)
    this.state.hp=Math.min(this.state.hp,this.state.maxHp);this.state.stamina=Math.min(this.state.stamina,this.state.maxStamina);this.updateEquipmentVisuals()
  }

  upgradeClassRank(classId){
    const activeId=classId||this.state.classState?.activeClassId||'mercenary_swordsman'
    this.state.classState.classRanks||={ [activeId]: 1 }
    const currentRank=this.state.classState.classRanks[activeId]||1
    const { next }=getClassRankInfo(currentRank)
    if(!next){
      this.toast('Esta classe já atingiu o Grau Máximo!')
      return false
    }
    const reqQuestId = `ascension_rank_${next.rank}`
    const ascensionQ = (this.state.quests || []).find(q => q.id === reqQuestId)
    if (!ascensionQ || ascensionQ.status !== 'done') {
      this.toast(`⚠️ Conclua a missão de ascensão "${ascensionQ?.title || 'Prova de Ascensão'}" antes de evoluir!`)
      return false
    }
    if((this.state.level||1)<next.minLevel){
      this.toast(`Requer Nível ${next.minLevel} para evoluir esta classe!`)
      return false
    }
    const grimoireItem=this.state.inventory.find(it=>it.subtype==='grimoire')
    const grimoireQty=grimoireItem?.qty||0
    if(next.costGrimoires>0&&grimoireQty<next.costGrimoires){
      this.toast(`Requer ${next.costGrimoires} Grimório(s) para evoluir para ${next.name}!`)
      return false
    }
    if((this.state.gold||0)<next.costGold){
      this.toast(`Ouro insuficiente (${next.costGold}◈ necessários)!`)
      return false
    }

    this.state.gold-=next.costGold
    if(next.costGrimoires>0&&grimoireItem){
      grimoireItem.qty=Math.max(0,grimoireItem.qty-next.costGrimoires)
      if(grimoireItem.qty<=0){
        this.state.inventory=this.state.inventory.filter(it=>it.id!==grimoireItem.id)
      }
    }

    this.state.classState.classRanks[activeId]=next.rank
    this.recalcStats()
    this.spawnAbilityRing(0xf59e0b,3.5,.6)
    this.toast(`⚡ Classe Evoluída para ${next.name}!`)
    this.saveGame()
    return true
  }

  allocateAttribute(stat){
    if(!['strength','vitality','agility','intellect'].includes(stat)||this.state.attributePoints<=0)return false
    this.state.attributes={strength:0,vitality:0,agility:0,intellect:0,...this.state.attributes};this.state.attributes[stat]++;this.state.attributePoints--;this.recalcStats();this.saveGame();return true
  }

  allocateAttributes(distribution={}){
    let total=0
    const keys=['strength','vitality','agility','intellect']
    for(const k of keys)total+=Math.max(0,Number(distribution[k])||0)
    if(total<=0||total>(this.state.attributePoints||0))return false
    this.state.attributes={strength:0,vitality:0,agility:0,intellect:0,...this.state.attributes}
    for(const k of keys){
      this.state.attributes[k]+=Math.max(0,Number(distribution[k])||0)
    }
    this.state.attributePoints-=total
    this.recalcStats()
    this.saveGame()
    this.toast(`✨ ${total} ponto(s) de atributo confirmado(s)!`)
    return true
  }

  cameraAimDirection(){
    const f=V3();this.camera.getWorldDirection(f);f.y=0
    if(f.lengthSq()<.0001)f.set(Math.sin(this.yaw),0,Math.cos(this.yaw));return f.normalize()
  }

  findAimTarget(maxRange=6,minDot=.25){
    const f=this.cameraAimDirection();let best=null,bestScore=-Infinity
    for(const e of this.enemies){if(e.dead||!e.g.visible)continue
      const delta=e.g.position.clone().sub(this.player.position),d=delta.length();if(d>maxRange||d<.01)continue
      delta.y=0;delta.normalize();const dot=delta.dot(f);if(dot<minDot)continue
      const score=dot*2.5-d/maxRange+(e.boss?.08:0);if(score>bestScore){best=e;bestScore=score}
    }
    return best
  }

  damageEnemy(e,amount,{knockback=.35,crit=false,network=true,fromPet=false}={}){
    if(e?.isCaravanGuard||e?.isCaravanCart)return this.caravanManager?.onDamageCaravanEntity(e,amount,{knockback,crit})
    if(e?.adventurer)return this.damageBot(e,amount,{crit})
    if(!e||e.dead)return false;this.enterCombat(8);const dealt=Math.max(1,Math.round(amount*100/(100+(e.def||0)*5)));e.hp-=dealt
    this.state.target={name:e.name,level:e.level,hp:Math.max(0,e.hp),maxHp:e.maxHp,boss:e.boss,crit};if(network&&e.netId)this.multiplayer?.send({type:'enemy_damage',netId:e.netId,amount:dealt,hpAfter:Math.max(0,e.hp),maxHp:e.maxHp,world:this.currentWorldId(),respawnAt:Date.now()+5000});this.spawnDamageText(e.g.position,dealt,crit);this.flashEnemy(e,crit)
    if(knockback)e.g.position.addScaledVector(e.g.position.clone().sub(this.player.position).normalize(),knockback)
    if(!fromPet&&this.tryTamePet(e))return true
    if(!fromPet)this.petAttackTarget(e)
    if(e.hp<=0)this.kill(e);return true
  }
  flashEnemy(e,crit=false){const material=e?.body?.material;if(!material?.emissive)return;const old=material.emissive.clone(),oldIntensity=material.emissiveIntensity;material.emissive.set(crit?0xffd45b:0xffffff);material.emissiveIntensity=1.35;setTimeout(()=>{if(!e.dead&&material){material.emissive.copy(old);material.emissiveIntensity=oldIntensity}},90)}
  spawnDamageText(pos,amount,crit=false){const c=document.createElement('canvas');c.width=256;c.height=96;const x=c.getContext('2d');x.textAlign='center';x.font=`900 ${crit?44:36}px Inter,Arial`;x.lineWidth=7;x.strokeStyle='rgba(0,0,0,.78)';x.strokeText(`${crit?'CRIT ':''}${amount}`,128,58);x.fillStyle=crit?'#ffd968':'#ffffff';x.fillText(`${crit?'CRIT ':''}${amount}`,128,58);const texture=new THREE.CanvasTexture(c),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));sprite.position.copy(pos);sprite.position.y+=2.4;sprite.scale.set(crit?2.8:2.2,crit?1.05:.82,1);sprite.renderOrder=40;this.scene.add(sprite);this.effects.push({type:'damage',object:sprite,life:.75,maxLife:.75,texture})}
  spawnAbilityRing(color=0x7edcff,radius=3,duration=.45){const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false}),ring=new THREE.Mesh(new THREE.RingGeometry(.72,1,36),material);ring.rotation.x=-Math.PI/2;ring.position.copy(this.player.position);ring.position.y=.12;ring.scale.setScalar(.1);(this.state.dungeon?this.dungeonArena:this.scene).add(ring);this.effects.push({type:'ring',object:ring,life:duration,maxLife:duration,radius,material});return ring}
  updateEffects(dt){
    for(let i=this.effects.length-1;i>=0;i--){
      const fx=this.effects[i];fx.life-=dt;const k=1-Math.max(0,fx.life)/fx.maxLife
      if(fx.type==='damage'){
        fx.object.position.y+=dt*1.15
        fx.object.material.opacity=Math.max(0,1-k)
      }else if(fx.type==='ring'){
        const sc=.1+(fx.radius-.1)*k
        fx.object.scale.setScalar(sc)
        fx.material.opacity=Math.max(0,.8*(1-k))
      }else if(fx.type==='debris'){
        fx.object.position.addScaledVector(fx.dir,dt)
        fx.dir.y-=9.8*dt
        fx.object.scale.setScalar(Math.max(.02,1-k))
        if(fx.object.material)fx.object.material.opacity=Math.max(0,1-k)
      }
      if(fx.life<=0){
        fx.object.parent?.remove(fx.object)
        fx.object.material?.dispose?.()
        fx.object.geometry?.dispose?.()
        fx.texture?.dispose?.()
        this.effects.splice(i,1)
      }
    }
  }

  getCrosshairTarget(maxRange=18,screenRadius=.17){
    // First use a true ray from the camera center. This keeps attacks aligned with the X crosshair.
    const caravanTargets=this.caravanManager?this.caravanManager.getAttackableTargets():[]
    const visible=[...this.enemies.filter(e=>!e.dead&&e.g.visible),...this.bots.filter(b=>!b.dead&&b.g.visible),...caravanTargets]
    if(visible.length){
      this.raycaster.setFromCamera({x:this.aimNdcX,y:0},this.camera)
      this.raycaster.far=maxRange+this.cameraDistance+4
      const hits=this.raycaster.intersectObjects(visible.map(e=>e.g),true)
      for(const hit of hits){
        let root=hit.object
        while(root?.parent&&!visible.some(e=>e.g===root))root=root.parent
        const direct=visible.find(e=>e.g===root)
        if(direct&&direct.g.position.distanceTo(this.player.position)<=maxRange)return direct
      }
    }
    // Soft aim-assist fallback for melee heads close to the center of the screen.
    let best=null,bestScore=Infinity
    for(const e of visible){
      const world=e.g.position.clone();world.y+=e.boss?2.7:1.75;const d=world.distanceTo(this.camera.position);if(d>maxRange+this.cameraDistance||d<.2)continue
      const ndc=world.clone().project(this.camera);if(ndc.z<-1||ndc.z>1)continue;const screen=Math.hypot(ndc.x-this.aimNdcX,ndc.y*.78);if(screen>screenRadius)continue
      const playerDist=e.g.position.distanceTo(this.player.position),score=screen*4+playerDist/maxRange;if(score<bestScore){best=e;bestScore=score}
    }
    return best
  }

  getCrosshairResourceNode(maxRange=6.5,screenRadius=.32){
    const activeNodes=this.resourceNodes.filter(rn=>rn.hp>0&&rn.mesh?.visible)
    if(!activeNodes.length)return null
    this.raycaster.setFromCamera({x:this.aimNdcX,y:0},this.camera)
    this.raycaster.far=maxRange+this.cameraDistance+4
    const meshes=activeNodes.map(rn=>rn.mesh).filter(Boolean)
    const hits=this.raycaster.intersectObjects(meshes,true)
    for(const hit of hits){
      let root=hit.object
      while(root?.parent&&!meshes.includes(root))root=root.parent
      const direct=activeNodes.find(rn=>rn.mesh===root)
      if(direct&&Math.hypot(direct.gx-this.player.position.x,direct.gz-this.player.position.z)<=maxRange)return direct
    }
    let best=null,bestScore=Infinity
    const f=V3().set(Math.sin(this.player.rotation.y),0,Math.cos(this.player.rotation.y))
    for(const rn of activeNodes){
      const d=Math.hypot(rn.gx-this.player.position.x,rn.gz-this.player.position.z)
      if(d>maxRange)continue
      const worldPos=new THREE.Vector3(rn.gx,1.5,rn.gz)
      const ndc=worldPos.clone().project(this.camera)
      if(ndc.z<-1||ndc.z>1)continue
      const screen=Math.hypot(ndc.x-this.aimNdcX,ndc.y*.78)
      if(screen>screenRadius)continue
      const score=screen*3+d/maxRange
      if(score<bestScore){best=rn;bestScore=score}
    }
    if(!best){
      let bd=4.2
      for(const rn of activeNodes){
        const d=Math.hypot(rn.gx-this.player.position.x,rn.gz-this.player.position.z)
        if(d<bd){
          const dir=V3().set(rn.gx-this.player.position.x,0,rn.gz-this.player.position.z).normalize()
          if(dir.dot(f)>.18){best=rn;bd=d}
        }
      }
    }
    return best
  }

  showResourceDurabilityBar(node){
    if(!node.durabilitySprite){
      const canvas=document.createElement('canvas');canvas.width=300;canvas.height=74
      const texture=new THREE.CanvasTexture(canvas);texture.minFilter=THREE.LinearFilter
      const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}))
      sprite.scale.set(3.4,.84,1);sprite.renderOrder=30
      node.durabilityCanvas=canvas;node.durabilityTexture=texture;node.durabilitySprite=sprite
      this.scene.add(sprite)
    }
    const sprite=node.durabilitySprite,canvas=node.durabilityCanvas,texture=node.durabilityTexture
    sprite.position.set(node.gx,node.type==='tree'?3.2:2.1,node.gz)
    sprite.visible=true
    const ctx=canvas.getContext('2d')
    const pct=Math.max(0,Math.min(1,node.hp/node.maxHp))
    ctx.clearRect(0,0,300,74)
    ctx.fillStyle='rgba(6,11,18,.92)';ctx.roundRect(4,4,292,66,10);ctx.fill()
    ctx.strokeStyle=node.type==='tree'?'#b45309':node.type==='ore_iron'?'#38bdf8':'#94a3b8';ctx.lineWidth=2;ctx.stroke()
    ctx.font='800 20px Inter,Arial';ctx.fillStyle='#ffffff';ctx.textAlign='center'
    ctx.fillText(`${node.icon} ${node.name}`,150,28)
    ctx.fillStyle='#0f172a';ctx.fillRect(20,38,260,18)
    const barCol=node.type==='tree'?'#f59e0b':node.type==='ore_iron'?'#0284c7':'#64748b'
    ctx.fillStyle=barCol;ctx.fillRect(20,38,260*pct,18)
    ctx.strokeStyle='rgba(255,255,255,.45)';ctx.strokeRect(20,38,260,18)
    ctx.font='700 12px Inter,Arial';ctx.fillStyle='#ffffff'
    ctx.fillText(`${Math.max(0,Math.ceil(node.hp))} / ${node.maxHp} HP  (${Math.round(pct*100)}%)`,150,52)
    texture.needsUpdate=true
    clearTimeout(node.durabilityHideTimeout)
    node.durabilityHideTimeout=setTimeout(()=>{if(sprite)sprite.visible=false},3500)
  }

  spawnResourceDebris(pos,kind,count=8){
    const col=kind==='wood'?0x8b5a2b:kind==='coal'?0x1c1d22:0x94a3b8
    for(let i=0;i<count;i++){
      const sz=.08+Math.random()*.14
      const p=mesh(new THREE.BoxGeometry(sz,sz,sz),mat(col,{roughness:.8}))
      p.position.copy(pos)
      p.position.x+=(Math.random()-.5)*.8
      p.position.y+=(Math.random()-.5)*.6
      p.position.z+=(Math.random()-.5)*.8
      const dir=V3().set((Math.random()-.5)*4,Math.random()*3.5+1,(Math.random()-.5)*4)
      this.scene.add(p)
      this.effects.push({type:'debris',object:p,dir,life:.55+Math.random()*.25,maxLife:.8})
    }
  }

  spawnFloatingLootText(pos,text){
    const c=document.createElement('canvas');c.width=360;c.height=88;const x=c.getContext('2d');x.textAlign='center'
    x.font='900 32px Inter,Arial';x.lineWidth=6;x.strokeStyle='rgba(0,0,0,.85)';x.strokeText(text,180,52)
    x.fillStyle='#67e8f9';x.fillText(text,180,52)
    const texture=new THREE.CanvasTexture(c),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}))
    sprite.position.copy(pos);sprite.position.y+=2.6;sprite.scale.set(3.2,.78,1);sprite.renderOrder=45
    this.scene.add(sprite)
    this.effects.push({type:'damage',object:sprite,life:1.1,maxLife:1.1,texture})
  }

  damageResourceNode(node,amount,{isAxe=false,isPickaxe=false}={}){
    if(!node||node.hp<=0)return
    node.hp=Math.max(0,node.hp-amount)
    node.lastHit=Date.now()
    const pos=new THREE.Vector3(node.gx,1.8,node.gz)
    const toolBonusText=isAxe?' 🪓×3.2':isPickaxe?' ⛏️×3.2':''
    this.spawnDamageText(pos,`-${amount}${toolBonusText}`)
    this.showResourceDurabilityBar(node)
    this.spawnResourceDebris(pos,node.dropKind,5)
    if(node.hp<=0){
      this.breakResourceNode(node)
    }
  }

  breakResourceNode(node){
    node.mesh.visible=false
    if(node.collider)node.collider.active=false
    node.respawnAt=Date.now()+38000
    if(node.durabilitySprite)node.durabilitySprite.visible=false
    const pos=new THREE.Vector3(node.gx,1.5,node.gz)
    this.spawnResourceDebris(pos,node.dropKind,18)
    const qty=node.type==='tree'?(2+Math.floor(Math.random()*3)):(1+Math.floor(Math.random()*3))
    const drop=makeResourceDrop(node.dropKind,qty)
    const added=this.addInventoryItem(drop)
    if(added){
      this.toast(`+${drop.qty} ${drop.name} coletado! ${node.icon}`)
      this.spawnFloatingLootText(pos,`+${drop.qty} ${drop.name} ${node.icon}`)
    }
    this.gainXp(12+Math.round(this.state.level*1.5))
    this.haptic(30)
  }

  attack(force=false){
    if((!this.combatMode&&!force)||this.state.uiPanel||this.attackClock>0||this.state.dungeon?.transition)return
    const isBow=this.state.equipment?.weapon?.subtype==='bow'
    const staminaCost=isBow?12:15
    if(this.state.stamina<staminaCost){
      if(!this._lastStaminaWarn||performance.now()-this._lastStaminaWarn>1600){
        this._lastStaminaWarn=performance.now()
        this.toast('⚡ Sem vigor suficiente para atacar! Descanse para recuperar energia.')
      }
      this.haptic?.(10)
      return
    }
    this.state.stamina=Math.max(0,this.state.stamina-staminaCost)
    this.attackClock=isBow?.42:.34
    this.player.userData.motion='attack'
    this.rig.shoulderR.rotation.x=isBow?-1.1:-1.4
    this.rig.swordPivot.rotation.z=isBow?-.2:-.65

    if(isBow){
      this.shootArrow()
      this.multiplayer?.send({type:'combat',action:'attack_bow',world:this.currentWorldId()})
      return
    }

    const aimed=this.getCrosshairTarget(6,.24);let best=aimed
    if(!best){let bd=4.15;const f=V3().set(Math.sin(this.player.rotation.y),0,Math.cos(this.player.rotation.y));for(const e of [...this.enemies,...this.bots]){if(e.dead||!e.g.visible)continue;const d=e.g.position.distanceTo(this.player.position);if(d<bd){const dir=e.g.position.clone().sub(this.player.position).normalize();if(dir.dot(f)>.05){best=e;bd=d}}}}
    if(best){
      const dir=best.g.position.clone().sub(this.player.position);dir.y=0;if(dir.lengthSq())this.player.rotation.y=Math.atan2(dir.x,dir.z);let dmg=Math.round(this.state.atk*(.92+Math.random()*.16));const crit=Math.random()<Math.min(.35,.08+(this.state.critChance||0)/100);if(crit)dmg=Math.round(dmg*1.5);this.damageEnemy(best,dmg,{knockback:.45,crit});this.haptic(crit?28:10);this.multiplayer?.send({type:'combat',action:'attack',world:this.currentWorldId()})
      return
    }

    // Check for harvestable resource node in aim crosshair or nearby
    const resourceTarget=this.getCrosshairResourceNode(6.2,.32)
    if(resourceTarget){
      const dir=V3().set(resourceTarget.gx-this.player.position.x,0,resourceTarget.gz-this.player.position.z)
      if(dir.lengthSq())this.player.rotation.y=Math.atan2(dir.x,dir.z)
      const eqWeapon=this.state.equipment?.weapon
      const isAxe=eqWeapon?.subtype==='axe'||(eqWeapon?.type==='tool'&&eqWeapon?.subtype==='axe')
      const isPickaxe=eqWeapon?.subtype==='pickaxe'||(eqWeapon?.type==='tool'&&eqWeapon?.subtype==='pickaxe')
      const baseDmg=Math.floor(this.state.atk*(.85+Math.random()*.35))
      let mult=1.0
      if(resourceTarget.type==='tree'){
        mult=isAxe?3.2:.85
      }else if(resourceTarget.type.startsWith('ore')){
        mult=isPickaxe?3.2:.55
      }
      const dealt=Math.max(2,Math.round(baseDmg*mult))
      this.damageResourceNode(resourceTarget,dealt,{isAxe,isPickaxe})
      this.haptic(isAxe||isPickaxe?22:12)
      return
    }
  }

  shootArrow(){
    this.enterCombat(8)
    const maxRange=30
    const aimed=this.getCrosshairTarget(maxRange,.28)
    const origin=this.player.position.clone()
    origin.y+=1.35

    let targetPoint=null
    if(aimed){
      targetPoint=aimed.g.position.clone()
      targetPoint.y+=(aimed.boss?1.8:1.1)
    }else{
      const aimDir=this.cameraAimDirection()
      targetPoint=origin.clone().addScaledVector(aimDir,maxRange)
      targetPoint.y+=.25
    }

    const dir=targetPoint.clone().sub(origin).normalize()
    this.player.rotation.y=Math.atan2(dir.x,dir.z)

    let arrowMesh=null
    if(this.externalModels?.arrow){
      arrowMesh=this.assets.clone(this.externalModels.arrow)
      arrowMesh.scale.setScalar(0.75)
    }else{
      const group=new THREE.Group()
      const shaft=mesh(new THREE.CylinderGeometry(.018,.018,.85,6),mat(0x6b4423))
      shaft.position.y=0
      const tip=mesh(new THREE.ConeGeometry(.06,.18,6),mat(0xced7e0,{metalness:.8}))
      tip.position.y=.48
      const fletch=mesh(new THREE.BoxGeometry(.02,.18,.12),mat(0x94a3b8))
      fletch.position.y=-.36
      group.add(shaft,tip,fletch)
      arrowMesh=group
    }

    arrowMesh.position.copy(origin)
    arrowMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir)
    ;(this.state.dungeon?this.dungeonArena:this.worldRoot).add(arrowMesh)

    let dmg=Math.floor(this.state.atk*(.78+Math.random()*.30))
    const crit=Math.random()<Math.min(.4,.10+(this.state.critChance||0)/100)
    if(crit)dmg=Math.round(dmg*1.55)

    this.projectiles.push({
      mesh:arrowMesh,
      pos:origin.clone(),
      dir,
      speed:46,
      dist:0,
      maxDist:maxRange,
      dmg,
      crit,
      target:aimed
    })

    this.haptic(crit?24:10)
    this.toast(`🏹 Disparo com Arco! ${aimed?`[${aimed.name}]`:''}`)
  }

  updateProjectiles(dt){
    for(let i=this.projectiles.length-1;i>=0;i--){
      const p=this.projectiles[i]
      const step=p.speed*dt
      p.dist+=step
      p.pos.addScaledVector(p.dir,step)
      p.mesh.position.copy(p.pos)
      p.mesh.rotation.x += 7 * dt
      p.mesh.rotation.y += 9 * dt

      if(p.fromMob){
        let hit = false
        const targetBot = p.victimBot
        if(targetBot && !targetBot.dead && targetBot.g.visible){
          const center = targetBot.g.position.clone().add(new THREE.Vector3(0,1,0))
          if(p.pos.distanceTo(center) <= 1.3){
            hit = true
            const dealt = Math.max(2, Math.round(p.dmg - targetBot.def * 0.35))
            targetBot.hp = Math.max(0, targetBot.hp - dealt)
            this.spawnDamageText(targetBot.g.position, dealt, false)
            this.spawnAbilityRing(p.color||0x22c55e, 1.8, 0.4)
            this.updatePlayerNameplate(targetBot.label, { name: `${targetBot.name} [IA]`, level: targetBot.level, hp: targetBot.hp, maxHp: targetBot.maxHp, guildRank: targetBot.guildRank }, false)
            if(targetBot.hp <= 0) this.killBot(targetBot, { byPlayer: false })
          }
        } else {
          const playerCenter = this.player.position.clone().add(new THREE.Vector3(0,1,0))
          if(p.pos.distanceTo(playerCenter) <= 1.25){
            hit = true
            if(this.invuln <= 0 && !this.isInsideCitySafeZone(this.player.position.x, this.player.position.z, 1)){
              const dealt = this.damagePlayer(Math.max(2, Math.round(p.dmg - this.state.def * 0.38)))
              this.spawnDamageText(this.player.position, dealt, false)
              this.spawnAbilityRing(p.color||0x22c55e, 2.0, 0.5)
              this.haptic(35)
            }
          }
        }

        if(hit || p.dist >= p.maxDist){
          p.mesh.parent?.remove(p.mesh)
          p.mesh.traverse(o=>{
            o.geometry?.dispose?.()
            if(o.material && !Array.isArray(o.material)) o.material.dispose?.()
          })
          this.projectiles.splice(i,1)
        }
      } else {
        let hitTarget=null
        const candidates=[...this.enemies.filter(e=>!e.dead&&e.g.visible),...this.bots.filter(b=>!b.dead&&b.g.visible)]
        for(const e of candidates){
          const mobCenter=e.g.position.clone()
          mobCenter.y+=(e.boss?1.8:1.1)
          const hitRadius=e.boss?2.4:1.25
          if(p.pos.distanceTo(mobCenter)<=hitRadius){
            hitTarget=e
            break
          }
        }

        if(hitTarget||p.dist>=p.maxDist){
          if(hitTarget){
            this.damageEnemy(hitTarget,p.dmg,{knockback:.35,crit:p.crit})
            this.spawnAbilityRing(0xffd56b,1.2,.25)
          }
          p.mesh.parent?.remove(p.mesh)
          p.mesh.traverse(o=>{
            o.geometry?.dispose?.()
            if(o.material&&!Array.isArray(o.material))o.material.dispose?.()
          })
          this.projectiles.splice(i,1)
        }
      }
    }
  }

  activeAbilities(){
    const cls=CLASSES_LIST.find(c=>c.id===(this.state.classState?.activeClassId||'mercenary_swordsman'))||CLASSES_LIST[0]
    const skill=cls?.skill||{}
    return ABILITIES.map(a=>a.slot===1?{...a,id:`class-${cls.id}`,name:skill.name||a.name,short:(skill.name||a.short).split(' ')[0],icon:'✦',cost:skill.stamina||a.cost,stamina:skill.stamina||a.stamina,cooldown:skill.cooldown||a.cooldown,description:skill.desc||a.description,type:skill.type||'melee_aoe',classAbility:true,color:cls.auraColor}:a)
  }
  special(){return this.castAbility(2)}
  castAbility(slot=1){
    const ability=this.activeAbilities().find(a=>a.slot===Number(slot));if(!ability||this.state.uiPanel)return false
    const remain=this.abilityCooldowns[ability.id]||0;if(remain>0||this.state.stamina<ability.cost)return false
    if(ability.slot===1||ability.slot===2)this.enterCombat(8)
    this.state.stamina-=ability.cost;this.abilityCooldowns[ability.id]=ability.cooldown;this.haptic(18);this.multiplayer?.send({type:'ability',slot:ability.slot,id:ability.id,world:this.currentWorldId()})
    if(ability.classAbility){
      const type=ability.type||'melee_aoe',color=ability.color||0x76d9ff,range=/aoe|storm|burst|smite|summon|barrier/.test(type)?6.5:18
      const target=this.getCrosshairTarget(range,.24)
      if(type==='heal_burst'||type==='shield_barrier'){
        const heal=Math.round(this.state.maxHp*(type==='heal_burst'?.45:.18));this.state.hp=Math.min(this.state.maxHp,this.state.hp+heal)
        if(type==='shield_barrier')this.classBarrierUntil=performance.now()+3000
        this.spawnAbilityRing(color,5.5,.55);this.toast(`${ability.name} • +${heal} HP`)
      }else if(type==='dash_strike'||type==='teleport_backstab'){
        this.dashTime=.36;this.invuln=.42;this.player.userData.motion='dash'
        if(target)this.damageEnemy(target,Math.round(this.state.atk*2.15*(this.state.abilityDamageMult||1)),{knockback:.8,crit:type==='teleport_backstab'})
        this.spawnAbilityRing(color,3.2,.35);this.toast(ability.name)
      }else if(/aoe|storm|smite|summon/.test(type)){
        const mult=type==='holy_smite'?2.6:type==='summon_beast'?1.65:2.2
        this.specialAnim=.55;this.player.userData.motion='special';this.spawnAbilityRing(color,6.5,.55)
        for(const e of [...this.enemies,...this.bots])if(!e.dead&&e.g.visible&&e.g.position.distanceTo(this.player.position)<6.5)this.damageEnemy(e,Math.round(this.state.atk*mult*(this.state.abilityDamageMult||1)),{knockback:.65})
        this.toast(ability.name)
      }else {
        if(!target){this.abilityCooldowns[ability.id]=0;this.state.stamina+=ability.cost;this.toast('Mire em um inimigo para usar esta habilidade.');return false}
        const mult=type==='multi_missile'?2.35:type==='projectile_line'?2.05:2.15
        this.specialAnim=.42;this.player.userData.motion='special';this.spawnAbilityRing(color,2.4,.32);this.damageEnemy(target,Math.round(this.state.atk*mult*(this.state.abilityDamageMult||1)),{knockback:.7});this.toast(ability.name)
      }
    }else if(ability.slot===1){
      const target=this.getCrosshairTarget(ability.range,.22)
      if(!target){this.abilityCooldowns[ability.id]=0;this.state.stamina+=ability.cost;this.toast('Mire em um inimigo para usar Corte Astral.');return false}
      const dir=target.g.position.clone().sub(this.player.position);dir.y=0;if(dir.lengthSq())this.player.rotation.y=Math.atan2(dir.x,dir.z)
      this.specialAnim=.42;this.player.userData.motion='special';this.spawnAbilityRing(0x76d9ff,2.2,.32);const dmg=Math.floor(this.state.atk*1.3*(this.state.abilityDamageMult||1));this.damageEnemy(target,dmg,{knockback:.7});this.toast(`Corte Astral • ${dmg}`)
    }else if(ability.slot===2){
      this.specialAnim=.55;this.player.userData.motion='special';this.spawnAbilityRing(0x9d7cff,ability.range,.55);for(const e of [...this.enemies,...this.bots])if(!e.dead&&e.g.visible&&e.g.position.distanceTo(this.player.position)<ability.range)this.damageEnemy(e,Math.floor(this.state.atk*1.55*(this.state.abilityDamageMult||1)),{knockback:.65})
      this.toast('Onda Astral!')
    }else{
      this.dashTime=.34;this.invuln=.42;this.player.userData.motion='dash';this.spawnAbilityRing(0x75f4cf,2.5,.28);this.toast('Passo Etéreo!')
    }
    return true
  }
  dash(){if(this.state.uiPanel||this.state.stamina<22||this.dashTime>0)return;this.state.stamina-=22;this.dashTime=.22;this.invuln=.26;this.player.userData.motion='dash'}

  kill(e){
    if(e?.adventurer)return this.killBot(e)
    if(!e||e.dead)return;e.dead=true;(this.state.dungeon?this.dungeonArena:this.worldRoot).remove(e.g);const respawnAt=!this.state.dungeon?this.scheduleEnemyRespawn(e):0;if(e.netId)this.multiplayer?.send({type:'enemy_dead',netId:e.netId,world:this.currentWorldId(),respawnAt});this.state.stats.kills++;if(e.boss)this.state.stats.bosses++
    this.gateManager?.onEnemyKilled(e)
    if(e.boss&&this.state.classState?.activeClassId==='chaos_sovereign'){
      this.state.classState.bossPowersAbsorbed=(this.state.classState.bossPowersAbsorbed||0)+1
      this.recalcStats()
      this.toast('👑 Poder Cósmico do Chefe Absorvido (+1% Poder Eterno)!')
    }
    const progression=resolveEntityProgression(e.name,e.level,{dungeon:!!this.state.dungeon});const xp=calculateKillXP(this.state.level,progression.level,{boss:e.boss,fixedXP:progression.fixedXP,disableLevelScaling:progression.disableLevelScaling}),gold=Math.round(9+progression.level*2.2*(e.boss?4:1));this.state.gold+=gold;this.state.ores+=e.boss?2:(Math.random()<.2?1:0);this.awardCombatXp(xp)
    progressQuest(this.state,e.boss?'boss':'kill',e.boss?e.name:'any',1);progressGuildMissions(this.state,e.boss?'boss':'kill',e.boss?e.name:'any',1)
    if(Math.random()<(e.boss ? .95 : .34))this.rollLoot(e)
    if(Math.random()<(e.boss?.95:.58))this.addInventoryItem(makeMaterialDrop(e.level,e.name,e.zoneId||this.state.zoneId))
    if(this.state.target?.name===e.name)this.state.target=null;this.enemies=this.enemies.filter(x=>x!==e)
  }

  awardCombatXp(amount){
    const xp=Math.max(0,Math.round(amount||0)),party=this.state.party||{}
    if(xp<=0)return
    if(this.multiplayer?.connected&&party.id&&(party.members?.length||0)>1){party.totalXP=(party.totalXP||0)+xp;this.multiplayer.send({type:'party_xp',amount:xp,world:this.currentWorldId()});return}
    this.gainXp(xp)
  }

  gainXp(x, partyTag = null){
    const amount = Math.max(0, Math.round(x || 0))
    if (this.xpFeedback) {
      this.xpFeedback.awardXP(amount, { isPartyBonus: !!partyTag, bonusText: partyTag || '' })
    }
    this.state.xp += amount
    let leveledUp=false
    while(this.state.xp >= this.state.nextXp && this.state.level < 300) {
      this.state.xp -= this.state.nextXp
      this.state.level++
      this.state.nextXp = Math.round(120 * Math.pow(this.state.level, 1.38))
      this.state.baseMaxHp = (this.state.baseMaxHp || this.state.maxHp || 120) + 8
      this.state.baseAtk += 2
      this.state.baseDef += 1
      this.state.attributePoints = (this.state.attributePoints || 0) + 1
      leveledUp=true
      progressQuest(this.state, 'level', 'level', 1)
      if (this.xpFeedback) {
        this.xpFeedback.triggerLevelUp(this.state.level)
      } else {
        this.toast(`Nível ${this.state.level}! +1 ponto de atributo`)
      }
    }
    updateGuildRank(this.state)
    this.recalcStats()
    this.state.hp = this.state.maxHp
    if(leveledUp){this.saveGame();this.saveCloudGame({force:true})}
  }

  inventoryCapacity(){return Math.max(40,Math.min(100,Math.round(Number(this.state.inventoryCapacity)||40)))}
  backpackUpgrade(){
    const capacity=this.inventoryCapacity(),level=Math.max(0,Math.round(Number(this.state.backpackLevel)||0))
    if(capacity>=100){this.toast('Mochila já está no tamanho máximo.');return false}
    const gold=180+level*220,ores=1+Math.floor(level/2)
    if((this.state.gold||0)<gold||(this.state.ores||0)<ores){this.toast(`Precisa de ${gold} ouro e ${ores} minério para ampliar a mochila.`);return false}
    this.state.gold-=gold;this.state.ores-=ores;this.state.backpackLevel=level+1;this.state.inventoryCapacity=Math.min(100,capacity+10)
    this.toast(`🎒 Mochila ampliada: ${this.state.inventoryCapacity} espaços.`);this.saveGame();return true
  }
  addInventoryItem(item){
    if(!item)return false
    if(item.type==='material'||item.subtype==='monster-drop'){
      const stack=this.state.inventory.find(x=>x.type===item.type&&x.name===item.name);if(stack){stack.qty=(stack.qty||1)+(item.qty||1);return true}
    }
    if(this.state.inventory.length>=this.inventoryCapacity()){this.toast('Mochila cheia: venda, equipe itens ou amplie no ferreiro.');return false}
    this.state.inventory=[item,...this.state.inventory];return true
  }

  rollLoot(e){
    const rarity=rollLootRarity(e.level,e.boss),types=['weapon','armor','boots','talisman'],type=types[Math.floor(Math.random()*types.length)],item={...makeItem(type,e.level,rarity.name),zoneId:e.zoneId||this.state.zoneId}
    if(this.addInventoryItem(item))this.toast(`${item.name} • ${item.rarity} • Nv.${item.level}`)
  }

  equipItem(id){
    const item=this.state.inventory.find(x=>x.id===id);if(!item)return
    const slot=item.type==='tool'?'weapon':item.type
    if(!['weapon','armor','boots','talisman'].includes(slot))return
    const old=this.state.equipment[slot];this.state.equipment[slot]={...item};this.state.inventory=this.state.inventory.filter(x=>x.id!==id);if(old)this.state.inventory.unshift(old);this.recalcStats();this.saveGame()
  }
  unequip(slot){const item=this.state.equipment[slot];if(!item)return;if(this.state.inventory.length>=this.inventoryCapacity()){this.toast('Mochila cheia.');return}this.state.inventory.unshift(item);this.state.equipment[slot]=null;this.recalcStats()}
  sellItem(id){
    const i=this.state.inventory.findIndex(x=>x.id===id);if(i<0)return
    const item=this.state.inventory[i],qty=Math.max(1,item.qty||1)
    const eco=CITY_ECONOMIES[this.currentMerchantCityId]||CITY_ECONOMIES['aurora-city']
    const regionalBonus=item.zoneId&&item.zoneId===eco.zoneId?1.18:1
    const isDemanded=(eco.demands||[]).some(d=>item.subtype===d||item.type===d||(item.name&&item.name.toLowerCase().includes(d)))
    const demandBonus=isDemanded?(eco.demandBonus||1.55):1
    const totalValue=Math.max(1,Math.round((item.value||30)*.45*qty*(eco.sellMult||1)*regionalBonus*demandBonus))
    this.state.gold+=totalValue
    this.state.inventory.splice(i,1)
    if(isDemanded){
      this.toast(`📈 ${item.name} vendido com bônus de Alta Demanda em ${eco.label} (+${Math.round((demandBonus-1)*100)}%!)`)
    }else{
      this.toast(`${item.name} vendido em ${eco.label}`)
    }
    this.saveGame()
  }
  sellMultipleItems(ids=[]){
    if(!ids||!ids.length)return
    let totalGained=0,count=0,demandedCount=0
    const eco=CITY_ECONOMIES[this.currentMerchantCityId]||CITY_ECONOMIES['aurora-city']
    const idSet=new Set(ids)
    this.state.inventory=this.state.inventory.filter(item=>{
      if(idSet.has(item.id)){
        const qty=Math.max(1,item.qty||1)
        const regionalBonus=item.zoneId&&item.zoneId===eco.zoneId?1.18:1
        const isDemanded=(eco.demands||[]).some(d=>item.subtype===d||item.type===d||(item.name&&item.name.toLowerCase().includes(d)))
        const demandBonus=isDemanded?(eco.demandBonus||1.55):1
        if(isDemanded)demandedCount++
        const value=Math.max(1,Math.round((item.value||30)*.45*qty*(eco.sellMult||1)*regionalBonus*demandBonus))
        totalGained+=value
        count++
        return false
      }
      return true
    })
    this.state.gold+=totalGained
    this.toast(`${count} itens vendidos • +${totalGained} ◈ Ouro${demandedCount>0?` (${demandedCount} com Alta Demanda!)`:''}`)
    this.saveGame()
  }
  submitTradeOffer({partnerId,itemIds=[],gold=0}={}){
    const targetId=String(partnerId||'')
    if(!this.multiplayer?.connected||!targetId){this.toast('Conecte ao multiplayer e escolha um jogador para trocar.');return false}
    const idSet=new Set((Array.isArray(itemIds)?itemIds:[]).map(String))
    const items=this.state.inventory.filter(item=>idSet.has(String(item.id))).slice(0,20).map(item=>({...item}))
    const sendGold=Math.max(0,Math.min(this.state.gold,Math.round(Number(gold)||0)))
    if(!items.length&&!sendGold){this.toast('Escolha pelo menos um item ou ouro para trocar.');return false}
    const active=this.state.trade
    if(active&&active.status!=='completed'&&active.partnerId!==targetId){this.toast('Cancele a troca atual antes de escolher outro jogador.');return false}
    const tradeId=active?.id||`trade-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`
    const localOffer=normalizeTradeOffer({items,gold:sendGold,updatedAt:Date.now()})
    this.state.trade={id:tradeId,partnerId:targetId,partnerName:active?.partnerName||this.remotePlayers.get(targetId)?.data?.name||'Aventureiro',localOffer,remoteOffer:active?.id===tradeId?active.remoteOffer:null,localConfirmed:false,remoteConfirmed:false,status:'offered'}
    this.multiplayer.send({type:'trade_offer',to:targetId,tradeId,offer:localOffer,world:this.currentWorldId()})
    this.toast(`🤝 Proposta enviada: ${items.length} item(ns)${sendGold?` e ${sendGold}◈`:''}.`)
    return true
  }
  executeTrade(args={}){return this.submitTradeOffer(args)}
  confirmTrade(){
    const trade=this.state.trade
    if(!trade?.id||trade.status==='completed'||!trade.localOffer||!trade.remoteOffer){this.toast('Aguarde a oferta do outro jogador antes de confirmar.');return false}
    const idSet=new Set((trade.localOffer.items||[]).map(item=>String(item.id)))
    const stillOwned=this.state.inventory.filter(item=>idSet.has(String(item.id)))
    if(stillOwned.length!==idSet.size||this.state.gold<Number(trade.localOffer.gold||0)){this.toast('Sua oferta mudou. Envie a proposta novamente.');this.state.trade={...trade,localConfirmed:false,remoteConfirmed:false};return false}
    if(this.state.inventory.filter(item=>!idSet.has(String(item.id))).length+(trade.remoteOffer.items||[]).length>40){this.toast('Não há espaço suficiente na mochila para receber esta oferta.');return false}
    this.state.trade={...trade,localConfirmed:true,status:'confirming'}
    this.multiplayer.send({type:'trade_confirm',to:trade.partnerId,tradeId:trade.id,localOfferHash:tradeOfferHash(trade.localOffer),remoteOfferHash:tradeOfferHash(trade.remoteOffer),world:this.currentWorldId()})
    if(trade.remoteConfirmed)this.completeTrade()
    else this.toast('Confirmação enviada. Aguardando o outro jogador.')
    return true
  }
  cancelTrade(message='Troca cancelada.',notify=true){
    const trade=this.state.trade
    if(!trade)return false
    if(notify&&trade.status!=='completed'&&this.multiplayer?.connected)this.multiplayer.send({type:'trade_cancel',to:trade.partnerId,tradeId:trade.id,world:this.currentWorldId(),message})
    this.state.trade=null
    if(message)this.toast(message)
    return true
  }
  completeTrade(){
    const trade=this.state.trade
    if(!trade?.localConfirmed||!trade.remoteConfirmed||trade.status==='completed')return false
    const localOffer=normalizeTradeOffer(trade.localOffer),remoteOffer=normalizeTradeOffer(trade.remoteOffer)
    const idSet=new Set(localOffer.items.map(item=>String(item.id)))
    const offered=this.state.inventory.filter(item=>idSet.has(String(item.id)))
    if(offered.length!==idSet.size||this.state.gold<localOffer.gold){this.cancelTrade('Troca cancelada: sua oferta não está mais disponível.');return false}
    const remaining=this.state.inventory.filter(item=>!idSet.has(String(item.id)))
    if(remaining.length+remoteOffer.items.length>(this.inventoryCapacity?.()||40)){this.cancelTrade('Troca cancelada: não há espaço suficiente na mochila.');return false}
    this.state.inventory=remaining
    this.state.gold-=localOffer.gold
    for(const raw of remoteOffer.items)this.addInventoryItem({...raw,id:`trade-${Date.now()}-${Math.random().toString(36).slice(2,8)}`})
    this.state.gold+=remoteOffer.gold
    this.state.trade={...trade,status:'completed'}
    this.saveGame()
    this.toast(`🤝 Troca concluída: recebeu ${remoteOffer.items.length} item(ns)${remoteOffer.gold?` e ${remoteOffer.gold}◈`:''}.`)
    return true
  }
  buyItem(shopId){const item=(this.state.merchant||[]).find(x=>x.id===shopId);if(!item||this.state.gold<item.value)return false;const stackable=['potion','pet_food'].includes(item.subtype)&&this.state.inventory.some(x=>x.subtype===item.subtype);if(!stackable&&this.state.inventory.length>=this.inventoryCapacity()){this.toast('Mochila cheia.');return false}this.state.gold-=item.value;if(['potion','pet_food'].includes(item.subtype)){const found=this.state.inventory.find(x=>x.subtype===item.subtype);if(found)found.qty=(found.qty||1)+1;else this.state.inventory.unshift({...item,id:`p-${Date.now()}`})}else{this.state.inventory.unshift({...item,id:`b-${Date.now()}-${Math.random()}`});this.state.merchant=this.state.merchant.filter(x=>x.id!==shopId)}this.toast('Compra realizada');return true}
  upgrade(slot){const item=this.state.equipment[slot];if(!item)return false;const level=item.upgrade||0;if(level>=10)return false;const cost=Math.round(80+(level+1)*65+item.level*4),ore=1+Math.floor(level/3);if(this.state.gold<cost||this.state.ores<ore)return false;this.state.gold-=cost;this.state.ores-=ore;item.upgrade=level+1;progressQuest(this.state,'upgrade',slot,1);this.recalcStats();this.toast(`${item.name} +${item.upgrade}`);return true}
  usePotion(){const p=this.state.inventory.find(x=>x.subtype==='potion'&&(x.qty||1)>0);if(!p||this.state.hp>=this.state.maxHp)return;p.qty=(p.qty||1)-1;this.state.hp=Math.min(this.state.maxHp,this.state.hp+(p.power||50));if(p.qty<=0)this.state.inventory=this.state.inventory.filter(x=>x!==p);this.toast('Poção usada')}

  acceptQuest(id){activateQuest(this.state,id);this.toast('Missão aceita')}
  claimQuest(id){
    const reward=claimQuest(this.state,id)
    if(!reward)return
    this.gainXp(reward.xp||0)
    if(reward.mount||reward.mountPermission){
      this.state.mount.unlocked=true
      this.state.mount.oathCompleted=true
      this.toast('🏆 Juramento Concluído! O Estábulo foi liberado para domação de montarias.')
    }else{
      this.toast('Recompensa recebida')
    }
    this.saveGame()
  }

  toggleMount(){
    if(!this.state.mount.unlocked&&!this.state.mount.oathCompleted){this.toast('Conclua o Juramento do Cavaleiro na Prefeitura para liberar montarias.');return}
    if(this.state.dungeon){this.toast('Montarias não entram em masmorras.');return}
    this.state.mount.active=!this.state.mount.active
    this.mountModel.visible=this.state.mount.active
    this.player.position.y=this.state.mount.active?1.25:0
    this.applyMountVisual()
    this.recalcStats()
    this.toast(this.state.mount.active?`Montaria invocada (${this.state.mount.name})`:'Montaria dispensada')
  }

  tameHorse(horseId){
    const horse=HORSE_BREEDS.find(h=>h.id===horseId)
    if(!horse)return false
    if(!this.state.mount.unlocked&&!this.state.mount.oathCompleted){
      this.toast('🔒 Realize o Juramento do Cavaleiro na Prefeitura primeiro!')
      return false
    }
    if((this.state.level||1)<horse.level){
      this.toast(`⚠️ Requer Nível ${horse.level} para tentar domar o ${horse.name}!`)
      return false
    }
    this.state.mount.tamedHorses||=[]
    if(this.state.mount.tamedHorses.includes(horseId)){
      return this.selectHorse(horseId)
    }
    if((this.state.gold||0)<horse.cost){
      this.toast(`Ouro insuficiente (${horse.cost}◈ necessários)!`)
      return false
    }
    this.state.gold-=horse.cost
    const roll=Math.random()*100
    if(roll<=horse.tameChance){
      if(!this.state.mount.tamedHorses.includes(horse.id))this.state.mount.tamedHorses.push(horse.id)
      this.state.mount.currentHorseId=horse.id
      this.state.mount.name=horse.name
      this.state.mount.speedBonus=horse.speedBonus
      this.state.mount.unlocked=true
      this.applyMountVisual()
      this.recalcStats()
      this.spawnAbilityRing(0x10b981,4.0,0.8)
      this.toast(`🎉 Magnífico! Você domou o ${horse.name} (${horse.tameChance}% chance)!`)
      this.saveGame()
      return true
    }else{
      this.toast(`💨 O ${horse.name} resistiu aos arreios e escapou! Tente novamente.`)
      this.saveGame()
      return false
    }
  }

  selectHorse(horseId){
    const horse=HORSE_BREEDS.find(h=>h.id===horseId)
    if(!horse)return false
    this.state.mount.tamedHorses||=[]
    if(!this.state.mount.tamedHorses.includes(horseId)){
      this.toast(`Você ainda não domou o ${horse.name}!`)
      return false
    }
    this.state.mount.currentHorseId=horse.id
    this.state.mount.name=horse.name
    this.state.mount.speedBonus=horse.speedBonus
    this.applyMountVisual()
    this.recalcStats()
    this.toast(`🐎 Montaria selecionada: ${horse.name} (+${horse.speedBonus} Vel)`)
    this.saveGame()
    return true
  }

  applyMountVisual(){
    if(!this.mountRig)return
    const horse=HORSE_BREEDS.find(h=>h.id===this.state.mount?.currentHorseId)
    const hex=horse?.color||0x6d4b35
    if(this.mountRig.coat)this.mountRig.coat.color.setHex(hex)
  }

  suspendCombatForUI(){
    this.freeLook=false;this.freeLookPointer=null;this.freeLookLast=null;this.state.blocking=false
    this.uiSuspendedCombat=!!this.combatMode
    if(this.isTouchDevice){this.combatMode=false;this.state.combatMode=false;if(document.pointerLockElement===this.canvas)document.exitPointerLock?.()}
    else if(this.combatMode)this.toggleCombatMode(false)
  }
  togglePanel(panel){
    const opening=this.state.uiPanel!==panel
    if(opening)this.suspendCombatForUI()
    this.state.uiPanel=opening?panel:null;this.state.dialogue=null
    if(!opening){
      if(this.isTouchDevice){this.combatMode=true;this.state.combatMode=true;this.uiSuspendedCombat=false}
      else if(this.uiSuspendedCombat){this.uiSuspendedCombat=false;this.toggleCombatMode(true)}
    }
    if(panel==='merchant'||panel==='blacksmith')this.refreshShop(panel);if(panel==='guild')refreshGuildBoard(this.state)
  }
  refreshShop(kind=this.state.uiPanel){const info=shopRefreshInfo();this.state.shopRefresh=info;this.state.merchant=merchantStock(this.state.level,this.currentMerchantZoneMin||1,info.cycle,kind==='blacksmith'?'blacksmith':'merchant',this.currentMerchantZoneId||'aurora',this.currentMerchantZoneMax||300);const eco=CITY_ECONOMIES[this.currentMerchantCityId]||Object.values(CITY_ECONOMIES).find(e=>e.zoneId===this.currentMerchantZoneId);if(eco)this.state.economy={cityId:this.currentMerchantCityId,...eco}}
  acceptGuildMission(id){activateGuildMission(this.state,id)}
  claimGuildMission(id){const reward=claimGuildMission(this.state,id);if(!reward)return;this.gainXp(reward.xp||0);this.toast(reward.advanced?`Rank da Guilda elevado para ${reward.rank}!`:`Contrato concluído • +${reward.guildPoints} pontos`)}

  createParty(){if(!this.multiplayer?.connected){this.toast('Conecte ao servidor LAN para criar uma equipe.');return}this.multiplayer.send({type:'party_create'});this.toast('Criando equipe da guilda...')}
  joinParty(playerId){if(!this.multiplayer?.connected||!playerId)return;this.multiplayer.send({type:'party_join',targetId:playerId});this.toast('Solicitando entrada na equipe...')}
  leaveParty(){if(!this.multiplayer?.connected)return;this.multiplayer.send({type:'party_leave'})}

  closePanel(){
    this.state.uiPanel=null;this.state.dialogue=null;this.freeLook=false;this.freeLookPointer=null;this.freeLookLast=null
    if(this.isTouchDevice){this.combatMode=true;this.state.combatMode=true;this.uiSuspendedCombat=false}
    else if(this.uiSuspendedCombat){this.uiSuspendedCombat=false;this.toggleCombatMode(true)}
  }

  updateClassAura(){
    if(!this.auraRoot){this.auraRoot=new THREE.Group();this.scene.add(this.auraRoot)}
    this.auraRoot.clear()
    const activeId=this.state.classState?.activeClassId||'mercenary_swordsman'
    const cls=CLASSES_LIST.find(c=>c.id===activeId)||CLASSES_LIST[0]
    const color=new THREE.Color(cls.auraColor||0x94a3b8)
    const ringGeo=new THREE.RingGeometry(.65,.85,24)
    const ringMat=new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.55})
    const ring=new THREE.Mesh(ringGeo,ringMat)
    ring.rotation.x=-Math.PI/2;ring.position.y=.04;this.auraRoot.add(ring)
  }
  awakenClass(){
    const awakeningCount=this.state.classState?.awakeningCount||0
    const requiredLevel=getNextGrimoireLevel(awakeningCount)
    if(this.state.level<requiredLevel){
      this.toast(`O Grimório exige Nível ${requiredLevel} para este despertar! (Nível atual: ${this.state.level})`)
      return null
    }
    const cost=calculateGrimoireCost(awakeningCount)
    const grimoireIndex=this.state.inventory.findIndex(i=>i.subtype==='grimoire'&&(i.qty||1)>0)
    if(grimoireIndex>=0){
      const g=this.state.inventory[grimoireIndex]
      g.qty=(g.qty||1)-1
      if(g.qty<=0)this.state.inventory.splice(grimoireIndex,1)
    }else if(this.state.gold>=cost){
      this.state.gold-=cost
    }else{
      this.toast(`Ouro insuficiente para adquirir o Grimório (${cost}◈ necessário).`)
      return null
    }
    const result=rollDestinyClass()
    const clsId=result.cls.id
    if(!this.state.classState.unlockedClassIds.includes(clsId)){
      this.state.classState.unlockedClassIds.push(clsId)
    }
    this.state.classState.awakeningCount=awakeningCount+1
    this.state.classState.rollsCount=(this.state.classState.rollsCount||0)+1
    this.switchClass(clsId)
    this.toast(`⭐ ALMA DESPERTADA: [${result.cls.name}] (${result.tierInfo.name})!`)
    this.saveGame()
    return result
  }
  switchClass(classId){
    if(!this.state.classState.unlockedClassIds.includes(classId))return
    this.state.classState.activeClassId=classId
    this.abilityCooldowns={}
    this.recalcStats()
    this.updateClassAura()
    this.updateAbilityCooldowns(0)
    const cls=CLASSES_LIST.find(c=>c.id===classId)
    this.toast(`Classe ativa: ${cls?.name||'Desperto'} • habilidade atualizada`)
    this.saveGame()
  }

  activePet(){return (this.state.pets?.owned||[]).find(p=>p.id===this.state.pets?.activeId)||null}
  armPetTaming(){
    const food=this.state.inventory.find(i=>i.subtype==='pet_food'&&(i.qty||1)>0)
    if(!food){this.toast('Compre uma Ração de Domação com o mercador.');return false}
    this.state.pets={...this.state.pets,tamingArmed:true};this.toast('🐾 Ração equipada: ataque um monstro enfraquecido para tentar domar.');return true
  }
  selectPet(id){
    const pet=(this.state.pets?.owned||[]).find(p=>p.id===id)
    if(!pet)return false
    if(pet.recoverUntil>Date.now()){this.toast(`${pet.name} ainda está se recuperando.`);return false}
    this.state.pets.activeId=id;this.syncPetVisual();this.saveGame();return true
  }
  syncPetVisual(){
    const pet=this.activePet(),root=this.state.dungeon?this.dungeonArena:this.worldRoot
    const key=pet?`${pet.id}:${pet.recoverUntil>Date.now()?'recovering':'ready'}:${root===this.dungeonArena?'dungeon':'world'}`:'none'
    if(key===this.petVisualKey)return
    this.petVisualKey=key
    if(!pet||pet.recoverUntil>Date.now()){if(this.petVisual){this.petVisual.parent?.remove(this.petVisual);this.petVisual=null}return}
    if(!this.petVisual){
      const g=new THREE.Group(),color=new THREE.Color(pet.color||'#60a5fa')
      const body=mesh(new THREE.DodecahedronGeometry(.42,0),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.35,roughness:.55}))
      const ear=mesh(new THREE.ConeGeometry(.16,.38,5),new THREE.MeshStandardMaterial({color:color.clone().multiplyScalar(.8)}));ear.position.set(0,.5,0)
      g.add(body,ear);this.petVisual=g;root.add(g)
    }else if(this.petVisual.parent!==root){this.petVisual.parent?.remove(this.petVisual);root.add(this.petVisual)}
  }
  tryTamePet(enemy){
    if(!this.state.pets?.tamingArmed||enemy.boss||(this.state.pets.owned||[]).length>=5||enemy.dead)return false
    const food=this.state.inventory.find(i=>i.subtype==='pet_food'&&(i.qty||1)>0)
    if(!food){this.state.pets.tamingArmed=false;return false}
    const hpPct=enemy.hp/Math.max(1,enemy.maxHp)
    if(hpPct>.55)return false
    food.qty=(food.qty||1)-1;if(food.qty<=0)this.state.inventory=this.state.inventory.filter(i=>i!==food)
    const cls=CLASSES_LIST.find(c=>c.id===this.state.classState?.activeClassId)
    const chance=Math.min(.72,.18+(1-hpPct)*.42+(cls?.passive?.tameChance||0))
    if(Math.random()>chance){this.toast(`A domação de ${enemy.name} falhou (${Math.round(chance*100)}%).`);return false}
    const pet={id:`pet-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,name:enemy.name,level:Math.max(1,enemy.level),xp:0,nextXp:Math.max(50,Math.round(enemy.level*85)),hp:Math.round(enemy.maxHp*.55),maxHp:Math.round(enemy.maxHp*.55),damage:Math.max(4,Math.round(enemy.atk*.48)),color:'#60a5fa',specialName:`Poder de ${enemy.name}`,recoverUntil:0}
    this.state.pets.owned=[...this.state.pets.owned,pet];this.state.pets.activeId=pet.id;this.state.pets.tamingArmed=false;enemy.dead=true;enemy.g.parent?.remove(enemy.g);this.enemies=this.enemies.filter(e=>e!==enemy);this.syncPetVisual();this.toast(`🐾 ${pet.name} foi domado! Agora luta ao seu lado.`);this.saveGame();return true
  }
  petAttackTarget(enemy){
    const pet=this.activePet();if(!pet||pet.recoverUntil>Date.now()||enemy?.dead)return
    const now=performance.now();if((pet.nextAttackAt||0)>now)return
    pet.nextAttackAt=now+1050;this.petTarget=enemy
    const damage=Math.max(1,Math.round(pet.damage*(.9+Math.random()*.2)));this.damageEnemy(enemy,damage,{knockback:.12,network:true,fromPet:true})
    pet.xp=(pet.xp||0)+Math.max(1,Math.round(enemy.level*.7));if(pet.xp>=pet.nextXp){pet.xp-=pet.nextXp;pet.level++;pet.nextXp=Math.round(pet.nextXp*1.28);pet.maxHp+=Math.max(8,Math.round(enemy.level*2));pet.hp=pet.maxHp;pet.damage+=Math.max(2,Math.round(enemy.level*.28));this.toast(`🐾 ${pet.name} subiu para Nv.${pet.level}!`)}
    if((pet.nextSpecialAt||0)<=now){pet.nextSpecialAt=now+5200;this.spawnAbilityRing(0x60a5fa,2.4,.35)}
  }
  updatePets(dt){
    const pet=this.activePet();this.syncPetVisual();if(!pet||!this.petVisual)return
    if(pet.recoverUntil>Date.now())return
    const follow=this.player.position.clone().add(new THREE.Vector3(1.25,0,-1.05));const dir=follow.sub(this.petVisual.position);dir.y=0;if(dir.lengthSq()>.04)this.petVisual.position.addScaledVector(dir.normalize(),Math.min(dir.length(),dt*7.4));this.petVisual.position.y=.55+Math.sin(performance.now()*.004)*.08
    const target=this.petTarget
    if(target&&!target.dead&&target.g?.visible&&target.g.position.distanceTo(this.petVisual.position)<2.4&&(pet.nextHurtAt||0)<performance.now()){
      pet.nextHurtAt=performance.now()+1500;pet.hp=Math.max(0,pet.hp-Math.max(2,Math.round(target.atk*.32)))
      if(!pet.hp){pet.recoverUntil=Date.now()+45000;this.petTarget=null;this.toast(`🐾 ${pet.name} caiu e ficará recuperando por 45s.`);this.saveGame()}
    }else if(!target&&!pet.recoverUntil)pet.hp=Math.min(pet.maxHp,pet.hp+pet.maxHp*dt*.04)
  }
  fastTravelTo(nodeId){
    const dest=TRAVEL_NODES.find(n=>n.id===nodeId)
    if(!dest)return
    if((this.state.level||1)<dest.minLevel){this.toast(`Essa rota requer Nível ${dest.minLevel}.`);return}
    if(!this.state.travelState?.nodes?.[nodeId])this.state.travelState.nodes[nodeId]={unlocked:false,vipPass:false}
    const travelData=this.state.travelState.nodes[nodeId]
    const cost=calculateTravelCost(this.player.position,dest,travelData.vipPass)
    if(!travelData.vipPass&&this.state.gold<cost){this.toast(`Ouro insuficiente. Custo da viagem: ${cost} ◈`);return}
    if(!travelData.vipPass)this.state.gold-=cost
    travelData.unlocked=true
    this.closePanel()
    if(rollRoadAmbush()){
      this.toast('⚔ EMBOSCADA NA ESTRADA! Bandidos interceptaram sua caravana!')
      const ambX=dest.x+(Math.random()-.5)*14,ambZ=dest.z+(Math.random()-.5)*14
      this.player.position.set(ambX,0,ambZ)
      for(let i=0;i<3;i++){
        const e=this.makeEnemy(ambX+(Math.random()-.5)*8,ambZ+(Math.random()-.5)*8,Math.max(1,dest.minLevel),'Salteador da Estrada',false)
        this.enemies.push(e)
      }
    }else{
      this.player.position.set(dest.x,0,dest.z)
      this.toast(`✈ Viagem concluída: Chegou a ${dest.name}!`)
    }
    this.repopulateVisibleChunks()
    this.saveGame()
  }
  buyVipPass(nodeId){
    const vipCost=Math.max(5000,this.state.travelState?.vipCost||5000)
    if(this.state.gold<vipCost){this.toast(`Ouro insuficiente para o Cristal VIP (${vipCost} ◈)`);return}
    this.state.gold-=vipCost
    if(!this.state.travelState.nodes[nodeId])this.state.travelState.nodes[nodeId]={unlocked:true,vipPass:false}
    this.state.travelState.nodes[nodeId].vipPass=true
    this.toast('✨ Cristal de Teletransporte Permanente Ativado!')
    this.saveGame()
  }
  toast(msg){this.state.toast={id:Date.now(),msg};setTimeout(()=>{if(this.state.toast?.msg===msg)this.state.toast=null},2200)}

  openGateModal(gate){this.gateManager?.openGateModal(gate)}
  closeGateModal(){this.gateManager?.closeGateModal()}
  startSoloDungeon(gate){this.gateManager?.confirmSoloEntry(gate)}
  startPartyReadyCheck(gate){this.gateManager?.startPartyReadyCheck(gate)}
  confirmPartyReady(gate){this.gateManager?.confirmPartyReady(gate)}
  cancelPartyReadyCheck(){this.gateManager?.closeGateModal()}
  closeDungeonCompletion(){this.gateManager?.leaveDungeon()}
  abandonDungeon(){this.gateManager?.leaveDungeon()}
  setDestinationMarker(gate){this.gateManager?.setDestinationMarker(gate)}
  clearDestinationMarker(){this.gateManager?.clearDestinationMarker()}
  closeCaravanModal(){this.caravanManager?.closeCaravanModal()}
  lootCaravan(id){return this.caravanManager?.lootCaravanById(id)||false}

  interact(){
    if(this.state.uiPanel){this.closePanel();return}
    if(this.caravanManager&&this.caravanManager.onInteract())return
    if(this.gateManager&&this.gateManager.onInteract())return
    const portal=this.portals.find(q=>q.g.visible&&q.g.position.distanceTo(this.player.position)<3.8);if(portal){this.enterDungeon(portal);return}
    let near=null,dist=4.2;for(const n of this.npcs){const d=n.g.position.distanceTo(this.player.position);if(d<dist){near=n;dist=d}}
    if(near){
      this.suspendCombatForUI()
      if(near.def.role==='traveler'){
        const nodeId=near.def.zoneId||'aurora'
        this.state.travelState ||= defaultTravelState()
        this.state.travelState.nodes ||= {}
        this.state.travelState.nodes[nodeId]={...(this.state.travelState.nodes[nodeId]||{}),unlocked:true,vipPass:!!this.state.travelState.nodes[nodeId]?.vipPass}
        this.state.dialogue={name:near.def.name,title:near.def.title,text:near.def.dialogue||'Minha caravana viaja entre os postos e cidadelas de Asterra. Para onde deseja viajar?'};
        this.state.uiPanel='travel';
        this.saveGame()
        return
      }
      this.state.dialogue={name:near.def.name,title:near.def.title,text:near.def.dialogue};
      this.state.uiPanel=near.def.role==='quest'?'quests':near.def.role;
      if(near.def.role==='merchant'||near.def.role==='blacksmith'){const z=ZONES.find(q=>q.id===near.def.zoneId);this.currentMerchantZoneMin=z?.min||1;this.currentMerchantZoneMax=z?.max||300;this.currentMerchantZoneId=near.def.zoneId||'aurora';this.currentMerchantCityId=near.def.cityId||'aurora-city';this.state.currentCity=near.def.cityName||null;this.refreshShop(near.def.role)}
      if(near.def.role==='guild')refreshGuildBoard(this.state)
      return
    }
    const resourceTarget=this.getCrosshairResourceNode(4.2,.45)
    if(resourceTarget){
      this.attack(true)
    }
  }

  enterDungeon(p){
    this.state.mount.active=false;this.mountModel.visible=false;this.player.position.y=0;this.dungeonReturnPosition={x:this.player.position.x,z:this.player.position.z}
    this.state.dungeon={name:p.name,rarity:p.rarity.name,color:p.rarity.color,level:p.level,floor:1,floors:p.floors,transition:false,worldSeed:Math.floor(hash2(Math.round(p.x),Math.round(p.z))*999999)};this.clearEnemies();this.setWorldVisible(false);this.dungeonArena.visible=true;this.activeWorld='dungeon';this.player.position.set(0,0,9);this.scene.background.set(0x090711);this.scene.fog.color.set(0x090711);this.scene.fog.near=22;this.scene.fog.far=62;this.spawnDungeonFloor();this.closePanel();this.toast(`Entrando em ${p.name} — mundo instanciado`)
  }
  setWorldVisible(v){for(const c of this.chunks.values())c.group.visible=v;for(const c of this.cityGroups||[])c.group.visible=v;for(const r of this.roadMeshes||[])r.mesh.visible=v;for(const lm of this.landmarkMeshes||[])lm.group.visible=v;for(const n of this.npcs)n.g.visible=v;for(const p of this.portals)p.g.visible=v}
  clearEnemies(){for(const e of this.enemies){this.worldRoot.remove(e.g);this.dungeonArena.remove(e.g)}this.enemies=[]}
  repopulateVisibleChunks(){for(const c of this.chunks.values())this.spawnChunkMobs(c.cx,c.cz,c.zone,c.key)}
  spawnDungeonFloor(){const d=this.state.dungeon;if(!d)return;this.toast(`${d.name} • Andar ${d.floor}/${d.floors}`);const count=4+d.floor*2;for(let i=0;i<count;i++){const a=i/count*Math.PI*2,r=9+(i%3)*4;this.enemies.push(this.makeEnemy(Math.cos(a)*r,Math.sin(a)*r,d.level+d.floor*2,`Guardião do Andar ${d.floor}`,false,null,null,`d:${d.worldSeed}:${d.floor}:mob:${i}`))}if(d.floor===d.floors)this.enemies.push(this.makeEnemy(0,-17,d.level+d.floor*3,`Chefe — ${d.name}`,true,null,null,`d:${d.worldSeed}:${d.floor}:boss`))}
  advanceDungeonIfClear(){const d=this.state.dungeon;if(!d)return;if(!this.enemies.some(e=>!e.dead)&&!d.transition){d.transition=true;setTimeout(()=>{if(!this.state.dungeon)return;if(d.floor<d.floors){d.floor++;d.transition=false;this.spawnDungeonFloor()}else{this.state.stats.dungeons++;progressQuest(this.state,'dungeon','clear',1);progressGuildMissions(this.state,'dungeon','clear',1);this.state.dungeon=null;this.activeWorld='open';this.dungeonArena.visible=false;this.setWorldVisible(true);this.player.position.set(this.dungeonReturnPosition?.x||0,0,(this.dungeonReturnPosition?.z||0)+5);this.repopulateVisibleChunks();this.scene.fog.near=65;this.scene.fog.far=155;d.transition=false;this.toast('Masmorra concluída! Retornando a Asterra.')}} ,850)}}

  updatePortals(t){for(const p of this.portals){const d=Math.hypot(this.player.position.x-p.x,this.player.position.z-p.z);p.g.visible=!this.state.dungeon&&d<WORLD.decorDistance;if(p.g.visible){p.ring.rotation.z+=.008;p.core.rotation.z-=.004;p.sparks.forEach((s,i)=>{const a=t*1.5+s.userData.phase;s.position.set(Math.cos(a)*1.8,1.7+Math.sin(a*1.7)*.9,Math.sin(a)*.15)})}}}

  updateWater(t){for(const c of this.chunks.values()){if(!c.group.visible)continue;c.group.traverse(o=>{if(o.userData.water){o.position.y=.12+Math.sin(t*1.5+c.cx*.7+c.cz)*.025}})}}

  updateWeather(dt,t){
    if(this.state.dungeon){this.rain.visible=false;return}
    this.weatherClock+=dt;if(this.weatherClock>55){this.weatherClock=0;this.weatherIndex=(this.weatherIndex+1)%4}
    const weather=['Céu limpo','Brisa','Chuva','Tempestade'][this.weatherIndex];this.state.weather=weather;const raining=weather==='Chuva'||weather==='Tempestade';this.rain.visible=raining
    if(raining){this.rain.position.set(this.player.position.x,0,this.player.position.z);const p=this.rain.geometry.attributes.position.array;for(let i=0;i<p.length/3;i++){p[i*3+1]-=dt*(weather==='Tempestade'?23:16);if(p[i*3+1]<0){p[i*3+1]=28;p[i*3]=(Math.random()-.5)*50;p[i*3+2]=(Math.random()-.5)*50}}this.rain.geometry.attributes.position.needsUpdate=true}
    const zone=this.state.dungeon?null:zoneAt(this.player.position.x,this.player.position.z,ZONES);const fogBase=weather==='Tempestade'?95:weather==='Chuva'?120:155;this.scene.fog.far=damp(this.scene.fog.far,fogBase,1.5,dt)
  }

  updateDayNight(dt){
    if(this.state.dungeon){this.state.time='--:--';return}
    this.dayHours=(this.dayHours+dt*.034)%24;this.state.timeHours=this.dayHours;this.state.time=fmtTime(this.dayHours)
    const a=(this.dayHours/24)*Math.PI*2-Math.PI/2,day=Math.max(.06,Math.sin(a)*.5+.5);this.sun.position.set(Math.cos(a)*70,Math.sin(a)*85,25);this.sun.intensity=.12+day*2.55;this.moon.intensity=.08+(1-day)*.5;this.hemi.intensity=.35+day*1.05
    const dayCol=new THREE.Color(0x8bc8ee),dusk=new THREE.Color(0xa16e78),night=new THREE.Color(0x071326);let sky;if(day>.5)sky=dayCol;else if(day>.2)sky=dusk.clone().lerp(dayCol,(day-.2)/.3);else sky=night.clone().lerp(dusk,day/.2)
    this.scene.background.copy(sky);this.scene.fog.color.copy(sky)
  }

  updateEnemies(dt,t){
    for(const e of this.enemies){
      if(e.dead)continue;e.mixer?.update(dt)
      const dPlayer=e.g.position.distanceTo(this.player.position);let victim=this.player,victimBot=null,d=dPlayer
      if(!this.state.dungeon){for(const bot of this.bots){if(bot.dead||!bot.g.visible)continue;const bd=e.g.position.distanceTo(bot.g.position);if(bd<d&&bd<14){d=bd;victim=bot.g;victimBot=bot}}}
      e.g.visible=this.state.dungeon||dPlayer<WORLD.mobDistance;if(!e.g.visible)continue
      if(e.label&&(e.label.lastHp!==e.hp||e.label.lastLevel!==e.level))this.updateMobLabel(e)
      e.attackAnim=Math.max(0,(e.attackAnim||0)-dt);e.specialTimer=(e.specialTimer??999)-dt
      const gait=Math.sin(t*7+e.phase)*.55;e.legs[0].rotation.x=gait;e.legs[1].rotation.x=-gait
      const lunge=e.attackAnim>0?Math.sin(Math.min(1,e.attackAnim/.34)*Math.PI)*.28:0;e.body.position.y=e.baseBodyY+Math.sin(t*3+e.phase)*.025;e.body.rotation.x=damp(e.body.rotation.x,e.attackAnim>0?-.38:0,12,dt);e.head.rotation.x=damp(e.head.rotation.x,e.attackAnim>0?.22:0,12,dt)
      if(e.specialTimer<=0&&d<14){
        const keyName=e.name.toLowerCase()
        e.specialTimer=e.specialCooldown||(e.boss?6:Math.max(4.5,8.5-Math.min(4,e.level*0.04)))
        e.attackAnim=.65
        const mobRank = (e.level >= 10) ? (1 + Math.floor((e.level - 10) / 20)) : 0
        if(e.boss){
          const targetPos=victim.position.clone()
          this.spawnAbilityRing(0xef4444,4.2,1.2)
          if(!victimBot&&dPlayer<16)this.toast(`⚠️ ${e.name} invocou Juízo Arcano!`)
          setTimeout(()=>{
            if(e.dead)return
            if(targetPos.distanceTo(victim.position)<4.2){
              const dmg=Math.max(3,Math.round(e.atk*1.65-(victimBot?victimBot.def*.35:this.state.def*.35)))
              if(victimBot){
                victimBot.hp=Math.max(0,victimBot.hp-dmg)
                this.updatePlayerNameplate(victimBot.label,{name:`${victimBot.name} [IA]`,level:victimBot.level,hp:victimBot.hp,maxHp:victimBot.maxHp,guildRank:victimBot.guildRank},false)
                if(victimBot.hp<=0)this.killBot(victimBot,{byPlayer:false})
              }else if(this.invuln<=0&&!this.isInsideCitySafeZone(this.player.position.x,this.player.position.z,1)){
                this.damagePlayer(dmg)
                this.haptic(35)
              }
            }
          },1100)
        }else if(e.level>=10){
          this.spawnMobSpecialAttack(e, victim, victimBot, mobRank)
        }else{
          this.spawnAbilityRing(0xef4444,2.8,.5)
          if(!victimBot&&d<10)this.toast(`🐺 ${e.name} usou Investida Furiosa!`)
          if(d<4.0){
            const dmg=Math.max(2,Math.round(e.atk*1.2))
            if(victimBot){
              victimBot.hp=Math.max(0,victimBot.hp-Math.max(1,Math.round(dmg-victimBot.def*.35)))
            }else if(this.invuln<=0&&!this.isInsideCitySafeZone(this.player.position.x,this.player.position.z,1)){
              this.damagePlayer(Math.max(1,Math.round(dmg-this.state.def*.35)))
            }
          }
        }
      }
      if(d<16&&d>1.7){const dir=victim.position.clone().sub(e.g.position);dir.y=0;if(dir.lengthSq())dir.normalize();const step=(e.boss?2.2:2.75)*dt,next=e.g.position.clone().addScaledVector(dir,step),safe=this.cityAt(next.x,next.z,2.5);if(!safe&&this.canOccupy(next.x,next.z,e.boss?1.1:.55)){e.g.position.copy(next)}else if(safe){const away=e.g.position.clone().sub(new THREE.Vector3(safe.x,0,safe.z)).normalize();e.g.position.addScaledVector(away,step*.45)}e.g.rotation.y=Math.atan2(dir.x,dir.z);if(lunge)e.g.position.addScaledVector(dir,lunge*dt)}
      if(d<=1.85&&performance.now()-e.last>1100){e.last=performance.now();e.attackAnim=.34;if(victimBot){const dmg=Math.max(1,Math.round(e.atk-victimBot.def*.42));victimBot.hp=Math.max(0,victimBot.hp-dmg);this.updatePlayerNameplate(victimBot.label,{name:`${victimBot.name} [IA]`,level:victimBot.level,hp:victimBot.hp,maxHp:victimBot.maxHp,guildRank:victimBot.guildRank},false);if(victimBot.hp<=0)this.killBot(victimBot,{byPlayer:false})}else if(!this.isInsideCitySafeZone(this.player.position.x,this.player.position.z,1)){this.damagePlayer(Math.max(1,Math.round(e.atk-this.state.def*.45)))}}
    }
  }

  spawnMobSpecialAttack(mob, victim, victimBot, rank=1){
    const key=mob.name.toLowerCase()
    let effectType='acid', color=0x22c55e, emissive=0x15803d, namePower='Gosma Ácida', speed=13.5, maxDist=24
    const dmgMult=1.0+(rank-1)*0.35
    const dmg=Math.max(3,Math.round(mob.atk*1.25*dmgMult))
    const scale=Math.min(2.1,0.85+(rank-1)*0.22)
    let pGeo,pMat

    if(key.includes('slime')){
      effectType='acid'; color=0x22c55e; emissive=0x16a34a; namePower='Gosma Ácida'; speed=13.2
      pGeo=new THREE.SphereGeometry(0.25*scale,12,12)
      pMat=new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:0.95,roughness:0.25})
    }else if(key.includes('golem')||key.includes('gigante')||key.includes('bruto')||key.includes('colosso')||key.includes('xisto')){
      effectType='boulder'; color=0xb45309; emissive=0x78350f; namePower='Rocha Sísmica'; speed=11.5
      pGeo=new THREE.DodecahedronGeometry(0.32*scale,0)
      pMat=new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:0.85,roughness:0.75})
    }else if(key.includes('esqueleto')||key.includes('espectro')||key.includes('treant')||key.includes('cavaleiro')||key.includes('cinzento')){
      effectType='void'; color=0xa855f7; emissive=0x6b21a8; namePower='Orbe Umbral'; speed=14.2
      pGeo=new THREE.SphereGeometry(0.26*scale,12,12)
      pMat=new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:1.1,roughness:0.3})
    }else{
      effectType='wind'; color=0x38bdf8; emissive=0x0284c7; namePower='Lâmina de Vento'; speed=16.0
      pGeo=new THREE.TorusGeometry(0.28*scale,0.08*scale,8,16)
      pMat=new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:1.0,roughness:0.3})
    }

    const pMesh=new THREE.Mesh(pGeo,pMat)
    pMesh.castShadow=true
    const startPos=mob.g.position.clone().add(new THREE.Vector3(0,mob.boss?1.8:0.95,0))
    const targetPos=victim.position.clone().add(new THREE.Vector3(0,1.0,0))
    pMesh.position.copy(startPos)
    const dir=targetPos.clone().sub(startPos).normalize()
    this.worldRoot.add(pMesh)

    this.projectiles.push({
      fromMob:true,
      mob,
      victimBot,
      mesh:pMesh,
      pos:startPos,
      dir,
      speed,
      dist:0,
      maxDist,
      dmg,
      rank,
      effectType,
      color
    })

    const rankRom=['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][rank]||`★${rank}`
    if(!victimBot&&mob.g.position.distanceTo(this.player.position)<16){
      this.toast(`⚡ ${mob.name} disparou ${namePower} (Rank ${rankRom})!`)
    }
  }

  updateAbilityCooldowns(dt){
    const abilities=this.activeAbilities()
    for(const a of abilities)this.abilityCooldowns[a.id]=Math.max(0,(this.abilityCooldowns[a.id]||0)-dt)
    this.state.abilities=abilities.map(a=>({...a,remaining:this.abilityCooldowns[a.id]||0,ready:(this.abilityCooldowns[a.id]||0)<=0&&this.state.stamina>=a.cost}))
  }

  updateDiscovery(){
    const cell=WORLD.mapCellSize,cx=Math.round(this.player.position.x/cell),cz=Math.round(this.player.position.z/cell),radius=2
    for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++)if(dx*dx+dz*dz<=radius*radius+1)this.discovered.add(`${cx+dx},${cz+dz}`)
  }

  updatePlayer(dt,t){
    if(this.state.hp<=0){
      this.combatCooldown=0;this.inCombat=false;this.state.inCombat=false;this.state.combatTimer=0;
      this.state.hp=this.state.maxHp;this.state.mount.active=false;this.mountModel.visible=false;this.respawnPlayerAt('aurora-city');this.setWorldVisible(true);this.state.dungeon=null;this.dungeonArena.visible=false;this.repopulateVisibleChunks();this.toast('Você retornou à Cidadela Aurora.')
    }
    if(this.combatCooldown>0){
      this.combatCooldown=Math.max(0,this.combatCooldown-dt)
      this.inCombat=this.combatCooldown>0
      this.state.inCombat=this.inCombat
      this.state.combatTimer=Math.ceil(this.combatCooldown)
    }else if(this.state.inCombat){
      this.inCombat=false
      this.state.inCombat=false
      this.state.combatTimer=0
    }
    this.state.stamina=Math.min(this.state.maxStamina,this.state.stamina+18*dt)
    if(!this.state.inCombat&&this.state.stamina>=this.state.maxStamina-0.5&&this.state.hp<this.state.maxHp&&!this.state.dungeon?.transition){
      const hpRatePerSec=Math.max(4,this.state.maxHp*0.045)
      this.state.hp=Math.min(this.state.maxHp,this.state.hp+hpRatePerSec*dt)
      this.restedRegenTimer=(this.restedRegenTimer||0)+dt
      if(this.restedRegenTimer>=1.2){
        this.restedRegenTimer=0
        const gainVal=Math.max(2,Math.round(hpRatePerSec*1.2))
        this.spawnDamageText(this.player.position,`+${gainVal} HP`,false,'#4ade80')
      }
    }else{
      this.restedRegenTimer=0
    }
    this.attackClock=Math.max(0,this.attackClock-dt);this.specialClock=Math.max(0,this.specialClock-dt);this.specialAnim=Math.max(0,this.specialAnim-dt);this.invuln=Math.max(0,this.invuln-dt);this.updateAbilityCooldowns(dt)
    const f=V3().set(Math.sin(this.yaw),0,Math.cos(this.yaw)).normalize(),r=V3().set(-f.z,0,f.x),m=V3()
    if(!this.state.uiPanel){if(this.keys.KeyW)m.add(f);if(this.keys.KeyS)m.sub(f);if(this.keys.KeyA)m.sub(r);if(this.keys.KeyD)m.add(r);if(Math.abs(this.virtualMove.x)>.03||Math.abs(this.virtualMove.z)>.03){m.addScaledVector(r,this.virtualMove.x);m.addScaledVector(f,this.virtualMove.z)}}
    const moving=m.lengthSq()>0
    const sprint=(this.keys.ControlLeft||this.state.mobileRunning)&&this.state.stamina>2&&!this.state.mount.active
    if(moving){
      m.normalize();const facing=this.combatMode?this.yaw:Math.atan2(m.x,m.z);this.player.rotation.y=damp(this.player.rotation.y,facing,this.combatMode?18:12,dt)
      if(sprint)this.state.stamina=Math.max(0,this.state.stamina-10*dt)
      const sp=this.state.speed*(sprint?1.42:1)*(this.dashTime>0?3.25:1);const delta=m.clone().multiplyScalar(sp*dt);this.moveWithCollisions(delta)
      this.player.userData.motion=this.specialAnim>0?'special':this.dashTime>0?'dash':!this.grounded?'jump':sprint?'run':'walk'
    }else if(this.attackClock<=0)this.player.userData.motion=this.specialAnim>0?'special':!this.grounded?'jump':'idle'

    if(!this.state.mount.active){
      if(!this.grounded||Math.abs(this.verticalVelocity)>.001){this.player.position.y+=this.verticalVelocity*dt;this.verticalVelocity-=20.5*dt}
      if(this.player.position.y<=0){this.player.position.y=0;this.verticalVelocity=0;this.grounded=true}
    }else{this.player.position.y=1.25;this.verticalVelocity=0;this.grounded=true}

    if(this.dashTime>0)this.dashTime-=dt
    if(!this.state.dungeon){this.player.position.x=clamp(this.player.position.x,-WORLD.worldLimit,WORLD.worldLimit);this.player.position.z=clamp(this.player.position.z,-WORLD.worldLimit,WORLD.worldLimit);this.updateDiscovery()}
    this.animatePlayer(dt,t,moving)
    if(this.state.mount.active){this.mountModel.position.copy(this.player.position);this.mountModel.position.y=0;this.mountModel.rotation.y=this.player.rotation.y;this.animateMount(t,moving)}
  }

  animatePlayer(dt,t,moving){
    if(this.externalPlayer){this.playerMixer?.update(dt);this.playPlayerAction(this.player.userData.motion);return}
    if(!this.rig)return
    const motion=this.player.userData.motion,gait=motion==='run'?10:motion==='walk'?7:0,amp=motion==='run'?.8:motion==='walk'?.55:0
    const swing=moving?Math.sin(t*gait)*amp:0;this.rig.legL.rotation.x=damp(this.rig.legL.rotation.x,swing,12,dt);this.rig.legR.rotation.x=damp(this.rig.legR.rotation.x,-swing,12,dt)
    if(motion==='special'){const wave=Math.sin((1-Math.min(1,this.specialAnim/.55))*Math.PI);this.rig.shoulderL.rotation.x=damp(this.rig.shoulderL.rotation.x,-1.35-wave*.8,14,dt);this.rig.shoulderR.rotation.x=damp(this.rig.shoulderR.rotation.x,-1.1+wave*.5,14,dt);this.rig.torso.rotation.y=Math.sin(t*18)*.12}
    else if(this.attackClock<=0){this.rig.torso.rotation.y=damp(this.rig.torso.rotation.y,0,10,dt);this.rig.shoulderL.rotation.x=damp(this.rig.shoulderL.rotation.x,-swing*.55,10,dt);this.rig.shoulderR.rotation.x=damp(this.rig.shoulderR.rotation.x,swing*.55,10,dt);this.rig.swordPivot.rotation.z=damp(this.rig.swordPivot.rotation.z,0,12,dt)}
    else {const k=1-this.attackClock/.34;this.rig.shoulderR.rotation.x=-1.2+Math.sin(k*Math.PI)*2.35;this.rig.swordPivot.rotation.z=-.8+Math.sin(k*Math.PI)*1.2}
    this.rig.hips.position.y=1.03+(moving?Math.abs(Math.sin(t*gait))*0.055:Math.sin(t*2)*.018);this.rig.cape.rotation.x=.12+(moving?.22:.05)+Math.sin(t*3)*.035
  }
  animateMount(t,moving){if(!this.mountRig)return;const s=moving?Math.sin(t*10)*.65:0;this.mountRig.legs[0].rotation.x=s;this.mountRig.legs[1].rotation.x=-s;this.mountRig.legs[2].rotation.x=-s;this.mountRig.legs[3].rotation.x=s;this.mountRig.body.position.y=1.05+(moving?Math.abs(Math.sin(t*10))*.06:0)}

  cameraFollow(dt){
    if(!this.camera||!this.player)return
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

  updateNPCs(t,dt=.016){for(const n of this.npcs){n.mixer?.update(dt);n.marker.position.y=2.55+Math.sin(t*2+n.g.position.x)*.08;n.marker.rotation.y+=.018;n.g.rotation.y+=Math.sin(t*.7+n.g.position.z)*.0006}}

  updateInteractions(){
    let prompt=null,action=null
    if(this.caravanManager){
      const cPrompt=this.caravanManager.getInteractionPrompt()
      if(cPrompt){
        prompt=cPrompt.prompt
        action=cPrompt.action
      }
    }
    if(!prompt&&this.gateManager){
      const gatePrompt=this.gateManager.getInteractionPrompt()
      if(gatePrompt){
        prompt=gatePrompt.prompt
        action=gatePrompt.action
      }
    }
    if(!prompt){
      const p=this.portals.find(q=>q.g.visible&&q.g.position.distanceTo(this.player.position)<4.5)
      if(p){
        prompt=`E — entrar em ${p.name}`
        action={type:'portal',label:`Entrar em ${p.name}`,icon:'🌀'}
      }
    }
    if(!prompt&&!this.state.dungeon){
      let near=null,dist=4.3
      for(const n of this.npcs){const d=n.g.position.distanceTo(this.player.position);if(d<dist){near=n;dist=d}}
      if(near){
        const roleIcon=near.def.role==='merchant'?'🛒':near.def.role==='blacksmith'?'⚒️':near.def.role==='traveler'?'🧭':near.def.role==='townhall'?'🏛️':near.def.role==='guild'?'⚔️':near.def.role==='stable'?'🐎':near.def.role==='pets'?'🐾':'📜'
        prompt=`E — falar com ${near.def.name} (${near.def.title})`
        action={type:'npc',label:`Falar com ${near.def.name}`,icon:roleIcon}
      }
    }
    if(!prompt&&!this.state.dungeon){
      let nearRes=null,minDist=3.8
      for(const rn of this.resourceNodes){
        if(rn.hp>0&&rn.mesh?.visible){
          const d=Math.hypot(rn.gx-this.player.position.x,rn.gz-this.player.position.z)
          if(d<minDist){nearRes=rn;minDist=d}
        }
      }
      if(nearRes){
        const verb=nearRes.type==='tree'?'Cortar':'Minerar'
        prompt=`E ou Ataque — ${verb} ${nearRes.name}`
        action={type:'resource',label:`${verb} ${nearRes.name}`,icon:nearRes.icon}
      }
    }
    this.state.interactionPrompt=prompt
    this.state.actionButton=action
  }

  currentWorldId(){return this.state.dungeon?`dungeon:${this.state.dungeon.worldSeed}:${this.state.dungeon.floor}`:'open'}

  makeRemoteAvatar(player){
    const g=new THREE.Group();g.name=`Remote-${player.id}`
    const rankHex=rankColor(player.guildRank||'E'), cloth=mat(rankHex,{roughness:.65}), skin=mat(0xe8b78f), hairMat=mat(0x2d221e), dark=mat(0x1d2a3b), leather=mat(0x6b4026), metal=mat(0xd6dee8,{metalness:.6,roughness:.3})
    const hips=new THREE.Group(); hips.position.y=1.03; g.add(hips)
    const torso=mesh(new THREE.CapsuleGeometry(.36,.64,5,10),cloth); torso.position.y=.35; hips.add(torso)
    const belt=mesh(new THREE.BoxGeometry(.8,.13,.34),leather); belt.position.y=.05; hips.add(belt)
    const neck=new THREE.Group(); neck.position.y=.92; hips.add(neck)
    const head=mesh(new THREE.SphereGeometry(.29,16,12),skin); head.position.y=.28; neck.add(head)
    const hairCap=mesh(new THREE.SphereGeometry(.305,12,8,0,Math.PI*2,0,Math.PI*.58),hairMat); hairCap.position.y=.36; neck.add(hairCap)
    const eyeMat=new THREE.MeshBasicMaterial({color:0x111827})
    const eyeL=mesh(new THREE.BoxGeometry(.05,.05,.02),eyeMat), eyeR=mesh(new THREE.BoxGeometry(.05,.05,.02),eyeMat)
    eyeL.position.set(-.1,.29,.27); eyeR.position.set(.1,.29,.27); neck.add(eyeL,eyeR)

    const shoulderL=new THREE.Group(), shoulderR=new THREE.Group(); shoulderL.position.set(-.46,.7,0); shoulderR.position.set(.46,.7,0); hips.add(shoulderL,shoulderR)
    const armGeo=new THREE.CapsuleGeometry(.105,.48,4,7); const handGeo=new THREE.SphereGeometry(.12,8,7)
    const armL=mesh(armGeo,skin),armR=mesh(armGeo,skin); armL.position.y=-.31;armR.position.y=-.31;shoulderL.add(armL);shoulderR.add(armR)
    const handL=mesh(handGeo,skin),handR=mesh(handGeo,skin);handL.position.y=-.63;handR.position.y=-.63;shoulderL.add(handL);shoulderR.add(handR)

    const legL=new THREE.Group(),legR=new THREE.Group();legL.position.set(-.2,-.02,0);legR.position.set(.2,-.02,0);hips.add(legL,legR)
    const legGeo=new THREE.CapsuleGeometry(.14,.65,4,7);const legMeshL=mesh(legGeo,dark),legMeshR=mesh(legGeo,dark);legMeshL.position.y=-.5;legMeshR.position.y=-.5;legL.add(legMeshL);legR.add(legMeshR)
    const bootGeo=new THREE.BoxGeometry(.28,.22,.48);const bootL=mesh(bootGeo,leather),bootR=mesh(bootGeo,leather);bootL.position.set(0,-.93,.08);bootR.position.set(0,-.93,.08);legL.add(bootL);legR.add(bootR)
    const cape=mesh(new THREE.PlaneGeometry(.72,1.18,2,4),mat(mixHex(rankHex,0x101828,.4),{side:THREE.DoubleSide}));cape.position.set(0,.48,-.38);cape.rotation.x=.12;hips.add(cape)

    const swordPivot=new THREE.Group(); swordPivot.position.set(.08,-.56,.02); shoulderR.add(swordPivot)
    const blade=mesh(new THREE.BoxGeometry(.085,.95,.055),metal);blade.position.y=-.48;swordPivot.add(blade)
    const guard=mesh(new THREE.BoxGeometry(.42,.07,.09),mat(0xb99645,{metalness:.5}));guard.position.y=.02;swordPivot.add(guard)
    const grip=mesh(new THREE.CylinderGeometry(.045,.045,.28,8),leather);grip.position.y=.17;swordPivot.add(grip)

    const marker=this.makePlayerNameplate(player,false);marker.position.y=2.76;g.add(marker)
    g.position.set(Number(player.x)||0, Number(player.y)||0, Number(player.z)||0)
    g.rotation.y = Number(player.r)||0
    this.scene.add(g)
    return {g,hips,torso,neck,head,shoulderL,shoulderR,armL,armR,legL,legR,bootL,bootR,cape,swordPivot,marker,target:{x:Number(player.x)||0,y:Number(player.y)||0,z:Number(player.z)||0,r:Number(player.r)||0},data:player,phase:Math.random()*Math.PI*2}
  }
  makePlayerNameplate(data={},local=false){
    const c=document.createElement('canvas');c.width=640;c.height=184;const tx=new THREE.CanvasTexture(c);tx.minFilter=THREE.LinearFilter;tx.magFilter=THREE.LinearFilter
    tx.colorSpace=THREE.SRGBColorSpace;const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tx,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));sp.scale.set(local?3.2:3.35,local?.92:.96,1);sp.renderOrder=30;sp.userData={canvas:c,ctx:c.getContext('2d'),texture:tx,last:''};this.updatePlayerNameplate(sp,data,local);return sp
  }
  updatePlayerNameplate(sprite,data={},local=false){
    if(!sprite?.userData?.ctx)return
    const name=String(data.name||'Aventureiro').slice(0,24),level=Math.max(1,Number(data.level)||1),rank=String(data.guildRank||'E').slice(0,8),hp=Math.max(0,Number(data.hp)||0),maxHp=Math.max(1,Number(data.maxHp)||1),key=`${name}|${level}|${rank}|${Math.round(hp)}|${Math.round(maxHp)}`
    if(sprite.userData.last===key)return;sprite.userData.last=key
    const c=sprite.userData.canvas,x=sprite.userData.ctx,pct=Math.max(0,Math.min(1,hp/maxHp))
    const rr=(cx,cy,w,h,r)=>{const q=Math.min(r,w/2,h/2);x.beginPath();x.moveTo(cx+q,cy);x.arcTo(cx+w,cy,cx+w,cy+h,q);x.arcTo(cx+w,cy+h,cx,cy+h,q);x.arcTo(cx,cy+h,cx,cy,q);x.arcTo(cx,cy,cx+w,cy,q);x.closePath()}
    x.clearRect(0,0,c.width,c.height);x.textAlign='center';x.textBaseline='middle'
    x.shadowColor='rgba(0,0,0,.95)';x.shadowBlur=10;x.shadowOffsetY=3
    x.fillStyle='#ffffff';x.font='900 38px Inter,Arial';x.fillText(name,320,42)
    x.fillStyle='#ffe08a';x.font='900 24px Inter,Arial';x.fillText(`LV. ${level}   •   RANK ${rank}`,320,78)
    x.shadowBlur=0;x.shadowOffsetY=0
    rr(62,101,516,45,23);x.fillStyle='rgba(5,7,11,.9)';x.fill();x.strokeStyle=local?'rgba(116,220,255,.9)':'rgba(235,244,255,.72)';x.lineWidth=3;x.stroke()
    rr(68,107,504,33,17);x.fillStyle='rgba(92,16,24,.86)';x.fill()
    if(pct>0){const w=Math.max(12,504*pct),grad=x.createLinearGradient(68,0,572,0);grad.addColorStop(0,'#e3192d');grad.addColorStop(.55,'#f23c50');grad.addColorStop(1,'#ff8290');rr(68,107,w,33,17);x.fillStyle=grad;x.fill()}
    x.shadowColor='rgba(0,0,0,.95)';x.shadowBlur=5;x.fillStyle='#fff';x.font='900 22px Inter,Arial';x.fillText(`${Math.ceil(hp)} / ${Math.ceil(maxHp)} HP`,320,124);x.shadowBlur=0
    sprite.userData.texture.needsUpdate=true
  }
applyEnemyNetworkState(st){
    if(!st?.netId||(st.world&&st.world!==this.currentWorldId()))return
    const mob=this.enemies.find(x=>!x.dead&&x.netId===st.netId)
    if(st.dead){
      const due=Math.max(Date.now()+250,Number(st.respawnAt)||Date.now()+5000);this.respawnLocks.set(st.netId,due)
      if(mob){mob.dead=true;mob.g.parent?.remove(mob.g);if(!this.state.dungeon&&mob.chunkKey&&!this.respawnQueue.some(r=>r.netId===mob.netId)){this.respawnQueue.push({due,x:mob.g.position.x,z:mob.g.position.z,level:mob.level,name:mob.name,boss:mob.boss,zoneId:mob.zoneId,chunkKey:mob.chunkKey,netId:mob.netId})}this.enemies=this.enemies.filter(x=>x!==mob);if(this.state.target?.name===mob.name)this.state.target=null}
      return
    }
    if(mob&&Number.isFinite(Number(st.hp))){mob.hp=Math.max(0,Math.min(mob.maxHp,Number(st.hp)));this.updateMobLabel(mob)}
  }

  onMultiplayerEvent(e){
    if(e.type==='connection'){const reconnecting=!!e.reconnecting;this.state.multiplayer={...this.state.multiplayer,connected:!!e.connected,reconnecting,url:e.url||this.state.multiplayer.url,room:e.room||this.multiplayer?.room||this.state.multiplayer.room,transport:e.transport||this.state.multiplayer.transport||'offline',reason:e.reason||'',serverSave:e.connected?this.state.multiplayer.serverSave:false};if(e.connected){this.toast(e.transport==='supabase'?'Multiplayer Supabase Realtime conectado':e.transport==='http'?'Multiplayer Vercel conectado':'Multiplayer LAN conectado');this.gateManager?.requestSharedGateState?.()}else if(!reconnecting){this.state.party={id:null,leaderId:null,members:[],totalXP:0};for(const r of this.remotePlayers.values()){this.scene.remove(r.g);r.marker?.material?.map?.dispose?.();r.marker?.material?.dispose?.()}this.remotePlayers.clear();this.state.multiplayer.players=0;this.state.multiplayer.totalOnline=0}return}
    if(String(e.type||'').startsWith('gate_')){this.gateManager?.handleMultiplayerEvent?.(e);return}
    if(e.type==='presence_count'){this.state.multiplayer.totalOnline=Math.max(1,Number(e.count)||1);this.state.multiplayer.players=this.remotePlayers.size;return}
    if(e.type==='welcome'){if(e.room){this.state.multiplayer.room=e.room;localStorage.setItem('shadow-ascension-last-lobby',e.room)}for(const p of e.players||[])this.onMultiplayerEvent({type:'state',player:p});this.state.multiplayer.players=this.remotePlayers.size;this.state.multiplayer.totalOnline=Math.max(1,this.remotePlayers.size+1);return}
    if(e.type==='lobby'){if(e.room){this.state.multiplayer.room=e.room;localStorage.setItem('shadow-ascension-last-lobby',e.room)}return}
    if(e.type==='profile'){
      const profile=e.profile||{};this.serverProfileTimestamp=profile.updatedAt||0
      if(profile.game&&this.serverProfileTimestamp>(this.localUpdatedAt||0)){this.applyServerProfile(profile.game,this.serverProfileTimestamp);if(profile.name&&!this.state.playerName){this.state.playerName=profile.name;this.state.needsNickname=false;localStorage.setItem('shadow-ascension-nick',profile.name);this.multiplayer?.setIdentity(profile.name)}this.toast('Progresso carregado do servidor multiplayer')}
      else{if(profile.name&&!this.state.playerName){this.state.playerName=profile.name;this.state.needsNickname=false;localStorage.setItem('shadow-ascension-nick',profile.name);this.multiplayer?.setIdentity(profile.name)}this.multiplayer?.saveProfile(this.profileSnapshot(),this.localUpdatedAt||Date.now(),true)}
      return
    }
    if(e.type==='profile_saved'){this.state.multiplayer.serverSave=!!e.ok;return}
    if(e.type==='party_state'){this.state.party={id:e.party?.id||null,leaderId:e.party?.leaderId||null,members:Array.isArray(e.party?.members)?e.party.members:[],totalXP:Number(e.party?.totalXP)||0};return}
    if(e.type==='party_xp_award'){const amount=Math.max(0,Math.round(Number(e.amount)||0));if(amount){this.gainXp(amount);this.toast(`Equipe: +${amount} XP compartilhado`)}return}
    if(e.type==='party_error'){this.toast(e.message||'Não foi possível alterar a equipe.');return}
    if(e.type==='renamed'){this.state.playerName=e.name||this.state.playerName;return}
    if(e.type==='trade_offer'){
      if(e.world&&e.world!==this.currentWorldId())return
      const offer=normalizeTradeOffer(e.offer)
      if(!e.tradeId||(!offer.items.length&&!offer.gold))return
      const active=this.state.trade
      if(active&&active.status!=='completed'&&(active.id!==e.tradeId||active.partnerId!==e.from)){
        this.multiplayer?.send({type:'trade_cancel',to:e.from,tradeId:e.tradeId,world:this.currentWorldId(),message:'Este jogador já está em outra troca.'})
        return
      }
      this.state.trade={id:e.tradeId,partnerId:e.from,partnerName:e.fromName||this.remotePlayers.get(e.from)?.data?.name||'Aventureiro',localOffer:active?.localOffer||null,remoteOffer:offer,localConfirmed:false,remoteConfirmed:false,status:'offered'}
      this.toast(`🤝 ${this.state.trade.partnerName} enviou uma proposta de troca.`)
      return
    }
    if(e.type==='trade_confirm'){
      const trade=this.state.trade
      if(!trade||trade.id!==e.tradeId||trade.partnerId!==e.from||e.world&&e.world!==this.currentWorldId())return
      if(e.localOfferHash!==tradeOfferHash(trade.remoteOffer)||e.remoteOfferHash!==tradeOfferHash(trade.localOffer)){
        this.state.trade={...trade,remoteConfirmed:false}
        this.toast('A outra proposta foi alterada. Revise os itens antes de confirmar.')
        return
      }
      this.state.trade={...trade,remoteConfirmed:true,status:trade.localConfirmed?'completing':'awaiting-confirmation'}
      if(this.state.trade.localConfirmed)this.completeTrade()
      else this.toast(`${trade.partnerName} confirmou a proposta.`)
      return
    }
    if(e.type==='trade_cancel'){
      if(this.state.trade?.id===e.tradeId&&this.state.trade.partnerId===e.from){this.state.trade=null;this.toast(e.message||'A outra pessoa cancelou a troca.')}
      return
    }
    if(e.type==='join'||e.type==='state'){const p=e.player;if(!p||p.id===this.multiplayer?.id)return;let r=this.remotePlayers.get(p.id);if(!r){r=this.makeRemoteAvatar(p);this.remotePlayers.set(p.id,r)}r.data={...r.data,...p};r.target={x:+p.x||0,y:+p.y||0,z:+p.z||0,r:+p.r||0};this.updatePlayerNameplate(r.marker,r.data,false);this.state.multiplayer.players=this.remotePlayers.size;return}
    if(e.type==='leave'){const r=this.remotePlayers.get(e.id);if(r){this.scene.remove(r.g);r.marker?.material?.map?.dispose?.();r.marker?.material?.dispose?.();this.remotePlayers.delete(e.id)};this.state.multiplayer.players=this.remotePlayers.size;return}
    if(e.type==='enemy_snapshot'){for(const st of e.states||[])this.applyEnemyNetworkState(st);return}
    if(e.type==='enemy_dead'){this.applyEnemyNetworkState({...e,dead:true});return}
    if(e.type==='enemy_damage'){if(e.world&&e.world!==this.currentWorldId())return;const mob=this.enemies.find(x=>!x.dead&&x.netId===e.netId);if(mob){mob.hp-=Math.max(0,Number(e.amount)||0);this.flashEnemy(mob,false);this.updateMobLabel(mob);if(mob.hp<=0)this.applyEnemyNetworkState({netId:e.netId,world:e.world,dead:true,respawnAt:e.respawnAt||Date.now()+5000})}return}
    if(e.type==='combat'||e.type==='ability'){const r=this.remotePlayers.get(e.from);if(r&&(!e.world||e.world===this.currentWorldId())){r.attackAnim=e.type==='ability'?.55:.32;r.abilityAnim=e.type==='ability'};return}
  }

  setPlayerName(name){const clean=String(name||'').normalize('NFKC').replace(/[^\p{L}\p{N} _.\-]/gu,'').replace(/\s+/g,' ').trim().slice(0,24);if(clean.length<2){this.toast('Use um nick com pelo menos 2 caracteres.');return false}this.state.playerName=clean;this.state.needsNickname=false;localStorage.setItem('shadow-ascension-nick',clean);this.multiplayer?.setIdentity(clean);this.updatePlayerNameplate(this.localPlayerLabel,{name:clean,level:this.state.level,hp:this.state.hp,maxHp:this.state.maxHp,guildRank:this.state.guildRank},true);this.saveGame();return true}
  setPlayerAccount(session, profile = null){
    if(!session) return false
    const username = session.username || 'Aventureiro'
    const server = session.server || 'asterra-global'
    this.state.playerName = username
    this.state.needsNickname = false
    this.state.multiplayer.room = server
    localStorage.setItem('shadow-ascension-nick', username)
    localStorage.setItem('shadow-ascension-last-lobby', server)
    if(session.accountId){
      this.accountId=session.accountId
      localStorage.setItem('shadow-ascension-player-id', session.accountId)
      try { sessionStorage.setItem('shadow-ascension-player-id', session.accountId) } catch {}
      if(this.multiplayer) {
        this.multiplayer.playerId = session.accountId
        this.multiplayer.id = session.accountId
        this.multiplayer.setPlayerId?.(session.accountId)
      }
    }
    this.multiplayer?.setIdentity(username)
    this.multiplayer?.setRoom(server)
    this.updatePlayerNameplate(this.localPlayerLabel, {
      name: username,
      level: this.state.level,
      hp: this.state.hp,
      maxHp: this.state.maxHp,
      guildRank: this.state.guildRank
    }, true)
    if(profile?.game&&(profile.updatedAt||0)>=(this.localUpdatedAt||0)){
      this.applyServerProfile(profile.game, profile.updatedAt || Date.now())
    }
    this.saveGame()
    this.saveCloudGame({force:true})
    this.multiplayer?.connect()
    this.gateManager?.hydrateSharedGateState?.()
    this.toast(`Bem-vindo, ${username}! Conectado ao ${server.replace('asterra-','Servidor ')}.`)
    return true
  }
  async logoutAccount(){
    await this.saveCloudGame({force:true})
    await signOutAccount().catch(()=>{})
    try {
      localStorage.removeItem('shadow_rpg_account_session')
      localStorage.removeItem('shadow-ascension-nick')
      localStorage.removeItem('shadow-ascension-player-id')
      sessionStorage.removeItem('shadow-ascension-player-id')
      sessionStorage.removeItem('shadow-ascension-tab-client-id')
      localStorage.removeItem('rpg_player_nick')
    } catch {}
    this.state.playerName = ''
    this.accountId=''
    this.state.needsNickname = true
    this.state.uiPanel = null
    this.multiplayer?.disconnect()
    this.toast('Você saiu da sua conta.')
    this.onHud?.({
      ...this.state,
      playerName: '',
      needsNickname: true,
      uiPanel: null
    })
  }
  connectMultiplayer(url){const value=String(url||'').trim();this.settings.multiplayerUrl=value;this.state.multiplayer.url=value;localStorage.setItem('shadow-ascension-mp-url',value);if(value)this.multiplayer.connect(value);else this.multiplayer.disconnect();this.saveGame()}
  setMultiplayerLobby(room){const next=this.multiplayer?.setRoom?.(room)||String(room||'asterra-global');this.state.multiplayer.room=next;localStorage.setItem('shadow-ascension-last-lobby',next);this.toast(`Entrando no ${next.replace('asterra-','Lobby ')}...`);this.saveGame();return next}
  profileSnapshot(){const room=this.multiplayer?.room||this.state.multiplayer?.room||localStorage.getItem('shadow-ascension-last-lobby')||'asterra-global';return{state:{...this.state,version:8,target:null,dungeon:null,uiPanel:null,dialogue:null,portal:null,interactionPrompt:null,merchant:[],minimap:null,mapSnapshot:null,party:{id:null,leaderId:null,members:[],totalXP:0},onlinePlayers:[],trade:null,multiplayer:{connected:false,url:this.settings.multiplayerUrl,room,players:0}},position:{x:this.player?.position.x||0,z:this.player?.position.z||0},dayHours:this.dayHours,settings:this.settings,multiplayerRoom:room,discovered:[...this.discovered]}}
  applyServerProfile(game,updatedAt=0){try{const incoming=normalizeSaveState({...this.state,...(game.state||{}),version:8,target:null,dungeon:null,uiPanel:null,dialogue:null,trade:null});this.state={...this.state,...incoming,needsNickname:!incoming.playerName,party:{id:null,leaderId:null,members:[],totalXP:0},trade:null};if(game.position){this.player.position.set(Number(game.position.x)||0,0,Number(game.position.z)||0)}this.dayHours=game.dayHours??this.dayHours;this.discovered=new Set(game.discovered||[]);const liveUrl=this.multiplayer?.url||this.settings.multiplayerUrl;this.settings={...this.settings,...(game.settings||{}),multiplayerUrl:liveUrl||game.settings?.multiplayerUrl||''};this.state.settings=this.settings;this.state.multiplayer.url=this.settings.multiplayerUrl;const liveRoom=this.multiplayer?.room||localStorage.getItem('shadow-ascension-last-lobby')||game.multiplayerRoom||this.state.multiplayer.room||'asterra-global';this.state.multiplayer.room=liveRoom;localStorage.setItem('shadow-ascension-last-lobby',liveRoom);this.localUpdatedAt=updatedAt;this.recalcStats();this.syncPetVisual();if(this.state.playerName)this.setPlayerName(this.state.playerName)}catch{}}
  updateMultiplayer(dt){
    const world=this.currentWorldId()
    for(const r of this.remotePlayers.values()){
      r.g.visible=(r.data?.world||'open')===world
      if(!r.g.visible)continue
      const remoteDist=r.g.position.distanceTo(this.player.position);r.marker.visible=remoteDist<52;if(r.torso?.material?.color)r.torso.material.color.lerp(new THREE.Color(rankColor(r.data?.guildRank||'E')),.08)
      const dx=r.target.x-r.g.position.x, dz=r.target.z-r.g.position.z, distSq=dx*dx+dz*dz
      const isRemoteMoving = distSq > 0.003
      if(isRemoteMoving){
        r.phase = (r.phase || 0) + dt * 8.5
        const swing = Math.sin(r.phase) * 0.65
        if(r.legL) r.legL.rotation.x = damp(r.legL.rotation.x, swing, 14, dt)
        if(r.legR) r.legR.rotation.x = damp(r.legR.rotation.x, -swing, 14, dt)
        if(r.shoulderL) r.shoulderL.rotation.x = damp(r.shoulderL.rotation.x, -swing * 0.45, 12, dt)
        if(r.shoulderR) r.shoulderR.rotation.x = damp(r.shoulderR.rotation.x, swing * 0.45, 12, dt)
      } else {
        if(r.legL) r.legL.rotation.x = damp(r.legL.rotation.x, 0, 10, dt)
        if(r.legR) r.legR.rotation.x = damp(r.legR.rotation.x, 0, 10, dt)
        if(r.shoulderL) r.shoulderL.rotation.x = damp(r.shoulderL.rotation.x, 0, 10, dt)
        if(r.shoulderR) r.shoulderR.rotation.x = damp(r.shoulderR.rotation.x, 0, 10, dt)
      }
      r.g.position.x=damp(r.g.position.x,r.target.x,10,dt);r.g.position.y=damp(r.g.position.y,r.target.y||0,10,dt);r.g.position.z=damp(r.g.position.z,r.target.z,10,dt);r.g.rotation.y=damp(r.g.rotation.y,r.target.r,10,dt)
      r.attackAnim=Math.max(0,(r.attackAnim||0)-dt)
      if(r.swordPivot) r.swordPivot.rotation.z = damp(r.swordPivot.rotation.z, r.attackAnim>0?-0.75:0, 14, dt)
      if(r.torso) r.torso.rotation.y = damp(r.torso.rotation.y, r.attackAnim>0?0.25:0, 12, dt)
    }
    this.state.multiplayer.players=[...this.remotePlayers.values()].filter(r=>r.g.visible).length;this.state.multiplayer.connected=!!this.multiplayer?.connected
    this.updatePlayerNameplate(this.localPlayerLabel,{name:this.state.playerName||'Aventureiro',level:this.state.level,hp:this.state.hp,maxHp:this.state.maxHp,guildRank:this.state.guildRank},true);this.multiplayer?.sync({x:this.player.position.x,y:this.player.position.y,z:this.player.position.z,r:this.player.rotation.y,level:this.state.level,hp:this.state.hp,maxHp:this.state.maxHp,motion:this.player.userData.motion,world,guildRank:this.state.guildRank,mountActive:!!this.state.mount?.active,classId:this.state.classState?.activeClassId||'mercenary_swordsman'})
  }

  applySettings(next){
    const oldUrl=this.settings.multiplayerUrl;
    const invertCameraX = Boolean(next.invertCameraX !== undefined ? next.invertCameraX : (next.invertCamera !== undefined ? next.invertCamera : this.settings.invertCameraX));
    const invertCameraY = Boolean(next.invertCameraY !== undefined ? next.invertCameraY : this.settings.invertCameraY);
    this.settings={
      ...this.settings,
      ...next,
      renderDistance:clamp(Number(next.renderDistance??this.settings.renderDistance),WORLD.renderDistanceMin,WORLD.renderDistanceMax),
      pixelRatio:clamp(Number(next.pixelRatio??this.settings.pixelRatio),.75,2),
      uiScale:clamp(Number(next.uiScale??this.settings.uiScale),.85,2),
      invertCameraX,
      invertCameraY,
      invertCamera: invertCameraX && invertCameraY
    };
    this.state.settings=this.settings;
    this.renderer.shadowMap.enabled=this.settings.shadows!==false;
    if(this.settings.multiplayerUrl!==oldUrl)this.connectMultiplayer(this.settings.multiplayerUrl);
    this.resize();
    this.saveGame()
  }

  saveGame(){
    try{
      const updatedAt=Date.now(),data={...this.profileSnapshot(),updatedAt}
      const raw=JSON.stringify(data)
      localStorage.setItem('shadow-ascension-save-v08',raw)
      localStorage.setItem('shadow-ascension-save-backup',raw)
      this.localUpdatedAt=updatedAt
      this.multiplayer?.saveProfile(data,updatedAt)
    }catch{}
  }
  saveCloudGame({force=false}={}){
    if(!this.accountId||this.state.needsNickname)return Promise.resolve({ok:false,error:'no_account'})
    if(this.cloudSaveInFlight){this.cloudSaveQueued=this.cloudSaveQueued||force;return this.cloudSaveInFlight}
    this.saveGame()
    const updatedAt=this.localUpdatedAt||Date.now(), snapshot=this.profileSnapshot()
    const payload={id:this.accountId,name:this.state.playerName,game:snapshot,lastLobby:snapshot.multiplayerRoom,level:this.state.level,guildRank:this.state.guildRank,updatedAt}
    this.cloudSaveInFlight=Promise.resolve(this.persistCloudProfile(payload))
      .then(result=>{this.state.multiplayer.serverSave=!!result?.ok;if(result?.ok)this.serverProfileTimestamp=updatedAt;return result})
      .catch(error=>{this.state.multiplayer.serverSave=false;return {ok:false,error:String(error?.message||error)}})
      .finally(()=>{this.cloudSaveInFlight=null;if(this.cloudSaveQueued){this.cloudSaveQueued=false;this.saveCloudGame()}})
    return this.cloudSaveInFlight
  }
  exportSaveData(){
    return localStorage.getItem('shadow-ascension-save-v08')||localStorage.getItem('shadow-ascension-save-backup')||''
  }
  importSaveData(rawString){
    try{
      const data=JSON.parse(String(rawString||'').trim())
      if(!data||!data.state){this.toast('Arquivo de save inválido.');return false}
      this.state=normalizeSaveState({...this.state,...data.state,version:8,target:null,dungeon:null,uiPanel:null,dialogue:null})
      if(data.position)this.player.position.set(Number(data.position.x)||0,0,Number(data.position.z)||0)
      this.saveGame();this.recalcStats();this.toast('Save restaurado com sucesso!');return true
    }catch{
      this.toast('Erro ao importar save.');return false
    }
  }
  loadGame(){
    try{
      let raw=localStorage.getItem('shadow-ascension-save-v08')||localStorage.getItem('shadow-ascension-save-backup');let data=raw?JSON.parse(raw):null
      if(!data){const v7=localStorage.getItem('shadow-ascension-save-v07');if(v7)data=JSON.parse(v7)}
      if(!data){const v6=localStorage.getItem('shadow-ascension-save-v06');if(v6)data=JSON.parse(v6)}
      if(!data){const v5=localStorage.getItem('shadow-ascension-save-v05');if(v5)data=JSON.parse(v5)}
      if(!data){const v4=localStorage.getItem('shadow-ascension-save-v04');if(v4)data=JSON.parse(v4)}
      if(!data){const legacy=localStorage.getItem('shadow-ascension-save-v03');if(legacy){const old=JSON.parse(legacy);data={state:old.state,position:old.position}}}
      if(!data)return;this.state=normalizeSaveState({...this.state,...data.state,version:8,target:null,dungeon:null,uiPanel:null,dialogue:null});this.state.needsNickname=true;this.state.party={id:null,leaderId:null,members:[],totalXP:0};this.savedPosition=data.position||this.savedPosition;this.settings={...this.settings,...(data.settings||data.state?.settings||{})};this.state.settings=this.settings;const rememberedRoom=localStorage.getItem('shadow-ascension-last-lobby')||data.multiplayerRoom||data.state?.multiplayer?.room||this.state.multiplayer?.room||'asterra-global';this.state.multiplayer={...this.state.multiplayer,room:rememberedRoom};localStorage.setItem('shadow-ascension-last-lobby',rememberedRoom);this.dayHours=data.dayHours??this.dayHours;this.savedDiscovered=data.discovered||[];this.localUpdatedAt=data.updatedAt||0;if(this.state.playerName){localStorage.setItem('shadow-ascension-nick',this.state.playerName)}
    }catch{}
  }

  isMapDiscovered(x,z){
    const cell=WORLD.mapCellSize,cx=Math.round(x/cell),cz=Math.round(z/cell)
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)if(this.discovered.has(`${cx+dx},${cz+dz}`))return true
    return false
  }

  emitHud(){
    const now=performance.now();if(now-this.lastHud<50)return;this.lastHud=now
    const z=this.state.dungeon?null:zoneAt(this.player.position.x,this.player.position.z,ZONES);if(z){this.state.zone=z.name;this.state.zoneId=z.id}
    const city=this.state.dungeon?null:this.cityAt(this.player.position.x,this.player.position.z,2);this.state.currentCity=city?.name||null;if(city&&CITY_ECONOMIES[city.id])this.state.economy={cityId:city.id,...CITY_ECONOMIES[city.id]}
    const portal=this.portals.find(p=>p.g.visible&&p.g.position.distanceTo(this.player.position)<6)
    this.state.portal=portal?{name:portal.name,level:portal.level,floors:portal.floors,rarity:{name:portal.rarity.name,color:portal.rarity.color}}:null
    const aimed=this.combatMode?this.getCrosshairTarget(18,.16):null;this.state.crosshairTarget=aimed?{name:aimed.name,level:aimed.level,boss:aimed.boss}:null;this.state.combatMode=this.combatMode;refreshGuildBoard(this.state);this.state.guildRank=getGuildRank(this.state.guildRankIndex||0).id;this.state.guildNextRequirement=guildRankRequirement((this.state.guildRankIndex||0)+1)
    this.state.playerPosition={x:this.player.position.x,z:this.player.position.z};this.state.playerHeading=this.player.rotation.y;this.state.cameraYaw=this.yaw
    if(this.state.uiPanel==='merchant'||this.state.uiPanel==='blacksmith'){const info=shopRefreshInfo();if(!this.state.shopRefresh||this.state.shopRefresh.cycle!==info.cycle)this.refreshShop(this.state.uiPanel);else this.state.shopRefresh=info}else this.state.merchant=[]

    const mapRadius=185,px=this.player.position.x,pz=this.player.position.z,near=(x,z,pad=0)=>Math.abs(x-px)<=mapRadius+pad&&Math.abs(z-pz)<=mapRadius+pad
    const roadLocal=[];for(const road of ROADS){const a=CITIES.find(c=>c.id===road.a),b=CITIES.find(c=>c.id===road.b);if(!a||!b)continue;const mx=(a.x+b.x)/2,mz=(a.z+b.z)/2;if(near(mx,mz,Math.hypot(a.x-b.x,a.z-b.z)/2))roadLocal.push({ax:a.x,az:a.z,bx:b.x,bz:b.z})}
    const cityLocal=CITIES.filter(c=>near(c.x,c.z,55)).map(c=>({id:c.id,name:c.name,zoneId:c.zoneId,x:c.x,z:c.z,radius:c.radius,wallRadius:c.wallRadius,accent:c.accent}))
    const npcs=this.state.dungeon?[]:this.npcs.filter(n=>near(n.g.position.x,n.g.position.z,30)).map(n=>{const qs=this.state.quests.filter(q=>q.giver===n.def.name&&q.status!=='done');const q=qs.find(x=>x.status==='ready')||qs.find(x=>x.status==='available')||qs.find(x=>x.status==='active');return{x:n.g.position.x,z:n.g.position.z,name:n.def.name,role:n.def.role,cityName:n.def.cityName,quest:q?.status||null}})
    const enemies=this.enemies.filter(e=>!e.dead&&near(e.g.position.x,e.g.position.z)).map(e=>({x:e.g.position.x,z:e.g.position.z,boss:!!e.boss,level:e.level,name:e.name}));const adventurers=this.bots.filter(b=>!b.dead&&near(b.g.position.x,b.g.position.z)).map(b=>({x:b.g.position.x,z:b.g.position.z,name:b.name,level:b.level,rank:b.guildRank,hostile:!!b.hostileToPlayer}))
    const portals=this.state.dungeon?[]:this.portals.filter(p=>near(p.x,p.z,35)).map(p=>({x:p.x,z:p.z,name:p.name,color:p.rarity.color,rarity:p.rarity.name,level:p.level}))
    const landmarks=this.state.dungeon?[]:LANDMARKS.filter(l=>near(l.x,l.z,35)).map(l=>({...l}))
    const activeBosses=this.enemies.filter(e=>!e.dead&&e.boss).map(e=>({x:e.g.position.x,z:e.g.position.z,name:e.name,level:e.level,hp:e.hp,maxHp:e.maxHp,zoneId:e.zoneId}))
    const remotePlayersList=[...this.remotePlayers.entries()].filter(([,r])=>r.g.visible).map(([id,r])=>({id,name:r.data?.name||'Aventureiro',level:r.data?.level||1,guildRank:r.data?.guildRank||'E',partyId:r.data?.partyId||null,x:r.g.position.x,z:r.g.position.z,heading:r.g.rotation.y,world:r.data?.world||'open'}))
    const minimap={
      chunkSize:WORLD.chunkSize,player:{x:px,z:pz,heading:this.player.rotation.y},
      chunks:[...this.chunks.values()].map(c=>({cx:c.cx,cz:c.cz,zoneId:c.zone.id,hasWater:!!c.hasWater})),
      enemies,adventurers,npcs,portals,landmarks,cities:cityLocal,roads:roadLocal,dungeon:!!this.state.dungeon,activeBosses,
      gates:this.gateManager?this.gateManager.getMapGates():[],
      caravans:this.caravanManager?this.caravanManager.getMapCaravans():[],
      players:remotePlayersList,
    }
    const bosses=ZONES.map(zone=>{
      const live=activeBosses.find(b=>b.zoneId===zone.id)
      const x=live?live.x:zone.x0+(zone.x1-zone.x0)*.78,z=live?live.z:zone.z0+(zone.z1-zone.z0)*.72
      return {zoneId:zone.id,name:zone.boss,level:zone.max+5,x,z,alive:!!live,hp:live?.hp,maxHp:live?.maxHp}
    })
    const mapSnapshot={
      limit:WORLD.worldLimit,cellSize:WORLD.mapCellSize,discovered:[...this.discovered],player:{x:px,z:pz,heading:this.player.rotation.y},
      cities:CITIES.map(c=>({id:c.id,name:c.name,zoneId:c.zoneId,x:c.x,z:c.z,radius:c.radius,wallRadius:c.wallRadius,accent:c.accent})),
      services:NPC_DEFS.map(n=>({id:n.id,name:n.name,role:n.role,title:n.title,x:n.x,z:n.z,cityId:n.cityId,cityName:n.cityName,zoneId:n.zoneId})),
      roads:ROADS.map(r=>{const a=CITIES.find(c=>c.id===r.a),b=CITIES.find(c=>c.id===r.b);return a&&b?{ax:a.x,az:a.z,bx:b.x,bz:b.z}:null}).filter(Boolean),
      portals:this.portals.filter(p=>this.isMapDiscovered(p.x,p.z)).map(p=>({x:p.x,z:p.z,name:p.name,color:p.rarity.color,rarity:p.rarity.name,level:p.level})),
      landmarks:LANDMARKS.filter(l=>this.isMapDiscovered(l.x,l.z)).map(l=>({...l})),
      adventurers:this.bots.filter(b=>!b.dead&&this.isMapDiscovered(b.g.position.x,b.g.position.z)).map(b=>({x:b.g.position.x,z:b.g.position.z,name:b.name,level:b.level,rank:b.guildRank,hostile:!!b.hostileToPlayer})),
      bosses,activeBosses,
      gates:this.gateManager?this.gateManager.getMapGates():[],
      caravans:this.caravanManager?this.caravanManager.getMapCaravans():[],
      players:remotePlayersList,
    }
    this.state.guildRank=getGuildRank(this.state.guildRankIndex||0).id;this.state.onlinePlayers=remotePlayersList;this.updatePlayerNameplate(this.localPlayerLabel,{name:this.state.playerName||'Aventureiro',level:this.state.level,hp:this.state.hp,maxHp:this.state.maxHp,guildRank:this.state.guildRank},true)
    this.onHud?.({...this.state,destinationMarker:this.state.destinationMarker||null,caravanModal:this.state.caravanModal||null,xpNotifications:this.state.xpNotifications||[],lastXpGain:this.state.lastXpGain||null,levelUpCelebration:this.state.levelUpCelebration||null,gateAnnouncement:this.state.gateAnnouncement||null,dungeonModal:this.state.dungeonModal||null,dungeonCompletion:this.state.dungeonCompletion||null,minimap,mapSnapshot,horseBreeds:HORSE_BREEDS,inventory:[...this.state.inventory],equipment:{...this.state.equipment},quests:this.state.quests.map(q=>({...q})),classState:{...this.state.classState},travelState:{...this.state.travelState,vipCost:Math.max(5000,this.state.travelState?.vipCost||5000),nodes:{...(this.state.travelState?.nodes||{})}},settings:{...this.settings},mount:{...this.state.mount},stats:{...this.state.stats},attributes:{...this.state.attributes},guildMissions:(this.state.guildMissions||[]).map(m=>({...m,reward:{...m.reward}})),multiplayer:{...this.state.multiplayer},abilities:this.state.abilities?.map(a=>({...a}))||[]})
  }

  dismissGateAnnouncement(){
    if(this.state?.gateAnnouncement){
      this.state.gateAnnouncement=null
      this.emitHud()
    }
  }

  loop=(timestamp)=>{
    this.raf=requestAnimationFrame(this.loop);this.clock.update(timestamp);const dt=Math.min(this.clock.getDelta(),.05),t=this.clock.getElapsed()
    if(this.state.needsNickname){
      this.cameraFollow(dt)
      this.renderer.render(this.scene,this.camera)
      return
    }
    if(!this.state.dungeon)this.ensureChunks();this.updateDayNight(dt);this.updateWeather(dt,t);this.updatePlayer(dt,t);this.updatePets(dt);if(this.auraRoot)this.auraRoot.position.copy(this.player.position);this.updateEffects(dt);this.updateProjectiles(dt);this.updateCityVisibility();this.updateRespawns();this.updateBots(dt,t);this.updateCityGuards(dt,t);this.updateEnemies(dt,t);this.updatePortals(t);this.gateManager?.update(dt,t);this.caravanManager?.update(dt,t);this.updateWater(t);this.updateNPCs(t,dt);this.advanceDungeonIfClear();this.updateInteractions();this.cameraFollow(dt);this.updateMultiplayer(dt);this.emitHud();this.renderer.render(this.scene,this.camera)
  }
}
