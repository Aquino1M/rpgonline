import React, { useEffect, useRef, useState } from 'react'
import { ShadowGame } from './game/engine.js'
import { EQUIPMENT_SLOTS, GUILD_RANKS, ATTRIBUTE_DEFS } from './game/config.js'
import { CLASSES_LIST, CLASS_TIERS, CLASS_RANKS, getClassRankInfo } from './game/classesData.js'
import { TRAVEL_NODES, calculateTravelCost } from './game/fastTravel.js'
import { calculateGrimoireCost, getNextGrimoireLevel } from './game/rpgSystems.js'
import { getSupabaseConfig, saveSupabaseConfig } from './game/supabaseService.js'
import MiniMap from './ui/Minimap.jsx'
import WorldMap from './ui/WorldMap.jsx'

const initial={playerName:'',needsNickname:true,level:1,xp:0,nextXp:120,hp:120,maxHp:120,stamina:100,maxStamina:100,gold:220,atk:16,def:5,critChance:0,zone:'Vila Aurora',zoneId:'aurora',currentCity:'Cidadela Aurora',inventory:[],equipment:{},quests:[],guildMissions:[],guildRank:'E',guildRankIndex:0,guildPoints:0,attributePoints:0,attributes:{strength:0,vitality:0,agility:0,intellect:0},weather:'Céu limpo',time:'08:15',mount:{},abilities:[],combatMode:false,multiplayer:{connected:false,url:'',room:'asterra-01',players:0,latencyMs:0,quality:'offline',reconnecting:false},settings:{renderDistance:2,pixelRatio:1,uiScale:1.2,invertCameraX:false,invertCameraY:false,invertCamera:false,multiplayerUrl:''},playerPosition:{x:0,z:0},stats:{kills:0,bosses:0,dungeons:0},ores:0,party:{id:null,leaderId:null,members:[],totalXP:0},onlinePlayers:[],economy:{label:'Mercado dos Despertos',description:'Itens iniciais',theme:'Aurora'}}
const slotNames={weapon:'Arma',armor:'Armadura',boots:'Botas',talisman:'Talismã'}
const roleTitle={inventory:'Inventário & Equipamento',grimoire:'Grimório do Despertar (Roleta de Almas)',travel:'Moço Viajante (Rotas de Caravana)',quests:'Missões',guild:'Guilda de Aventureiros',attributes:'Atributos',merchant:'Mercador',blacksmith:'Ferreiro Rúnico',stable:'Estábulos',map:'Mapa de Asterra',settings:'Configurações',trade:'Troca entre Jogadores'}
const fallbackAbilities=[{slot:1,name:'Corte Astral',short:'Corte',icon:'✦',cost:14,remaining:0,ready:true},{slot:2,name:'Onda Astral',short:'Onda',icon:'✹',cost:28,remaining:0,ready:true},{slot:3,name:'Passo Etéreo',short:'Passo',icon:'➠',cost:22,remaining:0,ready:true}]
const multiplayerLobbies=[{id:'asterra-01',name:'Lobby Aurora'},{id:'asterra-02',name:'Lobby Lúmen'},{id:'asterra-03',name:'Lobby Cinéreo'},{id:'asterra-04',name:'Lobby Safira'},{id:'asterra-05',name:'Lobby Veyra'},{id:'asterra-06',name:'Lobby Noctis'}]

function getViewportState(){
  if(typeof window==='undefined')return{w:1366,h:768,isCoarse:false,isMobile:false,isTablet:false,isDesktop:true,isTouch:false,isLandscape:true}
  const w=window.innerWidth||1366,h=window.innerHeight||768
  const ua=navigator.userAgent||''
  const isMobileUA=/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  const hasFinePointer=window.matchMedia?.('(pointer: fine)').matches
  const short=Math.min(w,h)

  // Real mobile phone: mobile UA and narrow/short screen, or explicit mobile emulation
  const isPhone = isMobileUA ? (short <= 600 || w <= 950) : (short <= 520 || (w <= 768 && h <= 900 && !hasFinePointer))
  const isTablet = !isPhone && (isMobileUA || (short <= 768 && !hasFinePointer))
  const isDesktop = !isPhone && !isTablet

  const isMobile = isPhone
  // Touch mode is ONLY for actual phones and tablets, NEVER for desktop PC!
  const isTouch = (isPhone || isTablet) && (isMobileUA || !hasFinePointer)

  return { w, h, isCoarse: !hasFinePointer, isMobile, isTablet, isDesktop, isTouch, isLandscape: w >= h }
}
function getAdaptiveScale(viewport,requested=1.2){
  const req=clampNum(Number(requested)||1.2,.85,2)
  if(viewport?.isMobile){
    const landFactor=viewport.isLandscape?0.72:0.80
    return clampNum(req*landFactor,.66,1.02)
  }
  if(viewport?.isTablet)return clampNum(req*.88,.78,1.22)
  const fit=Math.min((viewport?.w||1366)/1440,(viewport?.h||768)/900)
  return clampNum(req*clampNum(fit,.78,1.08),.82,1.45)
}
function getMenuScale(viewport,requested=1.2){
  const req=clampNum(Number(requested)||1.2,.85,2)
  if(viewport?.isMobile)return clampNum(req*(viewport.isLandscape?0.78:0.88),.72,1.25)
  if(viewport?.isTablet)return clampNum(req*.92,.82,1.4)
  return clampNum(req*.90,.82,1.48)
}
function clampNum(v,min,max){return Math.max(min,Math.min(max,v))}

export default function App(){
  const canvas=useRef(null),game=useRef(null)
  const [hud,setHud]=useState(initial)
  const [help,setHelp]=useState(false)
  const [viewport,setViewport]=useState(()=>getViewportState())

  useEffect(()=>{game.current=new ShadowGame(canvas.current,setHud);return()=>game.current?.destroy?.()},[])
  useEffect(()=>{
    const sync=()=>setViewport(getViewportState())
    sync()
    window.addEventListener('resize',sync)
    window.addEventListener('orientationchange',sync)
    window.visualViewport?.addEventListener('resize',sync)
    return()=>{window.removeEventListener('resize',sync);window.removeEventListener('orientationchange',sync);window.visualViewport?.removeEventListener('resize',sync)}
  },[])
  useEffect(()=>{game.current?.setTouchDeviceMode?.(!!viewport.isTouch)},[viewport.isTouch])

  const pct=(a,b)=>Math.max(0,Math.min(100,b?100*a/b:0))
  const hp=pct(hud.hp,hud.maxHp),st=pct(hud.stamina,hud.maxStamina),xp=pct(hud.xp,hud.nextXp)
  const potionQty=hud.inventory?.find(i=>i.subtype==='potion')?.qty||0
  const grimoireQty=hud.inventory?.find(i=>i.subtype==='grimoire')?.qty||0
  const activeClassId=hud.classState?.activeClassId||'mercenary_swordsman'
  const activeClass=CLASSES_LIST.find(c=>c.id===activeClassId)||CLASSES_LIST[0]
  const activeTier=CLASS_TIERS[activeClass.tier]||CLASS_TIERS.COMMON
  const panel=hud.uiPanel
  const abilities=hud.abilities?.length?hud.abilities:fallbackAbilities
  const call=(m,...args)=>game.current?.[m]?.(...args)
  const requestedScale=hud.settings?.uiScale||1.2
  const hudScale=getAdaptiveScale(viewport,requestedScale)
  const menuScale=getMenuScale(viewport,requestedScale)
  const layoutClass=viewport.isDesktop?'is-desktop':viewport.isMobile?'is-mobile':'is-tablet'
  const orientationClass=viewport.isLandscape?'is-landscape':'is-portrait'
  const touchClass=viewport.isDesktop?'mouse-ui':viewport.isTouch?'touch-ui':'mouse-ui'
  const cssVars={
    '--ui-scale':hudScale,'--menu-scale':menuScale,'--viewport-h':`${viewport.h}px`,'--viewport-w':`${viewport.w}px`,
    '--safe-top':'max(10px, env(safe-area-inset-top))','--safe-right':'max(10px, env(safe-area-inset-right))','--safe-bottom':'max(10px, env(safe-area-inset-bottom))','--safe-left':'max(10px, env(safe-area-inset-left))',
    '--hud-card-w':`${Math.round(clampNum(350*hudScale,286,470))}px`,'--hud-pad':`${Math.round(clampNum(16*hudScale,11,23))}px`,
    '--hud-title':`${Math.round(clampNum(15*hudScale,12,22))}px`,'--hud-text':`${Math.round(clampNum(13*hudScale,10,18))}px`,'--hud-small':`${Math.round(clampNum(10*hudScale,8,14))}px`,
    '--side-w':`${Math.round(clampNum(188*hudScale,154,252))}px`,'--side-btn-h':`${Math.round(clampNum(56*hudScale,48,72))}px`,'--side-icon':`${Math.round(clampNum(27*hudScale,22,38))}px`,'--side-label':`${Math.round(clampNum(14*hudScale,11,19))}px`,
    '--quick-w':`${Math.round(clampNum(86*hudScale,68,112))}px`,'--quick-h':`${Math.round(clampNum(70*hudScale,58,92))}px`,'--quick-icon':`${Math.round(clampNum(29*hudScale,23,40))}px`,'--quick-label':`${Math.round(clampNum(10*hudScale,8,14))}px`,
    '--minimap-w':`${Math.round(clampNum(210*hudScale,168,282))}px`,'--menu-font':`${Math.round(clampNum(13*menuScale,11,20))}px`,
    '--menu-small':`${Math.round(clampNum(10*menuScale,9,16))}px`,'--menu-title':`${Math.round(clampNum(24*menuScale,20,36))}px`
  }

  return <div className={`app ${layoutClass} ${orientationClass} ${touchClass} ${hud.combatMode?'combat-active':'cursor-free'}`} style={cssVars}>
    <canvas ref={canvas} tabIndex={0}/><div className="vignette"/>

    <section className="hud-card player-card glass">
      <div className="brand-row">
        <div><b>SHADOW ASCENSION</b><small>☀ {hud.time} • {weatherIcon(hud.weather)} {hud.weather}</small></div>
        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
          <button className="class-chip" onClick={()=>call('togglePanel','grimoire')} style={{'--tier-color':activeTier.color}} title="Clique para abrir o Grimório do Despertar">{activeTier.icon} {activeClass.name}</button>
          <span className="level-chip">NV. {hud.level}</span>
        </div>
      </div>
      <div className="identity-line"><strong>{hud.playerName||'Aventureiro'}</strong><span>RANK {hud.guildRank||'E'}</span></div><div className="zone-line"><strong>{hud.currentCity||hud.zone}</strong><span>⚔ {hud.atk} &nbsp; 🛡 {hud.def}</span></div>
      <Bar label={`HP ${Math.floor(hud.hp)}/${hud.maxHp}`} value={hp} cls="hp"/><Bar label={`Vigor ${Math.floor(hud.stamina)}/${hud.maxStamina}`} value={st} cls="stamina"/><Bar label={`XP ${Math.floor(hud.xp)}/${hud.nextXp}`} value={xp} cls="xp"/>
      <div className="currency-row"><span>◈ {hud.gold} ouro</span><span>◆ {hud.ores||0} minério</span><span>📖 {grimoireQty} grimório{grimoireQty!==1?'s':''}</span></div>
    </section>

    <div className="world-status glass"><span>☀ {hud.time}</span><span>{weatherIcon(hud.weather)} {hud.weather}</span>{hud.multiplayer?.connected&&<b className="online-status">● ONLINE {hud.multiplayer.players||0} {hud.multiplayer.transport==='supabase'?'(SUPABASE)':hud.multiplayer.transport==='http'?'(VERCEL)':'(LAN)'}</b>}{hud.mount?.active&&<b>♞ Montado</b>}</div>
    {hud.target&&<div className={`target-card glass ${hud.target.boss?'boss':''}`}><div><b>{hud.target.boss?'★ CHEFE — ':''}{hud.target.name}</b><span>Nv.{hud.target.level}</span></div><Bar value={pct(hud.target.hp,hud.target.maxHp)} cls="enemy"/></div>}

    <nav className="side-menu glass" aria-label="Menus">
      <MenuButton icon="🎒" label="Inventário" hotkey="I" onClick={()=>call('togglePanel','inventory')}/>
      <MenuButton icon="📖" label="Grimório" hotkey="G" onClick={()=>call('togglePanel','grimoire')}/>
      <MenuButton icon="📜" label="Missões" hotkey="J" onClick={()=>call('togglePanel','quests')}/>
      <MenuButton icon="🏛" label="Guilda" hotkey="U" onClick={()=>call('togglePanel','guild')}/>
      <MenuButton icon="✚" label="Atributos" hotkey="K" badge={hud.attributePoints||0} onClick={()=>call('togglePanel','attributes')}/>
      <MenuButton icon="🤝" label="Trocar" hotkey="P" onClick={()=>call('togglePanel','trade')}/>
      <MenuButton icon="🗺" label="Mapa" hotkey="M" onClick={()=>call('togglePanel','map')}/>
      <MenuButton icon="⚙" label="Opções" hotkey="O" onClick={()=>call('togglePanel','settings')}/>
    </nav>

    <MiniMap hud={hud} onOpenMap={()=>call('togglePanel','map')}/>
    {hud.portal&&!hud.dungeon&&<div className="portal-card glass" style={{'--portal':hud.portal.rarity.color}}><small>FENDA DETECTADA</small><strong>{hud.portal.name}</strong><span>Nv. {hud.portal.level} • <b style={{color:hud.portal.rarity.color}}>{hud.portal.rarity.name}</b> • {hud.portal.floors} andares</span><em>E para entrar</em></div>}
    {hud.dungeon&&<div className="dungeon-card glass" style={{'--portal':hud.dungeon.color}}><small>MASMORRA ATIVA</small><strong>{hud.dungeon.name}</strong><span>{hud.dungeon.rarity} • Nv.{hud.dungeon.level}</span><b>Andar {hud.dungeon.floor}/{hud.dungeon.floors}</b></div>}
    {hud.interactionPrompt&&!panel&&<div className="interaction">{hud.interactionPrompt}</div>}{hud.toast&&<div key={hud.toast.id} className="toast">{hud.toast.msg}</div>}

    {!panel&&hud.combatMode&&<div className={`combat-crosshair ${hud.crosshairTarget?'locked':''}`} aria-label="Mira"><i/><i/><b/></div>}
    {!panel&&<button className={`combat-mode-chip glass ${hud.combatMode?'active':''}`} onClick={()=>call('toggleCombatMode')}><kbd>Q</kbd><span>{hud.combatMode?'MODO COMBATE':'CURSOR LIVRE'}</span><small>{hud.combatMode?'Q libera o mouse':'Q trava a mira'}</small></button>}

    <div className="quickbar glass">
      <QuickButton hotkey="R" icon="🧪" label="Poção" badge={potionQty} onClick={()=>call('usePotion')} disabled={!potionQty}/>
      {abilities.map(a=><QuickButton key={a.slot} hotkey={String(a.slot)} icon={a.icon} label={a.name} badge={a.remaining>0?`${a.remaining.toFixed(1)}s`:''} cooldown={a.remaining} maxCooldown={a.cooldown} disabled={!a.ready} onClick={()=>call('castAbility',a.slot)} title={`${a.name} • ${a.cost} vigor • CD ${a.cooldown}s`}/>) }
      <QuickButton hotkey="Space" icon="↥" label="Pular" onClick={()=>call('jump')}/><QuickButton hotkey="Shift" icon="↯" label="Esquiva" onClick={()=>call('dash')}/><QuickButton hotkey="E" icon="☞" label="Interagir" onClick={()=>call('interact')}/><QuickButton hotkey="H" icon="♞" label="Montaria" onClick={()=>call('toggleMount')}/>
    </div>

    <button className="help-button" onClick={()=>setHelp(v=>!v)}>?</button>
    {help&&<div className="help glass"><b>CONTROLES</b><span>WASD — mover • Espaço — pular • Ctrl — correr</span><span>Fora do combate: segure o botão direito para girar a câmera</span><span><b>Q</b> — alterna Modo Combate / Cursor Livre</span><span>No combate: mouse move a câmera • mira centralizada</span><span>Mira + clique esquerdo — atacar/coletar</span><span>1 / 2 / 3 ou clique — poderes</span><span>Direito — bloquear • Shift — esquiva</span><span>E — interagir • R — poção • H — montaria</span><span>I/G/T/J/U/K/P/M/O — inventário, grimório, viajante, missões, guilda, atributos, troca, mapa, opções</span></div>}

    <MobileControls hud={hud} abilities={abilities} call={call} touch={!viewport.isDesktop && viewport.isTouch} onHelp={()=>setHelp(v=>!v)}/>

    {panel&&<Overlay panelKey={panel} title={roleTitle[panel]||'Interação'} dialogue={hud.dialogue} mapMode={panel==='map'} onClose={()=>call('closePanel')}>
      {panel==='inventory'&&<Inventory hud={hud} equip={id=>call('equipItem',id)} unequip={s=>call('unequip',s)} call={call}/>} 
      {panel==='grimoire'&&<Grimoire hud={hud} onAwaken={()=>call('awakenClass')} onSwitch={id=>call('switchClass',id)} onUpgradeRank={id=>call('upgradeClassRank',id)}/>} 
      {panel==='travel'&&<FastTravel hud={hud} onTravel={id=>call('fastTravelTo',id)} onBuyVip={id=>call('buyVipPass',id)}/>} 
      {panel==='quests'&&<Quests hud={hud} accept={id=>call('acceptQuest',id)} claim={id=>call('claimQuest',id)}/>} 
      {panel==='guild'&&<Guild hud={hud} accept={id=>call('acceptGuildMission',id)} claim={id=>call('claimGuildMission',id)} createParty={()=>call('createParty')} joinParty={id=>call('joinParty',id)} leaveParty={()=>call('leaveParty')}/>} 
      {panel==='attributes'&&<Attributes hud={hud} allocate={dist=>call('allocateAttributes',dist)}/>} 
      {panel==='merchant'&&<Merchant hud={hud} buy={id=>call('buyItem',id)} sell={id=>call('sellItem',id)} sellMultiple={ids=>call('sellMultipleItems',ids)}/>} 
      {panel==='blacksmith'&&<Blacksmith hud={hud} upgrade={s=>call('upgrade',s)} repair={s=>call('repairItem',s)} buy={id=>call('buyItem',id)}/>} 
      {panel==='stable'&&<Stable hud={hud} toggle={()=>call('toggleMount')}/>} 
      {panel==='trade'&&<TradeModal hud={hud} call={call} onClose={()=>call('closePanel')}/>}
      {panel==='map'&&<WorldMap hud={hud}/>} 
      {panel==='settings'&&<Settings hud={hud} apply={v=>call('applySettings',v)} connect={url=>call('connectMultiplayer',url)} setName={name=>call('setPlayerName',name)} call={call}/>} 
    </Overlay>}
    {hud.needsNickname&&<NicknameGate initialName={hud.playerName} onSave={name=>call('setPlayerName',name)}/>}
  </div>
}

function Bar({label,value,cls}){return <div className={`bar-wrap ${cls||''}-wrap`}>{label&&<div className="bar-label">{label}</div>}<div className="bar"><div className={cls} style={{width:`${Math.max(0,value||0)}%`}}/></div></div>}
function IconButton({title,onClick,children}){return <button title={title} onClick={onClick}>{children}</button>}
function MenuButton({icon,label,hotkey,badge,onClick}){return <button className="menu-button" title={`${label} [${hotkey}]`} onClick={onClick}><span>{icon}</span><div><b>{label}</b><small>{hotkey}</small></div>{badge>0&&<em>{badge}</em>}</button>}
function weatherIcon(w){return w==='Tempestade'?'⛈':w==='Chuva'?'🌧':w==='Brisa'?'🍃':'☀'}
function QuickButton({hotkey,icon,label,badge,onClick,disabled,cooldown,maxCooldown=6,title}){return <button className={`quick-slot ${cooldown>0?'cooling':''}`} onClick={onClick} disabled={disabled} title={title||label}><kbd>{hotkey}</kbd><span>{icon}</span><small>{label}</small>{badge!==''&&badge!=null&&<em>{badge}</em>}{cooldown>0&&<i style={{'--cool':`${Math.min(100,cooldown/Math.max(.1,maxCooldown)*100)}%`}}/>}</button>}

function Overlay({title,dialogue,onClose,children,mapMode,panelKey}){return <div className={`overlay-shell ${mapMode?'map-overlay':''}`} onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><section className={`window glass ${mapMode?'map-window':''} ${panelKey?`window-${panelKey}`:''}`}><header><div><small>SHADOW ASCENSION</small><h2>{title}</h2>{dialogue&&<p><b>{dialogue.name}</b> — {dialogue.text}</p>}</div><button onClick={onClose}>×</button></header><div className="window-body">{children}</div></section></div>}

const rarityRank={Comum:0,Incomum:1,Rara:2,'Épica':3,'Lendária':4,'Mítica':5}
const itemRarityRank=item=>Number.isFinite(Number(item?.rarityTier))?Number(item.rarityTier):(rarityRank[item?.rarity]??0)

// Pointer-up is more reliable than delayed synthetic click on mobile browsers,
// especially inside scrollable modal panels. It also works with a mouse.
const tabPointer=(setter,value)=>(e)=>{
  if(e.pointerType==='mouse'&&e.button!==0)return
  e.preventDefault();e.stopPropagation();setter(value)
}

function HorizontalRail({children,className=''}){
  const ref=useRef(null)
  const wheel=e=>{
    const el=ref.current
    if(!el||Math.abs(e.deltaX)>Math.abs(e.deltaY)||!e.deltaY)return
    if(el.scrollWidth>el.clientWidth){el.scrollLeft+=e.deltaY;e.preventDefault()}
  }
  return <div ref={ref} className={`horizontal-rail ${className}`} onWheel={wheel}>{children}</div>
}

function Inventory({hud,equip,unequip,call}){
  const gear=hud.equipment||{}
  const [tab,setTab]=useState('all')
  const [rarity,setRarity]=useState('all')
  const items=hud.inventory||[]
  const categories={
    all:()=>true,
    equipment:it=>['weapon','armor','boots','talisman'].includes(it.type),
    tools:it=>it.type==='tool'||it.subtype==='axe'||it.subtype==='pickaxe',
    consumables:it=>it.type==='consumable'||it.subtype==='potion'||it.subtype==='grimoire',
    drops:it=>it.type==='material'||it.type==='resource'||['monster-drop','wood','coal','iron','fish'].includes(it.subtype),
  }
  const filteredItems=items
    .filter(categories[tab]||categories.all)
    .filter(it=>rarity==='all'||it.rarity===rarity)
    .slice()
    .sort((a,b)=>itemRarityRank(b)-itemRarityRank(a)||(a.type||'').localeCompare(b.type||'')||(a.name||'').localeCompare(b.name||''))
  const rarityOptions=['all','Mítica','Lendária','Épica','Rara','Incomum','Comum'].filter(r=>r==='all'||items.some(it=>it.rarity===r))

  return <div className="inventory-rpg">
    <section className="character-hub">
      <div className="hub-title"><span>PERSONAGEM</span><b>Nível {hud.level}</b></div>
      <div className="paperdoll">
        <div className="paperdoll-glow"/><div className="paper-human"><i className="ph-head"/><i className="ph-body"/><i className="ph-arm left"/><i className="ph-arm right"/><i className="ph-leg left"/><i className="ph-leg right"/></div>
        <EquipNode cls="weapon-node" slot="weapon" item={gear.weapon} unequip={unequip}/><EquipNode cls="armor-node" slot="armor" item={gear.armor} unequip={unequip}/><EquipNode cls="talisman-node" slot="talisman" item={gear.talisman} unequip={unequip}/><EquipNode cls="boots-node" slot="boots" item={gear.boots} unequip={unequip}/>
      </div>
      <div className="combat-stats"><div><small>DAMAGE</small><b>{hud.atk}</b></div><div><small>ARMOR</small><b>{hud.def}</b></div><div><small>CRÍTICO</small><b>{(14+(hud.critChance||0)).toFixed(1)}%</b></div><div><small>OURO</small><b>{hud.gold}</b></div></div>
      <p className="hub-note">🪓 Machado corta árvores. ⛏️ Picareta quebra minérios. Armas e armaduras perdem durabilidade com o uso e podem ser reparadas no ferreiro.</p>
    </section>
    <section className="bag-rpg">
      <div className="section-title"><div><small>INVENTÁRIO ORGANIZADO</small><h3>Mochila do Desperto</h3></div><span>{items.length}/40 slots</span></div>
      <div className="bag-category-tabs inventory-tabs native-tab-row category-tab-wrap">
        <button className={tab==='all'?'active':''} onPointerUp={tabPointer(setTab,'all')} onClick={()=>setTab('all')}>Todos ({items.length})</button>
        <button className={tab==='equipment'?'active':''} onPointerUp={tabPointer(setTab,'equipment')} onClick={()=>setTab('equipment')}>⚔ Equipamentos</button>
        <button className={tab==='tools'?'active':''} onPointerUp={tabPointer(setTab,'tools')} onClick={()=>setTab('tools')}>🪓 Ferramentas</button>
        <button className={tab==='consumables'?'active':''} onPointerUp={tabPointer(setTab,'consumables')} onClick={()=>setTab('consumables')}>🧪 Consumíveis</button>
        <button className={tab==='drops'?'active':''} onPointerUp={tabPointer(setTab,'drops')} onClick={()=>setTab('drops')}>🐟 Drops & Recursos</button>
      </div>
      <div className="rarity-filter-row"><span>Raridade:</span>{rarityOptions.map(r=><button key={r} className={rarity===r?'active':''} onPointerUp={tabPointer(setRarity,r)} onClick={()=>setRarity(r)}>{r==='all'?'Todas':r}</button>)}</div>
      <div className="bag-grid-scroll"><div className="bag-grid">
        {filteredItems.map(it=><ItemCard key={it.id} item={it} compact actions={['weapon','armor','boots','talisman','tool'].includes(it.type)?<button onClick={()=>equip(it.id)}>Equipar</button>:it.subtype==='potion'?<button onClick={()=>call?.('usePotion')}>Usar</button>:null}/>) }
        {filteredItems.length===0&&<p className="empty-tab-hint">Nenhum item nesta categoria/raridade.</p>}
        {Array.from({length:Math.max(0,12-filteredItems.length)}).map((_,i)=><div key={`empty-${i}`} className="empty-slot"/>)}
      </div></div>
      <div className="bag-help">Drops iguais acumulam no mesmo slot. O número no canto mostra a quantidade da pilha.</div>
    </section>
  </div>
}

function EquipNode({slot,item,unequip,cls}){
  const max=Number(item?.maxDurability)||0,cur=Number(item?.durability),pct=max?Math.max(0,Math.min(100,(Number.isFinite(cur)?cur:max)/max*100)):100
  return <button className={`equip-node ${cls} ${item?'filled':''} ${item?.broken?'broken':''}`} style={{'--rarity':item?.color||'#6d7884'}} onClick={()=>item&&unequip(slot)} title={item?'Clique para remover':slotNames[slot]}>
    <span>{slotIcon(slot, item)}</span><small>{slotNames[slot]}</small>
    {item&&<em>{item.rarity} +{item.upgrade||0}{max?` • ${Math.round(pct)}%`:''}</em>}
    {item&&max>0&&<i className="durability-mini"><u style={{width:`${pct}%`}}/></i>}
  </button>
}

function slotIcon(s, item){
  if(s==='weapon'||item?.type==='weapon'){
    if(item?.subtype==='bow') return '🏹'
    if(item?.subtype==='dagger') return '🗡'
    if(item?.subtype==='spellbook') return '📖'
    if(item?.subtype==='axe') return '🪓'
    if(item?.subtype==='pickaxe') return '⛏️'
    return '⚔'
  }
  if(s==='tool'||item?.type==='tool'){
    if(item?.subtype==='pickaxe') return '⛏️'
    return '🪓'
  }
  return s==='armor'?'◈':s==='boots'?'⬒':s==='talisman'?'✦':'◆'
}

function ItemCard({item,actions,compact=false}){
  const stats=item.stats||{}
  const orbIcon=item.icon||(item.type==='tool'?(item.subtype==='pickaxe'?'⛏️':'🪓'):item.type==='weapon'?(item.subtype==='bow'?'🏹':item.subtype==='dagger'?'🗡':item.subtype==='spellbook'?'📖':item.subtype==='axe'?'🪓':item.subtype==='pickaxe'?'⛏️':'⚔'):item.type==='armor'?'◈':item.type==='boots'?'⬒':item.type==='material'||item.type==='resource'?'🪵':item.subtype==='potion'?'🧪':'✦')
  const qty=Math.max(1,Number(item.qty)||1),max=Number(item.maxDurability)||0,cur=Number.isFinite(Number(item.durability))?Number(item.durability):max,durPct=max?Math.max(0,Math.min(100,cur/max*100)):100
  return <article className={`item-card ${compact?'compact':''} ${item.broken||durPct<=0?'broken':''}`} style={{'--rarity':item.color||'#cbd5e1'}} title={`${item.name} • Nv.${item.level||1}`}>
    {qty>1&&<strong className="stack-badge">×{qty}</strong>}
    <div className="item-orb">{orbIcon}</div><b>{item.name}</b>
    <small style={{color:item.color}}>{item.rarity}{qty>1?` • Pilha ${qty}`:''} • Nv.{item.level||1}</small>
    <span>{stats.attack?`+${Math.round(stats.attack)} ATK `:''}{stats.defense?`+${Math.round(stats.defense)} DEF `:''}{stats.speed?`+${stats.speed} SPD `:''}{stats.range?`[${stats.range}m] `:''}{item.harvestBonus?.tree?`Madeira ×${item.harvestBonus.tree} `:''}{item.harvestBonus?.ore?`Minérios ×${item.harvestBonus.ore} `:''}{!stats.attack&&!stats.defense&&!stats.speed&&!item.harvestBonus&&item.power?`Poder ${item.power}`:''}{item.description?item.description:''}</span>
    {max>0&&<div className="durability-row"><small>{durPct<=0?'QUEBRADO':`Durabilidade ${Math.round(cur)}/${max}`}</small><i><u style={{width:`${durPct}%`}}/></i></div>}
    {item.upgrade>0&&<strong className="upgrade-badge">+{item.upgrade}</strong>}
    <footer>{actions}</footer>
  </article>
}

function Quests({hud,accept,claim}){const groups={active:hud.quests?.filter(q=>q.status==='active'||q.status==='ready')||[],available:hud.quests?.filter(q=>q.status==='available')||[],done:hud.quests?.filter(q=>q.status==='done')||[]};return <div className="quest-layout"><QuestList title="Em andamento" list={groups.active} hud={hud} accept={accept} claim={claim}/><QuestList title="Disponíveis" list={groups.available} hud={hud} accept={accept} claim={claim}/><QuestList title="Concluídas" list={groups.done} hud={hud} accept={accept} claim={claim}/></div>}
function QuestList({title,list,hud,accept,claim}){return <section className="quest-group"><h3>{title}</h3>{!list.length&&<p className="empty">Nenhuma missão.</p>}{list.map(q=><article className={`quest ${q.status}`} key={q.id}><div><b>{q.title}</b><small>{q.giver} • Nv.{q.minLevel}+</small></div><p>{q.text}</p>{q.status!=='available'&&q.status!=='done'&&<Bar value={Math.min(100,(q.progress||0)/q.goal*100)} cls="questbar"/>}<footer><span>{q.status==='active'||q.status==='ready'?`${q.progress||0}/${q.goal}`:`XP ${q.reward.xp} • ◈ ${q.reward.gold}`}</span>{q.status==='available'&&<button disabled={hud.level<q.minLevel} onClick={()=>accept(q.id)}>Aceitar</button>}{q.status==='ready'&&<button onClick={()=>claim(q.id)}>Receber</button>}</footer></article>)}</section>}


function Guild({hud,accept,claim,createParty,joinParty,leaveParty}){
  const currentIndex=hud.guildRankIndex||0,current=GUILD_RANKS[currentIndex]||GUILD_RANKS[0],next=GUILD_RANKS[currentIndex+1]
  const missions=hud.guildMissions||[],party=hud.party||{},members=party.members||[],online=hud.onlinePlayers||[]
  return <div className="guild-layout">
    <aside className="guild-rank-card"><small>RANK DA GUILDA</small><strong>{current.id}</strong><h3>{current.name}</h3><p>{hud.guildPoints||0} pontos de guilda</p>{next&&<><Bar value={Math.min(100,(hud.guildPoints||0)/Math.max(1,hud.guildNextRequirement||1)*100)} cls="guildbar"/><em>Próximo: {next.id} • Nv.{next.minLevel}+ • {hud.guildNextRequirement||0} pts</em></>}<div className="rank-strip">{GUILD_RANKS.map((r,i)=><span key={r.id} className={i===currentIndex?'active':i<currentIndex?'done':''}>{r.id}</span>)}</div></aside>
    <section className="guild-missions">
      <div className="party-panel">
        <div className="section-title"><div><small>EQUIPE DA GUILDA</small><h3>XP compartilhado</h3></div><span>{party.id?`${members.length}/4 membros • Pool ${party.totalXP||0} XP`:'Sem equipe'}</span></div>
        {party.id?<><div className="party-members">{members.map(m=><span key={m.id} className={m.id===party.leaderId?'leader':''}><b>{m.name}</b><small>Lv.{m.level} • {m.guildRank}</small></span>)}</div><button className="party-action danger" onClick={leaveParty}>Sair da equipe</button></>:<button className="party-action" disabled={!hud.multiplayer?.connected} onClick={createParty}>Criar equipe</button>}
        {!!online.length&&<div className="party-online"><small>AVENTUREIROS ONLINE</small>{online.map(p=><button key={p.id} onClick={()=>joinParty(p.id)} disabled={!hud.multiplayer?.connected||members.some(m=>m.id===p.id)}><span>{p.name}</span><em>Lv.{p.level} • {p.guildRank}</em><b>Formar equipe</b></button>)}</div>}
      </div>
      <div className="section-title"><div><small>CONTRATOS REPETÍVEIS</small><h3>Quadro de Missões</h3></div><span>Renovam com o ciclo da guilda</span></div>
      <div className="guild-grid">{missions.map(m=>{const locked=hud.level<m.minLevel||currentIndex<m.rankIndex;return <article key={m.id} className={`guild-mission ${m.status} ${locked?'locked':''}`}><header><b>RANK {m.rank}</b><span>Nv.{m.minLevel}+</span></header><h4>{m.title}</h4><p>{m.text}</p>{m.status==='active'||m.status==='ready'?<Bar value={Math.min(100,(m.progress||0)/m.goal*100)} cls="questbar"/>:null}<footer><span>{m.status==='active'||m.status==='ready'?`${m.progress||0}/${m.goal}`:`XP ${m.reward.xp} • ${m.reward.gold}◈ • ${m.reward.guildPoints} GP`}</span>{m.status==='available'&&<button disabled={locked} onClick={()=>accept(m.id)}>{locked?'Rank bloqueado':'Aceitar'}</button>}{m.status==='ready'&&<button onClick={()=>claim(m.id)}>Concluir e repetir</button>}</footer></article>})}</div>
    </section>
  </div>
}

function Attributes({hud,allocate}){
  const attrs=hud.attributes||{},totalPoints=hud.attributePoints||0
  const [staged,setStaged]=useState({strength:0,vitality:0,agility:0,intellect:0})

  const stagedTotal=(staged.strength||0)+(staged.vitality||0)+(staged.agility||0)+(staged.intellect||0)
  const remaining=Math.max(0,totalPoints-stagedTotal)

  const addPoint=(id)=>{
    if(remaining<=0)return
    setStaged(prev=>({...prev,[id]:(prev[id]||0)+1}))
  }

  const removePoint=(id)=>{
    if((staged[id]||0)<=0)return
    setStaged(prev=>({...prev,[id]:Math.max(0,prev[id]-1)}))
  }

  const handleClear=()=>{
    setStaged({strength:0,vitality:0,agility:0,intellect:0})
  }

  const handleConfirm=()=>{
    if(stagedTotal<=0)return
    allocate(staged)
    setStaged({strength:0,vitality:0,agility:0,intellect:0})
  }

  const previewAtk=hud.atk+(staged.strength||0)*2
  const previewDef=hud.def+Math.round((staged.vitality||0)*0.35)
  const previewHp=hud.maxHp+(staged.vitality||0)*12
  const previewStamina=hud.maxStamina+Math.round((staged.agility||0)*1.5+(staged.intellect||0)*2)

  return <div className="attributes-layout">
    <section className="attribute-hero">
      <small>PONTOS DISPONÍVEIS</small>
      <strong>{remaining}</strong>
      {stagedTotal>0&&<div className="staged-tag">Pendente: +{stagedTotal}</div>}
      <h3>1 ponto por nível</h3>
      <p>Distribua os pontos nos atributos desejados. Clique em <b>Confirmar</b> para salvar a distribuição ou <b>Limpar</b> para cancelar.</p>
      <div className="attribute-summary">
        <span className={staged.strength>0?'highlight-stat':''}>⚔ {previewAtk} ATK{staged.strength>0?` (+${staged.strength*2})`:''}</span>
        <span className={staged.vitality>0?'highlight-stat':''}>🛡 {previewDef} DEF{staged.vitality>0?` (+${Math.round(staged.vitality*0.35)})`:''}</span>
        <span className={staged.vitality>0?'highlight-stat':''}>♥ {previewHp} HP{staged.vitality>0?` (+${staged.vitality*12})`:''}</span>
        <span className={(staged.agility>0||staged.intellect>0)?'highlight-stat':''}>✦ {previewStamina} Vigor</span>
      </div>
      <div className="attribute-actions-row">
        <button className="attr-confirm-btn" disabled={stagedTotal===0} onClick={handleConfirm} title="Confirmar pontos distribuídos">
          ✓ Confirmar ({stagedTotal})
        </button>
        <button className="attr-clear-btn" disabled={stagedTotal===0} onClick={handleClear} title="Limpar seleção e recomeçar">
          ↺ Limpar
        </button>
      </div>
    </section>
    <section className="attribute-grid">
      {ATTRIBUTE_DEFS.map(a=>{
        const cur=attrs[a.id]||0,add=staged[a.id]||0
        return <article key={a.id} className={add>0?'attr-staged':''}>
          <div className="attr-icon">{a.icon}</div>
          <div className="attr-info">
            <small>{a.name.toUpperCase()}</small>
            <b>{cur}{add>0&&<em className="staged-plus"> +{add}</em>}</b>
            <p>{a.description}</p>
          </div>
          <div className="attr-stepper">
            {add>0&&<button className="step-btn minus" onClick={()=>removePoint(a.id)} title="Diminuir ponto">−1</button>}
            <button className="step-btn plus" disabled={remaining<=0} onClick={()=>addPoint(a.id)} title="Adicionar ponto">+1</button>
          </div>
        </article>
      })}
    </section>
  </div>
}

function MobileControls({hud,abilities,call,touch,onHelp}){
  const stickRef=useRef(null),pointerRef=useRef(null);const [stick,setStick]=useState({x:0,y:0});const [menuOpen,setMenuOpen]=useState(false)
  const potionQty=hud.inventory?.find(i=>i.subtype==='potion')?.qty||0
  const update=(e)=>{const el=stickRef.current;if(!el)return;const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.33,len=Math.hypot(dx,dy)||1,k=Math.min(1,max/len),x=dx*k,y=dy*k;setStick({x,y});call('setVirtualMove',x/max,-y/max)}
  const start=e=>{pointerRef.current=e.pointerId;e.currentTarget.setPointerCapture?.(e.pointerId);update(e)}
  const move=e=>{if(pointerRef.current===e.pointerId)update(e)}
  const end=e=>{if(pointerRef.current===e.pointerId){pointerRef.current=null;setStick({x:0,y:0});call('setVirtualMove',0,0)}}
  const toggleRun=()=>call('setMobileRun',!hud.mobileRunning)
  const closeAnd=(panel)=>{setMenuOpen(false);call('togglePanel',panel)}
  if(!touch)return null
  return <div className="mobile-ui">
    <button className={`mobile-menu-toggle glass ${menuOpen?'open':''}`} onClick={()=>setMenuOpen(v=>!v)}>
      {menuOpen?'✕':'☰'}
      <small>{menuOpen?'FECHAR':'MENU'}</small>
      {hud.attributePoints>0&&<b className="mobile-menu-badge">{hud.attributePoints}</b>}
    </button>
    {menuOpen&&<div className="mobile-menu-drawer glass">
      <button onClick={()=>closeAnd('inventory')}>🎒<small>Inventário</small></button>
      <button onClick={()=>closeAnd('grimoire')}>📖<small>Classes</small></button>
      <button onClick={()=>closeAnd('quests')}>📜<small>Missões</small></button>
      <button onClick={()=>closeAnd('guild')}>🏛<small>Guilda</small></button>
      <button onClick={()=>closeAnd('travel')}>🚐<small>Viajante</small></button>
      <button onClick={()=>closeAnd('trade')}>🤝<small>Troca</small></button>
      <button onClick={()=>closeAnd('attributes')}>
        ✚<small>Atributos</small>
        {hud.attributePoints>0&&<em className="drawer-badge">+{hud.attributePoints}</em>}
      </button>
      <button onClick={()=>closeAnd('map')}>🗺<small>Mapa</small></button>
      <button onClick={()=>closeAnd('settings')}>⚙<small>Opções</small></button>
      <button onClick={()=>{setMenuOpen(false);call('toggleCombatMode')}}>
        {hud.combatMode?'🎯':'👁'}<small>{hud.combatMode?'Mira Fixa':'Câm. Livre'}</small>
      </button>
      <button onClick={()=>{setMenuOpen(false);onHelp()}}>❔<small>Ajuda</small></button>
    </div>}
    {!hud.uiPanel&&<>
      {hud.multiplayer?.connected&&<div className={`mobile-network-chip glass ${hud.multiplayer?.quality||''}`}><b>● ONLINE</b><span>{hud.multiplayer.players||0}</span><small>{String(hud.multiplayer?.room||'asterra-01').replace('asterra-','L')}</small>{hud.multiplayer.latencyMs>0&&<small>{Math.round(hud.multiplayer.latencyMs)} ms</small>}</div>}
      {hud.actionButton&&<button disabled={hud.actionButton.blocked} className={`mobile-prominent-action ${hud.actionButton.type||''} ${hud.actionButton.blocked?'blocked':''}`} onClick={()=>call('interact')} aria-label={hud.actionButton.label}><span>{hud.actionButton.icon||'☞'}</span><div><b>{hud.actionButton.label}</b>{hud.actionButton.detail&&<small>{hud.actionButton.detail}</small>}</div><em>{hud.actionButton.blocked?'EQUIPE':'TOCAR'}</em></button>}
      <div ref={stickRef} className="mobile-stick" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}><i style={{transform:`translate(${stick.x}px,${stick.y}px)`}}/></div>
      <div className="mobile-actions">
        <button className="mobile-attack" onPointerDown={e=>{e.currentTarget.setPointerCapture?.(e.pointerId);call('setAutoAttack',true)}} onPointerUp={e=>{try{e.currentTarget.releasePointerCapture?.(e.pointerId)}catch{};call('setAutoAttack',false)}} onPointerCancel={()=>call('setAutoAttack',false)}>⚔<small>ATACAR</small></button>
        <button className="mobile-block" onPointerDown={e=>{e.currentTarget.setPointerCapture?.(e.pointerId);call('setMobileBlock',true)}} onPointerUp={e=>{try{e.currentTarget.releasePointerCapture?.(e.pointerId)}catch{};call('setMobileBlock',false)}} onPointerCancel={()=>call('setMobileBlock',false)}>🛡<small>DEFESA</small></button>
        <button className="mobile-dash" onClick={()=>call('dash')}>↯<small>ESQUIVA</small></button>
        <button className={`mobile-use ${hud.actionButton?'has-context':''}`} onClick={()=>call('interact')}>{hud.actionButton?.icon||'☞'}<small>USAR</small></button>
        <button className={`mobile-run ${hud.mobileRunning?'active':''}`} onClick={toggleRun}>🏃<small>{hud.mobileRunning?'CORRENDO':'CORRER'}</small></button>
        <button className="mobile-jump" onClick={()=>call('setMobileJump')}>↥<small>PULAR</small></button>
      </div>
      <div className="mobile-powers-bottom">
        {abilities.map(a=><button key={a.slot} disabled={!a.ready||hud.stamina<a.cost} onClick={()=>call('castAbility',a.slot)} title={`${a.name} • ${a.cost} vigor`}><span>{a.icon}</span><small>{a.short||a.name}</small>{a.remaining>0&&<em>{a.remaining.toFixed(1)}</em>}</button>)}
        <button className={`mobile-potion-btn ${!potionQty?'empty':''}`} disabled={!potionQty} onClick={()=>call('usePotion')} title="Usar poção de vida (R)"><span>🧪</span><small>Poção</small>{potionQty>0&&<em>{potionQty}</em>}</button>
        <button className={hud.mount?.active?'active mount-active':''} onClick={()=>call('toggleMount')} title="Montaria (H)"><span>♞</span><small>{hud.mount?.active?'Descer':'Montar'}</small></button>
      </div>
    </>}
  </div>
}

function MerchantCard({item,mode,hud,isSelected,onToggleSelect,onSell,onBuy,sellValue,isDemanded}){
  const stats=item.stats||{}
  const qty=Math.max(1,Number(item.qty)||1)
  const max=Number(item.maxDurability)||0
  const cur=Number.isFinite(Number(item.durability))?Number(item.durability):max
  const durPct=max?Math.max(0,Math.min(100,cur/max*100)):100
  const orbIcon=item.icon||(item.type==='tool'?(item.subtype==='pickaxe'?'⛏️':'🪓'):item.type==='weapon'?(item.subtype==='bow'?'🏹':item.subtype==='dagger'?'🗡':item.subtype==='spellbook'?'📖':item.subtype==='axe'?'🪓':item.subtype==='pickaxe'?'⛏️':'⚔'):item.type==='armor'?'◈':item.type==='boots'?'⬒':item.type==='material'||item.type==='resource'?'🪵':item.subtype==='potion'?'🧪':'✦')
  const statSummary=stats.attack?`+${Math.round(stats.attack)} ATK `:stats.defense?`+${Math.round(stats.defense)} DEF `:stats.speed?`+${stats.speed} SPD `:stats.range?`[${stats.range}m] `:item.harvestBonus?.tree?`Madeira ×${item.harvestBonus.tree} `:item.harvestBonus?.ore?`Minérios ×${item.harvestBonus.ore} `:item.power?`Poder ${item.power}`:(item.description||'')
  const canBuy=hud.gold>=item.value

  return (
    <article
      className={`merchant-card ${mode==='sell'&&isSelected?'is-selected':''} ${isDemanded?'is-demanded':''}`}
      style={{'--rarity':item.color||'#94a3b8'}}
      onClick={()=>mode==='sell'&&onToggleSelect(item.id)}
    >
      <div className="mc-left">
        <div className="mc-orb-wrap" style={{borderColor:item.color||'#64748b'}}>
          <span className="mc-orb">{orbIcon}</span>
          {qty>1&&<span className="mc-badge-qty">×{qty}</span>}
          {item.upgrade>0&&<span className="mc-badge-up">+{item.upgrade}</span>}
        </div>
      </div>
      <div className="mc-body">
        <div className="mc-top">
          <b className="mc-name" style={{color:item.color||'#fff'}}>{item.name}</b>
          <span className="mc-tag" style={{color:item.color||'#94a3b8'}}>{item.rarity}{qty>1?` • ${qty}un`:''} • Nv.{item.level||1}</span>
          {isDemanded&&<span className="mc-demand-chip">🔥 Alta Demanda</span>}
        </div>
        <div className="mc-desc">
          {statSummary||(item.type==='material'?'Recurso / Espólio':item.type==='resource'?'Minério / Madeira':'Item comercial')}
        </div>
        {max>0&&(
          <div className="mc-dur-bar">
            <small>{durPct<=0?'QUEBRADO':`Dur. ${Math.round(cur)}/${max}`}</small>
            <i><u style={{width:`${durPct}%`}}/></i>
          </div>
        )}
      </div>
      <div className="mc-right">
        {mode==='buy'?(
          <button
            type="button"
            className="mc-buy-btn"
            disabled={!canBuy}
            onClick={(e)=>{e.stopPropagation();onBuy(item.id)}}
            title={canBuy?`Comprar por ${item.value} ouro`:'Ouro insuficiente'}
          >
            <small>Comprar</small>
            <b>{item.value}◈</b>
          </button>
        ):(
          <div className="mc-sell-btns">
            <button
              type="button"
              className={`mc-checkbox-btn ${isSelected?'checked':''}`}
              onClick={(e)=>{e.stopPropagation();onToggleSelect(item.id)}}
              title={isSelected?'Desmarcar item':'Marcar item para vender'}
            >
              {isSelected?'✓ Sel.':'+ Sel.'}
            </button>
            <button
              type="button"
              className="mc-sell-btn"
              onClick={(e)=>{e.stopPropagation();onSell(item.id)}}
              title={`Vender pilha por ${sellValue(item)} ouro`}
            >
              <small>Vender</small>
              <b>+{sellValue(item)}◈</b>
            </button>
          </div>
        )}
      </div>
    </article>
  )
}

function Merchant({hud,buy,sell,sellMultiple}){
  const eco=hud.economy||{}
  const [mode,setMode]=useState('buy'),[shopTab,setShopTab]=useState('all'),[sellTab,setSellTab]=useState('all'),[selectedIds,setSelectedIds]=useState(new Set())
  const stock=hud.merchant||[]
  const filteredStock=stock.filter(it=>shopTab==='all'||shopTab==='tools'&&(it.type==='tool'||['axe','pickaxe'].includes(it.subtype))||shopTab==='equipment'&&['weapon','armor','boots','talisman'].includes(it.type)||shopTab==='consumables'&&(it.type==='consumable'||['potion','grimoire'].includes(it.subtype))).sort((a,b)=>itemRarityRank(b)-itemRarityRank(a))
  const sellable=hud.inventory?.filter(x=>x.subtype!=='potion')||[]
  const filteredSellable=sellable.filter(it=>sellTab==='all'||sellTab==='drops'&&(it.type==='material'||it.type==='resource'||['monster-drop','wood','coal','iron','fish'].includes(it.subtype))||sellTab==='equipment'&&['weapon','armor','boots','talisman'].includes(it.type)||sellTab==='tools'&&(it.type==='tool'||['axe','pickaxe'].includes(it.subtype))).sort((a,b)=>itemRarityRank(b)-itemRarityRank(a))

  const isDemanded = it => {
    if (!eco.demands || !Array.isArray(eco.demands)) return false
    const sub = (it.subtype || '').toLowerCase(), id = (it.id || '').toLowerCase(), nm = (it.name || '').toLowerCase()
    return eco.demands.some(d => {
      const kd = d.toLowerCase()
      if (kd === 'fish') return sub === 'fish' || nm.includes('peixe')
      if (kd === 'wood') return sub === 'wood' || nm.includes('madeira')
      if (kd === 'ore' || kd === 'minerals') return sub === 'iron' || sub === 'coal' || nm.includes('minério') || nm.includes('barra')
      if (kd === 'light') return id.includes('light') || nm.includes('luz') || nm.includes('aurora')
      if (kd === 'dark') return id.includes('dark') || nm.includes('sombra') || nm.includes('abissal')
      if (kd === 'fire') return id.includes('fire') || nm.includes('cinz') || nm.includes('fogo')
      if (kd === 'wind') return id.includes('wind') || nm.includes('vento') || nm.includes('safira')
      if (kd === 'grimoire') return sub === 'grimoire' || nm.includes('grimório')
      return sub === kd || nm.includes(kd)
    })
  }

  const sellValue = it => {
    const demanded = isDemanded(it)
    const demandMultiplier = demanded ? (eco.demandBonus || 1.6) : 1
    return Math.max(1, Math.round((it.value || 30) * 0.45 * Math.max(1, it.qty || 1) * (eco.sellMult || 1) * demandMultiplier * (it.zoneId && it.zoneId === eco.zoneId ? 1.18 : 1)))
  }

  const toggleSelect=id=>setSelectedIds(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})
  const selectAllFiltered=()=>{
    setSelectedIds(new Set(filteredSellable.map(it=>it.id)))
  }
  const selectDrops=()=>{
    setSelectedIds(new Set(filteredSellable.filter(it=>it.type==='material'||it.type==='resource'||['monster-drop','wood','coal','iron','fish'].includes(it.subtype)).map(it=>it.id)))
  }
  const clearSelection=()=>setSelectedIds(new Set())
  const selectedItems=sellable.filter(it=>selectedIds.has(it.id)),total=selectedItems.reduce((a,it)=>a+sellValue(it),0)
  const sellSelected=()=>{if(!selectedIds.size)return;sellMultiple?sellMultiple([...selectedIds]):[...selectedIds].forEach(sell);setSelectedIds(new Set())}

  return (
    <div className="merchant-modern">
      <div className="merchant-head-row">
        <div className="merchant-mode-tabs">
          <button className={mode==='buy'?'active':''} onPointerUp={tabPointer(setMode,'buy')} onClick={()=>setMode('buy')}>
            🛒 COMPRAR ({stock.length})
          </button>
          <button className={mode==='sell'?'active':''} onPointerUp={tabPointer(setMode,'sell')} onClick={()=>setMode('sell')}>
            💰 VENDER ({sellable.length})
          </button>
        </div>
        <div className="merchant-balance-card">
          <div className="m-bal-gold">💰 <b>{hud.gold}◈</b></div>
          <div className="m-bal-eco">{eco.label||hud.currentCity||'Mercado'} • {eco.sellMult||1}x</div>
        </div>
      </div>

      {eco.demands?.length>0 && (
        <div className="merchant-economy-banner">
          <div className="eco-banner-main">
            <span className="eco-flame-icon">🔥</span>
            <div>
              <span className="eco-title">ALTA PROCURA EM {eco.label?.toUpperCase() || 'NESTA CIDADELA'}:</span>
              <b className="eco-items"> {eco.demandLabel || 'Mercadorias Regionais'}</b>
              <span className="eco-bonus-badge">+{Math.round(((eco.demandBonus || 1.6) - 1) * 100)}% de Lucro</span>
            </div>
          </div>
          {eco.tradeHint && <div className="eco-hint-row">💡 <em>{eco.tradeHint}</em></div>}
        </div>
      )}

      {mode==='buy'?(
        <section className="merchant-pane">
          <div className="merchant-toolbar">
            <div className="shop-category-tabs native-tab-row category-tab-wrap">
              <button className={shopTab==='all'?'active':''} onPointerUp={tabPointer(setShopTab,'all')} onClick={()=>setShopTab('all')}>Todos</button>
              <button className={shopTab==='tools'?'active':''} onPointerUp={tabPointer(setShopTab,'tools')} onClick={()=>setShopTab('tools')}>🪓 Ferramentas</button>
              <button className={shopTab==='equipment'?'active':''} onPointerUp={tabPointer(setShopTab,'equipment')} onClick={()=>setShopTab('equipment')}>⚔ Equipamentos</button>
              <button className={shopTab==='consumables'?'active':''} onPointerUp={tabPointer(setShopTab,'consumables')} onClick={()=>setShopTab('consumables')}>🧪 Consumíveis</button>
            </div>
            <span className="shop-refresh-badge">⏱ {formatRefresh(hud.shopRefresh?.remainingMs)}</span>
          </div>

          <div className="merchant-grid-list">
            {!filteredStock.length&&<p className="empty merchant-empty">Nenhum item disponível nesta categoria.</p>}
            {filteredStock.map(it=>(
              <MerchantCard
                key={it.id}
                item={it}
                mode="buy"
                hud={hud}
                onBuy={buy}
              />
            ))}
          </div>
        </section>
      ):(
        <section className="merchant-pane">
          <div className="merchant-toolbar merchant-sell-toolbar">
            <div className="shop-category-tabs native-tab-row category-tab-wrap">
              <button className={sellTab==='all'?'active':''} onPointerUp={tabPointer(setSellTab,'all')} onClick={()=>setSellTab('all')}>Todos</button>
              <button className={sellTab==='drops'?'active':''} onPointerUp={tabPointer(setSellTab,'drops')} onClick={()=>setSellTab('drops')}>🐟 Drops</button>
              <button className={sellTab==='equipment'?'active':''} onPointerUp={tabPointer(setSellTab,'equipment')} onClick={()=>setSellTab('equipment')}>⚔ Equipamentos</button>
              <button className={sellTab==='tools'?'active':''} onPointerUp={tabPointer(setSellTab,'tools')} onClick={()=>setSellTab('tools')}>🪓 Ferramentas</button>
            </div>

            <div className="merchant-batch-bar">
              <button type="button" className="batch-btn select-drops" onClick={selectDrops} title="Selecionar todos os materiais e drops">
                Drops
              </button>
              <button type="button" className="batch-btn select-all" onClick={selectAllFiltered} title="Marcar todos os itens desta categoria">
                Todos
              </button>
              {selectedIds.size>0&&(
                <button type="button" className="batch-btn clear-all" onClick={clearSelection} title="Desmarcar todos">
                  Limpar
                </button>
              )}
              {selectedIds.size>0&&(
                <button type="button" className="batch-sell-execute-btn" onClick={sellSelected}>
                  Vender {selectedIds.size} (+{total}◈)
                </button>
              )}
            </div>
          </div>

          <div className="merchant-grid-list sell-grid-list">
            {!filteredSellable.length&&<p className="empty merchant-empty">Nada para vender nesta categoria.</p>}
            {filteredSellable.map(it=>(
              <MerchantCard
                key={it.id}
                item={it}
                mode="sell"
                hud={hud}
                isSelected={selectedIds.has(it.id)}
                onToggleSelect={toggleSelect}
                onSell={sell}
                sellValue={sellValue}
                isDemanded={isDemanded(it)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function TradeModal({hud,call,onClose}){
  const online=(hud.onlinePlayers||[]).filter(p=>p.name!==hud.playerName)
  const [partner,setPartner]=useState(online[0]?.id||null)
  const [offerItems,setOfferItems]=useState([])
  const [offerGold,setOfferGold]=useState(0)
  const [confirmed,setConfirmed]=useState(false)
  const [tradeDone,setTradeDone]=useState(false)

  const toggleItem=(id)=>{
    setOfferItems(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id])
  }

  const handleConfirm=()=>{
    if(!partner){return}
    setConfirmed(true)
    setTimeout(()=>{
      const ok=call('executeTrade',{
        partnerId: partner,
        itemIds: offerItems,
        gold: Math.min(hud.gold, Math.max(0, Number(offerGold)||0))
      })
      setTradeDone(!!ok)
      if(!ok)setConfirmed(false)
    }, 450)
  }

  return <div className="trade-modal-layout">
    <div className="trade-header glass">
      <div className="trade-partner-select">
        <label>Negociar com:</label>
        {online.length>0 ? (
          <select value={partner||''} onChange={e=>setPartner(e.target.value)}>
            {online.map(p=><option key={p.id} value={p.id}>{p.name} (Nv.{p.level})</option>)}
          </select>
        ) : (
          <span className="no-players-hint">Nenhum jogador por perto no servidor (Simulação Local disponível)</span>
        )}
      </div>
      <div className="trade-gold-balance">
        <span>💰 Seu Saldo Disponível: <b>{hud.gold} ◈ Ouro</b></span>
      </div>
    </div>

    <div className="trade-offer-grid">
      <div className="trade-box my-offer">
        <h4>Sua Oferta</h4>
        <div className="trade-gold-input">
          <label>Ouro a transferir:</label>
          <input
            type="number"
            min="0"
            max={hud.gold}
            value={offerGold}
            onChange={e=>setOfferGold(Math.min(hud.gold, Math.max(0, parseInt(e.target.value)||0)))}
          />
          <b>◈</b>
        </div>
        <small className="offer-hint">Marque os itens da sua mochila para incluir na troca:</small>
        <div className="trade-inventory-list scroll-touch">
          {!hud.inventory?.length&&<p className="empty">Sua mochila está vazia.</p>}
          {hud.inventory?.map(it=>{
            const selected=offerItems.includes(it.id)
            return <div key={it.id} className={`trade-item-row ${selected?'selected':''}`} onClick={()=>toggleItem(it.id)}>
              <input type="checkbox" checked={selected} readOnly />
              <span className="trade-item-name">
                <i>{it.icon || slotIcon(it.type, it)}</i>
                <b>{it.name}</b>
                <small>{it.rarity}{it.qty>1?` ×${it.qty}`:''}</small>
              </span>
              <em className="trade-item-val">{it.value}◈</em>
            </div>
          })}
        </div>
      </div>

      <div className="trade-box their-offer">
        <h4>Negociação com {online.find(p=>p.id===partner)?.name || 'Aventureiro'}</h4>
        <div className="their-status">
          {tradeDone ? (
            <div className="trade-success-box">
              <span className="success-icon">✅</span>
              <b>Troca Concluída com Sucesso!</b>
              <p>Os itens selecionados e o ouro foram transferidos com segurança.</p>
            </div>
          ) : confirmed ? (
            <div className="trade-waiting-box">
              <span className="waiting-spinner">⏳</span>
              <b>Sincronizando com o servidor...</b>
              <p>Confirmando transferência de inventário.</p>
            </div>
          ) : (
            <div className="trade-standby-box">
              <span className="standby-icon">🤝</span>
              <b>Selecione itens e ouro para enviar</b>
              <p>Ambos os jogadores confirmam a proposta antes da transferência ser finalizada.</p>
            </div>
          )}
        </div>
      </div>
    </div>

    <div className="trade-actions-footer">
      {tradeDone ? (
        <button className="trade-finish-btn" onClick={onClose}>Concluir e Fechar</button>
      ) : (
        <>
          <button className="trade-cancel-btn" onClick={onClose}>Cancelar</button>
          <button className="trade-confirm-btn" disabled={confirmed} onClick={handleConfirm}>
            {confirmed ? 'Confirmado! Processando...' : `Confirmar Proposta (${offerItems.length} itens + ${offerGold}◈)`}
          </button>
        </>
      )}
    </div>
  </div>
}

function Blacksmith({hud,upgrade,buy,repair}){
  const weapons=(hud.merchant||[]).filter(it=>it.type==='weapon'||it.type==='armor'),eco=hud.economy||{}
  return <><div className="economy-banner forge-economy"><div><small>FORJA REGIONAL</small><b>{eco.label||hud.currentCity||'Forja local'}</b></div><p>Melhore e repare sua durabilidade. Equipamentos quebrados perdem grande parte da eficiência.</p><span>{eco.material||'Minério regional'}</span></div><div className="blacksmith-layout"><section><div className="forge-banner"><span>🔥</span><div><h3>Forja de {hud.currentCity||'Asterra'}</h3><p>Armas, ferramentas e armaduras perdem durabilidade durante combate e coleta.</p></div><b>◆ {hud.ores||0}</b></div><div className="forge-grid">{EQUIPMENT_SLOTS.map(slot=>{const it=hud.equipment?.[slot],up=it?.upgrade||0,cost=it?Math.round(80+(up+1)*65+it.level*4):0,ore=1+Math.floor(up/3),max=Number(it?.maxDurability)||0,cur=Number.isFinite(Number(it?.durability))?Number(it.durability):max,repairCost=it&&max?Math.max(8,Math.round(Math.max(0,max-cur)*(.22+(Number(it.level)||1)*.012+itemRarityRank(it)*.09))):0;return <article key={slot} style={{'--rarity':it?.color||'#607080'}}><span>{slotIcon(slot,it)}</span><b>{it?.name||slotNames[slot]}</b><small>{it?`${it.rarity} • Nv.${it.level} • +${up}${max?` • Dur. ${Math.round(cur)}/${max}`:''}`:'Nenhum item equipado'}</small><div className="forge-actions"><button disabled={!it||up>=10||hud.gold<cost||(hud.ores||0)<ore} onClick={()=>upgrade(slot)}>{up>=10?'Máximo':`Melhorar ${cost}◈ + ${ore}◆`}</button>{it&&max>0&&cur<max&&<button className="repair-btn" disabled={hud.gold<repairCost} onClick={()=>repair(slot)}>🔧 Reparar {repairCost}◈</button>}</div></article>})}</div></section><aside className="smith-shop"><div className="section-title"><div><small>ARMAS & ARMADURAS</small><h3>Comprar na forja</h3></div><span>◈ {hud.gold}</span></div><div className="smith-stock shop-scroll-list">{weapons.map(it=><article key={it.id} className="shop-scroll-card" style={{'--rarity':it.color}}><ItemCard item={it} compact/><button type="button" disabled={hud.gold<it.value} onClick={()=>buy(it.id)}>Comprar • {it.value}◈</button></article>)}</div></aside></div></>
}

function Stable({hud,toggle}){return <div className="stable"><div className="mount-preview">♞</div><h3>{hud.mount?.name||'Corcel de Aurora'}</h3><p>{hud.mount?.unlocked?'Seu vínculo com a montaria está estabelecido. Ela aumenta bastante a velocidade no mundo aberto.':'Mira só entrega a montaria após o Juramento do Cavaleiro.'}</p><button disabled={!hud.mount?.unlocked} onClick={toggle}>{hud.mount?.active?'Dispensar montaria':'Invocar montaria'}</button></div>}

function Settings({hud,apply,connect,setName,call}){
  const [s,setS]=useState({
    ...hud.settings,
    invertCameraX: hud.settings?.invertCameraX !== undefined ? hud.settings.invertCameraX : !!hud.settings?.invertCamera,
    invertCameraY: hud.settings?.invertCameraY !== undefined ? hud.settings.invertCameraY : false
  })
  const [url,setUrl]=useState(hud.multiplayer?.url||s.multiplayerUrl||'')
  const [nick,setNick]=useState(hud.playerName||'')
  const [saveStatus,setSaveStatus]=useState('')
  const supabaseCfg = getSupabaseConfig()
  const [sbUrl, setSbUrl] = useState(supabaseCfg.url || '')
  const [sbKey, setSbKey] = useState(supabaseCfg.key || '')
  const [sbStatus, setSbStatus] = useState('')
  const currentLobby=hud.multiplayer?.room||s.multiplayerRoom||'asterra-01'

  const handleSaveSupabase = () => {
    saveSupabaseConfig(sbUrl, sbKey)
    setSbStatus('Salvo! Reconectando...')
    setTimeout(() => {
      call('connectMultiplayer', '')
      setSbStatus('')
    }, 1000)
  }

  const update=(k,v)=>{const n={...s,[k]:v};setS(n);apply(n)}
  const qualityPreset=(mode)=>{
    const presets={leve:{renderDistance:2,pixelRatio:.75,shadows:false},equilibrado:{renderDistance:3,pixelRatio:1,shadows:true},bonito:{renderDistance:4,pixelRatio:1.25,shadows:true}}
    const n={...s,...presets[mode]};setS(n);apply(n)
  }

  const handleExport=()=>{
    try{
      const raw=call('exportSaveData')
      if(!raw){setSaveStatus('Nenhum save encontrado');return}
      const blob=new Blob([raw],{type:'application/json'})
      const dl=document.createElement('a')
      dl.href=URL.createObjectURL(blob)
      dl.download=`shadow-ascension-save-${(hud.playerName||'hero').toLowerCase()}.json`
      dl.click()
      setSaveStatus('Backup baixado com sucesso!')
    }catch(err){
      setSaveStatus('Falha ao exportar')
    }
  }

  const handleImport=(e)=>{
    const file=e.target?.files?.[0]
    if(!file)return
    const reader=new FileReader()
    reader.onload=(evt)=>{
      const ok=call('importSaveData',evt.target?.result)
      setSaveStatus(ok?'Save restaurado com sucesso!':'Arquivo de save inválido')
    }
    reader.readAsText(file)
  }

  return <div className="settings">
    <div className="profile-setting">
      <div><b>Perfil do aventureiro</b><small>O nick, nível, HP e rank aparecem acima do seu personagem no multiplayer.</small></div>
      <input value={nick} maxLength={24} onChange={e=>setNick(e.target.value)} placeholder="Seu nick"/>
      <button onClick={()=>setName(nick)}>Salvar nick</button>
    </div>
    <div className="quality-presets glass">
      <div><b>Qualidade rápida</b><small>Streaming V0.9.3 carrega terreno e mobs em filas separadas para reduzir travadas.</small></div>
      <button onClick={()=>qualityPreset('leve')}>⚡ Leve</button>
      <button onClick={()=>qualityPreset('equilibrado')}>⚖ Equilibrado</button>
      <button onClick={()=>qualityPreset('bonito')}>✨ Bonito</button>
    </div>
    <Setting label="Distância de renderização" value={`${s.renderDistance||3} chunks`}>
      <input type="range" min="1" max="4" step="1" value={s.renderDistance||3} onChange={e=>update('renderDistance',Number(e.target.value))}/>
    </Setting>
    <Setting label="Qualidade de resolução" value={`${Math.round((s.pixelRatio||1)*100)}%`}>
      <input type="range" min="0.75" max="1.5" step="0.25" value={s.pixelRatio||1} onChange={e=>update('pixelRatio',Number(e.target.value))}/>
    </Setting>
    <Setting label="Escala base da interface (adaptação automática ativa)" value={`${Math.round((s.uiScale||1.2)*100)}%`}>
      <input type="range" min="0.85" max="2" step="0.05" value={s.uiScale||1.2} onChange={e=>update('uiScale',Number(e.target.value))}/>
    </Setting>
    <Setting label="Sombras" value={s.shadows===false?'Desligadas':'Ligadas'}>
      <button onClick={()=>update('shadows',s.shadows===false)}>Alternar</button>
    </Setting>
    <Setting label="Inverter câmera (lados / horizontal)" value={s.invertCameraX?'Invertida':'Normal'}>
      <button onClick={()=>update('invertCameraX',!s.invertCameraX)}>{s.invertCameraX?'Usar normal':'Inverter lados'}</button>
    </Setting>
    <Setting label="Inverter câmera (cima e baixo / vertical)" value={s.invertCameraY?'Invertida':'Normal'}>
      <button onClick={()=>update('invertCameraY',!s.invertCameraY)}>{s.invertCameraY?'Usar normal':'Inverter cima/baixo'}</button>
    </Setting>
    <p className="camera-setting-note">Controle normal: arrastar para os lados vira para os lados; arrastar para cima olha para cima. Ative a inversão de lados (horizontal) ou cima/baixo (vertical) conforme sua preferência.</p>
    <div className="lobby-setting glass">
      <div><b>Lobbies multiplayer</b><small>Na primeira entrada o jogo escolhe um lobby e salva sua escolha. Ao voltar, você entra automaticamente no último lobby usado.</small></div>
      <div className="lobby-buttons">{multiplayerLobbies.map(l=><button key={l.id} className={currentLobby===l.id?'active':''} onClick={()=>call('setMultiplayerLobby',l.id)}>{l.name}{currentLobby===l.id?<small>ATUAL</small>:null}</button>)}</div>
    </div>
    <div className="save-backup-setting glass">
      <div>
        <b>⚡ Servidor & Banco de Dados Supabase (Online)</b>
        <small>Multiplayer global em tempo real via canais Realtime e salvamento em nuvem PostgreSQL.</small>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginTop:'8px'}}>
        <div style={{display:'grid',gridTemplateColumns:'110px 1fr',gap:'6px',alignItems:'center'}}>
          <span style={{fontSize:'10px',color:'#85a3b5'}}>URL do Projeto:</span>
          <input style={{background:'#07111c',border:'1px solid rgba(142,206,240,.2)',color:'#e8f6ff',padding:'6px 10px',borderRadius:'6px',fontSize:'11px'}} value={sbUrl} onChange={e=>setSbUrl(e.target.value)} placeholder="https://kfnlcrsnvckexzmhbyoy.supabase.co"/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'110px 1fr',gap:'6px',alignItems:'center'}}>
          <span style={{fontSize:'10px',color:'#85a3b5'}}>Chave Pública:</span>
          <input style={{background:'#07111c',border:'1px solid rgba(142,206,240,.2)',color:'#e8f6ff',padding:'6px 10px',borderRadius:'6px',fontSize:'11px'}} value={sbKey} onChange={e=>setSbKey(e.target.value)} placeholder="sb_publishable_..."/>
        </div>
        <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
          <button className="save-btn" onClick={handleSaveSupabase}>⚡ Salvar & Conectar ao Supabase</button>
          {sbStatus&&<span style={{fontSize:'10px',color:'#38bdf8'}}>{sbStatus}</span>}
        </div>
      </div>
    </div>
    <div className="multiplayer-setting">
      <div>
        <b>Multiplayer Tradicional / LAN</b>
        <small>{hud.multiplayer?.connected?`Conectado em ${multiplayerLobbies.find(x=>x.id===currentLobby)?.name||currentLobby} • ${hud.multiplayer.transport==='supabase'?'SUPABASE REALTIME & NUVEM':hud.multiplayer.transport==='http'?'VERCEL/HTTP':'LAN/WEBSOCKET'} • ${hud.multiplayer.players||0} outros jogadores • ${hud.multiplayer.latencyMs?Math.round(hud.multiplayer.latencyMs)+' ms • ':''}${hud.multiplayer.quality||'online'} • save ${hud.multiplayer.serverSave?'OK':'sincronizando'}`:`Offline • último lobby: ${multiplayerLobbies.find(x=>x.id===currentLobby)?.name||currentLobby}${hud.multiplayer?.reconnecting?' • reconectando…':''}${hud.multiplayer?.reason?` • ${hud.multiplayer.reason}`:''}`}</small>
      </div>
      <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Automático ou ws://IP:8765/ws"/>
      <button onClick={()=>connect(url)}>Conectar</button>
      <button className="subtle" onClick={()=>{setUrl('');connect('')}}>Desconectar</button>
    </div>
    <div className="save-backup-setting glass">
      <div>
        <b>Backup e Persistência do Save (Vercel & Local)</b>
        <small>Exporte ou importe seu progresso a qualquer momento para garantir que não haja perda de dados.</small>
      </div>
      <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap',marginTop:'6px'}}>
        <button className="save-btn" onClick={handleExport}>📥 Exportar Backup (.json)</button>
        <label className="save-btn file-label">
          📤 Importar Backup (.json)
          <input type="file" accept=".json" onChange={handleImport} style={{display:'none'}}/>
        </label>
        {saveStatus&&<span style={{fontSize:'10px',color:'#7dd3fc'}}>{saveStatus}</span>}
      </div>
    </div>
    <p className="settings-note">O jogo conecta preferencialmente ao <b>Supabase</b> para multiplayer Realtime e banco PostgreSQL na nuvem. Também suporta fallback automático no <b>Vercel</b> via <b>/api/multiplayer</b> ou na LAN/VPS via WebSocket.</p>
  </div>
}
function Setting({label,value,children}){return <label className="setting"><span><b>{label}</b><small>{value}</small></span>{children}</label>}
function formatRefresh(ms){if(ms==null)return '--:--';const s=Math.max(0,Math.ceil(ms/1000));return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`}


function NicknameGate({initialName='',onSave}){
  const [name,setName]=useState(initialName||'')
  const submit=e=>{
    e?.preventDefault?.()
    if(name.trim().length>=2)onSave(name.trim())
  }
  return (
    <div className="nickname-gate" onKeyDown={e=>e.stopPropagation()}>
      <form className="nickname-card glass" onSubmit={submit} onKeyDown={e=>e.stopPropagation()}>
        <small>SHADOW ASCENSION • PERFIL LAN</small>
        <h1>Escolha seu nick</h1>
        <p>Esse nome fica salvo neste dispositivo e no servidor local. Outros jogadores verão seu nick, HP, nível e rank da guilda acima do personagem.</p>
        <input
          autoFocus
          maxLength={24}
          value={name}
          onChange={e=>setName(e.target.value)}
          onKeyDown={e=>e.stopPropagation()}
          placeholder="Ex.: Aquino"
        />
        <button type="submit" disabled={name.trim().length<2}>ENTRAR EM ASTERRA</button>
        <em>Você poderá alterar o nick depois em Opções.</em>
      </form>
    </div>
  )
}

function Grimoire({ hud, onAwaken, onSwitch, onUpgradeRank }) {
  const activeId = hud.classState?.activeClassId || 'mercenary_swordsman'
  const unlockedIds = hud.classState?.unlockedClassIds || ['mercenary_swordsman']
  const awakeningCount = hud.classState?.awakeningCount || 0
  const activeCls = CLASSES_LIST.find(c => c.id === activeId) || CLASSES_LIST[0]
  const grimoireQty = hud.inventory?.find(i => i.subtype === 'grimoire')?.qty || 0
  const [spinning, setSpinning] = useState(false)
  const [lastRoll, setLastRoll] = useState(null)

  const classRanks = hud.classState?.classRanks || {}
  const currentRank = classRanks[activeId] || 1
  const { current: rankInfo, next: nextRankInfo } = getClassRankInfo(currentRank)

  const hasEvolveLevel = nextRankInfo ? (hud.level >= nextRankInfo.minLevel) : false
  const hasEvolveGrimoires = nextRankInfo ? (grimoireQty >= nextRankInfo.costGrimoires) : false
  const hasEvolveGold = nextRankInfo ? ((hud.gold || 0) >= nextRankInfo.costGold) : false
  const canEvolve = nextRankInfo && hasEvolveLevel && hasEvolveGrimoires && hasEvolveGold

  const nextReqLevel = getNextGrimoireLevel(awakeningCount)
  const cost = calculateGrimoireCost(awakeningCount)
  const hasLevel = hud.level >= nextReqLevel
  const canAfford = grimoireQty > 0 || hud.gold >= cost
  const canRoll = hasLevel && canAfford && !spinning

  const handleAwaken = () => {
    if (!canRoll) return
    setSpinning(true)
    setTimeout(() => {
      const res = onAwaken()
      setLastRoll(res)
      setSpinning(false)
    }, 600)
  }

  return (
    <div className="grimoire-layout">
      <div className="gacha-stage">
        <div className="grimoire-book-visual">📖</div>
        <div className="active-class-banner">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'6px'}}>
            <small style={{ color: CLASS_TIERS[activeCls.tier].color }}>{CLASS_TIERS[activeCls.tier].icon} {CLASS_TIERS[activeCls.tier].name}</small>
            <span className="class-rank-badge" style={{background:'rgba(245,158,11,0.2)',border:'1px solid #f59e0b',color:'#fcd34d',padding:'2px 8px',borderRadius:'8px',fontSize:'10px',fontWeight:700}}>
              ⭐ {rankInfo?.name || `Grau ${currentRank}`}
            </span>
          </div>
          <h3>{activeCls.name}</h3>
          <p>{activeCls.lore}</p>
          <div style={{ marginTop: '6px', fontSize: '9px', color: '#d8e6f0' }}>
            <b>Passiva:</b> {activeCls.passive.name} — {activeCls.passive.desc}
          </div>
          <div style={{ marginTop: '4px', fontSize: '9px', color: '#ffd271' }}>
            <b>Habilidade Ativa:</b> {activeCls.skill.name} — {activeCls.skill.desc}
          </div>

          {/* Card de Evolução de Classe */}
          <div className="class-evolution-card" style={{marginTop:'10px',background:'rgba(15,23,42,0.85)',border:'1px solid rgba(245,158,11,0.4)',borderRadius:'10px',padding:'10px',textAlign:'left'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
              <span style={{fontWeight:700,fontSize:'11px',color:'#fbbf24'}}>⚡ EVOLUÇÃO DE GRAU DE CLASSE</span>
              <span style={{fontSize:'9px',color:'#cbd5e1'}}>Bônus Atual: +{Math.round((rankInfo?.atkBonus||0)*100)}% ATK</span>
            </div>
            {nextRankInfo ? (
              <>
                <div style={{fontSize:'10px',color:'#e2e8f0',marginBottom:'4px'}}>
                  Próximo Grau: <b style={{color:'#fcd34d'}}>{nextRankInfo.name}</b>
                </div>
                <div style={{fontSize:'9px',color:'#94a3b8',marginBottom:'8px',display:'flex',flexWrap:'wrap',gap:'8px'}}>
                  <span>⚔ +{Math.round(nextRankInfo.atkBonus*100)}% Dano Físico</span>
                  <span>🔮 +{Math.round(nextRankInfo.abilityBonus*100)}% Habilidades</span>
                  <span>🎯 +{nextRankInfo.critBonus}% Crítico</span>
                  <span>⚡ -{Math.round(nextRankInfo.staminaDiscount*100)}% Stamina</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:'6px',fontSize:'9px',marginBottom:'8px'}}>
                  <span style={{color:hasEvolveLevel?'#4ade80':'#f87171'}}>Nível {nextRankInfo.minLevel} {hasEvolveLevel?'✓':'(Falta Nível)'}</span>
                  <span style={{color:hasEvolveGold?'#fcd34d':'#f87171'}}>{nextRankInfo.costGold}◈ Ouro {hasEvolveGold?'✓':'(Insuficiente)'}</span>
                  <span style={{color:hasEvolveGrimoires?'#c084fc':'#f87171'}}>{nextRankInfo.costGrimoires} Grimório(s) {hasEvolveGrimoires?'✓':'(Falta)'}</span>
                </div>
                <button
                  type="button"
                  className="evolve-class-btn"
                  disabled={!canEvolve}
                  onClick={()=>onUpgradeRank?.(activeId)}
                  style={{width:'100%',padding:'7px 10px',borderRadius:'8px',background:canEvolve?'linear-gradient(135deg, #f59e0b, #d97706)':'rgba(255,255,255,0.06)',color:canEvolve?'#000':'#64748b',fontWeight:700,fontSize:'11px',border:'none',cursor:canEvolve?'pointer':'not-allowed',boxShadow:canEvolve?'0 0 12px rgba(245,158,11,0.4)':'none'}}
                >
                  {canEvolve ? `⚡ Evoluir ${activeCls.name} para ${nextRankInfo.name}` : !hasEvolveLevel ? `Requer Nível ${nextRankInfo.minLevel} (Atual: ${hud.level})` : !hasEvolveGrimoires ? `Requer ${nextRankInfo.costGrimoires} Grimório(s)` : `Requer ${nextRankInfo.costGold}◈ Ouro`}
                </button>
              </>
            ) : (
              <div style={{fontSize:'10px',color:'#4ade80',padding:'4px 0'}}>
                🏆 Esta classe atingiu o Grau Máximo Ancestral ({rankInfo?.name})! Todos os bônus estão no ápice.
              </div>
            )}
          </div>
        </div>

        {lastRoll && (
          <div style={{ margin: '6px 0', padding: '6px 12px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', fontSize: '10px' }}>
            ✨ Sorteio: <b>{lastRoll.roll}%</b> ➔ <b style={{ color: lastRoll.tierInfo.color }}>{lastRoll.cls.name}</b>
          </div>
        )}

        <div className="grimoire-requirements-badge glass" style={{padding:'8px 12px',borderRadius:'10px',fontSize:'10px',width:'100%',border:hasLevel?'1px solid rgba(74,222,128,0.3)':'1px solid rgba(239,68,68,0.35)'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
            <span>Próximo Despertar: <b style={{color:hasLevel?'#4ade80':'#f87171'}}>Nível {nextReqLevel}</b></span>
            <span>Seu Nível: <b>{hud.level}</b></span>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',color:'#cbd5e1',fontSize:'9px'}}>
            <span>Despertares: <b>{awakeningCount}</b></span>
            <span>Custo: <b style={{color:'#fcd34d'}}>{cost}◈ ou 1 Grimório</b></span>
          </div>
        </div>

        <button className="gacha-roll-btn" disabled={!canRoll} onClick={handleAwaken}>
          {spinning ? 'Convocando Alma Ancestral...' : !hasLevel ? `Requer Nível ${nextReqLevel} (Atual: ${hud.level})` : grimoireQty > 0 ? `Despertar Alma • 1 Grimório (${grimoireQty})` : `Comprar Grimório e Despertar • ${cost}◈`}
        </button>

        <div className="gacha-rates-table">
          <span><b>Comum</b>55.0%</span>
          <span><b>Incomum</b>28.0%</span>
          <span><b>Raro</b>12.5%</span>
          <span><b>Épico</b>4.0%</span>
          <span><b style={{ color: '#f59e0b' }}>Lendário</b>0.5%</span>
        </div>
      </div>

      <div className="classes-collection">
        <h3 style={{ margin: '0 0 6px', fontSize: '13px' }}>Coleção de Almas ({unlockedIds.length}/{CLASSES_LIST.length})</h3>
        {CLASSES_LIST.map(cls => {
          const unlocked = unlockedIds.includes(cls.id)
          const isActive = cls.id === activeId
          const tier = CLASS_TIERS[cls.tier]
          const clsRank = classRanks[cls.id] || 1
          return (
            <div key={cls.id} className={`class-card-item ${isActive ? 'active' : ''} ${!unlocked ? 'locked' : ''}`}>
              <div>
                <b>{tier.icon} {cls.name} {unlocked && <span style={{fontSize:'9px',color:'#fbbf24',marginLeft:'4px'}}>G.{clsRank}</span>}</b>
                <small style={{ color: tier.color }}>{tier.name} • {cls.skill.name}</small>
              </div>
              {unlocked ? (
                <button disabled={isActive} onClick={() => onSwitch(cls.id)}>
                  {isActive ? 'Ativa' : 'Equipar'}
                </button>
              ) : (
                <small style={{ color: '#64748b' }}>Bloqueada</small>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FastTravel({ hud, onTravel, onBuyVip }) {
  const travelState = hud.travelState || { nodes: {} }
  const currentPos = hud.playerPosition || { x: 0, z: 0 }
  const vipCost = Math.max(5000, travelState.vipCost || 5000)
  const nodes=[...TRAVEL_NODES].sort((a,b)=>a.minLevel-b.minLevel)

  return (
    <div className="travel-layout">
      <div className="travel-nodes-grid travel-scroll-list">
        {nodes.map(node => {
          const nodeData = travelState.nodes?.[node.id] || { unlocked: false, vipPass: false }
          const isCurrent = hud.zoneId === node.zone
          const levelBlocked = (hud.level||1) < node.minLevel
          const cost = calculateTravelCost(currentPos, node, nodeData.vipPass)
          return (
            <div key={node.id} className={`travel-card ${isCurrent ? 'current' : ''} ${levelBlocked ? 'locked' : ''}`}>
              <div className="travel-card-header">
                <b>🚐 {node.name}</b>
                <span style={{ color: node.color }}>Nv.{node.minLevel}+</span>
              </div>
              <small style={{ color: '#a0aec0' }}>{node.title}</small>
              <p>{node.desc}</p>
              <div className="travel-card-footer">
                <span>{nodeData.vipPass ? '✨ VIP • grátis' : `💰 ${cost}◈`}</span>
                <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
                  {nodeData.unlocked && !nodeData.vipPass && (
                    <button
                      type="button"
                      className="travel-card-vip-btn"
                      disabled={hud.gold < vipCost}
                      onClick={() => onBuyVip(node.id)}
                      title={`Comprar Passe VIP permanente (${vipCost}◈)`}
                      style={{background:'rgba(245,158,11,0.2)',border:'1px solid #f59e0b',color:'#fcd34d',fontSize:'9px',padding:'4px 8px',borderRadius:'6px',cursor:hud.gold<vipCost?'not-allowed':'pointer'}}
                    >
                      💎 VIP ({vipCost}◈)
                    </button>
                  )}
                  <button disabled={isCurrent || levelBlocked || (!nodeData.vipPass && hud.gold < cost)} onClick={() => onTravel(node.id)}>
                    {isCurrent ? 'Você está aqui' : levelBlocked ? `Requer Nv.${node.minLevel}` : nodeData.vipPass ? 'Viajar grátis' : `Viajar • ${cost}◈`}
                  </button>
                </div>
              </div>
              <em className="travel-discovery">{nodeData.unlocked?'✓ rota conhecida':'○ rota ainda não visitada'}</em>
            </div>
          )
        })}
      </div>

      <div className="travel-sidebar">
        <h3>Moço Viajante</h3>
        <p>Há um <b>Moço Viajante em todas as cidades</b>. Ele mostra todas as rotas, o nível recomendado e o valor antes de confirmar a viagem.</p>
        <div className="travel-rule"><b>Como funciona</b><span>Você pode viajar para qualquer cidade cujo nível mínimo já tenha alcançado. O preço considera distância e risco.</span></div>
        <div className="vip-box">
          <b>Passe VIP de rota</b>
          <p>Transforma uma rota conhecida em viagem gratuita permanente por <b>{vipCost}◈</b>.</p>
          <button onClick={() => {
            const unlockedNode = nodes.find(n => travelState.nodes?.[n.id]?.unlocked && !travelState.nodes?.[n.id]?.vipPass)
            if (unlockedNode) onBuyVip(unlockedNode.id)
          }} disabled={hud.gold < vipCost}>Comprar VIP ({vipCost}◈)</button>
        </div>
        <div className="travel-warning">⚠️ Existe 5% de chance de emboscada durante a viagem.</div>
      </div>
    </div>
  )
}
