(function(){
'use strict';
const VERSION='2.0.0',S=window.OCLifeStore;
function mask(key){key=String(key||'');return key?`••••${key.slice(-6)}`:'未設定'}
function current(){const s=S.data.settings||{};return{provider:s.provider||'none',baseUrl:s.baseUrl||'',apiKey:s.apiKey||'',model:s.model||''}}
function label(x=current()){return`${x.provider||'none'} · ${x.model||'未選模型'} · Key ${mask(x.apiKey)}`}
function appendQuestionDiagnostic(){const st=document.getElementById('qbStatus');if(!st||st.dataset.apiDiagV2==='1')return;const text=st.textContent||'';if(!/生成失敗|quota|額度|429|模型不適合/i.test(text))return;st.dataset.apiDiagV2='1';const x=current(),extra=document.createElement('div');extra.style.cssText='margin-top:5px;font-size:10px;color:#6d82a0;line-height:1.45';extra.textContent=`實際使用：${label(x)} · ${x.baseUrl||'無 Base URL'}`;st.appendChild(extra)}
function onClick(e){if(e.target.closest?.('#qbAsk')){setTimeout(appendQuestionDiagnostic,900);setTimeout(appendQuestionDiagnostic,2500);setTimeout(appendQuestionDiagnostic,6000)}}
function install(){document.addEventListener('click',onClick,true);window.addEventListener('oclife:change',()=>{});}
window.OCLifeApiRuntime={version:VERSION,current,mask,label,appendQuestionDiagnostic};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})();