import fs from 'node:fs';
const VERSION='20260821-1';
const path='announcements.json';
const data=JSON.parse(fs.readFileSync(path,'utf8'));
if(!Array.isArray(data.announcements))data.announcements=[];
if(!data.announcements.some(x=>String(x?.id||x?.version||'')===VERSION))data.announcements.unshift({id:VERSION,type:'update',version:VERSION,date:'2026-08-21',title:'人格引擎 2.0 與主動私聊',summary:'角色現在會依關係、事件與個性主動私聊；新增人格校準與可選 OOC 二次審稿。',items:['主動聊天改用關係、共同事件、最近動態、沉默時間與角色主動性決策。','角色編輯新增人格校準 2.0 與說話正反例。','聊天允許不對稱發言，寡言角色可以短回或不延伸。','動態或事件之後可能自然轉為私聊。','可選 OOC 二次審稿，避免角色被平均化成通用溫柔口吻。']});
data.latest=VERSION;
fs.writeFileSync(path,JSON.stringify(data,null,2)+'\n');
console.log(`Materialized runtime release notice ${VERSION} for validation.`);
