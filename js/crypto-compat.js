(function(){
'use strict';
if(!window.crypto||typeof window.crypto.getRandomValues!=='function')return;
if(typeof window.crypto.randomUUID==='function')return;
function randomUUID(){
 const bytes=new Uint8Array(16);
 window.crypto.getRandomValues(bytes);
 bytes[6]=(bytes[6]&0x0f)|0x40;
 bytes[8]=(bytes[8]&0x3f)|0x80;
 const hex=[...bytes].map(x=>x.toString(16).padStart(2,'0'));
 return `${hex.slice(0,4).join('')}-${hex.slice(4,6).join('')}-${hex.slice(6,8).join('')}-${hex.slice(8,10).join('')}-${hex.slice(10,16).join('')}`;
}
try{Object.defineProperty(window.crypto,'randomUUID',{value:randomUUID,configurable:true})}catch(_){try{window.crypto.randomUUID=randomUUID}catch(__){}}
window.OCLifeCryptoCompat={version:'1.0.0',randomUUID};
})();
