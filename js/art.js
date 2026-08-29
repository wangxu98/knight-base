/* ============================================================
 * 骑士基地：世界起源 - art.js
 * 矢量绘制与离屏精灵缓存（骑士/敌人/Boss/棋盘/卡片/特效）
 * ============================================================ */
'use strict';
(function () {
  const M = KB.math;
  const art = KB.art = {};

  const spriteCache = {};    // 骑士精灵
  const cardCache = {};      // 卡面
  const boardCache = {};     // 棋盘底图

  art.clearCaches = function () {
    for (const k in spriteCache) delete spriteCache[k];
    for (const k in cardCache) delete cardCache[k];
    for (const k in boardCache) delete boardCache[k];
  };

  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
    return c;
  }
  art.makeCanvas = makeCanvas;

  function mix(hex, hex2, t) {
    const a = parseInt(hex.slice(1), 16), b = parseInt(hex2.slice(1), 16);
    const r = Math.round(((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t);
    const g = Math.round(((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t);
    const bl = Math.round((a & 255) * (1 - t) + (b & 255) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  /* ============ 骑士精灵 ============ */
  // 返回 size×size 离屏画布
  art.knightSprite = function (defId, rarity, size) {
    const key = defId + '|' + rarity + '|' + size;
    if (spriteCache[key]) return spriteCache[key];
    const def = KB.knightById(defId);
    const c = makeCanvas(size, size), ctx = c.getContext('2d');
    const s = size;
    const elem = def.elem === 'none' ? '#90a4c0' : KB.CONFIG.ELEMENTS[def.elem];
    const body = mix('#39476b', elem, 0.45);
    const rc = KB.CONFIG.RARITY_COLOR[rarity];

    ctx.save();
    // 品质底光
    if (rarity > 0) {
      const g = ctx.createRadialGradient(s / 2, s / 2, s * .2, s / 2, s / 2, s * .52);
      g.addColorStop(0, rarity === 2 ? 'rgba(255,200,50,.5)' : 'rgba(160,90,240,.4)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, s, s);
    }
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,.28)';
    ctx.beginPath(); ctx.ellipse(s / 2, s * .9, s * .26, s * .06, 0, 0, Math.PI * 2); ctx.fill();

    const cx = s / 2;
    // 腿
    ctx.fillStyle = '#2a3350';
    ctx.fillRect(cx - s * .13, s * .68, s * .09, s * .18);
    ctx.fillRect(cx + s * .04, s * .68, s * .09, s * .18);
    // 躯干
    ctx.fillStyle = body;
    M.roundRect(ctx, cx - s * .21, s * .38, s * .42, s * .34, s * .07); ctx.fill();
    // 肩甲
    ctx.fillStyle = mix(body, '#ffffff', .25);
    M.roundRect(ctx, cx - s * .27, s * .40, s * .12, s * .10, s * .04); ctx.fill();
    M.roundRect(ctx, cx + s * .15, s * .40, s * .12, s * .10, s * .04); ctx.fill();
    // 头
    ctx.fillStyle = '#f0c8a0';
    ctx.beginPath(); ctx.arc(cx, s * .30, s * .13, 0, Math.PI * 2); ctx.fill();
    // 头盔
    ctx.fillStyle = mix('#546e9e', elem, .5);
    ctx.beginPath(); ctx.arc(cx, s * .285, s * .135, Math.PI, 0); ctx.fill();
    ctx.fillRect(cx - s * .135, s * .275, s * .27, s * .03);
    // 面甲缝
    ctx.fillStyle = 'rgba(0,0,0,.4)';
    ctx.fillRect(cx - s * .09, s * .30, s * .18, s * .025);
    // 羽饰（品质色）
    ctx.strokeStyle = rc; ctx.lineWidth = s * .03;
    ctx.beginPath(); ctx.moveTo(cx, s * .16); ctx.quadraticCurveTo(cx + s * .1, s * .1, cx + s * .04, s * .05); ctx.stroke();

    // 武器
    drawWeapon(ctx, def.vis, cx, s, elem);
    ctx.restore();

    spriteCache[key] = c;
    return c;
  };

  function drawWeapon(ctx, vis, cx, s, elem) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#cfd8e8'; ctx.lineWidth = s * .035;
    const H = elem;
    switch (vis) {
      case 'sword':
        ctx.beginPath(); ctx.moveTo(cx + s * .22, s * .58); ctx.lineTo(cx + s * .38, s * .22); ctx.stroke();
        ctx.strokeStyle = H; ctx.lineWidth = s * .05;
        ctx.beginPath(); ctx.moveTo(cx + s * .17, s * .5); ctx.lineTo(cx + s * .3, s * .38); ctx.stroke();
        break;
      case 'dualsword':
        ctx.beginPath(); ctx.moveTo(cx + s * .2, s * .55); ctx.lineTo(cx + s * .35, s * .25); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - s * .2, s * .55); ctx.lineTo(cx - s * .35, s * .25); ctx.stroke();
        break;
      case 'axe':
        ctx.beginPath(); ctx.moveTo(cx + s * .22, s * .62); ctx.lineTo(cx + s * .36, s * .24); ctx.stroke();
        ctx.fillStyle = '#b0bec5';
        M.roundRect(ctx, cx + s * .3, s * .18, s * .13, s * .12, s * .02); ctx.fill();
        break;
      case 'hammer':
        ctx.beginPath(); ctx.moveTo(cx + s * .22, s * .62); ctx.lineTo(cx + s * .34, s * .3); ctx.stroke();
        ctx.fillStyle = '#90a4ae';
        M.roundRect(ctx, cx + s * .26, s * .18, s * .17, s * .13, s * .02); ctx.fill();
        break;
      case 'shield':
        ctx.fillStyle = mix('#78909c', H, .3);
        M.roundRect(ctx, cx + s * .16, s * .42, s * .2, s * .26, s * .05); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = s * .02;
        M.roundRect(ctx, cx + s * .18, s * .44, s * .16, s * .22, s * .04); ctx.stroke();
        break;
      case 'spear':
        ctx.beginPath(); ctx.moveTo(cx + s * .16, s * .66); ctx.lineTo(cx + s * .4, s * .16); ctx.stroke();
        ctx.fillStyle = H;
        ctx.beginPath(); ctx.moveTo(cx + s * .36, s * .2); ctx.lineTo(cx + s * .44, s * .08); ctx.lineTo(cx + s * .42, s * .22); ctx.closePath(); ctx.fill();
        break;
      case 'fist':
        ctx.fillStyle = H;
        ctx.beginPath(); ctx.arc(cx + s * .3, s * .5, s * .07, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx - s * .3, s * .5, s * .07, 0, Math.PI * 2); ctx.fill();
        break;
      case 'dagger':
        ctx.beginPath(); ctx.moveTo(cx + s * .24, s * .52); ctx.lineTo(cx + s * .35, s * .32); ctx.stroke();
        ctx.strokeStyle = H; ctx.lineWidth = s * .04;
        ctx.beginPath(); ctx.moveTo(cx - s * .24, s * .52); ctx.lineTo(cx - s * .35, s * .32); ctx.stroke();
        break;
      case 'katana':
        ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = s * .028;
        ctx.beginPath(); ctx.moveTo(cx + s * .2, s * .6);
        ctx.quadraticCurveTo(cx + s * .34, s * .36, cx + s * .3, s * .18); ctx.stroke();
        break;
      case 'scythe':
        ctx.beginPath(); ctx.moveTo(cx + s * .2, s * .64); ctx.lineTo(cx + s * .3, s * .2); ctx.stroke();
        ctx.strokeStyle = H; ctx.lineWidth = s * .035;
        ctx.beginPath(); ctx.arc(cx + s * .2, s * .22, s * .13, -Math.PI * .4, Math.PI * .45); ctx.stroke();
        break;
      case 'bow':
        ctx.strokeStyle = '#a1887f'; ctx.lineWidth = s * .035;
        ctx.beginPath(); ctx.arc(cx + s * .26, s * .42, s * .16, -Math.PI * .45, Math.PI * .45); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = s * .012;
        ctx.beginPath(); ctx.moveTo(cx + s * .34, s * .31); ctx.lineTo(cx + s * .34, s * .53); ctx.stroke();
        break;
      case 'crossbow':
        ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = s * .04;
        ctx.beginPath(); ctx.moveTo(cx + s * .16, s * .56); ctx.lineTo(cx + s * .4, s * .36); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + s * .24, s * .26); ctx.lineTo(cx + s * .42, s * .44); ctx.stroke();
        break;
      case 'catapult':
        ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = s * .04;
        ctx.beginPath(); ctx.moveTo(cx + s * .14, s * .62); ctx.lineTo(cx + s * .36, s * .26); ctx.stroke();
        ctx.fillStyle = '#78909c';
        ctx.beginPath(); ctx.arc(cx + s * .38, s * .22, s * .06, 0, Math.PI * 2); ctx.fill();
        break;
      case 'gun':
        ctx.fillStyle = '#546e7a';
        M.roundRect(ctx, cx + s * .16, s * .46, s * .26, s * .07, s * .02); ctx.fill();
        M.roundRect(ctx, cx + s * .2, s * .5, s * .07, s * .1, s * .02); ctx.fill();
        break;
      case 'staff':
        ctx.strokeStyle = '#8d6e63'; ctx.lineWidth = s * .035;
        ctx.beginPath(); ctx.moveTo(cx + s * .24, s * .64); ctx.lineTo(cx + s * .32, s * .24); ctx.stroke();
        ctx.fillStyle = H;
        ctx.beginPath(); ctx.arc(cx + s * .33, s * .2, s * .055, 0, Math.PI * 2); ctx.fill();
        break;
      case 'orb':
        ctx.fillStyle = H;
        ctx.beginPath(); ctx.arc(cx + s * .3, s * .4, s * .08, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = s * .015;
        ctx.beginPath(); ctx.arc(cx + s * .3, s * .4, s * .08, -2.4, -0.8); ctx.stroke();
        break;
      case 'tome':
        ctx.fillStyle = mix('#5d4037', H, .35);
        M.roundRect(ctx, cx + s * .16, s * .42, s * .2, s * .16, s * .02); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.8)';
        ctx.fillRect(cx + s * .25, s * .42, s * .015, s * .16);
        break;
      case 'potion':
        ctx.fillStyle = H;
        M.roundRect(ctx, cx + s * .24, s * .4, s * .12, s * .16, s * .04); ctx.fill();
        ctx.fillStyle = '#b0bec5';
        ctx.fillRect(cx + s * .27, s * .34, s * .06, s * .07);
        break;
      default:
        ctx.beginPath(); ctx.moveTo(cx + s * .22, s * .58); ctx.lineTo(cx + s * .36, s * .26); ctx.stroke();
    }
  }

  /* ============ 卡面 ============ */
  // w×h 缓存：品质底/emoji/名称/费用
  art.cardFace = function (defId, rarity, w, h) {
    const key = defId + '|' + rarity + '|' + w + 'x' + h;
    if (cardCache[key]) return cardCache[key];
    const def = KB.knightById(defId);
    const c = makeCanvas(w, h), ctx = c.getContext('2d');
    const rc = KB.CONFIG.RARITY_COLOR[rarity];
    const bg = rarity === 2 ? 'linear:gold' : null;

    ctx.fillStyle = rarity === 0 ? 'rgba(38,48,78,.95)' : rarity === 1 ? 'rgba(58,38,92,.95)' : 'rgba(84,64,16,.95)';
    M.roundRect(ctx, 1.5, 1.5, w - 3, h - 3, 10); ctx.fill();
    // 渐变高光
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    M.roundRect(ctx, 1.5, 1.5, w - 3, h - 3, 10); ctx.fill();
    ctx.strokeStyle = rc; ctx.lineWidth = 2;
    M.roundRect(ctx, 1.5, 1.5, w - 3, h - 3, 10); ctx.stroke();

    // emoji 主体
    ctx.font = Math.round(h * 0.44) + 'px ' + KB.ui.FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(def.emoji, w / 2, h * 0.42);
    // 名称
    ctx.font = KB.ui.font(Math.max(10, Math.round(h * 0.13)), 'bold');
    ctx.fillStyle = '#fff';
    ctx.fillText(def.name, w / 2, h * 0.78);
    // 技能名小字
    ctx.font = KB.ui.font(Math.max(8, Math.round(h * 0.10)));
    ctx.fillStyle = 'rgba(255,255,255,.62)';
    ctx.fillText(def.skill, w / 2, h * 0.9);
    cardCache[key] = c;
    return c;
  }

  /* ============ 棋盘底图 ============ */
  art.boardBg = function (worldIdx, cellW, cellH, rows, cols, coreW) {
    const w = Math.ceil(cols * cellW + coreW), h = Math.ceil(rows * cellH);
    const key = worldIdx + '|' + w + 'x' + h;
    if (boardCache[key]) return boardCache[key];
    const pal = KB.WORLDS[worldIdx].pal;
    const c = makeCanvas(w, h), ctx = c.getContext('2d');
    // 核心区地基
    ctx.fillStyle = mix(pal.laneB, '#000000', .25);
    ctx.fillRect(0, 0, coreW, h);
    // 行道棋盘格
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        ctx.fillStyle = ((r + col) % 2 === 0) ? pal.laneA : pal.laneB;
        ctx.fillRect(coreW + col * cellW, r * cellH, cellW, cellH);
      }
      // 行分隔线
      ctx.fillStyle = 'rgba(0,0,0,.10)';
      ctx.fillRect(coreW, r * cellH, cols * cellW, 1.5);
    }
    // 竖网格
    ctx.fillStyle = 'rgba(0,0,0,.06)';
    for (let col = 1; col < cols; col++) ctx.fillRect(coreW + col * cellW, 0, 1, h);
    // 右侧入口渐变（敌袭方向）
    const g = ctx.createLinearGradient(w - cellW * 1.2, 0, w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(120,10,10,.35)');
    ctx.fillStyle = g; ctx.fillRect(w - cellW * 1.2, 0, cellW * 1.2, h);
    boardCache[key] = c;
    return c;
  }

  /* ============ 敌人 ============ */
  art.drawEnemy = function (ctx, e, time) {
    const r = e.r; // 半径
    const pal = e.pal;
    const body = e.kind === 'boss' ? pal.accent : pal.enemy;
    const bob = Math.sin(time * 6 + e.phase) * r * 0.06;
    ctx.save();
    ctx.translate(e.x, e.y + bob);
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(0, r * 1.05 - bob, r * .8, r * .22, 0, 0, Math.PI * 2); ctx.fill();

    if (e.kind === 'boss') {
      // Boss: 大身体 + 双角 + 王冠
      ctx.fillStyle = mix(body, '#000', .25);
      M.roundRect(ctx, -r * .8, -r * .5, r * 1.6, r * 1.4, r * .3); ctx.fill();
      ctx.fillStyle = body;
      M.roundRect(ctx, -r * .7, -r * .6, r * 1.4, r * 1.3, r * .28); ctx.fill();
      // 眼睛
      ctx.fillStyle = '#ff5252';
      ctx.beginPath(); ctx.arc(-r * .25, -r * .15, r * .12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * .25, -r * .15, r * .12, 0, Math.PI * 2); ctx.fill();
      // 角
      ctx.strokeStyle = '#eceff1'; ctx.lineWidth = r * .12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-r * .5, -r * .55); ctx.lineTo(-r * .75, -r * .95); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * .5, -r * .55); ctx.lineTo(r * .75, -r * .95); ctx.stroke();
      // 王冠
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath();
      ctx.moveTo(-r * .35, -r * .68); ctx.lineTo(-r * .2, -r * .95); ctx.lineTo(0, -r * .72);
      ctx.lineTo(r * .2, -r * .95); ctx.lineTo(r * .35, -r * .68); ctx.closePath(); ctx.fill();
    } else {
      // 普通敌：按原型形状
      switch (e.arch) {
        case 'runner':
          ctx.fillStyle = mix(body, '#fff', .12);
          ctx.beginPath(); ctx.ellipse(0, 0, r * .6, r * .8, 0, 0, Math.PI * 2); ctx.fill();
          break;
        case 'tank':
          ctx.fillStyle = mix(body, '#000', .3);
          M.roundRect(ctx, -r * .85, -r * .75, r * 1.7, r * 1.55, r * .25); ctx.fill();
          ctx.fillStyle = body;
          M.roundRect(ctx, -r * .7, -r * .62, r * 1.4, r * 1.3, r * .2); ctx.fill();
          break;
        case 'bomber':
          ctx.fillStyle = '#d84315';
          ctx.beginPath(); ctx.arc(0, 0, r * .75, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = r * .1;
          ctx.beginPath(); ctx.moveTo(0, -r * .75); ctx.quadraticCurveTo(r * .3, -r * 1.1, r * .1, -r * 1.2); ctx.stroke();
          ctx.fillStyle = Math.sin(time * 12) > 0 ? '#fff59d' : '#ff9800';
          ctx.beginPath(); ctx.arc(r * .1, -r * 1.25, r * .1, 0, Math.PI * 2); ctx.fill();
          break;
        case 'healer':
          ctx.fillStyle = mix(body, '#4caf50', .35);
          ctx.beginPath(); ctx.arc(0, 0, r * .7, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#eceff1'; ctx.lineWidth = r * .12;
          ctx.beginPath(); ctx.moveTo(-r * .25, -r * .3); ctx.lineTo(r * .25, r * .2); ctx.stroke();
          break;
        case 'shielded': {
          ctx.fillStyle = body;
          M.roundRect(ctx, -r * .55, -r * .7, r * 1.1, r * 1.4, r * .2); ctx.fill();
          // 前方盾
          ctx.fillStyle = 'rgba(200,220,255,.85)';
          M.roundRect(ctx, -r * .95, -r * .55, r * .35, r * 1.1, r * .1); ctx.fill();
          break;
        }
        case 'spawner':
          ctx.fillStyle = mix(body, '#8bc34a', .25);
          ctx.beginPath(); ctx.ellipse(0, 0, r * .9, r * .75, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.5)';
          for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-r * .3 + i * r * .3, r * .15, r * .12, 0, Math.PI * 2); ctx.fill(); }
          break;
        case 'slinger':
          ctx.fillStyle = body;
          ctx.beginPath(); ctx.arc(0, 0, r * .62, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = '#a1887f'; ctx.lineWidth = r * .1;
          ctx.beginPath(); ctx.moveTo(-r * .1, 0); ctx.lineTo(-r * .9, -r * .3); ctx.stroke();
          break;
        case 'elite':
          ctx.fillStyle = mix(body, '#ffd54f', .2);
          M.roundRect(ctx, -r * .6, -r * .85, r * 1.2, r * 1.7, r * .22); ctx.fill();
          ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = r * .1;
          ctx.beginPath(); ctx.moveTo(r * .4, r * .3); ctx.lineTo(r * .95, -r * .5); ctx.stroke();
          break;
        default: // scraper
          ctx.fillStyle = body;
          ctx.beginPath(); ctx.arc(0, 0, r * .68, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,.85)';
          ctx.beginPath(); ctx.arc(-r * .2, -r * .15, r * .12, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(r * .2, -r * .15, r * .12, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#000';
          ctx.beginPath(); ctx.arc(-r * .18, -r * .12, r * .05, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(r * .22, -r * .12, r * .05, 0, Math.PI * 2); ctx.fill();
      }
      // 血条
      const bw = r * 1.6, hpPct = M.clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      ctx.fillRect(-bw / 2, -r * 1.25, bw, r * .18);
      ctx.fillStyle = hpPct > .5 ? '#66bb6a' : hpPct > .25 ? '#ffa726' : '#ef5350';
      ctx.fillRect(-bw / 2, -r * 1.25, bw * hpPct, r * .18);
      // 护盾条
      if (e.shield > 0) {
        ctx.fillStyle = 'rgba(120,200,255,.9)';
        ctx.fillRect(-bw / 2, -r * 1.25 - r * .22, bw * M.clamp(e.shield / e.maxHp, 0, 1), r * .14);
      }
    }
    ctx.restore();

    // 状态标记
    if (e.stunned) {
      ctx.fillStyle = '#4fc3f7';
      ctx.font = Math.round(r * .7) + 'px ' + KB.ui.FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✦', e.x, e.y - r * 1.5);
    } else if (e.slowPct > 0) {
      ctx.fillStyle = 'rgba(140,220,255,.85)';
      ctx.beginPath(); ctx.arc(e.x, e.y - r * 1.3, r * .18, 0, Math.PI * 2); ctx.fill();
    }
  };

  /* ============ 基地核心（城堡） ============ */
  art.drawCore = function (ctx, x, y, w, h, hpPct, time) {
    const flash = hpPct < 0.3 && Math.sin(time * 8) > 0;
    ctx.save();
    ctx.translate(x, y);
    // 主体
    ctx.fillStyle = flash ? '#8b3a3a' : '#5c6bc0';
    M.roundRect(ctx, -w * .38, -h * .3, w * .76, h * .62, 6); ctx.fill();
    // 城垛
    ctx.fillStyle = flash ? '#a04a4a' : '#7986cb';
    for (let i = 0; i < 4; i++) ctx.fillRect(-w * .38 + i * w * .2, -h * .42, w * .12, h * .14);
    // 大门
    ctx.fillStyle = '#3e2723';
    M.roundRect(ctx, -w * .1, -h * .05, w * .2, h * .37, 5); ctx.fill();
    // 旗帜
    ctx.strokeStyle = '#b0bec5'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -h * .42); ctx.lineTo(0, -h * .62); ctx.stroke();
    ctx.fillStyle = '#ef5350';
    ctx.beginPath(); ctx.moveTo(0, -h * .62); ctx.lineTo(w * .22, -h * .55); ctx.lineTo(0, -h * .48); ctx.closePath(); ctx.fill();
    ctx.restore();
    // 血量环
    const cx = x, cy = y + h * .45;
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    M.roundRect(ctx, cx - w * .42, cy, w * .84, 8, 4); ctx.fill();
    ctx.fillStyle = hpPct > .5 ? '#66bb6a' : hpPct > .25 ? '#ffa726' : '#ef5350';
    M.roundRect(ctx, cx - w * .42, cy, w * .84 * M.clamp(hpPct, 0, 1), 8, 4); ctx.fill();
  };

  /* ============ 项目精灵 ============ */
  art.drawProjectile = function (ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    const ang = Math.atan2(p.vy, p.vx);
    ctx.rotate(ang);
    switch (p.sprite) {
      case 'arrow':
        ctx.strokeStyle = '#eceff1'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(7, 0); ctx.stroke();
        ctx.fillStyle = '#cfd8e8';
        ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(2, -3); ctx.lineTo(2, 3); ctx.closePath(); ctx.fill();
        break;
      case 'rock':
        ctx.fillStyle = '#8d6e63';
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
        break;
      case 'bullet':
        ctx.fillStyle = '#ffd54f';
        M.roundRect(ctx, -6, -2, 12, 4, 2); ctx.fill();
        break;
      case 'bolt':
        ctx.fillStyle = '#b0bec5';
        M.roundRect(ctx, -7, -1.5, 14, 3, 1.5); ctx.fill();
        break;
      case 'fire':
        ctx.fillStyle = '#ff7043';
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,235,59,.8)';
        ctx.beginPath(); ctx.arc(-3, 0, 3, 0, Math.PI * 2); ctx.fill();
        break;
      case 'orb':
        ctx.fillStyle = p.color || '#fff176';
        ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 5.5, -2.4, -0.8); ctx.stroke();
        break;
      case 'spear':
        ctx.strokeStyle = '#a1887f'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(6, 0); ctx.stroke();
        break;
      case 'potion':
        ctx.fillStyle = '#9ccc65';
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
        break;
      case 'meteor':
        ctx.fillStyle = '#ff8a65';
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd54f';
        ctx.beginPath(); ctx.arc(-3, -3, 4, 0, Math.PI * 2); ctx.fill();
        break;
      default:
        ctx.fillStyle = '#eceff1';
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };
})();
