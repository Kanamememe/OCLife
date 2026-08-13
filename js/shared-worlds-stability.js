(function(){
'use strict';
const VERSION='1.0.0';
const NativeObserver=window.MutationObserver;

function isSharedDecorateCallback(callback){
 try{return callback?.name==='decorate'||/function\s+decorate\s*\(/.test(Function.prototype.toString.call(callback))}catch(_){return false}
}

if(typeof NativeObserver==='function'){
 function SafeMutationObserver(callback){
  if(!isSharedDecorateCallback(callback))return new NativeObserver(callback);
  let queued=false,lastMutations=[];
  const observer=new NativeObserver((mutations,instance)=>{
   const meaningful=mutations.filter(m=>{
    const node=m.target?.nodeType===1?m.target:m.target?.parentElement;
    return !node?.closest?.('.oc-shared-badge,.oc-shared-owner');
   });
   if(!meaningful.length)return;
   lastMutations=meaningful;
   if(queued)return;
   queued=true;
   requestAnimationFrame(()=>{queued=false;callback(lastMutations,instance)});
  });
  const nativeObserve=observer.observe.bind(observer);
  observer.observe=(target,options)=>{
   const view=document.getElementById('view');
   return nativeObserve(target===document.documentElement&&view?view:target,options);
  };
  return observer;
 }
 SafeMutationObserver.prototype=NativeObserver.prototype;
 window.MutationObserver=SafeMutationObserver;
 document.addEventListener('DOMContentLoaded',()=>queueMicrotask(()=>{window.MutationObserver=NativeObserver}),{once:true});
}

function currentWorldId(){return window.OCLifeWorldContext?.get?.()||window.OCLifePhone?.activeWorldId||null}
function saveSharedWorld(e){
 const button=e.target.closest?.('#sharedSaveWorld');
 if(!button)return;
 const worldId=currentWorldId(),store=window.OCLifeStore,world=store?.get?.('worlds',worldId);
 if(!world?.sharedWorldId)return;
 e.preventDefault();
 e.stopImmediatePropagation();
 const name=document.getElementById('sharedWorldName')?.value?.trim();
 const summary=document.getElementById('sharedWorldSummary')?.value??world.summary??'';
 if(name)world.name=name;
 world.summary=summary;
 try{
  store.save();
  window.OCLifeAutoLife?.toast?.('✓ 世界資料已加入同步佇列');
  button.disabled=true;
  button.textContent='等待同步…';
  setTimeout(async()=>{
   await window.OCLifeSharedWorlds?.syncWorld?.(worldId,{manual:true});
   button.disabled=false;
   button.textContent='保存世界資料';
  },700);
 }catch(err){
  button.disabled=false;
  window.OCLifeAutoLife?.toast?.('保存失敗：'+(err?.message||err),{error:true});
 }
}

document.addEventListener('click',saveSharedWorld,true);
window.OCLifeSharedStability={version:VERSION};
})();
