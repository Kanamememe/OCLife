(function(){
'use strict';
const VERSION='20260819-1';
const item={id:VERSION,type:'update',version:VERSION,date:'2026-08-19',title:'角色主線評議與圖片動態修復',summary:'角色現在能閱讀並評價自己的主線；圖片動態修復實際發佈流程，並新增指定發文者與角色專屬照片。',items:['手機世界首頁新增「主線評議」：貼上主線原文後，可讓全員或指定角色以本人語氣發表讀後感。','主線評議提供「知道這是自己的故事」與「視為親身經歷」兩種閱讀方式，結果可儲存到世界收藏。','圖片動態修復發佈後沒有出現在動態頁、照片沒有掛到正確卡片的問題。','圖片動態現在明確要求或允許指定發文角色，也可讓 AI 只在有權使用照片的角色中自動選角。','圖片動態正文可以留空，支援只發照片。','照片設定新增角色範圍：所有角色、屏蔽指定角色、僅限指定角色；可將照片設成某位 OC 的專屬照片。','角色限制只控制之後誰能使用照片，不會刪除已經發布的圖片動態。','新增圖片實際發佈、角色專屬權限與主線評議 WebKit 回歸測試。']};
const original=window.fetch.bind(window);
window.fetch=async function(input,init){const response=await original(input,init);try{const url=typeof input==='string'?input:input?.url||'';if(!/announcements\.json(?:[?#]|$)/.test(url)||!response.ok)return response;const data=await response.clone().json();if(!data||!Array.isArray(data.announcements)||data.announcements.some(x=>x?.id===VERSION))return response;const merged={...data,latest:VERSION,announcements:[item,...data.announcements]};return new Response(JSON.stringify(merged),{status:response.status,statusText:response.statusText,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}catch(_){return response}};
window.OCLifeReleaseNotice20260819={version:VERSION};
})();