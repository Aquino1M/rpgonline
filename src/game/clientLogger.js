const STORAGE_KEY='shadow-ascension-client-errors-v1'
const MAX_LOCAL=50

function normalizeError(input){
  if(input instanceof Error)return {name:input.name,message:input.message,stack:input.stack||''}
  if(typeof input==='string')return {name:'Error',message:input,stack:''}
  try{return {name:'Error',message:JSON.stringify(input),stack:''}}catch{return {name:'Error',message:String(input),stack:''}}
}
function remember(entry){
  try{
    const list=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')
    list.push(entry)
    localStorage.setItem(STORAGE_KEY,JSON.stringify(list.slice(-MAX_LOCAL)))
  }catch{}
}
async function send(entry){
  try{
    if(location.protocol!=='http:'&&location.protocol!=='https:')return
    await fetch('/api/client-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(entry),keepalive:true,cache:'no-store'})
  }catch{}
}
function report(type,error,extra={}){
  const normalized=normalizeError(error)
  const entry={
    ts:new Date().toISOString(),type,
    ...normalized,
    url:location.href,
    viewport:{w:window.innerWidth,h:window.innerHeight,dpr:window.devicePixelRatio||1},
    touch:navigator.maxTouchPoints||0,
    online:navigator.onLine,
    userAgent:navigator.userAgent,
    ...extra,
  }
  remember(entry);send(entry)
}

export function installClientLogger(){
  window.addEventListener('error',e=>report('window.error',e.error||e.message,{source:e.filename||'',line:e.lineno||0,column:e.colno||0}))
  window.addEventListener('unhandledrejection',e=>report('unhandledrejection',e.reason))
  window.addEventListener('offline',()=>report('network.offline','Navegador ficou offline'))
  window.__shadowReportError=(error,extra={})=>report('manual',error,extra)
  try{send({ts:new Date().toISOString(),type:'client.boot',url:location.href,viewport:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio||1},touch:navigator.maxTouchPoints||0,userAgent:navigator.userAgent})}catch{}
}

export function getLocalClientErrors(){
  try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]')}catch{return[]}
}
