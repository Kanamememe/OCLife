(function(){
'use strict';
const KEY='oclife_active_world_id';
const S=()=>window.OCLifeStore;
let current=null;
function valid(id){return !!(id&&S()?.get?.('worlds',id))}
function set(id){if(!valid(id))return null;current=id;try{sessionStorage.setItem(KEY,id)}catch(_){};window.dispatchEvent(new CustomEvent('oclife:world-context',{detail:{worldId:id}}));return id}
function get(){if(valid(current))return current;const phone=window.OCLifePhone?.activeWorldId;if(valid(phone))return set(phone);let stored='';try{stored=sessionStorage.getItem(KEY)||''}catch(_){}if(valid(stored)){current=stored;return current}const worlds=S()?.all?.('worlds')||[];if(worlds.length===1)return set(worlds[0].id);return null}
function clear(){current=null;try{sessionStorage.removeItem(KEY)}catch(_){}}
function install(){
  document.addEventListener('click',e=>{
    const worldCard=e.target.closest?.('[data-world]');
    if(worldCard?.dataset?.world)set(worldCard.dataset.world);
  },true);
  window.addEventListener('oclife:world-context-request',()=>{const id=get();if(id)window.dispatchEvent(new CustomEvent('oclife:world-context',{detail:{worldId:id}}))});
  // 手机首页模块可能比本模块晚加载；周期只检查几次，不长期轮询。
  let tries=0;const t=setInterval(()=>{tries++;const id=window.OCLifePhone?.activeWorldId;if(valid(id))set(id);if(tries>=12||valid(id))clearInterval(t)},250);
}
window.OCLifeWorldContext={version:'0.8.0',set,get,clear};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})();