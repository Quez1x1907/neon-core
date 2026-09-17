/* ==================== Сущности: пулы объектов (без GC-мусора в цикле) ==================== */

/* ---- Пул врагов ---- */
const EP = [];
const EP_MAX = 220;
let UID = 0;
function initPools(){
  EP.length = 0;
  for (let i=0;i<EP_MAX;i++) EP.push({ alive:false, id:0, type:'', def:null, pathIdx:0, pts:null, len:0,
    dist:0, x:0, y:0, ang:0, hp:1, maxhp:1, armor:0, speed:1, baseSpeed:1, slowF:0, slowT:0,
    shield:0, maxshield:0, shieldT:99, phased:false, phaseT:0, healT:0, healAmt:0, hitF:0,
    mut:null, variant:null, reward:0, boss:false, dead:false });
  BP.length = 0;
  for (let i=0;i<120;i++) BP.push({ alive:false });
  PP.length = 0;
  for (let i=0;i<700;i++) PP.push({ alive:false });
  FP.length = 0;
  for (let i=0;i<80;i++) FP.push({ alive:false });
  TX.length = 0;
  for (let i=0;i<70;i++) TX.push({ alive:false });
}
function epGet(){
  for (let i=0;i<EP_MAX;i++){ const e = EP[epIdx]; epIdx = (epIdx+1)%EP_MAX; if (!e.alive) return e; }
  return null;
}
let epIdx = 0;

/* ---- Спавн врага. mut — ключ мутации или null ---- */
function spawnEnemy(type, wave, mult, pathIdx, mut, atDist, variant){
  const def = ENEMIES[type];
  const e = epGet();
  if (!e) return null; // пул переполнен — пропускаем (не должно происходить)
  const hpMul = hpMulFor(wave, mult);
  e.alive = true; e.dead = false; e.id = ++UID;
  e.type = type; e.def = def; e.boss = !!def.boss;
  e.variant = (variant === null || variant === undefined) ? null : variant;
  e.pathIdx = pathIdx; e.pts = G.paths[pathIdx]; e.len = e.pts.length-1;
  e.maxhp = def.hp*hpMul*(mut && MUT[mut].hp ? MUT[mut].hp : 1)*(variant && BOSSES[variant].hpM ? BOSSES[variant].hpM : 1);
  e.hp = e.maxhp;
  e.armor = (variant && BOSSES[variant].armor !== undefined ? BOSSES[variant].armor : (def.armor||0))
          + (mut==='hard' ? MUT.hard.armor : 0)
          + (G.curWave && G.curWave.mod === 'armor' ? WAVE_MODS.armor.armor : 0);
  e.baseSpeed = def.speed*(mut==='swift' ? MUT.swift.spd : 1)*(variant && BOSSES[variant].spdM ? BOSSES[variant].spdM : 1)
          * (G.curWave && G.curWave.mod === 'storm' ? WAVE_MODS.storm.spd : 1);
  e.speed = e.baseSpeed;
  e.stunT = 0;
  e.mut = mut||null;
  e.dist = atDist||0;
  e.slowF = 0; e.slowT = 0;
  e.maxshield = def.shield ? def.shield*Math.sqrt(hpMul) : 0; // щит растёт медленнее HP — иначе поздние волны «запираются»
  e.shield = e.maxshield; e.shieldT = 99;
  e.phased = false; e.phaseT = def.phase ? rnd(1, def.phase.every*0.6) : 0;
  e.healT = def.heal ? def.heal.per*0.5 : 0;
  e.healAmt = def.heal ? def.heal.amt*Math.sqrt(hpMul) : 0;
  e.poisonS = 0; e.poisonT = 0; e.poisonDps = 0; e.poisonAcid = false;
  e.hitF = 0;
  e.reward = def.reward*(1+(wave-1)*0.02);
  const p = posAt(e.pts, e.dist);
  e.x = p.x; e.y = p.y; e.ang = p.ang;
  if (e.boss){ UI.bossShow(e); }
  return e;
}

/* Позиция вдоль пути (pts — массив клеток [c,r]) */
function posAt(pts, d){
  const i = clamp(Math.floor(d), 0, pts.length-2);
  const f = clamp(d - i, 0, 1);
  const a = pts[i], b = pts[i+1];
  return { x: lerp(a[0], b[0], f)+0.5, y: lerp(a[1], b[1], f)+0.5, ang: Math.atan2(b[1]-a[1], b[0]-a[0]) };
}

/* ---- Пул пуль (ракеты) ---- */
const BP = [];
function bpGet(){ for (let i=0;i<BP.length;i++){ if (!BP[i].alive) return BP[i]; } return null; }

/* ---- Пул частиц ---- */
const PP = [];
function ppGet(){ for (let i=0;i<PP.length;i++){ if (!PP[i].alive) return PP[i]; } return null; }
/* Вспышка частиц (в px-координатах) */
function burst(px, py, color, n, spd, life){
  if (S.lowgfx) n = Math.ceil(n/2); // слабый режим — вдвое меньше частиц
  const free = PP.reduce((a,p)=>a+(p.alive?0:1), 0); // защита от переполнения: режем количество
  n = Math.min(n, Math.floor(free*0.4), 40);
  for (let i=0;i<n;i++){
    const p = ppGet(); if (!p) return;
    const a = rnd(TAU), v = rnd(spd*0.3, spd);
    p.alive = true; p.x = px; p.y = py;
    p.vx = Math.cos(a)*v; p.vy = Math.sin(a)*v;
    p.t = 0; p.ttl = rnd(life*0.5, life); p.color = color; p.size = rnd(1.5, 3.5);
    p.kind = 'spark';
  }
}
function ring(px, py, color, r0, r1, ttl, width){
  const p = ppGet(); if (!p) return;
  p.alive = true; p.x = px; p.y = py; p.vx = 0; p.vy = 0;
  p.t = 0; p.ttl = ttl; p.color = color; p.size = r0; p.r1 = r1; p.width = width||2; p.kind = 'ring';
}

/* ---- Всплывающий текст ---- */
const FP = [];
function floater(px, py, txt, color, big){
  for (let i=0;i<FP.length;i++){
    const f = FP[i];
    if (!f.alive){
      f.alive = true; f.x = px; f.y = py; f.txt = txt; f.color = color;
      f.t = 0; f.ttl = big ? 1.6 : 1.1; f.big = !!big;
      return;
    }
  }
}

/* ---- Трассы выстрелов и молнии ---- */
const TX = [];
function tracer(x1,y1,x2,y2,color,ttl,width){
  for (let i=0;i<TX.length;i++){
    const tr = TX[i];
    if (!tr.alive || tr.kind==='tracer'){
      tr.alive = true; tr.kind = 'tracer';
      tr.x1=x1; tr.y1=y1; tr.x2=x2; tr.y2=y2; tr.color=color; tr.t=0; tr.ttl=ttl||0.12; tr.width=width||2;
      return;
    }
  }
}
function zapFx(pts, color){
  for (let i=0;i<TX.length;i++){
    const tr = TX[i];
    if (!tr.alive || tr.kind==='zap'){
      tr.alive = true; tr.kind = 'zap'; tr.pts = pts; tr.color = color; tr.t = 0; tr.ttl = 0.18; tr.width = 2;
      return;
    }
  }
}

/* ==================== Боевая математика ==================== */
/* Множитель HP волны: карта × экспонента волны.
   Прогрев: на дорогих картах (большая mult) сложность разгоняется к 10-й волне,
   иначе первые волны непомерно жёсткие. */
function hpMulFor(wave, mult){
  const warm = 0.55 + 0.45*Math.min(wave,10)/10;
  return (1 + (mult-1)*warm) * Math.pow(1.128, wave-1) * (1 + 0.03*wave);
}
/* Награда с учётом карты и мета-прокачки. Экономика строже: множитель 0.7,
   а после 10-й волны награда затухает (−4% за волну) — иначе к концу копится мешок денег */
function rewardMulFor(wave, mult){
  const decay = wave <= 10 ? 1 : Math.pow(0.96, wave-10);
  return 0.7 * decay * (1 + (wave-1)*0.02) * (0.6 + 0.4*mult) * metaVals().rewardMul;
}

/* Нанесение урона: armor гасит, pierce пробивает, щит впитывает. src — тип источника для статистики */
function damage(e, amount, pierce, silent, src){
  if (!e.alive || e.dead) return;
  if (e.phased) return; // фантом вне фазы неуязвим
  let armor = Math.max(0, e.armor - (pierce||0));
  if (e.poisonAcid) armor = Math.max(0, armor - 3); // кислота Токсина разъедает броню
  let dmg = Math.max(1, amount - armor);
  if (e.shield > 0){
    const s = Math.min(e.shield, dmg);
    e.shield -= s; dmg -= s; e.shieldT = 0;
  }
  if (dmg > 0){
    e.hp -= dmg; e.hitF = 0.12;
    if (src && G.dmgByType) G.dmgByType[src] = (G.dmgByType[src]||0) + dmg;
  }
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e){
  if (e.dead) return;
  e.dead = true; e.alive = false;
  const px = V.ox + e.x*V.cs, py = V.oy + e.y*V.cs;
  const color = e.mut ? MUT[e.mut].color : e.def.color;
  burst(px, py, color, e.boss ? 42 : 10, e.boss ? 260 : 150, 0.5);
  ring(px, py, color, 4, e.boss ? 90 : e.def.r*V.cs*2.2, e.boss ? 0.6 : 0.3, e.boss ? 3 : 2);
  const goldMul = (G.curWave && G.curWave.mod === 'gold') ? WAVE_MODS.gold.reward : 1;
  const money = Math.round(e.reward * rewardMulFor(G.wave, G.map.mult) * goldMul);
  G.cash += money; S.stats.money += money;
  S.stats.kills++;
  // заряд ядра: убийства копят нову
  G.coreCharge = Math.min(100, (G.coreCharge||0) + (e.boss ? 40 : 5));
  AudioSys.play(e.boss ? 'boom' : 'hit');
  if (e.boss){
    S.stats.bosses++;
    G.shake(14); G.slowmoT = 0.9;
    floater(px, py, '+$'+money, '#a8ff3e', true);
    UI.bossHide();
    // Гидра распадается на дронов (значения читаем до переиспользования слота пула)
    if (e.variant === 'hydra' && BOSSES.hydra.split){
      const d0 = e.dist, pIdx = e.pathIdx, wv = G.wave, ml = G.map.mult;
      for (let i=0;i<BOSSES.hydra.split;i++)
        spawnEnemy('drone', wv, ml, pIdx, null, Math.max(0, d0 - i*0.4));
    }
  }
  // Делитель распадается на биты
  if (e.def.split){
    const d0 = e.dist, pIdx = e.pathIdx, wv = G.wave, ml = G.map.mult;
    for (let i=0;i<e.def.split;i++)
      spawnEnemy('bit', wv, ml, pIdx, null, Math.max(0, d0 - i*0.35));
  }
  // Мутация ЭМИ: выводит башни из строя
  if (e.mut === 'emp'){
    AudioSys.play('emp');
    ring(px, py, MUT.emp.color, 6, 2.1*V.cs, 0.5, 3);
    for (const tw of G.towers){
      if (dist2(tw.x, tw.y, e.x, e.y) < 2.1*2.1){ tw.stun = 2.5; }
    }
  }
  checkAch();
}

/* Вирус дошёл до ядра */
function leakEnemy(e){
  e.dead = true; e.alive = false;
  const def = e.def;
  G.lives -= def.leak;
  G.leaksThisWave += def.leak;
  G.cleanStreak = 0;
  G.coreFlash = 1;
  G.shake(6 + def.leak*2);
  AudioSys.play('leak');
  const px = V.ox + e.x*V.cs, py = V.oy + e.y*V.cs;
  burst(px, py, '#ff3355', 14, 180, 0.4);
  floater(px, py, '-'+def.leak, '#ff3355', e.boss);
  UI.bossHide();
  if (G.lives <= 0){ G.lives = 0; defeat(); }
  checkAch();
}
