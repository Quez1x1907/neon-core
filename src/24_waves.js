/* ==================== Генератор волн ====================
   Волна = список групп {type, count, gap, delay, mut}. Паттерны разнообразят составы,
   бюджет растёт по волне; типы вводятся постепенно (TYPE_THRESH / TECH_FLOOR по карте). */

function typeAvail(type, wave, tech){
  return wave >= TYPE_THRESH[type] || tech >= TECH_FLOOR[type];
}

function availTypes(wave, tech){
  const list = [];
  for (const k in ENEMIES){ if (!ENEMIES[k].boss && typeAvail(k, wave, tech)) list.push(k); }
  return list;
}

/* Случайная мутация группы (только поздние волны) */
function rollMut(wave, tech){
  const late = (wave >= 24) || (tech >= 5 && wave >= 12);
  if (!late || Math.random() > 0.42) return null;
  const r = Math.random();
  return r < 0.4 ? 'swift' : (r < 0.75 ? 'hard' : 'emp');
}

/* Выбор очередного паттерна; avoid — не повторять предыдущий тип */
function pickGroup(wave, avail, avoid){
  const options = [];
  for (const tp of avail){
    const d = ENEMIES[tp];
    let w = 1;
    if (tp === 'drone') w = 3;
    if (tp === 'sprinter') w = 2;
    if (tp === 'bit') w = wave >= 6 ? 1.6 : 0;
    if (tp === 'tank') w = 1.4;
    if (tp === 'mender') w = 0.9;   // сопровождение, волнует состав
    if (tp === 'phantom') w = 1;
    if (tp === 'aegis') w = 1;
    if (tp !== avoid) options.push({ tp, w, cost: d.cost });
  }
  if (!options.length) options.push({ tp:'drone', w:1, cost:ENEMIES.drone.cost });
  // взвешенный выбор
  let sum = 0; for (const o of options) sum += o.w;
  let r = Math.random()*sum, chosen = options[0];
  for (const o of options){ r -= o.w; if (r <= 0){ chosen = o; break; } }
  const tp = chosen.tp;
  let count, gap;
  switch(tp){
    case 'bit':      count = clamp(8 + Math.floor(wave*0.7), 8, 18); gap = 0.22; break;
    case 'sprinter': count = 4 + rndi(0, 3) + Math.floor(wave*0.15); gap = 0.38; break;
    case 'tank':     count = 1 + Math.floor(wave/9); gap = 1.7; break;
    case 'mender':   count = 1 + (wave >= 17 ? 1 : 0); gap = 2.2; break;
    case 'phantom':  count = 2 + (wave >= 19 ? 1 : 0); gap = 1.15; break;
    case 'aegis':    count = 1 + (wave >= 19 ? 1 : 0); gap = 2.1; break;
    default:         count = 5 + Math.floor(wave*0.55); gap = Math.max(0.34, 0.85 - wave*0.012);
  }
  return { type:tp, count, gap };
}

/* Модификатор волны: в кампании по расписанию, в бесконечном — случайно */
function waveMod(wave, endless){
  if (!endless){
    return CAMPAIGN_MODS[wave] || null;
  }
  if (wave >= 6 && wave % 5 !== 0 && Math.random() < 0.22) return pick(['gold','storm','armor']);
  return null;
}

/* Собрать волну. Возвращает {groups, bossWave, mod} */
function buildWave(mapIdx, wave, endless){
  const map = MAPS[mapIdx];
  const tech = mapIdx;
  const groups = [];
  const mod = waveMod(wave, endless);
  const isBossWave = endless ? (wave % 5 === 0) : (wave === WAVES_PER_MAP);

  if (isBossWave){
    groups.push({ type:'boss', count:1, gap:0, delay:0.8, mut:null, variant:['titan','hydra','surge'][mapIdx % 3] });
    // лёгкий эскорт
    if (endless || wave >= 12){
      const esc = availTypes(wave, tech).filter(k=>k!=='mender');
      const tp = esc.length ? pick(esc) : 'drone';
      groups.push({ type:tp, count:4 + Math.floor(wave*0.2), gap:0.7, delay:3, mut:rollMut(wave, tech) });
    }
    return { groups, bossWave:true, mod:null };
  }

  let budget = (7 + wave*3.3 + wave*wave*0.10) * (0.9 + 0.1*map.mult);
  if (mod === 'gold') budget *= 1.3; // золотая волна плотнее — но и награда ×2.5
  let delay = 0.4, avoid = null, mutUsed = false;
  let guard = 0;
  while (budget > 0.9 && guard++ < 12){
    const g = pickGroup(wave, availTypes(wave, tech), avoid);
    let cost = g.count * ENEMIES[g.type].cost;
    // подгоняем количество под остаток бюджета
    if (cost > budget + 2){
      g.count = Math.max(1, Math.floor(budget / ENEMIES[g.type].cost));
      cost = g.count * ENEMIES[g.type].cost;
      if (cost < 0.8) continue;
    }
    avoid = g.type;
    g.delay = delay;
    // не более одной мутировавшей группы за волну — иначе поздние волны идут лавиной
    g.mut = mutUsed ? null : rollMut(wave, tech);
    if (g.mut) mutUsed = true;
    groups.push(g);
    budget -= cost;
    delay += g.count*g.gap + 1.1;
  }
  return { groups, bossWave:false, mod };
}

/* Сводка для превью следующей волны: [{type, count, mut}] */
function wavePreview(w){
  const map = new Map();
  for (const g of w.groups){
    const k = g.type + '|' + (g.mut||'');
    const cur = map.get(k) || { type:g.type, count:0, mut:g.mut };
    cur.count += g.count;
    map.set(k, cur);
  }
  return [...map.values()];
}

/* Итоговое расписание спавна: отсортированные события */
function waveEvents(w, nPaths){
  const ev = [];
  w.groups.forEach((g, gi)=>{
    for (let i=0;i<g.count;i++)
      ev.push({ t: g.delay + i*g.gap, type: g.type, mut: g.mut, variant: g.variant||null, path: nPaths > 1 ? gi % nPaths : 0 });
  });
  ev.sort((a,b)=>a.t-b.t);
  return ev;
}
