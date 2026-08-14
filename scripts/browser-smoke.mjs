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
 await page.waitForFunction(()=>window.OCLifeHealth?.check?.().ok===true&&window.OCLifeSharedAudit?.expectedSchema===2,null,{timeout:10000});
 const worldId=await page.evaluate(()=>{
  const world=OCLifeStore.createWorld({name:'Smoke 世界',emoji:'◈',summary:'瀏覽器測試世界'});
  OCLifeStore.createCharacter({worldId:world.id,name:'甲',gender:'男',age:'25',personality:'冷靜',speech:'簡短'});
  OCLifeStore.createCharacter({worldId:world.id,name:'乙',gender:'男',age:'24',personality:'活潑',speech:'自然'});
  Object.assign(OCLifeStore.data.settings,{provider:'custom',baseUrl:'https://example.test/v1',apiKey:'local-test',model:'test-model'});
  OCLifeStore.save();OCLifeWorldContext.set(world.id);OCLifePhone.openHome(world.id);
  OCLifeAI.call=async config=>{const text=String(config?.messages?.at(-1)?.content||'');if(text.includes('建立OC IF線'))return JSON.stringify({theme:'測試 IF',title:'測試標題',characters:[{name:'甲',personality:'冷靜',identity:'學生',age:'25'},{name:'乙',personality:'活潑',identity:'學生',age:'24'}],body:'IF 正文測試'});if(text.includes('匿名OC提問箱'))return JSON.stringify({answers:[{character:'甲',text:'甲的回答'},{character:'乙',text:'乙的回答'}]});return '短文正文測試'};
  return world.id;
 });
 const uuid=await page.evaluate(()=>crypto.randomUUID());assert.match(uuid,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
 await page.locator('[data-oc-app="writing"]').click();await page.locator('#writeSource').fill('一起看煙火');await page.locator('#writeGenerate').click();await page.waitForFunction(()=>document.getElementById('writeResult')?.textContent?.includes('短文正文測試'));await page.locator('#writeSave').click();assert.equal(await page.evaluate(()=>OCLifeStore.all('writings').length),1);await page.locator('#writeClose').click();
 await page.evaluate(id=>OCLifePhone.openHome(id),worldId);await page.locator('[data-oc-app="if"]').click();await page.locator('#ifIdea').fill('如果他們都是大學生');await page.locator('#ifGo').click();await page.waitForFunction(()=>document.getElementById('ifResult')?.textContent?.includes('IF 正文測試'));await page.locator('#ifSave').click();assert.equal(await page.evaluate(()=>OCLifeStore.all('ifLines').length),1);await page.locator('#ifClose').click();
 await page.evaluate(id=>OCLifePhone.openHome(id),worldId);await page.waitForSelector('[data-oc-question-box]');await page.locator('[data-oc-question-box] button').click();await page.locator('#qbQuestion').fill('你們現在心情如何？');await page.locator('#qbAsk').click();await page.waitForFunction(()=>document.getElementById('qbHistory')?.textContent?.includes('甲的回答'));await page.locator('#qbClose').click();
 await page.locator('#settingsBtn').click();await page.waitForSelector('#apiProvider');assert.equal(await page.locator('#modalRoot h2').textContent(),'設定');await page.locator('#apiCancel').click();
 await page.evaluate(id=>OCLifePhone.openHome(id),worldId);await page.waitForSelector('[data-oc-shared-app]');await page.locator('[data-oc-shared-app] button').click();await page.waitForFunction(()=>document.getElementById('modalRoot')?.textContent?.includes('建立共享世界'));await page.locator('.oc-shared-close').click();
 await page.evaluate(()=>OCLifeSharedWorlds.openSetup('smoke test'));await page.waitForFunction(()=>document.getElementById('modalRoot')?.textContent?.includes('初始化共享世界'));assert.equal(await page.evaluate(()=>OCLifeSharedSetupFix.files.includes('./supabase/shared-worlds-v2.sql')),true);await page.locator('.oc-shared-close').click();
 const health=await page.evaluate(()=>OCLifeHealth.check());assert.equal(health.ok,true,health.missing?.join(', '));assert.deepEqual(pageErrors,[]);console.log('WebKit smoke test passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
