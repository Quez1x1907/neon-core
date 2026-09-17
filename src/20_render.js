/* ==================== Рендер-помощники: глоу-спрайты, фигуры, иконки ====================
   shadowBlur в горячем цикле не используем — неон делаем предрендерами-спрайтами и composite 'lighter'. */

const glowCache = {};
function glowSprite(color){
  if (glowCache[color]) return glowCache[color];
  const size = 128, r = 56;
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(size/2, size/2, 0, size/2, size/2, r);
  g.addColorStop(0, hexA(color, 0.85));
  g.addColorStop(0.35, hexA(color, 0.32));
  g.addColorStop(1, hexA(color, 0));
  c.fillStyle = g; c.fillRect(0,0,size,size);
  glowCache[color] = cv;
  return cv;
}
function drawGlow(ctx, x, y, radius, color, alpha){
  if (alpha === undefined) alpha = 1;
  if (alpha <= 0.01) return;
  const sp = glowSprite(color), s = radius*2;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(sp, x-s, y-s, s*2, s*2);
  ctx.restore();
}

function rr(ctx,x,y,w,h,r){ // скруглённый прямоугольник
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}

/* Зигзаг молнии между двумя точками */
function zapPath(ctx, x1,y1, x2,y2, amp){
  ctx.beginPath(); ctx.moveTo(x1,y1);
  const segs = 6;
  for (let i=1;i<segs;i++){
    const k = i/segs;
    const nx = lerp(x1,x2,k) + rnd(-amp,amp);
    const ny = lerp(y1,y2,k) + rnd(-amp,amp);
    ctx.lineTo(nx,ny);
  }
  ctx.lineTo(x2,y2);
}

/* ---- Фигуры врагов: полупрозрачная заливка + обводка + внутренние детали.
   time — игровое время, seed — уникальный сдвиг врага (анимация «вразнобой»). ---- */
function drawEnemyShape(ctx, shape, cx, cy, R, ang, color, lw, time, seed){
  ctx.save();
  ctx.translate(cx, cy);
  const t = (time||0) + (seed||0)*1.7;
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const fill = ()=>{ ctx.fillStyle = hexA(color, 0.16); ctx.fill(); ctx.stroke(); };
  const dot = (r)=>{ ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fillStyle = color; ctx.fill(); };
  ctx.beginPath();
  switch(shape){
    case 'tri': // дрон: стрелка с ядром
      ctx.moveTo(Math.cos(ang)*R, Math.sin(ang)*R);
      ctx.lineTo(Math.cos(ang+2.5)*R, Math.sin(ang+2.5)*R);
      ctx.lineTo(Math.cos(ang-2.5)*R, Math.sin(ang-2.5)*R);
      ctx.closePath(); fill();
      ctx.save(); ctx.rotate(ang); dot(R*0.22); ctx.restore();
      break;
    case 'dia': // бит: вращающийся ромбик
      ctx.rotate(t*2.4);
      ctx.moveTo(0,-R); ctx.lineTo(R,0); ctx.lineTo(0,R); ctx.lineTo(-R,0);
      ctx.closePath(); fill();
      break;
    case 'dart': // спринтер: острый дротик со шлейфом скорости
      ctx.moveTo(Math.cos(ang)*R*1.3, Math.sin(ang)*R*1.3);
      ctx.lineTo(Math.cos(ang+2.3)*R, Math.sin(ang+2.3)*R);
      ctx.lineTo(Math.cos(ang)*R*0.25, Math.sin(ang)*R*0.25);
      ctx.lineTo(Math.cos(ang-2.3)*R, Math.sin(ang-2.3)*R);
      ctx.closePath(); fill();
      ctx.save(); ctx.rotate(ang);
      ctx.globalAlpha *= 0.55;
      ctx.beginPath();
      ctx.moveTo(-R*1.1, -R*0.3); ctx.lineTo(-R*(1.6+0.25*Math.sin(t*9)), -R*0.3);
      ctx.moveTo(-R*1.1,  R*0.3); ctx.lineTo(-R*(1.6+0.25*Math.cos(t*9)), R*0.3);
      ctx.stroke(); ctx.restore();
      break;
    case 'hex': // броневик: шестигранник с пластинами
      for (let i=0;i<6;i++){ const a=ang+i*TAU/6; i?ctx.lineTo(Math.cos(a)*R,Math.sin(a)*R):ctx.moveTo(Math.cos(a)*R,Math.sin(a)*R); }
      ctx.closePath(); fill();
      ctx.save(); ctx.rotate(-ang*0.7 + t*0.2);
      ctx.beginPath();
      for (let i=0;i<6;i++){ const a=i*TAU/6; i?ctx.lineTo(Math.cos(a)*R*0.55,Math.sin(a)*R*0.55):ctx.moveTo(Math.cos(a)*R*0.55,Math.sin(a)*R*0.55); }
      ctx.closePath(); ctx.stroke();
      ctx.beginPath();
      for (let i=0;i<3;i++){ const a=i*TAU/3; ctx.moveTo(Math.cos(a)*R*0.55, Math.sin(a)*R*0.55); ctx.lineTo(Math.cos(a)*R*0.95, Math.sin(a)*R*0.95); }
      ctx.stroke(); ctx.restore();
      break;
    case 'plus': { // медик: крест с пульсирующим ореолом лечения
      const p = R*0.38;
      ctx.moveTo(-R,-p); ctx.lineTo(-p,-p); ctx.lineTo(-p,-R); ctx.lineTo(p,-R); ctx.lineTo(p,-p);
      ctx.lineTo(R,-p); ctx.lineTo(R,p); ctx.lineTo(p,p); ctx.lineTo(p,R); ctx.lineTo(-p,R);
      ctx.lineTo(-p,p); ctx.lineTo(-R,p);
      ctx.closePath(); fill();
      ctx.globalAlpha *= 0.5;
      ctx.beginPath(); ctx.arc(0, 0, R*(1.25+0.18*Math.sin(t*4)), 0, TAU); ctx.stroke();
      break;
    }
    case 'blob': // фантом: капля с «хвостами», дрожит
      ctx.save(); ctx.rotate(Math.sin(t*5)*0.15);
      ctx.arc(0, 0, R*0.85, 0, TAU);
      ctx.moveTo(R*0.5,-R*0.5); ctx.lineTo(R*0.95,-R*0.95);
      ctx.moveTo(-R*0.5,-R*0.5); ctx.lineTo(-R*0.95,-R*0.95);
      ctx.moveTo(-R*0.85,0); ctx.lineTo(-R*1.2, -R*0.35); ctx.moveTo(-R*0.85,0); ctx.lineTo(-R*1.2, R*0.35);
      fill();
      ctx.restore();
      break;
    case 'shield': { // эгида: ядро-квадрат + вращающаяся дуга щита
      ctx.rect(-R*0.6,-R*0.6,R*1.2,R*1.2); fill();
      dot(R*0.18);
      const a0 = t*2;
      ctx.beginPath(); ctx.arc(0, 0, R*1.35, a0, a0+TAU*0.6); ctx.stroke();
      break;
    }
    case 'split': { // делитель: клетка с двумя ядрами, готова разделиться
      ctx.save(); ctx.rotate(Math.sin(t*4)*0.12);
      ctx.beginPath(); ctx.arc(0, 0, R*0.85, 0, TAU); fill();
      ctx.beginPath(); ctx.moveTo(0, -R*0.85); ctx.lineTo(0, R*0.85); ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(-R*0.32, 0, R*0.2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(R*0.32, 0, R*0.2, 0, TAU); ctx.fill();
      ctx.restore();
      break;
    }
    case 'boss': { // босс: два встречно вращающихся шестигранника + орбита
      ctx.save(); ctx.rotate(t*0.35);
      for (let i=0;i<6;i++){ const a=i*TAU/6; i?ctx.lineTo(Math.cos(a)*R,Math.sin(a)*R):ctx.moveTo(Math.cos(a)*R,Math.sin(a)*R); }
      ctx.closePath(); fill();
      ctx.restore();
      ctx.save(); ctx.rotate(-t*0.6);
      ctx.beginPath();
      for (let i=0;i<6;i++){ const a=i*TAU/6; i?ctx.lineTo(Math.cos(a)*R*0.5,Math.sin(a)*R*0.5):ctx.moveTo(Math.cos(a)*R*0.5,Math.sin(a)*R*0.5); }
      ctx.closePath(); ctx.stroke();
      ctx.restore();
      dot(R*0.16);
      for (let i=0;i<3;i++){
        const a = t*1.5 + i*TAU/3;
        ctx.beginPath(); ctx.arc(Math.cos(a)*R*0.85, Math.sin(a)*R*0.85, R*0.1, 0, TAU);
        ctx.fillStyle = color; ctx.fill();
      }
      break;
    }
  }
  ctx.restore();
}

/* ---- Башни: восьмиугольная платформа + глиф типа + пипсы уровня ---- */
let SKIN_OVERRIDE = null; // превью скинов в магазине
function skinOf(){ return SKIN_OVERRIDE || S.skin || 'classic'; }
function towerSkin(base){
  const sk = skinOf();
  if (sk === 'chrome') return { main:'#d7dee8', hi:'#ffffff' };
  if (sk === 'neon')   return { main:'#ff4df0', hi:'#ffd9f6' };
  if (sk === 'toxic')  return { main:'#a4ff1e', hi:'#eaffc4' };
  return { main: base, hi: '#ffffff' };
}

function drawTowerAt(ctx, type, lvl, px, py, cs, aim, color){
  const R = cs*0.36;
  const skc = towerSkin(color);
  // платформа
  ctx.save(); ctx.translate(px,py);
  ctx.beginPath();
  for (let i=0;i<8;i++){ const a=i*TAU/8+TAU/16; i?ctx.lineTo(Math.cos(a)*R,Math.sin(a)*R):ctx.moveTo(Math.cos(a)*R,Math.sin(a)*R); }
  ctx.closePath();
  ctx.fillStyle = 'rgba(8,14,30,.9)'; ctx.fill();
  ctx.strokeStyle = hexA(skc.main,0.6); ctx.lineWidth = Math.max(1,cs*0.045); ctx.stroke();
  if (skinOf() !== 'classic'){ // кольцо-блик платформы на скинах
    ctx.strokeStyle = hexA(skc.hi,0.35); ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i=0;i<8;i++){ const a=i*TAU/8+TAU/16; i?ctx.lineTo(Math.cos(a)*R*0.72,Math.sin(a)*R*0.72):ctx.moveTo(Math.cos(a)*R*0.72,Math.sin(a)*R*0.72); }
    ctx.closePath(); ctx.stroke();
  }
  // глиф: основной штрих + детализированный тонкий повтор на скинах
  ctx.lineCap = 'round';
  const g = R*0.55;
  if (skinOf() === 'classic'){
    paintGlyph(ctx, type, g, aim, cs, color, Math.max(1.2, cs*0.055));
  } else {
    paintGlyph(ctx, type, g, aim, cs, skc.main, Math.max(1.4, cs*0.06));
    paintGlyph(ctx, type, g, aim, cs, skc.hi, Math.max(0.8, cs*0.022));
  }
  // пипсы уровня
  ctx.restore();
  if (lvl > 1){
    ctx.fillStyle = skc.main;
    for (let i=0;i<lvl;i++) ctx.fillRect(px-cs*0.16+i*cs*0.16, py+R+cs*0.06, cs*0.1, cs*0.05);
  }
}

/* Глиф башни: цвет и толщина задаются вызывающим */
function paintGlyph(ctx, type, g, aim, cs, color, lw){
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  switch(TOWERS[type].kind){
    case 'gun':
      ctx.save(); ctx.rotate(aim||0);
      ctx.moveTo(-g*0.5,0); ctx.lineTo(g,0); ctx.moveTo(-g*0.5,-g*0.45); ctx.lineTo(-g*0.5,g*0.45);
      ctx.stroke(); ctx.restore(); break;
    case 'cryo':
      for (let i=0;i<3;i++){ const a=i*TAU/3+(aim||0); ctx.moveTo(Math.cos(a)*g*0.3,Math.sin(a)*g*0.3); ctx.lineTo(Math.cos(a)*g,Math.sin(a)*g); }
      ctx.stroke(); break;
    case 'missile':
      ctx.save(); ctx.rotate(aim||0);
      ctx.moveTo(-g*0.4,-g*0.5); ctx.lineTo(g*0.8,0); ctx.lineTo(-g*0.4,g*0.5); ctx.closePath(); ctx.stroke();
      ctx.restore(); break;
    case 'tesla':
      ctx.moveTo(-g,0); ctx.lineTo(-g*0.2,0); ctx.lineTo(-g*0.35,-g*0.5); ctx.lineTo(g*0.4,g*0.05);
      ctx.lineTo(g*0.25,-g*0.45); ctx.lineTo(g,0.01);
      ctx.stroke(); break;
    case 'sniper':
      ctx.save(); ctx.rotate(aim||0);
      ctx.moveTo(-g*0.6,0); ctx.lineTo(g,0);
      ctx.moveTo(g*0.15,-g*0.35); ctx.lineTo(g*0.15,g*0.35);
      ctx.stroke(); ctx.restore(); break;
    case 'bank':
      ctx.moveTo(-g,g*0.7); ctx.lineTo(-g,-g*0.4); ctx.lineTo(0,-g); ctx.lineTo(g,-g*0.4); ctx.lineTo(g,g*0.7);
      ctx.moveTo(-g*0.45,g*0.7); ctx.lineTo(-g*0.45,-g*0.1); ctx.moveTo(0,g*0.7); ctx.lineTo(0,-g*0.1); ctx.moveTo(g*0.45,g*0.7); ctx.lineTo(g*0.45,-g*0.1);
      ctx.stroke(); break;
    case 'beam':
      ctx.save(); ctx.rotate(aim||0);
      ctx.rect(-g*0.7,-g*0.4,g*0.9,g*0.8); ctx.stroke();
      ctx.moveTo(g*0.2,0); ctx.lineTo(g,0); ctx.stroke();
      ctx.restore(); break;
    case 'poison': // колба с пузырьками
      ctx.beginPath(); ctx.arc(0, g*0.35, g*0.55, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-g*0.28, g*0.35-g*0.5); ctx.lineTo(g*0.28, g*0.35-g*0.5);
      ctx.moveTo(-g*0.22, g*0.35-g*0.5); ctx.lineTo(-g*0.22, g*0.35-g*0.15);
      ctx.moveTo(g*0.22, g*0.35-g*0.5); ctx.lineTo(g*0.22, g*0.35-g*0.15);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(-g*0.12, g*0.42, g*0.12, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(g*0.16, g*0.55, g*0.08, 0, TAU); ctx.stroke();
      break;
    case 'mortar': // мортира: короткий толстый ствол под углом вверх
      ctx.save(); ctx.rotate((aim||0) - 0.9);
      ctx.lineWidth = Math.max(2.5, cs*0.08);
      ctx.beginPath(); ctx.moveTo(-g*0.2, 0); ctx.lineTo(g, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(g, 0, g*0.28, 0, TAU); ctx.stroke();
      ctx.restore();
      ctx.beginPath(); ctx.arc(-g*0.25, g*0.25, g*0.3, 0, TAU); ctx.stroke();
      break;
    case 'amp': // излучатель: концентрические дуги
      ctx.beginPath(); ctx.arc(-g*0.35, 0, g*0.4, -TAU/4, TAU/4); ctx.stroke();
      ctx.beginPath(); ctx.arc(-g*0.35, 0, g*0.85, -TAU/4, TAU/4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-g*0.7, 0); ctx.lineTo(g*0.1, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(g*0.1, 0, g*0.16, 0, TAU); ctx.stroke();
      break;
  }
  ctx.restore();
}

/* Глиф башни: цвет и толщина задаются вызывающим */
function paintGlyph(ctx, type, g, aim, cs, color, lw){
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath();
  switch(TOWERS[type].kind){
    case 'gun':
      ctx.save(); ctx.rotate(aim||0);
      ctx.moveTo(-g*0.5,0); ctx.lineTo(g,0); ctx.moveTo(-g*0.5,-g*0.45); ctx.lineTo(-g*0.5,g*0.45);
      ctx.stroke(); ctx.restore(); break;
    case 'cryo':
      for (let i=0;i<3;i++){ const a=i*TAU/3+(aim||0); ctx.moveTo(Math.cos(a)*g*0.3,Math.sin(a)*g*0.3); ctx.lineTo(Math.cos(a)*g,Math.sin(a)*g); }
      ctx.stroke(); break;
    case 'missile':
      ctx.save(); ctx.rotate(aim||0);
      ctx.moveTo(-g*0.4,-g*0.5); ctx.lineTo(g*0.8,0); ctx.lineTo(-g*0.4,g*0.5); ctx.closePath(); ctx.stroke();
      ctx.restore(); break;
    case 'tesla':
      ctx.moveTo(-g,0); ctx.lineTo(-g*0.2,0); ctx.lineTo(-g*0.35,-g*0.5); ctx.lineTo(g*0.4,g*0.05);
      ctx.lineTo(g*0.25,-g*0.45); ctx.lineTo(g,0.01);
      ctx.stroke(); break;
    case 'sniper':
      ctx.save(); ctx.rotate(aim||0);
      ctx.moveTo(-g*0.6,0); ctx.lineTo(g,0);
      ctx.moveTo(g*0.15,-g*0.35); ctx.lineTo(g*0.15,g*0.35);
      ctx.stroke(); ctx.restore(); break;
    case 'bank':
      ctx.moveTo(-g,g*0.7); ctx.lineTo(-g,-g*0.4); ctx.lineTo(0,-g); ctx.lineTo(g,-g*0.4); ctx.lineTo(g,g*0.7);
      ctx.moveTo(-g*0.45,g*0.7); ctx.lineTo(-g*0.45,-g*0.1); ctx.moveTo(0,g*0.7); ctx.lineTo(0,-g*0.1); ctx.moveTo(g*0.45,g*0.7); ctx.lineTo(g*0.45,-g*0.1);
      ctx.stroke(); break;
    case 'beam':
      ctx.save(); ctx.rotate(aim||0);
      ctx.rect(-g*0.7,-g*0.4,g*0.9,g*0.8); ctx.stroke();
      ctx.moveTo(g*0.2,0); ctx.lineTo(g,0); ctx.stroke();
      ctx.restore(); break;
    case 'poison': // колба с пузырьками
      ctx.beginPath(); ctx.arc(0, g*0.35, g*0.55, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-g*0.28, g*0.35-g*0.5); ctx.lineTo(g*0.28, g*0.35-g*0.5);
      ctx.moveTo(-g*0.22, g*0.35-g*0.5); ctx.lineTo(-g*0.22, g*0.35-g*0.15);
      ctx.moveTo(g*0.22, g*0.35-g*0.5); ctx.lineTo(g*0.22, g*0.35-g*0.15);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(-g*0.12, g*0.42, g*0.12, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(g*0.16, g*0.55, g*0.08, 0, TAU); ctx.stroke();
      break;
    case 'mortar': // мортира: короткий толстый ствол под углом вверх
      ctx.save(); ctx.rotate((aim||0) - 0.9);
      ctx.lineWidth = Math.max(2.5, cs*0.08);
      ctx.beginPath(); ctx.moveTo(-g*0.2, 0); ctx.lineTo(g, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(g, 0, g*0.28, 0, TAU); ctx.stroke();
      ctx.restore();
      ctx.beginPath(); ctx.arc(-g*0.25, g*0.25, g*0.3, 0, TAU); ctx.stroke();
      break;
    case 'amp': // излучатель: концентрические дуги
      ctx.beginPath(); ctx.arc(-g*0.35, 0, g*0.4, -TAU/4, TAU/4); ctx.stroke();
      ctx.beginPath(); ctx.arc(-g*0.35, 0, g*0.85, -TAU/4, TAU/4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-g*0.7, 0); ctx.lineTo(g*0.1, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(g*0.1, 0, g*0.16, 0, TAU); ctx.stroke();
      break;
  }
  ctx.restore();
}

/* Иконки для DOM-карточек (data URL, рисуются один раз) */
const iconURLCache = {};
function towerIconURL(type){
  if (iconURLCache['t_'+type]) return iconURLCache['t_'+type];
  const size = 72, cv = document.createElement('canvas'); cv.width = cv.height = size;
  const c = cv.getContext('2d');
  c.translate(size/2, size/2 - 3);
  drawTowerAt(c, type, 1, 0, 0, 72, -TAU/8, TOWERS[type].color);
  drawGlow(c, 0, 0, 30, TOWERS[type].color, 0.5);
  const url = cv.toDataURL();
  iconURLCache['t_'+type] = url;
  return url;
}
