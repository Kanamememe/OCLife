(function(){
'use strict';
const VERSION='20260817-1';
const item={id:VERSION,type:'update',version:VERSION,date:'2026-08-17',title:'照片批量上傳與提問記憶',summary:'全域照片庫支援一次多選多張照片；提問箱新增可控的 OC 記憶層級，重要提問可成為聊天與動態的長期角色記憶。',items:['照片選擇器支援一次多選多張圖片，每張照片分別解析 EXIF GPS。','整批照片會逐張穩定寫入 IndexedDB，並可一次套用「所有世界／屏蔽指定世界／僅限指定世界」。','批量上傳加入進度提示，個別照片仍可之後修改位置、畫面補充與世界可見範圍。','提問箱新增「不記憶／一般記憶／重要記憶」三種層級，新提問可在送出前選擇。','既有提問可以事後修改記憶層級，不需要刪除提問紀錄。','不記憶的提問不再進入角色上下文；一般記憶只維持提問箱近期連續性。','重要記憶會進入角色長期上下文，聊天與自動動態可自然引用；改回不記憶後會立即移除。','新增提問記憶 WebKit 回歸測試，並與照片批量上傳、動態回覆、共享世界與 PostgreSQL 測試一起列為發布門檻。']};
const original=window.fetch.bind(window);
window.fetch=async function(input,init){const response=await original(input,init);try{const url=typeof input==='string'?input:input?.url||'';if(!/announcements\.json(?:[?#]|$)/.test(url)||!response.ok)return response;const data=await response.clone().json();if(!data||!Array.isArray(data.announcements)||data.announcements.some(x=>x?.id===VERSION))return response;const merged={...data,latest:VERSION,announcements:[item,...data.announcements]};return new Response(JSON.stringify(merged),{status:response.status,statusText:response.statusText,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}catch(_){return response}};
window.OCLifeReleaseNotice20260817={version:VERSION};
})();