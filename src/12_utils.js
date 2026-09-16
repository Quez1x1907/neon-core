/* ==================== Утилиты ==================== */
const TAU = Math.PI*2;
const clamp = (v,a,b)=> v<a?a:(v>b?b:v);
const lerp = (a,b,k)=> a+(b-a)*k;
const dist2 = (ax,ay,bx,by)=>{ const dx=ax-bx, dy=ay-by; return dx*dx+dy*dy; };
const rnd = (a=1,b)=> b===undefined ? Math.random()*a : a+Math.random()*(b-a);
const rndi = (a,b)=> Math.floor(rnd(a,b+1));
const pick = arr => arr[Math.floor(Math.random()*arr.length)];
const $ = id => document.getElementById(id);

function fmtNum(n){
  n = Math.round(n);
  if (n >= 100000) return Math.round(n/1000)+'k';
  if (n >= 10000) return (n/1000).toFixed(1).replace('.0','')+'k';
  return ''+n;
}
function hexA(hex, a){ // '#rrggbb' + alpha → 'rgba(...)'
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return 'rgba('+r+','+g+','+b+','+a+')';
}
function shade(hex, f){ // f>1 светлее, f<1 темнее
  const c = [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
  return 'rgb('+c.map(v=>clamp(Math.round(v*f),0,255)).join(',')+')';
}
