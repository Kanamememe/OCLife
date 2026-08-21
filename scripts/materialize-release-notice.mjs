import fs from 'node:fs';
const VERSION='20260821-2';
const path='announcements.json';
const data=JSON.parse(fs.readFileSync(path,'utf8'));
if(!Array.isArray(data.announcements))data.announcements=[];
if(!data.announcements.some(x=>String(x?.id||x?.version||'')===VERSION))data.announcements.unshift({id:VERSION,type:'update',version:VERSION,date:'2026-08-21',title:'主線長期記憶與世界快速返回',summary:'主線不再看完就忘；作者原文可建立角色經歷與語氣校準，並新增世界內一鍵返回「我的世界」。',items:['世界內新增固定「我的世界」按鈕，可從手機首頁直接返回世界管理頁。','新儲存的主線可選「事件＋語氣都納入」「只學語氣」「不納入記憶」。','主線分析只從作者貼上的原文抽取，不會用 AI 自己生成的評價反向教角色。','主線可抽取角色親身經歷、關係變化、說話方式、稱呼、句型、情緒外露與習慣。','已儲存的舊主線收藏可批量重新分析，沿用新版長期記憶與人格學習。','未曾儲存原文的舊評價無法憑空恢復，需重新貼上主線。']});
data.latest=VERSION;
fs.writeFileSync(path,JSON.stringify(data,null,2)+'\n');
console.log(`Materialized runtime release notice ${VERSION} for validation.`);
