import { WORLD, ZONES } from './config.js'
import { hash2, zoneAt } from './utils.js'

const toRgb=n=>({r:(n>>16)&255,g:(n>>8)&255,b:n&255})
const clamp8=v=>Math.max(0,Math.min(255,Math.round(v)))
const rgbToCss=({r,g,b})=>`rgb(${clamp8(r)},${clamp8(g)},${clamp8(b)})`
const shade=(hex,amount)=>{const c=toRgb(hex);return rgbToCss({r:c.r+amount,g:c.g+amount,b:c.b+amount})}
const terrainCache=new Map()

export function mapCellKey(x,z,cellSize=WORLD.mapCellSize){return `${Math.round(x/cellSize)},${Math.round(z/cellSize)}`}

export function isWaterAt(x,z){
  const zone=zoneAt(x,z,ZONES),cx=Math.floor(x/WORLD.chunkSize),cz=Math.floor(z/WORLD.chunkSize),localX=((x-cx*WORLD.chunkSize)/WORLD.chunkSize+.5)%1,localZ=((z-cz*WORLD.chunkSize)/WORLD.chunkSize+.5)%1
  if(zone.id==='coast'){
    // The coast follows the V0.6 4x world scale instead of using the old V0.5 coordinate.
    const shoreline=292*WORLD.worldScale+Math.sin(x*.009)*42+Math.sin(x*.023)*18
    if(z>shoreline)return true
    if(hash2(cx,cz)>.74&&localZ>.58&&localX>.08&&localX<.92)return true
  }
  if(hash2(cx,cz)>.955&&localX>.13&&localX<.87&&localZ>.31&&localZ<.72)return true
  return false
}

export function sampleMapTerrain(x,z){
  const zone=zoneAt(x,z,ZONES),water=isWaterAt(x,z)
  if(water){const n=hash2(Math.floor(x/10),Math.floor(z/10));return {zone,water:true,color:n>.52?'#3b91c5':'#337fb4'}}
  const n1=hash2(Math.floor(x/16),Math.floor(z/16)),n2=hash2(Math.floor(x/38)+71,Math.floor(z/38)-19),n3=hash2(Math.floor(x/7)-33,Math.floor(z/7)+91),variation=(n1-.5)*24+(n2-.5)*13
  let add=variation,color=null,feature='ground'
  if(zone.id==='meadow'&&n3>.89){color=n3>.96?'#e6d66e':'#91bc61';feature='flowers'}
  if(zone.id==='forest'){add-=8;if(n3>.74){color=n3>.91?'#1f3f2d':'#294f36';feature='canopy'}}
  if(zone.id==='coast'){add+=4;if(n3>.82){color='#d8cb91';feature='sand'}}
  if(zone.id==='highlands'){add+=6;if(n3>.68){color=n3>.92?'#d6dbd4':'#7f897f';feature='rock'}}
  if(zone.id==='ember'){add-=4;if(n3>.86){color=n3>.95?'#e7652d':'#a94b31';feature='lava'}}
  if(zone.id==='void'){add-=12;if(n3>.76){color=n3>.93?'#6c568d':'#44395c';feature='void'}}
  if(zone.id==='crown'){add+=15;if(n3>.62){color=n3>.9?'#eef5f8':'#b9c7d2';feature='snow'}}
  return {zone,water:false,color:color||shade(zone.ground,add),noise:n1,feature}
}

function buildTerrainCanvas(limit,step){
  if(typeof document==='undefined')return null
  const key=`${limit}:${step}`,cached=terrainCache.get(key);if(cached)return cached
  const cols=Math.ceil(limit*2/step),rows=cols,off=document.createElement('canvas');off.width=cols;off.height=rows
  const c=off.getContext('2d'),img=c.createImageData(cols,rows),data=img.data
  for(let py=0;py<rows;py++)for(let px=0;px<cols;px++){
    const wx=-limit+(px+.5)*step,wz=-limit+(py+.5)*step,{color}=sampleMapTerrain(wx,wz),m=color.match(/\d+/g);let r=0,g=0,b=0
    if(color.startsWith('#')){const n=parseInt(color.slice(1),16);r=(n>>16)&255;g=(n>>8)&255;b=n&255}else if(m){r=+m[0];g=+m[1];b=+m[2]}
    const i=(py*cols+px)*4;data[i]=r;data[i+1]=g;data[i+2]=b;data[i+3]=255
  }
  c.putImageData(img,0,0);const result={canvas:off,cols,rows};terrainCache.set(key,result);return result
}

export function drawPixelWorld(ctx,width,height,{limit=WORLD.worldLimit,step=5,discovered=null,fog=true,zoom=1,centerX=0,centerZ=0}={}){
  const base=buildTerrainCanvas(limit,step);if(!base)return
  zoom=Math.max(1,Math.min(4,Number(zoom)||1));const viewWorld=limit*2/zoom,half=viewWorld/2
  centerX=Math.max(-limit+half,Math.min(limit-half,Number(centerX)||0));centerZ=Math.max(-limit+half,Math.min(limit-half,Number(centerZ)||0))
  const sx=(centerX-half+limit)/(limit*2)*base.cols,sy=(centerZ-half+limit)/(limit*2)*base.rows,sw=base.cols/zoom,sh=base.rows/zoom
  ctx.imageSmoothingEnabled=false;ctx.drawImage(base.canvas,sx,sy,sw,sh,0,0,width,height)
  if(!fog)return
  const discoveredSet=discovered instanceof Set?discovered:new Set(discovered||[]);if(!discoveredSet.size)return
  const fogCanvas=document.createElement('canvas');fogCanvas.width=Math.max(1,Math.round(width));fogCanvas.height=Math.max(1,Math.round(height));const f=fogCanvas.getContext('2d')
  f.fillStyle='rgba(1,5,10,.72)';f.fillRect(0,0,fogCanvas.width,fogCanvas.height);f.globalCompositeOperation='destination-out'
  const toView=(wx,wz)=>[(wx-(centerX-half))/viewWorld*fogCanvas.width,(wz-(centerZ-half))/viewWorld*fogCanvas.height],cellPxX=WORLD.mapCellSize/viewWorld*fogCanvas.width,cellPxY=WORLD.mapCellSize/viewWorld*fogCanvas.height
  for(const key of discoveredSet){const [cx,cz]=key.split(',').map(Number);if(!Number.isFinite(cx)||!Number.isFinite(cz))continue;const [x,y]=toView(cx*WORLD.mapCellSize,cz*WORLD.mapCellSize);if(x<-cellPxX||x>fogCanvas.width+cellPxX||y<-cellPxY||y>fogCanvas.height+cellPxY)continue;f.fillRect(x-cellPxX*.72,y-cellPxY*.72,cellPxX*1.44,cellPxY*1.44)}
  f.globalCompositeOperation='source-over';ctx.drawImage(fogCanvas,0,0,width,height)
}
