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

p = 'src/26_game.js'
edits = []
edits.append((
"""function acquireTarget(tw, lv){
  const r2 = lv.range*lv.range;""",
"""function acquireTarget(tw, lv){
  const R = lv.range*metaVals().rangeMul;
  const r2 = R*R;"""))
edits.append((
"""    if (def.kind === 'cryo'){
      const r2 = lv.range*lv.range;""",
"""    if (def.kind === 'cryo'){
      const CR = lv.range*metaVals().rangeMul;
      const r2 = CR*CR;"""))
edits.append((
"""        if (def.kind === 'tesla') fireTesla(tw, e, lv, dmgMul*tw.amp);
        else if (def.kind === 'missile') fireMissile(tw, e, lv, dmgMul*tw.amp);
        else fireHitscan(tw, e, def, lv, dmgMul*tw.amp);
        tw.cd = 1/lv.rate;""",
"""        if (def.kind === 'tesla') fireTesla(tw, e, lv, dmgMul*tw.amp);
        else if (def.kind === 'missile') fireMissile(tw, e, lv, dmgMul*tw.amp);
        else fireHitscan(tw, e, def, lv, dmgMul*tw.amp);
        tw.cd = 1/(lv.rate*metaVals().rateMul);"""))
edits.append((
"""        const e = acquireTarget(tw, lv);
        if (e){ fireMortar(tw, e, lv, dmgMul*tw.amp); tw.cd = 1/lv.rate; }
        else tw.cd = 0;""",
"""        const e = acquireTarget(tw, lv);
        if (e){ fireMortar(tw, e, lv, dmgMul*tw.amp); tw.cd = 1/(lv.rate*metaVals().rateMul); }
        else tw.cd = 0;"""))
edits.append((
"""        const e = acquireTarget(tw, lv);
        if (e){ fireToxin(tw, e, lv, dmgMul); tw.cd = 1/lv.rate; }
        else tw.cd = 0;""",
"""        const e = acquireTarget(tw, lv);
        if (e){ fireToxin(tw, e, lv, dmgMul); tw.cd = 1/(lv.rate*metaVals().rateMul); }
        else tw.cd = 0;"""))
edits.append((
"    const earned = (firstWin ? 8 + 2*G.mapIdx : 3) + Math.max(0, stars - ms.stars)*3;",
"    const earned = Math.round(((firstWin ? 8 + 2*G.mapIdx : 3) + Math.max(0, stars - ms.stars)*3) * metaVals().coreMul);"))
edits.append((
"      addCores(k*5);",
"      addCores(Math.round(k*5*metaVals().coreMul));"))
n = patch(p, edits)
print('26_game applied:', n)
