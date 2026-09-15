import React, { useEffect, useRef, useState } from 'react'
import { ShadowGame } from './game/engine.js'
import { EQUIPMENT_SLOTS, GUILD_RANKS, ATTRIBUTE_DEFS, HORSE_BREEDS } from './game/config.js'
import { CLASSES_LIST, CLASS_TIERS, CLASS_RANKS, getClassRankInfo } from './game/classesData.js'
import { TRAVEL_NODES, calculateTravelCost } from './game/fastTravel.js'
import { calculateGrimoireCost, getNextGrimoireLevel } from './game/rpgSystems.js'
import { getSupabaseConfig, saveSupabaseConfig, getSavedAccountSession, registerAccount, loginAccount, restoreAccountSession } from './game/supabaseService.js'
import { promptInstallApp, toggleFullScreen, subscribePWA, getPWAState } from './game/pwaService.js'
import MiniMap from './ui/Minimap.jsx'
import WorldMap from './ui/WorldMap.jsx'

const initial={playerName:'',needsNickname:true,level:1,xp:0,nextXp:120,hp:120,maxHp:120,stamina:100,maxStamina:100,gold:220,atk:16,def:5,critChance:0,zone:'Vila Aurora',zoneId:'aurora',currentCity:'Cidadela Aurora',inventory:[],equipment:{},quests:[],guildMissions:[],guildRank:'E',guildRankIndex:0,guildPoints:0,attributePoints:0,attributes:{strength:0,vitality:0,agility:0,intellect:0},weather:'Céu limpo',time:'08:15',mount:{},abilities:[],combatMode:false,inCombat:false,combatTimer:0,multiplayer:{connected:false,url:'',room:'asterra-global',players:0,latencyMs:0,quality:'offline',reconnecting:false},settings:{renderDistance:2,pixelRatio:1,uiScale:1.2,invertCameraX:false,invertCameraY:false,invertCamera:false,multiplayerUrl:''},playerPosition:{x:0,z:0},stats:{kills:0,bosses:0,dungeons:0},ores:0,party:{id:null,leaderId:null,members:[],totalXP:0},onlinePlayers:[],economy:{label:'Mercado dos Despertos',description:'Itens iniciais',theme:'Aurora'}}
const slotNames={weapon:'Arma',armor:'Armadura',boots:'Botas',talisman:'Talismã'}
const roleTitle={inventory:'Inventário & Equipamento',grimoire:'Grimório do Despertar (Roleta de Almas)',travel:'Moço Viajante (Rotas de Caravana)',quests:'Missões',guild:'Guilda de Aventureiros',townhall:'Prefeitura de Aurora (Juramento do Cavaleiro)',attributes:'Atributos',merchant:'Mercador',blacksmith:'Ferreiro Rúnico',stable:'Estábulos & Domação de Montarias',map:'Mapa de Asterra',settings:'Configurações',trade:'Troca entre Jogadores'}
const fallbackAbilities=[{slot:1,name:'Corte Astral',short:'Corte',icon:'✦',cost:14,remaining:0,ready:true},{slot:2,name:'Onda Astral',short:'Onda',icon:'✹',cost:28,remaining:0,ready:true},{slot:3,name:'Passo Etéreo',short:'Passo',icon:'➠',cost:22,remaining:0,ready:true}]
const multiplayerLobbies=[{id:'asterra-global',name:'Asterra Global'}]
const getRankHex=r=>{const rank=String(r||'E');if(rank.startsWith('ZZZ'))return'#ff4fd8';if(rank.startsWith('ZZ'))return'#c84fff';if(rank.startsWith('Z'))return'#9d62ff';if(rank.startsWith('EX'))return'#ff6b77';if(rank.startsWith('SSS'))return'#ffa233';if(rank.startsWith('SS'))return'#ffcf45';if(rank.startsWith('S'))return'#f5df71';if(rank==='A')return'#d18cff';if(rank==='B')return'#68b9ff';if(rank==='C')return'#72d89c';if(rank==='D')return'#a7bdcc';return'#94a3b8'}

function getViewportState(){
  if(typeof window==='undefined')return{w:1366,h:768,isCoarse:false,isMobile:false,isTablet:false,isDesktop:true,isTouch:false,isLandscape:true}
  const w=window.innerWidth||1366,h=window.innerHeight||768
  const ua=navigator.userAgent||''
  const short=Math.min(w,h),long=Math.max(w,h)
  const maxTouch=Number(navigator.maxTouchPoints||0)
  const primaryCoarse=!!window.matchMedia?.('(pointer: coarse)').matches
  const anyCoarse=!!window.matchMedia?.('(any-pointer: coarse)').matches
  const hasTouchEvent='ontouchstart' in window
  const touchCapable=maxTouch>0||primaryCoarse||anyCoarse||hasTouchEvent
  const isMobileUA=/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Macintosh.*Mobile/i.test(ua)
  const isIPadDesktopUA=/Macintosh/i.test(ua)&&maxTouch>1
  const hasFinePointer=!!window.matchMedia?.('(pointer: fine)').matches

  // Classification uses the SHORT side, not just width. That keeps an A55 landscape
  // as phone while iPad Pro / 1200x2000 Android tablets always receive touch controls.
  // A Windows desktop with an optional touchscreen stays desktop when it has a fine pointer.
  const isPhone=touchCapable&&(short<=600||(isMobileUA&&short<=620&&long<=1100))
  const tabletSized=short<=1200&&long<=2300
  const isTablet=!isPhone&&touchCapable&&tabletSized&&(isMobileUA||isIPadDesktopUA||primaryCoarse||(!hasFinePointer&&anyCoarse))
  const isDesktop=!isPhone&&!isTablet
  const isMobile=isPhone
  const isTouch=touchCapable&&(isPhone||isTablet)

  return {w,h,isCoarse:primaryCoarse||!hasFinePointer,isMobile,isTablet,isDesktop,isTouch,isLandscape:w>=h}
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
  const [pwaState,setPwaState]=useState(getPWAState)

  useEffect(()=>subscribePWA(setPwaState),[])
  useEffect(()=>{game.current=new ShadowGame(canvas.current,setHud);return()=>game.current?.destroy?.()},[])
  useEffect(()=>{
    let active=true
    restoreAccountSession().then(result=>{
      if(active&&result.ok) game.current?.setPlayerAccount(result.session,result.profile)
    })
    return()=>{active=false}
  },[])
  useEffect(()=>{
    const sync=()=>setViewport(getViewportState())
    sync()
    window.addEventListener('resize',sync)
    window.addEventListener('orientationchange',sync)
    window.visualViewport?.addEventListener('resize',sync)
    return()=>{window.removeEventListener('resize',sync);window.removeEventListener('orientationchange',sync);window.visualViewport?.removeEventListener('resize',sync)}
  },[])
  useEffect(()=>{game.current?.setTouchDeviceMode?.(!!viewport.isTouch)},[viewport.isTouch])
  useEffect(()=>{
    if(!hud?.gateAnnouncement)return
    const timer=setTimeout(()=>{
      game.current?.dismissGateAnnouncement?.()
    },3000)
    return()=>clearTimeout(timer)
  },[hud?.gateAnnouncement])

  const pct=(a,b)=>Math.max(0,Math.min(100,b?100*a/b:0))
  const hp=pct(hud.hp,hud.maxHp),st=pct(hud.stamina,hud.maxStamina),xp=pct(hud.xp,hud.nextXp)
  const potionQty=hud.inventory?.find(i=>i.subtype==='potion')?.qty||0
  const grimoireQty=hud.inventory?.find(i=>i.subtype==='grimoire')?.qty||0
  // V4.1: defensive class data. Never let a missing class definition blank the whole UI.
  const uiActiveClassId = hud.classState?.activeClassId || 'mercenary_swordsman'
  const uiActiveClass = CLASSES_LIST?.find?.(c=>c?.id===uiActiveClassId) || CLASSES_LIST?.[0] || {name:'Espadachim Mercenário',tier:'COMMON'}
  const uiActiveTier = CLASS_TIERS?.[uiActiveClass?.tier] || CLASS_TIERS?.COMMON || {color:'#94a3b8',icon:'⚔'}
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
  const touchClass=viewport.isTouch?'touch-ui':'mouse-ui'
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
        <div><b>SHADOW ASCENSION</b><small>WEB 3D • V0.9.11 ONLINE • ☀ {hud.time}</small></div>
        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
          <button className="class-chip" onClick={()=>call('togglePanel','grimoire')} style={{'--tier-color':uiActiveTier.color}} title="Clique para abrir o Grimório do Despertar">{uiActiveTier.icon} {uiActiveClass.name}</button>
          <span className="level-chip">NV. {hud.level}</span>
        </div>
      </div>
      <div className="identity-line"><strong>{hud.playerName||'Aventureiro'}</strong><span>RANK {hud.guildRank||'E'}</span></div><div className="zone-line"><strong>{hud.currentCity||hud.zone}</strong><span>⚔ {hud.atk} &nbsp; 🛡 {hud.def}</span></div>
      <div className="position-line">COORD. {Math.round(hud.playerPosition?.x||0)}, {Math.round(hud.playerPosition?.z||0)}</div>
      <Bar label={`HP ${Math.floor(hud.hp)}/${hud.maxHp}${hud.inCombat ? ` [⚔ Em Combate ${hud.combatTimer||8}s]` : (hud.hp < hud.maxHp && hud.stamina >= hud.maxStamina - 0.5) ? ' [💚 Regen]' : ''}`} value={hp} cls="hp"/><Bar label={`Vigor ${Math.floor(hud.stamina)}/${hud.maxStamina}`} value={st} cls="stamina"/><Bar label={`XP ${Math.floor(hud.xp)}/${hud.nextXp}`} value={xp} cls="xp"/>
      <div className="currency-row"><span>◈ {hud.gold} ouro</span><span>◆ {hud.ores||0} minério</span><span>📖 {grimoireQty} grimório{grimoireQty!==1?'s':''}</span></div>
    </section>

    <div className="world-status glass">
      <span>☀ {hud.time}</span>
      <span>{weatherIcon(hud.weather)} {hud.weather}</span>
      {hud.inCombat ? (
        <b className="combat-status" style={{color:'#f87171',background:'rgba(239,68,68,0.18)',border:'1px solid rgba(239,68,68,0.45)',padding:'2px 8px',borderRadius:'999px',fontSize:'10px',letterSpacing:'.04em'}}>
          ⚔ COMBATE ({hud.combatTimer||8}s)
        </b>
      ) : (hud.hp < hud.maxHp && hud.stamina >= hud.maxStamina - 0.5) ? (
        <b className="combat-status" style={{color:'#4ade80',background:'rgba(74,222,128,0.18)',border:'1px solid rgba(74,222,128,0.45)',padding:'2px 8px',borderRadius:'999px',fontSize:'10px',letterSpacing:'.04em'}}>
          💚 REGEN
        </b>
      ) : null}
      {hud.multiplayer?.connected&&<b className="online-status">● ONLINE {hud.multiplayer.totalOnline || (hud.multiplayer.players ? hud.multiplayer.players + 1 : 1)} {hud.multiplayer.transport==='supabase'?'(SUPABASE)':hud.multiplayer.transport==='http'?'(VERCEL)':'(LAN)'}</b>}
      {hud.mount?.active&&<b>♞ Montado</b>}
      <button type="button" className="hud-mini-btn" onClick={toggleFullScreen} title="Alternar Modo Tela Cheia">⛶ Tela Cheia</button>
      {!pwaState.isInstalled && (
        <button type="button" className="hud-mini-btn" onClick={promptInstallApp} title="Instalar Aplicativo no Windows / Mobile">📲 Instalar App</button>
      )}
    </div>
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
    <ActiveQuestTrackerHUD hud={hud} onOpenQuests={()=>call('togglePanel','quests')} onClaim={id=>call('claimQuest',id)}/>
    
    {hud.destinationMarker && (
      <WaypointArrow
        marker={hud.destinationMarker}
        playerPos={hud.playerPosition}
        cameraYaw={hud.cameraYaw || 0}
        onClear={() => call('clearDestinationMarker')}
      />
    )}
    {hud.gateAnnouncement && (
      <div className="gate-announcement-banner glass" style={{position:'absolute',top:'82px',left:'50%',transform:'translateX(-50%)',padding:'12px 28px',borderRadius:'16px',border:`2px solid ${hud.gateAnnouncement.rankColor || '#38bdf8'}`,boxShadow:`0 0 28px ${hud.gateAnnouncement.rankColor || '#38bdf8'}40, 0 10px 30px rgba(0,0,0,0.6)`,zIndex:20,display:'flex',flexDirection:'column',alignItems:'center',gap:'4px',animation:'toastin .3s ease-out'}}>
        <button type="button" onClick={() => call('dismissGateAnnouncement')} style={{position:'absolute',top:'8px',right:'10px',background:'none',border:'none',color:'#94a3b8',fontSize:'14px',cursor:'pointer',padding:'2px 6px',lineHeight:1}} title="Fechar aviso">✕</button>
        <b style={{color:'#facc15',fontSize:'12px',letterSpacing:'.1em'}}>{hud.gateAnnouncement.title}</b>
        <strong style={{fontSize:'16px',color:'#f8fafc'}}>{hud.gateAnnouncement.gateName}</strong>
        <span style={{fontSize:'11px',color:'#cbd5e1'}}>Rank <b style={{color:hud.gateAnnouncement.rankColor}}>{hud.gateAnnouncement.rank}</b> • Nv. {hud.gateAnnouncement.levelRange} • {hud.gateAnnouncement.rounds || hud.gateAnnouncement.floors || 4} Rounds • {hud.gateAnnouncement.zoneName}</span>
        <button type="button" onClick={() => {
          call('setDestinationMarker', { x: hud.gateAnnouncement.x, z: hud.gateAnnouncement.z, rank: hud.gateAnnouncement.rank, name: hud.gateAnnouncement.gateName, color: hud.gateAnnouncement.rankColor, rankConfig: { color: hud.gateAnnouncement.rankColor } })
          call('dismissGateAnnouncement')
        }} style={{marginTop:'6px',padding:'6px 14px',fontSize:'11px',fontWeight:'bold',background:'rgba(56,189,248,0.25)',border:'1px solid #38bdf8',color:'#38bdf8',borderRadius:'8px',cursor:'pointer'}}>🎯 MARCAR DESTINO</button>
      </div>
    )}
    {hud.portal&&!hud.dungeon&&<div className="portal-card glass" style={{'--portal':hud.portal.rarity.color}}><small>FENDA DETECTADA</small><strong>{hud.portal.name}</strong><span>Nv. {hud.portal.level} • <b style={{color:hud.portal.rarity.color}}>{hud.portal.rarity.name}</b> • {hud.portal.rounds || hud.portal.floors || 4} rounds</span><em>E para entrar</em></div>}
    {hud.dungeon && (
      <div className="dungeon-card glass" style={{'--portal':hud.dungeon.color || '#b06cff'}}>
        <small>MASMORRA ATIVA</small>
        <strong>{hud.dungeon.name}</strong>
        <span>Rank <b style={{color:hud.dungeon.color}}>{hud.dungeon.rank || 'E'}</b> • Nv.{hud.dungeon.level}</span>
        <div style={{color:'#f8fafc',fontSize:'13px',fontWeight:'900',letterSpacing:'.08em',marginTop:'3px'}}>
          ROUND {hud.dungeon.round || 1}/{hud.dungeon.totalRounds || 4}
        </div>
        <div style={{fontSize:'11px',color:'#cbd5e1',marginTop:'1px'}}>
          Inimigos restantes: <b style={{color:'#ef4444'}}>{hud.dungeon.enemiesAlive ?? 0}</b>
        </div>
        {hud.dungeon.roundState === 'BREAK' && (
          <div style={{fontSize:'11px',color:'#38bdf8',fontWeight:'bold',marginTop:'2px',animation:'pulse 1s infinite'}}>
            Próximo round em {Math.max(1, Math.ceil(hud.dungeon.breakTimer || 4))}s...
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Abandonar Masmorra?\nTodo o progresso não finalizado desta masmorra será perdido.')) {
              call('abandonDungeon')
            }
          }}
          style={{marginTop:'8px',padding:'4px 10px',fontSize:'10px',background:'rgba(239,68,68,0.2)',border:'1px solid #ef4444',color:'#fca5a5',borderRadius:'6px',cursor:'pointer',fontWeight:'bold'}}
        >
          Abandonar Masmorra
        </button>
      </div>
    )}
    {hud.caravanModal && <CaravanModal modal={hud.caravanModal} onClose={() => call('closeCaravanModal')} />}
    {hud.levelUpCelebration && (
      <div className="level-up-modal" style={{position:'absolute',top:'35%',left:'50%',transform:'translate(-50%,-50%)',zIndex:30,textAlign:'center',pointerEvents:'none',animation:'toastin .4s cubic-bezier(0.16, 1, 0.3, 1)'}}>
        <div style={{fontSize:'36px',fontWeight:'900',letterSpacing:'.18em',color:'#facc15',textShadow:'0 0 35px #eab308, 0 4px 15px rgba(0,0,0,0.8)'}}>★ LEVEL UP! ★</div>
        <div style={{fontSize:'22px',fontWeight:'800',color:'#ffffff',marginTop:'4px',textShadow:'0 2px 10px #000'}}>NÍVEL {hud.levelUpCelebration.level}</div>
        <div style={{fontSize:'12px',color:'#93c5fd',marginTop:'6px',background:'rgba(15,23,42,0.8)',padding:'4px 16px',borderRadius:'999px',border:'1px solid rgba(147,197,253,0.3)',display:'inline-block'}}>+1 Ponto de Atributo • HP & Atributos Aumentados</div>
      </div>
    )}
    {hud.interactionPrompt&&!panel&&<div className="interaction">{hud.interactionPrompt}</div>}{hud.toast&&<div key={hud.toast.id} className="toast">{hud.toast.msg}</div>}

    {viewport.isDesktop&&!panel&&hud.combatMode&&<div className={`combat-crosshair ${hud.crosshairTarget?'locked':''}`} aria-label="Mira"><i/><i/><b/></div>}
    {viewport.isDesktop&&!panel&&<button className={`combat-mode-chip glass ${hud.combatMode?'active':''}`} onClick={()=>call('toggleCombatMode')}><kbd>Q</kbd><span>{hud.combatMode?'MODO COMBATE':'CURSOR LIVRE'}</span><small>{hud.combatMode?'Q libera o mouse':'Q trava a mira'}</small></button>}

    {viewport.isDesktop&&<div className="quickbar glass">
      <QuickButton hotkey="R" icon="🧪" label="Poção" badge={potionQty} onClick={()=>call('usePotion')} disabled={!potionQty}/>
      {abilities.map(a=><QuickButton key={a.slot} hotkey={String(a.slot)} icon={a.icon} label={a.name} badge={a.remaining>0?`${a.remaining.toFixed(1)}s`:''} cooldown={a.remaining} maxCooldown={a.cooldown} disabled={!a.ready} onClick={()=>call('castAbility',a.slot)} title={`${a.name} • ${a.cost} vigor • CD ${a.cooldown}s`}/>) }
      <QuickButton hotkey="Space" icon="↥" label="Pular" onClick={()=>call('jump')}/><QuickButton hotkey="Shift" icon="↯" label="Esquiva" onClick={()=>call('dash')}/><QuickButton hotkey="E" icon="☞" label="Interagir" onClick={()=>call('interact')}/><QuickButton hotkey="H" icon="♞" label="Montaria" onClick={()=>call('toggleMount')}/>
    </div>}

    {viewport.isDesktop&&<><button className="help-button" onClick={()=>setHelp(v=>!v)}>?</button>
    {help&&<div className="help glass"><b>CONTROLES</b><span>WASD — mover • Espaço — pular • Ctrl — correr</span><span>Fora do combate: segure o botão direito para girar a câmera</span><span><b>Q</b> — alterna Modo Combate / Cursor Livre</span><span>No combate: mouse move a câmera • mira centralizada</span><span>Mira + clique esquerdo — atacar/coletar</span><span>1 / 2 / 3 ou clique — poderes</span><span>Direito — bloquear • Shift — esquiva</span><span>E — interagir • R — poção • H — montaria</span><span>I/G/T/J/U/K/P/M/O — inventário, grimório, viajante, missões, guilda, atributos, troca, mapa, opções</span></div>}</>}

    <MobileControls hud={hud} abilities={abilities} call={call} touch={viewport.isTouch}/>

    {panel&&<Overlay panelKey={panel} title={roleTitle[panel]||'Interação'} dialogue={hud.dialogue} mapMode={panel==='map'} onClose={()=>call('closePanel')}>
      {panel==='inventory'&&<InventoryErrorBoundary><Inventory hud={hud} equip={id=>call('equipItem',id)} unequip={s=>call('unequip',s)} call={call}/></InventoryErrorBoundary>} 
      {panel==='grimoire'&&<Grimoire hud={hud} onAwaken={()=>call('awakenClass')} onSwitch={id=>call('switchClass',id)} onUpgradeRank={id=>call('upgradeClassRank',id)} onAcceptQuest={id=>call('acceptQuest',id)} onClaimQuest={id=>call('claimQuest',id)}/>} 
      {panel==='travel'&&<FastTravel hud={hud} onTravel={id=>call('fastTravelTo',id)} onBuyVip={id=>call('buyVipPass',id)}/>} 
      {panel==='quests'&&<Quests hud={hud} accept={id=>call('acceptQuest',id)} claim={id=>call('claimQuest',id)}/>} 
      {panel==='guild'&&<Guild hud={hud} accept={id=>call('acceptGuildMission',id)} claim={id=>call('claimGuildMission',id)} createParty={()=>call('createParty')} joinParty={id=>call('joinParty',id)} leaveParty={()=>call('leaveParty')}/>} 
      {panel==='townhall'&&<TownHall hud={hud} accept={id=>call('acceptQuest',id)} claim={id=>call('claimQuest',id)} onOpenStable={()=>call('togglePanel','stable')}/>} 
      {panel==='attributes'&&<Attributes hud={hud} allocate={dist=>call('allocateAttributes',dist)}/>} 
      {panel==='merchant'&&<Merchant hud={hud} buy={id=>call('buyItem',id)} sell={id=>call('sellItem',id)} sellMultiple={ids=>call('sellMultipleItems',ids)}/>} 
      {panel==='blacksmith'&&<Blacksmith hud={hud} upgrade={s=>call('upgrade',s)} repair={s=>call('repairItem',s)} buy={id=>call('buyItem',id)}/>} 
      {panel==='stable'&&<Stable hud={hud} horseBreeds={hud.horseBreeds||HORSE_BREEDS} onTame={id=>call('tameHorse',id)} onSelect={id=>call('selectHorse',id)} toggle={()=>call('toggleMount')} onOpenTownHall={()=>call('togglePanel','townhall')}/>} 
      {panel==='trade'&&<TradeModal hud={hud} call={call} onClose={()=>call('closePanel')}/>}
      {panel==='map'&&<WorldMap hud={hud}/>} 
      {panel==='settings'&&<Settings hud={hud} apply={v=>call('applySettings',v)} connect={url=>call('connectMultiplayer',url)} setName={name=>call('setPlayerName',name)} call={call}/>} 
    </Overlay>}
    {hud.needsNickname&&<AuthGate initialServer={hud.multiplayer?.room||'asterra-global'} onLogin={(session,profile)=>call('setPlayerAccount',session,profile)}/>}
    
    {hud.dungeonModal && <GateModal modal={hud.dungeonModal} call={call} onClose={() => call('closeGateModal')} />}
    {hud.dungeonCompletion && <DungeonCompletionModal completion={hud.dungeonCompletion} onClose={() => call('closeDungeonCompletion')} />}
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


class InventoryErrorBoundary extends React.Component {
  constructor(props){super(props);this.state={error:null}}
  static getDerivedStateFromError(error){return{error}}
  componentDidCatch(error,info){console.error('[Shadow Ascension] Inventory UI crash captured by V4.1',error,info)}
  render(){
    if(!this.state.error)return this.props.children
    return <div className="inventory-recovery-card">
      <h3>Inventário recuperado</h3>
      <p>Um dado inválido impediu esta janela de ser renderizada. O jogo continuou aberto.</p>
      <small>{String(this.state.error?.message||'Erro desconhecido')}</small>
      <button onClick={()=>this.setState({error:null})}>Tentar novamente</button>
    </div>
  }
}

function Inventory({hud,equip,unequip,call}){
  const gear=hud.equipment||{}
  const [mobileTab,setMobileTab]=useState('bag') // 'bag' | 'character'
  const [tab,setTab]=useState('all')
  const [rarity,setRarity]=useState('all')
  const [selectedBagItem,setSelectedBagItem]=useState(null)
  const [inspectSlot,setInspectSlot]=useState(null)
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

  // Find currently equipped item matching slot of selectedBagItem
  const matchingSlot = selectedBagItem ? (selectedBagItem.type === 'tool' ? 'weapon' : selectedBagItem.type) : null
  const currentlyEquipped = matchingSlot ? gear[matchingSlot] : null

  return (
    <div className={`inventory-rpg-container mobile-tab-${mobileTab}`}>
      {/* Mobile-only top sub-navigation */}
      <div className="mobile-inv-nav">
        <button
          type="button"
          className={`inv-subtab ${mobileTab==='bag'?'active':''}`}
          onClick={()=>setMobileTab('bag')}
        >
          🎒 Inventário ({items.length}/40)
        </button>
        <button
          type="button"
          className={`inv-subtab ${mobileTab==='character'?'active':''}`}
          onClick={()=>setMobileTab('character')}
        >
          👤 Personagem (Nv.{hud.level})
        </button>
      </div>

      <div className="inventory-rpg">
        {/* CHARACTER SECTION */}
        <section className={`character-hub ${mobileTab==='bag' ? 'hide-mobile' : ''}`}>
          <div className="hub-title"><span>PERSONAGEM</span><b>Nível {hud.level}</b></div>
          <div className="character-display-stage">
            <div className="hero-avatar-center">
              <div className="hero-avatar-aura" style={{ '--rank-color': getRankHex(hud.guildRank || 'E') }} />
              <div className="hero-avatar-silhouette">
                <span className="hero-avatar-emoji">{activeClass?.icon || '⚔️'}</span>
              </div>
              <div className="hero-name-badge">
                <strong>{hud.playerName || 'Aventureiro'}</strong>
                <small style={{ color: activeTier?.color || '#38bdf8' }}>{activeClass?.name || 'Mercenário'}</small>
                <span className="hero-rank-tag" style={{ color: getRankHex(hud.guildRank || 'E') }}>Rank {hud.guildRank || 'E'}</span>
              </div>
            </div>
            <div className="equip-slots-layout">
              <div className="equip-col left">
                <EquipNode cls="armor-node" slot="armor" item={gear.armor} unequip={unequip} onSelect={()=>setInspectSlot('armor')}/>
                <EquipNode cls="weapon-node" slot="weapon" item={gear.weapon} unequip={unequip} onSelect={()=>setInspectSlot('weapon')}/>
              </div>
              <div className="equip-col right">
                <EquipNode cls="talisman-node" slot="talisman" item={gear.talisman} unequip={unequip} onSelect={()=>setInspectSlot('talisman')}/>
                <EquipNode cls="boots-node" slot="boots" item={gear.boots} unequip={unequip} onSelect={()=>setInspectSlot('boots')}/>
              </div>
            </div>
          </div>
          <div className="combat-stats">
            <div><small>DAMAGE</small><b>{hud.atk}</b></div>
            <div><small>ARMOR</small><b>{hud.def}</b></div>
            <div><small>CRÍTICO</small><b>{(14+(hud.critChance||0)).toFixed(1)}%</b></div>
            <div><small>OURO</small><b>{hud.gold}</b></div>
          </div>

          {/* Inspected equipped slot modal/details */}
          {inspectSlot && gear[inspectSlot] && (
            <div className="inspect-gear-card glass" style={{ marginTop: '8px', padding: '10px', borderRadius: '10px', border: `1px solid ${gear[inspectSlot].color || '#94a3b8'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <b style={{ color: gear[inspectSlot].color, fontSize: '13px' }}>{gear[inspectSlot].name}</b>
                <button type="button" onClick={() => setInspectSlot(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>✕</button>
              </div>
              <small style={{ color: gear[inspectSlot].color, display: 'block', margin: '2px 0' }}>{gear[inspectSlot].rarity} • Nv.{gear[inspectSlot].level || 1}</small>
              <div style={{ fontSize: '11px', color: '#cbd5e1' }}>
                {gear[inspectSlot].stats?.attack ? `+${Math.round(gear[inspectSlot].stats.attack)} Dano ` : ''}
                {gear[inspectSlot].stats?.defense ? `+${Math.round(gear[inspectSlot].stats.defense)} Armadura ` : ''}
                {gear[inspectSlot].durability !== undefined ? `Durabilidade: ${Math.round(gear[inspectSlot].durability)}/${gear[inspectSlot].maxDurability}` : ''}
              </div>
              <button
                type="button"
                className="unequip-btn"
                onClick={() => { unequip(inspectSlot); setInspectSlot(null) }}
                style={{ marginTop: '8px', width: '100%', padding: '6px', background: 'rgba(239,68,68,0.2)', border: '1px solid #ef4444', color: '#fca5a5', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Desequipar
              </button>
            </div>
          )}

          {/* Item Comparison panel when selecting a bag item */}
          {selectedBagItem && ['weapon','armor','boots','talisman','tool'].includes(selectedBagItem.type) && (
            <div className="item-compare-panel glass" style={{ marginTop: '8px', padding: '10px', borderRadius: '10px', border: '1px solid rgba(250,204,21,0.35)', background: 'rgba(15,23,42,0.85)' }}>
              <div style={{ fontSize: '10px', color: '#facc15', fontWeight: 'bold', letterSpacing: '.06em', marginBottom: '6px' }}>
                COMPARAÇÃO DE EQUIPAMENTO
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '6px' }}>
                  <small style={{ color: '#94a3b8', display: 'block' }}>EQUIPADO</small>
                  {currentlyEquipped ? (
                    <>
                      <b style={{ color: currentlyEquipped.color || '#e2e8f0', fontSize: '11px' }}>{currentlyEquipped.name}</b>
                      <div style={{ color: '#cbd5e1', fontSize: '10px' }}>
                        {currentlyEquipped.stats?.attack ? `ATK: ${currentlyEquipped.stats.attack} ` : ''}
                        {currentlyEquipped.stats?.defense ? `DEF: ${currentlyEquipped.stats.defense}` : ''}
                      </div>
                    </>
                  ) : <span style={{ color: '#64748b' }}>Nenhum</span>}
                </div>
                <div style={{ background: 'rgba(0,0,0,0.3)', padding: '6px', borderRadius: '6px' }}>
                  <small style={{ color: '#94a3b8', display: 'block' }}>NOVO ITEM</small>
                  <b style={{ color: selectedBagItem.color || '#e2e8f0', fontSize: '11px' }}>{selectedBagItem.name}</b>
                  <div style={{ color: '#cbd5e1', fontSize: '10px' }}>
                    {selectedBagItem.stats?.attack ? `ATK: ${selectedBagItem.stats.attack} ` : ''}
                    {selectedBagItem.stats?.defense ? `DEF: ${selectedBagItem.stats.defense}` : ''}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { equip(selectedBagItem.id); setSelectedBagItem(null) }}
                style={{ marginTop: '8px', width: '100%', padding: '7px', background: '#38bdf8', color: '#0f172a', fontWeight: 'bold', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
              >
                EQUIPAR
              </button>
            </div>
          )}

          <p className="hub-note">🪓 Machado corta árvores. ⛏️ Picareta quebra minérios. Armas e armaduras perdem durabilidade com o uso e podem ser reparadas no ferreiro.</p>
        </section>

        {/* BACKPACK SECTION */}
        <section className={`bag-rpg ${mobileTab==='character' ? 'hide-mobile' : ''}`}>
          <div className="section-title">
            <div><small>INVENTÁRIO ORGANIZADO</small><h3>Mochila do Desperto</h3></div>
            <span>{items.length}/40 slots</span>
          </div>
          <div className="bag-category-tabs inventory-tabs native-tab-row category-tab-wrap">
            <button className={tab==='all'?'active':''} onPointerUp={tabPointer(setTab,'all')} onClick={()=>setTab('all')}>Todos ({items.length})</button>
            <button className={tab==='equipment'?'active':''} onPointerUp={tabPointer(setTab,'equipment')} onClick={()=>setTab('equipment')}>⚔ Equipamentos</button>
            <button className={tab==='tools'?'active':''} onPointerUp={tabPointer(setTab,'tools')} onClick={()=>setTab('tools')}>🪓 Ferramentas</button>
            <button className={tab==='consumables'?'active':''} onPointerUp={tabPointer(setTab,'consumables')} onClick={()=>setTab('consumables')}>🧪 Consumíveis</button>
            <button className={tab==='drops'?'active':''} onPointerUp={tabPointer(setTab,'drops')} onClick={()=>setTab('drops')}>🐟 Drops & Recursos</button>
          </div>
          <div className="rarity-filter-row">
            <span>Raridade:</span>
            {rarityOptions.map(r=><button key={r} className={rarity===r?'active':''} onPointerUp={tabPointer(setRarity,r)} onClick={()=>setRarity(r)}>{r==='all'?'Todas':r}</button>)}
          </div>
          <div className="bag-grid-scroll">
            <div className="bag-grid">
              {filteredItems.map(it=>(
                <ItemCard
                  key={it.id}
                  item={it}
                  compact
                  isSelected={selectedBagItem?.id === it.id}
                  onSelect={()=>setSelectedBagItem(it)}
                  actions={
                    ['weapon','armor','boots','talisman','tool'].includes(it.type) ? (
                      <button onClick={(e)=>{ e.stopPropagation(); equip(it.id); setSelectedBagItem(null) }}>Equipar</button>
                    ) : it.subtype==='potion' ? (
                      <button onClick={(e)=>{ e.stopPropagation(); call?.('usePotion') }}>Usar</button>
                    ) : null
                  }
                />
              ))}
              {filteredItems.length===0&&<p className="empty-tab-hint">Nenhum item nesta categoria/raridade.</p>}
              {Array.from({length:Math.max(0,12-filteredItems.length)}).map((_,i)=><div key={`empty-${i}`} className="empty-slot"/>)}
            </div>
          </div>
          <div className="bag-help">Toque em um item para ver detalhes e comparar com o equipamento atual.</div>
        </section>
      </div>
    </div>
  )
}

function EquipNode({slot,item,unequip,cls,onSelect}){
  const max=Number(item?.maxDurability)||0,cur=Number(item?.durability),pct=max?Math.max(0,Math.min(100,(Number.isFinite(cur)?cur:max)/max*100)):100
  return <button className={`equip-node ${cls} ${item?'filled':''} ${item?.broken?'broken':''}`} style={{'--rarity':item?.color||'#6d7884'}} onClick={()=>onSelect?onSelect():item&&unequip(slot)} title={item?'Clique para inspecionar':slotNames[slot]}>
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

function ItemCard({item,actions,compact=false,isSelected=false,onSelect}){
  const stats=item.stats||{}
  const orbIcon=item.icon||(item.type==='tool'?(item.subtype==='pickaxe'?'⛏️':'🪓'):item.type==='weapon'?(item.subtype==='bow'?'🏹':item.subtype==='dagger'?'🗡':item.subtype==='spellbook'?'📖':item.subtype==='axe'?'🪓':item.subtype==='pickaxe'?'⛏️':'⚔'):item.type==='armor'?'◈':item.type==='boots'?'⬒':item.type==='material'||item.type==='resource'?'🪵':item.subtype==='potion'?'🧪':'✦')
  const qty=Math.max(1,Number(item.qty)||1),max=Number(item.maxDurability)||0,cur=Number.isFinite(Number(item.durability))?Number(item.durability):max,durPct=max?Math.max(0,Math.min(100,cur/max*100)):100
  return <article onClick={onSelect} className={`item-card ${compact?'compact':''} ${isSelected?'is-selected':''} ${item.broken||durPct<=0?'broken':''}`} style={{'--rarity':item.color||'#cbd5e1', cursor: onSelect ? 'pointer' : 'default'}} title={`${item.name} • Nv.${item.level||1}`}>
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

function MobileControls({hud,abilities,call,touch}){
  const [stickCenter,setStickCenter]=useState(null)
  const [stickOffset,setStickOffset]=useState({x:0,y:0})
  const [menuOpen,setMenuOpen]=useState(false)

  const stickPointerRef=useRef(null)
  const cameraPointerRef=useRef(null)
  const lastCamPosRef=useRef({x:0,y:0})
  const stickCenterRef=useRef(null)

  const potionQty=hud.inventory?.find(i=>i.subtype==='potion')?.qty||0

  // Movement Joystick Touch handlers (Dynamic floating joystick on left half)
  const handleJoystickDown=(e)=>{
    if(stickPointerRef.current!==null) return
    const rect=e.currentTarget.getBoundingClientRect()
    const touchX=e.clientX-rect.left
    const touchY=e.clientY-rect.top
    const center={x:touchX,y:touchY}
    stickPointerRef.current=e.pointerId
    stickCenterRef.current=center
    setStickCenter(center)
    setStickOffset({x:0,y:0})
    try{ e.currentTarget.setPointerCapture?.(e.pointerId) }catch{}
  }

  const handleJoystickMove=(e)=>{
    if(stickPointerRef.current!==e.pointerId||!stickCenterRef.current) return
    const rect=e.currentTarget.getBoundingClientRect()
    const touchX=e.clientX-rect.left
    const touchY=e.clientY-rect.top
    const dx=touchX-stickCenterRef.current.x
    const dy=touchY-stickCenterRef.current.y
    const maxRadius=60
    const len=Math.hypot(dx,dy)||0.001
    const clampedDist=Math.min(len,maxRadius)
    const deadzone=8
    const offsetX=(dx/len)*clampedDist
    const offsetY=(dy/len)*clampedDist
    setStickOffset({x:offsetX,y:offsetY})

    if(len<deadzone){
      call('setVirtualMove',0,0)
    }else{
      const effectiveDist=(clampedDist-deadzone)/(maxRadius-deadzone)
      const moveX=(dx/len)*effectiveDist
      const moveZ=-(dy/len)*effectiveDist
      call('setVirtualMove',moveX,moveZ)
    }
  }

  const handleJoystickUp=(e)=>{
    if(stickPointerRef.current===e.pointerId){
      stickPointerRef.current=null
      stickCenterRef.current=null
      setStickCenter(null)
      setStickOffset({x:0,y:0})
      call('setVirtualMove',0,0)
    }
  }

  // Camera Touch Drag Zone (Right side touch drag Roblox-style)
  const handleCamDown=(e)=>{
    if(cameraPointerRef.current!==null) return
    cameraPointerRef.current=e.pointerId
    lastCamPosRef.current={x:e.clientX,y:e.clientY}
    try{ e.currentTarget.setPointerCapture?.(e.pointerId) }catch{}
  }

  const handleCamMove=(e)=>{
    if(cameraPointerRef.current!==e.pointerId) return
    const dx=e.clientX-lastCamPosRef.current.x
    const dy=e.clientY-lastCamPosRef.current.y
    lastCamPosRef.current={x:e.clientX,y:e.clientY}
    if(Math.abs(dx)>0.1||Math.abs(dy)>0.1){
      call('rotateCamera',dx,dy)
    }
  }

  const handleCamUp=(e)=>{
    if(cameraPointerRef.current===e.pointerId){
      cameraPointerRef.current=null
    }
  }

  const closeAnd=(panel)=>{setMenuOpen(false);call('togglePanel',panel)}
  const supportsPointerEvents=typeof window!=='undefined'&&'PointerEvent' in window
  const press=method=>e=>{e.preventDefault();e.stopPropagation();call(method)}
  const startHold=method=>e=>{e.preventDefault();e.stopPropagation();try{e.currentTarget.setPointerCapture?.(e.pointerId)}catch{};call(method,true)}
  const stopHold=method=>e=>{e.stopPropagation();try{e.currentTarget.releasePointerCapture?.(e.pointerId)}catch{};call(method,false)}
  const touchFallback=handler=>e=>{if(!supportsPointerEvents)handler(e)}

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
    </div>}
    {!hud.uiPanel&&<>
      {hud.multiplayer?.connected&&<div className={`mobile-network-chip glass ${hud.multiplayer?.quality||''}`}><b>● ONLINE</b><span>{hud.multiplayer.players||0}</span><small>{String(hud.multiplayer?.room||'asterra-global').replace('asterra-','L')}</small>{hud.multiplayer.latencyMs>0&&<small>{Math.round(hud.multiplayer.latencyMs)} ms</small>}</div>}
      {hud.actionButton&&<button disabled={hud.actionButton.blocked} className={`mobile-prominent-action ${hud.actionButton.type||''} ${hud.actionButton.blocked?'blocked':''}`} onClick={()=>call('interact')} aria-label={hud.actionButton.label}><span>{hud.actionButton.icon||'☞'}</span><div><b>{hud.actionButton.label}</b>{hud.actionButton.detail&&<small>{hud.actionButton.detail}</small>}</div><em>{hud.actionButton.blocked?'EQUIPE':'TOCAR'}</em></button>}
      
      {/* Dynamic Left Touch Zone for Movement Joystick */}
      <div
        className="mobile-joystick-touch-zone"
        onPointerDown={handleJoystickDown}
        onPointerMove={handleJoystickMove}
        onPointerUp={handleJoystickUp}
        onPointerCancel={handleJoystickUp}
      >
        {stickCenter && (
          <div
            className="dynamic-floating-joystick"
            style={{left:`${stickCenter.x}px`,top:`${stickCenter.y}px`}}
          >
            <div className="joystick-base" />
            <div
              className="joystick-knob"
              style={{transform:`translate(calc(-50% + ${stickOffset.x}px), calc(-50% + ${stickOffset.y}px))`}}
            />
          </div>
        )}
      </div>

      {/* Right Touch Zone for Camera Look */}
      <div
        className="mobile-camera-touch-zone"
        onPointerDown={handleCamDown}
        onPointerMove={handleCamMove}
        onPointerUp={handleCamUp}
        onPointerCancel={handleCamUp}
      />

      <div className="mobile-actions">
        <button className="mobile-attack" onPointerDown={startHold('setAutoAttack')} onPointerUp={stopHold('setAutoAttack')} onPointerCancel={stopHold('setAutoAttack')} onTouchStart={touchFallback(startHold('setAutoAttack'))} onTouchEnd={touchFallback(stopHold('setAutoAttack'))}>⚔<small>ATACAR</small></button>
        <button className="mobile-block" onPointerDown={startHold('setMobileBlock')} onPointerUp={stopHold('setMobileBlock')} onPointerCancel={stopHold('setMobileBlock')} onTouchStart={touchFallback(startHold('setMobileBlock'))} onTouchEnd={touchFallback(stopHold('setMobileBlock'))}>🛡<small>DEFESA</small></button>
        <button className="mobile-dash" onPointerDown={press('dash')} onTouchStart={touchFallback(press('dash'))}>↯<small>ESQUIVA</small></button>
        <button className={`mobile-use ${hud.actionButton?'has-context':''}`} onClick={(e)=>{e.stopPropagation();call('interact')}}>{hud.actionButton?.icon||'☞'}<small>USAR</small></button>
        <button className={`mobile-run ${hud.mobileRunning?'active':''}`} onPointerDown={startHold('setMobileRun')} onPointerUp={stopHold('setMobileRun')} onPointerCancel={stopHold('setMobileRun')} onLostPointerCapture={stopHold('setMobileRun')} onTouchStart={touchFallback(startHold('setMobileRun'))} onTouchEnd={touchFallback(stopHold('setMobileRun'))}>🏃<small>{hud.mobileRunning?'CORRENDO':'CORRER'}</small></button>
        <button className="mobile-jump" onPointerDown={press('setMobileJump')} onTouchStart={touchFallback(press('setMobileJump'))}>↥<small>PULAR</small></button>
      </div>
      <div className="mobile-powers-bottom">
        {abilities.map(a=><button key={a.slot} disabled={!a.ready||hud.stamina<a.cost} onClick={(e)=>{e.stopPropagation();call('castAbility',a.slot)}} title={`${a.name} • ${a.cost} vigor`}><span>{a.icon}</span><small>{a.short||a.name}</small>{a.remaining>0&&<em>{a.remaining.toFixed(1)}</em>}</button>)}
        <button className={`mobile-potion-btn ${!potionQty?'empty':''}`} disabled={!potionQty} onClick={(e)=>{e.stopPropagation();call('usePotion')}} title="Usar poção de vida (R)"><span>🧪</span><small>Poção</small>{potionQty>0&&<em>{potionQty}</em>}</button>
        <button className={hud.mount?.active?'active mount-active':''} onClick={(e)=>{e.stopPropagation();call('toggleMount')}} title="Montaria (H)"><span>♞</span><small>{hud.mount?.active?'Descer':'Montar'}</small></button>
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

function ActiveQuestTrackerHUD({ hud, onOpenQuests, onClaim }) {
  const [collapsed, setCollapsed] = useState(false)
  const activeQuests = (hud.quests || []).filter(q => q.status === 'active' || q.status === 'ready')

  if (!activeQuests.length) return null

  return (
    <aside className={`active-quest-tracker glass ${collapsed ? 'collapsed' : ''}`} aria-label="Rastreador de Missões">
      <header onClick={() => setCollapsed(c => !c)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="tracker-icon">📜</span>
          <b>MISSÕES ATIVAS ({activeQuests.length})</b>
        </div>
        <button
          type="button"
          className="tracker-collapse-btn"
          title={collapsed ? 'Expandir' : 'Recolher'}
          onClick={e => { e.stopPropagation(); setCollapsed(c => !c) }}
        >
          {collapsed ? '+' : '−'}
        </button>
      </header>
      {!collapsed && (
        <div className="tracker-content">
          {activeQuests.map(q => {
            const isReady = q.status === 'ready'
            const pctVal = Math.min(100, Math.max(0, ((q.progress || 0) / Math.max(1, q.goal || 1)) * 100))
            return (
              <article key={q.id} className={`tracker-item ${isReady ? 'ready' : ''}`} onClick={onOpenQuests}>
                <div className="tracker-title-row">
                  <strong title={q.title}>{q.title}</strong>
                  {isReady ? (
                    <button
                      type="button"
                      className="tracker-claim-btn"
                      onClick={e => { e.stopPropagation(); onClaim?.(q.id) }}
                    >
                      ✓ Entregar
                    </button>
                  ) : (
                    <span className="tracker-progress-num">{q.progress || 0}/{q.goal}</span>
                  )}
                </div>
                <p className="tracker-desc">{q.text}</p>
                <div className="tracker-bar-wrap">
                  <div className={`tracker-bar ${isReady ? 'ready' : ''}`} style={{ width: `${pctVal}%` }} />
                </div>
                <div className="tracker-meta">
                  <small>Solicitante: <b>{q.giver}</b></small>
                  <small>{isReady ? '🎉 Pronto para entregar!' : '⚔ Em progresso'}</small>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </aside>
  )
}

function TownHall({ hud, accept, claim, onOpenStable }) {
  const oathQuest = (hud.quests || []).find(q => q.id === 'rider_oath')
  const isOathDone = oathQuest?.status === 'done' || hud.mount?.oathCompleted || hud.mount?.unlocked
  const isOathReady = oathQuest?.status === 'ready'
  const isOathActive = oathQuest?.status === 'active'

  return (
    <div className="townhall-layout">
      <div className="townhall-hero glass">
        <div className="townhall-avatar">🏛️</div>
        <div className="townhall-meta">
          <small>CIDADELA AURORA • GABINETE DO PREFEITO</small>
          <h3>Lorde Aldrich</h3>
          <p>
            "Bem-vindo à Prefeitura de Aurora, cidadão dos Despertos. Sob o decreto soberano de Asterra,
            concedemos títulos de cavalaria e autorização dos Estábulos apenas àqueles que provam bravura e lealdade às muralhas."
          </p>
        </div>
      </div>

      <div className="townhall-content">
        <section className="townhall-card glass">
          <header className="townhall-card-header">
            <div>
              <span className="oath-badge">👑 DECRETO MUNICIPAL</span>
              <h4>Juramento do Cavaleiro</h4>
            </div>
            {isOathDone ? (
              <span className="oath-status done">✓ Concluído</span>
            ) : isOathReady ? (
              <span className="oath-status ready">Pronto para Consagrar</span>
            ) : isOathActive ? (
              <span className="oath-status active">Em Andamento</span>
            ) : (
              <span className="oath-status available">Disponível</span>
            )}
          </header>

          <p className="oath-desc">
            {oathQuest?.text || 'Elimine 3 ameaças fora dos portões da Cidadela para jurar lealdade ao reino e receber a licença oficial de cavaleiro e domador de montarias.'}
          </p>

          <div className="oath-objectives">
            <b>Objetivo da Provação:</b>
            <div className="oath-counter">
              <span>Eliminar criaturas no mundo aberto:</span>
              <strong>{oathQuest?.progress || (isOathDone ? 3 : 0)} / 3</strong>
            </div>
            <Bar value={isOathDone ? 100 : Math.min(100, ((oathQuest?.progress || 0) / 3) * 100)} cls="questbar" />
          </div>

          <div className="oath-reward-box">
            <b>Recompensas Oficiais:</b>
            <div className="oath-rewards">
              <span>🏅 <b>Título de Cavaleiro de Aurora</b></span>
              <span>🐎 <b>Licença dos Estábulos</b> (Domação e Montaria)</span>
              <span>◈ <b>+150 Ouro</b></span>
              <span>✨ <b>+220 XP</b></span>
            </div>
          </div>

          <div className="oath-actions">
            {isOathDone ? (
              <div className="oath-completed-banner">
                <p>🏆 Seu juramento foi consagrado! Os estábulos de Mira estão totalmente liberados para domação e escolha de montarias.</p>
                <button type="button" className="btn-primary" onClick={onOpenStable}>
                  🐎 Abrir Estábulos & Domar Cavalos
                </button>
              </div>
            ) : isOathReady ? (
              <button type="button" className="btn-primary pulse" onClick={() => claim('rider_oath')}>
                🏅 Prestar Juramento & Receber Título de Cavaleiro
              </button>
            ) : isOathActive ? (
              <div className="oath-hunting-info">
                <span>⚔ Saia pelas muralhas de Aurora e derrote 3 monstros para completar o juramento.</span>
              </div>
            ) : (
              <button type="button" className="btn-primary" onClick={() => accept('rider_oath')}>
                📜 Aceitar o Juramento do Cavaleiro
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function Stable({ hud, horseBreeds = HORSE_BREEDS, onTame, onSelect, toggle, onOpenTownHall }) {
  const isUnlocked = Boolean(hud.mount?.unlocked || hud.mount?.oathCompleted)
  const currentHorseId = hud.mount?.currentHorseId || 'horse_aurora'
  const tamedList = hud.mount?.tamedHorses || (isUnlocked ? ['horse_aurora'] : [])
  const activeHorse = (horseBreeds || HORSE_BREEDS).find(h => h.id === currentHorseId) || (horseBreeds || HORSE_BREEDS)[0]

  return (
    <div className="stable-layout">
      {!isUnlocked && (
        <div className="stable-locked-alert glass">
          <div className="alert-icon">🔒</div>
          <div className="alert-text">
            <h4>Acesso Restrito aos Estábulos</h4>
            <p>
              Por decreto municipal, a domação de cavalos exige que você preste o <b>Juramento do Cavaleiro</b> na Prefeitura de Aurora com o <b>Lorde Aldrich</b>.
            </p>
            <button type="button" className="btn-alert" onClick={onOpenTownHall}>
              🏛️ Ir até a Prefeitura de Aurora
            </button>
          </div>
        </div>
      )}

      {/* Card do Cavalo Domado Atual */}
      <section className="tamed-horse-card glass">
        <div className="tamed-badge">🐎 MONTARIA PRINCIPAL</div>
        <div className="tamed-body">
          <div className="tamed-avatar" style={{ '--horse-col': `#${(activeHorse?.color || 0x6d4b35).toString(16).padStart(6, '0')}` }}>
            🐎
          </div>
          <div className="tamed-info">
            <div className="tamed-header">
              <h3>{hud.mount?.name || activeHorse?.name || 'Corcel de Aurora'}</h3>
              <span className="tamed-speed-badge">+{((hud.mount?.speedBonus || activeHorse?.speedBonus || 4.7)).toFixed(1)} Velocidade</span>
            </div>
            <p>{activeHorse?.desc || 'Seu leal companheiro veloz para explorar o vasto mundo de Asterra.'}</p>
            <div className="tamed-meta">
              <span><b>Status:</b> {hud.mount?.active ? '♞ Convocado no mundo' : '💤 No estábulo'}</span>
              <span><b>Cavalos Domados:</b> {tamedList.length} raça(s)</span>
            </div>
          </div>
          <div className="tamed-actions">
            <button
              type="button"
              disabled={!isUnlocked}
              className={`tamed-toggle-btn ${hud.mount?.active ? 'active' : ''}`}
              onClick={toggle}
            >
              {hud.mount?.active ? 'Dispensar Montaria' : '♞ Invocar Montaria'}
            </button>
          </div>
        </div>
      </section>

      {/* Catálogo de Domação */}
      <section className="stable-catalog-section">
        <div className="section-title">
          <div>
            <small>ESTÁBULOS DE ASTERRA</small>
            <h3>Catálogo de Cavalos & Domação</h3>
          </div>
          <span className="catalog-subtitle">Compre tentativas até domar raças superiores</span>
        </div>

        <div className="horse-grid">
          {(horseBreeds || HORSE_BREEDS).map(horse => {
            const isTamed = tamedList.includes(horse.id)
            const isCurrent = currentHorseId === horse.id
            const canAfford = (hud.gold || 0) >= horse.cost
            const hasLevel = (hud.level || 1) >= horse.level

            return (
              <article
                key={horse.id}
                className={`horse-card glass ${isTamed ? 'tamed' : ''} ${isCurrent ? 'current' : ''}`}
                style={{ '--horse-tint': `#${horse.color.toString(16).padStart(6, '0')}` }}
              >
                <header>
                  <div>
                    <span className="horse-lvl-badge">Nv. {horse.level}</span>
                    <h4>{horse.name}</h4>
                  </div>
                  {isCurrent ? (
                    <span className="horse-tag current">★ Ativo</span>
                  ) : isTamed ? (
                    <span className="horse-tag tamed">✓ Domado</span>
                  ) : (
                    <span className="horse-chance-badge">{horse.tameChance}% chance</span>
                  )}
                </header>

                <p className="horse-desc">{horse.desc}</p>

                <div className="horse-stats-row">
                  <span>⚡ <b>+{horse.speedBonus.toFixed(1)}</b> Velocidade</span>
                  <span>◈ <b>{horse.cost}</b> ouro/tentativa</span>
                </div>

                <div className="horse-chance-meter">
                  <div className="chance-fill" style={{ width: `${Math.min(100, horse.tameChance)}%` }} />
                </div>

                <footer className="horse-card-footer">
                  {isCurrent ? (
                    <button type="button" disabled className="btn-horse-action current">
                      ✓ Montaria Atual
                    </button>
                  ) : isTamed ? (
                    <button
                      type="button"
                      className="btn-horse-action select"
                      onClick={() => onSelect?.(horse.id)}
                    >
                      Montar Este Cavalo
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!isUnlocked || !hasLevel || !canAfford}
                      className="btn-horse-action tame"
                      onClick={() => onTame?.(horse.id)}
                    >
                      {!isUnlocked
                        ? 'Requer Juramento'
                        : !hasLevel
                        ? `Requer Nv. ${horse.level}`
                        : !canAfford
                        ? `Falta Ouro (${horse.cost}◈)`
                        : `🎯 Tentar Domar (${horse.cost}◈)`}
                    </button>
                  )}
                </footer>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}

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
  const currentLobby=hud.multiplayer?.room||s.multiplayerRoom||'asterra-global'

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
    <div className="save-backup-setting glass" style={{ borderColor: 'rgba(56, 189, 248, 0.35)' }}>
      <div>
        <b>📱 Aplicativo & Modo de Tela</b>
        <small>Instale no Windows ou celular para jogar como app nativo em tela cheia sem barras de navegador.</small>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
        <button type="button" className="save-btn" onClick={() => promptInstallApp()}>
          📲 Instalar Aplicativo
        </button>
        <button type="button" className="save-btn" onClick={() => toggleFullScreen()}>
          ⛶ Alternar Tela Cheia
        </button>
      </div>
    </div>
    {getSavedAccountSession() && (
      <div className="save-backup-setting glass" style={{ borderColor: 'rgba(56, 189, 248, 0.35)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <b>Conta: {getSavedAccountSession().username}</b>
            <small>Servidor Atual: {multiplayerLobbies.find(x => x.id === currentLobby)?.name || currentLobby}</small>
          </div>
          <button className="save-btn" style={{ background: '#7f1d1d', borderColor: '#ef4444', color: '#fee2e2' }} onClick={() => { call('logoutAccount'); call('closePanel') }}>
            🚪 Sair da Conta (Trocar)
          </button>
        </div>
      </div>
    )}
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


function AuthGate({ initialServer = 'asterra-global', onLogin }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [selectedServer, setSelectedServer] = useState(() => {
    const saved = getSavedAccountSession()
    return saved?.server || initialServer || 'asterra-global'
  })
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [pwaState, setPwaState] = useState(getPWAState)

  useEffect(() => {
    return subscribePWA(setPwaState)
  }, [])

  useEffect(() => {
    const saved = getSavedAccountSession()
    if (saved?.username) {
      setUsername(saved.username)
    }
    if (saved?.email) setEmail(saved.email)
    if (saved?.server) {
      setSelectedServer(saved.server)
    }
  }, [])

  const handleSubmit = async (e) => {
    e?.preventDefault?.()
    setErrorMsg('')
    setSuccessMsg('')
    const clean = username.trim()
    if (!email.trim()) {
      setErrorMsg('Informe o e-mail da conta.')
      return
    }
    if (mode === 'register') {
      if (clean.length < 3) {
        setErrorMsg('O nome de usuário deve ter pelo menos 3 caracteres.')
        return
      }
      if (!password || password.length < 8) {
        setErrorMsg('A senha deve ter pelo menos 8 caracteres.')
        return
      }
      if (password !== confirmPassword) {
        setErrorMsg('As senhas digitadas não coincidem.')
        return
      }
    }

    setLoading(true)
    try {
      if (mode === 'register') {
        const res = await registerAccount({ email, username: clean, password, server: selectedServer })
        if (!res.ok) {
          setErrorMsg(res.error || 'Erro ao criar conta.')
          setLoading(false)
          return
        }
        if (res.requiresEmailConfirmation) {
          setSuccessMsg(res.message)
          return
        }
        onLogin(res.session, res.profile)
      } else {
        const res = await loginAccount({ email, password, server: selectedServer })
        if (!res.ok) {
          setErrorMsg(res.error || 'Erro ao entrar na conta.')
          setLoading(false)
          return
        }
        onLogin(res.session, res.profile)
      }
    } catch (err) {
      setErrorMsg(String(err?.message || err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-gate" onKeyDown={e => e.stopPropagation()}>
      <div className="auth-card" onKeyDown={e => e.stopPropagation()}>
        <div className="auth-pwa-bar">
          <button type="button" className="auth-pwa-btn" onClick={promptInstallApp} title="Instalar no Windows ou Celular para rodar como Aplicativo">
            📲 {pwaState.isInstalled ? 'App Instalado' : 'Instalar App'}
          </button>
          <button type="button" className="auth-pwa-btn" onClick={toggleFullScreen} title="Alternar Modo Tela Cheia">
            ⛶ {pwaState.isFullscreen ? 'Janela Normal' : 'Tela Cheia'}
          </button>
        </div>

        <div className="auth-header">
          <small>ASTERRA ONLINE MMORPG</small>
          <h1>{mode === 'login' ? 'Portal de Acesso' : 'Criar Nova Conta'}</h1>
          <p>{mode === 'login' ? 'Seu portal permanece aberto para escolher seu servidor e entrar.' : 'Crie sua conta para jogar e salvar seu progresso na nuvem.'}</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => { setMode('login'); setErrorMsg('') }}
          >
            Entrar
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${mode === 'register' ? 'active' : ''}`}
            onClick={() => { setMode('register'); setErrorMsg('') }}
          >
            Criar Conta
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {errorMsg && <div className="auth-error">⚠ {errorMsg}</div>}
          {successMsg && <div className="auth-success">✓ {successMsg}</div>}

          <div className="auth-field">
            <label>E-mail da Conta</label>
            <input
              autoFocus
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="voce@email.com"
              disabled={loading}
            />
          </div>

          {mode === 'register' && <div className="auth-field">
            <label>Nome do Aventureiro (Nickname)</label>
            <input type="text" maxLength={20} value={username} onChange={e => setUsername(e.target.value)} placeholder="Ex.: Aquino" disabled={loading}/>
          </div>}

          <div className="auth-field">
            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Senha</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder={mode === 'login' ? 'Sua senha' : 'Sua senha (mínimo 8 caracteres)'}
              disabled={loading}
            />
          </div>

          {mode === 'register' && (
            <div className="auth-field">
              <label>Confirmar Senha</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repita sua senha"
                disabled={loading}
              />
            </div>
          )}

          <div className="auth-servers-section">
            <label>
              <b>Servidor Selecionado:</b>
              <span>{multiplayerLobbies.find(x => x.id === selectedServer)?.name || selectedServer}</span>
            </label>
            <div className="auth-servers-grid">
              {multiplayerLobbies.map(l => (
                <div
                  key={l.id}
                  className={`auth-server-card ${selectedServer === l.id ? 'active' : ''}`}
                  onClick={() => setSelectedServer(l.id)}
                >
                  <b>{l.name}</b>
                  <small>{selectedServer === l.id ? '● SELECIONADO' : '○ DISPONÍVEL'}</small>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? 'Conectando ao Mundo...' : mode === 'login' ? '⚔ Entrar no Mundo' : '✨ Criar Conta e Jogar'}
          </button>
        </form>
      </div>
    </div>
  )
}

function Grimoire({ hud, onAwaken, onSwitch, onUpgradeRank, onAcceptQuest, onClaimQuest }) {
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

  const reqQuestId = nextRankInfo ? `ascension_rank_${nextRankInfo.rank}` : null
  const ascensionQ = reqQuestId ? (hud.quests || []).find(q => q.id === reqQuestId) : null
  const hasAscensionDone = ascensionQ ? ascensionQ.status === 'done' : true
  const canEvolve = nextRankInfo && hasEvolveLevel && hasEvolveGrimoires && hasEvolveGold && hasAscensionDone

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

                {ascensionQ && (
                  <div className="ascension-req-box" style={{margin:'6px 0 8px',padding:'7px 9px',borderRadius:'8px',background:'rgba(2,6,12,0.6)',border:`1px solid ${hasAscensionDone?'rgba(74,222,128,0.4)':ascensionQ.status==='ready'?'rgba(251,191,36,0.6)':'rgba(239,68,68,0.3)'}`}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'6px',fontSize:'9px'}}>
                      <span style={{color:'#e2e8f0'}}>📜 <b>Prova Obrigatória:</b> {ascensionQ.title}</span>
                      {hasAscensionDone ? (
                        <b style={{color:'#4ade80'}}>✓ Concluída</b>
                      ) : ascensionQ.status === 'ready' ? (
                        <button type="button" onClick={()=>onClaimQuest?.(ascensionQ.id)} style={{background:'#10b981',color:'#fff',border:'none',borderRadius:'6px',padding:'2px 6px',fontSize:'8px',fontWeight:700,cursor:'pointer'}}>
                          ✓ Entregar Missão
                        </button>
                      ) : ascensionQ.status === 'active' ? (
                        <b style={{color:'#38bdf8'}}>[ {ascensionQ.progress||0} / {ascensionQ.goal} ]</b>
                      ) : (
                        <button type="button" onClick={()=>onAcceptQuest?.(ascensionQ.id)} style={{background:'#3b82f6',color:'#fff',border:'none',borderRadius:'6px',padding:'2px 6px',fontSize:'8px',fontWeight:700,cursor:'pointer'}}>
                          Aceitar Prova
                        </button>
                      )}
                    </div>
                    <small style={{display:'block',color:'#94a3b8',fontSize:'8px',marginTop:'3px'}}>{ascensionQ.text}</small>
                  </div>
                )}

                <button
                  type="button"
                  className="evolve-class-btn"
                  disabled={!canEvolve}
                  onClick={()=>onUpgradeRank?.(activeId)}
                  style={{width:'100%',padding:'7px 10px',borderRadius:'8px',background:canEvolve?'linear-gradient(135deg, #f59e0b, #d97706)':'rgba(255,255,255,0.06)',color:canEvolve?'#000':'#64748b',fontWeight:700,fontSize:'11px',border:'none',cursor:canEvolve?'pointer':'not-allowed',boxShadow:canEvolve?'0 0 12px rgba(245,158,11,0.4)':'none'}}
                >
                  {canEvolve ? `⚡ Evoluir ${activeCls.name} para ${nextRankInfo.name}` : !hasEvolveLevel ? `Requer Nível ${nextRankInfo.minLevel} (Atual: ${hud.level})` : !hasAscensionDone ? `Requer concluir: ${ascensionQ?.title || 'Missão de Ascensão'}` : !hasEvolveGrimoires ? `Requer ${nextRankInfo.costGrimoires} Grimório(s)` : `Requer ${nextRankInfo.costGold}◈ Ouro`}
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

function GateModal({ modal, call, onClose }) {
  if (!modal || !modal.gate) return null
  const gate = modal.gate
  const isCountingDown = modal.readyCountdown !== null && modal.readyCountdown !== undefined
  const rankColor = gate.rankConfig?.color || '#38bdf8'
  const isParty = modal.members && modal.members.length > 1

  return (
    <div className="overlay-shell" style={{zIndex:40,background:'rgba(2,6,15,0.78)',backdropFilter:'blur(8px)'}}>
      <div className="window glass" style={{maxWidth:'580px',height:'auto',borderRadius:'24px',border:`2px solid ${rankColor}`,boxShadow:`0 0 45px ${rankColor}33`,padding:'24px',display:'flex',flexDirection:'column',gap:'16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',borderBottom:'1px solid rgba(255,255,255,0.1)',paddingBottom:'14px'}}>
          <div>
            <div style={{display:'inline-flex',alignItems:'center',gap:'8px',padding:'4px 12px',borderRadius:'999px',background:'rgba(15,23,42,0.85)',border:`1px solid ${rankColor}`}}>
              <span style={{color:rankColor,fontWeight:'900',fontSize:'13px'}}>RANK {gate.rankKey}</span>
              {gate.isUnstable && <span style={{color:'#f43f5e',fontWeight:'900',fontSize:'11px'}}>ANOMALIA • INSTÁVEL</span>}
            </div>
            <h2 style={{margin:'8px 0 0',fontSize:'22px',color:'#f8fafc'}}>{gate.name}</h2>
            <p style={{margin:'4px 0 0',fontSize:'12px',color:'#94a3b8'}}>{gate.zoneName} • {gate.theme?.name || 'Profundezas Arcanas'}</p>
          </div>
          <button type="button" onClick={onClose} disabled={isCountingDown} style={{background:'none',border:'none',color:'#94a3b8',fontSize:'22px',cursor:'pointer'}}>✕</button>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:'10px',background:'rgba(15,23,42,0.5)',padding:'12px',borderRadius:'12px',border:'1px solid rgba(255,255,255,0.06)'}}>
          <div style={{textAlign:'center'}}>
            <small style={{color:'#64748b',fontSize:'10px'}}>Nível Recomendado</small>
            <b style={{display:'block',color:'#38bdf8',fontSize:'14px'}}>{gate.rankConfig?.levelRange[0]}–{gate.rankConfig?.levelRange[1]}</b>
          </div>
          <div style={{textAlign:'center'}}>
            <small style={{color:'#64748b',fontSize:'10px'}}>Andares Estimados</small>
            <b style={{display:'block',color:'#facc15',fontSize:'14px'}}>{gate.totalFloors} Andares</b>
          </div>
          <div style={{textAlign:'center'}}>
            <small style={{color:'#64748b',fontSize:'10px'}}>Dificuldade</small>
            <b style={{display:'block',color:rankColor,fontSize:'14px'}}>{gate.rankKey === 'S' ? 'MORTAL' : gate.rankKey === 'A' ? 'EXTREMA' : gate.rankKey === 'B' ? 'PERIGOSA' : gate.rankKey === 'C' ? 'DESAFIADORA' : 'MODERADA'}</b>
          </div>
        </div>

        <div style={{fontSize:'11px',color:'#cbd5e1',lineHeight:'1.5'}}>
          {gate.modifiers && gate.modifiers.length > 0 && (
            <div style={{marginBottom:'8px'}}>
              <b style={{color:'#f87171'}}>Modificadores de Masmorra:</b>
              {gate.modifiers.map(m => (
                <div key={m.id} style={{color:'#fca5a5',marginLeft:'8px'}}>• <strong>{m.name}</strong>: {m.desc}</div>
              ))}
            </div>
          )}
          <div>
            <b style={{color:'#93c5fd'}}>Inimigos Detectados:</b> {gate.theme?.mobs?.join(', ') || 'Inimigos das Sombras'}
          </div>
          <div style={{marginTop:'4px'}}>
            <b style={{color:'#facc15'}}>Loot Exclusivo:</b> Equipamentos Rúnicos, Runas Arcanas, Minérios Raros e Baú do Guardião.
          </div>
        </div>

        <div style={{background:'rgba(11,25,40,0.6)',padding:'12px',borderRadius:'12px',border:'1px solid rgba(255,255,255,0.06)'}}>
          <div style={{fontSize:'12px',fontWeight:'bold',color:'#e2e8f0',marginBottom:'8px'}}>
            {isParty ? 'INTEGRANTES DA EQUIPE' : 'EXPLORAÇÃO INDIVIDUAL'}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:'6px'}}>
            {modal.members.map(m => (
              <div key={m.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'12px'}}>
                <span style={{color:'#cbd5e1'}}>{m.name} (Nv. {m.level})</span>
                <span style={{color: m.ready ? '#4ade80' : '#f59e0b',fontWeight:'bold'}}>
                  {m.ready ? '✅ Pronto' : '⏳ Aguardando'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {isCountingDown ? (
          <div style={{textAlign:'center',padding:'16px',background:'rgba(30,58,138,0.3)',borderRadius:'12px',border:'1px solid #3b82f6'}}>
            <div style={{fontSize:'13px',color:'#93c5fd',fontWeight:'bold'}}>ENTRANDO NA MASMORRA...</div>
            <div style={{fontSize:'42px',fontWeight:'900',color:'#facc15',marginTop:'4px',animation:'pulseGlow 0.8s infinite'}}>{modal.readyCountdown}</div>
          </div>
        ) : (
          <div style={{display:'flex',gap:'10px',marginTop:'4px'}}>
            <button
              type="button"
              onClick={() => call('startSoloDungeon', gate)}
              style={{
                flex:1,padding:'12px',borderRadius:'12px',border:'1px solid rgba(255,255,255,0.15)',
                background:'rgba(30,41,59,0.8)',color:'#f8fafc',fontWeight:'bold',fontSize:'13px',cursor:'pointer'
              }}
            >
              ⚔ ENTRAR SOLO
            </button>
            {isParty && (
              <button
                type="button"
                onClick={() => call('startPartyReadyCheck', gate)}
                style={{
                  flex:1,padding:'12px',borderRadius:'12px',border:`1px solid ${rankColor}`,
                  background:`color-mix(in srgb, ${rankColor} 25%, #0f172a)`,color:'#f8fafc',fontWeight:'bold',fontSize:'13px',cursor:'pointer'
                }}
              >
                🛡 READY CHECK EQUIPE
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{padding:'12px 18px',borderRadius:'12px',border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'#94a3b8',cursor:'pointer'}}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function DungeonCompletionModal({ completion, onClose }) {
  if (!completion) return null
  return (
    <div className="overlay-shell" style={{zIndex:45,background:'rgba(2,6,15,0.85)',backdropFilter:'blur(10px)'}}>
      <div className="window glass" style={{maxWidth:'620px',height:'auto',borderRadius:'24px',border:'2px solid #facc15',boxShadow:'0 0 55px rgba(250,204,21,0.25)',padding:'28px',textAlign:'center'}}>
        <div style={{fontSize:'32px',fontWeight:'900',letterSpacing:'.12em',color:'#facc15',textShadow:'0 0 25px rgba(250,204,21,0.6)'}}>
          🏆 MASMORRA CONCLUÍDA!
        </div>
        <div style={{color:'#94a3b8',fontSize:'13px',marginTop:'4px'}}>
          O Guardião das Profundezas foi derrotado e o selo do portal foi dissipado.
        </div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:'10px',margin:'20px 0',background:'rgba(15,23,42,0.6)',padding:'14px',borderRadius:'14px',border:'1px solid rgba(255,255,255,0.08)'}}>
          <div>
            <small style={{color:'#64748b',fontSize:'10px'}}>Tempo de Conquista</small>
            <b style={{display:'block',color:'#f8fafc',fontSize:'14px',marginTop:'3px'}}>{completion.timeFormatted}</b>
          </div>
          <div>
            <small style={{color:'#64748b',fontSize:'10px'}}>Inimigos Derrotados</small>
            <b style={{display:'block',color:'#f8fafc',fontSize:'14px',marginTop:'3px'}}>{completion.kills}</b>
          </div>
          <div>
            <small style={{color:'#64748b',fontSize:'10px'}}>Elites Eliminados</small>
            <b style={{display:'block',color:'#38bdf8',fontSize:'14px',marginTop:'3px'}}>{completion.elites}</b>
          </div>
          <div>
            <small style={{color:'#64748b',fontSize:'10px'}}>Chefe</small>
            <b style={{display:'block',color:'#f87171',fontSize:'14px',marginTop:'3px'}}>Derrotado</b>
          </div>
        </div>

        <div style={{display:'flex',justifyContent:'center',gap:'24px',fontSize:'15px',fontWeight:'bold',marginBottom:'18px'}}>
          <span style={{color:'#4ade80'}}>+{completion.xp.toLocaleString('pt-BR')} XP</span>
          <span style={{color:'#facc15'}}>+{completion.gold.toLocaleString('pt-BR')} ◈ Ouro</span>
        </div>

        {completion.loot && completion.loot.length > 0 && (
          <div style={{textAlign:'left',marginBottom:'20px'}}>
            <div style={{fontSize:'12px',fontWeight:'bold',color:'#e2e8f0',marginBottom:'8px'}}>RECOMPENSAS EXCLUSIVAS OBTIDAS:</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))',gap:'8px'}}>
              {completion.loot.map((item, idx) => (
                <div key={item.id || idx} style={{padding:'8px 10px',borderRadius:'10px',background:'rgba(11,25,40,0.8)',border:`1px solid ${item.color || '#3b82f6'}`}}>
                  <div style={{color:item.color || '#3b82f6',fontWeight:'bold',fontSize:'11px'}}>{item.name}</div>
                  <small style={{color:'#94a3b8',fontSize:'9px'}}>{item.rarity} • Nv. {item.level}</small>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          style={{
            padding:'12px 32px',borderRadius:'12px',border:'1px solid #facc15',
            background:'linear-gradient(135deg, #eab308, #ca8a04)',color:'#020617',
            fontWeight:'900',fontSize:'14px',letterSpacing:'.06em',cursor:'pointer',
            boxShadow:'0 0 25px rgba(250,204,21,0.35)'
          }}
        >
          RETORNAR A ASTERRA
        </button>
      </div>
    </div>
  )
}

function WaypointArrow({ marker, playerPos, cameraYaw = 0, onClear }) {
  if (!marker) return null

  const dx = (marker.x ?? 0) - (playerPos?.x ?? 0)
  const dz = (marker.z ?? 0) - (playerPos?.z ?? 0)
  const dist = Math.hypot(dx, dz)
  const targetAngle = Math.atan2(dx, dz)
  const relAngle = targetAngle - cameraYaw
  const deg = (relAngle * 180) / Math.PI

  const isArrived = dist < 15
  const rank = marker.rank || marker.rankKey || 'E'
  const rankColor = marker.color || '#38bdf8'

  return (
    <div
      className="waypoint-hud-indicator glass"
      style={{
        position: 'absolute',
        top: '68px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 22,
        padding: '6px 16px',
        borderRadius: '999px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        border: `1.5px solid ${rankColor}`,
        boxShadow: `0 0 20px ${rankColor}33, 0 4px 15px rgba(0,0,0,0.5)`,
        color: '#f8fafc',
        fontSize: '12px',
        fontWeight: 'bold',
        pointerEvents: 'auto'
      }}
    >
      <div
        style={{
          width: '22px',
          height: '22px',
          display: 'grid',
          placeItems: 'center',
          borderRadius: '50%',
          background: `${rankColor}22`,
          border: `1px solid ${rankColor}`,
          transform: `rotate(${deg}deg)`,
          transition: 'transform 0.1s linear'
        }}
      >
        <span style={{ color: rankColor, fontSize: '13px', lineHeight: 1 }}>▲</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
        <span style={{ fontSize: '11px', color: '#cbd5e1' }}>
          {isArrived ? (
            <b style={{ color: '#4ade80' }}>DESTINO ALCANÇADO</b>
          ) : (
            <>
              Portal Rank <b style={{ color: rankColor }}>{rank}</b>
            </>
          )}
        </span>
        <small style={{ fontSize: '10px', color: '#94a3b8' }}>
          {marker.name ? `${marker.name} • ` : ''}
          {isArrived ? 'Pronto para entrar' : `${Math.round(dist)}m`}
        </small>
      </div>

      <button
        type="button"
        onClick={onClear}
        title="Cancelar Waypoint"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#94a3b8',
          fontSize: '14px',
          cursor: 'pointer',
          padding: '2px 6px',
          borderRadius: '6px',
          marginLeft: '4px'
        }}
      >
        ✕
      </button>
    </div>
  )
}

function CaravanModal({ modal, onClose }) {
  if (!modal) return null
  const { title, text, goods = [], type = 'info', onLoot, onHelp } = modal

  return (
    <div className="overlay-shell" style={{ zIndex: 45, background: 'rgba(2,6,15,0.85)', backdropFilter: 'blur(8px)' }}>
      <div
        className="window glass"
        style={{
          maxWidth: '520px',
          height: 'auto',
          borderRadius: '20px',
          border: '2px solid rgba(250,204,21,0.5)',
          padding: '24px',
          textAlign: 'center'
        }}
      >
        <div style={{ fontSize: '28px', marginBottom: '8px' }}>
          {type === 'loot' ? '📦' : type === 'defense' ? '🛡️' : '🚚'}
        </div>
        <h2 style={{ fontSize: '20px', color: '#facc15', margin: '0 0 6px 0', letterSpacing: '.05em' }}>
          {title || 'Caravana Comercial'}
        </h2>
        <p style={{ color: '#cbd5e1', fontSize: '12px', lineHeight: '1.5', margin: '0 0 16px 0' }}>
          {text}
        </p>

        {goods.length > 0 && (
          <div style={{ textAlign: 'left', marginBottom: '18px', background: 'rgba(15,23,42,0.6)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <small style={{ display: 'block', color: '#94a3b8', fontSize: '10px', marginBottom: '8px', fontWeight: 'bold' }}>
              CARGA DA CARAVANA:
            </small>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {goods.map((g, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#f8fafc' }}>
                  <span>• {g.name}</span>
                  <b style={{ color: '#facc15' }}>×{g.qty}</b>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          {type === 'loot' && (
            <button
              type="button"
              onClick={() => {
                onLoot?.()
                onClose()
              }}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid #eab308',
                background: 'linear-gradient(135deg, #eab308, #ca8a04)',
                color: '#020617',
                fontWeight: '900',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              📦 SAQUEAR CARGA
            </button>
          )}

          {type === 'defense' && (
            <button
              type="button"
              onClick={() => {
                onHelp?.()
                onClose()
              }}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: '12px',
                border: '1px solid #38bdf8',
                background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                color: '#f8fafc',
                fontWeight: '900',
                fontSize: '13px',
                cursor: 'pointer'
              }}
            >
              🛡️ COLETAR RECOMPENSA DE ESCOLTA
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '12px 20px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(30,41,59,0.8)',
              color: '#94a3b8',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
