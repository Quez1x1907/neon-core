// Валидатор карт: трассы должны быть ортогональными, без диагоналей,
// все пути карты заканчиваться в одном ядре, клетки в границах поля.
const COLS = 12, ROWS = 9;
const MAPS = require('./maps_tmp.json');
let bad = 0;
MAPS.forEach((m, mi) => {
  let core = null;
  const lens = [];
  m.paths.forEach((wps, pi) => {
    let len = 0, c = wps[0][0], r = wps[0][1];
    for (let i = 1; i < wps.length; i++) {
      const [c1, r1] = wps[i];
      if ((c !== c1) && (r !== r1)) { console.log(`M${mi} path${pi}: ДИАГОНАЛЬ к ${c1},${r1}`); bad++; }
      len += Math.abs(c1 - c) + Math.abs(r1 - r);
      c = c1; r = r1;
    }
    const last = wps[wps.length - 1];
    if (core === null) core = last.join(',');
    else if (core !== last.join(',')) { console.log(`M${mi} path${pi}: ЯДРО не совпадает (${last} vs ${core})`); bad++; }
    for (const [c2, r2] of wps) if (c2 > COLS || r2 > ROWS) { console.log(`M${mi} path${pi}: ВНЕ ПОЛЯ ${c2},${r2}`); bad++; }
    lens.push(len);
  });
  m.deco.forEach(([dc, dr]) => {
    const onPath = m.paths.some(wps => {
      let pc = wps[0][0], pr = wps[0][1];
      const cells = new Set([pc + ',' + pr]);
      for (let i = 1; i < wps.length; i++) {
        const [c1, r1] = wps[i];
        while (pc !== c1 || pr !== r1) { pc += Math.sign(c1 - pc); pr += Math.sign(r1 - pr); cells.add(pc + ',' + pr); }
      }
      return cells.has(dc + ',' + dr);
    });
    if (onPath) { console.log(`M${mi}: декор на трассе ${dc},${dr}`); bad++; }
  });
  console.log(`M${mi} ${m.key}: длины путей [${lens}], ядро ${core}`);
});
console.log(bad === 0 ? 'ВСЕ КАРТЫ ВАЛИДНЫ' : `ОШИБОК: ${bad}`);
