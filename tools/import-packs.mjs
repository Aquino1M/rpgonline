import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname=path.dirname(fileURLToPath(import.meta.url))
const project=path.resolve(__dirname,'..')
const requested=process.argv.slice(2).filter(Boolean)
const sourceCandidates=requested.length?requested:[path.join(project,'PACK'),path.join(project,'PACK2')]
const sources=sourceCandidates.map(p=>path.resolve(p)).filter(p=>fs.existsSync(p)&&fs.statSync(p).isDirectory())
const out=path.join(project,'public','models','packs')
const manifest={
  generatedAt:new Date().toISOString(),
  sources:sources.map(s=>path.basename(s)),
  playerPolicy:'LOCKED - PACK/PACK2 never replace the playable character',
  mobs:[],
  scenery:[],
  ignoredCharacters:[],
  ignored:[],
}

if(!sources.length){
  console.error('[PACKS] Nenhuma pasta PACK/PACK2 encontrada.')
  console.error('[PACKS] Procurado em:')
  for(const p of sourceCandidates)console.error(`  - ${path.resolve(p)}`)
  process.exit(2)
}

fs.rmSync(out,{recursive:true,force:true})
fs.mkdirSync(out,{recursive:true})

const slug=s=>s.normalize('NFKD').replace(/[^\w.-]+/g,'_').replace(/_+/g,'_')
const allFiles=[]
for(const source of sources){
  const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name);e.isDirectory()?walk(p):allFiles.push({source,file:p})}}
  walk(source)
}

const mobRe=/mob|monster|enemy|creature|beast|animal|zombie|slime|wolf|lobo|dragon|dragao|drag[aã]o|orc|goblin|spider|aranha|boar|javali|golem|harpy|harpia|serpent|serpente|crab|caranguejo|scorpion|escorpiao|mimic|m[ií]mico|treant|boss|demon|dem[oô]nio|skeleton|esqueleto|undead|morto|crow|corvo|deer|cervo|raposa|fox|beetle|besouro|leviathan|leviat[aã]|sentinel|sentinela/i
const playableRe=/player|playable|hero|heroi|her[oó]i|main.?character|personagem.?jog[aá]vel|avatar|protagonist|protagonista|adventurer|aventureiro|knight|cavaleiro|warrior|guerreiro|human|humano|male|female/i
const npcRe=/npc|merchant|mercador|blacksmith|ferreiro|villager|aldeao|alde[aã]o|civilian|citizen|cidad[aã]o/i

function sceneryKind(low){
  if(/tree|arvore|[aá]rvore|bush|arbusto|grass|grama|plant|planta|flower|flor|vegetation|foliage/.test(low))return'nature'
  if(/rock|stone|pedra|cliff|rocha|boulder|crystal|cristal/.test(low))return'rock'
  if(/house|casa|building|predio|pr[eé]dio|hut|cabana|shop|loja|forge|forja|inn|tavern|taverna|market|mercado/.test(low))return'building'
  if(/wall|muralha|fence|cerca|gate|portao|port[aã]o|tower|torre|castle|castelo|fortress|fortaleza/.test(low))return'fortification'
  if(/ruin|ruina|ru[ií]na|temple|templo|shrine|santuario|santu[aá]rio|altar|obelisk|obelisco/.test(low))return'ruin'
  if(/bridge|ponte|road|estrada|path|caminho/.test(low))return'road'
  if(/barrel|barril|crate|caixa|cart|carroca|lamp|poste|bench|banco|well|poco|po[cç]o|prop/.test(low))return'prop'
  if(/water|agua|[aá]gua|boat|barco|dock|porto|ship|navio/.test(low))return'coast'
  return'generic'
}

function mobTags(low){
  const tags=[]
  const table=[
    ['wolf',/wolf|lobo/],['dragon',/dragon|dragao|drag[aã]o/],['slime',/slime/],['boar',/boar|javali/],['golem',/golem/],
    ['spider',/spider|aranha/],['undead',/zombie|undead|skeleton|esqueleto|morto/],['orc',/orc/],['goblin',/goblin/],
    ['bird',/bird|crow|corvo|harpy|harpia|eagle|aguia|[aá]guia|roc/],['beast',/beast|fera|animal|deer|cervo|fox|raposa|goat|bode/],
    ['insect',/beetle|besouro|scorpion|escorpiao|escorpi[aã]o/],['sea',/crab|caranguejo|serpent|serpente|fish|peixe|leviathan|leviat/],
    ['treant',/treant|tree.?monster|ent/],['mimic',/mimic|m[ií]mico/],['knight',/hollow.?knight|dark.?knight|enemy.?knight/],
    ['boss',/boss|giant|gigante|coloss|colosso|king|rei|queen|rainha|lord|soberano|archon|arconte/],
    ['fire',/fire|flame|lava|magma|ember|brasa|rubro|inferno/],['ice',/ice|frost|snow|gelo|neve/],['void',/void|shadow|dark|umbral|abiss|abyss/],
    ['celestial',/angel|seraph|seraf|celestial|holy|santo|sagrada|sagrado/],['forest',/forest|wood|moss|musgo|nature|floresta|cinereo|cin[eé]reo/],
  ]
  for(const [tag,re] of table)if(re.test(low))tags.push(tag)
  return tags
}

function sceneryTags(low,kind){
  const tags=[kind]
  const table=[['forest',/forest|wood|moss|musgo|cinereo|cin[eé]reo|green|verde/],['coast',/coast|beach|sea|ocean|safira|porto|mar/],['highlands',/mountain|highland|cliff|veyra|montanha/],['ember',/lava|magma|fire|ash|cinza|rubro|ember/],['void',/void|shadow|umbral|dark|noctis/],['crown',/celestial|sky|cloud|heaven|celeste|ruin/],['meadow',/meadow|field|grass|lumen|l[uú]men|pradaria/],['aurora',/aurora|village|city|medieval|cidade|vila/]]
  for(const [tag,re] of table)if(re.test(low))tags.push(tag)
  return [...new Set(tags)]
}

let index=0
for(const {source,file} of allFiles){
  const ext=path.extname(file).toLowerCase()
  const rel=path.relative(source,file).replaceAll('\\','/')
  const sourceName=path.basename(source)
  const low=`${sourceName}/${rel}`.toLowerCase()

  const browser3D=['.glb','.fbx','.dae']
  if(!browser3D.includes(ext)){
    if(['.gltf','.obj','.blend','.3ds'].includes(ext))manifest.ignored.push({source:sourceName,path:rel,reason:'formato não autocontido/suportado pelo importador automático; prefira GLB, FBX ou DAE'})
    continue
  }

  // Mobs are checked first so humanoid monsters such as enemy knights/orcs are still allowed.
  const isMob=mobRe.test(low)
  if(!isMob&&(playableRe.test(low)||npcRe.test(low))){
    manifest.ignoredCharacters.push({source:sourceName,path:rel,reason:'personagem/NPC ignorado por política: PACK/PACK2 só alteram mobs e cenário'})
    continue
  }

  const name=`${String(index++).padStart(4,'0')}_${slug(sourceName)}_${slug(path.basename(file))}`
  const dest=path.join(out,name)
  fs.copyFileSync(file,dest)
  const url=`/models/packs/${name}`

  if(isMob){
    const tags=mobTags(low)
    manifest.mobs.push({url,name:path.basename(file,path.extname(file)),source:sourceName,path:rel,tags,bossCandidate:tags.includes('boss')})
  }else{
    const kind=sceneryKind(low)
    manifest.scenery.push({url,name:path.basename(file,path.extname(file)),source:sourceName,path:rel,kind,tags:sceneryTags(low,kind)})
  }
}

fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2))
const report=[
  'PACK + PACK2 - Relatório de importação',
  `Fontes: ${manifest.sources.join(', ')||'nenhuma'}`,
  `Gerado: ${manifest.generatedAt}`,
  '',
  'POLÍTICA DO PLAYER: BLOQUEADO - nenhum asset de PACK/PACK2 altera o personagem jogável.',
  '',
  `Mobs importados: ${manifest.mobs.length}`,
  ...manifest.mobs.map(x=>`  - [${x.source}] ${x.path} -> ${x.tags.join(', ')||'mob'}`),
  '',
  `Cenário importado: ${manifest.scenery.length}`,
  ...manifest.scenery.map(x=>`  - [${x.source}] ${x.path} -> ${x.kind} / ${x.tags.join(', ')}`),
  '',
  `Personagens/NPCs ignorados: ${manifest.ignoredCharacters.length}`,
  ...manifest.ignoredCharacters.map(x=>`  - [${x.source}] ${x.path}`),
  '',
  `Outros ignorados / conversão necessária: ${manifest.ignored.length}`,
  ...manifest.ignored.map(x=>`  - [${x.source}] ${x.path}: ${x.reason}`),
].join('\n')
fs.writeFileSync(path.join(project,'PACKS_RELATORIO.txt'),report,'utf8')
console.log(`[PACKS] Fontes: ${manifest.sources.join(', ')}`)
console.log(`[PACKS] ${manifest.mobs.length} mobs + ${manifest.scenery.length} elementos de cenário importados.`)
console.log(`[PACKS] ${manifest.ignoredCharacters.length} personagens/NPCs ignorados de propósito. O player não é alterado.`)
if(manifest.ignored.length)console.log(`[PACKS] ${manifest.ignored.length} arquivos 3D precisam ser convertidos para GLB. Veja PACKS_RELATORIO.txt.`)
