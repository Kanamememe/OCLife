(function(){
'use strict';
const VERSION='1.0.0';
function currentWorld(){return window.OCLifeWorldContext?.get?.()||window.OCLifePhone?.activeWorldId||window.OCLifeApp?.worldId||null}
function wrap(){const r=window.OCLifeStoryReactions;if(!r||r.__contextFixed)return false;const open=r.open.bind(r),library=r.library.bind(r);r.open=forced=>open(forced||currentWorld());r.library=forced=>library(forced||currentWorld());r.__contextFixed=true;return true}
function intercept(e){const button=e.target?.closest?.('#storyReactionOpen');if(!button)return;const id=currentWorld();if(!id)return;e.preventDefault();e.stopImmediatePropagation();wrap();window.OCLifeStoryReactions?.open?.(id)}
function install(){wrap();document.addEventListener('click',intercept,true);window.addEventListener('oclife:world-context',wrap)}
window.OCLifeStoryReactionContext={version:VERSION,currentWorld,wrap};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',install,{once:true}):install();
})();