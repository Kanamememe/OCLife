import fs from 'node:fs';
const VERSION='20260817-1';
const path='announcements.json';
const data=JSON.parse(fs.readFileSync(path,'utf8'));
if(!Array.isArray(data.announcements))data.announcements=[];
if(!data.announcements.some(x=>String(x?.id||x?.version||'')===VERSION))data.announcements.unshift({id:VERSION,type:'update',version:VERSION,date:'2026-08-17',title:'照片庫批量上傳',summary:'全域照片庫現在可以一次多選並上傳多張照片，不需要再一張一張加入。',items:['照片選擇器支援一次多選多張圖片。','每張照片會分別解析 EXIF GPS，互不覆蓋。','整批照片會一次寫入 IndexedDB，避免只成功保存第一張。','上傳完成後可把相同的世界可見範圍一次套用到整批照片。','每張照片的位置與畫面補充仍可之後個別修改。','批量上傳過程新增進度提示。']});
data.latest=VERSION;
fs.writeFileSync(path,JSON.stringify(data,null,2)+'\n');
console.log(`Materialized runtime release notice ${VERSION} for validation.`);