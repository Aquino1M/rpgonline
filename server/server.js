import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { WebSocketServer, WebSocket } from 'ws'

const __dirname=path.dirname(fileURLToPath(import.meta.url))
const rootDir=path.resolve(__dirname,'..')
const distDir=path.join(rootDir,'dist')
const dataDir=path.join(__dirname,'data')
const dbPath=path.join(dataDir,'players.json')
const args=parseArgs(process.argv.slice(2))
const host=args.host||process.env.HOST||'0.0.0.0'
const port=Number(args.port||process.env.PORT||8765)
const roomDefault='asterra-01'
const VERSION='0.9.9'
const MAX_PROFILE_BYTES=420000
const logsDir=path.join(rootDir,'logs')
fs.mkdirSync(logsDir,{recursive:true})
const runtimeLog=path.join(logsDir,`server-runtime-${new Date().toISOString().slice(0,10)}.log`)
const clientLog=path.join(logsDir,`client-errors-${new Date().toISOString().slice(0,10)}.log`)
function log(level,...parts){
  const text=parts.map(v=>v instanceof Error?(v.stack||v.message):typeof v==='string'?v:JSON.stringify(v)).join(' ')
  const line=`[${new Date().toISOString()}] [${level}] ${text}`
  try{fs.appendFileSync(runtimeLog,line+'\n','utf8')}catch{}
  const fn=level==='ERROR'||level==='FATAL'?console.error:level==='WARN'?console.warn:console.log
  fn(line)
}
process.on('uncaughtException',err=>log('FATAL','uncaughtException',err))
process.on('unhandledRejection',err=>log('FATAL','unhandledRejection',err))

fs.mkdirSync(dataDir,{recursive:true})
let database=loadDatabase()
let saveTimer=null

function parseArgs(argv){const out={};for(let i=0;i<argv.length;i++)if(argv[i].startsWith('--'))out[argv[i].slice(2)]=argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:true;return out}
function loadDatabase(){try{const raw=JSON.parse(fs.readFileSync(dbPath,'utf8'));const db=raw&&typeof raw==='object'?{version:1,players:raw.players||{}}:{version:1,players:{}};log('INFO',`Banco carregado: ${Object.keys(db.players).length} perfil(is)`);return db}catch(err){if(err?.code!=='ENOENT')log('WARN','Falha ao ler players.json; iniciando banco vazio:',err);return {version:1,players:{}}}}
function scheduleSave(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{try{const tmp=`${dbPath}.tmp`;fs.writeFileSync(tmp,JSON.stringify(database,null,2),'utf8');fs.renameSync(tmp,dbPath)}catch(err){log('ERROR','Falha ao salvar players.json:',err)}},250)}
function sanitizeName(value){const text=String(value||'Aventureiro').normalize('NFKC').replace(/[^\p{L}\p{N} _.\-]/gu,'').replace(/\s+/g,' ').trim();return (text||'Aventureiro').slice(0,24)}
function sanitizeId(value){const id=String(value||'').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,64);return id.length>=8?id:crypto.randomUUID()}
function safeNumber(v,fallback=0,min=-Infinity,max=Infinity){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback}
function publicPlayer(p){return{id:p.id,name:p.name,x:p.x,y:p.y||0,z:p.z,r:p.r,level:p.level,hp:p.hp,maxHp:p.maxHp,motion:p.motion||'idle',world:p.world||'open',guildRank:p.guildRank||'E',mountActive:!!p.mountActive,classId:p.classId||'mercenary_swordsman',seq:p.seq||0,partyId:p.partyId||null}}
function profileRecord(id){return database.players[id]||null}
function storeProfile(id,name,game,updatedAt=Date.now(),lastLobby=''){let serialized='';try{serialized=JSON.stringify(game||{})}catch{return false};if(Buffer.byteLength(serialized,'utf8')>MAX_PROFILE_BYTES)return false;const old=database.players[id]||{};const lobby=String(lastLobby||old.lastLobby||roomDefault).replace(/[^\w-]/g,'').slice(0,40)||roomDefault;database.players[id]={...old,id,name:sanitizeName(name||old.name),lastLobby:lobby,updatedAt:safeNumber(updatedAt,Date.now(),0,Date.now()+60000),lastSeen:Date.now(),game:JSON.parse(serialized)};scheduleSave();return true}

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml','.ico':'image/x-icon','.glb':'model/gltf-binary','.gltf':'model/gltf+json','.bin':'application/octet-stream','.woff2':'font/woff2'}
function sendJson(res,status,data){const body=JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(body),'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(body)}
function readJsonBody(req,maxBytes=65536){return new Promise((resolve,reject)=>{let size=0,parts=[];req.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){reject(new Error('payload_too_large'));req.destroy();return}parts.push(chunk)});req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(parts).toString('utf8')||'{}'))}catch(err){reject(err)}});req.on('error',reject)})}
function serveStatic(req,res){let url;try{url=new URL(req.url,'http://local')}catch{return sendJson(res,400,{error:'bad_request'})};
if(url.pathname==='/api/client-log'&&req.method==='POST'){readJsonBody(req).then(body=>{const safe={receivedAt:new Date().toISOString(),remote:req.socket?.remoteAddress||'',type:String(body.type||'client'),message:String(body.message||'').slice(0,4000),name:String(body.name||'').slice(0,120),stack:String(body.stack||'').slice(0,12000),url:String(body.url||'').slice(0,1000),source:String(body.source||'').slice(0,1000),line:Number(body.line)||0,column:Number(body.column)||0,viewport:body.viewport||null,touch:Number(body.touch)||0,online:body.online!==false,userAgent:String(body.userAgent||'').slice(0,1200)};try{fs.appendFileSync(clientLog,JSON.stringify(safe)+'\n','utf8')}catch(err){log('WARN','Falha ao gravar client log',err)};sendJson(res,200,{ok:true})}).catch(err=>{log('WARN','client-log invalido',err.message);if(!res.headersSent)sendJson(res,400,{ok:false,error:'bad_client_log'})});return}
if(url.pathname==='/api/status')return sendJson(res,200,{ok:true,name:'Shadow Ascension LAN',version:VERSION,players:[...wss.clients].filter(c=>c.readyState===WebSocket.OPEN).length,savedProfiles:Object.keys(database.players).length,uptimeSeconds:Math.round(process.uptime()),host,port,pid:process.pid,runtimeLog,clientLog,websocketPath:'/ws'});if(url.pathname==='/api/players')return sendJson(res,200,{players:[...wss.clients].filter(c=>c.readyState===WebSocket.OPEN&&c.player).map(c=>publicPlayer(c.player))});if(req.method!=='GET'&&req.method!=='HEAD')return sendJson(res,405,{error:'method_not_allowed'});let pathname=decodeURIComponent(url.pathname);if(pathname==='/'||!path.extname(pathname))pathname=pathname==='/'?'/index.html':pathname;let file=path.resolve(distDir,`.${pathname}`);if(!file.startsWith(distDir))return sendJson(res,403,{error:'forbidden'});if(!fs.existsSync(file)||!fs.statSync(file).isFile()){file=path.join(distDir,'index.html');if(!fs.existsSync(file)){res.writeHead(503,{'Content-Type':'text/html; charset=utf-8'});return res.end('<h1>Shadow Ascension</h1><p>A build web ainda nao existe. Rode <b>npm run build</b> e reinicie o servidor LAN.</p>')}}const ext=path.extname(file).toLowerCase(),headers={'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':path.basename(file)==='index.html'?'no-cache':'public, max-age=3600'};res.writeHead(200,headers);if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res)}

const server=http.createServer((req,res)=>{try{return serveStatic(req,res)}catch(err){log('ERROR',`HTTP ${req.method} ${req.url}`,err);if(!res.headersSent)sendJson(res,500,{error:'internal_error'});else try{res.end()}catch{}}})
server.on('clientError',(err,socket)=>{log('WARN','HTTP clientError',err.message);try{socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')}catch{}})
const wss=new WebSocketServer({noServer:true,maxPayload:512*1024,perMessageDeflate:false})
const rooms=new Map()
const parties=new Map()
const roomOf=ws=>ws.room||roomDefault
const send=(ws,p)=>ws.readyState===WebSocket.OPEN&&ws.send(JSON.stringify(p))
const broadcast=(room,p,except=null)=>{for(const ws of room||[])if(ws!==except)send(ws,p)}
function joinRoom(ws,room){const old=rooms.get(ws.room);old?.delete(ws);if(old&&!old.size)rooms.delete(ws.room);ws.room=String(room||roomDefault).replace(/[^\w-]/g,'').slice(0,40)||roomDefault;if(ws.id&&database.players[ws.id]){database.players[ws.id].lastLobby=ws.room;database.players[ws.id].lastSeen=Date.now();scheduleSave()}if(!rooms.has(ws.room))rooms.set(ws.room,new Set());rooms.get(ws.room).add(ws);send(ws,{type:'welcome',id:ws.id,room:ws.room,players:[...rooms.get(ws.room)].filter(x=>x!==ws&&x.player).map(x=>publicPlayer(x.player))});broadcast(rooms.get(ws.room),{type:'join',player:publicPlayer(ws.player)},ws)}

function clientById(id){for(const ws of wss.clients)if(ws.id===id&&ws.readyState===WebSocket.OPEN)return ws;return null}
function publicParty(party){return party?{id:party.id,leaderId:party.leaderId,totalXP:party.totalXP||0,members:[...party.members].map(id=>clientById(id)?.player).filter(Boolean).map(publicPlayer)}:{id:null,leaderId:null,totalXP:0,members:[]}}
function sendPartyState(party){if(!party)return;const payload={type:'party_state',party:publicParty(party)};for(const id of party.members){const ws=clientById(id);if(ws)send(ws,payload)}}
function removeFromParty(ws){const party=ws?.partyId?parties.get(ws.partyId):null;if(!party){if(ws){ws.partyId=null;if(ws.player)ws.player.partyId=null}return}
  party.members.delete(ws.id);ws.partyId=null;if(ws.player)ws.player.partyId=null
  if(!party.members.size){parties.delete(party.id);return}
  if(party.leaderId===ws.id)party.leaderId=[...party.members][0]
  sendPartyState(party)
}
function createPartyFor(ws){removeFromParty(ws);const id=`party-${crypto.randomUUID().slice(0,8)}`,party={id,leaderId:ws.id,members:new Set([ws.id]),totalXP:0};parties.set(id,party);ws.partyId=id;ws.player.partyId=id;sendPartyState(party);return party}
function joinPartyFor(ws,targetId){let target=clientById(targetId);if(!target||target===ws){send(ws,{type:'party_error',message:'Aventureiro não encontrado.'});return}
  let party=target.partyId?parties.get(target.partyId):null;if(!party)party=createPartyFor(target)
  if(party.members.size>=4){send(ws,{type:'party_error',message:'A equipe já tem 4 membros.'});return}
  removeFromParty(ws);party.members.add(ws.id);ws.partyId=party.id;ws.player.partyId=party.id;sendPartyState(party)
}
server.on('upgrade',(req,socket,head)=>{let pathname='/';try{pathname=new URL(req.url,'http://local').pathname}catch{};if(pathname!=='/'&&pathname!=='/ws'){socket.destroy();return}wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req))})

wss.on('connection',(ws,req)=>{
  log('INFO',`WebSocket conectado de ${req?.socket?.remoteAddress||'desconhecido'}`)
  ws.id=crypto.randomUUID();ws.room=roomDefault;ws.isAlive=true;ws.partyId=null;ws.player={id:ws.id,name:'Aventureiro',x:0,y:0,z:0,r:0,level:1,hp:120,maxHp:120,motion:'idle',world:'open',guildRank:'E',mountActive:false,classId:'mercenary_swordsman',seq:0,partyId:null};ws.lastStateAt=0
  ws.on('pong',()=>ws.isAlive=true);rooms.has(roomDefault)||rooms.set(roomDefault,new Set());rooms.get(roomDefault).add(ws)
  ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return};if(!m||typeof m!=='object')return
    if(m.type==='hello'){const clientId=sanitizeId(m.playerId),existing=profileRecord(clientId);ws.id=clientId;ws.player.id=clientId;ws.player.name=sanitizeName(m.name||existing?.name||'Aventureiro');const requested=String(m.room||existing?.lastLobby||roomDefault).replace(/[^\w-]/g,'').slice(0,40)||roomDefault;if(existing){existing.lastSeen=Date.now();existing.name=ws.player.name;existing.lastLobby=requested;scheduleSave()}else{database.players[clientId]={id:clientId,name:ws.player.name,createdAt:Date.now(),lastSeen:Date.now(),lastLobby:requested,updatedAt:0,game:null};scheduleSave()}joinRoom(ws,requested);send(ws,{type:'profile',profile:{id:clientId,name:ws.player.name,lastLobby:requested,updatedAt:existing?.updatedAt||0,game:existing?.game||null}});return}
    if(m.type==='state'){const now=Date.now(),seq=safeNumber(m.seq,0,0,0xffffffff);if(ws.player.seq&&seq&&seq<ws.player.seq)return;if(now-ws.lastStateAt<45)return;ws.lastStateAt=now;Object.assign(ws.player,{name:sanitizeName(m.name||ws.player.name),x:safeNumber(m.x,0,-5000,5000),y:safeNumber(m.y,0,-30,100),z:safeNumber(m.z,0,-5000,5000),r:safeNumber(m.r,0,-Math.PI*4,Math.PI*4),level:safeNumber(m.level,1,1,300),hp:safeNumber(m.hp,0,0,1e9),maxHp:safeNumber(m.maxHp,120,1,1e9),motion:String(m.motion||'idle').slice(0,20),world:String(m.world||'open').slice(0,90),guildRank:String(m.guildRank||'E').slice(0,8),mountActive:!!m.mountActive,classId:String(m.classId||'mercenary_swordsman').slice(0,48),seq:Math.max(ws.player.seq||0,seq||0)});broadcast(rooms.get(roomOf(ws)),{type:'state',player:publicPlayer(ws.player)},ws);return}
    if(m.type==='ping'){send(ws,{type:'pong',clientTime:safeNumber(m.clientTime,0,0,Number.MAX_SAFE_INTEGER),serverTime:Date.now()});return}
    if(m.type==='profile_save'){const ok=storeProfile(ws.id,ws.player.name,m.game,m.updatedAt,roomOf(ws));send(ws,{type:'profile_saved',ok,updatedAt:m.updatedAt||Date.now(),lastLobby:roomOf(ws)});return}
    if(m.type==='rename'){ws.player.name=sanitizeName(m.name);const rec=database.players[ws.id];if(rec){rec.name=ws.player.name;rec.lastSeen=Date.now();scheduleSave()}broadcast(rooms.get(roomOf(ws)),{type:'state',player:publicPlayer(ws.player)},ws);send(ws,{type:'renamed',name:ws.player.name});return}
    if(m.type==='party_create'){createPartyFor(ws);return}
    if(m.type==='party_join'){joinPartyFor(ws,String(m.targetId||''));return}
    if(m.type==='party_leave'){removeFromParty(ws);send(ws,{type:'party_state',party:null});return}
    if(m.type==='party_xp'){
      const party=ws.partyId?parties.get(ws.partyId):null,amount=Math.max(0,Math.min(1000000,Math.round(Number(m.amount)||0)));if(!amount)return
      if(!party){send(ws,{type:'party_xp_award',amount});return}
      const eligible=[...party.members].map(clientById).filter(member=>member&&member.player?.world===ws.player.world&&member.room===ws.room)
      if(!eligible.length){send(ws,{type:'party_xp_award',amount});return}
      party.totalXP=(party.totalXP||0)+amount;const base=Math.floor(amount/eligible.length),rem=amount-base*eligible.length
      eligible.forEach((member,i)=>send(member,{type:'party_xp_award',amount:base+(i<rem?1:0),source:ws.player.name,partyId:party.id}));sendPartyState(party);return
    }
    if(m.type==='player_trade'){
      const target=clientById(String(m.targetId||''))
      if(!target||target.room!==ws.room){send(ws,{type:'trade_error',tradeId:String(m.tradeId||''),message:'Jogador não está mais conectado.'});return}
      const items=Array.isArray(m.items)?m.items.slice(0,20).map(it=>({
        id:String(it?.id||'').slice(0,90),name:String(it?.name||'Item').slice(0,80),type:String(it?.type||'material').slice(0,30),subtype:String(it?.subtype||'').slice(0,30),rarity:String(it?.rarity||'Comum').slice(0,20),rarityTier:safeNumber(it?.rarityTier,0,0,8),color:String(it?.color||'#cbd5e1').slice(0,20),icon:String(it?.icon||'').slice(0,8),qty:safeNumber(it?.qty,1,1,9999),value:safeNumber(it?.value,0,0,100000000),level:safeNumber(it?.level,1,1,300),upgrade:safeNumber(it?.upgrade,0,0,10),durability:safeNumber(it?.durability,0,0,1000000),maxDurability:safeNumber(it?.maxDurability,0,0,1000000),stats:it?.stats&&typeof it.stats==='object'?it.stats:{},zoneId:String(it?.zoneId||'').slice(0,30),description:String(it?.description||'').slice(0,220)
      })):[]
      const gold=safeNumber(m.gold,0,0,100000000)
      const tradeId=String(m.tradeId||`trade-${Date.now().toString(36)}`).slice(0,90)
      send(target,{type:'player_trade',tradeId,from:ws.id,fromName:ws.player.name,items,gold,world:String(m.world||ws.player.world||'open').slice(0,90)})
      send(ws,{type:'trade_sent',tradeId,targetId:target.id,itemCount:items.length,gold})
      return
    }
    if(m.type==='combat'||m.type==='ability'||m.type==='emote'||m.type==='enemy_damage'||m.type==='enemy_dead')broadcast(rooms.get(roomOf(ws)),{...m,from:ws.id},ws)
  })
  ws.on('error',err=>log('WARN',`WebSocket ${ws.id} erro:`,err.message))
  ws.on('close',()=>{log('INFO',`WebSocket desconectado: ${ws.id} (${ws.player?.name||'Aventureiro'})`);removeFromParty(ws);const room=rooms.get(roomOf(ws));room?.delete(ws);broadcast(room,{type:'leave',id:ws.id});if(room&&!room.size)rooms.delete(roomOf(ws));const rec=database.players[ws.id];if(rec){rec.lastSeen=Date.now();scheduleSave()}})
})

const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(ws.isAlive===false){ws.terminate();continue}ws.isAlive=false;ws.ping()}},30000)
server.on('close',()=>clearInterval(heartbeat))
process.on('SIGINT',()=>{clearInterval(heartbeat);if(saveTimer){clearTimeout(saveTimer);saveTimer=null}try{fs.writeFileSync(dbPath,JSON.stringify(database,null,2),'utf8')}catch{}server.close(()=>process.exit(0))})

server.on('error',err=>{
  if(err?.code==='EADDRINUSE'){log('FATAL',`A porta ${port} ja esta em uso.`);process.exitCode=1;return}
  log('FATAL','Erro do servidor:',err)
})
server.listen(port,host,()=>{const ips=lanAddresses();log('INFO',`Servidor escutando em ${host}:${port} PID=${process.pid}`);log('INFO',`Runtime log: ${runtimeLog}`);console.log('');console.log('==============================================================');console.log(` SHADOW ASCENSION LAN V${VERSION}`);console.log(` Site local:  http://localhost:${port}`);for(const ip of ips)console.log(` Site na rede: http://${ip}:${port}`);console.log(` WebSocket:    ws://${ips[0]||'SEU-IP'}:${port}/ws`);console.log(` Perfis:       ${dbPath}`);console.log(` Logs servidor:${runtimeLog}`);console.log(` Logs cliente: ${clientLog}`);console.log(' PC e celular podem abrir o MESMO endereco HTTP na mesma rede.');console.log('==============================================================');console.log('')})
function lanAddresses(){const out=[];for(const list of Object.values(os.networkInterfaces()))for(const net of list||[])if(net.family==='IPv4'&&!net.internal&&(net.address.startsWith('192.168.')||net.address.startsWith('10.')||/^172\.(1[6-9]|2\d|3[01])\./.test(net.address)))out.push(net.address);return[...new Set(out)]}
