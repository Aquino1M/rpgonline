const perfNow=()=>typeof performance!=='undefined'?performance.now():Date.now()
const save=game=>{game?.saveGame?.();game?.saveCloudGame?.()}

function normalize(pet){
  if(!pet)return
  const level=Math.max(1,Math.round(Number(pet.level)||1))
  pet.attributes=pet.attributes||{strength:0,vitality:0,agility:0,spirit:0}
  for(const k of ['strength','vitality','agility','spirit'])pet.attributes[k]=Math.max(0,Math.floor(Number(pet.attributes[k])||0))
  if(!Number.isFinite(Number(pet.attributeGrantedLevel))){
    const spent=Object.values(pet.attributes).reduce((a,v)=>a+(Number(v)||0),0)
    pet.attributePoints=Math.max(Number(pet.attributePoints)||0,Math.max(0,level-1-spent));pet.attributeGrantedLevel=level
  }else if(level>pet.attributeGrantedLevel){
    pet.attributePoints=Math.max(0,Number(pet.attributePoints)||0)+(level-pet.attributeGrantedLevel);pet.attributeGrantedLevel=level
  }
  pet.attributePoints=Math.max(0,Math.floor(Number(pet.attributePoints)||0))
}

function installAttributes(game){
  for(const pet of game.state?.pets?.owned||[])normalize(pet)
  game.upgradePetAttribute=(key,petId=null)=>{
    const pet=(game.state?.pets?.owned||[]).find(p=>p.id===(petId||game.state.pets.activeId))||game.activePet?.()
    if(!pet)return false
    normalize(pet)
    if((Number(pet.attributePoints)||0)<1){game.toast?.('Seu pet não possui pontos de atributo disponíveis.');return false}
    if(!['strength','vitality','agility','spirit'].includes(key))return false
    pet.attributePoints-=1;pet.attributes[key]=(Number(pet.attributes[key])||0)+1
    const lv=Math.max(1,Number(pet.level)||1)
    if(key==='strength')pet.damage=Math.max(1,Number(pet.damage)||1)+Math.max(2,Math.round(2+lv*.04))
    if(key==='vitality'){
      const add=Math.max(10,Math.round(9+lv*.25));pet.maxHp=Math.max(1,Number(pet.maxHp)||1)+add;pet.hp=Math.min(pet.maxHp,(Number(pet.hp)||0)+add)
    }
    if(key==='spirit'){
      pet.damage=Math.max(1,Number(pet.damage)||1)+1;pet.maxHp=Math.max(1,Number(pet.maxHp)||1)+4;pet.hp=Math.min(pet.maxHp,(Number(pet.hp)||0)+4);pet.specialPowerBonus=(Number(pet.specialPowerBonus)||0)+.04
    }
    save(game)
    game.toast?.(`🐾 ${pet.name}: ${key==='strength'?'Força':key==='vitality'?'Vitalidade':key==='agility'?'Agilidade':'Espírito'} aumentou!`)
    return true
  }

  const old=game.updatePets?.bind(game)
  if(old&&!game.__v6PetAttributeCombat){game.__v6PetAttributeCombat=true;game.updatePets=dt=>{
    const beforePet=game.activePet?.();if(beforePet)normalize(beforePet)
    const before={next:Number(beforePet?.nextAttackAt)||0,v3:Number(beforePet?.v3NextAttackAt)||0,v4:Number(beforePet?.v4NextAttackAt)||0,special:Number(beforePet?.v4NextSpecialAt)||0}
    const target=game.petTarget,r=old(dt),pet=game.activePet?.();if(!pet)return r
    normalize(pet)
    const t=perfNow(),agi=Math.max(0,Number(pet.attributes?.agility)||0),speed=1+Math.min(.8,agi*.025)
    for(const [field,b] of [['nextAttackAt',before.next],['v3NextAttackAt',before.v3],['v4NextAttackAt',before.v4]]){
      const a=Number(pet[field])||0;if(a>b+100&&a>t)pet[field]=t+(a-t)/speed
    }
    const afterSpecial=Number(pet.v4NextSpecialAt)||0,spirit=Math.max(0,Number(pet.attributes?.spirit)||0)
    if(spirit>0&&afterSpecial>before.special+1000&&target&&!target.dead&&Number(target.hp)>0){
      const bonus=Math.max(1,Math.round((Number(pet.damage)||1)*spirit*.04));game.damageEnemy?.(target,bonus,{fromPet:true,knockback:.04})
    }
    return r
  }}
}

function render(game,panel){
  const pet=game.activePet?.();if(!pet){panel.innerHTML='<div style="padding:18px;color:#cbd5e1">Equipe um pet para evoluir os atributos dele.</div>';return}
  normalize(pet);const a=pet.attributes||{},sig=`${pet.id}|${pet.level}|${pet.attributePoints}|${a.strength}|${a.vitality}|${a.agility}|${a.spirit}|${pet.hp}|${pet.maxHp}|${pet.damage}`
  if(panel.dataset.sig===sig)return;panel.dataset.sig=sig
  const row=(key,label,desc,value)=>`<article style="padding:12px;border:1px solid rgba(148,163,184,.25);border-radius:10px;background:rgba(15,23,42,.55);display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center"><div><b style="color:#fff">${label} • ${value}</b><div style="font-size:11px;color:#94a3b8;margin-top:3px">${desc}</div></div><button data-pet-attr="${key}" style="border:1px solid #8b5cf6;background:rgba(124,58,237,.2);color:#ede9fe;border-radius:8px;padding:8px 12px;font-weight:900;cursor:pointer" ${pet.attributePoints<1?'disabled':''}>+1</button></article>`
  panel.innerHTML=`<section style="padding:14px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px"><div><small style="color:#a78bfa;font-weight:900">EVOLUÇÃO DE ATRIBUTOS</small><h3 style="margin:4px 0;color:#fff">🐾 ${pet.name} • Nv.${pet.level}</h3><div style="color:#cbd5e1;font-size:12px">HP ${Math.round(pet.hp)}/${Math.round(pet.maxHp)} • Dano ${Math.round(pet.damage)}</div></div><div style="padding:10px 14px;border-radius:10px;background:rgba(168,85,247,.16);color:#e9d5ff;font-weight:900">${pet.attributePoints} ponto(s)</div></div><div style="display:grid;gap:9px">${row('strength','⚔ Força','Aumenta diretamente o dano do pet.',a.strength||0)}${row('vitality','❤ Vitalidade','Aumenta HP máximo e cura o valor ganho.',a.vitality||0)}${row('agility','⚡ Agilidade','Acelera os ataques em 2,5% por ponto.',a.agility||0)}${row('spirit','✨ Espírito','Fortalece dano, HP e o poder especial.',a.spirit||0)}</div><p style="font-size:11px;color:#94a3b8;margin-top:12px">O pet recebe 1 ponto por nível. Pets antigos recebem pontos retroativos.</p></section>`
  for(const b of panel.querySelectorAll('[data-pet-attr]'))b.addEventListener('click',()=>game.upgradePetAttribute?.(b.dataset.petAttr,pet.id))
}

function patchTabs(game){
  if(typeof document==='undefined'||game.state?.uiPanel!=='pets')return
  const root=document.querySelector('.stable-layout');if(!root)return
  let tabs=root.querySelector(':scope > .v6-pet-tabs'),attrs=root.querySelector(':scope > .v6-pet-attributes')
  if(!tabs){
    tabs=document.createElement('div');tabs.className='v6-pet-tabs';tabs.style.cssText='display:flex;gap:8px;margin-bottom:10px';tabs.innerHTML='<button data-tab="pets" style="padding:9px 13px;border-radius:9px;font-weight:900">🐾 Companheiros</button><button data-tab="attrs" style="padding:9px 13px;border-radius:9px;font-weight:900">📈 Evoluir Atributos</button>';root.insertBefore(tabs,root.firstChild)
    attrs=document.createElement('div');attrs.className='v6-pet-attributes glass';attrs.style.cssText='display:none;border-radius:12px;margin-top:4px';root.insertBefore(attrs,tabs.nextSibling)
    game.__v6PetTab=game.__v6PetTab||'pets';for(const b of tabs.querySelectorAll('[data-tab]'))b.addEventListener('click',()=>{game.__v6PetTab=b.dataset.tab;patchTabs(game)})
  }
  const show=game.__v6PetTab==='attrs';attrs.style.display=show?'block':'none'
  for(const child of [...root.children])if(child!==tabs&&child!==attrs)child.style.display=show?'none':''
  for(const b of tabs.querySelectorAll('[data-tab]')){const active=b.dataset.tab===(show?'attrs':'pets');b.style.border=active?'1px solid #a855f7':'1px solid rgba(148,163,184,.35)';b.style.background=active?'rgba(126,34,206,.28)':'rgba(15,23,42,.5)';b.style.color=active?'#f3e8ff':'#cbd5e1'}
  if(show)render(game,attrs)
}

export function installPetAttributesV6(game){
  if(!game||game.__petAttributesV6)return false;game.__petAttributesV6=true;installAttributes(game)
  game.__v6PetAttrTimer=window.setInterval(()=>{for(const p of game.state?.pets?.owned||[])normalize(p);patchTabs(game)},280);return true
}
function ready(){if(typeof window==='undefined')return;const a=()=>{if(!window.game)return false;setTimeout(()=>installPetAttributesV6(window.game),1240);return true};if(a())return;const t=setInterval(()=>{if(a())clearInterval(t)},100);setTimeout(()=>clearInterval(t),60000)}
ready()
