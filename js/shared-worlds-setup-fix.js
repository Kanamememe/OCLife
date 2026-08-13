(function(){
'use strict';
async function copyCompleteInstaller(button){
 const root=button.closest('.oc-shared-modal'),status=root?.querySelector('#sharedSetupStatus');
 try{
  if(status)status.textContent='正在準備完整 SQL…';
  const files=['./supabase/shared-worlds.sql','./supabase/shared-worlds-security-fix.sql'];
  const parts=[];
  for(const file of files){const r=await fetch(file,{cache:'no-store'});if(!r.ok)throw new Error(`${file}：HTTP ${r.status}`);parts.push(await r.text())}
  await navigator.clipboard.writeText(parts.join('\n\n'));
  if(status)status.textContent='✓ 完整 SQL 已複製（包含安全修正）';
 }catch(e){
  if(status)status.textContent='複製失敗：'+(e?.message||e);
  window.open('./supabase/shared-worlds.sql','_blank','noopener');
 }
}
function install(){document.addEventListener('click',e=>{const b=e.target.closest?.('#sharedCopySql');if(!b)return;e.preventDefault();e.stopImmediatePropagation();copyCompleteInstaller(b)},true)}
window.OCLifeSharedSetupFix={version:'1.0.0'};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})();
