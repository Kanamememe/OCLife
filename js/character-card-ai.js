(function(){
'use strict';

const VERSION='0.4.0';
const S=window.OCLifeStore;
const AI=window.OCLifeAI;
const ROOT_ID='oclife-ai-card-helper';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=s=>String(s??'').trim();

function settings(){
  const s=S?.data?.settings||{};
  return {provider:s.provider||'none',baseUrl:s.baseUrl||'',apiKey:s.apiKey||'',model:s.model||''};
}
function parseJson(text){
  let source=clean(text).replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  try{return JSON.parse(source)}catch(_){const match=source.match(/\{[\s\S]*\}/);if(match){try{return JSON.parse(match[0])}catch(__){}}}
  throw new Error('AI 回傳內容不是可讀取的角色卡格式');
}
function normalize(v){
  v=v&&typeof v==='object'?v:{};const str=k=>clean(v[k]);
  return {name:str('name'),gender:str('gender'),age:str('age'),identity:str('identity'),appearance:str('appearance'),personality:str('personality'),speech:str('speech'),relationships:str('relationships'),habits:str('habits'),background:str('background'),abilities:str('abilities'),boundaries:str('boundaries'),notes:str('notes')};
}
function prompt(raw){
  return [
    '你是 OC 角色设定资料整理器。请把用户随手写的角色资料自主分类成结构化角色卡。',
    '核心原则：只整理用户明确提供或可直接改写的信息，不补造未知经历、性格、关系、能力或身份。',
    '可以合并同义内容、消除重复、让措辞更清楚，但不要改变人物设定。',
    '若一句话同时包含多个类别，请拆到对应字段；无法判断的内容放 notes。',
    'personality 尽量区分外在表现、内在底色、压力下反应、对亲近者的差异；资料没有就不要硬补。',
    'speech 只整理说话习惯、用词、语气、标点、称呼等。',
    'relationships 只整理与其他角色/用户的具体关系与相处模式。',
    'habits 放喜好、厌恶、生活习惯、兴趣、身体习惯等。',
    'boundaries 放禁忌、雷点、原则、绝不会做的事。',
    'abilities 放能力、技能、战斗/职业专长、特殊体质。',
    'background 放出身、经历、组织、家庭、重要过去。',
    '不要输出解释，不要 Markdown，只输出一个 JSON 对象。',
    '字段固定为：name, gender, age, identity, appearance, personality, speech, relationships, habits, background, abilities, boundaries, notes。',
    '没有资料的字段输出空字符串。','','用户原始资料：',raw
  ].join('\n');
}
async function classify(raw){
  const cfg=settings();
  if(!raw.trim())throw new Error('先貼入一些角色資料');
  if(cfg.provider==='none')throw new Error('請先到右上角設定配置 AI 服務商和模型');
  if(!cfg.apiKey||!cfg.model)throw new Error('請先完成 API Key 與模型選擇');
  const text=await AI.call({...cfg,temperature:.25,maxTokens:1800,messages:[
    {role:'system',content:'你负责忠实整理 OC 角色资料，禁止擅自补设定。'},
    {role:'user',content:prompt(raw)}
  ]});
  return normalize(parseJson(text));
}

function getField(modal,mode,key){
  const maps={
    add:{name:'#cn',gender:'#ocGender',age:'#ocAge',identity:'#ci',appearance:'#cap',personality:'#cp',speech:'#cs',relationships:'#cr',habits:'#ch',background:'#ocBackground',abilities:'#ocAbilities',boundaries:'#ocBoundaries',notes:'#ocNotes'},
    edit:{name:'#ecn',gender:'#ecg',age:'#eca',identity:'#eci',appearance:'#ecap',personality:'#ecp',speech:'#ecs',relationships:'#ecr',habits:'#ech',background:'#ecb',abilities:'#ecab',boundaries:'#ecbo',notes:'#ecn2'}
  };
  return modal.querySelector(maps[mode]?.[key]||'__missing__');
}
function fill(modal,mode,key,value,onlyEmpty){const el=getField(modal,mode,key);if(!el||!value)return;if(onlyEmpty&&clean(el.value))return;el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}))}
function applyResult(data,onlyEmpty=false,modal=document,mode='add'){
  Object.keys(normalize({})).forEach(key=>fill(modal,mode,key,data[key],onlyEmpty));
}
function resultHtml(d){
  const rows=[['名字',d.name],['性別',d.gender],['年齡',d.age],['身份／職業',d.identity],['外貌',d.appearance],['性格',d.personality],['說話方式',d.speech],['關係',d.relationships],['習慣／喜好',d.habits],['背景經歷',d.background],['能力／技能',d.abilities],['禁忌／底線',d.boundaries],['未分類補充',d.notes]].filter(x=>x[1]);
  return rows.length?rows.map(([k,v])=>`<div class="oc-ai-preview-row"><b>${esc(k)}</b><div>${esc(v)}</div></div>`).join(''):'<div class="meta">AI 沒有從這段資料中提取到明確設定</div>';
}
function style(){
  if(document.getElementById('oclife-ai-card-style'))return;
  const el=document.createElement('style');el.id='oclife-ai-card-style';el.textContent=`
  #${ROOT_ID},[data-oc-ai-card-helper]{margin:0 0 16px;padding:14px;border:1px solid #d9e2d9;border-radius:18px;background:#f2f6f1}
  #${ROOT_ID} h3,[data-oc-ai-card-helper] h3{margin:0 0 5px;font-size:15px}#${ROOT_ID} p,[data-oc-ai-card-helper] p{margin:0 0 10px;font-size:12px;color:#7b756d;line-height:1.5}
  #${ROOT_ID} textarea,[data-oc-ai-card-helper] textarea{width:100%;min-height:125px;border:1px solid #dcd7cf;border-radius:13px;padding:11px;background:#fff;resize:vertical}
  .oc-ai-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:9px}.oc-ai-status{font-size:12px;color:#7b756d;flex:1}
  .oc-ai-preview{margin-top:12px;border-top:1px solid #dfe5dd;padding-top:10px}.oc-ai-preview-row{padding:7px 0;border-bottom:1px dashed #dfe5dd;font-size:12px;line-height:1.55}.oc-ai-preview-row b{display:block;color:#5d685f;margin-bottom:2px}
  .oc-ai-extra-title{font-size:12px;font-weight:700;color:#6d675f;margin:14px 0 4px}`;document.head.appendChild(el);
}
function injectExtras(modal){
  const actions=modal.querySelector('.actions');if(!actions||modal.querySelector('#ocBackground'))return;
  const box=document.createElement('div');box.innerHTML=`<div class="oc-ai-extra-title">更多角色資料</div><div class="two"><div class="field"><label>性別</label><input id="ocGender"></div><div class="field"><label>年齡</label><input id="ocAge"></div></div><div class="field"><label>背景經歷</label><textarea id="ocBackground"></textarea></div><div class="field"><label>能力／技能</label><textarea id="ocAbilities"></textarea></div><div class="field"><label>禁忌／底線</label><textarea id="ocBoundaries"></textarea></div><div class="field"><label>未分類補充</label><textarea id="ocNotes"></textarea></div>`;actions.parentNode.insertBefore(box,actions);
}
function bindHelper(wrap,modal,mode){
  let latest=null;
  wrap.querySelector('[data-ai-classify]').onclick=async()=>{
    const btn=wrap.querySelector('[data-ai-classify]'),status=wrap.querySelector('[data-ai-status]'),preview=wrap.querySelector('[data-ai-preview]');
    btn.disabled=true;status.textContent='正在整理…';preview.classList.add('hidden');
    try{
      latest=await classify(wrap.querySelector('[data-ai-raw]').value);
      preview.innerHTML=`${resultHtml(latest)}<div class="oc-ai-bar"><button type="button" class="primary" data-ai-apply-all>覆蓋已有欄位</button><button type="button" class="secondary" data-ai-apply-empty>只填空白欄位</button></div>`;
      preview.classList.remove('hidden');status.textContent='整理完成，可先檢查再套用';
      preview.querySelector('[data-ai-apply-all]').onclick=()=>{applyResult(latest,false,modal,mode);status.textContent='已套用到角色卡'};
      preview.querySelector('[data-ai-apply-empty]').onclick=()=>{applyResult(latest,true,modal,mode);status.textContent='已填入空白欄位'};
    }catch(e){status.textContent='整理失敗：'+(e?.message||e)}finally{btn.disabled=false}
  };
}
function helperHtml(){return `<h3>✦ AI 自動整理角色卡</h3><p>把零碎設定、舊人設或補充內容貼進來，AI 只分類你提供的資料，不會擅自補設定。</p><textarea data-ai-raw placeholder="例如：他平常看起來很冷淡，但其實對熟人很有耐心……"></textarea><div class="oc-ai-bar"><button type="button" class="primary" data-ai-classify>AI 自動分類</button><span class="oc-ai-status" data-ai-status></span></div><div class="oc-ai-preview hidden" data-ai-preview></div>`}
function injectHelper(modal){
  const title=modal.querySelector('h2');if(!title)return;
  const mode=modal.querySelector('#ecn')?'edit':(modal.querySelector('#cn')?'add':'');if(!mode)return;
  if(mode==='add')injectExtras(modal);
  if(modal.querySelector('[data-oc-ai-card-helper]'))return;
  style();const wrap=document.createElement('section');wrap.dataset.ocAiCardHelper='1';wrap.innerHTML=helperHtml();title.insertAdjacentElement('afterend',wrap);bindHelper(wrap,modal,mode);
}

document.addEventListener('click',e=>{
  const btn=e.target.closest('#charSave');if(!btn)return;const modal=btn.closest('.modal');if(!modal)return;
  const name=clean(modal.querySelector('#cn')?.value),stamp=Date.now();const extra={gender:clean(modal.querySelector('#ocGender')?.value),age:clean(modal.querySelector('#ocAge')?.value),background:clean(modal.querySelector('#ocBackground')?.value),abilities:clean(modal.querySelector('#ocAbilities')?.value),boundaries:clean(modal.querySelector('#ocBoundaries')?.value),notes:clean(modal.querySelector('#ocNotes')?.value)};
  setTimeout(()=>{const chars=[...(S?.data?.characters||[])].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));const created=chars.find(c=>(c.createdAt||0)>=stamp-1500&&(!name||c.name===name));if(created)S.update('characters',created.id,extra)},0);
},true);

function scan(){document.querySelectorAll('#modalRoot .modal').forEach(injectHelper)}
const observer=new MutationObserver(scan);observer.observe(document.documentElement,{subtree:true,childList:true});scan();
window.OCLifeCharacterCardAI={version:VERSION,classify,normalize,applyResult,injectHelper};
})();