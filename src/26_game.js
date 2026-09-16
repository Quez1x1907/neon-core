/* ==================== ИГРА: состояние, обновление, рендер ==================== */

const V = { cs:40, ox:0, oy:0, w:0, h:0, dpr:1 };
let boardBG = null;
const boardCv = $('board');
const bctx = boardCv.getContext('2d');

const G = {
  active:false, mapIdx:0, map:null, endless:false,
  paths:[], pathCells:new Set(), deco:new Set(), buildable:new Set(), pathPxs:[], core:null,
  cash:0, lives:0, maxLives:20, wave:0, waveState:'prep', waveT:0, events:[],
  curWave:null, nextWave:null, enemiesCount:0, bossRef:null,
  state:'play', speed:1, slowmoT:0, coreFlash:0, cleanStreak:0, leaksThisWave:0,
  towers:[], towerGrid:new Map(),
  placing:null, selected:null, hoverCell:null,
  shakeT:0, shakeAmp:0, time:0,
  abil:{ emp:{cd:0}, over:{cd:0, active:0} }, // способности: перезарядка и активный эффект
  targeting:null,          // 'emp' — выбор места для импульса
  autoT:0,                 // таймер автостарта волны
  coreCharge:0,            // заряд новы (0..100)
  dmgByType:{},            // накопленный урон по типам башен — для статистики победы
};

/* ---------- Геометрия карты ---------- */
function computePaths(map){
  G.paths = map.paths.map(wps=>{
    const pts = [];
    for (let i=0;i<wps.length-1;i++){
      const c0=wps[i][0], r0=wps[i][1], c1=wps[i+1][0], r1=wps[i+1][1];
      const sc=Math.sign(c1-c0), sr=Math.sign(r1-r0);
      let c=c0, r=r0;
      pts.push([c,r]);
      while (c!==c1 || r!==r1){ c+=sc; r+=sr; pts.push([c,r]); }
    }
    return pts;
  });
  G.pathCells = new Set();
  for (const pts of G.paths)
    for (const [c,r] of pts)
      if (c>=0 && c<COLS && r>=0 && r<ROWS) G.pathCells.add(c+','+r);
  G.deco = new Set(map.deco.map(d=>d[0]+','+d[1]));
  G.cols = map.cols || COLS;
  G.rows = map.rows || ROWS;
  // зоны стройки: «премиальные» точки — клетки, у которых трасса проходит минимум
  // дважды рядом (двойное покрытие), плюс клетки вплотную к дороге
  G.buildable = new Set();
  const neighbours = (c, r) => {
    let n = 0, ortho = false;
    for (let dc=-1; dc<=1; dc++) for (let dr=-1; dr<=1; dr++){
      if (!dc && !dr) continue;
      if (G.pathCells.has((c+dc)+','+(r+dr))){ n++; if (!dc || !dr) ortho = true; }
    }
    return { n, ortho };
  };
  for (let c=0; c<G.cols; c++) for (let r=0; r<G.rows; r++){
    const k = c+','+r;
    if (G.pathCells.has(k) || G.deco.has(k)) continue;
    const { n, ortho } = neighbours(c, r);
    if (n >= 2 || (n >= 1 && ortho)) G.buildable.add(k);
  }
  G.core = G.paths[0][G.paths[0].length-1];
}
function computePathPxs(){
  G.pathPxs = G.paths.map(pts => pts.map(([c,r]) => [V.ox+(c+0.5)*V.cs, V.oy+(r+0.5)*V.cs]));
}

/* ---------- Вид/канва: пересчёт при ресайзе ---------- */
function computeView(){
  const wrap = $('boardwrap');
  const w = wrap.clientWidth, h = wrap.clientHeight;
  if (!w || !h) return;
  V.dpr = S.lowgfx ? 1 : Math.min(window.devicePixelRatio||1, 1.5); // низкая графика = 1x, обычно — до 1.5x
  V.w = w; V.h = h;
  boardCv.width = Math.round(w*V.dpr); boardCv.height = Math.round(h*V.dpr);
  const C = (G.active && G.cols) || COLS, R = (G.active && G.rows) || ROWS;
  // большие карты: клетки не мельче 34px, поле панорамируется
  V.cs = Math.max(Math.min(w/C, h/R), 34);
  const bw = C*V.cs, bh = R*V.cs;
  // сохраняем центр камеры при пересчёте размеров
  let cx = (V.ox + V.w/2) / Math.max(1, bw), cy = (V.oy + V.h/2) / Math.max(1, bh);
  V.ox = cx*bw - w/2;
  V.oy = cy*bh - h/2;
  if (bw <= w) V.ox = (w - bw)/2;
  if (bh <= h) V.oy = (h - bh) > V.cs*2 ? 2 : (h - bh)/2; // портрет: поле прижато к HUD
  clampCam(C, R);
  computePathPxs();
  renderBoardBG();
  renderGame(); // ресайз мог случиться на паузе — кадр должен остаться актуальным
}
/* Камера не даёт показать пустоту за пределами поля */
function clampCam(C, R){
  C = C || ((G.active && G.cols) || COLS);
  R = R || ((G.active && G.rows) || ROWS);
  const bw = C*V.cs, bh = R*V.cs;
  V.ox = bw <= V.w ? (V.w - bw)/2 : clamp(V.ox, V.w - bw, 0);
  V.oy = bh <= V.h ? ((V.h - bh) > V.cs*2 ? 2 : (V.h - bh)/2) : clamp(V.oy, V.h - bh, 0);
  computePathPxs(); // трасса-дэши и порталы следуют за камерой
}

/* ---------- Старт/выход партии ---------- */
function startGame(mapIdx, endless){
  G.active = true; G.mapIdx = mapIdx; G.map = MAPS[mapIdx]; G.endless = !!endless;
  computePaths(G.map);
  const mv = metaVals();
  G.cash = mv.cash; G.lives = mv.lives; G.maxLives = mv.lives;
  G.wave = 0; G.waveState = 'prep'; G.events = []; G.enemiesCount = 0;
  G.curWave = null; G.nextWave = buildWave(mapIdx, 1, G.endless);
  G.towers = []; G.towerGrid = new Map();
  G.state = 'play'; G.speed = 1; G.slowmoT = 0; G.coreFlash = 0;
  G.cleanStreak = 0; G.leaksThisWave = 0; G.time = 0;
  G.placing = null; G.selected = null; G.hoverCell = null;
  G.bossRef = null; G.shakeT = 0; G.shakeAmp = 0;
  G.abil = { emp:{cd:0}, over:{cd:0, active:0} };
  G.targeting = null; G.autoT = 0;
  G.coreCharge = 0; G.dmgByType = {};
  initPools();
  UI.bossHide();
  UI.renderInspector();
  UI.showScreen('game');
  computeView();
  UI.buildBuildbar();
  UI.updateHUD(true);
  UI.refreshWaveUI();
  UI.hintLogic();
  if ((G.map.cols||12) > 12 && !S.seen.pan){
    S.seen.pan = 1; persist();
    UI.toast(t('pan_hint'), 'warn');
  }
}

function exitGame(){
  G.active = false; G.placing = null; G.selected = null;
  UI.bossHide();
  UI.showScreen('maps');
  UI.renderMaps();
}

/* ---------- Постройка/улучшение/продажа ---------- */
function canPlace(c,r){
  if (c<0||r<0||c>=G.cols||r>=G.rows) return false;
  const k = c+','+r;
  return G.buildable.has(k) && !G.towerGrid.has(k);
}
function towerAt(c,r){ return G.towerGrid.get(c+','+r) || null; }

function placeTower(type, c, r){
  const def = TOWERS[type];
  if (!canPlace(c,r) || G.cash < def.cost){ AudioSys.play('error'); return false; }
  G.cash -= def.cost;
  const tw = { id:++UID, type, lvl:0, c, r, x:c+0.5, y:r+0.5, cd:0, invested:def.cost,
    mode: def.kind==='sniper' ? 'strong' : 'first', aim:-TAU/8, stun:0, exposure:0,
    targetRef:null, prodT:0, tickT:0 };
  G.towers.push(tw); G.towerGrid.set(c+','+r, tw);
  if (type === 'amp') S.stats.maxAmps = Math.max(S.stats.maxAmps, G.towers.filter(t=>t.type==='amp').length);
  S.stats.towersBuilt++;
  S.stats.maxTowers = Math.max(S.stats.maxTowers, G.towers.length);
  AudioSys.play('place');
  haptic('light');
  burst(V.ox+(c+0.5)*V.cs, V.oy+(r+0.5)*V.cs, def.color, 12, 130, 0.4);
  UI.hintDismiss('place');
  checkAch();
  return true;
}
function upgradeTower(tw){
  const def = TOWERS[tw.type];
  if (tw.lvl+1 >= def.lv.length){ AudioSys.play('error'); return; }
  const cost = def.lv[tw.lvl+1].up;
  if (G.cash < cost){ AudioSys.play('error'); return; }
  G.cash -= cost; tw.invested += cost; tw.lvl++;
  S.stats.maxTowerLevel = Math.max(S.stats.maxTowerLevel, tw.lvl+1);
  AudioSys.play('upgrade');
  ring(V.ox+tw.x*V.cs, V.oy+tw.y*V.cs, def.color, 4, V.cs*0.9, 0.4, 2);
  burst(V.ox+tw.x*V.cs, V.oy+tw.y*V.cs, def.color, 8, 110, 0.35);
  checkAch();
}
/* Выбор специализации 3-го уровня — необратимо */
function chooseBranch(tw, br){
  const def = TOWERS[tw.type];
  if (!def.branches || tw.lvl !== 1 || tw.branch){ AudioSys.play('error'); return; }
  const brDef = def.branches[br];
  if (G.cash < brDef.lv.up){ AudioSys.play('error'); return; }
  G.cash -= brDef.lv.up;
  tw.invested += brDef.lv.up;
  tw.branch = br;
  tw.lvOverride = Object.assign({ up:0 }, brDef.lv);
  tw.lvl = 2;
  S.stats.branches = (S.stats.branches||0) + 1;
  S.stats.maxTowerLevel = Math.max(S.stats.maxTowerLevel, 3);
  AudioSys.play('upgrade');
  ring(V.ox+tw.x*V.cs, V.oy+tw.y*V.cs, def.color, 4, V.cs*1.1, 0.5, 2.5);
  burst(V.ox+tw.x*V.cs, V.oy+tw.y*V.cs, def.color, 14, 140, 0.45);
  floater(V.ox+tw.x*V.cs, V.oy+tw.y*V.cs - 14, t(brDef.key), def.color, true);
  checkAch();
}
function sellTower(tw){
  const refund = Math.round(tw.invested*0.7);
  G.cash += refund;
  G.towerGrid.delete(tw.c+','+tw.r);
  const i = G.towers.indexOf(tw);
  if (i>=0) G.towers.splice(i,1);
  if (G.selected === tw) G.selected = null;
  AudioSys.play('sell');
  floater(V.ox+tw.x*V.cs, V.oy+tw.y*V.cs, '+$'+refund, '#a8ff3e');
}

/* ---------- Прицеливание и стрельба ---------- */
function acquireTarget(tw, lv){
  const r2 = lv.range*lv.range;
  const mr2 = (lv.minRange||0)*(lv.minRange||0);
  let best = null, bestKey = -Infinity;
  for (const e of EP){
    if (!e.alive || e.dead || e.phased) continue;
    if (mr2 && dist2(tw.x, tw.y, e.x, e.y) < mr2) continue; // мортира не бьёт вплотную
    if (dist2(tw.x, tw.y, e.x, e.y) > r2) continue;
    let key;
    if (tw.mode === 'last') key = -e.dist;
    else if (tw.mode === 'strong') key = e.hp + e.shield;
    else key = e.dist;
    if (key > bestKey){ bestKey = key; best = e; }
  }
  return best;
}
function fireHitscan(tw, e, def, lv, dmgMul){
  const x1 = V.ox+tw.x*V.cs, y1 = V.oy+tw.y*V.cs;
  const x2 = V.ox+e.x*V.cs, y2 = V.oy+e.y*V.cs;
  tracer(x1,y1,x2,y2, def.color, 0.09, def.kind==='sniper' ? 2.5 : 1.5);
  burst(x2,y2, def.color, def.kind==='sniper' ? 6 : 2, 90, 0.25);
  tw.aim = Math.atan2(e.y-tw.y, e.x-tw.x);
  damage(e, lv.dmg*dmgMul, def.kind==='sniper' ? lv.pierce : 0, false, tw.type);
  AudioSys.play(def.kind==='sniper' ? 'snipe' : 'pulse');
}
function fireTesla(tw, primary, lv, dmgMul){
  const hit = [primary];
  let cur = primary;
  const link2 = 1.9*1.9;
  while (hit.length < lv.chain){
    let best = null, bd = Infinity;
    for (const e of EP){
      if (!e.alive || e.dead || e.phased || hit.includes(e)) continue;
      const d2 = dist2(cur.x, cur.y, e.x, e.y);
      if (d2 < link2 && d2 < bd){ bd = d2; best = e; }
    }
    if (!best) break;
    hit.push(best); cur = best;
  }
  const pts = [[V.ox+tw.x*V.cs, V.oy+tw.y*V.cs]];
  hit.forEach((e,i)=>{
    damage(e, lv.dmg*dmgMul*Math.pow(0.75,i), 2, false, tw.type);
    pts.push([V.ox+e.x*V.cs, V.oy+e.y*V.cs]);
  });
  zapFx(pts, '#c9a6ff');
  tw.aim = Math.atan2(primary.y-tw.y, primary.x-tw.x);
  AudioSys.play('tesla');
}
function fireToxin(tw, e, lv, dmgMul){
  tracer(V.ox+tw.x*V.cs, V.oy+tw.y*V.cs, V.ox+e.x*V.cs, V.oy+e.y*V.cs, TOWERS.toxin.color, 0.12, 1.5);
  tw.aim = Math.atan2(e.y-tw.y, e.x-tw.x);
  if (!e.phased){
    e.poisonS = Math.min(lv.cap||8, (e.poisonS||0) + 1);
    e.poisonT = 4;
    e.poisonDps = lv.dmg*dmgMul;
    if (lv.acid) e.poisonAcid = true;
  }
  damage(e, 4*dmgMul, 99, true, tw.type);
  AudioSys.play('toxin');
}
function fireMortar(tw, e, lv, dmgMul){
  const b = bpGet();
  if (!b) return;
  const dist = Math.hypot(e.x-tw.x, e.y-tw.y);
  b.alive = true; b.arcT = 0;
  b.T = 0.55 + dist*0.05;
  b.sx = tw.x; b.sy = tw.y;
  b.lx = e.x; b.ly = e.y;          // артиллерия бьёт по точке на момент выстрела
  b.x = tw.x; b.y = tw.y; b.px = tw.x; b.py = tw.y;
  b.dmg = lv.dmg*dmgMul; b.rad = lv.splash; b.color = TOWERS.mortar.color;
  b.src = tw.type; b.stun = lv.stun||0; b.big = true;
  b.H = Math.min(dist*0.45, 6);    // высота дуги в клетках
  burst(V.ox+tw.x*V.cs, V.oy+tw.y*V.cs, b.color, 6, 120, 0.3);
  tw.aim = Math.atan2(e.y-tw.y, e.x-tw.x);
  AudioSys.play('missile');
  G.shake(2);
}
function fireMissile(tw, e, lv, dmgMul){
  const b = bpGet();
  if (b){
    b.alive = true; b.x = tw.x; b.y = tw.y; b.px = tw.x; b.py = tw.y;
    b.tgt = e; b.lx = e.x; b.ly = e.y; b.spd = 7; b.src = tw.type;
    b.dmg = lv.dmg*dmgMul; b.rad = lv.splash; b.color = TOWERS.missile.color;
  }
  tw.aim = Math.atan2(e.y-tw.y, e.x-tw.x);
  AudioSys.play('missile');
}
function explode(b){
  b.alive = false;
  const px = V.ox+b.x*V.cs, py = V.oy+b.y*V.cs;
  burst(px,py,'#ffb020', b.big ? 26 : 14, b.big ? 240 : 190, 0.45);
  ring(px,py,b.color, b.rad*V.cs*0.2, b.rad*V.cs, 0.3, b.big ? 3.5 : 2.5);
  AudioSys.play('boom'); G.shake(b.big ? 7 : 3);
  const r2 = b.rad*b.rad;
  for (const e of EP){
    if (!e.alive || e.dead || e.phased) continue;
    const d2 = dist2(b.x, b.y, e.x, e.y);
    if (d2 <= r2){
      const f = 1 - 0.5*Math.sqrt(d2)/b.rad;
      damage(e, b.dmg*f, 1, false, b.src);
      if (b.stun && e.alive && !e.dead) e.stunT = Math.max(e.stunT||0, b.stun);
    }
  }
}
function beamTick(tw, def, lv, dt, dmgMul){
  let e = tw.targetRef;
  const valid = e && e.alive && !e.dead && !e.phased && dist2(tw.x,tw.y,e.x,e.y) <= lv.range*lv.range;
  if (!valid){ e = acquireTarget(tw, lv); tw.exposure = 0; }
  tw.targetRef = e || null;
  if (!e) return;
  tw.exposure = Math.min(3, tw.exposure + dt);
  tw.aim = Math.atan2(e.y-tw.y, e.x-tw.x);
  damage(e, lv.dmg*dmgMul*(1 + lv.ramp*tw.exposure)*dt, 0, true, tw.type);
  tw.tickT -= dt;
  if (tw.tickT <= 0){ tw.tickT = 0.12; AudioSys.play('beamtick'); }
}

/* ---------- Обновление сущностей ---------- */
function updateEnemies(dt){
  G.enemiesCount = 0;
  let boss = null;
  for (const e of EP){
    if (!e.alive || e.dead) continue;
    G.enemiesCount++;
    if (e.boss) boss = e;
    // оглушение (ЭМИ-импульс)
    if (e.stunT > 0){
      e.stunT -= dt;
      e.slowF = 0; e.slowT = 0;
      e.dist += 0; // стоит на месте
      const p0 = posAt(e.pts, e.dist); e.x = p0.x; e.y = p0.y; e.ang = p0.ang;
      e.hitF = Math.max(0, e.hitF - dt);
      continue;
    }
    // замедление
    if (e.slowT > 0){ e.slowT -= dt; e.speed = e.baseSpeed*(1-e.slowF); }
    else { e.slowF = 0; e.speed = e.baseSpeed; }
    // яд: тик мимо брони
    if (e.poisonT > 0){
      e.poisonT -= dt;
      damage(e, (e.poisonS||0)*(e.poisonDps||0)*dt, 99, true, 'toxin');
      if (e.poisonT <= 0){ e.poisonS = 0; e.poisonAcid = false; }
    }
    // медик лечит союзников
    if (e.def.heal){
      e.healT -= dt;
      if (e.healT <= 0){
        e.healT = e.def.heal.per;
        const r2 = e.def.heal.rad*e.def.heal.rad;
        let healed = false;
        for (const a of EP){
          if (!a.alive || a.dead || a === e) continue;
          if (dist2(a.x,a.y,e.x,e.y) <= r2 && a.hp < a.maxhp){
            a.hp = Math.min(a.maxhp, a.hp + e.healAmt); healed = true;
          }
        }
        if (healed){
          ring(V.ox+e.x*V.cs, V.oy+e.y*V.cs, '#3dff8f', 4, e.def.heal.rad*V.cs, 0.4, 1.5);
          AudioSys.play('heal');
        }
      }
    }
    // фантом фазируется
    if (e.def.phase){
      e.phaseT += dt;
      e.phased = (e.phaseT % e.def.phase.every) < e.def.phase.dur;
    }
    // эгида: регенерация щита
    if (e.maxshield > 0){
      e.shieldT += dt;
      if (e.shieldT > 3) e.shield = Math.min(e.maxshield, e.shield + e.def.shieldRegen*dt);
    }
    e.hitF = Math.max(0, e.hitF - dt);
    e.dist += e.speed*dt;
    if (e.dist >= e.len){ leakEnemy(e); continue; }
    const p = posAt(e.pts, e.dist);
    e.x = p.x; e.y = p.y; e.ang = p.ang;
  }
  G.bossRef = boss;
}

/* Уровень башни с учётом выбранной ветки 3-го уровня */
function lvOf(tw){
  return tw.lvOverride || TOWERS[tw.type].lv[tw.lvl];
}

function updateTowers(dt){
  const dmgMul = metaVals().dmgMul;
  const overMul = G.abil.over.active > 0 ? ABILITIES.over.mult : 1;
  // аура Амплиферов: считаем усиление каждой башне (усилители не складываются с собой)
  for (const tw of G.towers) tw.amp = 1;
  for (const a of G.towers){
    if (TOWERS[a.type].kind !== 'amp' || a.stun > 0) continue;
    const alv = lvOf(a);
    const r2 = alv.range*alv.range;
    for (const tw of G.towers){
      if (tw === a || TOWERS[tw.type].kind === 'amp') continue;
      if (dist2(a.x, a.y, tw.x, tw.y) <= r2) tw.amp *= (1 + alv.boost);
    }
  }
  for (const tw of G.towers){
    const def = TOWERS[tw.type], lv = lvOf(tw);
    if (tw.stun > 0){ tw.stun -= dt; continue; }
    if (def.kind === 'amp'){
      tw.prodT -= dt; // переиспользуем таймер для пульса ауры
      if (tw.prodT <= 0){ tw.prodT = 1.2; }
      continue;
    }
    if (def.kind === 'bank'){
      tw.prodT -= dt;
      if (tw.prodT <= 0){
        tw.prodT = lv.cycle;
        const inc = Math.round(lv.prod*metaVals().rewardMul);
        G.cash += inc; S.stats.money += inc;
        floater(V.ox+tw.x*V.cs, V.oy+tw.y*V.cs - 10, '+$'+inc, '#a8ff3e');
        ring(V.ox+tw.x*V.cs, V.oy+tw.y*V.cs, def.color, 3, V.cs*0.5, 0.35, 1.5);
        AudioSys.play('coin');
      }
      continue;
    }
    if (def.kind === 'cryo'){
      const r2 = lv.range*lv.range;
      for (const e of EP){
        if (!e.alive || e.dead) continue;
        if (dist2(tw.x, tw.y, e.x, e.y) > r2) continue;
        if (!e.phased){ e.slowF = Math.max(e.slowF, lv.slow*(e.boss ? 0.5 : 1)); e.slowT = 0.25; }
        damage(e, lv.dmg*dt, 99, true, tw.type);
      }
      continue;
    }
    if (def.kind === 'poison'){
      tw.cd -= dt*overMul;
      if (tw.cd <= 0){
        const e = acquireTarget(tw, lv);
        if (e){ fireToxin(tw, e, lv, dmgMul); tw.cd = 1/lv.rate; }
        else tw.cd = 0;
      }
      continue;
    }
    if (def.kind === 'mortar'){
      tw.cd -= dt*overMul;
      if (tw.cd <= 0){
        const e = acquireTarget(tw, lv);
        if (e){ fireMortar(tw, e, lv, dmgMul*tw.amp); tw.cd = 1/lv.rate; }
        else tw.cd = 0;
      }
      continue;
    }
    if (def.kind === 'beam'){ beamTick(tw, def, lv, dt, dmgMul*tw.amp*overMul); continue; }
    tw.cd -= dt*overMul;
    if (tw.cd <= 0){
      const e = acquireTarget(tw, lv);
      if (e){
        if (def.kind === 'tesla') fireTesla(tw, e, lv, dmgMul*tw.amp);
        else if (def.kind === 'missile') fireMissile(tw, e, lv, dmgMul*tw.amp);
        else fireHitscan(tw, e, def, lv, dmgMul*tw.amp);
        tw.cd = 1/lv.rate;
      } else tw.cd = 0;
    }
  }
}

function updateBullets(dt){
  for (const b of BP){
    if (!b.alive) continue;
    if (b.arcT !== undefined){ // дуговая ракета мортиры
      b.arcT += dt;
      const k = Math.min(1, b.arcT/b.T);
      b.px = b.x; b.py = b.y;
      b.x = lerp(b.sx, b.lx, k);
      b.y = lerp(b.sy, b.ly, k);
      b.h = Math.sin(Math.PI*k)*b.H;
      if (Math.random() < 0.5){
        const p = ppGet();
        if (p){
          p.alive = true; p.x = V.ox+b.x*V.cs; p.y = V.oy+(b.y-b.h*0)*V.cs - b.h*V.cs;
          p.vx = rnd(-8,8); p.vy = rnd(-8,8);
          p.t = 0; p.ttl = 0.3; p.color = '#ffb020'; p.size = 2; p.kind = 'spark';
        }
      }
      if (k >= 1) explode(b);
      continue;
    }
    if (b.tgt && b.tgt.alive && !b.tgt.dead && !b.tgt.phased){ b.lx = b.tgt.x; b.ly = b.tgt.y; }
    b.px = b.x; b.py = b.y;
    const dx = b.lx-b.x, dy = b.ly-b.y, d = Math.hypot(dx,dy);
    const step = b.spd*dt;
    if (d <= step || d < 0.001){ b.x = b.lx; b.y = b.ly; explode(b); }
    else { b.x += dx/d*step; b.y += dy/d*step; }
  }
}

function updateFx(dt){
  for (const p of PP){
    if (!p.alive) continue;
    p.t += dt;
    if (p.t >= p.ttl){ p.alive = false; continue; }
    if (p.kind === 'spark'){ p.x += p.vx*dt; p.y += p.vy*dt; p.vx *= (1-2.4*dt); p.vy *= (1-2.4*dt); }
  }
  for (const tr of TX){ if (tr.alive){ tr.t += dt; if (tr.t >= tr.ttl) tr.alive = false; } }
  for (const f of FP){ if (f.alive){ f.t += dt; if (f.t >= f.ttl) f.alive = false; } }
}

/* ---------- Управление волной ---------- */
function startWave(){
  if (G.waveState !== 'prep' || G.state !== 'play') return;
  G.wave++;
  G.curWave = G.nextWave || buildWave(G.mapIdx, G.wave, G.endless);
  G.nextWave = null;
  G.events = waveEvents(G.curWave, G.paths.length);
  G.waveT = 0; G.waveState = 'running'; G.leaksThisWave = 0;
  AudioSys.play(G.curWave.bossWave ? 'boss' : 'wavestart');
  UI.banner(G.curWave.bossWave ? t('boss_wave')
    : (G.endless ? t('wave_endless', { n:G.wave }) : t('wave_tpl', { n:G.wave, m:WAVES_PER_MAP })), G.curWave.bossWave);
  // анонс модификатора волны
  if (G.curWave.mod){
    const wm = WAVE_MODS[G.curWave.mod];
    UI.banner(t(wm.key), true);
    UI.toast(t(wm.key)+' · '+t(wm.descKey), 'warn');
  }
  // интро новых врагов/мутаций — ненавязчивые тосты
  for (const g of G.curWave.groups){
    const ek = 'en_'+g.type;
    if (!S.seen[ek]){
      S.seen[ek] = 1;
      if (g.type !== 'drone') UI.toast(t('new_enemy', { name:t(ENEMIES[g.type].key) }), 'warn');
    }
    if (g.mut && !S.seen['mut_'+g.mut]){
      S.seen['mut_'+g.mut] = 1;
      UI.toast(t('new_mut', { name:t(MUT[g.mut].key) }), 'warn');
    }
  }
  UI.hintDismiss('wave');
  UI.refreshWaveUI();
}

function waveClear(){
  try{ waveClearInner(); }
  catch(e){
    reportErr(e);
    // страховка: волна должна завершиться даже при сбое — иначе игра встанет
    if (G.state === 'play'){
      G.waveState = 'prep';
      G.nextWave = buildWave(G.mapIdx, Math.min(G.wave+1, G.endless ? 9999 : WAVES_PER_MAP), G.endless);
      UI.refreshWaveUI();
    }
  }
}
function waveClearInner(){
  const bonus = Math.round((15 + G.wave*2) * metaVals().rewardMul);
  G.cash += bonus; S.stats.money += bonus;
  AudioSys.play('coin');
  const cx = V.ox+(G.core[0]+0.5)*V.cs, cy = V.oy+(G.core[1]+0.5)*V.cs;
  floater(cx, cy-30, '+$'+bonus, '#a8ff3e');
  if (G.leaksThisWave === 0){
    G.cleanStreak++;
    S.stats.bestCleanWave = Math.max(S.stats.bestCleanWave, G.cleanStreak);
  } else G.cleanStreak = 0;
  if (G.endless){
    const ms = mapSave(G.mapIdx);
    ms.best = Math.max(ms.best, G.wave);
    const mile = Math.floor(G.wave/10);
    if (mile > Math.floor(ms.milestone/10)){
      const k = mile - Math.floor(ms.milestone/10);
      addCores(k*5);
      ms.milestone = mile*10;
      UI.toast(t('t_core', { n:k*5 }));
    }
    persist(); checkAch();
    G.waveState = 'prep';
    G.nextWave = buildWave(G.mapIdx, G.wave+1, true);
  } else if (G.wave >= WAVES_PER_MAP){
    victory();
    return;
  } else {
    G.waveState = 'prep';
    G.nextWave = buildWave(G.mapIdx, G.wave+1, false);
    persist();
  }
  checkAch();
  UI.refreshWaveUI();
}

function victory(){
  try{
    G.state = 'won';
    const ms = mapSave(G.mapIdx);
    const beforeStars = totalStars();
    const lost = G.maxLives - G.lives;
    const stars = lost === 0 ? 3 : (lost <= 4 ? 2 : 1);
    const firstWin = ms.stars === 0;
    const earned = (firstWin ? 8 + 2*G.mapIdx : 0) + Math.max(0, stars - ms.stars)*3;
    ms.stars = Math.max(ms.stars, stars);
    if (earned > 0) addCores(earned);
    // что разблокировалось
    const newMaps = MAPS.map((m,i)=>i).filter(i=>MAPS[i].need > beforeStars && MAPS[i].need <= totalStars());
    const newTowers = TOWER_ORDER.filter(tp=>UNLOCK_STARS[tp] > beforeStars && UNLOCK_STARS[tp] <= totalStars() && UNLOCK_STARS[tp] > 0);
    persist(); checkAch();
    AudioSys.play('win');
    haptic('success');
    UI.openVictory({ stars, earned, firstWin, newMaps, newTowers });
  }catch(e){
    // победа не должна замораживать игру ни при каких условиях — рисуем минимальное окно напрямую
    reportErr(e);
    try{
      UI.modal(
        '<h3 class="lime">'+t('v_title')+'</h3>'+
        '<div class="m-btns">'+
        '<button class="btn primary big" id="fb-endless">'+t('v_endless_btn')+'</button>'+
        '<button class="btn big" id="fb-lab">'+t('v_lab')+'</button>'+
        '<button class="btn ghost big" id="fb-maps">'+t('v_maps')+'</button></div>',
        true
      );
      $('fb-endless').addEventListener('click', ()=>{ UI.closeModal(); startGame(G.mapIdx, true); });
      $('fb-lab').addEventListener('click', ()=>{ UI.closeModal(); UI.showScreen('lab'); });
      $('fb-maps').addEventListener('click', ()=>{ UI.closeModal(); UI.showScreen('maps'); UI.renderMaps(); });
    }catch(e2){ reportErr(e2); }
  }
}

function defeat(){
  if (G.state !== 'play') return;
  G.state = 'lost';
  if (G.endless){
    const ms = mapSave(G.mapIdx);
    ms.best = Math.max(ms.best, Math.max(0, G.wave-1));
  }
  persist(); checkAch();
  AudioSys.play('lose');
  haptic('error');
  UI.openDefeat();
}

/* ---------- Главный update партии ---------- */
function updateGame(rawDt){
  if (!G.active || G.state !== 'play') return;
  if (G.slowmoT > 0) G.slowmoT -= rawDt;
  const dt = rawDt * (G.slowmoT > 0 ? 0.3 : 1);
  G.time += dt;
  if (G.waveState === 'running'){
    G.waveT += dt;
    while (G.events.length && G.events[0].t <= G.waveT){
      const ev = G.events.shift();
      const e = spawnEnemy(ev.type, G.wave, G.map.mult, ev.path, ev.mut, 0, ev.variant);
      if (e && e.boss) G.shake(8);
    }
  }
  updateEnemies(dt);
  updateTowers(dt);
  updateBullets(dt);
  updateFx(dt);
  if (G.waveState === 'running' && G.events.length === 0 && G.enemiesCount === 0) waveClear();
  G.coreFlash = Math.max(0, G.coreFlash - dt*1.4);
  if (G.shakeT > 0){ G.shakeT -= rawDt; if (G.shakeT <= 0) G.shakeAmp = 0; }
  // способности: перезарядка и активный эффект (в реальном времени, без слоу-мо)
  for (const k in G.abil){
    if (G.abil[k].cd > 0) G.abil[k].cd = Math.max(0, G.abil[k].cd - rawDt);
  }
  if (G.abil.over.active > 0) G.abil.over.active = Math.max(0, G.abil.over.active - rawDt);
  if (G.coreCharge >= 100) coreNova();
  // автостарт волн
  if (S.auto && G.waveState === 'prep' && G.state === 'play'){
    if (G.autoT > 0){ G.autoT -= rawDt; if (G.autoT <= 0) startWave(); }
    else G.autoT = 1.2;
  } else G.autoT = 0;
}
G.shake = function(amp){
  if (amp > G.shakeAmp) G.shakeAmp = amp;
  G.shakeT = 0.3;
};

/* Нова ядра: разряд накопленного заряда по всем вирусам на поле */
function coreNova(){
  try{
  G.coreCharge = 0;
  const cx = V.ox+(G.core[0]+0.5)*V.cs, cy = V.oy+(G.core[1]+0.5)*V.cs;
  ring(cx, cy, '#9ef7ff', 10, 14*V.cs, 0.7, 4);
  ring(cx, cy, '#00e5ff', 6, 11*V.cs, 0.5, 2);
  AudioSys.play('nova');
  G.shake(10);
  floater(cx, cy-40, t('nova'), '#9ef7ff', true);
  for (const e of EP){
    if (!e.alive || e.dead) continue;
    damage(e, e.maxhp*0.10 + 15, 99, true);
  }
  }catch(e){ reportErr(e); }
}

/* ---- Способности ---- */
function castEmp(c, r){
  const ab = G.abil.emp;
  if (ab.cd > 0 || G.state !== 'play'){ AudioSys.play('error'); return; }
  ab.cd = ABILITIES.emp.cd;
  G.targeting = null;
  const cx = c+0.5, cy = r+0.5;
  const r2 = ABILITIES.emp.radius*ABILITIES.emp.radius;
  let hit = 0;
  for (const e of EP){
    if (!e.alive || e.dead) continue;
    if (dist2(cx, cy, e.x, e.y) <= r2){
      e.stunT = ABILITIES.emp.stun*(e.boss ? 0.5 : 1);
      hit++;
    }
  }
  const px = V.ox+cx*V.cs, py = V.oy+cy*V.cs;
  ring(px, py, '#7df9ff', 6, ABILITIES.emp.radius*V.cs, 0.5, 3);
  burst(px, py, '#7df9ff', 16, 200, 0.4);
  AudioSys.play('emp');
  G.shake(4);
  floater(px, py, hit ? 'STUN ×'+hit : '—', '#7df9ff');
}
function activateOver(){
  const ab = G.abil.over;
  if (ab.cd > 0 || G.state !== 'play'){ AudioSys.play('error'); return; }
  ab.cd = ABILITIES.over.cd;
  ab.active = ABILITIES.over.dur;
  AudioSys.play('over');
  G.shake(3);
  for (const tw of G.towers) ring(V.ox+tw.x*V.cs, V.oy+tw.y*V.cs, '#ffb020', 4, V.cs*0.7, 0.4, 2);
}

/* ==================== РЕНДЕР ==================== */
function strokePoly(c, pts){
  c.beginPath();
  pts.forEach((p,i)=> i ? c.lineTo(p[0],p[1]) : c.moveTo(p[0],p[1]));
  c.stroke();
}

function renderBoardBG(){
  if (!G.active || !G.map || !V.w) return;
  const BL = 24; // запас под тряску, рисуется 1:1 — сетка не растягивается
  boardBG = document.createElement('canvas');
  boardBG.width = Math.max(1, Math.round((V.w+BL*2)*V.dpr));
  boardBG.height = Math.max(1, Math.round((V.h+BL*2)*V.dpr));
  const c = boardBG.getContext('2d');
  c.scale(V.dpr, V.dpr);
  c.translate(BL, BL);
  V.w += BL*2; V.h += BL*2;      // рисуем расширенный фон
  drawBGContent(c);
  V.w -= BL*2; V.h -= BL*2;      // возвращаем рабочие размеры
}

function drawBGContent(c){
  const Vw = V.w + 48, Vh = V.h + 48; // покрытие с запасом за края экрана
  {
  // фон
  const g = c.createLinearGradient(0,0,V.w,V.h);
  g.addColorStop(0,'#070b18'); g.addColorStop(0.5,'#05070f'); g.addColorStop(1,'#0a0f22');
  c.fillStyle = g; c.fillRect(0,0,V.w,V.h);
  // сетка
  c.strokeStyle = 'rgba(0,229,255,0.05)'; c.lineWidth = 1;
  for (let i=0;i<=G.cols;i++){ c.beginPath(); c.moveTo(V.ox+i*V.cs, V.oy); c.lineTo(V.ox+i*V.cs, V.oy+G.rows*V.cs); c.stroke(); }
  for (let j=0;j<=G.rows;j++){ c.beginPath(); c.moveTo(V.ox, V.oy+j*V.cs); c.lineTo(V.ox+G.cols*V.cs, V.oy+j*V.cs); c.stroke(); }
  c.strokeStyle = 'rgba(0,229,255,0.16)';
  c.strokeRect(V.ox, V.oy, G.cols*V.cs, G.rows*V.cs);
  // клетки пути
  c.fillStyle = 'rgba(0,229,255,0.05)';
  for (const k of G.pathCells){
    const [cc,cr] = k.split(',').map(Number);
    rr(c, V.ox+cc*V.cs+1.5, V.oy+cr*V.cs+1.5, V.cs-3, V.cs-3, 4); c.fill();
  }
  // трасса
  c.lineJoin = 'round'; c.lineCap = 'round';
  for (const px of G.pathPxs){
    c.strokeStyle = 'rgba(2,6,14,0.92)'; c.lineWidth = V.cs*0.52; strokePoly(c, px);
    c.strokeStyle = hexA(G.map.color, 0.25); c.lineWidth = V.cs*0.4; strokePoly(c, px);
    c.strokeStyle = hexA(G.map.color, 0.7); c.lineWidth = 1.5; strokePoly(c, px);
  }
  // декорации: серверные блоки
  for (const k of G.deco){
    const [cc,cr] = k.split(',').map(Number);
    const x = V.ox+cc*V.cs+V.cs*0.14, y = V.oy+cr*V.cs+V.cs*0.14, w = V.cs*0.72, h = V.cs*0.72;
    c.fillStyle = 'rgba(10,18,38,0.95)'; rr(c,x,y,w,h,3); c.fill();
    c.strokeStyle = 'rgba(0,229,255,0.18)'; c.lineWidth = 1; c.stroke();
    c.strokeStyle = 'rgba(0,229,255,0.25)';
    for (let i=1;i<4;i++){ c.beginPath(); c.moveTo(x+w*0.15, y+h*i/4); c.lineTo(x+w*0.85, y+h*i/4); c.stroke(); }
  }
  // фоновые «узлы данных» на свободных клетках — детализируют поле, детерминированно по клетке
  c.fillStyle = 'rgba(0,229,255,0.10)';
  for (let cc=0; cc<COLS; cc++){
    for (let cr=0; cr<ROWS; cr++){
      const k = cc+','+cr;
      if (G.pathCells.has(k) || G.deco.has(k)) continue;
      if (((cc*7 + cr*13) % 5) !== 0) continue;
      const x = V.ox+(cc+0.5)*V.cs, y = V.oy+(cr+0.5)*V.cs;
      c.beginPath(); c.arc(x, y, Math.max(1.5, V.cs*0.045), 0, TAU); c.fill();
    }
  }
  }
}

/* Пульсирующие площадки стройки — заметны на любом фоне */
function drawBuildPads(ctx){
  const pulse = 0.28 + 0.16*Math.sin(G.time*2.4);
  ctx.save();
  ctx.strokeStyle = 'rgba(0,229,255,'+pulse.toFixed(3)+')';
  ctx.lineWidth = 1.5;
  const corner = Math.max(3, V.cs*0.18);
  for (const k of G.buildable){
    if (G.towerGrid.has(k)) continue;
    const x = V.ox + Number(k.split(',')[0])*V.cs + 3;
    const y = V.oy + Number(k.split(',')[1])*V.cs + 3;
    const sz = V.cs - 6;
    rr(ctx, x, y, sz, sz, 4); ctx.stroke();
    ctx.fillStyle = 'rgba(0,229,255,'+(pulse*0.5).toFixed(3)+')';
    ctx.fillRect(x+sz/2-1.5, y+sz/2-1.5, 3, 3);
    if (!S.lowgfx){
      ctx.strokeStyle = 'rgba(0,229,255,'+(pulse*1.4).toFixed(3)+')';
      ctx.beginPath();
      ctx.moveTo(x, y+corner); ctx.lineTo(x, y); ctx.lineTo(x+corner, y);
      ctx.moveTo(x+sz-corner, y); ctx.lineTo(x+sz, y); ctx.lineTo(x+sz, y+corner);
      ctx.moveTo(x+sz, y+sz-corner); ctx.lineTo(x+sz, y+sz); ctx.lineTo(x+sz-corner, y+sz);
      ctx.moveTo(x+corner, y+sz); ctx.lineTo(x, y+sz); ctx.lineTo(x, y+sz-corner);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,229,255,'+pulse.toFixed(3)+')';
    }
  }
  ctx.restore();
}

function drawPathFlow(ctx){
  ctx.save();
  ctx.strokeStyle = hexA(G.map.color, 0.55);
  ctx.lineWidth = Math.max(2, V.cs*0.055);
  ctx.lineCap = 'round';
  ctx.setLineDash([V.cs*0.22, V.cs*0.38]);
  ctx.lineDashOffset = -G.time*V.cs*1.1;
  for (const px of G.pathPxs) strokePoly(ctx, px);
  ctx.restore();
}

function drawPortals(ctx){
  G.paths.forEach((pts, i)=>{
    const cell = pts.find(p=>p[0]>=0 && p[0]<COLS && p[1]>=0 && p[1]<ROWS) || pts[0];
    const cx = V.ox+(cell[0]+0.5)*V.cs, cy = V.oy+(cell[1]+0.5)*V.cs;
    const t = G.time*2 + i*2.1;
    drawGlow(ctx, cx, cy, V.cs*0.5, G.map.color, 0.35);
    ctx.strokeStyle = hexA(G.map.color, 0.85); ctx.lineWidth = 2;
    for (let k=0;k<2;k++){
      ctx.beginPath(); ctx.arc(cx, cy, V.cs*(0.26+k*0.12), t+k*2, t+k*2+2.2); ctx.stroke();
    }
  });
}

function drawCore(ctx){
  const cx = V.ox+(G.core[0]+0.5)*V.cs, cy = V.oy+(G.core[1]+0.5)*V.cs;
  const pulse = 1 + Math.sin(G.time*3)*0.06;
  drawGlow(ctx, cx, cy, V.cs*1.05*pulse, '#00e5ff', 0.5 + G.coreFlash*0.5);
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(G.time*0.7);
  ctx.strokeStyle = hexA('#00e5ff', 0.9); ctx.lineWidth = 2;
  for (let i=0;i<3;i++){
    ctx.rotate(TAU/3);
    ctx.beginPath(); ctx.arc(0, 0, V.cs*0.52, 0.15, 1.35); ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, V.cs*0.24*pulse, 0, TAU);
  ctx.fillStyle = G.coreFlash > 0 ? hexA('#ff3355', 0.4+G.coreFlash*0.6) : '#9ef7ff';
  ctx.fill();
  const frac = clamp(G.lives/G.maxLives, 0, 1);
  ctx.beginPath(); ctx.arc(cx, cy, V.cs*0.66, -TAU/4, -TAU/4 + TAU*frac);
  ctx.strokeStyle = frac > 0.5 ? '#a8ff3e' : (frac > 0.25 ? '#ffb020' : '#ff3355');
  ctx.lineWidth = 3; ctx.stroke();
  // дуга заряда новы
  const ch = clamp((G.coreCharge||0)/100, 0, 1);
  if (ch > 0){
    ctx.beginPath(); ctx.arc(cx, cy, V.cs*0.42, -TAU/4, -TAU/4 + TAU*ch);
    ctx.strokeStyle = 'rgba(158,247,255,'+(ch >= 1 ? 1 : 0.75)+')';
    ctx.lineWidth = 2.5; ctx.stroke();
  }
}

function drawEnemies(ctx){
  // проход 1: все глоу-спрайты одним композитным окном (дешевле, чем save/restore на каждого)
  if (!S.lowgfx){
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const e of EP){
      if (!e.alive || e.dead) continue;
      const px = V.ox+e.x*V.cs, py = V.oy+e.y*V.cs;
      let col = e.mut ? MUT[e.mut].color : e.def.color;
      if (G.curWave && G.curWave.mod === 'gold' && !e.boss) col = WAVE_MODS.gold.color;
      const s = e.def.r*V.cs*1.7;
      ctx.globalAlpha = e.phased ? 0.1 : 0.35;
      ctx.drawImage(glowSprite(col), px-s, py-s, s*2, s*2);
    }
    ctx.restore();
  }
  // проход 2: фигуры, щиты, полоски HP
  const goldWave = G.curWave && G.curWave.mod === 'gold';
  for (const e of EP){
    if (!e.alive || e.dead) continue;
    const px = V.ox+e.x*V.cs, py = V.oy+e.y*V.cs;
    let col = e.mut ? MUT[e.mut].color : e.def.color;
    if (goldWave && !e.boss) col = WAVE_MODS.gold.color; // золотая волна перекрашивает рой
    const R = e.def.r*V.cs;
    const alpha = e.phased ? 0.22 : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    drawEnemyShape(ctx, e.def.shape, px, py, R, e.ang, e.hitF > 0 ? '#ffffff' : col, Math.max(1.5, V.cs*0.055), G.time, e.id);
    // мерцающий двигатель позади
    const thx = px - Math.cos(e.ang)*R*1.15, thy = py - Math.sin(e.ang)*R*1.15;
    ctx.globalAlpha = alpha * (0.25 + 0.35*Math.abs(Math.sin(G.time*13 + e.id)));
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(thx, thy, Math.max(1.2, R*0.14), 0, TAU); ctx.fill();
    ctx.globalAlpha = alpha;
    if (e.stunT > 0 && Math.random() < 0.35) burst(px, py - R, '#ffd12d', 1, 45, 0.3);
    // пузырьки яда
    if (e.poisonS > 0){
      ctx.fillStyle = hexA('#c8ff00', 1);
      for (let i=0;i<Math.min(3, 1+Math.floor(e.poisonS/3));i++){
        const ph = (G.time*1.4 + i*0.37 + (e.id%7)*0.13) % 1;
        ctx.globalAlpha = alpha * (1-ph) * 0.8;
        ctx.beginPath();
        ctx.arc(px + Math.sin((e.id+i)*2.6)*R*0.4, py - R*0.4 - ph*R*1.4, 1.5+ph*2.2, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = alpha;
    }
    if (e.shield > 0){
      ctx.strokeStyle = hexA('#4dc3ff', 0.85); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px, py, R*1.4, -TAU/4, -TAU/4 + TAU*(e.shield/e.maxshield)); ctx.stroke();
    }
    ctx.restore();
    if (e.hp < e.maxhp - 0.5 && !e.boss){
      const w = V.cs*0.6, h = 3, frac = clamp(e.hp/e.maxhp, 0, 1);
      const bx = px-w/2, by = py-R-9;
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx, by, w, h);
      ctx.fillStyle = frac > 0.5 ? '#a8ff3e' : (frac > 0.25 ? '#ffb020' : '#ff3355');
      ctx.fillRect(bx, by, w*frac, h);
    }
  }
}

function drawTowers(ctx){
  // линии усиления Амплиферов
  for (const a of G.towers){
    if (TOWERS[a.type].kind !== 'amp') continue;
    const alv = lvOf(a);
    const r2 = alv.range*alv.range;
    ctx.save();
    ctx.globalAlpha = 0.22 + 0.1*Math.sin(G.time*3);
    ctx.strokeStyle = TOWERS.amp.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([3,5]);
    for (const tw of G.towers){
      if (tw === a || TOWERS[tw.type].kind === 'amp') continue;
      if (dist2(a.x, a.y, tw.x, tw.y) > r2) continue;
      ctx.beginPath();
      ctx.moveTo(V.ox+a.x*V.cs, V.oy+a.y*V.cs);
      ctx.lineTo(V.ox+tw.x*V.cs, V.oy+tw.y*V.cs);
      ctx.stroke();
    }
    ctx.restore();
  }
  for (const tw of G.towers){
    const px = V.ox+tw.x*V.cs, py = V.oy+tw.y*V.cs;
    const def = TOWERS[tw.type];
    if (tw.stun > 0 && Math.random() < 0.25) burst(px, py, '#ffd12d', 1, 60, 0.3);
    drawTowerAt(ctx, tw.type, tw.lvl+1, px, py, V.cs, tw.aim, def.color);
    // метка выбранной специализации
    if (tw.branch){
      ctx.font = '700 10px Consolas,monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(5,8,18,0.85)';
      ctx.fillRect(px+V.cs*0.16, py-V.cs*0.46, 13, 12);
      ctx.fillStyle = def.color;
      ctx.fillText(tw.branch.toUpperCase(), px+V.cs*0.16+6.5, py-V.cs*0.46+9.5);
    }
    if (tw.stun > 0){
      ctx.strokeStyle = 'rgba(255,209,45,0.7)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px, py, V.cs*0.44, 0, TAU); ctx.stroke();
    }
    // подсветка активной Перегрузки
    if (G.abil.over.active > 0){
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.3*Math.sin(G.time*8);
      ctx.strokeStyle = '#ffb020'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px, py, V.cs*0.5, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }
}

function drawRange(ctx, px, py, range, color){
  ctx.save();
  ctx.fillStyle = hexA(color, 0.06);
  ctx.beginPath(); ctx.arc(px, py, range*V.cs, 0, TAU); ctx.fill();
  ctx.strokeStyle = hexA(color, 0.55); ctx.lineWidth = 1.5;
  ctx.setLineDash([6,6]); ctx.stroke();
  ctx.restore();
}

function drawBulletsFx(ctx){
  // маркер точки прилёта мортиры
  for (const b of BP){
    if (!b.alive || b.arcT === undefined) continue;
    const mx = V.ox+b.lx*V.cs, my = V.oy+b.ly*V.cs;
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = b.color; ctx.lineWidth = 1.5;
    ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.arc(mx, my, b.rad*V.cs, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  // ракеты
  for (const b of BP){
    if (!b.alive) continue;
    if (b.arcT !== undefined){
      const px = V.ox+b.x*V.cs;
      const py = V.oy+(b.y - b.h)*V.cs; // высота дуги
      drawGlow(ctx, px, py, 6, b.color, 0.9);
      ctx.fillStyle = '#fff';
      ctx.fillRect(px-2, py-2, 4, 4);
      continue;
    }
    const px = V.ox+b.x*V.cs, py = V.oy+b.y*V.cs;
    const qx = V.ox+b.px*V.cs, qy = V.oy+b.py*V.cs;
    ctx.strokeStyle = hexA(b.color, 0.6); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(qx, qy); ctx.lineTo(px, py); ctx.stroke();
    drawGlow(ctx, px, py, 5, b.color, 0.9);
    ctx.fillStyle = '#fff'; ctx.fillRect(px-1.5, py-1.5, 3, 3);
  }
  // трассы и молнии
  for (const tr of TX){
    if (!tr.alive) continue;
    const k = 1 - tr.t/tr.ttl;
    ctx.save();
    ctx.globalAlpha = k;
    ctx.strokeStyle = tr.color; ctx.lineWidth = tr.width;
    if (tr.kind === 'tracer'){
      ctx.beginPath(); ctx.moveTo(tr.x1, tr.y1); ctx.lineTo(tr.x2, tr.y2); ctx.stroke();
    } else {
      zapPath(ctx, tr.pts[0][0], tr.pts[0][1], tr.pts[tr.pts.length-1][0], tr.pts[tr.pts.length-1][1], 7);
      // ломаная через все точки цепи
      ctx.beginPath();
      for (let i=0;i<tr.pts.length-1;i++){
        const a = tr.pts[i], b2 = tr.pts[i+1];
        ctx.moveTo(a[0], a[1]);
        const segs = 4;
        for (let s=1;s<segs;s++){
          const kk = s/segs;
          ctx.lineTo(lerp(a[0],b2[0],kk)+rnd(-6,6), lerp(a[1],b2[1],kk)+rnd(-6,6));
        }
        ctx.lineTo(b2[0], b2[1]);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  // частицы
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of PP){
    if (!p.alive) continue;
    const k = p.t/p.ttl;
    if (p.kind === 'spark'){
      ctx.globalAlpha = 1-k;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x-p.size/2, p.y-p.size/2, p.size, p.size);
    } else {
      ctx.globalAlpha = (1-k)*0.9;
      ctx.strokeStyle = p.color; ctx.lineWidth = p.width;
      ctx.beginPath(); ctx.arc(p.x, p.y, lerp(p.size, p.r1, k), 0, TAU); ctx.stroke();
    }
  }
  ctx.restore();
  // лучи башен (поверх)
  for (const tw of G.towers){
    if (TOWERS[tw.type].kind !== 'beam' || !tw.targetRef) continue;
    const e = tw.targetRef;
    if (!e.alive || e.dead) continue;
    const px = V.ox+tw.x*V.cs, py = V.oy+tw.y*V.cs;
    const ex = V.ox+e.x*V.cs, ey = V.oy+e.y*V.cs;
    const w = 2 + Math.sin(G.time*20)*0.8 + tw.exposure*0.8;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = hexA(TOWERS.beam.color, 0.35); ctx.lineWidth = w*2.4;
    ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(ex,ey); ctx.stroke();
    ctx.strokeStyle = '#ffd9b0'; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(ex,ey); ctx.stroke();
    ctx.restore();
  }
  // всплывающий текст
  for (const f of FP){
    if (!f.alive) continue;
    const k = f.t/f.ttl;
    ctx.save();
    ctx.globalAlpha = 1-k*k;
    ctx.fillStyle = f.color;
    ctx.font = (f.big ? 700 : 600)+' '+Math.round(f.big ? V.cs*0.34 : V.cs*0.24)+'px Consolas,monospace';
    ctx.textAlign = 'center';
    ctx.fillText(f.txt, f.x, f.y - 34*k);
    ctx.restore();
  }
}

function drawGhostAndSelection(ctx){
  if (G.selected && !G.towers.includes(G.selected)) G.selected = null;
  if (G.selected){
    const tw = G.selected, def = TOWERS[tw.type], lv = lvOf(tw);
    drawRange(ctx, V.ox+tw.x*V.cs, V.oy+tw.y*V.cs, lv.range, def.color);
  }
  // прицел ЭМИ-импульса
  if (G.targeting === 'emp' && G.hoverCell){
    const [c,r] = G.hoverCell;
    const px = V.ox+(c+0.5)*V.cs, py = V.oy+(r+0.5)*V.cs;
    const rad = ABILITIES.emp.radius*V.cs;
    const pulse = 1 + 0.05*Math.sin(G.time*6);
    ctx.save();
    ctx.fillStyle = hexA('#7df9ff', 0.07);
    ctx.beginPath(); ctx.arc(px, py, rad*pulse, 0, TAU); ctx.fill();
    ctx.strokeStyle = hexA('#7df9ff', 0.8); ctx.lineWidth = 2;
    ctx.setLineDash([8,6]);
    ctx.lineDashOffset = -G.time*30;
    ctx.beginPath(); ctx.arc(px, py, rad*pulse, 0, TAU); ctx.stroke();
    ctx.restore();
    if (G.abil.emp.cd > 0){
      ctx.fillStyle = 'rgba(255,51,85,0.8)';
      ctx.font = '700 13px Consolas,monospace';
      ctx.textAlign = 'center';
      ctx.fillText(Math.ceil(G.abil.emp.cd)+'s', px, py - rad - 8);
    }
  }
  // наведение на установленную башню: слабое кольцо + подпись
  if (!G.placing && !G.selected && G.hoverCell){
    const h = towerAt(G.hoverCell[0], G.hoverCell[1]);
    if (h){
      const def = TOWERS[h.type], lv = lvOf(h);
      const px = V.ox+h.x*V.cs, py = V.oy+h.y*V.cs;
      ctx.save();
      ctx.globalAlpha = 0.5;
      drawRange(ctx, px, py, lv.range, def.color);
      ctx.restore();
      const label = t(def.key)+' · '+t('lvl_short')+' '+(h.lvl+1);
      ctx.font = '600 12px Consolas,monospace';
      ctx.textAlign = 'center';
      const w = ctx.measureText(label).width + 14;
      const ly = clamp(py - V.cs*0.55 - 22, 6, V.h - 24);
      ctx.fillStyle = 'rgba(5,8,18,0.85)';
      rr(ctx, px-w/2, ly, w, 18, 5); ctx.fill();
      ctx.strokeStyle = hexA(def.color, 0.5); ctx.lineWidth = 1;
      rr(ctx, px-w/2, ly, w, 18, 5); ctx.stroke();
      ctx.fillStyle = def.color;
      ctx.fillText(label, px, ly+13);
    }
  }
  if ((G.placing || G.dragPlacing) && G.hoverCell){
    const placingType = G.placing || G.dragPlacing;
    const [c,r] = G.hoverCell;
    const def = TOWERS[placingType], lv = def.lv[0];
    const ok = canPlace(c,r) && G.cash >= def.cost;
    const px = V.ox+(c+0.5)*V.cs, py = V.oy+(r+0.5)*V.cs;
    drawRange(ctx, px, py, lv.range, ok ? def.color : '#ff3355');
    ctx.save(); ctx.globalAlpha = 0.6;
    drawTowerAt(ctx, placingType, 1, px, py, V.cs, -TAU/8, ok ? def.color : '#ff3355');
    ctx.restore();
    if (ok){
      ctx.strokeStyle = hexA(def.color, 0.8); ctx.lineWidth = 1.5;
      ctx.strokeRect(V.ox+c*V.cs+1.5, V.oy+r*V.cs+1.5, V.cs-3, V.cs-3);
    } else {
      ctx.strokeStyle = 'rgba(255,51,85,0.8)'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px-V.cs*0.2, py-V.cs*0.2); ctx.lineTo(px+V.cs*0.2, py+V.cs*0.2);
      ctx.moveTo(px+V.cs*0.2, py-V.cs*0.2); ctx.lineTo(px-V.cs*0.2, py+V.cs*0.2);
      ctx.stroke();
    }
  }
}

function renderGame(){
  if (!G.active) return;
  const ctx = bctx;
  ctx.setTransform(V.dpr, 0, 0, V.dpr, 0, 0);
  // сброс состояния: сбой в прошлом кадре не должен «протекать» в этот
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);
  let sx = 0, sy = 0;
  if (G.shakeT > 0){
    const k = (G.shakeT/0.3)*G.shakeAmp;
    sx = rnd(-k,k); sy = rnd(-k,k);
  }
  ctx.save();
  try{
    ctx.translate(sx, sy);
    // фон непрозрачный, нарисован с запасом и накладывается 1:1 — сетка не плывёт.
    // ОБЯЗАТЕЛЬНО со смещением камеры, иначе трасса остаётся на месте при панораме
    if (boardBG) ctx.drawImage(boardBG, V.ox-24, V.oy-24, (V.w+48), (V.h+48));
    drawPathFlow(ctx);
    drawPortals(ctx);
    drawCore(ctx);
    drawBuildPads(ctx);
    drawEnemies(ctx);
    drawTowers(ctx);
    drawBulletsFx(ctx);
    drawGhostAndSelection(ctx);
  } finally {
    ctx.restore();
  }
}
