(function(){
'use strict';

const VERSION='0.2.0';
const S=window.OCLifeStore;
const AI=window.OCLifeAI;
const ROOT_ID='oclife-ai-card-helper';

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=s=>String(s??'').trim();

function settings(){
  const s=S?.data?.settings||{};
  return {
    provider:s.provider||'none',
    baseUrl:s.baseUrl||'',
    apiKey:s.apiKey||'',
    model:s.model||''
  };
}

function parseJson(text){
  let source=clean(text).replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  try{return JSON.parse(source)}catch(_){
    const match=source.match(/\{[\s\S]*\}/);
    if(match){try{return JSON.parse(match[0])}catch(__){}}
  }
  throw new Error('AI 回傳內容不是可讀取的角色卡格式');
}

function normalize(v){
  v=v&&typeof v==='object'?v:{};
  const str=k=>clean(v[k]);
  return {
    name:str('name'),
    gender:str('gender'),
    age:str('age'),
    identity:str('identity'),
    appearance:str('appearance'),
    personality:str('personality'),
    speech:str('speech'),
    relationships:str('relationships'),
    habits:str('habits'),
    background:str('background'),
    abilities:str('abilities'),
    boundaries:str('boundaries'),
    notes:str('notes')
  };
}

function prompt(raw){
  return [
    '你是 OC 角色设定资料整理器。请把用户随手写的角色资料自主分类成结构化角色卡。',
    '核心原则：只整理用户明确提供或可直接改写的信息，不补造未知经历、性格、关系、能力或身份。',
    '可以合并同义内容、消除重复、让措辞更清楚，但不要改变人物设定。',
    '若一句话同时包含多个类别，请拆到对应字段；无法判断的内容放 notes。',
    'personality 应尽量区分：外在表现、内在底色、压力下反应、对亲近者的差异，但资料没有就不要硬补。',
    'speech 只整理说话习惯、用词、语气、标点、称呼等。',
    'relationships 只整理与其他角色/用户的具体关系与相处模式。',
    'habits 放喜好、厌恶、生活习惯、兴趣、身体习惯等。',
    'boundaries 放禁忌、雷点、原则、绝不会做的事。',
    'abilities 放能力、技能、战斗/职业专长、特殊体质。',
    'background 放出身、经历、组织、家庭、重要过去。',
    '不要输出解释，不要 Markdown，只输出一个 JSON 对象。',
    '字段必须固定为：name, gender, age, identity, appearance, personality, speech, relationships, habits, background, abilities, boundaries, notes。',
    '没有资料的字段输出空字符串。',
    '',
    '用户原始资料：',
    raw
  ].join('\n');
}

async function classify(raw){
  const cfg=settings();
  if(!raw.trim())throw new Error('先贴入一些角色资料');
  if(cfg.provider==='none')throw new Error('请先到右上角设置配置 AI 服务商和模型');
  if(!cfg.apiKey||!cfg.model)throw new Error('请先完成 API Key 与模型选择');
  const text=await AI.call({...cfg,temperature:.25,maxTokens:1800,messages:[
    {role:'system',content:'你负责忠实整理 OC 角色资料，禁止擅自补设定。'},
    {role:'user',content:prompt(raw)}
  ]});
  return normalize(parseJson(text));
}

function field(id){return document.querySelector(id)}
function fill(id,value,onlyEmpty){const el=field(id);if(!el||!value)return;if(onlyEmpty&&clean(el.value))return;el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}))}

function applyResult(data,onlyEmpty=false){
  fill('#cn',data.name,onlyEmpty);
  fill('#ci',data.identity,onlyEmpty);
  fill('#cap',data.appearance,onlyEmpty);
  fill('#cp',data.personality,onlyEmpty);
  fill('#cs',data.speech,onlyEmpty);
  fill('#cr',data.relationships,onlyEmpty);
  fill('#ch',data.habits,onlyEmpty);
  fill('#ocGender',data.gender,onlyEmpty);
  fill('#ocAge',data.age,onlyEmpty);
  fill('#ocBackground',data.background,onlyEmpty);
  fill('#ocAbilities',data.abilities,onlyEmpty);
  fill('#ocBoundaries',data.boundaries,onlyEmpty);
  fill('#ocNotes',data.notes,onlyEmpty);
}

function resultHtml(d){
  const rows=[
    ['名字',d.name],['性别',d.gender],['年龄',d.age],['身份／职业',d.identity],['外貌',d.appearance],
    ['性格',d.personality],['说话方式',d.speech],['关系',d.relationships],['习惯／喜好',d.habits],
    ['背景经历',d.background],['能力／技能',d.abilities],['禁忌／底线',d.boundaries],['未分类补充',d.notes]
  ].filter(x=>x[1]);
  return rows.length?rows.map(([k,v])=>`<div class="oc-ai-preview-row"><b>${esc(k)}</b><div>${esc(v)}</div></div>`).join(''):'<div class="meta">AI 没有从这段资料中提取到明确设定</div>';
}

function style(){
  if(document.getElementById('oclife-ai-card-style'))return;
  const el=document.createElement('style');el.id='oclife-ai-card-style';el.textContent=`
  #${ROOT_ID}{margin:0 0 16px;padding:14px;border:1px solid #d9e2d9;border-radius:18px;background:#f2f6f1}
  #${ROOT_ID} h3{margin:0 0 5px;font-size:15px}#${ROOT_ID} p{margin:0 0 10px;font-size:12px;color:#7b756d;line-height:1.5}
  #${ROOT_ID} textarea{width:100%;min-height:125px;border:1px solid #dcd7cf;border-radius:13px;padding:11px;background:#fff;resize:vertical}
  .oc-ai-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:9px}.oc-ai-status{font-size:12px;color:#7b756d;flex:1}
  .oc-ai-preview{margin-top:12px;border-top:1px solid #dfe5dd;padding-top:10px}.oc-ai-preview-row{padding:7px 0;border-bottom:1px dashed #dfe5dd;font-size:12px;line-height:1.55}.oc-ai-preview-row b{display:block;color:#5d685f;margin-bottom:2px}
  .oc-ai-extra-title{font-size:12px;font-weight:700;color:#6d675f;margin:14px 0 4px}
  `;document.head.appendChild(el);
}

function injectExtras(modal){
  const actions=modal.querySelector('.actions');
  if(!actions||modal.querySelector('#ocBackground'))return;
  const box=document.createElement('div');
  box.innerHTML=`
    <div class="oc-ai-extra-title">更多角色资料</div>
    <div class="two"><div class="field"><label>性别</label><input id="ocGender"></div><div class="field"><label>年龄</label><input id="ocAge"></div></div>
    <div class="field"><label>背景经历</label><textarea id="ocBackground"></textarea></div>
    <div class="field"><label>能力／技能</label><textarea id="ocAbilities"></textarea></div>
    <div class="field"><label>禁忌／底线</label><textarea id="ocBoundaries"></textarea></div>
    <div class="field"><label>未分类补充</label><textarea id="ocNotes"></textarea></div>`;
  actions.parentNode.insertBefore(box,actions);
}

function injectHelper(modal){
  if(modal.querySelector('#'+ROOT_ID))return;
  const title=modal.querySelector('h2');
  if(!title||!modal.querySelector('#cn')||!modal.querySelector('#cp'))return;
  style();injectExtras(modal);
  const wrap=document.createElement('section');wrap.id=ROOT_ID;
  wrap.innerHTML=`<h3>✦ AI 自動整理角色卡</h3><p>不用先分类。把想到的设定、零碎句子、旧人设或聊天风格全部贴进来，AI 会按字段整理；不确定的内容不会乱补。</p><textarea id="ocAiRaw" placeholder="例如：他平常看起来很冷淡，但其实对熟人很有耐心……职业是医生，讨厌别人碰他的眼镜……"></textarea><div class="oc-ai-bar"><button type="button" class="primary" id="ocAiClassify">AI 自动分类</button><span class="oc-ai-status" id="ocAiStatus"></span></div><div class="oc-ai-preview hidden" id="ocAiPreview"></div>`;
  title.insertAdjacentElement('afterend',wrap);
  let latest=null;
  wrap.querySelector('#ocAiClassify').onclick=async()=>{
    const btn=wrap.querySelector('#ocAiClassify'),status=wrap.querySelector('#ocAiStatus'),preview=wrap.querySelector('#ocAiPreview');
    btn.disabled=true;status.textContent='正在整理…';preview.classList.add('hidden');
    try{
      latest=await classify(wrap.querySelector('#ocAiRaw').value);
      preview.innerHTML=`${resultHtml(latest)}<div class="oc-ai-bar"><button type="button" class="primary" id="ocAiApplyAll">套用全部</button><button type="button" class="secondary" id="ocAiApplyEmpty">只填空白欄位</button></div>`;
      preview.classList.remove('hidden');status.textContent='整理完成，可先检查再套用';
      preview.querySelector('#ocAiApplyAll').onclick=()=>{applyResult(latest,false);status.textContent='已套用到角色卡'};
      preview.querySelector('#ocAiApplyEmpty').onclick=()=>{applyResult(latest,true);status.textContent='已填入空白欄位'};
    }catch(e){status.textContent='整理失败：'+(e?.message||e)}finally{btn.disabled=false}
  };
}

// 保存按钮原逻辑只认识旧字段；在它执行前记录扩展资料，执行后补到新建立的角色。
document.addEventListener('click',e=>{
  const btn=e.target.closest('#charSave');if(!btn)return;
  const modal=btn.closest('.modal');if(!modal)return;
  const name=clean(modal.querySelector('#cn')?.value),stamp=Date.now();
  const extra={
    gender:clean(modal.querySelector('#ocGender')?.value),age:clean(modal.querySelector('#ocAge')?.value),
    background:clean(modal.querySelector('#ocBackground')?.value),abilities:clean(modal.querySelector('#ocAbilities')?.value),
    boundaries:clean(modal.querySelector('#ocBoundaries')?.value),notes:clean(modal.querySelector('#ocNotes')?.value)
  };
  setTimeout(()=>{
    const chars=[...(S?.data?.characters||[])].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
    const created=chars.find(c=>(c.createdAt||0)>=stamp-1500&&(!name||c.name===name));
    if(created)S.update('characters',created.id,extra);
  },0);
},true);

function scan(){document.querySelectorAll('#modalRoot .modal').forEach(injectHelper)}
const observer=new MutationObserver(scan);
observer.observe(document.documentElement,{subtree:true,childList:true});
scan();

window.OCLifeCharacterCardAI={version:VERSION,classify,normalize,applyResult};
})();