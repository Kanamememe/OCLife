(function(){
'use strict';
const S=()=>window.OCLifeStore;const pick=a=>a[Math.floor(Math.random()*a.length)];
const T={activities:['在整理手邊的東西','剛忙完一件事，正在放空','坐著發呆','在吃東西','在看訊息','準備出門','剛回到住處','在處理工作','在做自己的興趣','什麼也沒做，只是休息'],moods:['平靜','放鬆','有點累','心情不錯','專注','有點無聊'],places:['住處','工作地點','街上','咖啡店','房間','附近'],openers:['你在做什麼','剛剛想到一件事','還醒著？','今天過得怎麼樣','我剛忙完','突然有點想找你說話'],replies:['沒什麼，剛好也在想事情','嗯？怎麼突然問這個','還行，你呢','我知道，你一開口我就猜到了','等我一下，馬上回來','說吧，我在聽']};
function chars(worldId){return S().all('characters',{worldId})}function statusOf(id){return S().all('statuses').find(s=>s.characterId===id)}
function tickStatuses(worldId){for(const c of chars(worldId)){const st=statusOf(c.id);if(!st||Math.random()<.58)continue;S().update('statuses',st.id,{place:pick(T.places),activity:pick(T.activities),mood:pick(T.moods),updatedAt:Date.now()})}}
function autonomousChat(worldId){const list=chars(worldId);if(list.length<2)return null;const a=pick(list),b=pick(list.filter(x=>x.id!==a.id)),chat=S().ensureChat(worldId,a.id,b.id);const m1=S().add('messages',{chatId:chat.id,worldId,senderId:a.id,text:pick(T.openers),at:Date.now()-3500});const m2=S().add('messages',{chatId:chat.id,worldId,senderId:b.id,text:pick(T.replies),at:Date.now()});S().update('chats',chat.id,{lastAt:Date.now()});return[m1,m2]}
function autonomousMoment(worldId){const list=chars(worldId);if(!list.length)return null;const c=pick(list),st=statusOf(c.id),moment=S().add('moments',{worldId,characterId:c.id,text:pick([`${st?.activity||'今天很安靜'}\n偶爾這樣也不錯`,`今天的狀態：${st?.mood||'平靜'}`,`剛從${st?.place||'外面'}回來`,'沒什麼特別的，只是想留一句','今天有點想偷懶']),at:Date.now(),likes:[],comments:[]});const others=list.filter(x=>x.id!==c.id);if(others.length&&Math.random()<.7){moment.comments.push({id:S().uid('comment'),characterId:pick(others).id,text:pick(['看到了','你倒是挺悠閒','嗯，知道了','晚點聊','這句我記住了']),at:Date.now()+1000});S().save()}return moment}
function simulate(worldId,opts={}){tickStatuses(worldId);if(opts.chat!==false&&Math.random()<.75)autonomousChat(worldId);if(opts.moment!==false&&Math.random()<.55)autonomousMoment(worldId)}
window.OCLifeSimulator={simulate,tickStatuses,autonomousChat,autonomousMoment};
})();
