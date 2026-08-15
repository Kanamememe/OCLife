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
  'js/store.js','js/ai.js','js/app-v2.js','js/world-editor.js','js/provider-settings-v3.js','js/shared-worlds.js',
  'js/shared-worlds-audit.js','js/shared-worlds-integrity.js','js/mobile-home-network.js','js/writing-studio.js','js/if-studio.js',
  'js/moment-threads-v1.js','js/question-box.js','js/module-health.js'
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
for(const key of ['OCLifeStore','OCLifeAI','OCLifeWorldEditor','OCLifeProviderSettings','OCLifeWritingStudio','OCLifeIFStudio','OCLifeQuestionBox','OCLifeSharedWorlds','OCLifeSharedAudit','OCLifeSharedIntegrity'])assert(health.includes(key),`module health does not check ${key}`);
const worldEditor=read('js/world-editor.js');
for(const marker of ['WORLD DATA EDITOR','worldEditName','worldEditTone','worldEditRules','canEditWorld','sharedRole','OCLifeWorldEditor'])assert(worldEditor.includes(marker),`world editor missing ${marker}`);
assert(worldEditor.includes("observer.observe(view,{childList:true,subtree:false})"),'world editor observer must stay scoped to direct #view replacements');

const sqlFiles=[
  'supabase/shared-worlds-bootstrap.sql',
  'supabase/shared-worlds.sql',
  'supabase/shared-worlds-security-fix.sql',
  'supabase/shared-worlds-v2.sql',
  'supabase/shared-worlds-token-hash-fix.sql'
];
for(const file of sqlFiles)assert(exists(file),`${file} is missing`);
const bootstrapSql=read('supabase/shared-worlds-bootstrap.sql');
assert(bootstrapSql.includes('set search_path = pg_catalog, extensions, public, pg_temp'),'shared installer bootstrap does not expose the Supabase extensions schema');
const baseSql=read('supabase/shared-worlds.sql');
for(const fn of ['oclife_shared_health','oclife_shared_create_world','oclife_shared_join_world','oclife_shared_pull','oclife_shared_push','oclife_shared_leave_world','oclife_shared_delete_world'])assert(baseSql.includes(`function public.${fn}`),`shared-worlds SQL missing RPC: ${fn}`);
const v2Sql=read('supabase/shared-worlds-v2.sql');
assert(v2Sql.includes("'schema_version', 2"),'shared-worlds v2 health schema is missing');
assert(v2Sql.includes("'security_revision', 2"),'shared-worlds v2 security revision is missing');
assert(v2Sql.includes('jsonb_array_length')&&v2Sql.includes('> 25'),'shared-worlds v2 push size limit is missing');
const tokenHashFix=read('supabase/shared-worlds-token-hash-fix.sql');
assert(tokenHashFix.includes('function public.oclife_shared_token_hash'),'token hash compatibility function is missing');
assert(tokenHashFix.includes('pg_catalog.sha256')&&tokenHashFix.includes('pg_catalog.convert_to'),'token hash fix must use schema-independent PostgreSQL SHA-256');
assert(tokenHashFix.includes('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'),'token hash installer self-test is missing');
assert(!/\bdigest\s*\(/i.test(tokenHashFix),'token hash fix must not depend on pgcrypto digest search_path');
const setupFix=read('js/shared-worlds-setup-fix.js');
assert(setupFix.includes('shared-worlds-bootstrap.sql'),'shared setup does not include schema bootstrap');
assert(setupFix.includes('shared-worlds-v2.sql'),'shared setup does not include v2 migration');
assert(setupFix.includes('shared-worlds-token-hash-fix.sql'),'shared setup does not include token hash repair');
assert(setupFix.indexOf('shared-worlds-bootstrap.sql')<setupFix.indexOf('shared-worlds.sql'),'schema bootstrap must run before base shared SQL');
assert(setupFix.indexOf('shared-worlds-v2.sql')<setupFix.indexOf('shared-worlds-token-hash-fix.sql'),'token hash repair must run after v2 migration');
const audit=read('js/shared-worlds-audit.js');
for(const marker of ['EXPECTED_SCHEMA=2','handlePush','forceReplay','pendingCount','patchStorePermissions','tokenHashCompatibility','handleCreateOrJoin'])assert(audit.includes(marker),`shared audit missing ${marker}`);
assert(!/service_role|sb_secret_/i.test(index+bootstrapSql+baseSql+v2Sql+tokenHashFix+audit),'front-end or shared SQL mentions a server secret key');

for(const file of ['scripts/browser-smoke.mjs','scripts/world-editor-smoke.mjs','scripts/shared-world-smoke.mjs','scripts/shared-sql-smoke.sql'])assert(exists(file),`${file} is missing`);
const worldEditorSmoke=read('scripts/world-editor-smoke.mjs');
for(const phrase of ['World data editor WebKit smoke test passed.','save left the current world','僅建立者可編輯','建立者可以重新編輯並同步'])assert(worldEditorSmoke.includes(phrase),`world editor smoke test is missing: ${phrase}`);
const sharedSmoke=read('scripts/shared-world-smoke.mjs');
for(const phrase of ['two-client','transient failure lost pending operation','owner did not receive enabled thread state','leave did not clear pending queue'])assert(sharedSmoke.includes(phrase),`shared smoke test is missing: ${phrase}`);
const sqlSmoke=read('scripts/shared-sql-smoke.sql');
for(const phrase of ['create extension pgcrypto with schema extensions','shared-worlds-bootstrap.sql','shared-worlds-token-hash-fix.sql','oclife_shared_token_hash','oclife_shared_create_world','Shared SQL smoke test passed.'])assert(sqlSmoke.includes(phrase),`shared SQL smoke test is missing: ${phrase}`);

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
