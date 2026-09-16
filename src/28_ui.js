/* ==================== UI: экраны, HUD, модалки, тосты ==================== */

const UI = {
  cur:'menu', lastHud:{}, insKey:'',
  els:{},

  init(){
    this.els = {
      overlay:$('overlay'), modal:$('modal'), toasts:$('toasts'),
      hudWave:$('hud-wave'), hudCash:$('hud-cash'), hudLives:$('hud-lives'),
      btnSpeed:$('btn-speed'), btnPause:$('btn-pause'), btnHome:$('btn-home'),
      buildbar:$('buildbar'), inspector:$('inspector'), nextwave:$('nextwave'),
      btnWave:$('btn-wave'), wavePreview:$('wave-preview'), bannerText:$('banner-text'),
      bannerSub:$('banner-sub'), hint:$('hint'), bossbar:$('bossbar'),
      bossName:$('boss-name'), bossFill:$('boss-fill'), tt:$('tt'),
      abEmp:$('btn-ab-emp'), abOver:$('btn-ab-over'), btnAuto:$('btn-auto'),
    };
    this.els.btnPause.innerHTML = ICONS.pause;
    this.els.btnHome.innerHTML = ICONS.home;
    this.els.abEmp.innerHTML = '<b>Q</b><span class="cdt"></span>';
    this.els.abOver.innerHTML = '<b>E</b><span class="cdt"></span>';
    this.els.abEmp.title = t('ab_emp')+' — Q';
    this.els.abOver.title = t('ab_over')+' — E';
    this.els.btnAuto.title = t('auto_tip')+' — R';
  },

  /* ---------- экраны ---------- */
  showScreen(name){
    this.cur = name;
    this.hideTip();
    this.closeModal(); // любая смена экрана закрывает висящие модалки
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    $('screen-'+name).classList.add('active');
    syncBackButton();
    if (name==='menu') this.renderMenu();
    if (name==='maps') this.renderMaps();
    if (name==='lab') this.renderLab();
    if (name==='ach') this.renderAch();

  },

  /* ---------- главное меню ---------- */
  renderMenu(){
    let hello = '';
    try{
      const u = TG && TG.initDataUnsafe && TG.initDataUnsafe.user;
      if (u && u.first_name) hello = '<span>'+t('hello_tpl', { n:u.first_name })+'</span>';
    }catch(e){}
    $('menu-stats').innerHTML = (hello ? hello : '') +
      '<span>'+t('stats_kills')+': <b>'+fmtNum(S.stats.kills)+'</b></span>'+
      '<span>'+t('cores')+': <b>'+fmtNum(S.cores)+'</b></span>'+
      '<span>'+t('stats_best')+': <b>'+(endlessBest()||'—')+'</b></span>';
  },

  /* ---------- карты ---------- */
  mapsMode: 'campaign', // campaign | endless
  openEndless(){
    this.mapsMode = 'endless';
    this.showScreen('maps');
  },
  renderMaps(){
    const grid = $('map-grid');
    grid.innerHTML = '';
    const ts = totalStars();
    const endlessMode = this.mapsMode === 'endless';
    $('maps-stars').textContent = '★ '+ts+'/'+(MAPS.length*3);
    document.querySelector('#screen-maps h2').textContent = endlessMode ? t('endless_title') : t('select_map');
    let shownAny = false;
    MAPS.forEach((m,i)=>{
      const ms = mapSave(i);
      const locked = endlessMode ? ms.stars < 1 : ts < m.need;
      if (endlessMode && (locked || ms.stars < 1)) return;
      shownAny = true;
      const card = document.createElement('div');
      card.className = 'map-card panel'+(locked ? ' locked' : '');
      const endlessBtn = (!endlessMode && !locked && ms.stars>=1)
        ? '<button class="btn" data-endless="'+i+'" style="padding:5px 10px;font-size:11px">∞</button>' : '';
      const starsHtml = endlessMode
        ? '<span class="chip" style="padding:2px 8px;font-size:11px;color:var(--lime);border-color:rgba(168,255,62,.4)">∞ '+(ms.best||1)+'</span>'
        : [1,2,3].map(k=>ICONS.star.replace('<svg','<svg class="'+(ms.stars>=k?'on':'')+'"')).join('');
      card.innerHTML =
        '<canvas width="240" height="100"></canvas>'+
        '<div class="mc-name"><span>'+t(m.key)+'</span><em>'+t('diff')[i]+' ×'+m.mult+'</em></div>'+
        '<div class="mc-row"><div class="stars">'+starsHtml+'</div>'+
        '<span class="chip" style="padding:3px 9px;font-size:11px">'+
          (ms.best ? t('endless_best',{n:ms.best}) : t('endless_locked'))+'</span>'+endlessBtn+'</div>'+
        (locked ? '<div class="mc-lock"><b>★ '+m.need+'</b>'+t('need_stars',{n:m.need})+'</div>' : '');
      grid.appendChild(card);
      drawMapPreview(card.querySelector('canvas'), m);
      if (!locked){
        card.addEventListener('click', ()=>{ AudioSys.play('click'); startGame(i, endlessMode ? true : false); });
        const eb = card.querySelector('[data-endless]');
        if (eb) eb.addEventListener('click', (ev)=>{ ev.stopPropagation(); AudioSys.play('click'); startGame(i,true); });
      }
    });
    if (endlessMode && !shownAny){
      grid.innerHTML = '<div class="panel" style="padding:18px;text-align:center;font-family:var(--mono);font-size:13px;color:var(--dim);grid-column:1/-1">'+t('endless_empty')+'</div>';
    }
  },

  /* ---------- лаборатория ---------- */
  renderLab(){
    const list = $('lab-list');
    list.innerHTML = '';
    $('lab-cores').textContent = '◆ '+fmtNum(S.cores)+' '+t('cores');
    META.forEach(tr=>{
      const lvl = S.meta[tr.id];
      const maxed = lvl >= tr.max;
      const cost = maxed ? 0 : tr.cost(lvl);
      const row = document.createElement('div');
      row.className = 'track panel';
      const pips = Array.from({length:tr.max}, (_,k)=>'<i class="'+(k<lvl?'on':'')+'"></i>').join('');
      const effN = tr.id==='lives' ? 2*lvl : tr.id==='cash' ? 30*lvl : 6*lvl;
      const nowEff = t('meta_'+tr.id+'_d', { n: effN });
      row.innerHTML =
        '<div class="t-icon">'+ICONS[tr.icon]+'</div>'+
        '<div class="t-main"><div class="t-name">'+t('meta_'+tr.id)+'</div>'+
        '<div class="t-desc">'+nowEff+'</div>'+
        '<div class="pips">'+pips+'</div></div>'+
        '<div class="t-buy">'+(maxed
          ? '<span class="chip" style="color:var(--lime)">'+t('maxed')+'</span>'
          : '<button class="btn primary" data-buy="'+tr.id+'">'+t('buy')+' ◆'+cost+'</button>')+'</div>';
      list.appendChild(row);
      const btn = row.querySelector('[data-buy]');
      if (btn) btn.addEventListener('click', ()=>{
        const l = S.meta[tr.id];
        const c = tr.cost(l);
        if (S.cores < c){ AudioSys.play('error'); return; }
        S.cores -= c; S.meta[tr.id]++;
        persist(); AudioSys.play('upgrade'); checkAch(); this.renderLab();
      });
    });
  },

  /* ---------- достижения ---------- */
  renderAch(){
    const grid = $('ach-grid');
    grid.innerHTML = '';
    const total = ACHS.length, done = ACHS.filter(a=>S.ach[a.id]).length;
    $('ach-count').textContent = t('ach_of', { a:done, b:total });
    ACHS.forEach(a=>{
      const un = !!S.ach[a.id];
      const card = document.createElement('div');
      card.className = 'ach-card panel'+(un ? ' unlocked' : '');
      let bar = '';
      if (!un && a.prog){
        const [cur, goal] = a.prog();
        const k = goal ? cur/goal : 0;
        bar = '<div class="a-bar"><i style="width:'+Math.round(k*100)+'%"></i></div>';
      }
      card.innerHTML =
        '<div class="a-name"><span>'+(un ? '◆ ' : '')+t(a.key)+'</span><span class="rw">+'+a.reward+'</span></div>'+
        '<div class="a-desc">'+t(a.key+'_d')+'</div>'+bar;
      grid.appendChild(card);
    });
  },

  /* ---------- панель строительства ---------- */
  buildBuildbar(){
    const bar = this.els.buildbar;
    bar.innerHTML = '';
    this.hideTip();
    let key = 1;
    TOWER_ORDER.forEach(tp=>{
      if (totalStars() < UNLOCK_STARS[tp]) return;
      const def = TOWERS[tp];
      const card = document.createElement('button');
      card.className = 'tcard'; card.type = 'button';
      card.dataset.type = tp;
      card.innerHTML =
        '<span class="tc-key">'+key+'</span>'+
        '<img src="'+towerIconURL(tp)+'" alt="">'+
        '<span class="tc-cost">$'+def.cost+'</span>';
      card.title = t(def.key)+' — '+t(def.key+'_d');
      // наведение мышью — тултип с характеристиками
      card.addEventListener('pointerenter', (ev)=>{
        if (ev.pointerType !== 'mouse') return;
        this.showTowerTip(tp, card, key);
      });
      card.addEventListener('pointerleave', ()=>this.hideTip());
      card.addEventListener('click', ()=>{
        AudioSys.play('click');
        if (G.placing === tp){ G.placing = null; this.hideTip(); }
        else {
          G.placing = tp; G.selected = null;
          // на тач-экранах тултип = подсказка при выборе
          this.showTowerTip(tp, card, key);
          clearTimeout(this._tipT);
          this._tipT = setTimeout(()=>this.hideTip(), 2600);
        }
        this.syncBuildbar(); this.renderInspector();
      });
      bar.appendChild(card);
      key++;
    });
    this.syncBuildbar();
  },
  /* ---------- тултип у элемента-якоря ---------- */
  showTipAt(html, anchorEl){
    const el = this.els.tt;
    if (!el) return;
    this.tipAnchor = anchorEl;   // если якорь исчезнет из DOM — тултип закроется сам
    el.innerHTML = html;
    el.hidden = false;
    const r = anchorEl.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight;
    let x = clamp(r.left + r.width/2 - w/2, 8, innerWidth - w - 8);
    let y = r.top - h - 10;
    if (y < 8) y = r.bottom + 10;
    el.style.left = x+'px';
    el.style.top = y+'px';
  },
  showTowerTip(type, cardEl, keyHint){
    const def = TOWERS[type];
    this.showTipAt(
      '<div class="tt-name" style="color:'+def.color+'">'+t(def.key)+'</div>'+
      '<div class="tt-desc">'+t(def.key+'_d')+'</div>'+
      '<div class="tt-rows">'+towerStatRows(def.kind, def.lv[0])+'</div>'+
      '<div class="tt-foot">$'+def.cost+(keyHint ? ' <span class="tt-key">· '+keyHint+'</span>' : '')+'</div>',
      cardEl
    );
  },
  hideTip(){
    if (this.els.tt) this.els.tt.hidden = true;
    this.tipAnchor = null;
    clearTimeout(this._tipT);
  },
  /* тултип не должен «висеть в воздухе», когда его кнопка пересоздана перерисовкой */
  hideTipIfOrphaned(){
    if (this.els.tt && !this.els.tt.hidden && this.tipAnchor && !document.contains(this.tipAnchor)) this.hideTip();
  },
  syncBuildbar(){
    this.els.buildbar.querySelectorAll('.tcard').forEach(card=>{
      const tp = card.dataset.type;
      card.classList.toggle('sel', G.placing === tp);
      card.classList.toggle('off', G.cash < TOWERS[tp].cost);
    });
  },

  /* ---------- HUD (каждый кадр) ---------- */
  updateHUD(force){
    const e = this.els;
    const waveNum = G.waveState === 'prep' ? G.wave+1 : G.wave;
    const waveTxt = G.endless ? t('wave_endless',{n:waveNum}) : t('wave_tpl',{n:waveNum, m:WAVES_PER_MAP});
    const cashTxt = '$'+fmtNum(G.cash);
    const livesTxt = '♥ '+G.lives;
    if (force || e.hudWave.textContent !== waveTxt) e.hudWave.textContent = waveTxt;
    if (force || e.hudCash.textContent !== cashTxt){
      e.hudCash.textContent = cashTxt;
      this.syncBuildbar();
      // инспектор не пересобираем чаще 4 раз в секунду — деньги меняются на каждом убийстве
      const nowT = performance.now();
      if (G.selected && nowT - (this.lastInsp||0) > 250){ this.lastInsp = nowT; this.renderInspector(); }
    }
    e.hudLives.textContent = livesTxt;
    e.hudLives.classList.toggle('low', G.lives <= Math.max(3, G.maxLives*0.2));
    const sp = t('speed_x',{n:G.speed});
    if (e.btnSpeed.textContent !== sp) e.btnSpeed.textContent = sp;
    // способности: кулдауны на кнопках
    const emp = G.abil.emp, over = G.abil.over;
    const empCd = emp.cd > 0 ? Math.ceil(emp.cd) : '';
    const ovCd = over.cd > 0 ? Math.ceil(over.cd) : (over.active > 0 ? Math.ceil(over.active) : '');
    if (e.abEmp.querySelector('.cdt').textContent !== (''+empCd)) e.abEmp.querySelector('.cdt').textContent = empCd;
    e.abEmp.classList.toggle('cd', emp.cd > 0);
    e.abEmp.classList.toggle('arm', G.targeting === 'emp');
    const ovEl = e.abOver.querySelector('.cdt');
    if (ovEl.textContent !== (''+ovCd)) ovEl.textContent = ovCd;
    e.abOver.classList.toggle('cd', over.cd > 0 && over.active <= 0);
    e.abOver.classList.toggle('act', over.active > 0);
    e.btnAuto.classList.toggle('on', !!S.auto);
    // страховка: экран конца партии не может остаться закрытым — переоткрываем
    if ((G.state === 'won' || G.state === 'lost') && this.els.overlay.hidden && this.cur === 'game'){
      if (G.state === 'won' && this.lastEnd && this.lastEnd.type === 'won') this.openVictory(this.lastEnd.r);
      else if (G.state === 'lost') this.openDefeat();
    }
    // босс
    if (G.bossRef && G.bossRef.alive && !G.bossRef.dead){
      e.bossbar.classList.add('show');
      e.bossFill.style.width = Math.max(0, G.bossRef.hp/G.bossRef.maxhp*100)+'%';
    } else e.bossbar.classList.remove('show');
  },

  /* ---------- кнопка волны и превью ---------- */
  refreshWaveUI(){
    const e = this.els;
    if (G.waveState === 'running'){
      e.btnWave.textContent = t('left_tpl', { n:G.wave, m:G.enemiesCount + G.events.length });
      e.btnWave.disabled = true;
    } else {
      const n = G.wave+1;
      e.btnWave.textContent = (S.auto ? '⟳ ' : '') + t('start_wave', { n });
      e.btnWave.disabled = G.state !== 'play';
      const w = G.nextWave;
      let modHtml = '';
      if (w && w.mod){
        const wm = WAVE_MODS[w.mod];
        modHtml = '<span class="pv mod" data-mod="'+w.mod+'" style="color:'+wm.color+';border-color:'+hexA(wm.color,0.5)+'">◆ '+t(wm.key)+'</span>';
      }
      e.wavePreview.innerHTML = (w ? wavePreview(w).map(p=>{
        const en = ENEMIES[p.type];
        const col = p.mut ? MUT[p.mut].color : en.color;
        return '<span class="pv'+(en.boss ? ' boss' : '')+'" data-en="'+p.type+'" data-mut="'+(p.mut||'')+'"><i style="background:'+col+';color:'+col+'"></i>×'+p.count+'</span>';
      }).join('') : '') + modHtml;
      // тултипы по врагам и модификатору
      e.wavePreview.querySelectorAll('.pv').forEach(el=>{
        el.addEventListener('pointerenter', (ev)=>{
          if (ev.pointerType !== 'mouse') return;
          let html;
          if (el.dataset.mod){
            const wm = WAVE_MODS[el.dataset.mod];
            html = '<div class="tt-name" style="color:'+wm.color+'">'+t(wm.key)+'</div><div class="tt-desc">'+t(wm.descKey)+'</div>';
          } else {
            const en = ENEMIES[el.dataset.en];
            html = '<div class="tt-name" style="color:'+en.color+'">'+t(en.key)+'</div><div class="tt-desc">'+t(en.key+'_d')+'</div>';
            if (el.dataset.mut){
              const m = MUT[el.dataset.mut];
              html += '<div class="tt-desc" style="color:'+m.color+'">'+t(m.key)+'</div>';
            }
          }
          this.showTipAt(html, el);
        });
        el.addEventListener('pointerleave', ()=>this.hideTip());
      });
    }
  },

  /* ---------- инспектор башни ---------- */
  renderInspector(){
    const el = this.els.inspector;
    this.hideTipIfOrphaned();
    const tw = G.selected;
    document.body.classList.toggle('ins-open', !!tw);
    if (!tw){ el.classList.remove('open'); return; }
    const def = TOWERS[tw.type], lv = lvOf(tw);
    const key = tw.id+':'+tw.lvl+':'+Math.round(G.cash);
    if (key === this.insKey) return;
    this.insKey = key;
    const stats = towerStatRows(def.kind, lv);
    const atBranch = tw.lvl === 1 && def.branches && !tw.branch; // пора выбрать специализацию
    let nextLine = '';
    if (!atBranch && tw.lvl+1 < def.lv.length){
      nextLine = statDiffGrid(def.kind, lv, def.lv[tw.lvl+1]);
    }
    const modes = ['first','last','strong'];
    const pips = [1,2,3].map(k=>'<i class="'+(k<=tw.lvl+1?'on':'')+'"></i>').join('');
    const upCost = tw.lvl+1 < def.lv.length ? def.lv[tw.lvl+1].up : 0;
    // кнопки улучшения: на 2-м уровне — выбор специализации
    let upButtons = '';
    if (atBranch){
      const brBtn = (br, cls)=>'<button class="btn primary '+cls+'" id="ins-br-'+br+'" title="'+
        t(def.branches[br].key)+': '+statList(def.kind, def.branches[br].lv).map(r=>r[0]+' '+r[1]).join(', ')+'" style="flex:1">'+t(def.branches[br].key)+' $'+def.branches[br].lv.up+'</button>';
      upButtons = brBtn('a','') + brBtn('b','');
    } else if (tw.lvl+1 < def.lv.length){
      upButtons = '<button class="btn primary" id="ins-up" style="flex:2">'+t('upgrade')+' $'+upCost+'</button>';
    } else {
      upButtons = '<button class="btn" disabled style="flex:2">'+t('maxlvl')+'</button>';
    }
    const branchName = tw.branch ? ' · '+t(def.branches[tw.branch].key) : '';
    el.innerHTML =
      '<div class="i-head"><img src="'+towerIconURL(tw.type)+'" alt="">'+
      '<div><div class="i-name">'+t(def.key)+branchName+'</div><div class="i-lvl">'+pips+'</div></div>'+
      '<button class="i-close" id="ins-x">✕</button></div>'+
      '<div class="i-stats">'+stats+'</div>'+nextLine+
      '<div class="i-btns">'+
        (def.kind!=='bank' && def.kind!=='cryo' && def.kind!=='amp' ? '<button class="btn" id="ins-mode">'+t('target')+': '+t('t_'+tw.mode)+'</button>' : '')+
        upButtons+
        '<button class="btn danger" id="ins-sell">'+t('sell')+' $'+Math.round(tw.invested*0.7)+'</button>'+
      '</div>';
    el.classList.add('open');
    const x = el.querySelector('#ins-x');
    if (x) x.addEventListener('click', ()=>{ G.selected = null; this.renderInspector(); });
    const mbtn = el.querySelector('#ins-mode');
    if (mbtn) mbtn.addEventListener('click', ()=>{
      const idx = modes.indexOf(tw.mode);
      tw.mode = modes[(idx+1)%modes.length];
      AudioSys.play('click'); this.insKey = ''; this.renderInspector();
    });
    const brA = el.querySelector('#ins-br-a');
    if (brA) brA.addEventListener('click', ()=>{ chooseBranch(tw, 'a'); this.insKey=''; this.renderInspector(); });
    const brB = el.querySelector('#ins-br-b');
    if (brB) brB.addEventListener('click', ()=>{ chooseBranch(tw, 'b'); this.insKey=''; this.renderInspector(); });
    const ubtn = el.querySelector('#ins-up');
    if (ubtn){
      ubtn.addEventListener('click', ()=>{ upgradeTower(tw); this.insKey=''; this.renderInspector(); });
      ubtn.addEventListener('pointerenter', (ev)=>{
        if (ev.pointerType !== 'mouse') return;
        const nl = def.lv[tw.lvl+1];
        this.showTipAt(
          '<div class="tt-name" style="color:'+def.color+'">'+t('next_lvl')+'</div>'+
          '<div class="tt-rows">'+towerStatRows(def.kind, nl)+'</div>',
          ubtn
        );
      });
      ubtn.addEventListener('pointerleave', ()=>this.hideTip());
    }
    const sbtn = el.querySelector('#ins-sell');
    if (sbtn) sbtn.addEventListener('click', ()=>{ sellTower(tw); this.renderInspector(); });
  },

  /* ---------- баннер, тосты, подсказки ---------- */
  banner(text, pink){
    const b = this.els.bannerText;
    b.textContent = text;
    b.classList.toggle('pink', !!pink);
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
  },
  toast(text, cls){
    const box = this.els.toasts;
    while (box.children.length >= 3) box.removeChild(box.firstChild);
    const d = document.createElement('div');
    d.className = 'toast'+(cls ? ' '+cls : '');
    d.textContent = text;
    box.appendChild(d);
    setTimeout(()=>d.classList.add('out'), 2600);
    setTimeout(()=>d.remove(), 3100);
  },
  hintLogic(){
    const h = this.els.hint;
    if (G.mapIdx === 0 && !G.endless && !S.tut.placed){ h.textContent = t('h_place'); h.hidden = false; }
    else if (!S.tut.started){ h.textContent = t('h_wave'); h.hidden = false; }
    else h.hidden = true;
  },
  hintDismiss(what){
    if (what === 'place' && !S.tut.placed){ S.tut.placed = 1; persist(); }
    if (what === 'wave' && !S.tut.started){ S.tut.started = 1; persist(); }
    this.hintLogic();
  },

  /* ---------- полоса босса ---------- */
  bossShow(e){
    this.els.bossName.textContent = e.variant ? t(BOSSES[e.variant].nameKey) : t('en_boss');
    this.els.bossbar.classList.add('show');
  },
  bossHide(){ this.els.bossbar.classList.remove('show'); },

  /* ---------- модалки ----------
     sticky=true — экраны конца партии (победа/поражение): тап по фону и Esc их не закрывают,
     у игрока всегда остаются кнопки выхода */
  modal(html, sticky){
    this.els.modal.innerHTML = html;
    this.els.overlay.hidden = false;
    this.modalSticky = !!sticky;
  },
  closeModal(){ this.els.overlay.hidden = true; this.els.modal.innerHTML = ''; this.modalSticky = false; },

  openPause(){
    if (G.state !== 'play') return;
    G.state = 'paused';
    this.pauseModal();
  },
  pauseModal(){
    this.modal(
      '<h3>'+t('p_title')+'</h3><div class="m-btns">'+
      '<button class="btn primary big" id="m-resume">'+t('p_resume')+'</button>'+
      '<button class="btn big" id="m-restart">'+t('p_restart')+'</button>'+
      '<button class="btn big" id="m-settings">'+t('settings')+'</button>'+
      '<button class="btn danger big" id="m-exit">'+t('p_exit')+'</button></div>'
    );
    $('m-resume').addEventListener('click', ()=>{ G.state = 'play'; this.closeModal(); AudioSys.play('click'); });
    $('m-restart').addEventListener('click', ()=>{ this.closeModal(); startGame(G.mapIdx, G.endless); });
    $('m-settings').addEventListener('click', ()=>this.openSettings());
    $('m-exit').addEventListener('click', ()=>this.confirmDlg(t('exit_q'), ()=>exitGame()));
  },
  openSettings(){
    const soundBtn = (on)=>'<button class="btn" id="m-sound">'+t('s_sound')+': '+(on ? t('on') : t('off'))+'</button>';
    this.modal(
      '<h3>'+t('s_title')+'</h3>'+
      '<div class="m-row"><span>'+t('s_sound')+'</span>'+
        '<div class="seg"><button id="m-snd-on" class="'+(S.sound?'on':'')+'">'+t('on')+'</button>'+
        '<button id="m-snd-off" class="'+(!S.sound?'on':'')+'">'+t('off')+'</button></div></div>'+
      '<div class="m-row"><span>'+t('s_lang')+'</span>'+
        '<div class="seg"><button id="m-lang-ru" class="'+(LANG==='ru'?'on':'')+'">RU</button>'+
        '<button id="m-lang-en" class="'+(LANG==='en'?'on':'')+'">EN</button></div></div>'+
      '<div class="m-row"><span>'+t('s_gfx')+'</span>'+
        '<div class="seg"><button id="m-gfx-hi" class="'+(!S.lowgfx?'on':'')+'">'+t('gfx_hi')+'</button>'+
        '<button id="m-gfx-lo" class="'+(S.lowgfx?'on':'')+'">'+t('gfx_lo')+'</button></div></div>'+
      '<div class="m-btns">'+
      '<button class="btn" id="m-exp">'+t('s_export')+'</button>'+
      '<textarea id="m-save" class="save-ta" spellcheck="false" placeholder="'+t('s_import_ph')+'"></textarea>'+
      '<button class="btn" id="m-imp">'+t('s_import')+'</button>'+
      '<button class="btn danger" id="m-reset">'+t('s_reset')+'</button>'+
      '<button class="btn primary" id="m-close">'+t('p_resume')+'</button></div>'+
      '<div class="m-text" style="margin-top:12px">'+t('s_note')+'</div>'+
      lastErrHtml()
    );
    $('m-snd-on').addEventListener('click', ()=>{ setSound(true); this.openSettings(); });
    $('m-snd-off').addEventListener('click', ()=>{ setSound(false); this.openSettings(); });
    $('m-lang-ru').addEventListener('click', ()=>{ setLang('ru'); this.openSettings(); });
    $('m-lang-en').addEventListener('click', ()=>{ setLang('en'); this.openSettings(); });
    $('m-gfx-hi').addEventListener('click', ()=>{ setLowGfx(false); this.openSettings(); });
    $('m-gfx-lo').addEventListener('click', ()=>{ setLowGfx(true); this.openSettings(); });
    $('m-reset').addEventListener('click', ()=>this.confirmDlg(t('s_reset_c'), ()=>{
      resetSave(); LANG = 'ru'; applyStaticI18n(); this.showScreen('menu'); this.renderMenu();
    }));
    $('m-exp').addEventListener('click', ()=>{
      const code = btoa(unescape(encodeURIComponent(JSON.stringify(S))));
      $('m-save').value = code;
      try{
        navigator.clipboard.writeText(code).then(
          ()=>this.toast(t('s_exp_ok')),
          ()=>{}
        );
      }catch(e){}
      AudioSys.play('click');
    });
    $('m-imp').addEventListener('click', ()=>{
      const code = ($('m-save').value||'').trim();
      try{
        const parsed = JSON.parse(decodeURIComponent(escape(atob(code))));
        if (!parsed || typeof parsed.cores !== 'number' || parsed.v !== 1) throw new Error('bad');
        // синхронизируем память: иначе beforeunload-автосейв перезатрёт импорт старым состоянием
        S = parsed;
        persist();
        this.toast(t('s_imp_ok'));
        setTimeout(()=>location.reload(), 600);
      }catch(e){
        this.toast(t('s_imp_bad'), 'warn');
        AudioSys.play('error');
      }
    });
    // если настройки открыты из паузы — «продолжить» возвращает в меню паузы
    $('m-close').addEventListener('click', ()=>{
      if (G.state === 'paused') this.pauseModal(); else this.closeModal();
    });
  },
  openVictory(r){
    this.lastEnd = { type:'won', r };
    const starsHtml = [1,2,3].map(k=>
      ICONS.star.replace('<svg','<svg class="'+(k<=r.stars?'on':'')+'" style="animation-delay:'+(k*0.25)+'s"')).join('');
    const unlocks = [];
    r.newMaps.forEach(i=>unlocks.push(t('v_unlocked_map', { name:t(MAPS[i].key) })));
    r.newTowers.forEach(tp=>unlocks.push(t('v_unlocked_tower', { name:t(TOWERS[tp].key) })));
    const hasNext = G.mapIdx+1 < MAPS.length && totalStars() >= MAPS[G.mapIdx+1].need;
    // топ орудий по накопленному урону за партию
    const dmg = G.dmgByType || {};
    const top = Object.entries(dmg).filter(([k])=>TOWERS[k]).sort((a,b)=>b[1]-a[1]).slice(0,3);
    const totalDmg = Object.values(dmg).reduce((a,v)=>a+v, 0) || 1;
    const topHtml = top.length ? '<div class="v-sub" style="margin-top:12px;margin-bottom:6px">'+t('v_top')+'</div><div class="v-weapons">'+
      top.map(([k,v])=>'<div class="v-weapon"><span style="color:'+TOWERS[k].color+'">'+t(TOWERS[k].key)+'</span><i><b style="width:'+Math.round(v/totalDmg*100)+'%"></b></i><em>'+Math.round(v/totalDmg*100)+'%</em></div>').join('')+'</div>' : '';
    this.modal(
      '<h3 class="lime">'+t('v_title')+'</h3>'+
      '<div class="v-stars">'+starsHtml+'</div>'+
      (r.earned ? '<div class="v-reward">'+t('v_reward', { n:r.earned })+'</div>' : '')+
      topHtml+
      (unlocks.length ? '<div class="v-sub">'+unlocks.join('<br>')+'</div>' : '')+
      '<div class="m-btns">'+
      (hasNext ? '<button class="btn primary big" id="v-next">'+t('v_next')+'</button>' : '')+
      '<button class="btn big" id="v-endless">'+t('v_endless_btn')+'</button>'+
      '<button class="btn big" id="v-lab">'+t('v_lab')+'</button>'+
      '<button class="btn ghost big" id="v-maps">'+t('v_maps')+'</button></div>',
      true
    );
    const svgs = this.els.modal.querySelectorAll('.v-stars svg');
    svgs.forEach(s=>s.classList.add('pop'));
    const nx = $('v-next');
    if (nx) nx.addEventListener('click', ()=>{ this.closeModal(); startGame(G.mapIdx+1, false); });
    $('v-endless').addEventListener('click', ()=>{ this.closeModal(); startGame(G.mapIdx, true); });
    $('v-lab').addEventListener('click', ()=>{ this.closeModal(); this.showScreen('lab'); });
    $('v-maps').addEventListener('click', ()=>{ this.closeModal(); this.showScreen('maps'); this.renderMaps(); });
  },
  openDefeat(){
    this.lastEnd = { type:'lost' };
    this.modal(
      '<h3 class="pink">'+t('d_title')+'</h3>'+
      '<div class="m-text">'+t('d_wave', { n:Math.max(1,G.wave) })+'</div>'+
      '<div class="m-btns">'+
      '<button class="btn primary big" id="d-retry">'+t('d_retry')+'</button>'+
      '<button class="btn big" id="d-maps">'+t('d_maps')+'</button></div>',
      true
    );
    $('d-retry').addEventListener('click', ()=>{ this.closeModal(); startGame(G.mapIdx, G.endless); });
    $('d-maps').addEventListener('click', ()=>{ this.closeModal(); exitGame(); });
  },
  confirmDlg(text, onYes, onNo){
    this.modal(
      '<h3>'+t('settings')+'</h3><div class="m-text">'+text+'</div>'+
      '<div class="m-btns" style="flex-direction:row;justify-content:center">'+
      '<button class="btn danger" id="c-yes">'+t('yes')+'</button>'+
      '<button class="btn" id="c-no">'+t('no')+'</button></div>'
    );
    $('c-yes').addEventListener('click', ()=>{ this.closeModal(); onYes(); });
    $('c-no').addEventListener('click', ()=>{ this.closeModal(); if (onNo) onNo(); });
  },
};

/* Характеристики башни строками — общие для инспектора и тултипа */
/* Последние ошибки с этого устройства — для отчёта разработчику */
function lastErrHtml(){
  let arr = [];
  try{ arr = JSON.parse(localStorage.getItem('nc_errs')||'[]'); }catch(e){}
  if (!arr.length) return '';
  return '<div class="m-text" style="margin-top:10px;color:var(--red);text-align:left">⚠ '+t('s_lasterr')+'<br>'+arr.map(x=>'· '+x).join('<br>')+'</div>';
}
function statList(kind, lv){
  const M = Math.round(lv.dmg*metaVals().dmgMul);
  switch (kind){
    case 'gun': case 'sniper':
      return [[t('st_dmg'), M], [t('st_rate'), lv.rate+t('sec_per')], [t('st_range'), lv.range]]
        .concat(lv.pierce ? [[t('st_pierce'), lv.pierce]] : []);
    case 'missile':
      return [[t('st_dmg'), M], [t('st_splash'), lv.splash], [t('st_rate'), lv.rate+t('sec_per')], [t('st_range'), lv.range]];
    case 'tesla':
      return [[t('st_dmg'), M], [t('st_chain'), lv.chain], [t('st_rate'), lv.rate+t('sec_per')], [t('st_range'), lv.range]];
    case 'cryo':
      return [[t('st_slow'), Math.round(lv.slow*100)+'%'], [t('st_dps'), Math.round(lv.dmg*metaVals().dmgMul)], [t('st_range'), lv.range]];
    case 'bank':
      return [[t('st_prod'), '$'+lv.prod+'/'+lv.cycle+'s']];
    case 'amp':
      return [[t('st_amp'), '+'+Math.round(lv.boost*100)+'%'], [t('st_range'), lv.range]];
    case 'poison':
      return [[t('st_poison'), lv.dmg], [t('st_rate'), lv.rate+t('sec_per')], [t('st_range'), lv.range]]
        .concat(lv.acid ? [[t('st_pierce'), '-3 '+t('st_armor_short')]] : []);
    case 'beam':
      return [[t('st_dps'), M], [t('st_ramp'), '+'+Math.round(lv.ramp*100)+'%'+t('sec_per')], [t('st_range'), lv.range]];
  }
  return [];
}
function towerStatRows(kind, lv){
  return statList(kind, lv).map(([l,v])=>'<span>'+l+'</span><b>'+v+'</b>').join('');
}
/* Сетка «текущее → следующее» для всех характеристик */
function statDiffGrid(kind, lv, nl){
  const a = statList(kind, lv), b = statList(kind, nl);
  const rows = a.map(([l,v],i)=>{
    const nv = b[i] ? b[i][1] : '—';
    const changed = (''+nv) !== (''+v);
    return '<div class="i-drow'+(changed?' ch':'')+'"><span>'+l+'</span><b>'+v+'</b><em>→</em><b'+(changed?' style="color:var(--lime)"':'')+'>'+nv+'</b></div>';
  });
  if (b.length > a.length) b.slice(a.length).forEach(([l,v])=>rows.push('<div class="i-drow ch"><span>'+l+'</span><b>—</b><em>→</em><b style="color:var(--lime)">'+v+'</b></div>'));
  return '<div class="i-diff">'+rows.join('')+'</div>';
}

/* Достижения: проверка после значимых событий */
function checkAch(){
  for (const a of ACHS){
    if (S.ach[a.id]) continue;
    let ok = false;
    try{ ok = a.test(); }catch(e){}
    if (ok){
      S.ach[a.id] = 1;
      addCores(a.reward);
      UI.toast(t('t_ach', { name:t(a.key), r:a.reward }), 'ach');
      AudioSys.play('ach');
      haptic('success');
      persist();
    }
  }
}

/* Язык и звук: переключатели */
function setLang(lang){
  LANG = lang; S.lang = lang; persist();
  document.documentElement.lang = lang;
  applyStaticI18n();
  UI.renderMenu();
  if (UI.cur === 'maps') UI.renderMaps();
  if (UI.cur === 'lab') UI.renderLab();
  if (UI.cur === 'ach') UI.renderAch();
  if (UI.cur === 'game'){ UI.buildBuildbar(); UI.refreshWaveUI(); UI.insKey=''; UI.renderInspector(); UI.hintLogic(); }
}
function setSound(on){
  S.sound = on; persist();
  AudioSys.setMuted(!on);
  if (on) AudioSys.resume();
}
/* Низкая графика: DPR 1x, без глоу у врагов, вдвое меньше частиц */
function setLowGfx(on){
  S.lowgfx = on; persist();
  computeView();
}

/* ---------- Превью карты в карточке выбора ---------- */
function drawMapPreview(cv, m){
  const c = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const sx = (W-24)/COLS, sy = (H-16)/ROWS, s = Math.min(sx, sy);
  const ox = (W - s*COLS)/2, oy = (H - s*ROWS)/2;
  c.fillStyle = 'rgba(3,6,14,0.9)'; c.fillRect(0,0,W,H);
  c.strokeStyle = 'rgba(0,229,255,0.08)';
  for (let i=0;i<=COLS;i++){ c.beginPath(); c.moveTo(ox+i*s, oy); c.lineTo(ox+i*s, oy+ROWS*s); c.stroke(); }
  for (let j=0;j<=ROWS;j++){ c.beginPath(); c.moveTo(ox, oy+j*s); c.lineTo(ox+COLS*s, oy+j*s); c.stroke(); }
  // путь
  const P = (pt)=>[ox+(pt[0]+0.5)*s, oy+(pt[1]+0.5)*s];
  c.lineJoin = 'round'; c.lineCap = 'round';
  m.paths.forEach(wps=>{
    const pts = [];
    for (let i=0;i<wps.length-1;i++){
      const c0=wps[i][0], r0=wps[i][1], c1=wps[i+1][0], r1=wps[i+1][1];
      const sc=Math.sign(c1-c0), sr=Math.sign(r1-r0);
      let cc=c0, cr=r0; pts.push([cc,cr]);
      while (cc!==c1 || cr!==r1){ cc+=sc; cr+=sr; pts.push([cc,cr]); }
    }
    const px = pts.map(P);
    c.strokeStyle = 'rgba(2,6,14,0.9)'; c.lineWidth = s*0.5; strokePoly(c, px);
    c.strokeStyle = hexA(m.color, 0.85); c.lineWidth = 1.6; strokePoly(c, px);
    // портал
    const p0 = px[0];
    c.fillStyle = hexA(m.color, 0.9);
    c.beginPath(); c.arc(p0[0], p0[1], 3, 0, TAU); c.fill();
  });
  // ядро
  const core = P(m.paths[0][m.paths[0].length-1]);
  drawGlow(c, core[0], core[1], 8, '#00e5ff', 0.8);
  c.fillStyle = '#9ef7ff';
  c.beginPath(); c.arc(core[0], core[1], 3.5, 0, TAU); c.fill();
}

/* ---------- Фон меню: дрейфующие частицы ---------- */
const BG = { pts:[], t:0 };
function initBgfx(){
  const cv = $('bgfx');
  const resize = ()=>{
    cv.width = innerWidth; cv.height = innerHeight;
  };
  resize();
  window.addEventListener('resize', resize);
  BG.pts = [];
  for (let i=0;i<70;i++){
    BG.pts.push({ x:rnd(innerWidth), y:rnd(innerHeight), vx:rnd(-8,8), vy:rnd(-14,-4),
      s:rnd(1,2.6), c:pick(['#00e5ff','#ff2d78','#9d5cff','#a8ff3e']), a:rnd(0.1,0.5) });
  }
}
function drawBgfx(dt){
  if (UI.cur === 'game') return;
  const cv = $('bgfx'), c = cv.getContext('2d');
  BG.t += dt;
  c.clearRect(0,0,cv.width,cv.height);
  // редкая сетка
  c.strokeStyle = 'rgba(0,229,255,0.045)'; c.lineWidth = 1;
  const step = 64, off = (BG.t*8)%step;
  for (let x=-off; x<cv.width; x+=step){ c.beginPath(); c.moveTo(x,0); c.lineTo(x,cv.height); c.stroke(); }
  for (let y=-off; y<cv.height; y+=step){ c.beginPath(); c.moveTo(0,y); c.lineTo(cv.width,y); c.stroke(); }
  for (const p of BG.pts){
    p.x += p.vx*dt; p.y += p.vy*dt;
    if (p.y < -10){ p.y = cv.height+10; p.x = rnd(cv.width); }
    if (p.x < -10) p.x = cv.width+10;
    if (p.x > cv.width+10) p.x = -10;
    c.globalAlpha = p.a*(0.7+0.3*Math.sin(BG.t*2+p.x));
    c.fillStyle = p.c;
    c.fillRect(p.x, p.y, p.s, p.s);
  }
  c.globalAlpha = 1;
}

/* ---------- Логотип в меню ---------- */
function drawLogo(time){
  const cv = $('logo'), c = cv.getContext('2d');
  const cx = cv.width/2, cy = cv.height/2;
  c.clearRect(0,0,cv.width,cv.height);
  drawGlow(c, cx, cy, 62, '#00e5ff', 0.55);
  c.save(); c.translate(cx, cy);
  c.strokeStyle = '#00e5ff'; c.lineWidth = 2.5;
  for (let i=0;i<3;i++){
    c.save(); c.rotate(time*(0.5+i*0.22)+i*2.1);
    c.beginPath();
    for (let k=0;k<6;k++){
      const a = k*TAU/6, r = 34+i*17;
      k ? c.lineTo(Math.cos(a)*r, Math.sin(a)*r) : c.moveTo(Math.cos(a)*r, Math.sin(a)*r);
    }
    c.closePath(); c.stroke();
    c.restore();
  }
  c.restore();
  const pulse = 1 + Math.sin(time*3)*0.1;
  c.fillStyle = '#9ef7ff';
  c.beginPath(); c.arc(cx, cy, 13*pulse, 0, TAU); c.fill();
}
