(function(){
'use strict';
const VERSION='1.3.0';
const FILES=[
 './supabase/shared-worlds-bootstrap.sql',
 './supabase/shared-worlds.sql',
 './supabase/shared-worlds-security-fix.sql',
 './supabase/shared-worlds-v2.sql',
 './supabase/shared-worlds-token-hash-fix.sql'
];
async function completeSQL(){const parts=[];for(const file of FILES){const response=await fetch(file,{cache:'no-store'});if(!response.ok)throw new Error(`${file}：HTTP ${response.status}`);parts.push(`-- ===== ${file} =====\n\n${await response.text()}`)}return parts.join('\n\n')}
function downloadSQL(text){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='OCLife-shared-worlds-install.sql';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200)}
async function copyCompleteInstaller(button){
 const root=button.closest('.oc-shared-modal'),status=root?.querySelector('#sharedSetupStatus');
 try{
  if(status)status.textContent='正在準備完整 SQL…';
  const sql=await completeSQL();
  try{await navigator.clipboard.writeText(sql);if(status)status.textContent='✓ 完整 SQL 已複製（包含 Supabase schema bootstrap、security v2 與 token hash 修復）'}
  catch(_){downloadSQL(sql);if(status)status.textContent='無法直接複製，已下載完整 SQL 檔案'}
 }catch(error){if(status)status.textContent='準備失敗：'+(error?.message||error)}
}
function install(){document.addEventListener('click',event=>{const button=event.target.closest?.('#sharedCopySql');if(!button)return;event.preventDefault();event.stopImmediatePropagation();copyCompleteInstaller(button)},true)}
window.OCLifeSharedSetupFix={version:VERSION,files:[...FILES],completeSQL};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})();
