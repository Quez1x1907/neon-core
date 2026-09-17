/* ==================== Сохранения (localStorage + мягкая деградация) ====================
   Ключ сейва привязан к пользователю Telegram (SAVE_KEY = neoncore_v1_u<id>),
   чтобы на общем устройстве прогресс игроков не смешивался.
   Вне Telegram — общий ключ neoncore_v1. */
let SAVE_KEY = 'neoncore_v1';
function defSave(){
  return {
    v:1, lang:null, sound:true, lowgfx:false, auto:false, volume:0.5, cores:0, savedAt:0,
    skin:'classic', skins:{}, fx:{}, boosts:{dmg:0, lives:0, cash:0}, mapSkin:'classic', mapSkins:{}, promoUsed:{},
    buyUnlocked:{}, lastCheckin:'', checkinDay:0,
    meta:{ dmg:0, lives:0, cash:0, income:0 },
    maps:{},            // idx → {stars, best, milestone}
    ach:{},             // id → 1
    seen:{},            // флаги "уже видел" (интро врагов, мутаций)
    tut:{},             // шаги обучения
    stats:{ kills:0, money:0, bosses:0, towersBuilt:0, maxTowers:0, maxTowerLevel:1, bestCleanWave:0, branches:0, maxAmps:0, games:0, wins:0, purchases:0 },
  };
}
const storageOK = (()=>{ try{ localStorage.setItem('__nc_t','1'); localStorage.removeItem('__nc_t'); return true; }catch(e){ return false; } })();
function mergeSave(d, loaded){
  Object.assign(d, loaded);
  d.meta = Object.assign(defSave().meta, loaded.meta||{});
  d.stats = Object.assign(defSave().stats, loaded.stats||{});
  d.maps = loaded.maps||{}; d.ach = loaded.ach||{}; d.seen = loaded.seen||{}; d.tut = loaded.tut||{};
  return d;
}
function loadSaveFrom(key){
  const d = defSave();
  if (storageOK){
    try{
      const raw = localStorage.getItem(key);
      if (raw) mergeSave(d, JSON.parse(raw));
    }catch(e){ /* повреждённый сейв — начинаем с чистого */ }
  }
  return d;
}
let S = loadSaveFrom(SAVE_KEY);
function persist(){
  S.savedAt = Date.now();
  if (storageOK){ try{ localStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){} }
  // зеркалим в облачное хранилище Telegram — прогресс синхронится между устройствами
  try{ if (TG && TG.CloudStorage && typeof TG.CloudStorage.setItem === 'function') TG.CloudStorage.setItem(SAVE_KEY, JSON.stringify(S)); }catch(e){}
}
function resetSave(){ S = defSave(); persist(); }
function mapSave(i){ return S.maps[i] || (S.maps[i] = { stars:0, best:0, milestone:0 }); }
function addCores(n){ S.cores += n; persist(); }
function totalStars(){ let s=0; for(const k in S.maps) s += S.maps[k].stars||0; return s; }
function endlessBest(){ let b=0; for(const k in S.maps) b = Math.max(b, S.maps[k].best||0); return b; }
function towerUnlocked(tp){ return !!S.buyUnlocked[tp] || totalStars() >= UNLOCK_STARS[tp]; }
function unlockedTowerCount(){ return TOWER_ORDER.filter(towerUnlocked).length; }

/* Итоговые (с учётом мета-прокачки) параметры новой партии */
function metaVals(){
  return {
    dmgMul: (1 + 0.06*S.meta.dmg) * ((typeof G !== 'undefined' && G.active && G.boost && G.boost.dmg > 1) ? G.boost.dmg : 1),
    lives: START_LIVES + 2*S.meta.lives,
    cash: START_CASH + 30*S.meta.cash,
    rewardMul: 1 + 0.06*S.meta.income,
  };
}
