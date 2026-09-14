export function hash2(x,z,seed=1337){
  let h = Math.imul((x|0) ^ seed, 374761393) ^ Math.imul((z|0) + seed, 668265263)
  h = Math.imul(h ^ (h>>>13), 1274126177)
  return ((h ^ (h>>>16)) >>> 0) / 4294967295
}
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v))
export const lerp=(a,b,t)=>a+(b-a)*t
export const damp=(a,b,lambda,dt)=>lerp(a,b,1-Math.exp(-lambda*dt))
export function zoneAt(x,z,zones){
  const direct=zones.find(q=>x>=q.x0&&x<=q.x1&&z>=q.z0&&z<=q.z1); if(direct)return direct
  let best=zones[0],dist=Infinity; for(const q of zones){const cx=(q.x0+q.x1)/2,cz=(q.z0+q.z1)/2,d=(x-cx)**2+(z-cz)**2;if(d<dist){dist=d;best=q}} return best
}
export function weightedPick(items, rnd=Math.random()){
  const total=items.reduce((a,b)=>a+b.weight,0); let t=rnd*total
  for(const it of items){ t-=it.weight; if(t<=0) return it }
  return items[0]
}
export const uid=(p='id')=>`${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`
export function fmtTime(hours){ const h=Math.floor(hours)%24; const m=Math.floor((hours-h)*60); return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}` }
