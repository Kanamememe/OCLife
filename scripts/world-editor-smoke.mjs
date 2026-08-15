import assert from 'node:assert/strict';
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
 await page.waitForFunction(()=>window.OCLifeHealth?.check?.().ok===true&&window.OCLifeWorldEditor?.version,null,{timeout:10000});
 const privateId=await page.evaluate(()=>{
  const world=OCLifeStore.createWorld({name:'原世界',emoji:'✦',summary:'舊簡介',era:'現代',location:'台北',tone:'安靜',rules:'舊規則'});
  OCLifeApp.openWorld(world.id,'world',true);
  return world.id;
 });
 await page.waitForSelector('#worldEditOpen:not([disabled])');
 await page.locator('#worldEditOpen').click();
 await page.locator('#worldEditName').fill('重新命名的世界');
 await page.locator('#worldEditEmoji').fill('◇');
 await page.locator('#worldEditEra').fill('近未來');
 await page.locator('#worldEditLocation').fill('新台北');
 await page.locator('#worldEditSummary').fill('更新後的世界簡介');
 await page.locator('#worldEditTone').fill('冷色科技感，角色關係仍然溫暖');
 await page.locator('#worldEditRules').fill('所有角色必須遵守新的世界規則');
 await page.locator('#worldEditorSave').click();
 await page.waitForFunction(()=>!document.getElementById('worldEditorModal'));
 const edited=await page.evaluate(id=>({world:OCLifeStore.get('worlds',id),active:OCLifeApp.worldId,tab:OCLifeApp.tab}),privateId);
 assert.equal(edited.world.name,'重新命名的世界');
 assert.equal(edited.world.emoji,'◇');
 assert.equal(edited.world.era,'近未來');
 assert.equal(edited.world.location,'新台北');
 assert.equal(edited.world.summary,'更新後的世界簡介');
 assert.equal(edited.world.tone,'冷色科技感，角色關係仍然溫暖');
 assert.equal(edited.world.rules,'所有角色必須遵守新的世界規則');
 assert.equal(edited.active,privateId,'save left the current world');
 assert.equal(edited.tab,'world','save left the world-data tab');
 await page.waitForFunction(()=>document.getElementById('worldToneInfoValue')?.textContent?.includes('冷色科技感'));

 const shared=await page.evaluate(()=>{
  const editor=OCLifeStore.createWorld({name:'朋友共享世界'});
  const owner=OCLifeStore.createWorld({name:'我的共享世界'});
  OCLifeStore.update('worlds',editor.id,{sharedWorldId:'11111111-1111-4111-8111-111111111111',sharedRole:'editor'});
  OCLifeStore.update('worlds',owner.id,{sharedWorldId:'22222222-2222-4222-8222-222222222222',sharedRole:'owner'});
  localStorage.setItem('oclife_shared_credentials_v1',JSON.stringify({
   '11111111-1111-4111-8111-111111111111':{memberId:'member-editor',memberName:'Editor',role:'editor',token:'editor-token'},
   '22222222-2222-4222-8222-222222222222':{memberId:'member-owner',memberName:'Owner',role:'owner',token:'owner-token'}
  }));
  OCLifeApp.openWorld(editor.id,'world',true);
  return{editor:editor.id,owner:owner.id};
 });
 await page.waitForSelector('#worldEditOpen[disabled]');
 assert.equal((await page.locator('#worldEditOpen').textContent()).trim(),'僅建立者可編輯');
 assert.equal((await page.locator('#deleteWorld').textContent()).trim(),'共享管理');
 assert.match(await page.locator('#worldEditPermissionNote').textContent(),/只有建立者能修改/);

 await page.evaluate(id=>OCLifeApp.openWorld(id,'world',true),shared.owner);
 await page.waitForSelector('#worldEditOpen:not([disabled])');
 await page.locator('#worldEditOpen').click();
 await page.locator('#worldEditSummary').fill('建立者可以重新編輯並同步');
 await page.locator('#worldEditorSave').click();
 await page.waitForFunction(()=>!document.getElementById('worldEditorModal'));
 assert.equal(await page.evaluate(id=>OCLifeStore.get('worlds',id).summary,shared.owner),'建立者可以重新編輯並同步');
 assert.deepEqual(pageErrors,[]);
 console.log('World data editor WebKit smoke test passed.');
}finally{
 await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
