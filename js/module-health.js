(function(){
'use strict';
const VERSION='1.0.0';
const REQUIRED=[
 ['資料庫','OCLifeStore'],['AI','OCLifeAI'],['主程式','OCLifePhone'],['世界狀態','OCLifeWorldContext'],
 ['設定','OCLifeProviderSettings'],['角色編輯','OCLifeCharacterEditor'],['寫作','OCLifeWritingStudio'],
 ['IF線','OCLifeIFStudio'],['動態留言','OCLifeMomentThreads'],['提問箱','OCLifeQuestionBox']
];
let errors=[];
function check(show=false){const missing=REQUIRED.filter(([,key])=>!window[key]);errors=missing.map(([name,key])=>`${name}（${key}）`);document.documentElement.dataset.ocHealth=missing.length?'error':'ok';if(missing.length){console.error('[OC Life] missing modules:',errors.join(', '));if(show){const text='部分功能載入失敗：'+errors.join('、')+'。請先重新整理到最新版；若仍存在，請回報這段文字。';window.OCLifeAutoLife?.toast?.(text,{error:true,sticky:true})||alert(text)}}return{ok:!missing.length,missing:errors}}
function install(){setTimeout(()=>check(true),1800);window.addEventListener('error',e=>{if(e?.filename&&/\/js\//.test(e.filename))console.error('[OC Life] script error',e.filename,e.message)},true)}
window.OCLifeHealth={version:VERSION,check,get errors(){return [...errors]}};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})();
