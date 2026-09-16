/* ==================== ВВОД: указатель, клавиатура, кнопки, ресайз ==================== */

function cellFromEvent(ev){
  const rect = boardCv.getBoundingClientRect();
  const x = ev.clientX - rect.left - V.ox;
  const y = ev.clientY - rect.top - V.oy;
  return [Math.floor(x/V.cs), Math.floor(y/V.cs)];
}

function initInput(){
  const wrap = $('boardwrap');

  // Наведение — для призрака установки (мышь) и курсора над башней
  boardCv.addEventListener('pointermove', (ev)=>{
    if (!G.active) return;
    G.hoverCell = cellFromEvent(ev);
    if (ev.pointerType === 'mouse'){
      const overTower = !G.placing && G.hoverCell && towerAt(G.hoverCell[0], G.hoverCell[1]);
      boardCv.style.cursor = G.placing ? 'crosshair' : (overTower ? 'pointer' : 'default');
    }
  });
  boardCv.addEventListener('pointerleave', ()=>{
    G.hoverCell = null;
    boardCv.style.cursor = 'default';
  });

  // Клик/тап по полю: способность, установка башни или выбор существующей
  boardCv.addEventListener('pointerdown', (ev)=>{
    AudioSys.resume();
    if (!G.active || G.state !== 'play') return;
    ev.preventDefault();
    const [c, r] = cellFromEvent(ev);
    G.hoverCell = [c, r];
    // ЭМИ-импульс: клик = каст в точку
    if (G.targeting === 'emp'){
      castEmp(c, r);
      boardCv.style.cursor = 'default';
      return;
    }
    if (G.placing){
      const def = TOWERS[G.placing];
      if (canPlace(c, r) && G.cash >= def.cost){
        placeTower(G.placing, c, r);
        if (G.cash < def.cost) G.placing = null;
        UI.syncBuildbar();
      } else {
        AudioSys.play('error');
      }
      return;
    }
    const tw = towerAt(c, r);
    G.selected = tw;
    UI.insKey = '';
    UI.renderInspector();
    AudioSys.play('click');
  });

  // Правая кнопка / долгий тап — отмена установки
  boardCv.addEventListener('contextmenu', (ev)=>{
    ev.preventDefault();
    if (G.placing){ G.placing = null; UI.syncBuildbar(); }
  });

  // HUD-кнопки
  UI.els.btnSpeed.addEventListener('click', ()=>{
    G.speed = G.speed === 1 ? 2 : 1;
    AudioSys.play('click');
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
  $('btn-ach').addEventListener('click', ()=>{ AudioSys.play('click'); UI.showScreen('ach'); });
  $('btn-settings').addEventListener('click', ()=>{ AudioSys.play('click'); UI.openSettings(); });
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
