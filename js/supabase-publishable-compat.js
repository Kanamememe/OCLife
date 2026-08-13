(function(){
'use strict';
const nativeFetch=window.fetch.bind(window);
function supabaseUrl(input){try{return new URL(typeof input==='string'?input:input?.url,location.href)}catch(_){return null}}
window.fetch=function(input,init){
 const url=supabaseUrl(input);
 if(!url||!url.hostname.endsWith('.supabase.co')||!init?.headers)return nativeFetch(input,init);
 const headers=new Headers(init.headers),key=headers.get('apikey'),authorization=headers.get('Authorization');
 if(key?.startsWith('sb_publishable_')&&authorization===`Bearer ${key}`)headers.delete('Authorization');
 return nativeFetch(input,{...init,headers});
};
window.OCLifeSupabaseCompat={version:'1.0.0'};
})();
