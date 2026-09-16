import React, { useEffect, useRef, useState } from 'react'
import { ZONES } from '../game/config.js'

const zoneById=Object.fromEntries(ZONES.map(z=>[z.id,z]))
const hex=n=>`#${Number(n||0).toString(16).padStart(6,'0')}`

export default function MiniMap({hud,onOpenMap}){
  const canvasRef=useRef(null)
  const lastDrawRef=useRef(0)
  const [range,setRange]=useState(72)
  const data=hud.minimap

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas||!data)return
    const touch=window.matchMedia?.('(pointer: coarse)').matches||navigator.maxTouchPoints>0,now=performance.now(),minFrame=touch?100:50
    if(now-lastDrawRef.current<minFrame)return;lastDrawRef.current=now
    const rect=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,touch?1.25:1.75),W=Math.max(1,Math.round(rect.width*dpr)),H=Math.max(1,Math.round(rect.height*dpr))
    if(canvas.width!==W||canvas.height!==H){canvas.width=W;canvas.height=H}
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0)
    const w=rect.width,h=rect.height,cx=w/2,cy=h/2,scale=Math.min(w,h)/(range*2),px=data.player?.x||0,pz=data.player?.z||0
    const toMap=(x,z)=>[cx+(x-px)*scale,cy+(z-pz)*scale]
    const visible=(x,z,pad=12)=>Math.abs(x-px)<=range+pad&&Math.abs(z-pz)<=range+pad

    ctx.clearRect(0,0,w,h);ctx.save();roundRect(ctx,0,0,w,h,12);ctx.clip()
    ctx.fillStyle='#0d2228';ctx.fillRect(0,0,w,h)

    // Terrain comes from the same chunks that are currently streamed in the 3D world.
    for(const c of data.chunks||[]){
      const wx=c.cx*data.chunkSize,wz=c.cz*data.chunkSize,[x,y]=toMap(wx-data.chunkSize/2,wz-data.chunkSize/2),s=data.chunkSize*scale,zone=zoneById[c.zoneId]
      ctx.fillStyle=zone?hex(zone.ground):'#365244';ctx.fillRect(x,y,s+1,s+1)
      const grain=((Math.abs(c.cx*13+c.cz*7)%5)+1)/32;ctx.fillStyle=`rgba(255,255,255,${grain})`;ctx.fillRect(x,y,s+1,s+1)
      if(c.hasWater){ctx.fillStyle='rgba(47,143,188,.9)';ctx.fillRect(x+s*.07,y+s*.29,s*.86,s*.42);drawWaves(ctx,x+s*.09,y+s*.34,s*.82,s*.31)}
    }

    // Roads connect cities and make the minimap read like an actual RPG navigation map.
    ctx.lineCap='round';for(const road of data.roads||[]){const a=toMap(road.ax,road.az),b=toMap(road.bx,road.bz);ctx.strokeStyle='rgba(188,164,113,.92)';ctx.lineWidth=Math.max(2.4,4.2*scale);ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...b);ctx.stroke();ctx.strokeStyle='rgba(85,70,48,.25)';ctx.lineWidth=Math.max(.6,1.1*scale);ctx.stroke()}

    // Walled cities, central plaza and service buildings.
    for(const city of data.cities||[]){if(!visible(city.x,city.z,city.radius+15))continue;const [x,y]=toMap(city.x,city.z),rr=city.wallRadius*scale
      ctx.fillStyle='rgba(199,181,134,.2)';ctx.beginPath();ctx.arc(x,y,Math.max(5,(city.radius-2)*scale),0,Math.PI*2);ctx.fill()
      ctx.strokeStyle=city.accent||'#e3d491';ctx.lineWidth=Math.max(1.4,2.1*scale);ctx.setLineDash([Math.max(2,3*scale),Math.max(1,1.8*scale)]);ctx.beginPath();ctx.arc(x,y,rr,0,Math.PI*2);ctx.stroke();ctx.setLineDash([])
      ctx.fillStyle='rgba(207,187,139,.95)';ctx.beginPath();ctx.arc(x,y,7.5*scale,0,Math.PI*2);ctx.fill()
      // Simplified roofs so the minimap looks mapped instead of being a radar.
      const roofs=[[-.48,-.34],[-.48,.34],[.48,.34],[.5,-.36],[-.14,.57],[.16,-.57]];for(const [ox,oz] of roofs){ctx.fillStyle='#d9c8a1';ctx.strokeStyle='#68473e';ctx.lineWidth=.7;const bw=Math.max(2.5,5*scale),bh=Math.max(2,4*scale);ctx.fillRect(x+ox*city.radius*scale-bw/2,y+oz*city.radius*scale-bh/2,bw,bh);ctx.strokeRect(x+ox*city.radius*scale-bw/2,y+oz*city.radius*scale-bh/2,bw,bh)}
      if(range<=92){ctx.fillStyle='#f4ead0';ctx.font='800 7px Inter,sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.shadowColor='#000';ctx.shadowBlur=3;ctx.fillText(city.name,x,y-rr-3);ctx.shadowBlur=0}
    }

    // Services / quests.
    for(const n of data.npcs||[]){if(!visible(n.x,n.z))continue;const [x,y]=toMap(n.x,n.z),col=n.role==='merchant'?'#6ff0aa':n.role==='blacksmith'?'#ff805e':n.role==='stable'?'#7dd3fc':n.role==='pets'?'#f59e0b':'#ffd85e';marker(ctx,x,y,col,n.quest==='ready'?'!':n.role==='merchant'?'$':n.role==='blacksmith'?'⚒':n.role==='stable'?'♞':n.role==='pets'?'🐾':'!')}

    // Bosses & Mobs: Prominent pulsating red radar beacon for all active bosses
    const bossesList = (data.activeBosses || []).length > 0 ? data.activeBosses : (data.enemies || []).filter(e => e.boss)
    for(const b of bossesList){
      const [bx,by]=toMap(b.x,b.z)
      const inBounds = bx >= 8 && bx <= w - 8 && by >= 8 && by <= h - 8
      if(inBounds){
        drawBossRadar(ctx, bx, by, b.name || 'BOSS')
      } else {
        const dx = bx - cx, dy = by - cy, dist = Math.hypot(dx, dy)
        if(dist > 0 && dist < Math.min(w, h) * 2.2){
          const edgeR = Math.min(w, h) * 0.44
          const ex = cx + (dx / dist) * edgeR, ey = cy + (dy / dist) * edgeR
          drawBossRadar(ctx, ex, ey, '★')
        }
      }
    }

    for(const e of data.enemies||[]){
      if(e.boss || !visible(e.x,e.z))continue
      const [x,y]=toMap(e.x,e.z)
      ctx.fillStyle='#e84452';ctx.strokeStyle='#44151b';ctx.lineWidth=.8;ctx.beginPath();ctx.arc(x,y,2.6,0,Math.PI*2);ctx.fill();ctx.stroke()
    }

    // AI adventurers: blue when neutral, orange when hostile to the player.
    for(const a of data.adventurers||[]){if(!visible(a.x,a.z))continue;const [x,y]=toMap(a.x,a.z);ctx.fillStyle=a.hostile?'#ff9b45':'#4fc3ff';ctx.strokeStyle='#071722';ctx.lineWidth=1;ctx.beginPath();ctx.arc(x,y,3.2,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#eaffff';ctx.font='800 6px Inter,sans-serif';ctx.textAlign='center';ctx.fillText('A',x,y+1.8)}

    // Dungeon portals.
    for(const p of data.portals||[]){if(!visible(p.x,p.z))continue;const [x,y]=toMap(p.x,p.z);ctx.strokeStyle=p.color||'#b56cff';ctx.lineWidth=2.2;ctx.shadowColor=p.color||'#b56cff';ctx.shadowBlur=5;ctx.beginPath();ctx.arc(x,y,5.4,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(x,y,2.2,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0}

    // Global Solo-Leveling style Gates with Rank badge letter and colored ring
    for(const g of data.gates||[]){
      const [x,y]=toMap(g.x,g.z)
      const inBounds = x >= 10 && x <= w - 10 && y >= 10 && y <= h - 10
      const col = g.color || '#38bdf8'
      if(inBounds){
        ctx.strokeStyle=col;ctx.shadowColor=col;ctx.shadowBlur=8;ctx.lineWidth=2.4
        ctx.beginPath();ctx.arc(x,y,6.5,0,Math.PI*2);ctx.stroke()
        ctx.fillStyle='rgba(7,15,27,.9)';ctx.beginPath();ctx.arc(x,y,4.8,0,Math.PI*2);ctx.fill()
        ctx.fillStyle=col;ctx.font='900 7px Inter,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle'
        ctx.fillText(g.rank||'C',x,y)
        ctx.shadowBlur=0
      } else {
        // Edge beacon pointer for gates
        const dx = x - cx, dy = y - cy, dist = Math.hypot(dx, dy)
        if(dist > 0 && dist < Math.min(w, h) * 3){
          const edgeR = Math.min(w, h) * 0.44
          const ex = cx + (dx / dist) * edgeR, ey = cy + (dy / dist) * edgeR
          ctx.fillStyle=col;ctx.beginPath();ctx.arc(ex,ey,4,0,Math.PI*2);ctx.fill()
          ctx.fillStyle='#ffffff';ctx.font='900 6px Inter,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle'
          ctx.fillText(g.rank||'C',ex,ey)
        }
      }
    }

    // Living Caravans
    for (const c of data.caravans || []) {
      const [x, y] = toMap(c.x, c.z)
      const inBounds = x >= 10 && x <= w - 10 && y >= 10 && y <= h - 10
      if (inBounds) {
        ctx.fillStyle = c.color || '#f59e0b'
        ctx.font = '900 10px Inter,sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(c.icon || '🚚', x, y)
      }
    }

    // Destination Marker (Marcar Destino)
    if(hud.destinationMarker){
      const [dx,dy]=toMap(hud.destinationMarker.x,hud.destinationMarker.z)
      const inBounds = dx >= 10 && dx <= w - 10 && dy >= 10 && dy <= h - 10
      const col = hud.destinationMarker.color || '#38bdf8'
      if(inBounds){
        ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.fillStyle=col
        ctx.beginPath();ctx.arc(dx,dy,5,0,Math.PI*2);ctx.fill();ctx.stroke()
      } else {
        const offX = dx - cx, offY = dy - cy, d = Math.hypot(offX, offY)
        if(d > 0){
          const edgeR = Math.min(w, h) * 0.45
          const ex = cx + (offX / d) * edgeR, ey = cy + (offY / d) * edgeR
          ctx.fillStyle='#38bdf8';ctx.beginPath();ctx.arc(ex,ey,4.5,0,Math.PI*2);ctx.fill()
        }
      }
    }

    // Remote Online Players (Multiplayer)
    for(const rp of data.players || []){
      const [rx, ry] = toMap(rp.x, rp.z)
      const inBounds = rx >= 8 && rx <= w - 8 && ry >= 8 && ry <= h - 8
      if(inBounds){
        ctx.save()
        ctx.fillStyle = '#10b981'
        ctx.shadowColor = '#10b981'
        ctx.shadowBlur = 8
        ctx.beginPath(); ctx.arc(rx, ry, 4.2, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.stroke()
        ctx.fillStyle = '#ffffff'; ctx.font = '800 7px Inter,sans-serif'; ctx.textAlign = 'center'
        ctx.shadowColor = '#000000'; ctx.shadowBlur = 3
        ctx.fillText(rp.name || 'Jogador', rx, ry - 6)
        ctx.restore()
      } else {
        const offX = rx - cx, offY = ry - cy, d = Math.hypot(offX, offY)
        if(d > 0 && d < Math.min(w, h) * 2.8){
          const edgeR = Math.min(w, h) * 0.44
          const ex = cx + (offX / d) * edgeR, ey = cy + (offY / d) * edgeR
          ctx.fillStyle = '#10b981'
          ctx.beginPath(); ctx.arc(ex, ey, 3.8, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = '#ffffff'; ctx.font = '900 6px Inter,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText('P', ex, ey)
        }
      }
    }

    // Landmarks discovered near the player.
    for(const l of data.landmarks||[]){if(!visible(l.x,l.z))continue;const [x,y]=toMap(l.x,l.z);ctx.fillStyle='#f4d77b';ctx.strokeStyle='#49391f';ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<8;i++){const a=-Math.PI/2+i*Math.PI/4,r=i%2?2.4:5.2,px=x+Math.cos(a)*r,py=y+Math.sin(a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath();ctx.fill();ctx.stroke()}

    // Player stays in center; arrow shows actual facing direction.
    drawPlayer(ctx,cx,cy,data.player?.heading||0);ctx.restore()
    ctx.strokeStyle='rgba(129,213,235,.42)';ctx.lineWidth=1;roundRect(ctx,.5,.5,w-1,h-1,12);ctx.stroke()
    ctx.fillStyle='rgba(225,248,255,.92)';ctx.font='800 8px Inter,sans-serif';ctx.textAlign='center';ctx.fillText('N',cx,11)
    ctx.fillStyle='rgba(220,239,245,.72)';ctx.font='600 7px Inter,sans-serif';ctx.textAlign='left';ctx.fillText(`X ${Math.round(px)}  Z ${Math.round(pz)}`,7,h-7)
    ctx.textAlign='right';ctx.fillText(`${Math.round(range)}m`,w-7,h-7)
  },[data,range,hud.destinationMarker])

  return <div className="minimap glass">
    <div className="mini-header"><b>MAPA LOCAL</b><span>{hud.currentCity||hud.zone}</span></div>
    <div className="mini-map-shell" onDoubleClick={onOpenMap} title="Duplo clique para abrir o mapa-múndi">
      <canvas ref={canvasRef} className="mini-canvas"/>
      <div className="mini-zoom"><button onClick={e=>{e.stopPropagation();setRange(v=>Math.max(38,v-14))}}>+</button><button onClick={e=>{e.stopPropagation();setRange(v=>Math.min(150,v+14))}}>−</button></div>
      <button className="mini-open" onClick={e=>{e.stopPropagation();onOpenMap?.()}}>M • MAPA</button>
    </div>
    <div className="mini-legend"><span><i className="dot boss" style={{background:'#ff1a3c',boxShadow:'0 0 6px #ff1a3c'}}/>Boss</span><span><i className="dot enemy"/>Mob</span><span><i className="dot service"/>Serviço</span><span><i className="dot portal" style={{background:'#c084fc'}}/>Portal</span><span><i className="dot landmark"/>Local</span></div>
  </div>
}

function drawBossRadar(ctx,x,y,label){
  const pulse = (performance.now() % 1000) / 1000
  ctx.save()
  // Outer pulsing radar ring
  ctx.strokeStyle = `rgba(255, 30, 60, ${1 - pulse})`
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.arc(x, y, 6 + pulse * 14, 0, Math.PI * 2)
  ctx.stroke()

  // Inner solid glowing red dot
  ctx.shadowColor = '#ff1a3c'
  ctx.shadowBlur = 9
  ctx.fillStyle = '#ff1a3c'
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.arc(x, y, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.shadowBlur = 0

  if(label){
    ctx.fillStyle = '#ffe4e8'
    ctx.font = '900 8px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.shadowColor = '#000'
    ctx.shadowBlur = 4
    ctx.fillText(label.length > 8 ? '★ BOSS' : label, x, y - 8)
    ctx.shadowBlur = 0
  }
  ctx.restore()
}

function roundRect(ctx,x,y,w,h,r){const rr=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+rr,y);ctx.arcTo(x+w,y,x+w,y+h,rr);ctx.arcTo(x+w,y+h,x,y+h,rr);ctx.arcTo(x,y+h,x,y,rr);ctx.arcTo(x,y,x+w,y,rr);ctx.closePath()}
function drawWaves(ctx,x,y,w,h){ctx.strokeStyle='rgba(208,244,255,.26)';ctx.lineWidth=.7;for(let j=0;j<3;j++){ctx.beginPath();for(let i=0;i<=16;i++){const px=x+w*i/16,py=y+h*(j+1)/4+Math.sin(i*.8+j)*1.1;i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.stroke()}}
function marker(ctx,x,y,color,label){ctx.fillStyle='rgba(3,12,18,.88)';ctx.strokeStyle=color;ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(x,y,5.4,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=color;ctx.font='900 7px Inter,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,x,y+.3)}
function diamond(ctx,x,y,r,fill,stroke){ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);ctx.fillStyle=fill;ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.fillRect(-r/2,-r/2,r,r);ctx.strokeRect(-r/2,-r/2,r,r);ctx.restore()}
function drawPlayer(ctx,x,y,heading){ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI-heading);ctx.shadowColor='#fff';ctx.shadowBlur=9;ctx.fillStyle='#fff';ctx.strokeStyle='#102733';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,-8.5);ctx.lineTo(5.4,6.2);ctx.lineTo(0,3.7);ctx.lineTo(-5.4,6.2);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}
