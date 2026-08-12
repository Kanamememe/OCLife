(function(){
'use strict';
const VERSION='1.0.0';
function openSettings(){
  const root=document.getElementById('modalRoot');
  if(root)root.innerHTML='';
  if(typeof window.OCLifeProviderSettings?.open==='function'){
    window.OCLifeProviderSettings.open();
    setTimeout(injectWarning,0);
    return true;
  }
  alert('設定模組尚未載入，請重新整理頁面後再試。');
  return false;
}
function currentIsWrong(){
  const s=window.OCLifeStore?.data?.settings||{};
  return s.provider==='gemini'&&s.model&&!window.OCLifeAI?.isGeminiTextModel?.(s.model);
}
function injectWarning(){
  const modal=document.querySelector('#modalRoot .modal');
  if(!modal||modal.querySelector('h2')?.textContent!=='設定')return;
  const old=modal.querySelector('#ocTextModelWarning');
  if(old)old.remove();
  if(!currentIsWrong())return;
  const s=window.OCLifeStore.data.settings||{},box=document.createElement('div');
  box.id='ocTextModelWarning';
  box.style.cssText='margin:0 0 14px;padding:11px 12px;border:1px solid #efb5a8;border-radius:14px;background:#fff2ef;color:#8a4438;font-size:12px;line-height:1.55';
  box.innerHTML=`<b>目前模型不適合 OC 文字功能</b><br>正在使用：${String(s.model).replace(/[<>&]/g,'')}<br>這是圖片／影音／TTS 類模型。請按「讀取模型」重新選擇 Gemini 文字模型，例如 Flash 或 Flash-Lite。`;
  modal.querySelector('h2')?.after(box);
}
function guardTextModel(e){
  const b=e.target.closest?.('#saveApiNow,#apiSave,#testApi');
  if(!b)return;
  const provider=document.getElementById('apiProvider')?.value||'',model=(document.getElementById('apiModelManual')?.value||document.getElementById('apiModelList')?.value||'').trim();
  if(provider==='gemini'&&model&&!window.OCLifeAI?.isGeminiTextModel?.(model)){
    e.preventDefault();e.stopImmediatePropagation();
    const st=document.getElementById('apiStatus');
    if(st){st.textContent='這是圖片／影音／TTS 模型，不能設為 OC 文字模型。請重新「讀取模型」並選 Flash／Flash-Lite。';st.style.color='#a55353'}
  }
}
function install(){
  document.addEventListener('click',e=>{
    const b=e.target.closest?.('#settingsBtn');
    if(!b)return;
    e.preventDefault();e.stopImmediatePropagation();openSettings();
  },true);
  document.addEventListener('click',guardTextModel,true);
  new MutationObserver(injectWarning).observe(document.documentElement,{childList:true,subtree:true});
}
window.OCLifeSettingsRecovery={version:VERSION,open:openSettings};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})();