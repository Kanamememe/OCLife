(function(){
'use strict';

const S=window.OCLifeStore;
const AI=window.OCLifeAI;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const PRESETS={
  none:{label:'不使用 API',baseUrl:''},
  siliconflow:{label:'硅基流動 SiliconFlow',baseUrl:'https://api.siliconflow.cn/v1'},
  deepseek:{label:'DeepSeek 官方 API',baseUrl:'https://api.deepseek.com'},
  gemini:{label:'Google Gemini',baseUrl:'https://generativelanguage.googleapis.com/v1beta'},
  openai:{label:'OpenAI-compatible／自訂',baseUrl:''}
};

function current(){
  const s=S?.data?.settings||{};
  return {
    provider:s.provider||'none',
    baseUrl:s.baseUrl||'',
    apiKey:s.apiKey||'',
    model:s.model||''
  };
}
function close(){const root=document.getElementById('modalRoot');if(root)root.innerHTML=''}
function modal(html){
  const root=document.getElementById('modalRoot');
  if(!root)return;
  root.innerHTML=`<div class="modal-bg"><div class="modal">${html}</div></div>`;
  const bg=root.querySelector('.modal-bg');
  if(bg)bg.onclick=e=>{if(e.target===bg)close()};
}
function providerOptions(selected){
  return Object.entries(PRESETS).map(([id,p])=>`<option value="${id}" ${id===selected?'selected':''}>${esc(p.label)}</option>`).join('');
}
function status(text,type='info'){
  const el=$('#apiStatus');
  if(!el)return;
  el.textContent=text||'';
  el.dataset.type=type;
}
function selectedConfig(){
  return {
    provider:$('#apiProvider')?.value||'none',
    baseUrl:($('#apiBase')?.value||'').trim(),
    apiKey:($('#apiKey')?.value||'').trim(),
    model:($('#apiModel')?.value||$('#apiModelManual')?.value||'').trim()
  };
}
function refillModels(models,selected=''){
  const select=$('#apiModel');
  if(!select)return;
  const list=[...new Set((models||[]).filter(Boolean))];
  select.innerHTML=list.length
    ? list.map(id=>`<option value="${esc(id)}" ${id===selected?'selected':''}>${esc(id)}</option>`).join('')
    : '<option value="">沒有讀取到模型</option>';
  $('#modelSelectWrap')?.classList.toggle('hidden',!list.length);
  $('#modelManualWrap')?.classList.toggle('hidden',!!list.length);
  if(list.length && selected && !list.includes(selected)){
    const opt=document.createElement('option');opt.value=selected;opt.textContent=`${selected}（已儲存）`;select.prepend(opt);select.value=selected;
  }
}
function providerChanged(){
  const provider=$('#apiProvider')?.value||'none';
  const preset=PRESETS[provider];
  const base=$('#apiBase');
  if(base && provider!=='openai')base.value=preset?.baseUrl||'';
  const disabled=provider==='none';
  ['apiBase','apiKey','refreshModels','testApi','apiModel','apiModelManual'].forEach(id=>{const el=document.getElementById(id);if(el)el.disabled=disabled});
  $('#apiBaseHint').textContent=provider==='openai'?'填入相容服務商的 API Base URL，例如 https://example.com/v1':'已使用官方預設 Base URL，可自行修改';
  refillModels([],current().model);
  status(disabled?'目前使用本地模擬，不會呼叫 API':'填入 API Key 後點「讀取模型」');
}
async function refreshModels(){
  const cfg=selectedConfig();
  if(cfg.provider==='none')return status('請先選擇 API 服務商','error');
  if(!cfg.apiKey)return status('請先填入 API Key','error');
  if(!cfg.baseUrl)return status('請先填入 Base URL','error');
  const btn=$('#refreshModels');if(btn)btn.disabled=true;
  status('正在讀取模型…');
  try{
    const models=await AI.listModels(cfg);
    refillModels(models,current().model||cfg.model);
    status(`已讀取 ${models.length} 個可用模型`,'ok');
  }catch(error){
    refillModels([],current().model||cfg.model);
    status(`讀取失敗：${error.message}。可以改用手動模型名稱。`,'error');
  }finally{if(btn)btn.disabled=false}
}
async function testApi(){
  const cfg=selectedConfig();
  if(!cfg.model)return status('請先選擇或輸入模型','error');
  const btn=$('#testApi');if(btn)btn.disabled=true;
  status('正在測試模型…');
  try{
    const text=await AI.call({...cfg,messages:[{role:'user',content:'只回覆 OK'}],temperature:0,maxTokens:16});
    status(`連線成功：${String(text||'OK').trim().slice(0,80)}`,'ok');
  }catch(error){status(`測試失敗：${error.message}`,'error')}
  finally{if(btn)btn.disabled=false}
}
function saveSettings(){
  const cfg=selectedConfig();
  S.data.settings={...S.data.settings,...cfg};
  S.save();
  close();
}
function open(){
  const s=current();
  modal(`<h2>AI 與模型設定</h2>
    <p class="note">選擇服務商後可直接讀取帳號目前可用的模型。讀取失敗時仍可手動輸入模型 ID。</p>
    <div class="field"><label>API 服務商</label><select id="apiProvider">${providerOptions(s.provider)}</select></div>
    <div class="field"><label>Base URL</label><input id="apiBase" value="${esc(s.baseUrl||PRESETS[s.provider]?.baseUrl||'')}" placeholder="https://..."><div class="note" id="apiBaseHint"></div></div>
    <div class="field"><label>API Key</label><input id="apiKey" type="password" autocomplete="off" value="${esc(s.apiKey)}"></div>
    <div class="toolbar"><button type="button" class="secondary" id="refreshModels">↻ 讀取模型</button><button type="button" class="secondary" id="testApi">測試目前模型</button></div>
    <div class="field" id="modelSelectWrap"><label>模型</label><select id="apiModel"><option value="${esc(s.model)}">${esc(s.model||'請先讀取模型')}</option></select></div>
    <div class="field hidden" id="modelManualWrap"><label>手動模型 ID</label><input id="apiModelManual" value="${esc(s.model)}" placeholder="例如 model-name"></div>
    <div id="apiStatus" class="note"></div>
    <div class="actions"><button type="button" class="secondary" id="apiCancel">取消</button><button type="button" class="primary" id="apiSave">儲存</button></div>`);

  $('#apiProvider').onchange=providerChanged;
  $('#refreshModels').onclick=refreshModels;
  $('#testApi').onclick=testApi;
  $('#apiCancel').onclick=close;
  $('#apiSave').onclick=saveSettings;
  providerChanged();
  if(s.model){
    $('#apiModel').innerHTML=`<option value="${esc(s.model)}">${esc(s.model)}（已儲存）</option>`;
    $('#apiModel').value=s.model;
    $('#modelSelectWrap').classList.remove('hidden');
    $('#modelManualWrap').classList.add('hidden');
  }
}
function install(){
  const btn=document.getElementById('settingsBtn');
  if(!btn)return false;
  btn.onclick=open;
  return true;
}
window.OCLifeProviderSettings={open,install,refreshModels,PRESETS};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
