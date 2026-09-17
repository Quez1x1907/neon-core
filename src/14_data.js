/* ==================== ДАННЫЕ И БАЛАНС ==================== */
const COLS = 12, ROWS = 9;
const WAVES_PER_MAP = 20;
const START_CASH = 260, START_LIVES = 20;

/* ---- Башни: kind задаёт поведение, lv — уровни (up = цена улучшения ДО этого уровня).
   Третий уровень — ВЫБОР одной из двух специализаций (branches a/b). ---- */
const TOWERS = {
  pulse:{ key:'tw_pulse', cost:50,  color:'#00e5ff', kind:'gun',
    lv:[{dmg:7, rate:2.4, range:2.7},{dmg:11, rate:2.8, range:2.9, up:45}],
    branches:{
      a:{ key:'br_pulse_a', lv:{dmg:12, rate:4.6, range:3.1, up:90} },
      b:{ key:'br_pulse_b', lv:{dmg:26, rate:2.2, range:3.4, up:90} } } },
  cryo:{ key:'tw_cryo', cost:60,  color:'#7df9ff', kind:'cryo',
    lv:[{dmg:3, slow:0.30, range:2.2},{dmg:5, slow:0.40, range:2.45, up:55}],
    branches:{
      a:{ key:'br_cryo_a', lv:{dmg:6, slow:0.60, range:2.7, up:110} },
      b:{ key:'br_cryo_b', lv:{dmg:16, slow:0.45, range:3.0, up:110} } } },
  missile:{ key:'tw_missile', cost:90,  color:'#ffb020', kind:'missile',
    lv:[{dmg:22, rate:0.65, range:3.4, splash:1.1},{dmg:34, rate:0.7, range:3.6, splash:1.25, up:75}],
    branches:{
      a:{ key:'br_missile_a', lv:{dmg:34, rate:0.9, range:3.7, splash:1.8, up:140} },
      b:{ key:'br_missile_b', lv:{dmg:70, rate:0.7, range:3.8, splash:1.0, up:140} } } },
  tesla:{ key:'tw_tesla', cost:110, color:'#9d5cff', kind:'tesla',
    lv:[{dmg:14, rate:1.1, range:2.4, chain:3},{dmg:21, rate:1.15, range:2.6, chain:4, up:85}],
    branches:{
      a:{ key:'br_tesla_a', lv:{dmg:26, rate:1.2, range:2.8, chain:7, up:160} },
      b:{ key:'br_tesla_b', lv:{dmg:52, rate:1.3, range:2.8, chain:2, up:160} } } },
  sniper:{ key:'tw_sniper', cost:120, color:'#ff2d78', kind:'sniper',
    lv:[{dmg:60, rate:0.45, range:5.5, pierce:6},{dmg:95, rate:0.48, range:6.0, pierce:10, up:95}],
    branches:{
      a:{ key:'br_sniper_a', lv:{dmg:120, rate:0.45, range:6.5, pierce:30, up:180} },
      b:{ key:'br_sniper_b', lv:{dmg:200, rate:0.55, range:6.0, pierce:8, up:180} } } },
  bank:{ key:'tw_bank', cost:100, color:'#a8ff3e', kind:'bank',
    lv:[{prod:2, cycle:4},{prod:3, cycle:4, up:85}],
    branches:{
      a:{ key:'br_bank_a', lv:{prod:5, cycle:3.0, up:160} },
      b:{ key:'br_bank_b', lv:{prod:8, cycle:4.0, up:160} } } },
  beam:{ key:'tw_beam', cost:140, color:'#ff7a2d', kind:'beam',
    lv:[{dmg:22, range:3.2, ramp:0.4},{dmg:34, range:3.4, ramp:0.5, up:110}],
    branches:{
      a:{ key:'br_beam_a', lv:{dmg:45, range:3.4, ramp:0.9, up:200} },
      b:{ key:'br_beam_b', lv:{dmg:75, range:4.2, ramp:0.2, up:200} } } },
  toxin:{ key:'tw_toxin', cost:85, color:'#c8ff00', kind:'poison',
    lv:[{dmg:6, cap:8, rate:1.2, range:2.6},{dmg:9, cap:8, rate:1.35, range:2.8, up:75}],
    branches:{
      a:{ key:'br_toxin_a', lv:{dmg:14, cap:12, rate:1.4, range:3.0, up:150} },
      b:{ key:'br_toxin_b', lv:{dmg:10, cap:8, rate:1.3, range:2.9, acid:true, up:150} } } },
  mortar:{ key:'tw_mortar', cost:130, color:'#ff4d00', kind:'mortar',
    lv:[{dmg:50, rate:0.35, range:6.5, minRange:2, splash:1.6},{dmg:75, rate:0.38, range:7, splash:1.9, up:165}],
    branches:{
      a:{ key:'br_mortar_a', lv:{dmg:60, rate:0.5, range:7, minRange:2.2, splash:1.6, up:330} },
      b:{ key:'br_mortar_b', lv:{dmg:130, rate:0.35, range:7.5, minRange:2.5, splash:2.6, stun:0.6, up:330} } } },
  amp:{ key:'tw_amp', cost:80, color:'#ffe94d', kind:'amp',
    lv:[{boost:0.20, range:2.5},{boost:0.32, range:2.8, up:70}],
    branches:{
      a:{ key:'br_amp_a', lv:{boost:0.55, range:3.6, up:140} },
      b:{ key:'br_amp_b', lv:{boost:0.75, range:2.3, up:140} } } },
};
const TOWER_ORDER = ['pulse','cryo','missile','tesla','toxin','sniper','mortar','bank','beam','amp'];
/* Цены улучшений: +25% к базовым — прокачать всё подряд невозможно */
for (const tk in TOWERS){
  TOWERS[tk].lv.forEach(l=>{ if (l.up) l.up = Math.round(l.up*1.25); });
  if (TOWERS[tk].branches) for (const bk in TOWERS[tk].branches){
    const bl = TOWERS[tk].branches[bk].lv;
    if (bl.up) bl.up = Math.round(bl.up*1.25);
  }
}
/* Открытие башен за суммарные звёзды */
const UNLOCK_STARS = { pulse:0, cryo:0, missile:0, tesla:4, sniper:8, toxin:10, mortar:14, bank:12, beam:16, amp:7 };

/* ---- Активные способности игрока ---- */
const ABILITIES = {
  emp: { cd:45, radius:2.2, stun:2.2, key:'Q', nameKey:'ab_emp' },
  over:{ cd:60, dur:6, mult:1.6,  key:'E', nameKey:'ab_over' },
};

/* ---- Модификаторы волн: разнообразие и осмысленный выбор ---- */
const WAVE_MODS = {
  gold:  { key:'wm_gold',  descKey:'wm_gold_d',  reward:2.5, color:'#ffd700' },
  storm: { key:'wm_storm', descKey:'wm_storm_d', spd:1.3,    color:'#00ffe0' },
  armor: { key:'wm_armor', descKey:'wm_armor_d', armor:3,    color:'#ff9d2d' },
};
/* Расписание модификаторов в кампании (волна → модификатор) */
const CAMPAIGN_MODS = { 6:'gold', 11:'storm', 16:'armor' };

/* Скины карт: палитры для фона, сетки и декора */
const MAP_SKINS = {
  classic: { key:'msk_classic', price:0,  bg:['#070b18','#05070f','#0a0f22'], grid:'rgba(0,229,255,0.05)',  border:'rgba(0,229,255,0.16)', cell:'rgba(0,229,255,0.05)',  node:'rgba(0,229,255,0.10)',  marker:'0,229,255',  decoB:'rgba(0,229,255,0.18)', decoL:'rgba(0,229,255,0.25)' },
  desert:  { key:'msk_desert',  price:60, bg:['#181008','#100b05','#221608'], grid:'rgba(255,176,32,0.06)', border:'rgba(255,176,32,0.18)', cell:'rgba(255,176,32,0.05)',  node:'rgba(255,176,32,0.10)',  marker:'255,176,32', decoB:'rgba(255,176,32,0.18)', decoL:'rgba(255,176,32,0.25)' },
  ice:     { key:'msk_ice',     price:60, bg:['#061018','#040a12','#0a1826'], grid:'rgba(160,220,255,0.06)', border:'rgba(160,220,255,0.18)', cell:'rgba(160,220,255,0.06)',  node:'rgba(160,220,255,0.10)',  marker:'160,220,255', decoB:'rgba(160,220,255,0.18)', decoL:'rgba(160,220,255,0.25)' },
  toxic:   { key:'msk_toxic',   price:70, bg:['#081406','#040c04','#0c1a0a'], grid:'rgba(132,255,90,0.06)', border:'rgba(132,255,90,0.18)', cell:'rgba(132,255,90,0.05)', node:'rgba(132,255,90,0.10)', marker:'132,255,90', decoB:'rgba(132,255,90,0.18)', decoL:'rgba(132,255,90,0.25)' },
  violet:  { key:'msk_violet',  price:80, bg:['#0e0618','#080410','#160a26'], grid:'rgba(190,120,255,0.06)', border:'rgba(190,120,255,0.18)', cell:'rgba(190,120,255,0.05)', node:'rgba(190,120,255,0.10)', marker:'190,120,255', decoB:'rgba(190,120,255,0.18)', decoL:'rgba(190,120,255,0.25)' },
  mono:    { key:'msk_mono',    price:80, bg:['#101014','#0a0a0c','#18181e'], grid:'rgba(220,224,235,0.05)', border:'rgba(220,224,235,0.16)', cell:'rgba(220,224,235,0.04)', node:'rgba(220,224,235,0.08)', marker:'220,224,235', decoB:'rgba(220,224,235,0.16)', decoL:'rgba(220,224,235,0.22)' },
  blood:   { key:'msk_blood',   price:70, bg:['#160608','#0e0406','#1e0a0e'], grid:'rgba(255,51,85,0.06)',  border:'rgba(255,51,85,0.18)', cell:'rgba(255,51,85,0.05)',  node:'rgba(255,51,85,0.10)',  marker:'255,51,85',  decoB:'rgba(255,51,85,0.18)', decoL:'rgba(255,51,85,0.25)' },
};

/* ---- Враги ---- */
const ENEMIES = {
  drone:   { key:'en_drone',    hp:32,  speed:1.5,  armor:0, reward:5,   leak:1,  r:.30, color:'#ff2d78', shape:'tri',  cost:1 },
  bit:     { key:'en_bit',      hp:10,  speed:2.3,  armor:0, reward:2,   leak:1,  r:.18, color:'#ff7a2d', shape:'dia',  cost:.35 },
  sprinter:{ key:'en_sprinter', hp:26,  speed:3.0,  armor:0, reward:5,   leak:1,  r:.24, color:'#ffd12d', shape:'dart', cost:1.2 },
  tank:    { key:'en_tank',     hp:170, speed:0.85, armor:4, reward:16,  leak:3,  r:.42, color:'#9d5cff', shape:'hex',  cost:4 },
  mender:  { key:'en_mender',   hp:80,  speed:1.15, armor:0, reward:12,  leak:2,  r:.32, color:'#3dff8f', shape:'plus', cost:3, heal:{amt:16, per:2, rad:1.8} },
  phantom: { key:'en_phantom',  hp:60,  speed:1.75, armor:1, reward:10,  leak:2,  r:.28, color:'#7df9ff', shape:'blob', cost:2.5, phase:{dur:1.3, every:4.5} },
  aegis:   { key:'en_aegis',    hp:100, speed:1.05, armor:2, reward:12,  leak:2,  r:.34, color:'#4dc3ff', shape:'shield', cost:3, shield:55, shieldRegen:12 },
  splitter:{ key:'en_splitter', hp:85,  speed:1.25, armor:1, reward:10,  leak:2,  r:.36, color:'#b6ff2d', shape:'split', cost:2, split:2 },
  boss:    { key:'en_boss',     hp:1100,speed:0.72, armor:6, reward:150, leak:10, r:.58, color:'#ff2d78', shape:'boss', cost:30, boss:true },
};
/* Варианты боссов: циклически по номеру карты */
const BOSSES = {
  titan:{ nameKey:'b_titan', hpM:1.0,  spdM:1.0,  armor:6 },
  hydra:{ nameKey:'b_hydra', hpM:0.72, spdM:1.05, armor:4, split:3 },
  surge:{ nameKey:'b_surge', hpM:0.6,  spdM:1.7,  armor:2 },
};
/* Мутации врагов (поздние волны и бесконечный режим) */
const MUT = {
  swift:{ color:'#00ffe0', hp:0.9,  spd:1.45, key:'m_swift' },
  hard: { color:'#ff9d2d', hp:1.5,  armor:4,  key:'m_hard' },
  emp:  { color:'#ff4dd2', hp:1.15, key:'m_emp' },
};
/* Когда тип врага появляется: волна на любой карте ИЛИ сразу на карте с tech >= floor */
const TYPE_THRESH = { drone:1, sprinter:4, bit:7, tank:10, mender:13, phantom:16, aegis:18, splitter:12 };
const TECH_FLOOR  = { drone:0, sprinter:1, bit:2, tank:3, mender:4, phantom:5, aegis:6, splitter:3 };

/* ---- Карты: waypoints в клетках, последняя точка каждой трассы — ядро.
   Дороги удлинены; стройка разрешена только в зонах рядом с трассой. ---- */
const MAPS = [
  { key:'map_boot', mult:1, need:0, color:'#00e5ff',
    paths:[[[-1, 2], [7, 2], [7, 4], [2, 4], [2, 6], [9, 6]]], deco:[[4, 3], [6, 5], [5, 3]] },
  { key:'map_spiral', mult:1.12, need:3, color:'#9d5cff',
    paths:[[[-1, 1], [10, 1], [10, 7], [1, 7], [1, 3], [8, 3], [8, 5], [4, 5]]], deco:[[3, 4], [5, 4], [6, 6], [3, 6]] },
  { key:'map_fork', mult:1.22, need:6, color:'#a8ff3e',
    paths:[[[-1, 1], [9, 1], [9, 3], [2, 3], [2, 6], [10, 6]],
    [[-1, 7], [1, 7], [1, 4], [6, 4], [6, 6], [10, 6]]], deco:[[4, 2], [7, 2], [8, 4], [8, 7]] },
  { key:'map_serpent', mult:1.28, need:9, color:'#ffb020',
    paths:[[[-1, 1], [10, 1], [10, 2], [1, 2], [1, 4], [10, 4], [10, 6], [4, 6]],
    [[12, 8], [2, 8], [2, 6], [4, 6]]], deco:[[6, 3], [3, 3], [8, 5], [8, 7]] },
  { key:'map_vortex', mult:1.46, need:12, color:'#ff2d78',
    paths:[[[-1, 1], [4, 1], [4, 4], [8, 4], [8, 2], [10, 2], [10, 5], [5, 5], [5, 7], [2, 7]],
    [[12, 7], [8, 7], [8, 5], [5, 5], [5, 7], [3, 7], [3, 6], [2, 6], [2, 7]]], deco:[[2, 2], [6, 2], [11, 3], [7, 7]] },
  { key:'map_siege', mult:1.52, need:15, color:'#4dc3ff',
    paths:[[[-1, 2], [6, 2], [6, 4], [2, 4], [2, 7], [9, 7], [9, 5], [10, 5]],
    [[12, 4], [11, 4], [11, 8], [5, 8], [5, 6], [8, 6], [8, 5], [10, 5]]], deco:[[3, 1], [7, 3], [4, 5], [0, 6]] },
  { key:'map_bastion', mult:1.6, need:18, color:'#ff3355',
    paths:[[[-1, 1], [3, 1], [3, 3], [8, 3], [8, 1], [10, 1], [10, 4], [6, 4]],
    [[12, 7], [9, 7], [9, 5], [4, 5], [4, 7], [2, 7], [2, 5], [6, 5], [6, 4]],
    [[-1, 8], [7, 8], [7, 6], [6, 6], [6, 4]]], deco:[[5, 2], [1, 3], [9, 8], [8, 6]] },
  { key:'map_arena',   mult:1.0,  need:0,  color:'#66ffe0', cols:22, rows:14, endlessOnly:true,
    paths:[[[-1,2],[5,2],[5,7],[11,7]],
           [[22,12],[16,12],[16,7],[11,7]],
           [[-1,12],[8,12],[8,9],[11,9],[11,7]],
           [[22,2],[17,2],[17,4],[13,4],[13,7],[11,7]]],
    "deco":[[2,4],[3,9],[13,2],[19,10],[6,3],[14,11]] },
  { key:'map_trinity', mult:1.6, need:21, color:'#00ff9d',
    paths:[[[-1, 1], [2, 1], [2, 3], [8, 3], [8, 1], [10, 1], [10, 4], [5, 4]],
    [[-1, 7], [2, 7], [2, 5], [8, 5], [8, 7], [10, 7], [10, 4], [5, 4]],
    [[12, 0], [9, 0], [9, 2], [11, 2], [11, 6], [3, 6], [3, 4], [5, 4]]], deco:[[4, 2], [6, 2], [7, 2], [0, 4]] },
  { key:'map_gates', mult:1.7, need:22, color:'#ff8c00',
    paths:[[[-1, 0], [4, 0], [4, 4], [6, 4]],
    [[-1, 8], [4, 8], [4, 4], [6, 4]],
    [[12, 0], [8, 0], [8, 4], [6, 4]],
    [[12, 8], [8, 8], [8, 4], [6, 4]]], deco:[[2, 2], [9, 2], [2, 6], [9, 6]] },
  { key:'map_mega', mult:1.9, need:25, color:'#e0e0ff',
    paths:[[[-1, 1], [10, 1], [10, 7], [1, 7], [1, 2], [9, 2], [9, 6], [3, 6], [3, 4], [6, 4]]], deco:[[5, 3], [6, 8], [2, 4]] },
];

/* ---- Мета-прокачка (за ядра данных) ---- */
const META = [
  { id:'dmg',    max:5, cost:l=>10+l*12, eff:l=>'+'+(6*l)+'%',    icon:'dmg' },
  { id:'lives',  max:5, cost:l=>10+l*12, eff:l=>'+'+(2*l),        icon:'lives' },
  { id:'cash',   max:5, cost:l=>12+l*14, eff:l=>'+'+(30*l)+'$',   icon:'cash' },
  { id:'income', max:5, cost:l=>12+l*14, eff:l=>'+'+(6*l)+'%',    icon:'income' },
];

/* ---- Достижения: test по статистике, prog для полосок прогресса ---- */
const ACHS = [
  { id:'kill100',   key:'a_kill100',   reward:5,  test:()=>S.stats.kills>=100,              prog:()=>[Math.min(S.stats.kills,100),100] },
  { id:'build25',   key:'a_build25',   reward:5,  test:()=>S.stats.towersBuilt>=25,         prog:()=>[Math.min(S.stats.towersBuilt,25),25] },
  { id:'max8',      key:'a_max8',      reward:5,  test:()=>S.stats.maxTowers>=8,            prog:()=>[Math.min(S.stats.maxTowers,8),8] },
  { id:'towerl3',   key:'a_towerl3',   reward:5,  test:()=>S.stats.maxTowerLevel>=3,        prog:()=>[Math.min(S.stats.maxTowerLevel,3),3] },
  { id:'money',     key:'a_money',     reward:10, test:()=>S.stats.money>=5000,             prog:()=>[Math.min(S.stats.money,5000),5000] },
  { id:'star3',     key:'a_star3',     reward:10, test:()=>Object.values(S.maps).some(m=>m.stars===3), prog:()=>[Object.values(S.maps).some(m=>m.stars===3)?1:0,1] },
  { id:'clean10',   key:'a_clean10',   reward:10, test:()=>S.stats.bestCleanWave>=10,       prog:()=>[Math.min(S.stats.bestCleanWave,10),10] },
  { id:'boss1',     key:'a_boss1',     reward:10, test:()=>S.stats.bosses>=1,               prog:()=>[Math.min(S.stats.bosses,1),1] },
  { id:'boss10',    key:'a_boss10',    reward:15, test:()=>S.stats.bosses>=10,              prog:()=>[Math.min(S.stats.bosses,10),10] },
  { id:'endless30', key:'a_endless30', reward:20, test:()=>endlessBest()>=30,               prog:()=>[Math.min(endlessBest(),30),30] },
  { id:'towers',    key:'a_towers',    reward:15, test:()=>unlockedTowerCount()>=TOWER_ORDER.length, prog:()=>[unlockedTowerCount(),TOWER_ORDER.length] },
  { id:'maps',      key:'a_maps',      reward:20, test:()=>MAPS.every((m,i)=>mapSave(i).stars>=1), prog:()=>[MAPS.filter((m,i)=>mapSave(i).stars>=1).length,MAPS.length] },
  { id:'stars21',   key:'a_stars21',   reward:25, test:()=>totalStars()>=MAPS.length*3,      prog:()=>[Math.min(totalStars(),MAPS.length*3),MAPS.length*3] },
  { id:'spec5',     key:'a_spec5',     reward:10, test:()=>S.stats.branches>=5,              prog:()=>[Math.min(S.stats.branches,5),5] },
  { id:'amp2',      key:'a_amp2',      reward:10, test:()=>S.stats.maxAmps>=2,               prog:()=>[Math.min(S.stats.maxAmps,2),2] },
  { id:'shop5',     key:'a_shop',      reward:10, test:()=>(S.stats.purchases||0)>=5,        prog:()=>[Math.min(S.stats.purchases||0,5),5] },
  { id:'shop5',     key:'a_shop',      reward:10, test:()=>(S.stats.purchases||0)>=5,        prog:()=>[Math.min(S.stats.purchases||0,5),5] },
];

/* Иконки-стрелки/UI (inline SVG, без внешних файлов) */
const ICONS = {
  star:'<svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 16.9 6.1 20.2l1.3-6.6L2.5 9l6.6-.8z"/></svg>',
  pause:'<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
  home:'<svg viewBox="0 0 24 24"><path d="M12 3l9 8h-3v9h-4v-6h-4v6H6v-9H3z"/></svg>',
  full:'<svg viewBox="0 0 24 24"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  gear:'<svg viewBox="0 0 24 24"><path d="M19.4 13a7.8 7.8 0 000-2l2-1.6-2-3.4-2.4 1a7.6 7.6 0 00-1.6-1L15 3.4h-4l-.4 2.6a7.6 7.6 0 00-1.6 1l-2.4-1-2 3.4L6.6 11a7.8 7.8 0 000 2l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 001.6 1l.4 2.6h4l.4-2.6a7.6 7.6 0 001.6-1l2.4 1 2-3.4-2-1.6zM13 15a3 3 0 110-6 3 3 0 010 6z" fill="currentColor" stroke="none"/></svg>',
  person:'<svg viewBox="0 0 24 24"><path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-8 2-8 5v2h16v-2c0-3-4-5-8-5z" fill="currentColor" stroke="none"/></svg>',
  badge:'<svg viewBox="0 0 24 24"><path d="M12 2l2.4 2.4 3.2-.4.8 3.2L21 9.6l-1.4 2.9 1 3.1-3.1 1L16 19.7l-3.2-.4L12 22l-2.4-2.4-3.2.4-.8-3.2L3 15.6 4.4 12.7 3.4 9.6l3.1-1L7 5.6l3.2.4z" fill="currentColor" stroke="none"/><path d="M10.6 13.2l-2.2-2.2 1.2-1.2 1 1 3-3 1.2 1.2z" fill="#05070f" stroke="none"/></svg>',
  core:'<svg viewBox="0 0 24 24"><path d="M12 2l8.5 5v10L12 22l-8.5-5V7z"/><circle cx="12" cy="12" r="3.4" fill="currentColor" stroke="none"/></svg>',
  dmg:'<svg viewBox="0 0 24 24"><path d="M4 20l6-6M14 4l6 6M4 4l16 16" /><path d="M4 14v6h6M20 10V4h-6"/></svg>',
  lives:'<svg viewBox="0 0 24 24"><path d="M12 21C7 16 3 12.5 3 8.5 3 6 5 4 7.5 4c1.8 0 3.4 1 4.5 2.6C13.1 5 14.7 4 16.5 4 19 4 21 6 21 8.5c0 4-4 7.5-9 12.5z"/></svg>',
  cash:'<svg viewBox="0 0 24 24"><rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>',
  income:'<svg viewBox="0 0 24 24"><path d="M3 17l5-6 4 3 6-8 3 3"/><path d="M17 6h4v4"/></svg>',
};
