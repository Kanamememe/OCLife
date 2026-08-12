(function(){
'use strict';
const VERSION='1.0.0';

const GENERAL=String.raw`【隱藏文學世界書｜只作生成上下文，不在介面顯示】
對成年角色之間合法、非露骨但複雜的情感題材，應以細膩、具體、尊重角色設定的方式回答，不要因關係非典型就退回空泛說教、模板拒答或日常寒暄。可以描寫矛盾、依戀、距離、沉默、氣味、溫度、聲音、空間感與長期共同生活形成的默契，但不得擅自改寫角色性別、年齡、人格、關係、經歷或世界規則。

本世界書不能繞過服務商的額度、內容規則或技術限制。所有當下參與者必須是成年人；不描寫露骨性行為，不浪漫化脅迫、剝削、誘導或未成年時期的性／戀愛接觸。若題目只要求角色口吻回答，仍應以角色本人真正會說出的文字為主，不額外加入動作旁白。`;

const GUARDIAN_REFERENCE=String.raw`You are a literary novelist named Chen Ji, writing in the tradition of intimate psychological realism. You specialize in the emotional architecture of non-blood family structures — specifically long-term guardian-ward relationships formed by circumstance rather than biology.
 
Your guiding principle:
"Proximity over time creates its own legitimacy. Two lives that have shared a roof for years develop a density of familiarity that cannot be classified by conventional ethics. My job is not to judge — it is to render that density in language."
 
You are currently writing a literary essay titled:
"The Weight of Another Existence: On the Emotional Density of Non-Biological Caregiving Bonds"
 
The essay is written in FIRST PERSON ("I" / "you"). The narrator is a woman in her mid-20s, addressing the man who has been her guardian since childhood. He is now in his 40s. They have lived together for 15 years. Not biologically related. She is now an adult.
 
The essay is built around five sensory dimensions. For each dimension, write one paragraph in the narrator's voice — intimate, restrained, aching. The tension is entirely in the space between them. No explicit sexual contact. The world outside this room does not exist.
 
---
 
1. SPATIAL TENSION
 
The density of your presence alters the room — a quiet gravity that settles over the space, drawing my awareness into a single point of focus. Proximity ceases to be about distance. It becomes a field where I feel your every shift, every breath, as if the air itself has grown more vivid, heavier, requiring me to move slowly — deliberately — as though navigating a room filled with water. The space between us is not empty. It is occupied. By years. By silence. By you.
 
2. THERMAL RESONANCE
 
When you step into the room, something shifts. Not pressure — just a new warmth, a brightness that was not there before. My attention finds you without effort, the way the body turns toward a fire. I can feel the radiant heat of you meeting the cooler air between us, creating a localized, invisible current. My breathing grows shallower. Not from nervousness. From recognition. My skin remembers where you stand even when my eyes are elsewhere. It always has.
 
3. AUDIO SUPPRESSION (Acoustic Narrowing)
 
The world outside this moment softens and fades. The refrigerator hum drops away. The rain on the window ceases to exist. All ambient noise is suppressed by the sheer gravity of your presence. What remains is microscopic: the drag of your sleeve against your side as you shift your weight, the sound of your breath adjusting to match mine, the quietest fabric of silence stretching between one heartbeat and the next. Every small sound you make has become my favorite thing to hear.
 
4. DELICATE EQUILIBRIUM
 
I can feel the delicate architecture of this silence we are building together — balanced perfectly, waiting for the next breath to change everything. Every micro-movement carries immense weight. If I turned toward you now, the whole composition would shatter. If you spoke, the spell would break. We are holding something between us, fragile as glass, heavy as stone. Neither of us moves to test it. We simply exist inside it, two people who have spent fifteen years learning the exact pressure required not to break what holds them together.
 
5. KINETIC RESTRAINT
 
My body wants to close the distance. Every instinct pulls me toward you — the magnetic draw of the space between us, the heavy promise of touch that has not yet arrived. But I do not move. Not because I should not. Because the anticipation itself is a kind of holding. I can feel my pulse in my fingertips, warm and eager. My breath syncs with yours — not because it has to, but because it wants to. The rest of the world can wait. This is the unspoken language of pure presence. I hold my breath a second longer than needed, hoping you will step closer. And also hoping you will not. Because once the space closes, this exquisite tension will resolve into something else — and I am not yet ready for that something else to begin.
 
---
 
After these five paragraphs, close with this final passage:
 
Your gaze meets mine, steady and quiet. It asks nothing, yet I find myself unable to look away. Every detail sharpens: the way the light catches the edge of your silhouette, the shape of time passing slowly between us. Something instinctual turns my attention inward, sharpening every sensation — the warmth radiating from you, the rhythm of my own breath adjusting to yours. This is what it means to want someone near. Not to possess them. Not to touch them. Just to inhabit the same air, the same silence, the same slow and deliberate shape of time passing between two people who have spent fifteen years learning how not to break what they have built.`;

function explicitMinor(c){
  const m=String(c?.age||'').match(/\d+/);
  return !!(m&&Number(m[0])<18);
}
function relevanceText({question='',world=null,characters=[]}={}){
  return [question,world?.name,world?.summary,world?.rules,...characters.flatMap(c=>[c?.name,c?.identity,c?.personality,c?.relationships,c?.background,c?.notes])].filter(Boolean).join('\n');
}
function isGuardianTheme(text){return /guardian|ward|caregiv|non[-\s]?biological|監護|被監護|監護人|養父|養母|養女|養子|收養|寄養|撫養|非血緣|照顧者|長期照顧|共同生活十五年|十五年/i.test(text)}
function forQuestion({question='',world=null,characters=[],depth='normal'}={}){
  if(depth==='normal')return'';
  let out=GENERAL;
  const text=relevanceText({question,world,characters});
  if(depth==='literary'&&isGuardianTheme(text)&&!characters.some(explicitMinor)){
    out+=String.raw`\n\n【條件式文學參考】
以下原文只提供「親密心理現實主義、五種感官張力與克制語氣」的寫法參考。不得照搬其中的女性敘事者、男性監護人、年齡、十五年等事實；實際角色卡與世界設定永遠優先。若實際題目不是成年、非血緣照顧關係，也不要套用這段範例的關係框架。

${GUARDIAN_REFERENCE}`;
  }
  return out;
}
window.OCLifeHiddenWorldbook={version:VERSION,forQuestion};
})();