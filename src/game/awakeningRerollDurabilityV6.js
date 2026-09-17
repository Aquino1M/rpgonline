import { CLASSES_LIST, rollDestinyClass } from './classesData.js'

const REROLL_GOLD_COST=6000
const save=game=>{game?.saveGame?.();game?.saveCloudGame?.()}

function consumeGrimoire(game,item){
  const list=game.state?.inventory||[]
  const index=list.indexOf(item)
  if(index<0)return false
  item.qty=Math.max(0,(Number(item.qty)||1)-1)
  if(item.qty<=0)list.splice(index,1)
  return true
}

function installReroll(game){
  game.rerollAwakeningClass=()=>{
    const state=game.state
    const grim=(state.inventory||[]).find(i=>i?.subtype==='grimoire'&&(Number(i.qty)||1)>0)
    if(!grim){game.toast?.('📖 Você precisa de 1 Grimório do Despertar para refazer o despertar.');return null}
    if((Number(state.gold)||0)<REROLL_GOLD_COST){game.toast?.('◈ Refazer o despertar custa 6.000 moedas + 1 Grimório.');return null}
    const oldId=state.classState?.activeClassId||'mercenary_swordsman'
    let result=null
    for(let i=0;i<12;i++){
      const rolled=rollDestinyClass();if(!result)result=rolled
      if(rolled?.cls?.id&&rolled.cls.id!==oldId){result=rolled;break}
    }
    const newId=result?.cls?.id
    if(!newId){game.toast?.('O Grimório não respondeu. Tente novamente.');return null}
    state.gold-=REROLL_GOLD_COST
    consumeGrimoire(game,grim)
    const cs=state.classState||(state.classState={})
    const unlocked=new Set(cs.unlockedClassIds||[]);unlocked.delete(oldId);unlocked.add(newId);cs.unlockedClassIds=[...unlocked]
    cs.classRanks=cs.classRanks||{};if(!cs.classRanks[newId])cs.classRanks[newId]=1
    cs.rollsCount=(Number(cs.rollsCount)||0)+1;cs.rerollCount=(Number(cs.rerollCount)||0)+1
    game.switchClass?.(newId);game.recalcStats?.();game.updateClassAura?.();save(game)
    const oldName=CLASSES_LIST.find(c=>c.id===oldId)?.name||'Classe anterior'
    const newName=result.cls?.name||CLASSES_LIST.find(c=>c.id===newId)?.name||'Nova classe'
    game.toast?.(`🔄 Despertar refeito: ${oldName} → ${newName}.`)
    game.showCenterAnnouncement?.('📖 NOVO DESPERTAR',`${newName} substituiu sua classe equipada!`)
    return result
  }
}

function installDurability(game){
  const old=game.upgrade?.bind(game);if(!old||game.__v6UpgradeWrapped)return;game.__v6UpgradeWrapped=true
  game.upgrade=slot=>{
    const item=game.state?.equipment?.[slot];if(!item)return false
    const oldUp=Number(item.upgrade)||0,oldMax=Math.max(0,Number(item.maxDurability)||0)
    const oldDur=Number.isFinite(Number(item.durability))?Number(item.durability):oldMax
    const result=old(slot)
    if(result!==true||Number(item.upgrade)<=oldUp)return result
    if(['weapon','armor','boots','talisman'].includes(item.type)&&oldMax>0){
      const gain=Math.max(6,Math.round(oldMax*.075+(Number(item.level)||1)*.45+(Number(item.upgrade)||1)*1.8))
      item.maxDurability=oldMax+gain;item.durability=Math.min(item.maxDurability,Math.max(0,oldDur)+gain);item.broken=item.durability<=0
      game.toast?.(`🔨 ${item.name} +${item.upgrade} • Durabilidade +${gain} (${Math.round(item.durability)}/${item.maxDurability})`)
    }
    save(game);return true
  }
}

function patchGrimoire(game){
  if(typeof document==='undefined'||game.state?.uiPanel!=='grimoire')return
  const roll=document.querySelector('.gacha-roll-btn');if(!roll||document.querySelector('.v6-reroll-awakening'))return
  const btn=document.createElement('button');btn.type='button';btn.className='gacha-roll-btn v6-reroll-awakening'
  btn.style.cssText='margin-top:8px;border-color:#a855f7;background:linear-gradient(135deg,rgba(126,34,206,.88),rgba(76,29,149,.92))'
  btn.textContent='🔄 Refazer Despertar • 1 Grimório + 6.000◈'
  btn.addEventListener('click',()=>{
    const grim=(game.state?.inventory||[]).find(i=>i?.subtype==='grimoire'&&(Number(i.qty)||1)>0)
    if(!grim||Number(game.state.gold)<REROLL_GOLD_COST){game.rerollAwakeningClass?.();return}
    const current=CLASSES_LIST.find(c=>c.id===game.state.classState?.activeClassId)?.name||'classe atual'
    if(window.confirm(`Refazer o Despertar?\n\n${current} será substituída pela nova classe equipada.\nCusto: 1 Grimório + 6.000◈.`))game.rerollAwakeningClass?.()
  })
  roll.insertAdjacentElement('afterend',btn)
}

export function installAwakeningRerollDurabilityV6(game){
  if(!game||game.__awakeningRerollDurabilityV6)return false;game.__awakeningRerollDurabilityV6=true
  installReroll(game);installDurability(game)
  game.__v6GrimoireTimer=window.setInterval(()=>patchGrimoire(game),300)
  return true
}

function ready(){if(typeof window==='undefined')return;const a=()=>{if(!window.game)return false;window.setTimeout(()=>installAwakeningRerollDurabilityV6(window.game),1120);return true};if(a())return;const t=setInterval(()=>{if(a())clearInterval(t)},100);setTimeout(()=>clearInterval(t),60000)}
ready()
