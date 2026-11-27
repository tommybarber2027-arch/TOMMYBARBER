(function(){
const D={};
const SUN='<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',MOON='<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>';
const esc=k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const RE=new RegExp('(?<![\\u0600-\\u06FF])(?:'+Object.keys(D).sort((a,b)=>b.length-a.length).map(esc).join('|')+')(?![\\u0600-\\u06FF])','g');
const AR=/[\u0600-\u06FF]/,ANY=/[\u0600-\u06FFA-Za-z]/,ATTR=['placeholder','title','aria-label'],root=document.documentElement;
let lang='ar',theme='dark';try{lang='ar';theme=localStorage.getItem('tommy_theme')||'dark'}catch(e){}
const orig=new WeakMap(),wrote=new WeakMap(),origTitle=document.title;
let NRE={en:null,ar:null},NMAP={en:{},ar:{}},NSIG='';
function ensureNames(){let es=[];try{es=window.nameEntries?window.nameEntries():[]}catch(e){}
const sig=JSON.stringify(es.map(x=>x.keys));if(sig===NSIG)return;NSIG=sig;
const en={},ar={};es.forEach(e=>e.keys.forEach(k=>{if(e.en&&k!==e.en)en[k]=e.en;if(e.ar&&k!==e.ar)ar[k]=e.ar}));
NMAP={en,ar};
const mk=m=>{const ks=Object.keys(m).sort((a,b)=>b.length-a.length);if(!ks.length)return null;
return new RegExp(ks.map(k=>{const A=/[\u0600-\u06FF]/;
return (A.test(k[0])?'(?<![\\u0600-\\u06FF])':'(?<![A-Za-z0-9])')+esc(k)+(A.test(k[k.length-1])?'(?![\\u0600-\\u06FF])':'(?![A-Za-z0-9])')}).join('|'),'g')};
NRE={en:mk(en),ar:mk(ar)}}
const T=s=>{ensureNames();if(lang==='en'){s=s.replace(RE,m=>D[m]);if(NRE.en)s=s.replace(NRE.en,m=>NMAP.en[m]||m)}else if(NRE.ar)s=s.replace(NRE.ar,m=>NMAP.ar[m]||m);return s};
function tText(n){const t=n.nodeValue;if(!ANY.test(t))return;const r=T(t);if(r!==t){orig.set(n,t);wrote.set(n,r);n.nodeValue=r}}
function tEl(e){for(const a of ATTR){const v=e.getAttribute(a);if(v&&ANY.test(v)){const r=T(v);if(r!==v){if(!e.hasAttribute('data-ar-'+a))e.setAttribute('data-ar-'+a,v);e.setAttribute(a,r)}}}}
function walk(n){if(n.nodeType===3){tText(n);return}if(n.nodeType!==1||/^(SCRIPT|STYLE)$/.test(n.tagName))return;tEl(n);n.childNodes.forEach(walk)}
function restore(n){if(n.nodeType===3){if(orig.has(n)){n.nodeValue=orig.get(n);orig.delete(n);wrote.delete(n)}return}if(n.nodeType!==1)return;for(const a of ATTR){const o=n.getAttribute('data-ar-'+a);if(o!==null){n.setAttribute(a,o);n.removeAttribute('data-ar-'+a)}}n.childNodes.forEach(restore)}
new MutationObserver(ms=>{for(const m of ms){if(m.type==='childList')m.addedNodes.forEach(walk);else if(m.type==='characterData'){const n=m.target;if(wrote.get(n)===n.nodeValue)continue;orig.delete(n);tText(n)}else if(m.type==='attributes')tEl(m.target)}}).observe(root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['placeholder','title']});
function paint(){
 root.lang=lang==='en'?'en':'ar';root.dir=lang==='en'?'ltr':'rtl';root.classList.toggle('light',theme==='light');
 document.querySelectorAll('.lang-lbl').forEach(e=>e.textContent=lang==='en'?'عربي':'EN');
 document.querySelectorAll('.js-lang').forEach(b=>b.title=lang==='en'?'العربية (مصري)':'English');
 document.querySelectorAll('.theme-ic').forEach(s=>s.innerHTML=theme==='light'?MOON:SUN);
 document.querySelectorAll('.js-theme').forEach(b=>b.title=theme==='light'?(lang==='en'?'Dark mode':'الوضع الغامق'):(lang==='en'?'Light mode':'الوضع الفاتح'));
 document.title=lang==='en'?"TOMMY BARBER - Men's Salon":origTitle;
 const mc=document.querySelector('meta[name="theme-color"]');if(mc)mc.content=theme==='light'?'#F1F3F7':'#0B0A08';
}
function setLang(l){if(l===lang)return;lang=l;try{localStorage.setItem('tommy_lang',l)}catch(e){}restore(document.body);paint();walk(document.body)}
document.addEventListener('click',e=>{if(e.target.closest('.js-lang')){setLang(lang==='en'?'ar':'en');return}if(e.target.closest('.js-theme')){theme=theme==='light'?'dark':'light';try{localStorage.setItem('tommy_theme',theme)}catch(x){}paint()}});
window.i18nHtml=h=>lang==='en'?T(h).replace('dir="rtl"','dir="ltr"').replace('lang="ar"','lang="en"'):T(h);
paint();walk(document.body);
})();
