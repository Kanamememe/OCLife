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
function createWorld(input){return add('worlds',{name:input.name||'未命名世界',emoji:input.emoji||'✦',summary:input.summary||'',era:input.era||'',location:input.location||'',rules:input.rules||'',tone:input.tone||''})}
function createCharacter(input){const c=add('characters',{worldId:input.worldId,name:input.name||'未命名角色',emoji:input.emoji||'◉',gender:input.gender||'',age:input.age||'',appearance:input.appearance||'',personality:input.personality||'',identity:input.identity||'',speech:input.speech||'',relationships:input.relationships||'',habits:input.habits||'',notes:input.notes||''});add('statuses',{worldId:c.worldId,characterId:c.id,place:'未設定',activity:'正在休息',mood:'平靜',withIds:[],updatedAt:Date.now()});return c}
function ensureChat(worldId,aId,bId){const ids=[aId,bId].sort();let chat=db.chats.find(c=>c.worldId===worldId&&c.memberIds.length===2&&[...c.memberIds].sort().join('|')===ids.join('|'));if(!chat)chat=add('chats',{worldId,memberIds:ids,title:'',lastAt:0});return chat}
function deleteWorld(worldId){const chatIds=all('chats',{worldId}).map(x=>x.id);db.worlds=db.worlds.filter(x=>x.id!==worldId);db.characters=db.characters.filter(x=>x.worldId!==worldId);db.statuses=db.statuses.filter(x=>x.worldId!==worldId);db.chats=db.chats.filter(x=>x.worldId!==worldId);db.messages=db.messages.filter(x=>!chatIds.includes(x.chatId));db.moments=db.moments.filter(x=>x.worldId!==worldId);save()}
function exportData(){return new Blob([JSON.stringify(db,null,2)],{type:'application/json'})}
function importData(obj){if(!obj||!Array.isArray(obj.worlds)||!Array.isArray(obj.characters))throw new Error('不是有效的 OC Life 備份');db=Object.assign(clone(seed),obj,{version:1});save()}
window.OCLifeStore={uid,all,get,add,update,remove,createWorld,createCharacter,ensureChat,deleteWorld,exportData,importData,get data(){return db},save};
})();
