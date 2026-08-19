import fs from 'node:fs';
const read=p=>fs.readFileSync(p,'utf8'),exists=p=>fs.existsSync(p),fail=[];
const assert=(ok,msg)=>{if(!ok)fail.push(msg)};
const version=JSON.parse(read('version.json')).version,index=read('index.html'),photo=read('js/photo-moments-v2.js'),story=read('js/story-reactions.js'),health=read('js/module-health.js');
assert(version==='20260819-1',`unexpected release version ${version}`);
assert(index.includes(`js/photo-moments-v2.js?v=${version}`),'new photo moment module is not loaded');
assert(!index.includes('src="js/photo-moments.js'),'legacy photo moment module is still loaded');
assert(index.includes(`js/story-reactions.js?v=${version}`),'story reactions module is not loaded');
for(const marker of ['publishMoment','characterAllowed','characterMode','preferredCharacterId','正文（可留空，只發照片）','OCLifeApp?.openTab?.(\'moments\')'])assert(photo.includes(marker),`photo module missing ${marker}`);
for(const marker of ['STORY REACTIONS','story-reaction','知道這是自己的故事','視為親身經歷','OCLifeStoryReactions'])assert(story.includes(marker),`story reactions missing ${marker}`);
for(const marker of ['OCLifeStoryReactions','publishMoment','characterAllowed'])assert(health.includes(marker),`module health missing ${marker}`);
for(const file of ['scripts/photo-publish-smoke.mjs','scripts/story-reactions-smoke.mjs'])assert(exists(file),`${file} is missing`);
const photoSmoke=read('scripts/photo-publish-smoke.mjs'),storySmoke=read('scripts/story-reactions-smoke.mjs');
for(const marker of ['image-only post should be allowed','blocked character appeared as a poster option','Photo publish and character exclusivity WebKit smoke test passed.'])assert(photoSmoke.includes(marker),`photo publish smoke missing ${marker}`);
for(const marker of ['Story reactions WebKit smoke test passed.','story-reaction','主線評價測試'])assert(storySmoke.includes(marker),`story reactions smoke missing ${marker}`);
if(fail.length){console.error(`20260819 validation failed (${fail.length}):`);for(const item of fail)console.error(` - ${item}`);process.exit(1)}
console.log('20260819 story reactions and photo publishing validation passed.');
