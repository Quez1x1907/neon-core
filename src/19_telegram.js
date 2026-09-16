/* ==================== Telegram Mini App: интеграция ====================
   Если страница открыта вне Telegram (обычный браузер, file://), всё ниже —
   безопасные no-op: игра работает как раньше. Внутри Telegram:
   фуллскрин, тёмная тема шапки, запрет свайпа-закрытия, кнопка «Назад»,
   вибро-отклик и облачное сохранение прогресса между устройствами. */

let TG = null;

function initTelegram(){
  try{
    TG = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
  }catch(e){ TG = null; }
  if (!TG) return;
  // сейв по пользователю: ключ привязан к ID игрока Telegram
  try{
    const u = TG.initDataUnsafe && TG.initDataUnsafe.user;
    if (u && u.id){
      SAVE_KEY = 'neoncore_v1_u' + u.id;
      // одноразовая миграция общего сейва в пользовательский ключ
      if (storageOK && !localStorage.getItem(SAVE_KEY)){
        const legacy = localStorage.getItem('neoncore_v1');
        if (legacy){ localStorage.setItem(SAVE_KEY, legacy); localStorage.removeItem('neoncore_v1'); }
      }
    }
  }catch(e){}
  try{ if (typeof TG.ready === 'function') TG.ready(); }catch(e){}
  try{ if (typeof TG.expand === 'function') TG.expand(); }catch(e){}
  try{ if (typeof TG.disableVerticalSwipes === 'function') TG.disableVerticalSwipes(); }catch(e){}
  try{ if (typeof TG.unlockOrientation === 'function') TG.unlockOrientation(); }catch(e){} // телефон можно вертеть — мини-апп повернётся
  try{ if (typeof TG.enableClosingConfirmation === 'function') TG.enableClosingConfirmation(); }catch(e){}
  try{ if (typeof TG.setHeaderColor === 'function') TG.setHeaderColor('#05070f'); }catch(e){}
  try{ if (typeof TG.setBackgroundColor === 'function') TG.setBackgroundColor('#05070f'); }catch(e){}
  try{
    if (TG.BackButton && typeof TG.BackButton.onClick === 'function'){
      TG.BackButton.onClick(()=>{
        if (UI.cur === 'maps' || UI.cur === 'lab' || UI.cur === 'ach'){
          AudioSys.play('click');
          UI.showScreen('menu');
        }
      });
    }
  }catch(e){}
  // сворачивание мини-аппа — ставим бой на паузу
  try{
    if (typeof TG.onEvent === 'function'){
      TG.onEvent('deactivated', ()=>{
        try{ if (G.state === 'play' && UI.cur === 'game') UI.openPause(); }catch(e){}
      });
    }
  }catch(e){}
}

/* Во весь экран: настоящий фуллскрин, если версия бота позволяет; иначе просто поворот */
function tgFullscreen(){
  try{
    if (TG && typeof TG.requestFullscreen === 'function'){ TG.requestFullscreen(); return true; }
  }catch(e){}
  try{
    if (TG && typeof TG.unlockOrientation === 'function'){ TG.unlockOrientation(); return true; }
  }catch(e){}
  return false;
}

/* Кнопка «Назад» Telegram: видна на экранах списков */
function syncBackButton(){
  if (!TG || !TG.BackButton) return;
  const show = UI.cur === 'maps' || UI.cur === 'lab' || UI.cur === 'ach';
  try{ show ? TG.BackButton.show() : TG.BackButton.hide(); }catch(e){}
}

/* Вибро-отклик: 'light' — удар, 'success'/'error'/'warning' — уведомления */
function haptic(kind){
  try{
    const h = TG && TG.HapticFeedback;
    if (!h) return;
    if (kind === 'light' && typeof h.impactOccurred === 'function') h.impactOccurred('light');
    else if (typeof h.notificationOccurred === 'function') h.notificationOccurred(kind);
  }catch(e){}
}

/* Облачный сейв: если в Telegram он новее локального — берём его */
function loadCloudSave(){
  return new Promise((resolve)=>{
    try{
      if (!TG || !TG.CloudStorage || typeof TG.CloudStorage.getItem !== 'function') return resolve();
      TG.CloudStorage.getItem(SAVE_KEY, (err, data)=>{
        try{
          if (!err && data){
            const parsed = JSON.parse(data);
            if (parsed && parsed.v === 1 && (parsed.savedAt||0) > (S.savedAt||0)){
              const d = defSave();
              Object.assign(d, parsed);
              d.meta = Object.assign(defSave().meta, parsed.meta||{});
              d.stats = Object.assign(defSave().stats, parsed.stats||{});
              d.maps = parsed.maps||{}; d.ach = parsed.ach||{}; d.seen = parsed.seen||{}; d.tut = parsed.tut||{};
              S = d;
            }
          }
        }catch(e){}
        resolve();
      });
    }catch(e){ resolve(); }
  });
}
