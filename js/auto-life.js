(function(){
'use strict';
const VERSION='1.1.0',S=window.OCLifeStore;
const KEY='oclife_auto_life_settings';
const defaults={enabled:true,minMinutes:8,maxMinutes:22,chat:true,moment:true,status:true,chatWeight:70,momentWeight:30,quietStart:1,quietEnd:7,catchUp:true,toast:true};
let timer=null,busy=false;
function settings(){try{return{...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch(_){return{...defaults}}}
function save(x){localStorage.setItem(KEY,JSON.stringify({...settings(),...x}));schedule()}
function worldId(){return window.OCLifeWorldContext?.get?.()||window.OCLifePhone?.activeWorldId||null}
function delayMs(s){const a=Math.max(1,Number(s.minMinutes)||8),b=Math.max(a,Number(s.maxMinutes)||22);return(a+Math.random()*(b-a))*60000}
function quiet(s){const h=new Date().getHours(),a=Number(s.quietStart),b=Number(s.quietEnd);if(a===b)return false;return a<b?(h>=a&&h<b):(h>=a||h<b)}
function toast(text){if(!settings().toast||!text)return;let box=document.getElementById('oclifeAutoToast');if(!box){box=document.createElement('div');box.id='oclifeAutoToast';box.style.cssText='position:fixed;left:50%;top:calc(12px + env(safe-area-inset-top));transform:translateX(-50%) translateY(-16px);z-index:9999;max-width:min(92vw,520px);padding:11px 16px;border-radius:16px;background:rgba(37,35,31,.92);color:white;font-size:13px;box-shadow:0 12px 30px rgba(0,0,0,.22);backdrop-filter:blur(14px);opacity:0;transition:.22s ease;pointer-events:none;text-align:center';document.body.appendChild(box)}box.textContent=text;requestAnimationFrame(()=>{box.style.opacity='1';box.style.transform='translateX(-50%) translateY(0)'});clearTimeout(box._t);box._t=setTimeout(()=>{box.style.opacity='0';box.style.transform='translateX(-50%) translateY(-16px)'},2600)}
function namesFromMessages(made){return [...new Set((made||[]).map(m=>S.get('characters',m.senderId)?.name).filter(Boolean))]}
async function run(reason='timer'){
 const s=settings(),wid=worldId();if(!s.enabled||busy||!wid||quiet(s))return false;
 const chars=S.all('characters',{worldId:wid});if(!chars.length)return false;busy=true;
 try{
  let statusTouched=false;if(s.status&&window.OCLifeSimulator?.tickStatuses){window.OCLifeSimulator.tickStatuses(wid);statusTouched=true}
  const cw=s.chat?Math.max(0,Number(s.chatWeight)||0):0,mw=s.moment?Math.max(0,Number(s.momentWeight)||0):0,total=cw+mw;
  let type='status',payload=null;
  if(total>0){const r=Math.random()*total;if(r<cw&&chars.length>1){payload=await window.OCLifeSimulator.autonomousChat(wid);type=payload?.length?'chat':'status'}else if(s.moment){payload=await window.OCLifeSimulator.autonomousMoment(wid);type=payload?'moment':'status'}}
  let text='';if(type==='chat'){const ns=namesFromMessages(payload);text=ns.length>=2?`${ns.slice(0,2).join(' 和 ')}剛聊了幾句`:'剛新增了一段角色聊天'}else if(type==='moment'){const c=S.get('characters',payload.characterId);text=`${c?.name||'角色'}發了一條新動態`}else if(statusTouched)text='角色的「現在」狀態已更新';
  toast(text);window.dispatchEvent(new CustomEvent('oclife:auto-life-generated',{detail:{worldId:wid,reason,type,text}}));return true;
 }catch(e){console.warn('[OC Life] auto life:',e);return false}finally{busy=false}
}
function schedule(){clearTimeout(timer);const s=settings();if(!s.enabled)return;timer=setTimeout(async()=>{await run('timer');schedule()},delayMs(s))}
function catchUp(){const s=settings(),wid=worldId();if(!s.enabled||!s.catchUp||!wid)return;const k='oclife_auto_last_'+wid,last=Number(localStorage.getItem(k)||0),now=Date.now();localStorage.setItem(k,String(now));if(last&&now-last>Math.max(15,s.minMinutes)*60000&&!quiet(s))setTimeout(()=>run('return'),1200)}
function install(){schedule();document.addEventListener('click',e=>{if(e.target.closest?.('[data-world],[data-oc-app]'))setTimeout(catchUp,120)});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){catchUp();schedule()}})}
window.OCLifeAutoLife={version:VERSION,settings,save,runNow:()=>run('manual'),schedule,toast};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})();