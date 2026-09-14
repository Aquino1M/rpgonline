import React, { useEffect, useRef, useState } from 'react'
import { ZONES, WORLD, CITY_ECONOMIES } from '../game/config.js'
import { drawPixelWorld } from '../game/mapGenerator.js'

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v))

export default function WorldMap({hud}){
  const ref=useRef(null)
  const pinch=useRef(null)
  const dragRef=useRef({ active: false, startX: 0, startY: 0, initialPanX: 0, initialPanZ: 0 })
  const [showMobs,setShowMobs]=useState(true)
  const [fog,setFog]=useState(true)
  const [zoom,setZoom]=useState(1)
  const [pan,setPan]=useState({ x: 0, z: 0 })
  const [isDragging,setIsDragging]=useState(false)

  const data=hud.mapSnapshot
  const setMapZoom=v=>setZoom(clamp(Math.round(v*4)/4,1,4))

  useEffect(()=>{
    const canvas=ref.current;if(!canvas||!data)return
    const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2),W=Math.max(1,Math.round(rect.width*dpr)),H=Math.max(1,Math.round(rect.height*dpr));if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H}
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);const w=rect.width,h=rect.height,limit=data.limit||WORLD.worldLimit
    const player=data.player||hud.playerPosition||{x:0,z:0,heading:0}
    const viewWorld=limit*2/zoom,half=viewWorld/2
    const cx=clamp((player.x||0)+pan.x,-limit+half,limit-half)
    const cz=clamp((player.z||0)+pan.z,-limit+half,limit-half)
    const toMap=(x,z)=>[(x-(cx-half))/viewWorld*w,(z-(cz-half))/viewWorld*h],inside=(x,y,pad=22)=>x>-pad&&x<w+pad&&y>-pad&&y<h+pad
    ctx.clearRect(0,0,w,h);drawPixelWorld(ctx,w,h,{limit,step:5,discovered:data.discovered||[],fog,zoom,centerX:cx,centerZ:cz})

    ctx.lineCap='round';for(const r of data.roads||[]){const a=toMap(r.ax,r.az),b=toMap(r.bx,r.bz);ctx.strokeStyle='rgba(201,181,129,.88)';ctx.lineWidth=3.2;ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();ctx.strokeStyle='rgba(85,68,45,.45)';ctx.lineWidth=1;ctx.stroke()}

    ctx.textAlign='center';ctx.textBaseline='middle';for(const z of ZONES){const zx=(z.x0+z.x1)/2,zz=(z.z0+z.z1)/2,[x,y]=toMap(zx,zz);if(!inside(x,y,60))continue;ctx.font='900 22px Inter,sans-serif';ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.6)';ctx.strokeText(z.name,x,y);ctx.fillStyle='rgba(239,247,235,.82)';ctx.fillText(z.name,x,y);ctx.font='900 14px Inter,sans-serif';ctx.fillStyle='rgba(245,250,242,.78)';ctx.fillText(`Nv.${z.min}–${z.max}`,x,y+19)}

    for(const c of data.cities||[]){const [x,y]=toMap(c.x,c.z);if(!inside(x,y,90))continue;const rr=c.wallRadius/viewWorld*w;ctx.fillStyle='rgba(230,214,169,.38)';ctx.beginPath();ctx.arc(x,y,Math.max(5,rr),0,Math.PI*2);ctx.fill();ctx.strokeStyle=c.accent||'#ffe6a1';ctx.lineWidth=1.5;ctx.setLineDash([4,2]);ctx.beginPath();ctx.arc(x,y,Math.max(6,rr),0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.font='900 13px Inter,sans-serif';ctx.strokeStyle='rgba(0,0,0,.7)';ctx.lineWidth=3;ctx.strokeText(c.name,x,y-rr-8);ctx.fillStyle='#fff0c5';ctx.fillText(c.name,x,y-rr-8)}

    for(const s of data.services||[]){const [x,y]=toMap(s.x,s.z);if(!inside(x,y))continue;const col=s.role==='merchant'?'#67e8a7':s.role==='blacksmith'?'#ff805e':s.role==='stable'?'#76d3ff':s.role==='traveler'?'#38bdf8':'#ffd85e',label=s.role==='merchant'?'Loja':s.role==='blacksmith'?'Ferreiro':s.role==='stable'?'Estábulo':s.role==='traveler'?'Viagem':'Guilda';ctx.fillStyle='rgba(4,10,14,.88)';ctx.strokeStyle=col;ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(x,y,5.1,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=col;ctx.font='900 7px Inter,sans-serif';ctx.fillText(s.role==='merchant'?'$':s.role==='blacksmith'?'⚒':s.role==='stable'?'♞':s.role==='traveler'?'⇄':'!',x,y+.4);ctx.font='700 6px Inter,sans-serif';ctx.strokeStyle='rgba(0,0,0,.72)';ctx.lineWidth=2;ctx.strokeText(label,x,y+10);ctx.fillStyle='rgba(244,248,239,.9)';ctx.fillText(label,x,y+10)}

    for(const l of data.landmarks||[]){const [x,y]=toMap(l.x,l.z);if(!inside(x,y))continue;ctx.fillStyle='#e6ca72';ctx.strokeStyle='#4e3c1f';ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<8;i++){const a=-Math.PI/2+i*Math.PI/4,r=i%2?3:6,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath();ctx.fill();ctx.stroke();ctx.font='700 6px Inter,sans-serif';ctx.strokeStyle='rgba(0,0,0,.7)';ctx.lineWidth=2;ctx.strokeText(l.name,x,y+11);ctx.fillStyle='#f5e9bd';ctx.fillText(l.name,x,y+11)}

    for(const p of data.portals||[]){const [x,y]=toMap(p.x,p.z);if(!inside(x,y))continue;ctx.strokeStyle=p.color||'#c084fc';ctx.shadowColor=p.color||'#c084fc';ctx.shadowBlur=6;ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0}
    
    // Global Gates
    for(const g of data.gates||[]){
      const [x,y]=toMap(g.x,g.z)
      if(!inside(x,y))continue
      const col = g.color || '#c084fc'
      ctx.strokeStyle=col;ctx.shadowColor=col;ctx.shadowBlur=10;ctx.lineWidth=2.5
      ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.stroke()
      ctx.fillStyle='rgba(8,16,28,0.92)';ctx.beginPath();ctx.arc(x,y,6.5,0,Math.PI*2);ctx.fill()
      ctx.fillStyle=col;ctx.font='900 9px Inter,sans-serif';ctx.fillText(g.rank||'C',x,y+.5)
      ctx.font='700 7px Inter,sans-serif';ctx.strokeStyle='rgba(0,0,0,.8)';ctx.lineWidth=2
      ctx.strokeText(`Rank ${g.rank}`,x,y+13);ctx.fillStyle='#ffffff';ctx.fillText(`Rank ${g.rank}`,x,y+13)
      ctx.shadowBlur=0
    }

    // Destination Marker
    if(hud.destinationMarker){
      const [dx,dy]=toMap(hud.destinationMarker.x,hud.destinationMarker.z)
      if(inside(dx,dy)){
        ctx.strokeStyle='#ffffff';ctx.lineWidth=2.5;ctx.fillStyle=hud.destinationMarker.color||'#38bdf8'
        ctx.beginPath();ctx.arc(dx,dy,7,0,Math.PI*2);ctx.fill();ctx.stroke()
        ctx.font='900 8px Inter,sans-serif';ctx.fillStyle='#ffffff';ctx.strokeStyle='rgba(0,0,0,.8)';ctx.lineWidth=2
        ctx.strokeText(hud.destinationMarker.name || 'DESTINO',dx,dy-11);ctx.fillText(hud.destinationMarker.name || 'DESTINO',dx,dy-11)
      }
    }

    // Caravans
    for(const c of data.caravans || []){
      const [x,y]=toMap(c.x,c.z)
      if(!inside(x,y))continue
      ctx.fillStyle=c.color||'#f59e0b'
      ctx.font='900 11px Inter,sans-serif'
      ctx.fillText(c.icon||'🚚',x,y)
      ctx.font='700 7px Inter,sans-serif';ctx.strokeStyle='rgba(0,0,0,.85)';ctx.lineWidth=2
      ctx.strokeText(c.name,x,y+10);ctx.fillStyle='#ffffff';ctx.fillText(c.name,x,y+10)
    }

    if(showMobs)for(const b of data.bosses||[]){const [x,y]=toMap(b.x,b.z);if(!inside(x,y))continue;ctx.fillStyle='#e43e56';ctx.strokeStyle='#ffe4e8';ctx.lineWidth=1;ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillRect(-4,-4,8,8);ctx.strokeRect(-4,-4,8,8);ctx.restore()}
    for(const a of data.adventurers||[]){const [x,y]=toMap(a.x,a.z);if(!inside(x,y))continue;ctx.fillStyle=a.hostile?'#ff9b4f':'#4fc3ff';ctx.strokeStyle='#eefaff';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,4.5,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#06121d';ctx.font='900 6px Inter,sans-serif';ctx.fillText('A',x,y+.4)}

    // Remote Players
    for(const rp of data.players || []){
      const [rx,ry]=toMap(rp.x,rp.z)
      if(!inside(rx,ry,30))continue
      ctx.save()
      ctx.shadowColor='#10b981';ctx.shadowBlur=10
      ctx.fillStyle='#10b981';ctx.strokeStyle='#ffffff';ctx.lineWidth=2
      ctx.beginPath();ctx.arc(rx,ry,6,0,Math.PI*2);ctx.fill();ctx.stroke()
      ctx.shadowBlur=0
      if(rp.heading!=null){
        ctx.strokeStyle='#34d399';ctx.lineWidth=2;ctx.beginPath()
        ctx.moveTo(rx,ry);ctx.lineTo(rx+Math.sin(rp.heading)*10,ry-Math.cos(rp.heading)*10);ctx.stroke()
      }
      ctx.font='900 10px Inter,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle'
      ctx.strokeStyle='rgba(0,0,0,0.85)';ctx.lineWidth=3
      ctx.strokeText(rp.name||'Aventureiro',rx,ry-11)
      ctx.fillStyle='#6ee7b7';ctx.fillText(rp.name||'Aventureiro',rx,ry-11)
      ctx.restore()
    }

    const [px,py]=toMap(player.x,player.z);drawPlayer(ctx,px,py,player.heading||0)
  },[data,fog,showMobs,hud.playerPosition,zoom,pan,hud.destinationMarker])

  const activePointers = useRef(new Map())
  const initialPinch = useRef(null)

  const onPointerDown = e => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (activePointers.current.size === 1) {
      dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, initialPanX: pan.x, initialPanZ: pan.z }
      setIsDragging(true)
    } else if (activePointers.current.size === 2) {
      dragRef.current.active = false
      setIsDragging(false)
      const pts = Array.from(activePointers.current.values())
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      initialPinch.current = { dist, zoom }
    }
  }

  const onPointerMove = e => {
    if (!activePointers.current.has(e.pointerId)) return
    activePointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (activePointers.current.size === 1 && dragRef.current.active && ref.current && data) {
      const rect = ref.current.getBoundingClientRect()
      const limit = data.limit || WORLD.worldLimit
      const viewWorld = limit * 2 / zoom
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      const worldDx = (dx / rect.width) * viewWorld
      const worldDz = (dy / rect.height) * viewWorld
      setPan({ x: dragRef.current.initialPanX - worldDx, z: dragRef.current.initialPanZ - worldDz })
    } else if (activePointers.current.size === 2 && initialPinch.current) {
      const pts = Array.from(activePointers.current.values())
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      setMapZoom(initialPinch.current.zoom * (dist / Math.max(20, initialPinch.current.dist)))
    }
  }

  const onPointerUp = e => {
    try { e.currentTarget.releasePointerCapture?.(e.pointerId) } catch {}
    activePointers.current.delete(e.pointerId)
    if (activePointers.current.size === 0) {
      dragRef.current.active = false
      initialPinch.current = null
      setIsDragging(false)
    } else if (activePointers.current.size === 1) {
      initialPinch.current = null
      const remaining = activePointers.current.values().next().value
      dragRef.current = { active: true, startX: remaining.x, startY: remaining.y, initialPanX: pan.x, initialPanZ: pan.z }
      setIsDragging(true)
    }
  }

  const wheel=e=>{
    e.preventDefault()
    setMapZoom(zoom+(e.deltaY<0?.25:-.25))
  }

  const recenter=()=>{
    setPan({ x: 0, z: 0 })
    setZoom(1.25)
  }

  if(!data)return <div className="map-loading">Gerando mapa...</div>
  return <div className="rpg-world-map-layout">
    <section className="rpg-map-frame">
      <div className="map-coordinate-bar">
        <b>X: {Math.round(data.player?.x||0)}, Z: {Math.round(data.player?.z||0)}</b>
        <span>{hud.currentCity||hud.zone} • Nv.{hud.level}</span>
      </div>
      <div
        className={`world-map-canvas-wrap ${isDragging?'dragging':''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={wheel}
        style={{ cursor: isDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        <canvas ref={ref} className="world-map-canvas"/>
        <div className="map-compass"><b>N</b><span>W</span><span>E</span><small>S</small></div>
        <div className="map-zoom-controls">
          <button onClick={()=>setMapZoom(zoom-.5)} disabled={zoom<=1} title="Afastar (−)">−</button>
          <b>{Math.round(zoom*100)}%</b>
          <button onClick={()=>setMapZoom(zoom+.5)} disabled={zoom>=4} title="Aproximar (+)">+</button>
          <button onClick={recenter} title="Centralizar no Jogador">🎯 Centrar</button>
        </div>
      </div>
      <div className="map-toolbar">
        <button className={fog?'active':''} onClick={()=>setFog(v=>!v)}>◐ Exploração</button>
        <button className={showMobs?'active':''} onClick={()=>setShowMobs(v=>!v)}>★ Bosses</button>
        <button onClick={recenter} className="recenter-btn">📍 Centralizar Jogador</button>
        <span className="map-hint">PC: arraste e use a roda. Mobile/Tablet: arraste 1 dedo e pinça com 2 dedos.</span>
      </div>
    </section>
    <aside className="map-side-panel">
      <h3>Mapa de Asterra</h3>
      <p>As cidades são zonas seguras cercadas por muralhas. Estradas ligam os principais refúgios.</p>
      <div className="map-legend-grid">
        <span><i className="legend-city"/>Cidade</span>
        <span><i className="legend-shop">$</i>Mercador</span>
        <span><i className="legend-forge">⚒</i>Ferreiro</span>
        <span><i className="legend-quest">!</i>Guilda</span>
        <span><i className="legend-shop">⇄</i>Viagem</span>
        <span><i className="legend-portal"/>Fenda</span>
        <span><i className="legend-boss"/>Boss</span>
        <span><i className="legend-landmark">✦</i>Local</span>
        <span><i className="legend-res">🪵</i>Recursos</span>
      </div>

      {data.gates && data.gates.length > 0 && (
        <>
          <h4>🌀 Portais e Masmorras</h4>
          <div className="city-index gates-index" style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'12px'}}>
            {data.gates.map(g => (
              <div key={g.id} style={{padding:'8px 10px',borderRadius:'10px',background:'rgba(11,25,40,0.7)',border:`1px solid ${g.color || '#38bdf8'}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <b style={{color:g.color,fontSize:'12px'}}>Portal Rank {g.rank} {g.isUnstable ? '🔥 [INSTÁVEL]' : ''}</b>
                  <span style={{fontSize:'10px',color:'#94a3b8'}}>Expira em: {g.expiresInMinutes}m</span>
                </div>
                <div style={{fontSize:'10px',color:'#cbd5e1',marginTop:'3px'}}>
                  {g.zoneName} • Nv. recomendado: {g.recommendedMinLevel}–{g.recommendedMaxLevel} • {g.floors} andares
                </div>
                <div style={{marginTop:'6px',display:'flex',gap:'6px'}}>
                  <button
                    type="button"
                    onClick={() => window.game?.setDestinationMarker(g)}
                    style={{padding:'4px 10px',fontSize:'10px',background:'rgba(56,189,248,0.25)',border:'1px solid #38bdf8',color:'#38bdf8',borderRadius:'6px',cursor:'pointer',fontWeight:'bold'}}
                  >
                    🎯 Marcar Destino
                  </button>
                  {hud.destinationMarker?.label?.includes(g.rank) && (
                    <button
                      type="button"
                      onClick={() => window.game?.clearDestinationMarker()}
                      style={{padding:'4px 8px',fontSize:'10px',background:'rgba(239,68,68,0.2)',border:'1px solid #ef4444',color:'#ef4444',borderRadius:'6px',cursor:'pointer'}}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      <h4>Cidades</h4>
      <div className="city-index">
        {[...(data.cities||[])].sort((a,b)=>(ZONES.find(z=>z.id===a.zoneId)?.min||0)-(ZONES.find(z=>z.id===b.zoneId)?.min||0)).map(c=>{
          const services=(data.services||[]).filter(s=>s.cityId===c.id),eco=CITY_ECONOMIES[c.id],zone=ZONES.find(z=>z.id===c.zoneId);
          return <div className={hud.currentCity===c.name?'current':''} key={c.id}>
            <i style={{background:c.accent}}/>
            <span>
              <b>{c.name}</b>
              <small><strong>Nv.{zone?.min||1}–{zone?.max||1}</strong> • {zone?.name} • {eco?.material||'Mercado regional'}</small>
              <em>{services.map(s=>s.role==='merchant'?'$':s.role==='blacksmith'?'⚒':s.role==='stable'?'♞':'!').join('  ')}</em>
            </span>
          </div>
        })}
      </div>
      <div className="map-tip">
        <kbd>M</kbd>
        <span>fecha/abre o mapa. Arraste com dedo ou mouse para navegar livremente.</span>
      </div>
    </aside>
  </div>
}

function drawPlayer(ctx,x,y,heading){
  ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI-heading);ctx.shadowColor='#38bdf8';ctx.shadowBlur=12;ctx.fillStyle='#38bdf8';ctx.strokeStyle='#ffffff';ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(0,-11);ctx.lineTo(6.5,7.5);ctx.lineTo(0,4.5);ctx.lineTo(-6.5,7.5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()
}
