import fs from 'node:fs';
const VERSION='20260819-1';
const path='announcements.json';
const data=JSON.parse(fs.readFileSync(path,'utf8'));
if(!Array.isArray(data.announcements))data.announcements=[];
if(!data.announcements.some(x=>String(x?.id||x?.version||'')===VERSION))data.announcements.unshift({id:VERSION,type:'update',version:VERSION,date:'2026-08-19',title:'角色主線評議與圖片動態修復',summary:'角色現在能閱讀並評價自己的主線；圖片動態修復實際發佈流程，並新增指定發文者與角色專屬照片。',items:['手機世界首頁新增「主線評議」，可讓全員或指定角色閱讀並評價使用者寫的主線。','主線評議提供後設讀後感與親身經歷回顧兩種模式，結果可儲存。','修正圖片動態發佈後沒有出現在動態頁、照片沒有掛到正確卡片的問題。','圖片動態可明確指定發文角色，也可讓 AI 在有權使用照片的角色中選角。','圖片動態正文可留空，支援只發照片。','照片新增角色權限：全部、屏蔽指定角色、僅限指定角色（專屬照片）。','角色限制不會刪除已經發佈的圖片動態。','新增圖片實際發佈、角色專屬權限與主線評議 WebKit 測試。']});
data.latest=VERSION;
fs.writeFileSync(path,JSON.stringify(data,null,2)+'\n');
console.log(`Materialized runtime release notice ${VERSION} for validation.`);
