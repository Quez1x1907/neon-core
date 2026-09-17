/* ==================== ВВОД: указатель, клавиатура, кнопки, ресайз ==================== */

function cellFromEvent(ev){
  const rect = boardCv.getBoundingClientRect();
  const x = ev.clientX - rect.left - V.ox;
  const y = ev.clientY - rect.top - V.oy;
  return [Math.floor(x/V.cs), Math.floor(y/V.cs)];
}

let drag = null;      // жест на поле: панорама или тап
let cardDrag = null;  // перетаскивание башни из панели

function initInput(){
  const wrap = $('boardwrap');

  // Наведение — призрак установки, курсор, панорама
  boardCv.addEventListener('pointermove', (ev)=>{
    if (!G.active) return;
    G.hoverCell = cellFromEvent(ev);
    if (ev.pointerType === 'mouse'){
      const overTower = !G.placing && !G.dragPlacing && G.hoverCell && towerAt(G.hoverCell[0], G.hoverCell[1]);
      boardCv.style.cursor = (G.placing || G.dragPlacing || G.targeting) ? 'crosshair' : (overTower ? 'pointer' : 'default');
    }
    if (!drag || ev.pointerId !== drag.id) return;
    const dx = ev.clientX - drag.x0, dy = ev.clientY - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) > 7) drag.moved = true;
    if (drag.moved && !drag.handled){
      V.ox = drag.ox0 + dx;
      V.oy = drag.oy0 + dy;
      clampCam();
    }
  });
  boardCv.addEventListener('pointerleave', ()=>{
    boardCv.style.cursor = 'default';
  });

  // Нажатие: запоминаем жест (тап или панорама решаются на отпускании)
  boardCv.addEventListener('pointerdown', (ev)=>{
    AudioSys.resume();
    if (!G.active || G.state !== 'play') return;
    ev.preventDefault();
    if (drag) return;
    drag = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, ox0: V.ox, oy0: V.oy, moved: false, handled: false };
    const [c, r] = cellFromEvent(ev);
    G.hoverCell = [c, r];
    if (G.targeting === 'emp'){
      castEmp(c, r);
      drag.handled = true;
      boardCv.style.cursor = 'default';
    }
  });

  // Правая кнопка / долгий тап — отмена установки
  boardCv.addEventListener('contextmenu', (ev)=>{
    ev.preventDefault();
    if (G.placing){ G.placing = null; UI.syncBuildbar(); }
    if (G.dragPlacing){ G.dragPlacing = null; UI.syncBuildbar(); }
  });

  // Отпускание: тап по полю (установка/выбор) или завершение панорамы
  window.addEventListener('pointerup', (ev)=>{
    if (!drag || ev.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (!G.active) return;
    if (d.handled) return;
    if (d.moved){ clampCam(); return; }   // это была панорама
    const [c, r] = cellFromEvent(ev);
    if (G.targeting === 'emp') return;    // импульс кастуется на pointerdown
    if (G.placing || G.dragPlacing){
      const tp = G.placing || G.dragPlacing;
      const def = TOWERS[tp];
      if (canPlace(c, r) && G.cash >= def.cost){
        placeTower(tp, c, r);
        haptic('light');
        if (G.placing && G.cash < def.cost) G.placing = null;
      } else {
        AudioSys.play('error');
        if (G.dragPlacing) G.dragPlacing = null;
      }
      UI.syncBuildbar();
      UI.hideTip();
      return;
    }
    const t = towerAt(c, r);
    G.selected = t;
    UI.insKey = '';
    UI.renderInspector();
    AudioSys.play('click');
  });

  // HUD-кнопки
  UI.els.btnFull.addEventListener('click', ()=>{
    AudioSys.play('click');
    if (TG){ tgFullscreen(); }
    else if (document.documentElement.requestFullscreen){
      document.documentElement.requestFullscreen().catch(()=>{});
    }
  });
  UI.els.btnSpeed.addEventListener('click', ()=>{
    G.speed = G.speed === 1 ? 2 : 1;
    AudioSys.play('click');
  });
  // перетаскивание башни из панели на поле
  UI.els.buildbar.addEventListener('pointerdown', (ev)=>{
    const card = ev.target.closest('.tcard');
    if (!card || ev.pointerType === 'mouse' && ev.button !== 0) return;
    cardDrag = { type: card.dataset.type, x0: ev.clientX, y0: ev.clientY, active: false, pointerId: ev.pointerId };
  });
  window.addEventListener('pointermove', (ev)=>{
    if (!cardDrag || ev.pointerId !== cardDrag.pointerId) return;
    if (!cardDrag.active && Math.hypot(ev.clientX - cardDrag.x0, ev.clientY - cardDrag.y0) > 10){
      cardDrag.active = true;
      G.placing = null; G.selected = null;
      G.dragPlacing = cardDrag.type;
      UI.syncBuildbar(); UI.renderInspector();
    }
    if (cardDrag.active){
      G.hoverCell = cellFromEvent(ev);           // призрак на поле следует за пальцем
      UI.showDragIcon(cardDrag.type, ev.clientX, ev.clientY);  // иконка башни в руке
    }
  });
  window.addEventListener('pointerup', (ev)=>{
    if (!cardDrag || ev.pointerId !== cardDrag.pointerId) return;
    const cd = cardDrag; cardDrag = null;
    if (cd.active){
      const suppressedAt = Date.now();
      UI.suppressCardClick = suppressedAt;
      const [c, r] = cellFromEvent(ev);
      const def = TOWERS[cd.type];
      UI.hideDragIcon();
      if (canPlace(c, r) && G.cash >= def.cost){
        placeTower(cd.type, c, r);
        haptic('light');
      } else {
        AudioSys.play('error');
      }
      G.dragPlacing = null;
      UI.syncBuildbar();
    } else {
      UI.hideDragIcon();
    }
  });
  UI.els.abEmp.addEventListener('click', ()=>{
    AudioSys.play('click');
    // повторное нажатие отменяет прицел
    G.targeting = G.targeting === 'emp' ? null : 'emp';
    G.placing = null;
    UI.syncBuildbar();
  });
  UI.els.abOver.addEventListener('click', ()=>{ AudioSys.play('click'); activateOver(); });
  UI.els.btnAuto.addEventListener('click', ()=>{
    S.auto = !S.auto; persist();
    AudioSys.play('click');
  });
  UI.els.btnPause.addEventListener('click', ()=>{ AudioSys.play('click'); UI.openPause(); });
  UI.els.btnHome.addEventListener('click', ()=>{
    AudioSys.play('click');
    const wasPlay = G.state === 'play';
    if (wasPlay) G.state = 'paused'; // замораживаем бой на время вопроса
    UI.confirmDlg(t('exit_q'), ()=>exitGame(), ()=>{ if (wasPlay) G.state = 'play'; });
  });
  UI.els.btnWave.addEventListener('click', ()=>{ AudioSys.resume(); startWave(); });

  // Экранные кнопки
  $('btn-play').addEventListener('click', ()=>{ AudioSys.resume(); AudioSys.play('click'); UI.mapsMode = 'campaign'; UI.showScreen('maps'); });
  $('btn-endless').addEventListener('click', ()=>{ AudioSys.resume(); AudioSys.play('click'); UI.openEndless(); });
  $('btn-lab').addEventListener('click', ()=>{ AudioSys.play('click'); UI.showScreen('lab'); });
  $('btn-shop').addEventListener('click', ()=>{ AudioSys.play('click'); UI.showScreen('shop'); });
  $('shop-back').addEventListener('click', ()=>{ AudioSys.play('click'); UI.showScreen('menu'); });
  // иконки меню (профиль/достижения/настройки — маленькие кнопки)
  $('btn-profile-menu').addEventListener('click', ()=>{ AudioSys.play('click'); UI.showScreen('profile'); });
  $('btn-ach-menu').addEventListener('click', ()=>{ AudioSys.play('click'); UI.showScreen('ach'); });
  $('btn-settings-menu').addEventListener('click', ()=>{ AudioSys.play('click'); UI.openSettings(); });
  // покупки в магазине (делегирование — список перерисовывается)
  $('shop-list').addEventListener('click', (ev)=>{
    const b = ev.target.closest('[data-buyboost],[data-buyskin],[data-setskin],[data-buyfx],[data-fx],[data-buytower]');
    if (!b) return;
    const buy = (price)=>{
      if (S.cores < price){ AudioSys.play('error'); return false; }
      S.cores -= price;
      S.stats.purchases = (S.stats.purchases||0)+1;
      return true;
    };
    if (b.dataset.buyboost){
      const def = BOOSTS.find(x=>x.id===b.dataset.buyboost);
      if (buy(def.price)){ S.boosts[def.id] = (S.boosts[def.id]||0)+1; UI.toast(t('bought'), 'ach'); AudioSys.play('coin'); persist(); checkAch(); }
    } else if (b.dataset.buyskin){
      const def = SKINS.find(x=>x.id===b.dataset.buyskin);
      if (buy(def.price)){ S.skins[def.id] = 1; S.skin = def.id; UI.toast(t('bought'), 'ach'); AudioSys.play('coin'); persist(); checkAch(); }
    } else if (b.dataset.setskin){
      S.skin = b.dataset.setskin; persist(); AudioSys.play('click');
    } else if (b.dataset.buyfx){
      const def = FXS.find(x=>x.id===b.dataset.buyfx);
      if (buy(def.price)){ S.fx[def.id] = 2; UI.toast(t('bought'), 'ach'); AudioSys.play('coin'); persist(); checkAch(); }
    } else if (b.dataset.fx){
      S.fx[b.dataset.fx] = (S.fx[b.dataset.fx] === 2) ? 1 : 2; persist(); AudioSys.play('click');
    } else if (b.dataset.buytower){
      const tp = b.dataset.buytower;
      const price = 20 + UNLOCK_STARS[tp]*5;
      if (buy(price)){ S.buyUnlocked[tp] = 1; UI.toast(t('bought'), 'ach'); AudioSys.play('coin'); persist(); checkAch(); }
    }
    UI.renderShop();
  });
  $('btn-profile').addEventListener('click', ()=>{ AudioSys.play('click'); UI.showScreen('profile'); });
  $('profile-back').addEventListener('click', ()=>{ AudioSys.play('click'); UI.showScreen('menu'); });
  const bset = document.getElementById('btn-settings');
  if (bset) bset.addEventListener('click', ()=>{ AudioSys.play('click'); UI.openSettings(); });
  $('maps-back').addEventListener('click', ()=>{ AudioSys.play('click'); UI.showScreen('menu'); });
  $('lab-back').addEventListener('click', ()=>{ AudioSys.play('click'); UI.showScreen('menu'); });
  $('ach-back').addEventListener('click', ()=>{ AudioSys.play('click'); UI.showScreen('menu'); });

  // Клавиатура
  window.addEventListener('keydown', (ev)=>{
    if (ev.repeat) return;
    const k = ev.key;
    if (k === 'Escape'){
      if (!UI.els.overlay.hidden){
        if (UI.modalSticky) return;             // победа/поражение — только кнопками
        UI.closeModal();
        if (G.state === 'paused') G.state = 'play';
        return;
      }
      if (G.placing){ G.placing = null; UI.syncBuildbar(); return; }
      if (G.selected){ G.selected = null; UI.renderInspector(); return; }
      return;
    }
    if (UI.cur !== 'game') return;
    if (k === ' '){
      ev.preventDefault();
      if (G.waveState === 'prep' && G.state === 'play') startWave();
      else if (G.state === 'play') UI.openPause();
      return;
    }
    if (k === 'f' || k === 'F' || k === 'а' || k === 'А'){ G.speed = G.speed === 1 ? 2 : 1; return; }
    if (k === 'q' || k === 'Q' || k === 'й' || k === 'Й'){
      G.targeting = G.targeting === 'emp' ? null : 'emp';
      G.placing = null; UI.syncBuildbar();
      return;
    }
    if (k === 'e' || k === 'E' || k === 'у' || k === 'У'){ activateOver(); return; }
    if (k === 'r' || k === 'R' || k === 'к' || k === 'К'){ S.auto = !S.auto; persist(); return; }
    if (G.state !== 'play') return;
    // цифры — выбор башни
    const n = parseInt(k, 10);
    if (n >= 1 && n <= 9){
      const cards = UI.els.buildbar.querySelectorAll('.tcard');
      const card = cards[n-1];
      if (card){ card.click(); }
      return;
    }
    if ((k === 'u' || k === 'U' || k === 'г' || k === 'Г') && G.selected) upgradeTower(G.selected);
    if ((k === 'x' || k === 'X' || k === 'ч' || k === 'Ч') && G.selected) sellTower(G.selected);
  });

  // Клик по оверлею вне модалки — закрыть (кроме паузы и экранов конца партии)
  UI.els.overlay.addEventListener('pointerdown', (ev)=>{
    if (ev.target !== UI.els.overlay) return;
    if (UI.modalSticky) return;                 // победа/поражение закрываются только кнопками
    if (G.state !== 'paused') UI.closeModal();
  });

  // Ресайз канвы
  const ro = new ResizeObserver(()=>computeView());
  ro.observe($('boardwrap'));
  window.addEventListener('resize', ()=>computeView());

  // любой тап в любом месте прячет тултипы
  window.addEventListener('pointerdown', ()=>UI.hideTip(), true);
  // Разблокировка звука и автопауза
  window.addEventListener('pointerdown', ()=>AudioSys.resume(), { passive:true });
  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden && G.state === 'play' && UI.cur === 'game') UI.openPause();
  });
  window.addEventListener('beforeunload', ()=>persist());
}
