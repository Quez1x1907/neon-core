/* ==================== Точка входа: загрузка, главный цикл ====================
   Цикл на трёх источниках, приоритет сверху вниз:
   1. requestAnimationFrame — стандартный путь в обычном браузере.
   2. Web Worker-тикер — встроенные вебвью, где хост не «кормит» rAF
      (у воркера свой таймер, не подчиняющийся троттлингу страницы).
   3. setInterval — последний рубеж, если Worker недоступен. */

let lastFrame = performance.now();
let acc = 0;
const STEP = 1/60;
let rafQueued = false;
let lastRafAt = 0;     // когда rAF в последний раз дал кадр
let workerOn = false;  // воркер взял цикл на себя
const bootAt = performance.now();
let fpsT0 = performance.now(), fpsN = 0, autoLowDone = false;

function tick(now){
  window.__nc_frames = (window.__nc_frames||0) + 1;
  let dt = (now - lastFrame)/1000;
  lastFrame = now;
  if (dt > 0.1) dt = 0.1; // после сворачивания вкладки не догоняем скачок
  const menuTime = now/1000;

  drawBgfx(dt);
  if (UI.cur === 'menu') drawLogo(menuTime);

  if (G.active){
    // фиксированный шаг логики; скорость ×2 — два шага за кадр
    acc += dt*G.speed;
    let iter = 0;
    while (acc >= STEP && iter < 8){ updateGame(STEP); acc -= STEP; iter++; }
    if (iter === 8) acc = 0;
    // на паузе поле статично — не перерисовываем (экономим батарею и композитинг)
    if (G.state !== 'paused'){
      renderGame();
      UI.updateHUD(false);
      if (G.waveState === 'running') UI.refreshWaveUI();
    }
  }

  // авто-низкая графика: если кадры просели ниже 25 — смягчаем картинку сами
  fpsN++;
  const nowF = performance.now();
  if (nowF - fpsT0 >= 4000){
    const fps = fpsN*1000/(nowF - fpsT0);
    fpsT0 = nowF; fpsN = 0;
    if (!autoLowDone && !S.lowgfx && fps < 25 && nowF - bootAt > 8000){
      autoLowDone = true;
      S.lowgfx = true; persist(); computeView();
      try{ UI.toast(t('s_autolow'), 'warn'); }catch(e){}
    }
  }
}

function rafTick(now){
  rafQueued = false;
  lastRafAt = now;
  workerOn = false; // rAF ожил — воркер больше не нужен
  queueFrame();     // следующий кадр планируем ДО отрисовки: сбой не убьёт цикл
  try{ tick(now); }catch(e){ reportErr(e); }
}
function queueFrame(){
  if (!rafQueued){ rafQueued = true; requestAnimationFrame(rafTick); }
}

/* Любая ошибка не должна останавливать игру: пишем в консоль и показываем один тост */
let lastErrToast = 0;
// неперехваченные отказы обещаний (класс бага «пустой экран при запуске»)
window.addEventListener('unhandledrejection', (ev)=>{
  try{ reportErr(ev.reason || new Error('unhandled rejection')); }catch(e){}
});

function reportErr(e){
  console.error('[NEON CORE]', e);
  const msg = String(e && e.message || e).slice(0, 200);
  (window.__errs = window.__errs || []).push(msg);
  try{ // запоминаем последние ошибки — их видно в настройках, чтобы прислать скрин
    const arr = JSON.parse(localStorage.getItem('nc_errs')||'[]');
    arr.unshift(new Date().toLocaleTimeString()+' — '+msg);
    localStorage.setItem('nc_errs', JSON.stringify(arr.slice(0,5)));
  }catch(e2){}
  const now = performance.now();
  // если интерфейс ещё не поднялся — показываем ошибку прямо на экране,
  // чтобы её можно было заскринить (иначе пользователь видит только чёрный экран)
  if (!document.querySelector('.screen.active')){
    let box = document.getElementById('booterr');
    if (!box){
      box = document.createElement('div');
      box.id = 'booterr';
      box.style.cssText = 'position:fixed;inset:auto 10px 10px 10px;z-index:99;background:rgba(60,8,16,.95);border:1px solid #ff3355;border-radius:10px;padding:10px 12px;color:#ffd7de;font:11px Consolas,monospace;white-space:pre-wrap;max-height:40%;overflow:auto';
      document.body.appendChild(box);
    }
    box.textContent = 'Ошибка запуска: ' + msg;
  } else if (now - lastErrToast > 5000){
    lastErrToast = now;
    try{ UI.toast('Ошибка: ' + msg, 'warn'); }catch(e2){}
  }
}

/* Web Worker-тикер: включается, когда rAF молчит дольше 250мс */
try{
  const workerSrc = 'setInterval(function(){ postMessage(0); }, 16);';
  const w = new Worker(URL.createObjectURL(new Blob([workerSrc], { type:'text/javascript' })));
  w.onmessage = () => {
    const now = performance.now();
    if (!workerOn){
      if (now - Math.max(lastRafAt, bootAt - 300) < 250) return; // rAF жив — не мешаем
      workerOn = true;
    }
    try{ tick(now); }catch(e){ reportErr(e); }
  };
}catch(e){ /* нет Worker — останется интервал */ }

/* Последний рубеж: если ни rAF, ни Worker не работают */
setInterval(()=>{
  if (workerOn) return;
  const now = performance.now();
  if (now - Math.max(lastRafAt, bootAt - 300) < 250) return;
  try{ tick(now); }catch(e){ reportErr(e); }
}, 50);

async function boot(){
  const phase = (name, f)=>{ try{ f(); }catch(e){ reportErr(e); } };
  phase('telegram', ()=>initTelegram());   // SDK Telegram (в обычном браузере — no-op)
  phase('save', ()=>{ S = loadSaveFrom(SAVE_KEY); });  // ключ мог смениться на пользовательский
  try{ await loadCloudSave(); }catch(e){ reportErr(e); } // облачный сейв новее локального
  phase('lang', ()=>{
    LANG = S.lang || ((navigator.language||'').toLowerCase().startsWith('ru') ? 'ru' : 'en');
    document.documentElement.lang = LANG;
    applyStaticI18n();
  });
  phase('ui', ()=>UI.init());
  phase('input', ()=>initInput());
  phase('bgfx', ()=>initBgfx());
  phase('menu', ()=>{ UI.showScreen('menu'); syncBackButton(); });
  queueFrame();
}

boot();

/* ==================== Служебные хуки для отладки (в UI не выставляются) ==================== */
window.__ND = {
  G: ()=>G, S: ()=>S,
  frames: ()=>window.__nc_frames||0,
  cash(n){ G.cash = n; },
  cores(n){ S.cores = n; persist(); },
  wave(){ startWave(); },
  win(){ if (G.active) victory(); },
  lose(){ if (G.active) defeat(); },
  give(type, c, r){ placeTower(type, c, r); },
  star(n){ // начислить звёзды для теста открытий
    mapSave(0).stars = Math.max(mapSave(0).stars, n); persist();
  },
  // прогнать логику вперёд на sec игровых секунд (для автотестов)
  step(sec){
    const n = Math.min(3600, Math.round(sec/STEP));
    for (let i=0;i<n;i++) updateGame(STEP);
    renderGame(); UI.updateHUD(true); UI.refreshWaveUI();
    return { wave:G.wave, state:G.waveState, cash:G.cash, lives:G.lives, enemies:G.enemiesCount };
  },
};
