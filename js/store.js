(function(){
'use strict';
const KEY='oclife_v010';
const seed={version:1,settings:{provider:'none',baseUrl:'',apiKey:'',model:'',autoSimulate:true},worlds:[],characters:[],statuses:[],chats:[],messages:[],moments:[]};
const uid=(p='id')=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
const clone=v=>JSON.parse(JSON.stringify(v));
function load(){try{const raw=JSON.parse(localStorage.getItem(KEY)||'null');return raw&&raw.version?Object.assign(clone(seed),raw):clone(seed)}catch(_){return clone(seed)}}
let db=load();
function save(){localStorage.setItem(KEY,JSON.stringify(db));window.dispatchEvent(new CustomEvent('oclife:change'))}
function all(type,filter={}){return(db[type]||[]).filter(x=>Object.entries(filter).every(([k,v])=>x[k]===v))}
function get(type,id){return(db[type]||[]).find(x=>x.id===id)||null}
function add(type,obj){const item={id:obj.id||uid(type.slice(0,-1)),createdAt:Date.now(),...obj};db[type].push(item);save();return item}
function update(type,id,patch){const item=get(type,id);if(!item)return null;Object.assign(item,patch,{updatedAt:Date.now()});save();return item}
function remove(type,id){db[type]=(db[type]||[]).filter(x=>x.id!==id);save()}
const VARIANT_PAIRS=['蕭萧','鴦鸯','鴛鸳','麗丽','龍龙','風风','雲云','葉叶','劉刘','陳陈','張张','趙赵','錢钱','孫孙','吳吴','鄭郑','馮冯','衛卫','蔣蒋','韓韩','楊杨','謝谢','蘇苏','羅罗','鐘钟','鍾钟','顧顾','許许','鄧邓','鄒邹','盧卢','賈贾','賴赖','龔龚','嚴严','喬乔','闕阙','閻阎','簡简','萬万','樂乐','鄺邝','譚谭','黃黄','藍蓝','綠绿','紅红','夢梦','靈灵','曉晓','陽阳','陰阴','愛爱','戀恋','歡欢','憂忧','寧宁','靜静','華华','國国','東东','門门','馬马','鳥鸟','魚鱼','貓猫','劍剑','獵猎','騎骑','車车','賽赛','場场','隊队','醫医','師师','學学','會会','長长','頭头','體体','關关','係系','親亲','敵敌','對对','與与','為为','從从','這这','個个','們们','裡里','時时','間间','開开','發发','現现','實实','進进','過过','後后','還还','說说','話话','點点','應应','該该'];
const toSimpleMap=new Map();for(const pair of VARIANT_PAIRS){const a=[...pair];if(a.length>=2)toSimpleMap.set(a[0],a[1])}
function basicName(value){return String(value??'').normalize('NFKC').trim().toLowerCase().replace(/[\s·・•‧._\-—–'"「」『』【】()（）\[\]{}]/g,'')}
function canonicalName(value){const raw=basicName(value);return [...raw].map(ch=>toSimpleMap.get(ch)||ch).join('')}
const collators=[new Intl.Collator('zh-Hans',{usage:'search',sensitivity:'base'}),new Intl.Collator('zh-Hant',{usage:'search',sensitivity:'base'})];
function namesEquivalent(a,b){const x=basicName(a),y=basicName(b);if(!x||!y)return false;if(x===y||canonicalName(x)===canonicalName(y))return true;try{return collators.some(c=>c.compare(x,y)===0)}catch(_){return false}}
function findCharacterByName(worldId,name){return all('characters',{worldId}).find(c=>namesEquivalent(c.name,name))||null}
function emptyValue(v){if(v==null)return true;if(typeof v==='string')return v.trim()==='';if(Array.isArray(v))return v.length===0;if(typeof v==='object')return Object.keys(v).length===0;return false}
function mergeEmpty(existing,input){const patch={};for(const [k,v] of Object.entries(input||{})){if(['id','createdAt','updatedAt','worldId','name'].includes(k))continue;if(emptyValue(existing[k])&&!emptyValue(v))patch[k]=v}return patch}
function createWorld(input){return add('worlds',{name:input.name||'未命名世界',emoji:input.emoji||'✦',summary:input.summary||'',era:input.era||'',location:input.location||'',rules:input.rules||'',tone:input.tone||''})}
function createCharacter(input){const worldId=input.worldId,name=input.name||'未命名角色';const existing=worldId?findCharacterByName(worldId,name):null;if(existing){const patch=mergeEmpty(existing,input);if(Object.keys(patch).length)update('characters',existing.id,patch);window.dispatchEvent(new CustomEvent('oclife:duplicate-character-blocked',{detail:{existingId:existing.id,existingName:existing.name,inputName:name}}));return get('characters',existing.id)}
 const c=add('characters',{worldId,name,emoji:input.emoji||'◉',gender:input.gender||'',age:input.age||'',appearance:input.appearance||'',personality:input.personality||'',identity:input.identity||'',speech:input.speech||'',relationships:input.relationships||'',habits:input.habits||'',background:input.background||'',abilities:input.abilities||'',boundaries:input.boundaries||'',notes:input.notes||'',avatarData:input.avatarData||'',interactionProfile:input.interactionProfile||{},relationshipLinks:Array.isArray(input.relationshipLinks)?input.relationshipLinks:[]});add('statuses',{worldId:c.worldId,characterId:c.id,place:'未設定',activity:'正在休息',mood:'平靜',withIds:[],updatedAt:Date.now()});return c}
function ensureChat(worldId,aId,bId){const ids=[aId,bId].sort();let chat=db.chats.find(c=>c.worldId===worldId&&c.memberIds.length===2&&[...c.memberIds].sort().join('|')===ids.join('|'));if(!chat)chat=add('chats',{worldId,memberIds:ids,title:'',lastAt:0});return chat}
function deleteWorld(worldId){const chatIds=all('chats',{worldId}).map(x=>x.id);db.worlds=db.worlds.filter(x=>x.id!==worldId);db.characters=db.characters.filter(x=>x.worldId!==worldId);db.statuses=db.statuses.filter(x=>x.worldId!==worldId);db.chats=db.chats.filter(x=>x.worldId!==worldId);db.messages=db.messages.filter(x=>!chatIds.includes(x.chatId));db.moments=db.moments.filter(x=>x.worldId!==worldId);save()}
function exportData(){return new Blob([JSON.stringify(db,null,2)],{type:'application/json'})}
function importData(obj){if(!obj||!Array.isArray(obj.worlds)||!Array.isArray(obj.characters))throw new Error('不是有效的 OC Life 備份');db=Object.assign(clone(seed),obj,{version:1});save()}
window.OCLifeStore={uid,all,get,add,update,remove,createWorld,createCharacter,ensureChat,deleteWorld,exportData,importData,canonicalName,namesEquivalent,findCharacterByName,mergeEmpty,get data(){return db},save};
})();