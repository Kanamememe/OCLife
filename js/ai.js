(function(){
'use strict';

const PROVIDERS={
  siliconflow:{baseUrl:'https://api.siliconflow.cn/v1',kind:'openai'},
  deepseek:{baseUrl:'https://api.deepseek.com',kind:'openai'},
  gemini:{baseUrl:'https://generativelanguage.googleapis.com/v1beta',kind:'gemini'},
  openai:{baseUrl:'',kind:'openai'}
};

function cleanBase(value){return String(value||'').trim().replace(/\/+$/,'')}
function providerConfig(config={}){
  const preset=PROVIDERS[config.provider]||PROVIDERS.openai;
  return {...config,baseUrl:cleanBase(config.baseUrl||preset.baseUrl),kind:preset.kind};
}
function endpoint(base,path){
  base=cleanBase(base);path=String(path||'').replace(/^\/+/, '');
  if(!base)return '';
  if(base.endsWith('/'+path))return base;
  return `${base}/${path}`;
}
async function parseJson(res){
  const text=await res.text();
  try{return text?JSON.parse(text):{}}catch(_){return {raw:text}}
}
function errorMessage(data,status){return data?.error?.message||data?.message||data?.error||data?.raw||`HTTP ${status}`}

async function callOpenAICompatible(config){
  const {baseUrl,apiKey,model,messages,temperature=.8,maxTokens}=providerConfig(config);
  if(!baseUrl)throw new Error('缺少 Base URL');
  if(!apiKey)throw new Error('缺少 API Key');
  if(!model)throw new Error('尚未選擇模型');
  const body={model,messages:Array.isArray(messages)?messages:[],temperature};
  if(maxTokens!=null)body.max_tokens=maxTokens;
  const res=await fetch(endpoint(baseUrl,'chat/completions'),{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
    body:JSON.stringify(body)
  });
  const data=await parseJson(res);
  if(!res.ok)throw new Error(errorMessage(data,res.status));
  const content=data?.choices?.[0]?.message?.content??data?.choices?.[0]?.text??'';
  if(Array.isArray(content))return content.map(x=>x?.text||x?.content||'').join('');
  return String(content||'');
}

async function callGemini(config){
  const {baseUrl,apiKey,model,messages,temperature=.8,maxTokens}=providerConfig(config);
  if(!apiKey)throw new Error('缺少 API Key');
  if(!model)throw new Error('尚未選擇模型');
  const prompt=(messages||[]).map(m=>`${String(m.role||'user').toUpperCase()}:\n${m.content||''}`).join('\n\n');
  const generationConfig={temperature};
  if(maxTokens!=null)generationConfig.maxOutputTokens=maxTokens;
  const res=await fetch(`${cleanBase(baseUrl)}/models/${encodeURIComponent(String(model).replace(/^models\//,''))}:generateContent`,{
    method:'POST',
    headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
    body:JSON.stringify({contents:[{parts:[{text:prompt}]}],generationConfig})
  });
  const data=await parseJson(res);
  if(!res.ok)throw new Error(errorMessage(data,res.status));
  return (data?.candidates||[]).flatMap(x=>x?.content?.parts||[]).map(x=>x?.text||'').join('\n');
}

async function listOpenAIModels(config){
  const {baseUrl,apiKey,provider}=providerConfig(config);
  if(!baseUrl)throw new Error('缺少 Base URL');
  if(!apiKey)throw new Error('缺少 API Key');
  let url=endpoint(baseUrl,'models');
  if(provider==='siliconflow')url+='?type=text&sub_type=chat';
  const res=await fetch(url,{headers:{'Authorization':`Bearer ${apiKey}`}});
  const data=await parseJson(res);
  if(!res.ok)throw new Error(errorMessage(data,res.status));
  return (Array.isArray(data?.data)?data.data:[]).map(x=>x?.id).filter(Boolean).sort((a,b)=>a.localeCompare(b));
}

async function listGeminiModels(config){
  const {baseUrl,apiKey}=providerConfig(config);
  if(!apiKey)throw new Error('缺少 API Key');
  let pageToken='';const models=[];
  for(let i=0;i<10;i++){
    const q=new URLSearchParams({pageSize:'1000'});if(pageToken)q.set('pageToken',pageToken);
    const res=await fetch(`${cleanBase(baseUrl)}/models?${q}`,{headers:{'x-goog-api-key':apiKey}});
    const data=await parseJson(res);
    if(!res.ok)throw new Error(errorMessage(data,res.status));
    for(const m of data?.models||[]){
      if(Array.isArray(m.supportedGenerationMethods)&&!m.supportedGenerationMethods.includes('generateContent'))continue;
      if(m?.name)models.push(String(m.name).replace(/^models\//,''));
    }
    pageToken=data?.nextPageToken||'';if(!pageToken)break;
  }
  return [...new Set(models)].sort((a,b)=>a.localeCompare(b));
}

async function listModels(config={}){
  const cfg=providerConfig(config);
  if(cfg.provider==='none')return [];
  return cfg.kind==='gemini'?listGeminiModels(cfg):listOpenAIModels(cfg);
}

async function call(config={}){
  const cfg=providerConfig(config);
  if(cfg.provider==='none')throw new Error('尚未設定 AI 服務商');
  return cfg.kind==='gemini'?callGemini(cfg):callOpenAICompatible(cfg);
}

window.OCLifeAI={
  PROVIDERS,
  call,
  callGemini,
  callOpenAICompatible,
  listModels,
  listGeminiModels,
  listOpenAIModels,
  providerConfig
};
})();
