(function(){
'use strict';

const VERSION='1.1.0';
const EXPECTED_SCHEMA=2;
const EXPECTED_SECURITY=2;
const SUPABASE_HOST='ngkcxzsjhftsfalpqjuu.supabase.co';
const DB_NAME='oclife_shared_queue_v1';
const DB_STORE='pending_ops';
const CREDENTIALS_KEY='oclife_shared_credentials_v1';
const S=window.OCLifeStore;
const baseFetch=window.fetch.bind(window);
const forceReplay=new Set();
const allowLocalDelete=new Set();
let syncTimer=0;
let avatarNoticeAt=0;

const clone=value=>JSON.parse(JSON.stringify(value));
const toast=(text,opts={})=>window.OCLifeAutoLife?.toast?.(text,opts)||console.warn('[OC Life shared audit]',text);

function parseJSON(text,fallback={}){try{return text?JSON.parse(text):fallback}catch(_){return fallback}}
function readCredentials(){try{return parseJSON(localStorage.getItem(CREDENTIALS_KEY)||'{}',{})}catch(_){return{}}}
function requestMeta(input,init={}){
 try{
  const url=new URL(typeof input==='string'?input:input?.url,location.href);
  if(url.hostname!==SUPABASE_HOST||!url.pathname.includes('/rest/v1/rpc/'))return null;
  const name=url.pathname.split('/').pop()||'';
  const body=typeof init.body==='string'?parseJSON(init.body,{}):{};
  return{url,name,body};
 }catch(_){return null}
}
function jsonResponse(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}})}
async function responseData(response){const text=await response.clone().text();return parseJSON(text,{message:text||`HTTP ${response.status}`})}
function errorText(data){return String(data?.message||data?.details||data?.hint||data?.error||'')}
function permanentRejection(data,status){
 const text=errorText(data);
 return status===413||/只能修改|只能刪除|只有建立者|沒有編輯這個共享世界的權限|單筆共享資料過大|資料過大|超過.*上限|格式無效|不支援的共享操作/i.test(text)
}
function authOrMissing(data,status){
 const text=errorText(data);
 return status===401||/憑證無效|成員已被移除|共享世界不存在|共享世界.*已刪除|成員憑證/i.test(text)
}
function noticeOnce(text){const now=Date.now();if(now-avatarNoticeAt<3000)return;avatarNoticeAt=now;toast(text,{error:true})}
function sanitizePayload(value,state,depth=0){
 if(depth>18)return null;
 if(Array.isArray(value))return value.map(v=>sanitizePayload(v,state,depth+1));
 if(value&&typeof value==='object'){
  const out={};
  for(const[k,v]of Object.entries(value)){
   if(k==='avatarData'&&typeof v==='string'&&v.startsWith('data:image/')&&v.length>420000){out[k]='';state.avatarStripped=true;continue}
   out[k]=sanitizePayload(v,state,depth+1);
  }
  return out;
 }
 return value;
}
function sanitizeOp(op,body,state){
 const next=clone(op||{});
 if(next.action==='upsert'&&next.payload){
  next.payload=sanitizePayload(next.payload,state);
  if(next.entity_type==='moment'&&String(next.payload?.sharedOwnerMemberId||'')===String(body.p_member_id||'')){
   next.payload.threadState={...(next.payload.threadState||{}),enabled:true};
  }
 }
 return next;
}
function remapAuthFailure(data){return jsonResponse({...data,code:data?.code||'OC_SHARED_AUTH',message:errorText(data)||'共享世界憑證或權限失效'},409)}

async function handleHealth(input,init){
 const response=await baseFetch(input,init);
 if(!response.ok)return response;
 const data=await responseData(response);
 const schema=Number(data?.schema_version||0),security=Number(data?.security_revision||0);
 if(schema<EXPECTED_SCHEMA||security<EXPECTED_SECURITY){
  return jsonResponse({code:'PGRST202',message:`共享世界資料庫需要升級（目前 schema ${schema||'未知'}，需要 ${EXPECTED_SCHEMA}）`,details:'請在共享世界初始化介面重新複製並執行完整 SQL。'},404);
 }
 return response;
}
async function handlePull(input,init,meta){
 const body={...meta.body};
 const worldId=String(body.p_world_id||'');
 const replay=forceReplay.has(worldId);
 if(replay)body.p_after_seq=0;
 const response=await baseFetch(input,{...init,body:JSON.stringify(body)});
 if(response.ok&&replay)forceReplay.delete(worldId);
 return response;
}
async function handlePush(input,init,meta){
 const body={...meta.body},ops=Array.isArray(body.p_ops)?body.p_ops:[];
 if(!ops.length)return baseFetch(input,init);
 let inserted=0,lastSeq=0,rejected=0;
 const rejectedMessages=[],state={avatarStripped:false};
 for(const raw of ops){
  const op=sanitizeOp(raw,body,state);
  let response;
  try{response=await baseFetch(input,{...init,body:JSON.stringify({...body,p_ops:[op]})})}
  catch(error){throw error}
  const data=await responseData(response);
  if(response.ok){inserted+=Number(data?.inserted||0);lastSeq=Math.max(lastSeq,Number(data?.last_seq||0));continue}
  if(permanentRejection(data,response.status)){
   rejected++;
   forceReplay.add(String(body.p_world_id||''));
   rejectedMessages.push(errorText(data)||'一項修改未獲授權');
   continue;
  }
  if(authOrMissing(data,response.status)||response.status===403||String(data?.code||'')==='42501')return remapAuthFailure(data);
  return response;
 }
 if(state.avatarStripped)noticeOnce('頭像檔案過大，已保留在本機但未同步到共享世界');
 if(rejected){
  const unique=[...new Set(rejectedMessages)].slice(0,2).join('；');
  toast(`有 ${rejected} 項共享修改未獲授權，已捨棄並重新同步${unique?`：${unique}`:''}`,{error:true});
 }
 return jsonResponse({ok:true,inserted,last_seq:lastSeq,rejected});
}
function openQueueDB(){return new Promise((resolve,reject)=>{if(!('indexedDB'in window))return reject(new Error('IndexedDB unavailable'));const request=indexedDB.open(DB_NAME,1);request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(DB_STORE)){const store=db.createObjectStore(DB_STORE,{keyPath:'op_id'});store.createIndex('world_id','world_id',{unique:false})}};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('shared queue open failed'))})}
async function clearPending(remoteId){
 if(!remoteId)return 0;
 try{
  const db=await openQueueDB();let count=0;
  await new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readwrite'),store=tx.objectStore(DB_STORE),index=store.index('world_id'),request=index.openCursor(IDBKeyRange.only(remoteId));request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;count++;cursor.delete();cursor.continue()};request.onerror=()=>reject(request.error);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
  db.close();return count;
 }catch(error){console.warn('[OC Life] clear shared queue:',error);return 0}
}
async function pendingCount(remoteId){
 if(!remoteId)return 0;
 try{const db=await openQueueDB(),count=await new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readonly'),request=tx.objectStore(DB_STORE).index('world_id').count(remoteId);request.onsuccess=()=>resolve(request.result||0);request.onerror=()=>reject(request.error)});db.close();return count}catch(_){return 0}
}
async function handleExit(input,init,meta){
 const response=await baseFetch(input,init);
 if(response.ok){const id=String(meta.body?.p_world_id||'');await clearPending(id);forceReplay.delete(id);allowLocalDelete.add(id)}
 return response;
}
window.fetch=async function(input,init={}){
 const meta=requestMeta(input,init);
 if(!meta)return baseFetch(input,init);
 if(meta.name==='oclife_shared_health')return handleHealth(input,init);
 if(meta.name==='oclife_shared_push')return handlePush(input,init,meta);
 if(meta.name==='oclife_shared_pull')return handlePull(input,init,meta);
 if(meta.name==='oclife_shared_leave_world'||meta.name==='oclife_shared_delete_world')return handleExit(input,init,meta);
 return baseFetch(input,init);
};

function credentialForWorld(world){return world?.sharedWorldId?readCredentials()[world.sharedWorldId]||null:null}
function sharedWorldFor(type,item){if(type==='worlds')return item;return item?.worldId?S?.get?.('worlds',item.worldId):null}
function canEdit(world,item,type){
 if(!world?.sharedWorldId)return true;
 const cred=credentialForWorld(world);
 if(!cred||cred.role==='viewer')return false;
 if(type==='worlds')return cred.role==='owner';
 if(cred.role==='owner')return true;
 return !!item?.sharedOwnerMemberId&&String(item.sharedOwnerMemberId)===String(cred.memberId);
}
function block(text){toast(text,{error:true});return false}
function patchStorePermissions(){
 if(!S||S.__sharedAuditPatched)return;
 Object.defineProperty(S,'__sharedAuditPatched',{value:true,configurable:false});
 const baseUpdate=S.update.bind(S),baseRemove=S.remove.bind(S),baseDeleteWorld=S.deleteWorld.bind(S),baseAdd=S.add.bind(S),baseCreateCharacter=S.createCharacter.bind(S);
 S.update=function(type,id,patch){
  const item=S.get(type,id),world=sharedWorldFor(type,item);
  if(world?.sharedWorldId&&!canEdit(world,item,type)){
   if(type==='worlds'){
    const protectedKeys=new Set(['name','emoji','summary','era','location','rules','tone']);
    const safe=Object.fromEntries(Object.entries(patch||{}).filter(([key])=>!protectedKeys.has(key)));
    if(Object.keys(safe).length)return baseUpdate(type,id,safe);
    block('只有共享世界建立者可以修改世界資料');return item;
   }
   block('只能修改自己建立的共享角色、動態或事件');return item;
  }
  return baseUpdate(type,id,patch);
 };
 S.remove=function(type,id){const item=S.get(type,id),world=sharedWorldFor(type,item);if(world?.sharedWorldId&&!canEdit(world,item,type)){block('只能刪除自己建立的共享內容');return false}return baseRemove(type,id)};
 S.deleteWorld=function(worldId){const world=S.get('worlds',worldId);if(world?.sharedWorldId){const remoteId=String(world.sharedWorldId);if(allowLocalDelete.has(remoteId)){allowLocalDelete.delete(remoteId);return baseDeleteWorld(worldId)}block('請從「同步」管理頁退出或刪除共享世界');window.OCLifeSharedWorlds?.openManager?.(worldId);return false}return baseDeleteWorld(worldId)};
 S.add=function(type,obj){const world=obj?.worldId?S.get('worlds',obj.worldId):null,cred=credentialForWorld(world);if(world?.sharedWorldId&&cred?.role==='viewer'&&['characters','moments','events'].includes(type)){block('唯讀成員不能新增共享內容');return null}return baseAdd(type,obj)};
 S.createCharacter=function(input){const world=input?.worldId?S.get('worlds',input.worldId):null,cred=credentialForWorld(world);if(world?.sharedWorldId&&cred?.role==='viewer'){block('唯讀成員不能新增角色');return null}return baseCreateCharacter(input)};
}
function scheduleSync(){clearTimeout(syncTimer);syncTimer=setTimeout(()=>window.OCLifeSharedWorlds?.syncAll?.(),250)}
function install(){
 patchStorePermissions();
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')scheduleSync()});
 window.addEventListener('online',scheduleSync);
 window.addEventListener('oclife:shared-sync',event=>{const world=event.detail?.worldId&&S?.get?.('worlds',event.detail.worldId);if(world?.sharedWorldId)forceReplay.delete(String(world.sharedWorldId))});
}

window.OCLifeSharedAudit={version:VERSION,expectedSchema:EXPECTED_SCHEMA,expectedSecurity:EXPECTED_SECURITY,pendingCount,clearPending,forceReplay:worldId=>forceReplay.add(String(worldId||'')),get forcedWorlds(){return[...forceReplay]}};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})();
