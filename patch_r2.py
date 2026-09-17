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

# ===== переработка моделек врагов =====
p = 'src/20_render.js'
edits = []

# дрон: стрела + ядро + антенна
edits.append((
"""    case 'tri': // дрон: стрелка с ядром
      ctx.moveTo(Math.cos(ang)*R, Math.sin(ang)*R);
      ctx.lineTo(Math.cos(ang+2.5)*R, Math.sin(ang+2.5)*R);
      ctx.lineTo(Math.cos(ang-2.5)*R, Math.sin(ang-2.5)*R);
      ctx.closePath(); fill();
      ctx.save(); ctx.rotate(ang); dot(R*0.22); ctx.restore();
      break;""",
"""    case 'tri': // дрон: стрела с ядром, антенной и стабилизаторами
      ctx.moveTo(Math.cos(ang)*R, Math.sin(ang)*R);
      ctx.lineTo(Math.cos(ang+2.5)*R, Math.sin(ang+2.5)*R);
      ctx.lineTo(Math.cos(ang-2.5)*R, Math.sin(ang-2.5)*R);
      ctx.closePath(); fill();
      ctx.save(); ctx.rotate(ang);
      dot(R*0.2);
      ctx.beginPath(); ctx.moveTo(-R*0.85, 0); ctx.lineTo(-R*1.35, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(-R*1.35, 0, R*0.12, 0, TAU); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(Math.cos(2.5)*R*0.9, Math.sin(2.5)*R*0.9);
      ctx.lineTo(Math.cos(2.9)*R*1.25, Math.sin(2.9)*R*1.25);
      ctx.moveTo(Math.cos(-2.5)*R*0.9, Math.sin(-2.5)*R*0.9);
      ctx.lineTo(Math.cos(-2.9)*R*1.25, Math.sin(-2.9)*R*1.25);
      ctx.stroke();
      ctx.restore();
      break;"""))

# бит: двойной ромб + искра
edits.append((
"""    case 'dia': // бит: вращающийся ромбик
      ctx.rotate(t*2.4);
      ctx.moveTo(0,-R); ctx.lineTo(R,0); ctx.lineTo(0,R); ctx.lineTo(-R,0);
      ctx.closePath(); fill();
      break;""",
"""    case 'dia': // бит: вращающийся ромб с внутренним ядром-искрой
      ctx.rotate(t*2.4);
      ctx.moveTo(0,-R); ctx.lineTo(R,0); ctx.lineTo(0,R); ctx.lineTo(-R,0);
      ctx.closePath(); fill();
      ctx.beginPath();
      ctx.moveTo(0,-R*0.45); ctx.lineTo(R*0.45,0); ctx.lineTo(0,R*0.45); ctx.lineTo(-R*0.45,0);
      ctx.closePath(); ctx.stroke();
      dot(R*0.12);
      break;"""))

# танк: гусеницы + башня
edits.append((
"""    case 'hex': // броневик: шестигранник с пластинами
      for (let i=0;i<6;i++){ const a=ang+i*TAU/6; i?ctx.lineTo(Math.cos(a)*R,Math.sin(a)*R):ctx.moveTo(Math.cos(a)*R,Math.sin(a)*R); }
      ctx.closePath(); fill();""",
"""    case 'hex': // броневик: корпус, гусеницы, башня со стволом
      ctx.save(); ctx.rotate(ang);
      ctx.lineWidth = lw*1.6;
      ctx.beginPath();
      ctx.moveTo(-R*0.7,-R*0.95); ctx.lineTo(R*0.7,-R*0.95);
      ctx.moveTo(-R*0.7, R*0.95); ctx.lineTo(R*0.7, R*0.95);
      ctx.stroke();
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(R*0.35,0); ctx.lineTo(R*1.15,0); ctx.stroke();
      ctx.restore();
      for (let i=0;i<6;i++){ const a=ang+i*TAU/6; i?ctx.lineTo(Math.cos(a)*R,Math.sin(a)*R):ctx.moveTo(Math.cos(a)*R,Math.sin(a)*R); }
      ctx.closePath(); fill();"""))

# медик: кольцо-капсула внутри креста
edits.append((
"""      ctx.closePath(); fill();
      ctx.globalAlpha *= 0.5;
      ctx.beginPath(); ctx.arc(0, 0, R*(1.25+0.18*Math.sin(t*4)), 0, TAU); ctx.stroke();
      break;""",
"""      ctx.closePath(); fill();
      dot(R*0.16);
      ctx.globalAlpha *= 0.5;
      ctx.beginPath(); ctx.arc(0, 0, R*(1.25+0.18*Math.sin(t*4)), 0, TAU); ctx.stroke();
      ctx.globalAlpha = alpha;
      break;"""))

# фантом: глаза-щели вместо точек
edits.append((
"""      ctx.save(); ctx.rotate(ang);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(R*0.3, -R*0.18, R*0.13, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(R*0.3, R*0.18, R*0.13, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.restore();
      break;""",
"""      ctx.save(); ctx.rotate(ang);
      ctx.lineWidth = lw*1.4;
      ctx.beginPath();
      ctx.moveTo(R*0.12, -R*0.28); ctx.lineTo(R*0.45, -R*0.12);
      ctx.moveTo(R*0.12,  R*0.28); ctx.lineTo(R*0.45,  R*0.12);
      ctx.stroke();
      ctx.restore();
      ctx.restore();
      break;"""))

# эгида: сегменты щита
edits.append((
"""    case 'shield': { // эгида: ядро-квадрат + вращающаяся дуга щита
      ctx.rect(-R*0.6,-R*0.6,R*1.2,R*1.2); fill();
      dot(R*0.18);
      const a0 = t*2;
      ctx.beginPath(); ctx.arc(0, 0, R*1.35, a0, a0+TAU*0.6); ctx.stroke();
      break;
    }""",
"""    case 'shield': { // эгида: ядро-квадрат + сегментированный вращающийся щит
      ctx.rect(-R*0.6,-R*0.6,R*1.2,R*1.2); fill();
      dot(R*0.18);
      const a0 = t*2;
      for (let k=0;k<3;k++){
        ctx.beginPath(); ctx.arc(0, 0, R*1.35, a0+k*TAU/3, a0+k*TAU/3+TAU*0.22); ctx.stroke();
      }
      break;
    }"""))

# делитель: пульс зазора
edits.append((
"""    case 'split': { // делитель: клетка с двумя ядрами, готова разделиться
      ctx.save(); ctx.rotate(Math.sin(t*4)*0.12);
      ctx.beginPath(); ctx.arc(0, 0, R*0.85, 0, TAU); fill();
      ctx.beginPath(); ctx.moveTo(0, -R*0.85); ctx.lineTo(0, R*0.85); ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(-R*0.32, 0, R*0.2, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(R*0.32, 0, R*0.2, 0, TAU); ctx.fill();
      ctx.restore();
      break;
    }""",
"""    case 'split': { // делитель: две делящиеся половины с пульсирующим зазором
      ctx.save();
      const gap = 0.16 + 0.14*Math.abs(Math.sin(t*3));
      ctx.rotate(Math.sin(t*4)*0.1);
      ctx.beginPath(); ctx.arc(-R*gap, 0, R*(0.8-gap*0.5), 0, TAU); fill();
      ctx.beginPath(); ctx.arc(R*gap, 0, R*(0.8-gap*0.5), 0, TAU); fill();
      dot(R*0.14);
      ctx.restore();
      break;
    }"""))

total += patch(p, edits)

# ===== i18n: две новые карты =====
p = 'src/10_i18n.js'
edits = []
edits.append((
"  map_arena:'Особое поле',",
"  map_arena:'Особое поле', map_cascade:'Каскад', map_labyrinth:'Лабиринт',"))
edits.append((
"  map_arena:'Arena',",
"  map_arena:'Arena', map_cascade:'Cascade', map_labyrinth:'Labyrinth',"))
total += patch(p, edits)

# ===== 14_data.js: две новые карты =====
edits = []
edits.append((
"""  { key:'map_mega',""",
"""  { key:'map_cascade', mult:1.65, need:24, color:'#c0ff4d',
    paths:[[[-1,0],[2,0],[2,3],[5,3],[5,0],[8,0],[8,3],[11,3],[11,6],[6,6],[6,8],[3,8]]],
    deco:[[0,4],[7,1],[10,4],[9,8],[1,2]] },
  { key:'map_labyrinth', mult:1.8,  need:26, color:'#8ab4ff',
    paths:[[[-1,4],[1,4],[1,1],[4,1],[4,7],[7,7],[7,1],[10,1],[10,4],[11,4]]],
    deco:[[2,5],[5,3],[8,3],[5,5],[8,5]] },
  { key:'map_mega',"""))
total += patch(p, edits)

# сложность: дописать метки
p = 'src/10_i18n.js'
edits = []
edits.append((
"  endless:'Бесконечный', diff:['Прогрев','Норма','Риск','Опасно','Жёстко','Критично','Легенда','Хаос'],",
"  endless:'Бесконечный', diff:['Прогрев','Норма','Риск','Опасно','Жёстко','Критично','Легенда','Хаос','Бездна','Вечность'],"))
edits.append((
"  endless:'Endless', diff:['Warmup','Normal','Risky','Danger','Tough','Critical','Legend','Chaos'],",
"  endless:'Endless', diff:['Warmup','Normal','Risky','Danger','Tough','Critical','Legend','Chaos','Abyss','Eternity'],"))
total += patch(p, edits)

print('PART 2 APPLIED:', total)
