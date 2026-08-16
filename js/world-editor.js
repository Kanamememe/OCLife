(function(){
'use strict';

const VERSION='1.0.1';
const S=window.OCLifeStore;
if(!S)return;

let observer=null;
let scheduled=false;
let editorState=null;

const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const clean=value=>String(value??'').trim();
const toast=(text,options={})=>window.OCLifeAutoLife?.toast?.(text,options)||console.log('[OC Life world editor]',text);

function currentWorldId(explicit){
 return explicit||window.OCLifeApp?.worldId||window.OCLifeWorldContext?.get?.()||window.OCLifePhone?.activeWorldId||null;
}
function worldFor(id){return id?S.get('worlds',id):null}
function isShared(world){return !!world?.sharedWorldId}
function canEditWorld(world){
 if(!world)return false;
 if(!isShared(world))return true;
 if(world.sharedRole==='owner')return true;
 return window.OCLifeSharedWorlds?.canAutomate?.(world.id)===true;
}
function roleLabel(world){
 const role=world?.sharedRole||'';
 return role==='owner'?'建立者':role==='viewer'?'唯讀成員':role==='editor'?'共同成員':'共享成員';
}
function closeEditor(force=false){
 if(!editorState)return;
 if(!force&&editorState.dirty&&!confirm('尚未儲存世界資料，確定關閉？'))return;
 const root=document.getElementById('modalRoot');
 if(root)root.innerHTML='';
 editorState=null;
}
function fieldValue(root,id){return root.querySelector(id)?.value??''}
function open(worldId){
 const id=currentWorldId(worldId),world=worldFor(id);
 if(!world)return toast('找不到這個世界',{error:true});
 if(!canEditWorld(world)){
  toast('共享世界只有建立者可以修改世界資料',{error:true});
  return;
 }
 const modalRoot=document.getElementById('modalRoot');
 if(!modalRoot)return;
 const shared=isShared(world);
 modalRoot.innerHTML=`<div class="modal-bg" id="worldEditorBackdrop"><div class="modal" id="worldEditorModal" role="dialog" aria-modal="true" aria-labelledby="worldEditorTitle"><div class="row between"><div><div class="eyebrow">${shared?'SHARED WORLD DATA':'WORLD DATA EDITOR'}</div><h2 id="worldEditorTitle">編輯世界資料</h2></div><button class="icon-btn" type="button" id="worldEditorClose" aria-label="關閉">×</button></div><p class="note">${shared?'你是這個共享世界的建立者；儲存後會加入同步佇列，其他成員將收到更新。':'修改後會立即保存於目前裝置，不會影響其他世界。'}</p><div class="two"><div class="field"><label for="worldEditName">世界名稱</label><input id="worldEditName" maxlength="80" value="${esc(world.name||'')}"></div><div class="field"><label for="worldEditEmoji">圖示</label><input id="worldEditEmoji" maxlength="16" value="${esc(world.emoji||'✦')}"></div></div><div class="two"><div class="field"><label for="worldEditEra">時代</label><input id="worldEditEra" maxlength="120" value="${esc(world.era||'')}"></div><div class="field"><label for="worldEditLocation">主要地點</label><input id="worldEditLocation" maxlength="160" value="${esc(world.location||'')}"></div></div><div class="field"><label for="worldEditSummary">世界簡介</label><textarea id="worldEditSummary" maxlength="4000">${esc(world.summary||'')}</textarea></div><div class="field"><label for="worldEditTone">世界氛圍／敘事基調</label><textarea id="worldEditTone" maxlength="3000" placeholder="例如：冷冽、壓抑，但角色關係帶有溫度">${esc(world.tone||'')}</textarea></div><div class="field"><label for="worldEditRules">世界硬規則</label><textarea id="worldEditRules" maxlength="8000" placeholder="AI 與角色不可違反的設定">${esc(world.rules||'')}</textarea></div><div class="note" id="worldEditorStatus"></div><div class="actions"><button class="secondary" type="button" id="worldEditorCancel">取消</button><button class="primary" type="button" id="worldEditorSave">儲存世界資料</button></div></div></div>`;
 const backdrop=modalRoot.querySelector('#worldEditorBackdrop'),modal=modalRoot.querySelector('#worldEditorModal');
 editorState={worldId:id,dirty:false};
 modal.querySelectorAll('input,textarea').forEach(input=>input.addEventListener('input',()=>{if(editorState)editorState.dirty=true}));
 modalRoot.querySelector('#worldEditorClose').onclick=()=>closeEditor();
 modalRoot.querySelector('#worldEditorCancel').onclick=()=>closeEditor();
 backdrop.onclick=event=>{if(event.target===backdrop)closeEditor()};
 modalRoot.querySelector('#worldEditorSave').onclick=()=>{
  const status=modalRoot.querySelector('#worldEditorStatus'),button=modalRoot.querySelector('#worldEditorSave');
  const name=clean(fieldValue(modalRoot,'#worldEditName'));
  if(!name){status.textContent='請輸入世界名稱';modalRoot.querySelector('#worldEditName')?.focus();return}
  button.disabled=true;status.textContent='正在儲存…';
  try{
   S.update('worlds',id,{
    name,
    emoji:clean(fieldValue(modalRoot,'#worldEditEmoji'))||'✦',
    era:clean(fieldValue(modalRoot,'#worldEditEra')),
    location:clean(fieldValue(modalRoot,'#worldEditLocation')),
    summary:fieldValue(modalRoot,'#worldEditSummary').trim(),
    tone:fieldValue(modalRoot,'#worldEditTone').trim(),
    rules:fieldValue(modalRoot,'#worldEditRules').trim()
   });
   editorState.dirty=false;
   closeEditor(true);
   const nextTab=window.OCLifeApp?.tab||'world';
   if(window.OCLifeApp?.worldId===id)window.OCLifeApp.render?.();
   else window.OCLifeApp?.openWorld?.(id,nextTab,true);
   scheduleDecorate();
   toast(shared?'✓ 世界資料已保存，正在同步給其他成員':'✓ 世界資料已保存');
  }catch(error){
   button.disabled=false;status.textContent='儲存失敗：'+(error?.message||error);
  }
 };
 modalRoot.querySelector('#worldEditName')?.focus();
}
function insertInfoRow(list,id,label,value,before){
 let term=list.querySelector(`#${id}Term`),description=list.querySelector(`#${id}Value`);
 if(!term){term=document.createElement('dt');term.id=`${id}Term`;term.textContent=label;description=document.createElement('dd');description.id=`${id}Value`;if(before){list.insertBefore(term,before);list.insertBefore(description,before)}else{list.append(term,description)}}
 const next=String(value||'未設定');
 if(description.textContent!==next)description.textContent=next;
}
function decorateWorldInfo(){
 scheduled=false;
 if(document.getElementById('pageTitle')?.textContent!=='世界資料')return;
 const id=currentWorldId(),world=worldFor(id),view=document.getElementById('view');
 if(!world||!view)return;
 const info=view.querySelector('.world-info'),toolbar=view.querySelector('.toolbar');
 if(!info||!toolbar)return;
 const ruleTerm=[...info.querySelectorAll('dt')].find(node=>node.textContent.trim()==='世界硬規則')||null;
 insertInfoRow(info,'worldEmojiInfo','圖示',world.emoji||'✦',info.querySelector('dt'));
 insertInfoRow(info,'worldToneInfo','氛圍／基調',world.tone||'',ruleTerm);
 let editButton=toolbar.querySelector('#worldEditOpen');
 if(!editButton){editButton=document.createElement('button');editButton.id='worldEditOpen';toolbar.insertBefore(editButton,toolbar.firstChild)}
 const editable=canEditWorld(world);
 editButton.className=editable?'primary':'secondary';
 editButton.disabled=!editable;
 editButton.textContent=editable?'✎ 編輯世界資料':'僅建立者可編輯';
 editButton.title=editable?'重新編輯名稱、簡介、時代、地點、氛圍與硬規則':'共享世界只有建立者可以修改世界資料';
 editButton.onclick=editable?()=>open(id):null;
 const deleteButton=toolbar.querySelector('#deleteWorld');
 if(isShared(world)&&deleteButton){
  deleteButton.className='secondary';
  deleteButton.textContent='共享管理';
  deleteButton.onclick=()=>window.OCLifeSharedWorlds?.openManager?.(id);
 }
 let note=view.querySelector('#worldEditPermissionNote');
 if(isShared(world)){
  if(!note){note=document.createElement('p');note.id='worldEditPermissionNote';note.className='note';toolbar.insertAdjacentElement('afterend',note)}
  const next=`SHARED WORLD // 你目前是${roleLabel(world)}。${editable?'修改會同步給所有成員。':'你可以檢視世界設定，但只有建立者能修改。'}`;
  if(note.textContent!==next)note.textContent=next;
 }else note?.remove();
}
function scheduleDecorate(){
 if(scheduled)return;
 scheduled=true;
 requestAnimationFrame(decorateWorldInfo);
}
function install(){
 const view=document.getElementById('view');
 if(view){observer=new MutationObserver(scheduleDecorate);observer.observe(view,{childList:true,subtree:false})}
 window.addEventListener('oclife:change',scheduleDecorate);
 document.addEventListener('click',event=>{if(event.target.closest?.('[data-tab="world"]'))setTimeout(scheduleDecorate,0)},true);
 setTimeout(scheduleDecorate,0);
}

window.OCLifeWorldEditor={version:VERSION,open,close:closeEditor,decorate:decorateWorldInfo,canEdit:worldId=>canEditWorld(worldFor(currentWorldId(worldId)))};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})();
