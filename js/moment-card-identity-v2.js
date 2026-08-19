(function(){
'use strict';
const VERSION='1.0.0',S=window.OCLifeStore;
let queued=false;
function worldId(){return window.OCLifeWorldContext?.get?.()||window.OCLifePhone?.activeWorldId||window.OCLifeApp?.worldId||null}
function bind(){queued=false;if(document.getElementById('pageTitle')?.textContent!=='動態')return;const wid=worldId(),view=document.getElementById('view');if(!wid||!view)return;const moments=S.all('moments',{worldId:wid}).sort((a,b)=>(b.at||0)-(a.at||0)),cards=[...view.querySelectorAll('.moment-card')];let changed=false;cards.forEach((card,index)=>{const current=card.dataset.momentId?S.get('moments',card.dataset.momentId):null;if(current?.worldId===wid)return;const m=moments[index];if(!m)return;card.dataset.momentId=m.id;changed=true});if(changed)requestAnimationFrame(()=>{window.OCLifeMomentThreads?.renderAll?.();window.OCLifeMomentWeChatUI?.render?.();window.OCLifePhotoMoments?.render?.()})}
function queue(){if(queued)return;queued=true;requestAnimationFrame(bind)}
function install(){const view=document.getElementById('view')||document.body;new MutationObserver(queue).observe(view,{childList:true,subtree:true});window.addEventListener('oclife:change',queue);setTimeout(queue,120)}
window.OCLifeMomentCardIdentity={version:VERSION,bind};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})();