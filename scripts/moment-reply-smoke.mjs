import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {webkit} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
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
const browser=await webkit.launch({headless:true});
const page=await browser.newPage();
const pageErrors=[];
page.on('pageerror',error=>pageErrors.push(error.message));
page.on('console',message=>{if(message.type()==='error')pageErrors.push(`console: ${message.text()}`)});
await page.addInitScript(()=>{
 localStorage.setItem('oclife_boot_animation_v1','0');
 localStorage.setItem('oclife_onboarding_v1','done');
 localStorage.setItem('oclife_announcement_settings_v1',JSON.stringify({mode:'never'}));
 localStorage.setItem('oclife_update_settings_v1',JSON.stringify({auto:false}));
 localStorage.setItem('oclife_auto_life_settings',JSON.stringify({enabled:false,toast:false}));
 localStorage.setItem('oclife_moment_threads_v1',JSON.stringify({enabled:false}));
});
await page.route('https://ngkcxzsjhftsfalpqjuu.supabase.co/**',async route=>{
 const url=route.request().url();
 const body=url.includes('/rpc/oclife_shared_health')?JSON.stringify({ok:true,schema_version:2,security_revision:2}):'[]';
 await route.fulfill({status:200,contentType:'application/json',body});
});
try{
 await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.OCLifeMomentThreads?.version&&window.OCLifeMomentWeChatUI?.version&&window.OCLifeMomentTools?.version,null,{timeout:10000});
 const ids=await page.evaluate(()=>{
  const w=OCLifeStore.createWorld({name:'回覆綁定測試'});
  const a=OCLifeStore.createCharacter({worldId:w.id,name:'甲',emoji:'甲'});
  const b=OCLifeStore.createCharacter({worldId:w.id,name:'乙',emoji:'乙'});
  const c=OCLifeStore.createCharacter({worldId:w.id,name:'丙',emoji:'丙'});
  const older=OCLifeStore.add('moments',{worldId:w.id,characterId:a.id,text:'較舊的動態',at:Date.now()-10000,likes:[],comments:[
   {id:'old-root',characterId:b.id,text:'舊動態留言',at:Date.now()-9000,parentId:null}
  ]});
  const newer=OCLifeStore.add('moments',{worldId:w.id,characterId:b.id,text:'較新的動態',at:Date.now(),likes:[],comments:[
   {id:'new-root-1',characterId:a.id,text:'第一則根留言',at:Date.now()+10,parentId:null},
   {id:'new-root-2',characterId:c.id,text:'第二則根留言',at:Date.now()+20,parentId:null},
   {id:'new-child',characterId:b.id,text:'回覆第一則',at:Date.now()+30,parentId:'new-root-1'}
  ]});
  OCLifeApp.openWorld(w.id,'moments',true);
  return{world:w.id,older:older.id,newer:newer.id};
 });
 await page.waitForFunction(()=>[...document.querySelectorAll('.moment-card')].length===2&&[...document.querySelectorAll('.moment-card')].every(card=>card.dataset.momentId));
 await page.waitForFunction(()=>document.querySelectorAll('.oc-thread-comment').length===4);
 let bindings=await page.evaluate(()=>[...document.querySelectorAll('.moment-card')].map(card=>({id:card.dataset.momentId,text:card.querySelector('.moment-text')?.textContent,comments:[...card.querySelectorAll('.oc-thread-text')].map(x=>x.textContent)})));
 assert.equal(bindings.find(x=>x.text==='較新的動態')?.id,ids.newer);
 assert.deepEqual(bindings.find(x=>x.text==='較新的動態')?.comments,['第一則根留言','回覆第一則','第二則根留言']);
 assert.equal(bindings.find(x=>x.text==='較舊的動態')?.id,ids.older);
 assert.deepEqual(bindings.find(x=>x.text==='較舊的動態')?.comments,['舊動態留言']);

 await page.evaluate(()=>{
  const list=document.querySelector('.moment-card')?.parentElement;
  const cards=[...document.querySelectorAll('.moment-card')];
  list.append(cards[0]);
 });
 await page.waitForTimeout(100);
 await page.evaluate(()=>{OCLifeMomentThreads.renderAll();OCLifeMomentWeChatUI.render()});
 bindings=await page.evaluate(()=>[...document.querySelectorAll('.moment-card')].map(card=>({id:card.dataset.momentId,text:card.querySelector('.moment-text')?.textContent,comments:[...card.querySelectorAll('.oc-thread-text')].map(x=>x.textContent)})));
 assert.equal(bindings.find(x=>x.text==='較新的動態')?.id,ids.newer,'DOM reorder changed newer moment identity');
 assert.equal(bindings.find(x=>x.text==='較舊的動態')?.id,ids.older,'DOM reorder changed older moment identity');
 assert.deepEqual(bindings.find(x=>x.text==='較新的動態')?.comments,['第一則根留言','回覆第一則','第二則根留言'],'DOM reorder moved replies to another moment');

 const newerCard=page.locator(`.moment-card[data-moment-id="${ids.newer}"]`);
 await newerCard.locator('[data-thread-comment="new-child"]').click();
 await page.waitForSelector('#threadSend');
 assert.match(await page.locator('.oc-thread-quote').textContent(),/回覆第一則/,'nested reply tap targeted the wrong comment');
 await page.locator('#threadText').fill('只應該留在新動態');
 await page.locator('#threadSend').click();
 await page.waitForFunction(()=>!document.getElementById('threadSend'));
 const stored=await page.evaluate(({older,newer})=>({older:OCLifeStore.get('moments',older).comments.map(x=>x.text),newer:OCLifeStore.get('moments',newer).comments.map(x=>x.text)}),ids);
 assert.deepEqual(stored.older,['舊動態留言'],'reply leaked into another moment');
 assert.equal(stored.newer.at(-1),'只應該留在新動態','reply was not stored on its original moment');
 assert.deepEqual(pageErrors,[]);
 console.log('Moment reply binding WebKit smoke test passed.');
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
