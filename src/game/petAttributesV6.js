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
  game.__stagedPetAttrs=game.__stagedPetAttrs||{}

  game.allocatePetAttributes=(staged,petId=null)=>{
    const pet=(game.state?.pets?.owned||[]).find(p=>p.id===(petId||game.state.pets.activeId))||game.activePet?.()
    if(!pet||!staged)return false
    normalize(pet)
    const total=(Number(staged.strength)||0)+(Number(staged.vitality)||0)+(Number(staged.agility)||0)+(Number(staged.spirit)||0)
    if(total<=0)return false
    if(total>(Number(pet.attributePoints)||0)){game.toast?.('Pontos insuficientes para esta distribuição.');return false}

    pet.attributePoints-=total
    const lv=Math.max(1,Number(pet.level)||1)
    for(const key of ['strength','vitality','agility','spirit']){
      const pts=Math.max(0,Number(staged[key])||0)
      if(!pts)continue
      pet.attributes[key]=(Number(pet.attributes[key])||0)+pts
      if(key==='strength')pet.damage=Math.max(1,Number(pet.damage)||1)+pts*Math.max(2,Math.round(2+lv*.04))
      if(key==='vitality'){
        const add=pts*Math.max(10,Math.round(9+lv*.25))
        pet.maxHp=Math.max(1,Number(pet.maxHp)||1)+add
        pet.hp=Math.min(pet.maxHp,(Number(pet.hp)||0)+add)
      }
      if(key==='spirit'){
        pet.damage=Math.max(1,Number(pet.damage)||1)+pts*1
        const add=pts*4
        pet.maxHp=Math.max(1,Number(pet.maxHp)||1)+add
        pet.hp=Math.min(pet.maxHp,(Number(pet.hp)||0)+add)
        pet.specialPowerBonus=(Number(pet.specialPowerBonus)||0)+pts*.04
      }
    }
    game.__stagedPetAttrs[pet.id]={strength:0,vitality:0,agility:0,spirit:0}
    save(game)
    game.toast?.(`🐾 Atributos de ${pet.name} confirmados com sucesso! (+${total} pontos)`)
    return true
  }

  game.upgradePetAttribute=(key,petId=null)=>{
    return game.allocatePetAttributes?.({[key]:1},petId)
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
  normalize(pet)
  game.__stagedPetAttrs=game.__stagedPetAttrs||{}
  if(!game.__stagedPetAttrs[pet.id])game.__stagedPetAttrs[pet.id]={strength:0,vitality:0,agility:0,spirit:0}
  const staged=game.__stagedPetAttrs[pet.id]
  const a=pet.attributes||{}
  const stagedTotal=(staged.strength||0)+(staged.vitality||0)+(staged.agility||0)+(staged.spirit||0)
  const remaining=Math.max(0,(Number(pet.attributePoints)||0)-stagedTotal)

  const lv=Math.max(1,Number(pet.level)||1)
  const addDmg=(staged.strength||0)*Math.max(2,Math.round(2+lv*.04))+(staged.spirit||0)*1
  const addHp=(staged.vitality||0)*Math.max(10,Math.round(9+lv*.25))+(staged.spirit||0)*4
  const previewDmg=Math.round(pet.damage)+addDmg
  const previewHp=Math.round(pet.hp)+addHp
  const previewMaxHp=Math.round(pet.maxHp)+addHp

  const sig=`${pet.id}|${pet.level}|${pet.attributePoints}|${a.strength}|${a.vitality}|${a.agility}|${a.spirit}|${staged.strength}|${staged.vitality}|${staged.agility}|${staged.spirit}|${pet.hp}|${pet.maxHp}|${pet.damage}`
  if(panel.dataset.sig===sig)return
  panel.dataset.sig=sig

  const row=(key,label,desc,baseVal)=>{
    const extra=staged[key]||0
    return `<article style="padding:12px;border:1px solid rgba(148,163,184,.25);border-radius:10px;background:rgba(15,23,42,.62);display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center">
      <div>
        <b style="color:#fff">${label} • ${baseVal}${extra>0?` <span style="color:#a855f7;font-weight:900;text-shadow:0 0 8px rgba(168,85,247,.4)">(+${extra})</span>`:''}</b>
        <div style="font-size:11px;color:#94a3b8;margin-top:3px">${desc}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px">
        <button type="button" data-pet-attr-dec="${key}" style="border:1px solid rgba(239,68,68,.4);background:rgba(239,68,68,.16);color:#fecaca;border-radius:8px;padding:7px 11px;font-weight:900;cursor:${extra>0?'pointer':'not-allowed'};opacity:${extra>0?'1':'.38'}" ${extra>0?'':'disabled'}>−1</button>
        <button type="button" data-pet-attr-inc="${key}" style="border:1px solid #8b5cf6;background:rgba(124,58,237,.25);color:#ede9fe;border-radius:8px;padding:7px 12px;font-weight:900;cursor:${remaining>0?'pointer':'not-allowed'};opacity:${remaining>0?'1':'.38'}" ${remaining>0?'':'disabled'}>+1</button>
      </div>
    </article>`
  }

  panel.innerHTML=`<section style="padding:14px">
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px">
      <div>
        <small style="color:#a78bfa;font-weight:900;letter-spacing:.05em">EVOLUÇÃO DE ATRIBUTOS</small>
        <h3 style="margin:4px 0;color:#fff">🐾 ${pet.name} • Nv.${pet.level}</h3>
        <div style="color:#cbd5e1;font-size:12px">
          HP ${previewHp}/${previewMaxHp}${addHp>0?` <b style="color:#4ade80">(+${addHp})</b>`:''} • Dano ${previewDmg}${addDmg>0?` <b style="color:#4ade80">(+${addDmg})</b>`:''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <div style="padding:9px 13px;border-radius:10px;background:rgba(168,85,247,.2);border:1px solid rgba(168,85,247,.45);color:#e9d5ff;font-weight:900">
          ${remaining} ponto(s) disponíveis
        </div>
        ${stagedTotal>0?`<span style="font-size:11px;color:#fde047;font-weight:800">Pendente: +${stagedTotal}</span>`:''}
      </div>
    </div>

    <div style="display:grid;gap:9px">
      ${row('strength','⚔ Força','Aumenta diretamente o dano do pet.',a.strength||0)}
      ${row('vitality','❤ Vitalidade','Aumenta HP máximo e cura o valor ganho.',a.vitality||0)}
      ${row('agility','⚡ Agilidade','Acelera os ataques em 2,5% por ponto.',a.agility||0)}
      ${row('spirit','✨ Espírito','Fortalece dano, HP e o poder especial.',a.spirit||0)}
    </div>

    <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(148,163,184,.18);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <button type="button" data-pet-action="clear" style="padding:8px 14px;border-radius:8px;border:1px solid rgba(148,163,184,.3);background:rgba(15,23,42,.6);color:#94a3b8;font-weight:700;cursor:${stagedTotal>0?'pointer':'not-allowed'};opacity:${stagedTotal>0?'1':'.4'}" ${stagedTotal>0?'':'disabled'}>✕ Cancelar</button>
      <button type="button" data-pet-action="confirm" style="flex:1;min-width:180px;padding:10px 16px;border-radius:9px;border:1px solid #c084fc;background:linear-gradient(135deg,#7c3aed,#9333ea);color:#fff;font-weight:900;box-shadow:${stagedTotal>0?'0 4px 14px rgba(147,51,234,.4)':'none'};cursor:${stagedTotal>0?'pointer':'not-allowed'};opacity:${stagedTotal>0?'1':'.4'}" ${stagedTotal>0?'':'disabled'}>✔ Confirmar Atributos (+${stagedTotal})</button>
    </div>

    <p style="font-size:11px;color:#94a3b8;margin-top:10px;margin-bottom:0">Distribua com +1 ou diminua com −1. Clique em <b>Confirmar Atributos</b> para salvar.</p>
  </section>`

  for(const b of panel.querySelectorAll('[data-pet-attr-inc]')){
    b.addEventListener('click',()=>{
      const key=b.dataset.petAttrInc
      if(remaining<=0)return
      staged[key]=(staged[key]||0)+1
      render(game,panel)
    })
  }

  for(const b of panel.querySelectorAll('[data-pet-attr-dec]')){
    b.addEventListener('click',()=>{
      const key=b.dataset.petAttrDec
      if((staged[key]||0)<=0)return
      staged[key]=Math.max(0,(staged[key]||0)-1)
      render(game,panel)
    })
  }

  const clearBtn=panel.querySelector('[data-pet-action="clear"]')
  if(clearBtn)clearBtn.addEventListener('click',()=>{
    game.__stagedPetAttrs[pet.id]={strength:0,vitality:0,agility:0,spirit:0}
    render(game,panel)
  })

  const confirmBtn=panel.querySelector('[data-pet-action="confirm"]')
  if(confirmBtn)confirmBtn.addEventListener('click',()=>{
    if(stagedTotal<=0)return
    game.allocatePetAttributes?.(staged,pet.id)
    render(game,panel)
  })
}

function patchTabs(game){
  if(typeof document==='undefined'||game.state?.uiPanel!=='pets')return
  const root=document.querySelector('.stable-layout');if(!root)return
  let tabs=root.querySelector(':scope > .v6-pet-tabs'),attrs=root.querySelector(':scope > .v6-pet-attributes'),evo=root.querySelector(':scope > .v6-pet-evolution-tab')
  if(!tabs){
    tabs=document.createElement('div');tabs.className='v6-pet-tabs'
    tabs.innerHTML='<button type="button" data-tab="pets" class="v6-pet-tab-btn">🐾 Meus Pets</button><button type="button" data-tab="evo" class="v6-pet-tab-btn">🌟 Linha de Evolução</button><button type="button" data-tab="attrs" class="v6-pet-tab-btn">📈 Treinar Atributos</button>'
    root.insertBefore(tabs,root.firstChild)

    evo=document.createElement('div');evo.className='v6-pet-evolution-tab glass'
    evo.style.cssText='display:none;border-radius:14px;margin-top:6px'
    root.insertBefore(evo,tabs.nextSibling)

    attrs=document.createElement('div');attrs.className='v6-pet-attributes glass'
    attrs.style.cssText='display:none;border-radius:14px;margin-top:6px'
    root.insertBefore(attrs,evo.nextSibling)

    game.__v6PetTab=game.__v6PetTab||'pets'
    for(const b of tabs.querySelectorAll('[data-tab]')){
      b.addEventListener('click',()=>{
        game.__v6PetTab=b.dataset.tab
        patchTabs(game)
        if(game.__v6PetTab==='evo')game.renderPetEvolutionOverhaul?.()
      })
    }
  }

  const currentTab=game.__v6PetTab||'pets'
  if(evo)evo.style.display=currentTab==='evo'?'block':'none'
  if(attrs)attrs.style.display=currentTab==='attrs'?'block':'none'

  // Show catalog and taming cards only on the 'pets' tab
  for(const child of [...root.children]){
    if(child!==tabs&&child!==attrs&&child!==evo){
      child.style.display=currentTab==='pets'?'':'none'
    }
  }

  for(const b of tabs.querySelectorAll('[data-tab]')){
    const active=b.dataset.tab===currentTab
    b.classList.toggle('active',active)
    b.style.border=active?'1.5px solid #a855f7':'1px solid rgba(148,163,184,.32)'
    b.style.background=active?'linear-gradient(135deg,rgba(126,34,206,.45),rgba(88,28,135,.6))':'rgba(15,23,42,.65)'
    b.style.color=active?'#ffffff':'#cbd5e1'
  }

  if(currentTab==='attrs')render(game,attrs)
}

export function installPetAttributesV6(game){
  if(!game||game.__petAttributesV6)return false;game.__petAttributesV6=true;installAttributes(game)
  game.__v6PetAttrTimer=window.setInterval(()=>{for(const p of game.state?.pets?.owned||[])normalize(p);patchTabs(game)},280);return true
}
function ready(){if(typeof window==='undefined')return;const a=()=>{if(!window.game)return false;setTimeout(()=>installPetAttributesV6(window.game),1240);return true};if(a())return;const t=setInterval(()=>{if(a())clearInterval(t)},100);setTimeout(()=>clearInterval(t),60000)}
ready()
