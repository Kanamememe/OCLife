(function(){
'use strict';
const BUILD='2026.08.11.5',S=window.OCLifeStore;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let nativeNew=null,nativeImport=null,nativeExport=null,nativeCards=new Map(),rendering=false;

function showTransition(world){
  document.getElementById('ocWorldTransition')?.remove();
  const el=document.createElement('div');el.id='ocWorldTransition';el.setAttribute('aria-hidden','true');
  el.innerHTML=`<style>#ocWorldTransition{position:fixed;inset:0;z-index:20000;display:grid;place-items:center;background:radial-gradient(circle at 50% 48%,rgba(28,111,255,.24),transparent 30%),#030815;color:#cfe6ff;pointer-events:none;animation:gwLife .76s ease forwards}.gw-box{width:min(340px,82vw);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.gw-code{font-size:9px;letter-spacing:.16em;color:#5590d1;margin-bottom:18px}.gw-name{font:700 22px system-ui,sans-serif;color:#f2f7ff;margin-bottom:5px}.gw-meta{font-size:9px;color:#688bb3;margin-bottom:18px}.gw-track{height:2px;background:#12233e;overflow:hidden}.gw-bar{height:100%;width:0;background:linear-gradient(90deg,#246dff,#68dcff);box-shadow:0 0 12px #278fff;animation:gwBar .44s cubic-bezier(.2,.75,.2,1) forwards}.gw-status{display:flex;justify-content:space-between;margin-top:8px;font-size:8px;color:#5d8dc4;letter-spacing:.08em}.gw-ring{width:80px;height:80px;border:1px solid rgba(73,156,255,.16);border-radius:50%;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);box-shadow:0 0 0 18px rgba(51,132,255,.025),0 0 0 36px rgba(51,132,255,.012)}@keyframes gwBar{to{width:100%}}@keyframes gwLife{0%{opacity:0}12%,70%{opacity:1}100%{opacity:0;visibility:hidden}}</style><div class="gw-ring"></div><div class="gw-box"><div class="gw-code">WORLD_LINK // CONTEXT SYNCHRONIZED</div><div class="gw-name">${esc(world.name)}</div><div class="gw-meta">${esc(world.era||'UNKNOWN ERA')} · ${S.all('characters',{worldId:world.id}).length} CHARACTERS</div><div class="gw-track"><div class="gw-bar"></div></div><div class="gw-status"><span>WORLD INTERFACE READY</span><span>100%</span></div></div>`;
  document.body.appendChild(el);el.addEventListener('animationend',e=>{if(e.animationName==='gwLife')el.remove()},{once:true});setTimeout(()=>el.remove(),1000);
}

function directEnter(id){
  const world=S.get('worlds',id);if(!world)return false;
  try{window.OCLifeWorldContext?.set?.(id)}catch(_){}
  try{window.OCLifeApp?.setWorld?.(id)}catch(e){console.error('[OC Life] core world sync failed',e)}
  document.body.classList.remove('oc-system-worlds');
  let opened=false;
  try{if(typeof window.OCLifePhone?.openHome==='function'){window.OCLifePhone.openHome(id);opened=!!document.querySelector('.oc-phone-home')}}catch(e){console.error('[OC Life] phone home failed',e)}
  if(!opened){try{opened=!!window.OCLifeApp?.openWorld?.(id,'now',true)}catch(e){console.error('[OC Life] core world open failed',e)}}
  if(!opened){try{nativeCards.get(id)?.click();opened=true}catch(e){console.error('[OC Life] native fallback failed',e)}}
  showTransition(world);return opened;
}

function enhance(){
  if(rendering)return;const view=document.getElementById('view');
  if(!view||document.getElementById('pageTitle')?.textContent!=='我的世界')return;
  const cards=[...view.querySelectorAll('[data-world]')],newBtn=document.getElementById('newWorld');if(!cards.length&&!newBtn)return;
  rendering=true;nativeNew=newBtn||nativeNew;nativeImport=document.getElementById('importBtn')||nativeImport;nativeExport=document.getElementById('exportBtn')||nativeExport;if(cards.length)nativeCards=new Map(cards.map(x=>[x.dataset.world,x]));
  document.body.classList.add('oc-system-worlds');const worlds=S.all('worlds');
  view.innerHTML=`<section class="system-world-shell"><div class="system-console"><div class="system-console-head"><div><div class="eyebrow">OC LIFE / WORLD SYSTEM</div><h2>世界管理終端</h2><p>每個世界都是獨立運行區。角色、記憶、聊天與事件不跨區域混用。</p></div><span class="system-online">SYSTEM ONLINE</span></div></div><div class="system-actions"><button class="primary" id="sysNewWorld">＋ 建立世界</button><button id="sysImport">IMPORT</button><button id="sysExport">EXPORT</button></div><div class="system-section-label">ACTIVE WORLDS · ${worlds.length}</div><div class="system-grid">${worlds.map((w,i)=>`<article class="system-world-card" data-sys-world="${w.id}"><div class="system-world-index">WORLD_${String(i+1).padStart(2,'0')}</div><h3>${esc(w.name)}</h3><div class="system-world-meta">${esc(w.era||'時代未設定')} / ${S.all('characters',{worldId:w.id}).length} CHARACTERS</div><div class="system-world-desc">${esc(w.summary||'尚未寫入世界簡介')}</div><div class="system-world-foot"><span>${esc(w.location||'LOCATION UNKNOWN')}</span><span class="system-enter">ENTER →</span></div></article>`).join('')}</div><div style="margin-top:10px;font:600 8px ui-monospace,SFMono-Regular,Menlo,monospace;color:#365c8c;letter-spacing:.1em">GATEWAY BUILD ${BUILD}</div></section>`;
  document.getElementById('sysNewWorld').onclick=()=>nativeNew?.click();document.getElementById('sysImport').onclick=()=>nativeImport?.click();document.getElementById('sysExport').onclick=()=>nativeExport?.click();view.querySelectorAll('[data-sys-world]').forEach(card=>card.onclick=e=>{e.preventDefault();e.stopPropagation();directEnter(card.dataset.sysWorld)});rendering=false;
}
function observe(){new MutationObserver(()=>{const title=document.getElementById('pageTitle')?.textContent;if(title==='我的世界'&&!document.querySelector('.system-world-shell'))requestAnimationFrame(enhance);if(title!=='我的世界')document.body.classList.remove('oc-system-worlds')}).observe(document.documentElement,{childList:true,subtree:true,characterData:true})}
window.OCLifeSystemWorlds={version:'5.0.0',build:BUILD,enhance,directEnter,showTransition};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',()=>{observe();setTimeout(enhance,60)},{once:true}):(observe(),setTimeout(enhance,60));
})();