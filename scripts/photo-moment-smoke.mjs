import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {webkit} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const server=http.createServer((req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),rel=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return}res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res)}catch(error){res.writeHead(500);res.end(String(error))}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const {port}=server.address();
const browser=await webkit.launch({headless:true});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{
 localStorage.setItem('oclife_boot_animation_v1','0');
 localStorage.setItem('oclife_onboarding_v1','done');
 localStorage.setItem('oclife_announcement_settings_v1',JSON.stringify({mode:'never'}));
 localStorage.setItem('oclife_update_settings_v1',JSON.stringify({auto:false}));
 localStorage.setItem('oclife_auto_life_settings',JSON.stringify({enabled:false,toast:false}));
 localStorage.setItem('oclife_moment_threads_v1',JSON.stringify({enabled:false}));
});
await page.route('https://ngkcxzsjhftsfalpqjuu.supabase.co/**',async route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
try{
 await page.goto(`http://127.0.0.1:${port}/`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.OCLifePhotoMoments?.version&&window.OCLifeStore&&window.OCLifeApp);
 const ids=await page.evaluate(()=>{
  const a=OCLifeStore.createWorld({name:'照片世界 A'}),b=OCLifeStore.createWorld({name:'照片世界 B'}),c=OCLifeStore.createCharacter({worldId:a.id,name:'測試角色'});
  const list=[
   {id:'global-photo',name:'global.jpg',visibilityMode:'all',worldIds:[],createdAt:Date.now()},
   {id:'exclude-photo',name:'exclude.jpg',visibilityMode:'exclude',worldIds:[b.id],createdAt:Date.now()},
   {id:'only-photo',name:'only.jpg',visibilityMode:'only',worldIds:[a.id],createdAt:Date.now()}
  ];
  localStorage.setItem('oclife_photo_library_meta_v1',JSON.stringify(list));
  const m=OCLifeStore.add('moments',{worldId:a.id,characterId:c.id,text:'附圖動態',at:Date.now(),likes:[],comments:[],photoId:'global-photo',photoLocation:'測試地點'});
  OCLifeApp.openWorld(a.id,'moments',true);
  return{a:a.id,b:b.id,m:m.id};
 });
 await page.waitForSelector('#photoMomentOpen');
 const visibility=await page.evaluate(ids=>{
  const all=JSON.parse(localStorage.getItem('oclife_photo_library_meta_v1'));
  const [g,e,o]=all;
  return{
   globalA:OCLifePhotoMoments.visibleFor(g,ids.a),globalB:OCLifePhotoMoments.visibleFor(g,ids.b),
   excludeA:OCLifePhotoMoments.visibleFor(e,ids.a),excludeB:OCLifePhotoMoments.visibleFor(e,ids.b),
   onlyA:OCLifePhotoMoments.visibleFor(o,ids.a),onlyB:OCLifePhotoMoments.visibleFor(o,ids.b)
  };
 },ids);
 assert.deepEqual(visibility,{globalA:true,globalB:true,excludeA:true,excludeB:false,onlyA:true,onlyB:false});
 await page.waitForFunction(id=>/測試地點|照片檔已遺失/.test(document.querySelector(`.moment-card[data-moment-id="${id}"] .oc-photo-moment`)?.textContent||''),ids.m);
 assert.match(await page.locator(`.moment-card[data-moment-id="${ids.m}"] .oc-photo-moment`).textContent(),/測試地點|照片檔已遺失/);
 await page.evaluate(({a,m})=>{
  const list=JSON.parse(localStorage.getItem('oclife_photo_library_meta_v1'));list[0].visibilityMode='exclude';list[0].worldIds=[a];localStorage.setItem('oclife_photo_library_meta_v1',JSON.stringify(list));window.dispatchEvent(new CustomEvent('oclife:photo-library-change'));OCLifePhotoMoments.render();
 },ids);
 await page.waitForFunction(id=>/屏蔽/.test(document.querySelector(`.moment-card[data-moment-id="${id}"] .oc-photo-moment`)?.textContent||''),ids.m);
 assert.deepEqual(errors,[]);
 console.log('Photo moment WebKit smoke test passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
