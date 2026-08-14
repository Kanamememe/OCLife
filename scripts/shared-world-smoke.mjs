import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {webkit} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.sql':'text/plain; charset=utf-8'};
const server=http.createServer((req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const rel=pathname==='/'?'index.html':pathname.replace(/^\/+/, '');
  const file=path.resolve(root,rel);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return}
  res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(file).pipe(res);
 }catch(error){res.writeHead(500);res.end(String(error))}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {port}=server.address();

const backend={worlds:new Map(),invite:new Map(),seq:0,failNextPush:false};
function stamp(payload,member){return{...(payload||{}),sharedOwnerMemberId:member.id,sharedOwnerName:member.display_name}}
function latestOwner(world,type,id){const op=[...world.ops].reverse().find(x=>x.entity_type===type&&x.entity_id===id&&x.action==='upsert');return op?.payload?.sharedOwnerMemberId||''}
function pull(world,member,after=0){return{world_id:world.id,invite_code:world.invite_code,world:structuredClone(world.payload),member_id:member.id,role:member.role,last_seq:world.ops.at(-1)?.seq||0,ops:world.ops.filter(x=>x.seq>Number(after||0)).map(structuredClone),members:world.members.filter(x=>x.active).map(x=>({id:x.id,display_name:x.display_name,role:x.role,joined_at:x.joined_at,last_seen_at:x.last_seen_at,active:x.active}))}}
function memberFor(world,id,token){return world?.members.find(x=>x.id===id&&x.token===token&&x.active)}
function append(world,member,op){
 let payload=op.action==='upsert'?structuredClone(op.payload||{}):null;
 if(op.entity_type!=='world'&&op.action==='upsert'){
  const owner=latestOwner(world,op.entity_type,String(op.entity_id));
  if(owner&&member.role!=='owner'&&owner!==member.id)throw Object.assign(new Error('你只能修改或刪除自己建立的角色、動態或事件'),{status:403,code:'42501'});
  const ownerMember=world.members.find(x=>x.id===(owner||member.id))||member;
  payload={...payload,sharedOwnerMemberId:owner||member.id,sharedOwnerName:ownerMember.display_name};
 }
 if(op.entity_type!=='world'&&op.action==='delete'){
  const owner=latestOwner(world,op.entity_type,String(op.entity_id));
  if(owner&&member.role!=='owner'&&owner!==member.id)throw Object.assign(new Error('你只能修改或刪除自己建立的角色、動態或事件'),{status:403,code:'42501'});
 }
 if(op.entity_type==='world'){
  if(member.role!=='owner')throw Object.assign(new Error('只有建立者能修改共享世界資料'),{status:403,code:'42501'});
  world.payload=structuredClone(payload||{});
 }
 if(world.ops.some(x=>x.op_id===op.op_id))return false;
 world.ops.push({seq:++backend.seq,op_id:op.op_id,member_id:member.id,entity_type:op.entity_type,entity_id:String(op.entity_id),action:op.action,payload,created_at:new Date().toISOString()});
 return true;
}
async function rpcHandler(route){
 const request=route.request(),url=new URL(request.url());
 if(!url.pathname.includes('/rest/v1/rpc/')){await route.fulfill({status:200,contentType:'application/json',body:'[]'});return}
 const name=url.pathname.split('/').pop(),body=JSON.parse(request.postData()||'{}');
 const ok=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 const fail=(status,message,code='')=>route.fulfill({status,contentType:'application/json',body:JSON.stringify({message,code})});
 try{
  if(name==='oclife_shared_health')return ok({ok:true,schema_version:2,security_revision:2,max_push_ops:25,max_members:50});
  if(name==='oclife_shared_create_world'){
   const id=crypto.randomUUID(),invite=`OCL-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
   const member={id:crypto.randomUUID(),display_name:body.p_member_name,role:'owner',token:body.p_member_token,active:true,joined_at:new Date().toISOString(),last_seen_at:new Date().toISOString()};
   const world={id,invite_code:invite,payload:structuredClone(body.p_world||{}),members:[member],ops:[]};backend.worlds.set(id,world);backend.invite.set(invite,id);
   for(const op of body.p_ops||[])append(world,member,{...op,payload:stamp(op.payload,member)});
   return ok(pull(world,member,0));
  }
  if(name==='oclife_shared_join_world'){
   const id=backend.invite.get(body.p_invite_code),world=backend.worlds.get(id);if(!world)return fail(404,'邀請碼不存在或已失效','P0002');
   const member={id:crypto.randomUUID(),display_name:body.p_member_name,role:'editor',token:body.p_member_token,active:true,joined_at:new Date().toISOString(),last_seen_at:new Date().toISOString()};world.members.push(member);return ok(pull(world,member,0));
  }
  const world=backend.worlds.get(body.p_world_id),member=memberFor(world,body.p_member_id,body.p_member_token);
  if(!world)return fail(404,'共享世界不存在或已刪除','P0002');
  if(!member)return fail(403,'共享世界憑證無效或成員已被移除','42501');
  member.last_seen_at=new Date().toISOString();
  if(name==='oclife_shared_pull')return ok(pull(world,member,body.p_after_seq));
  if(name==='oclife_shared_push'){
   if(backend.failNextPush){backend.failNextPush=false;return fail(503,'暫時無法連線')}
   let inserted=0;try{for(const op of body.p_ops||[])if(append(world,member,op))inserted++}catch(error){return fail(error.status||400,error.message,error.code||'')}
   return ok({ok:true,inserted,last_seq:world.ops.at(-1)?.seq||0});
  }
  if(name==='oclife_shared_rotate_invite'){
   if(member.role!=='owner')return fail(403,'只有建立者能重設邀請碼','42501');backend.invite.delete(world.invite_code);world.invite_code=`OCL-${crypto.randomBytes(2).toString('hex').toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;backend.invite.set(world.invite_code,world.id);return ok({ok:true,invite_code:world.invite_code});
  }
  if(name==='oclife_shared_leave_world'){if(member.role==='owner')return fail(400,'建立者不能直接退出');member.active=false;return ok({ok:true})}
  if(name==='oclife_shared_delete_world'){if(member.role!=='owner')return fail(403,'只有建立者能刪除共享世界','42501');backend.worlds.delete(world.id);backend.invite.delete(world.invite_code);return ok({ok:true})}
  return fail(404,'Unknown RPC');
 }catch(error){return fail(500,error.message||String(error))}
}

const browser=await webkit.launch({headless:true});
const users=[];
async function newUser(){
 const context=await browser.newContext(),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(`console: ${message.text()}`)});
 await page.addInitScript(()=>{localStorage.setItem('oclife_boot_animation_v1','0');localStorage.setItem('oclife_onboarding_v1','done');localStorage.setItem('oclife_announcement_settings_v1',JSON.stringify({mode:'never'}));localStorage.setItem('oclife_update_settings_v1',JSON.stringify({auto:false}));localStorage.setItem('oclife_auto_life_settings',JSON.stringify({enabled:false,toast:false}));localStorage.setItem('oclife_moment_threads_v1',JSON.stringify({enabled:false}))});
 await page.route('https://ngkcxzsjhftsfalpqjuu.supabase.co/**',rpcHandler);await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.OCLifeHealth?.check?.().ok===true&&window.OCLifeSharedAudit?.expectedSchema===2,null,{timeout:15000});
 const user={context,page,errors};users.push(user);return user;
}

try{
 const owner=await newUser(),friend=await newUser();
 const ownerWorldId=await owner.page.evaluate(()=>{const world=OCLifeStore.createWorld({name:'共享測試世界',emoji:'◈',summary:'雙裝置同步測試',era:'現代',location:'測試區'});OCLifeStore.createCharacter({worldId:world.id,name:'甲',gender:'男',age:'25',personality:'冷靜',speech:'簡短'});OCLifeStore.createCharacter({worldId:world.id,name:'乙',gender:'女',age:'24',personality:'活潑',speech:'自然'});OCLifeWorldContext.set(world.id);OCLifePhone.openHome(world.id);return world.id});
 await owner.page.evaluate(id=>OCLifeSharedWorlds.openCreate(id),ownerWorldId);await owner.page.locator('#sharedMemberName').fill('Owner');await owner.page.locator('#sharedConfirm').check();await owner.page.locator('#sharedCreate').click();await owner.page.waitForSelector('.oc-shared-code');const invite=(await owner.page.locator('.oc-shared-code').textContent()).trim();assert.match(invite,/^OCL-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
 const remoteId=await owner.page.evaluate(id=>OCLifeStore.get('worlds',id).sharedWorldId,ownerWorldId);assert.ok(remoteId);
 await friend.page.evaluate(code=>OCLifeSharedWorlds.openJoin(code),invite);await friend.page.locator('#sharedJoinName').fill('Friend');await friend.page.locator('#sharedJoinGo').click();await friend.page.waitForFunction(()=>OCLifeStore.all('worlds').some(x=>x.sharedWorldId));const friendWorldId=await friend.page.evaluate(()=>OCLifeStore.all('worlds').find(x=>x.sharedWorldId).id);assert.equal(await friend.page.evaluate(id=>OCLifeStore.all('characters',{worldId:id}).length,friendWorldId),2);

 const ownerCharId=await friend.page.evaluate(id=>OCLifeStore.all('characters',{worldId:id})[0].id,friendWorldId),originalPersonality=await friend.page.evaluate(id=>OCLifeStore.get('characters',id).personality,ownerCharId);await friend.page.evaluate(id=>OCLifeStore.update('characters',id,{personality:'不應被套用'}),ownerCharId);assert.equal(await friend.page.evaluate(id=>OCLifeStore.get('characters',id).personality,ownerCharId),originalPersonality,'editor changed owner character');
 const friendCharId=await friend.page.evaluate(id=>OCLifeStore.createCharacter({worldId:id,name:'丙',gender:'男',age:'23',personality:'溫和',speech:'克制'}).id,friendWorldId);await friend.page.waitForTimeout(700);await friend.page.evaluate(id=>OCLifeSharedWorlds.syncWorld(id,{manual:true}),friendWorldId);await owner.page.evaluate(id=>OCLifeSharedWorlds.syncWorld(id,{manual:true}),ownerWorldId);assert.ok(await owner.page.evaluate(([wid,cid])=>!!OCLifeStore.all('characters',{worldId:wid}).find(x=>x.id===cid),[ownerWorldId,friendCharId]));
 await owner.page.evaluate(id=>OCLifeStore.update('characters',id,{personality:'由建立者修訂'}),friendCharId);await owner.page.waitForTimeout(700);await owner.page.evaluate(id=>OCLifeSharedWorlds.syncWorld(id,{manual:true}),ownerWorldId);await friend.page.evaluate(id=>OCLifeSharedWorlds.syncWorld(id,{manual:true}),friendWorldId);assert.equal(await friend.page.evaluate(id=>OCLifeStore.get('characters',id).personality,friendCharId),'由建立者修訂');

 const momentId=await friend.page.evaluate(([wid,cid])=>OCLifeStore.add('moments',{worldId:wid,characterId:cid,text:'朋友建立的共享動態',at:Date.now(),comments:[],likes:[],threadState:{version:1,enabled:true,completed:false,nextAt:Date.now()+3600000}}).id,[friendWorldId,friendCharId]);await friend.page.waitForTimeout(700);await friend.page.evaluate(id=>OCLifeSharedWorlds.syncWorld(id,{manual:true}),friendWorldId);await owner.page.evaluate(id=>OCLifeSharedWorlds.syncWorld(id,{manual:true}),ownerWorldId);assert.equal(await owner.page.evaluate(id=>OCLifeStore.get('moments',id)?.threadState?.enabled,momentId),true,'owner did not receive enabled thread state');

 backend.failNextPush=true;await friend.page.evaluate(([wid,cid])=>OCLifeStore.add('events',{worldId:wid,title:'暫時失敗事件',summary:'離線佇列測試',characterIds:[cid],at:Date.now()}),[friendWorldId,friendCharId]);await friend.page.waitForTimeout(1100);assert.ok(await friend.page.evaluate(id=>OCLifeSharedAudit.pendingCount(id),remoteId),'transient failure lost pending operation');await friend.page.evaluate(id=>OCLifeSharedWorlds.syncWorld(id,{manual:true}),friendWorldId);await friend.page.waitForFunction(id=>OCLifeSharedAudit.pendingCount(id).then(n=>n===0),remoteId);await owner.page.evaluate(id=>OCLifeSharedWorlds.syncWorld(id,{manual:true}),ownerWorldId);assert.ok(await owner.page.evaluate(id=>OCLifeStore.all('events',{worldId:id}).some(x=>x.title==='暫時失敗事件'),ownerWorldId));

 await friend.page.evaluate(([wid,mid])=>{const moment=OCLifeStore.get('moments',mid),a={id:OCLifeStore.uid('comment'),characterId:moment.characterId,text:'第一層',at:Date.now(),parentId:null},b={id:OCLifeStore.uid('comment'),characterId:moment.characterId,text:'第二層',at:Date.now()+1,parentId:a.id};OCLifeStore.update('moments',mid,{comments:[a,b]});OCLifeStore.add('writings',{worldId:wid,title:'私人文章',body:'不參與共享，但私人副本必須保留',characterIds:[moment.characterId]})},[friendWorldId,momentId]);await friend.page.evaluate(id=>OCLifeSharedIntegrity.copyPrivate(id),friendWorldId);const privateWorldId=await friend.page.evaluate(()=>OCLifeStore.all('worlds').find(x=>!x.sharedWorldId&&/私人副本/.test(x.name))?.id);assert.ok(privateWorldId);const privateCheck=await friend.page.evaluate(id=>{const moment=OCLifeStore.all('moments',{worldId:id}).find(x=>x.text==='朋友建立的共享動態'),comments=moment?.comments||[];return{writings:OCLifeStore.all('writings',{worldId:id}).length,comments:comments.length,parentOk:comments.length===2&&comments[1].parentId===comments[0].id}},privateWorldId);assert.deepEqual(privateCheck,{writings:1,comments:2,parentOk:true});

 await friend.page.evaluate(id=>{OCLifeWorldContext.set(id);OCLifePhone.openHome(id)},friendWorldId);backend.failNextPush=true;await friend.page.evaluate(([wid,cid])=>OCLifeStore.add('events',{worldId:wid,title:'離開前佇列',summary:'應被清理',characterIds:[cid],at:Date.now()}),[friendWorldId,friendCharId]);await friend.page.waitForTimeout(1100);assert.ok(await friend.page.evaluate(id=>OCLifeSharedAudit.pendingCount(id),remoteId));await friend.page.evaluate(id=>OCLifeSharedWorlds.openManager(id),friendWorldId);friend.page.once('dialog',dialog=>dialog.accept());await friend.page.locator('#sharedLeaveWorld').click();await friend.page.waitForFunction(id=>!OCLifeStore.get('worlds',id),friendWorldId);assert.equal(await friend.page.evaluate(id=>OCLifeSharedAudit.pendingCount(id),remoteId),0,'leave did not clear pending queue');

 for(const user of users)assert.deepEqual(user.errors,[],user.errors.join('\n'));console.log('Shared-world two-client WebKit smoke test passed.');
}finally{for(const user of users)await user.context.close();await browser.close();await new Promise(resolve=>server.close(resolve))}
