(function(){
'use strict';
const S=window.OCLifeStore,Sim=window.OCLifeSimulator;
let worldId=null,tab='now',chatId=null;
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=t=>new Date(t||Date.now()).toLocaleTimeString('zh-Hant',{hour:'2-digit',minute:'2-digit'});
const char=id=>S.get('characters',id),world=()=>S.get('worlds',worldId),avatar=c=>`<div class="avatar">${esc(c?.emoji||'◉')}</div>`;

function validWorld(id){return !!(id&&S.get('worlds',id))}
function setWorld(id){
  if(!validWorld(id))return false;
  worldId=id;
  try{window.OCLifeWorldContext?.set?.(id)}catch(_){}
  return true;
}
function recoverWorld(){
  if(validWorld(worldId))return worldId;
  const id=window.OCLifeWorldContext?.get?.()||window.OCLifePhone?.activeWorldId||null;
  if(validWorld(id)){worldId=id;return id}
  return null;
}
function openWorld(id,nextTab='now',renderView=true){
  if(!setWorld(id))return false;
  tab=nextTab||'now';chatId=null;
  if(renderView)render();
  return true;
}
function openTab(nextTab){
  if(!recoverWorld())return renderWorlds();
  tab=nextTab||'now';chatId=null;render();
}
function setHeader(title,crumb){
  $('#pageTitle').textContent=title;
  $('#crumb').textContent=crumb;
  $('#backBtn').classList.toggle('hidden',!worldId);
  $('#worldNav').classList.toggle('hidden',!worldId||!!chatId);
}
function modal(html){$('#modalRoot').innerHTML=`<div class="modal-bg"><div class="modal">${html}</div></div>`;$('.modal-bg').onclick=e=>{if(e.target===e.currentTarget)closeModal()}}
function closeModal(){$('#modalRoot').innerHTML=''}
function empty(title,text){return`<div class="empty"><strong>${esc(title)}</strong>${esc(text)}</div>`}

function renderWorlds(){
  worldId=null;chatId=null;
  setHeader('我的世界','OC LIFE');
  const worlds=S.all('worlds');
  $('#view').innerHTML=`<section class="hero"><h2>把每一組 OC 留在自己的世界裡</h2><p>不同世界的角色、聊天、動態與狀態完全隔離。你可以只旁觀，也可以手動推進世界。</p></section><div class="toolbar"><button class="primary" id="newWorld">＋ 新建世界</button><button class="secondary" id="importBtn">匯入備份</button><button class="secondary" id="exportBtn">匯出全部</button></div><div class="grid">${worlds.map(w=>`<article class="card world-card" data-world="${w.id}"><div class="emoji">${esc(w.emoji)}</div><h3>${esc(w.name)}</h3><div class="meta">${esc(w.era||'未設定時代')} · ${S.all('characters',{worldId:w.id}).length} 名角色</div><p class="meta">${esc(w.summary||'還沒有世界簡介')}</p><div class="spacer"></div><span class="chip">${esc(w.location||'未設定地點')} →</span></article>`).join('')}</div>${worlds.length?'':empty('還沒有世界','先建立第一個 OC 世界')}`;
  $('#newWorld').onclick=openNewWorld;$('#exportBtn').onclick=exportAll;$('#importBtn').onclick=importAll;
  document.querySelectorAll('[data-world]').forEach(el=>el.onclick=()=>openWorld(el.dataset.world,'now',true));
}
function openNewWorld(){
  modal(`<h2>新建世界</h2><div class="two"><div class="field"><label>名稱</label><input id="mwName" placeholder="例如：末日黑環"></div><div class="field"><label>圖示</label><input id="mwEmoji" value="✦"></div></div><div class="field"><label>簡介</label><textarea id="mwSummary"></textarea></div><div class="two"><div class="field"><label>時代</label><input id="mwEra" placeholder="現代／末世／古代"></div><div class="field"><label>主要地點</label><input id="mwLoc"></div></div><div class="field"><label>世界硬規則</label><textarea id="mwRules" placeholder="AI 不可違反的規則"></textarea></div><div class="actions"><button class="secondary" data-close>取消</button><button class="primary" id="mwSave">建立</button></div>`);
  $('[data-close]').onclick=closeModal;
  $('#mwSave').onclick=()=>{const w=S.createWorld({name:$('#mwName').value,emoji:$('#mwEmoji').value,summary:$('#mwSummary').value,era:$('#mwEra').value,location:$('#mwLoc').value,rules:$('#mwRules').value});closeModal();openWorld(w.id,'now',true)};
}
function chatCard(ch){const members=ch.memberIds.map(char).filter(Boolean),msgs=S.all('messages',{chatId:ch.id}).sort((a,b)=>a.at-b.at),last=msgs.at(-1);return`<article class="card chat-card" data-chat="${ch.id}">${avatar(members[0])}<div class="grow"><h3>${members.map(x=>esc(x.name)).join(' × ')}</h3><div class="meta ellipsis">${last?esc(last.text):'還沒有對話'}</div></div><div class="meta">${last?fmt(last.at):''}</div></article>`}
function renderNow(){
  const w=world();if(!w)return renderWorlds();
  const chars=S.all('characters',{worldId});setHeader(w.name,'現在');
  const statuses=chars.map(c=>({c,st:S.all('statuses').find(s=>s.characterId===c.id)}));
  const latest=S.all('chats',{worldId}).sort((a,b)=>(b.lastAt||0)-(a.lastAt||0)).slice(0,3);
  $('#view').innerHTML=`<section class="hero"><div class="row between"><div><div class="eyebrow">LIVE WORLD</div><h2>${esc(w.emoji)} ${esc(w.name)}</h2></div><span class="chip">${new Date().toLocaleDateString('zh-Hant')}</span></div><p>${esc(w.summary||'這個世界正在安靜地運行。')}</p></section><div class="toolbar"><button class="primary" id="advanceBtn">▶ 推進一次</button><button class="secondary" id="statusEdit">調整狀態</button></div><div class="section-head"><h2>現在</h2><span class="meta">${chars.length} 名角色</span></div><div class="list">${statuses.map(({c,st})=>`<article class="card status-card"><div class="row">${avatar(c)}<div class="grow"><div class="row"><h3 class="grow">${esc(c.name)}</h3><span class="dot"></span></div><div>${esc(st?.activity||'尚未設定')}</div><div class="detail">${esc(st?.place||'未知地點')} · ${esc(st?.mood||'平靜')} · ${fmt(st?.updatedAt)}</div></div></div></article>`).join('')}</div>${chars.length?'':empty('還沒有角色','先到「角色」建立這個世界的 OC')}<div class="section-head"><h2>最近互動</h2><button class="secondary" id="moreChats">全部聊天</button></div><div class="list">${latest.map(chatCard).join('')}</div>`;
  $('#advanceBtn').onclick=()=>{Sim.simulate(worldId);renderNow()};$('#statusEdit').onclick=openStatusEditor;$('#moreChats').onclick=()=>openTab('chat');document.querySelectorAll('[data-chat]').forEach(x=>x.onclick=()=>openChat(x.dataset.chat));
}
function renderChats(){
  const w=world();if(!w)return renderWorlds();setHeader('聊天',w.name);
  const chats=S.all('chats',{worldId}).sort((a,b)=>(b.lastAt||0)-(a.lastAt||0));
  $('#view').innerHTML=`<div class="toolbar"><button class="primary" id="autoChat">＋ 生成一次角色對話</button><button class="secondary" id="newChat">建立聊天室</button></div><div class="list">${chats.map(chatCard).join('')}</div>${chats.length?'':empty('還沒有聊天','角色可以自己開始聊天，也可以由你建立')}`;
  $('#autoChat').onclick=()=>{Sim.autonomousChat(worldId);renderChats()};$('#newChat').onclick=openNewChat;document.querySelectorAll('[data-chat]').forEach(x=>x.onclick=()=>openChat(x.dataset.chat));
}
function openNewChat(){const chars=S.all('characters',{worldId});if(chars.length<2)return alert('至少需要兩名角色');modal(`<h2>建立聊天室</h2><div class="field"><label>角色 A</label><select id="ca">${chars.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>角色 B</label><select id="cb">${chars.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="actions"><button class="secondary" data-close>取消</button><button class="primary" id="ccreate">建立</button></div>`);$('[data-close]').onclick=closeModal;$('#ccreate').onclick=()=>{if($('#ca').value===$('#cb').value)return alert('請選不同角色');const c=S.ensureChat(worldId,$('#ca').value,$('#cb').value);closeModal();openChat(c.id)}}
function openChat(id){chatId=id;renderChatScreen()}
function renderChatScreen(){const ch=S.get('chats',chatId);if(!ch){chatId=null;return renderChats()}const members=ch.memberIds.map(char).filter(Boolean),msgs=S.all('messages',{chatId}).sort((a,b)=>a.at-b.at);setHeader(members.map(x=>x.name).join(' × '),world()?.name||'聊天');$('#view').innerHTML=`<section class="chat-screen"><div class="messages">${msgs.map(m=>`<div class="msg ${m.senderId===members[0]?.id?'left':'right'}"><small>${esc(char(m.senderId)?.name||'角色')} · ${fmt(m.at)}</small>${esc(m.text)}</div>`).join('')}</div><div class="composer"><select id="senderSel">${members.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><input id="msgInput" placeholder="手動加入一句話"><button class="primary" id="sendMsg">發送</button></div></section>`;$('#sendMsg').onclick=()=>{const t=$('#msgInput').value.trim();if(!t)return;S.add('messages',{chatId,worldId,senderId:$('#senderSel').value,text:t,at:Date.now()});S.update('chats',chatId,{lastAt:Date.now()});renderChatScreen()}}
function renderMoments(){
  const w=world();if(!w)return renderWorlds();setHeader('動態',w.name);
  const moments=S.all('moments',{worldId}).sort((a,b)=>b.at-a.at);
  $('#view').innerHTML=`<div class="toolbar"><button class="primary" id="autoMoment">＋ 角色自主發一條</button><button class="secondary" id="manualMoment">手動建立</button></div><div class="list">${moments.map(m=>{const c=char(m.characterId);return`<article class="card moment-card"><div class="row">${avatar(c)}<div><b>${esc(c?.name||'角色')}</b><div class="meta">${new Date(m.at).toLocaleString('zh-Hant')}</div></div></div><div class="moment-text">${esc(m.text)}</div><div class="moment-actions"><span>♡ ${m.likes?.length||0}</span><span>留言 ${m.comments?.length||0}</span></div>${m.comments?.length?`<div class="comments">${m.comments.map(x=>`<div><b>${esc(char(x.characterId)?.name||'角色')}：</b>${esc(x.text)}</div>`).join('')}</div>`:''}</article>`}).join('')}</div>${moments.length?'':empty('還沒有動態','角色可以自己發，也可以由你建立')}`;
  $('#autoMoment').onclick=()=>{Sim.autonomousMoment(worldId);renderMoments()};$('#manualMoment').onclick=openManualMoment;
}
function openManualMoment(){const chars=S.all('characters',{worldId});if(!chars.length)return alert('先建立角色');modal(`<h2>建立動態</h2><div class="field"><label>發佈角色</label><select id="mmc">${chars.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>內容</label><textarea id="mmt"></textarea></div><div class="actions"><button class="secondary" data-close>取消</button><button class="primary" id="mms">發佈</button></div>`);$('[data-close]').onclick=closeModal;$('#mms').onclick=()=>{S.add('moments',{worldId,characterId:$('#mmc').value,text:$('#mmt').value,at:Date.now(),likes:[],comments:[]});closeModal();renderMoments()}}
function renderCharacters(){
  const w=world();if(!w)return renderWorlds();setHeader('角色',w.name);
  const chars=S.all('characters',{worldId});
  $('#view').innerHTML=`<div class="toolbar"><button class="primary" id="addChar">＋ 新增角色</button></div><div class="list">${chars.map(c=>`<article class="card character-card"><div class="row">${avatar(c)}<div class="grow"><h3>${esc(c.name)}</h3><div class="meta">${esc(c.identity||'身份未設定')}</div><div class="detail">${esc(c.personality||'尚未填寫性格')}</div></div></div></article>`).join('')}</div>${chars.length?'':empty('這個世界還沒有人','新增第一名 OC')}`;
  $('#addChar').onclick=openAddChar;
}
function openAddChar(){modal(`<h2>新增角色</h2><div class="two"><div class="field"><label>名字</label><input id="cn"></div><div class="field"><label>圖示</label><input id="ce" value="◉"></div></div><div class="field"><label>身份／職業</label><input id="ci"></div><div class="field"><label>外貌</label><textarea id="cap"></textarea></div><div class="field"><label>性格</label><textarea id="cp"></textarea></div><div class="field"><label>說話方式</label><textarea id="cs"></textarea></div><div class="field"><label>與其他角色的關係</label><textarea id="cr"></textarea></div><div class="field"><label>習慣／喜好／禁忌</label><textarea id="ch"></textarea></div><div class="actions"><button class="secondary" data-close>取消</button><button class="primary" id="charSave">建立</button></div>`);$('[data-close]').onclick=closeModal;$('#charSave').onclick=()=>{S.createCharacter({worldId,name:$('#cn').value,emoji:$('#ce').value,identity:$('#ci').value,appearance:$('#cap').value,personality:$('#cp').value,speech:$('#cs').value,relationships:$('#cr').value,habits:$('#ch').value});closeModal();renderCharacters()}}
function renderWorldInfo(){const w=world();if(!w)return renderWorlds();setHeader('世界資料',w.name);$('#view').innerHTML=`<dl class="card world-info"><dt>名稱</dt><dd>${esc(w.name)}</dd><dt>簡介</dt><dd>${esc(w.summary||'未設定')}</dd><dt>時代</dt><dd>${esc(w.era||'未設定')}</dd><dt>主要地點</dt><dd>${esc(w.location||'未設定')}</dd><dt>世界硬規則</dt><dd>${esc(w.rules||'未設定')}</dd></dl><div class="toolbar"><button class="danger" id="deleteWorld">刪除這個世界</button></div>`;$('#deleteWorld').onclick=()=>{if(confirm('確定刪除這個世界與全部聊天、動態嗎？')){S.deleteWorld(worldId);worldId=null;window.OCLifeWorldContext?.clear?.();render()}}}
function openStatusEditor(){const chars=S.all('characters',{worldId});if(!chars.length)return;modal(`<h2>調整角色現在狀態</h2><div class="field"><label>角色</label><select id="seChar">${chars.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></div><div class="field"><label>地點</label><input id="sePlace"></div><div class="field"><label>正在做什麼</label><input id="seAct"></div><div class="field"><label>心情</label><input id="seMood"></div><div class="actions"><button class="secondary" data-close>取消</button><button class="primary" id="seSave">儲存</button></div>`);function fill(){const st=S.all('statuses').find(s=>s.characterId===$('#seChar').value);$('#sePlace').value=st?.place||'';$('#seAct').value=st?.activity||'';$('#seMood').value=st?.mood||''}$('#seChar').onchange=fill;fill();$('[data-close]').onclick=closeModal;$('#seSave').onclick=()=>{const st=S.all('statuses').find(s=>s.characterId===$('#seChar').value);S.update('statuses',st.id,{place:$('#sePlace').value,activity:$('#seAct').value,mood:$('#seMood').value,updatedAt:Date.now()});closeModal();renderNow()}}
function openSettings(){const s=S.data.settings||{};modal(`<h2>OC Life 設定</h2><div class="field"><label>AI 服務商</label><select id="sp"><option value="none">不使用 API</option><option value="openai">OpenAI 相容</option><option value="gemini">Gemini</option></select></div><div class="field"><label>Base URL</label><input id="sb" value="${esc(s.baseUrl||'')}"></div><div class="field"><label>Model</label><input id="sm" value="${esc(s.model||'')}"></div><div class="field"><label>API Key</label><input id="sk" type="password" value="${esc(s.apiKey||'')}"></div><div class="actions"><button class="secondary" data-close>取消</button><button class="primary" id="ssave">儲存</button></div>`);$('#sp').value=s.provider||'none';$('[data-close]').onclick=closeModal;$('#ssave').onclick=()=>{S.data.settings={...S.data.settings,provider:$('#sp').value,baseUrl:$('#sb').value,model:$('#sm').value,apiKey:$('#sk').value};S.save();closeModal()}}
function exportAll(){const blob=S.exportData(),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`oclife-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function importAll(){const input=document.createElement('input');input.type='file';input.accept='application/json';input.onchange=async()=>{try{S.importData(JSON.parse(await input.files[0].text()));alert('匯入完成');render()}catch(e){alert(e.message)}};input.click()}
function render(){
  chatId=null;
  if(!worldId)return renderWorlds();
  if(!S.get('worlds',worldId)){worldId=null;return renderWorlds()}
  document.querySelectorAll('#worldNav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  if(tab==='now')renderNow();else if(tab==='chat')renderChats();else if(tab==='moments')renderMoments();else if(tab==='characters')renderCharacters();else renderWorldInfo();
}

window.OCLifeApp={version:'2.0.0',setWorld,openWorld,openTab,recoverWorld,render,get worldId(){return worldId},get tab(){return tab}};
$('#worldNav').onclick=e=>{const b=e.target.closest('[data-tab]');if(!b)return;openTab(b.dataset.tab)};
$('#backBtn').onclick=()=>{if(chatId){chatId=null;return renderChats()}worldId=null;window.OCLifeWorldContext?.clear?.();render()};
$('#settingsBtn').onclick=openSettings;
render();
})();