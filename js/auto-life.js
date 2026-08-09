(function(){
'use strict';
const VERSION='1.0.0',S=window.OCLifeStore;
const KEY='oclife_auto_life_settings';
const defaults={enabled:true,minMinutes:8,maxMinutes:22,chat:true,moment:true,status:true,quietStart:1,quietEnd:7};
let timer=null,busy=false;
function settings(){try{return{...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch(_){return{...defaults}}}
function save(x){localStorage.setItem(KEY,JSON.stringify({...settings(),...x}));schedule()}
function worldId(){return window.OCLifeWorldContext?.get?.()||window.OCLifePhone?.activeWorldId||null}
function delayMs(s){const a=Math.max(1,Number(s.minMinutes)||8),b=Math.max(a,Number(s.maxMinutes)||22);return(a+Math.random()*(b-a))*60000}
function quiet(s){const h=new Date().getHours(),a=Number(s.quietStart),b=Number(s.quietEnd);if(a===b)return false;return a<b?(h>=a&&h<b):(h>=a||h<b)}
async function run(reason='timer'){
 const s=settings(),wid=worldId();if(!s.enabled||busy||!wid||quiet(s))return false;
 const chars=S.all('characters',{worldId:wid});if(!chars.length)return false;busy=true;
 try{
  if(s.status&&window.OCLifeSimulator?.tickStatuses)window.OCLifeSimulator.tickStatuses(wid);
  const r=Math.random();
  if(s.chat&&chars.length>1&&(r<.72||!s.moment))await window.OCLifeSimulator.autonomousChat(wid);
  else if(s.moment&&window.OCLifeSimulator?.autonomousMoment)window.OCLifeSimulator.autonomousMoment(wid);
  window.dispatchEvent(new CustomEvent('oclife:auto-life-generated',{detail:{worldId:wid,reason}}));return true;
 }catch(e){console.warn('[OC Life] auto life:',e);return false}finally{busy=false}
}
function schedule(){clearTimeout(timer);const s=settings();if(!s.enabled)return;timer=setTimeout(async()=>{await run('timer');schedule()},delayMs(s))}
function catchUp(){const s=settings(),wid=worldId();if(!s.enabled||!wid)return;const k='oclife_auto_last_'+wid,last=Number(localStorage.getItem(k)||0),now=Date.now();localStorage.setItem(k,String(now));if(last&&now-last>Math.max(15,s.minMinutes)*60000&&!quiet(s))setTimeout(()=>run('return'),1200)}
function install(){schedule();document.addEventListener('click',e=>{if(e.target.closest?.('[data-world],[data-oc-app]'))setTimeout(catchUp,120)});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){catchUp();schedule()}});window.addEventListener('oclife:change',()=>{});}
window.OCLifeAutoLife={version:VERSION,settings,save,runNow:()=>run('manual'),schedule};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})();