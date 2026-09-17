// Восстановление src/26_game.js из собранного index.html
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const body = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const startMark = '/* ==================== ИГРА: состояние, обновление, рендер ==================== */';
const endMark = '/* ==================== UI: экраны, HUD, модалки, тосты ==================== */';
const a = body.indexOf(startMark);
const b = body.indexOf(endMark);
if (a < 0 || b < 0 || b <= a) { console.error('маркеры не найдены', a, b); process.exit(1); }
const part = body.slice(a, b);
fs.writeFileSync('src/26_game.js', part + '\n');
console.log('восстановлено символов:', part.length);
console.log('acquireTarget:', (part.match(/acquireTarget/g)||[]).length, 'вхождений');
console.log('начало:', part.slice(0, 80));
