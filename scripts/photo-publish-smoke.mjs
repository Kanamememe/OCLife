import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {webkit} from 'playwright';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),rel=pathname==='/'?'index.html':pathname.replace(/^\/+/,''),file=path.resolve(root,rel);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return}res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await webkit.launch({headless:true}),page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('oclife_boot_animation_v1','0');localStorage.setItem('oclife_onboarding_v1','done');localStorage.setItem('oclife_announcement_settings_v1',JSON.stringify({mode:'never'}));localStorage.setItem('oclife_update_settings_v1',JSON.stringify({auto:false}));localStorage.setItem('oclife_auto_life_settings',JSON.stringify({enabled:false,toast:false}));localStorage.setItem('oclife_moment_threads_v1',JSON.stringify({enabled:false}))});
await page.route('https://ngkcxzsjhftsfalpqjuu.supabase.co/**',async route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/`,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>window.OCLifePhotoMoments?.version?.startsWith('2.')&&window.OCLifeApp&&window.OCLifeStore);
 const ids=await page.evaluate(async()=>{const w=OCLifeStore.createWorld({name:'圖片發佈測試'}),a=OCLifeStore.createCharacter({worldId:w.id,name:'專屬角色'}),b=OCLifeStore.createCharacter({worldId:w.id,name:'被屏蔽角色'}),photoId='exclusive-photo';localStorage.setItem('oclife_photo_library_meta_v1',JSON.stringify([{id:photoId,name:'exclusive.png',type:'image/png',createdAt:Date.now(),visibilityMode:'all',worldIds:[],characterMode:'only',characterIds:[a.id],locationName:'測試地點',sceneNote:''}]));const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('oclife_photo_library_v1',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('photos'))r.result.createObjectStore('photos',{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});await new Promise((resolve,reject)=>{const tx=db.transaction('photos','readwrite');tx.objectStore('photos').put({id:photoId,bytes:new Uint8Array([137,80,78,71,13,10,26,10]).buffer,type:'image/png'});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();OCLifeApp.openWorld(w.id,'moments',true);return{w:w.id,a:a.id,b:b.id,photoId}});
 await page.waitForSelector('#photoMomentOpen');await page.click('#photoMomentOpen');await page.waitForSelector('.oc-photo-card [data-use]');
 assert.match(await page.locator('.oc-photo-card').textContent(),/專屬角色：專屬角色/);
 await page.click('.oc-photo-card [data-use]');await page.waitForSelector('#postChar');
 const options=await page.locator('#postChar option').allTextContents();assert.ok(options.some(x=>x.includes('專屬角色')));assert.ok(!options.some(x=>x.includes('被屏蔽角色')),'blocked character appeared as a poster option');
 await page.selectOption('#postChar',ids.a);await page.click('#postSend');
 await page.waitForFunction(photoId=>OCLifeStore.all('moments').some(m=>m.photoId===photoId),ids.photoId);
 const saved=await page.evaluate(photoId=>OCLifeStore.all('moments').find(m=>m.photoId===photoId),ids.photoId);assert.equal(saved.characterId,ids.a);assert.equal(saved.text,'','image-only post should be allowed');
 await page.waitForFunction(id=>document.querySelector(`.moment-card[data-moment-id="${id}"] .oc-photo-moment`),saved.id);
 assert.match(await page.locator(`.moment-card[data-moment-id="${saved.id}"] .oc-photo-moment`).textContent(),/測試地點/);
 const permissions=await page.evaluate(({photoId,a,b})=>{const p=OCLifePhotoMoments.getMeta(photoId);return{a:OCLifePhotoMoments.characterAllowed(p,a),b:OCLifePhotoMoments.characterAllowed(p,b)}},ids);assert.deepEqual(permissions,{a:true,b:false});
 assert.deepEqual(errors,[]);console.log('Photo publish and character exclusivity WebKit smoke test passed.');
}finally{await browser.close();await new Promise(r=>server.close(r))}
