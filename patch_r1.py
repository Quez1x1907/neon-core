import io

def patch(path, edits):
    s = io.open(path, encoding='utf-8').read()
    n = 0
    for old, new in edits:
        if new in s: continue
        assert old in s, path + ': ' + old[:60]
        s = s.replace(old, new, 1)
        n += 1
    if n: io.open(path, 'w', encoding='utf-8').write(s)
    return n

total = 0

# ===== 1) ФИКС: покупка/применение скинов карт =====
p = 'src/30_input.js'
edits = []
edits.append((
"    const b = ev.target.closest('[data-buyboost],[data-buyskin],[data-setskin],[data-buyfx],[data-fx],[data-buytower]');",
"    const b = ev.target.closest('[data-buyboost],[data-buyskin],[data-setskin],[data-buyfx],[data-fx],[data-buytower],[data-buymapskin],[data-setmapskin]');"))
edits.append((
"""    } else if (b.dataset.buytower){
      const tp = b.dataset.buytower;
      const price = 20 + UNLOCK_STARS[tp]*5;
      if (buy(price)){ S.buyUnlocked[tp] = 1; UI.toast(t('bought'), 'ach'); AudioSys.play('coin'); persist(); checkAch(); }
    }""",
"""    } else if (b.dataset.buytower){
      const tp = b.dataset.buytower;
      const price = 20 + UNLOCK_STARS[tp]*5;
      if (buy(price)){ S.buyUnlocked[tp] = 1; UI.toast(t('bought'), 'ach'); AudioSys.play('coin'); persist(); checkAch(); }
    } else if (b.dataset.buymapskin){
      const def = MAP_SKIN_ITEMS.find(x=>x.id===b.dataset.buymapskin);
      if (buy(def.price)){ S.mapSkins[def.id] = 1; S.mapSkin = def.id; UI.toast(t('bought'), 'ach'); AudioSys.play('coin'); persist(); checkAch(); }
    } else if (b.dataset.setmapskin){
      S.mapSkin = b.dataset.setmapskin; persist(); AudioSys.play('click');
    }"""))
total += patch(p, edits)

# ===== 2) i18n: имя арены + новые лаборатории =====
p = 'src/10_i18n.js'
edits = []
edits.append((
"""  s_full:'Во весь экран', s_autolow:'Подтормаживает — включил низкую графику',""",
"""  s_full:'Во весь экран', s_autolow:'Подтормаживает — включил низкую графику',
  map_arena:'Особое поле',
  meta_range:'Оптика', meta_range_d:'Радиус всех башен: <b>+{n}%</b>',
  meta_rate:'Форсаж', meta_rate_d:'Темп стрельбы всех башен: <b>+{n}%</b>',
  meta_cores:'Сборщик ядер', meta_cores_d:'Ядра за победы и цепочку: <b>+{n}%</b>',"""))
edits.append((
"""  s_full:'Fullscreen', s_autolow:'Running slow — enabled low graphics',""",
"""  s_full:'Fullscreen', s_autolow:'Running slow — enabled low graphics',
  map_arena:'Arena',
  meta_range:'Optics', meta_range_d:'Range of all towers: <b>+{n}%</b>',
  meta_rate:'Overclock', meta_rate_d:'Fire rate of all towers: <b>+{n}%</b>',
  meta_cores:'Core harvester', meta_cores_d:'Cores from wins & chain: <b>+{n}%</b>',"""))
total += patch(p, edits)

# ===== 3) 14_data.js: новые ветки лаборатории =====
p = 'src/14_data.js'
edits = []
edits.append((
"""  { id:'income', max:5, cost:l=>12+l*14, eff:l=>'+'+(6*l)+'%',    icon:'income' },
];""",
"""  { id:'income', max:5, cost:l=>12+l*14, eff:l=>'+'+(6*l)+'%',    icon:'income' },
  { id:'range',  max:5, cost:l=>14+l*16, eff:l=>'+'+(3*l)+'%',    icon:'range' },
  { id:'rate',   max:5, cost:l=>14+l*16, eff:l=>'+'+(3*l)+'%',    icon:'rate' },
  { id:'cores',  max:5, cost:l=>15+l*15, eff:l=>'+'+(8*l)+'%',    icon:'cores' },
];"""))
total += patch(p, edits)

# ===== 4) 16_storage.js: meta-поля + иконки range/rate =====
p = 'src/16_storage.js'
edits = []
edits.append((
"    meta:{ dmg:0, lives:0, cash:0, income:0 },",
"    meta:{ dmg:0, lives:0, cash:0, income:0, range:0, rate:0, cores:0 },"))
edits.append((
"    dmgMul: (1 + 0.06*S.meta.dmg) * ((typeof G !== 'undefined' && G.active && G.boost && G.boost.dmg > 1) ? G.boost.dmg : 1),",
"""    dmgMul: 1 + 0.06*S.meta.dmg,
    rangeMul: 1 + 0.03*(S.meta.range||0),
    rateMul: 1 + 0.03*(S.meta.rate||0),
    coreMul: 1 + 0.08*(S.meta.cores||0),"""))
total += patch(p, edits)

# иконки для новых веток
p = 'src/14_data.js'
edits = []
edits.append((
"""  income:'<svg viewBox="0 0 24 24"><path d="M3 17l5-6 4 3 6-8 3 3"/><path d="M17 6h4v4"/></svg>',""",
"""  income:'<svg viewBox="0 0 24 24"><path d="M3 17l5-6 4 3 6-8 3 3"/><path d="M17 6h4v4"/></svg>',
  range:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>',
  rate:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>',"""))
total += patch(p, edits)

# ===== 5) 26_game.js: применение радиуса/темпа/ядер =====
p = 'src/26_game.js'
edits = []
# радиус: поиск цели
edits.append((
"""function acquireTarget(tw, lv){
  const r2 = lv.range*lv.range;""",
"""function acquireTarget(tw, lv){
  const R = lv.range*metaVals().rangeMul;
  const r2 = R*R;"""))
# радиус: крио
edits.append((
"""    if (def.kind === 'cryo'){
      const r2 = lv.range*lv.range;""",
"""    if (def.kind === 'cryo'){
      const CR = lv.range*metaVals().rangeMul;
      const r2 = CR*CR;"""))
# темп: cd
edits.append((
"""        if (def.kind === 'tesla') fireTesla(tw, e, lv, dmgMul*tw.amp);
        else if (def.kind === 'missile') fireMissile(tw, e, lv, dmgMul*tw.amp);
        else fireHitscan(tw, e, def, lv, dmgMul*tw.amp);
        tw.cd = 1/lv.rate;""",
"""        if (def.kind === 'tesla') fireTesla(tw, e, lv, dmgMul*tw.amp);
        else if (def.kind === 'missile') fireMissile(tw, e, lv, dmgMul*tw.amp);
        else fireHitscan(tw, e, def, lv, dmgMul*tw.amp);
        tw.cd = 1/(lv.rate*metaVals().rateMul);"""))
# мортира темп
edits.append((
"""        const e = acquireTarget(tw, lv);
        if (e){ fireMortar(tw, e, lv, dmgMul*tw.amp); tw.cd = 1/lv.rate; }
        else tw.cd = 0;""",
"""        const e = acquireTarget(tw, lv);
        if (e){ fireMortar(tw, e, lv, dmgMul*tw.amp); tw.cd = 1/(lv.rate*metaVals().rateMul); }
        else tw.cd = 0;"""))
# токсин темп
edits.append((
"""        const e = acquireTarget(tw, lv);
        if (e){ fireToxin(tw, e, lv, dmgMul); tw.cd = 1/lv.rate; }
        else tw.cd = 0;""",
"""        const e = acquireTarget(tw, lv);
        if (e){ fireToxin(tw, e, lv, dmgMul); tw.cd = 1/(lv.rate*metaVals().rateMul); }
        else tw.cd = 0;"""))
# ядра мета: победа
edits.append((
"    const earned = (firstWin ? 8 + 2*G.mapIdx : 3) + Math.max(0, stars - ms.stars)*3;",
"    const earned = Math.round(((firstWin ? 8 + 2*G.mapIdx : 3) + Math.max(0, stars - ms.stars)*3) * metaVals().coreMul);"))
# ядра мета: цепочка/майлстоуны
edits.append((
"      addCores(k*5);",
"      addCores(Math.round(k*5*metaVals().coreMul));"))

print('PART 1 APPLIED:', total)
