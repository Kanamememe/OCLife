import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const fail=[];
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));

function assert(ok,message){if(!ok)fail.push(message)}

const versionData=JSON.parse(read('version.json'));
const version=String(versionData.version||'');
assert(/^\d{8}-\d+$/.test(version),`version.json has invalid version: ${version}`);

const index=read('index.html');
const assets=[...index.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m=>m[1]).filter(x=>!/^https?:/i.test(x));
const cleanAsset=x=>x.split('?')[0].replace(/^\.\//,'');
for(const asset of assets){
  const file=cleanAsset(asset);
  assert(exists(file),`index.html references missing file: ${file}`);
  const q=new URLSearchParams(asset.split('?')[1]||'');
  if((file.endsWith('.js')||file.endsWith('.css'))&&q.has('v'))assert(q.get('v')===version,`${file} cache version ${q.get('v')} != ${version}`);
}
assert(new Set(assets.map(cleanAsset)).size===assets.length,'index.html contains duplicate local asset references');

const requiredScripts=[
  'js/store.js','js/ai.js','js/app-v2.js','js/provider-settings-v3.js','js/shared-worlds.js',
  'js/mobile-home-network.js','js/writing-studio.js','js/if-studio.js','js/moment-threads-v1.js',
  'js/question-box.js','js/module-health.js'
];
for(const file of requiredScripts)assert(index.includes(`src="${file}?v=${version}"`),`required script not loaded with current version: ${file}`);

const forbiddenLoaded=['js/app.js','js/provider-settings.js','js/settings-recovery.js','js/api-runtime-sync.js'];
for(const file of forbiddenLoaded)assert(!index.includes(`src="${file}`),`deprecated script is still loaded: ${file}`);

const updater=read('js/update-manager-v2.js');
assert(updater.includes(`CURRENT='${version}'`)||updater.includes(`CURRENT="${version}"`),`update-manager CURRENT does not match ${version}`);

const announcements=JSON.parse(read('announcements.json'));
assert(String(announcements.latest||'')===version,`announcements.latest ${announcements.latest} != ${version}`);
assert((announcements.announcements||[]).some(x=>String(x.id||x.version||'')===version),`announcements missing ${version} entry`);

const health=read('js/module-health.js');
for(const key of ['OCLifeStore','OCLifeAI','OCLifeProviderSettings','OCLifeWritingStudio','OCLifeIFStudio','OCLifeQuestionBox','OCLifeSharedWorlds'])assert(health.includes(key),`module health does not check ${key}`);

assert(exists('supabase/shared-worlds.sql'),'shared-worlds base SQL is missing');
assert(exists('supabase/shared-worlds-security-fix.sql'),'shared-worlds security SQL is missing');
const baseSql=read('supabase/shared-worlds.sql');
for(const fn of ['oclife_shared_health','oclife_shared_create_world','oclife_shared_join_world','oclife_shared_pull','oclife_shared_push','oclife_shared_leave_world','oclife_shared_delete_world'])assert(baseSql.includes(`function public.${fn}`),`shared-worlds SQL missing RPC: ${fn}`);
assert(!/service_role|sb_secret_/i.test(index+baseSql),'front-end or shared SQL mentions a server secret key');

const textFiles=[];
function walk(dir){for(const name of fs.readdirSync(path.join(root,dir))){const rel=path.join(dir,name);const stat=fs.statSync(path.join(root,rel));if(stat.isDirectory())walk(rel);else if(/\.(js|mjs|html|css|json|sql|md|yml|yaml)$/i.test(name))textFiles.push(rel)}}
for(const dir of ['js','css','scripts','supabase','.github'])if(exists(dir))walk(dir);
textFiles.push('index.html','version.json','announcements.json');
const unresolvedMarkers=['<'+'sha>','<'+'content>','... ('+'truncated)'];
for(const file of [...new Set(textFiles)]){
  const text=read(file);
  assert(!unresolvedMarkers.some(marker=>text.includes(marker)),`${file} contains an unresolved placeholder/truncation marker`);
}

if(fail.length){
  console.error(`\nRelease validation failed (${fail.length}):`);
  for(const item of fail)console.error(` - ${item}`);
  process.exit(1);
}
console.log(`Release validation passed for ${version}. Checked ${assets.length} assets and ${textFiles.length} text files.`);
