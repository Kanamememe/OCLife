(function(){
'use strict';
const VERSION='2.3.0';
const REQUIRED=[
 ['資料庫','OCLifeStore',['all','get','add','update','remove','save']],
 ['AI','OCLifeAI',['call','listModels']],
 ['主程式','OCLifePhone',['openHome']],
 ['世界狀態','OCLifeWorldContext',['get','set','clear']],
 ['世界資料編輯','OCLifeWorldEditor',['open','decorate','canEdit']],
 ['設定','OCLifeProviderSettings',['open']],
 ['角色編輯','OCLifeCharacterEditor',['edit','delete']],
 ['寫作','OCLifeWritingStudio',['open','library']],
 ['IF線','OCLifeIFStudio',['open','library']],
 ['事件簿','OCLifeEvents',['open','createEvent']],
 ['動態留言','OCLifeMomentThreads',['openComposer','renderAll']],
 ['朋友圈介面','OCLifeMomentWeChatUI',['render']],
 ['提問箱','OCLifeQuestionBox',['open']],
 ['共享世界','OCLifeSharedWorlds',['openJoin','openManager','syncWorld']],
 ['共享安全層','OCLifeSharedAudit',['pendingCount','clearPending']],
 ['共享完整性','OCLifeSharedIntegrity',['take','restoreWorld','copyPrivate']],
 ['公告','OCLifeAnnouncements',['open']],
 ['公告評論','OCLifeAnnouncementComments',['mountAll']]
];
let errors=[];
function inspect(){
 const missing=[];
 for(const[name,key,methods]of REQUIRED){
  const value=window[key];
  if(!value){missing.push(`${name}（${key} 未載入）`);continue}
  for(const method of methods||[])if(typeof value[method]!=='function')missing.push(`${name}（${key}.${method} 缺失）`)
 }
 const store=window.OCLifeStore?.data;
 if(store){for(const collection of ['worlds','characters','statuses','chats','messages','moments','events','ifLines','writings','questions'])if(!Array.isArray(store[collection]))missing.push(`資料庫集合 ${collection} 無效`)}
 const shared=window.OCLifeSharedAudit;
 if(shared&&Number(shared.expectedSchema||0)<2)missing.push('共享安全層資料庫版本要求無效');
 return missing;
}
function check(show=false){errors=inspect();document.documentElement.dataset.ocHealth=errors.length?'error':'ok';if(errors.length){console.error('[OC Life] health check:',errors.join(', '));if(show){const text='部分功能載入失敗：'+errors.join('、')+'。請重新整理到最新版；若仍存在，請回報這段文字。';window.OCLifeAutoLife?.toast?.(text,{error:true,sticky:true})||alert(text)}}return{ok:!errors.length,missing:[...errors]}}
function install(){setTimeout(()=>check(true),2300);window.addEventListener('error',event=>{if(event?.filename&&/\/js\//.test(event.filename))console.error('[OC Life] script error',event.filename,event.message)},true);window.addEventListener('unhandledrejection',event=>console.error('[OC Life] unhandled promise rejection',event.reason))}
window.OCLifeHealth={version:VERSION,check,get errors(){return[...errors]}};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})();
