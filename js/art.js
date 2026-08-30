/* ============================================================
 * 骑士基地：世界起源 - art.js
 * 矢量绘制与离屏精灵缓存（骑士/敌人/Boss/棋盘/卡片/特效）
 * v2 视觉大改：多层光影 / 金属质感 / 纹理细节 / 元素氛围
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
    const bl = Math.round((a & 255) * (1 - t) + ((b & 255) & 255) * t);
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }
  function rgba(hex, a) {
    const v = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + a + ')';
  }
  /* 确定性 2D 哈希 → 0..1（纹理抖动用，稳定不复现随机） */
  function hash2(a, b) {
    let h = (a * 374761393 + b * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  /* 三段金属/布料渐变 */
  function metalGrad(ctx, x0, y0, x1, y1, hi, base, lo) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, hi); g.addColorStop(.45, base); g.addColorStop(1, lo);
    return g;
  }

  /* 品质金属三色（卡框/甲片通用） */
  function rarityMetal(r) {
    return r === 2
      ? { hi: '#ffe9a0', base: '#e0b23c', lo: '#7a5a10' }
      : r === 1
        ? { hi: '#d8b0ff', base: '#a86cf0', lo: '#4a2570' }
        : { hi: '#c4d0e6', base: '#93a2bd', lo: '#4c5570' };
  }

  /* ============ 骑士精灵 ============ */
  art.knightSprite = function (defId, rarity, size) {
    const key = defId + '|' + rarity + '|' + size;
    if (spriteCache[key]) return spriteCache[key];
    const def = KB.knightById(defId);
    const c = makeCanvas(size, size), ctx = c.getContext('2d');
    const s = size, cx = s / 2;
    const elem = def.elem === 'none' ? '#90a4c0' : KB.CONFIG.ELEMENTS[def.elem];
    const body = mix('#39476b', elem, 0.45);
    const bodyHi = mix(body, '#ffffff', .32);
    const bodyLo = mix(body, '#000010', .38);
    const rc = KB.CONFIG.RARITY_COLOR[rarity];
    const met = rarityMetal(rarity);
    const q = Math.max(1, s / 170);   // 细节尺度（170 基准）

    ctx.save();
    ctx.lineJoin = 'round';

    /* ---- 元素底光晕 ---- */
    const auraR = s * .52;
    const ag = ctx.createRadialGradient(cx, s * .46, s * .06, cx, s * .46, auraR);
    const auraA = rarity === 2 ? .40 : rarity === 1 ? .30 : .18;
    ag.addColorStop(0, rgba(elem, auraA));
    ag.addColorStop(.6, rgba(elem, auraA * .35));
    ag.addColorStop(1, rgba(elem, 0));
    ctx.fillStyle = ag;
    ctx.fillRect(0, 0, s, s);
    /* 传说：背景金色射线 */
    if (rarity === 2) {
      ctx.save();
      ctx.translate(cx, s * .46);
      ctx.fillStyle = 'rgba(255,214,90,.10)';
      for (let i = 0; i < 8; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI / 4 + .3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-s * .07, -auraR * .9);
        ctx.lineTo(s * .07, -auraR * .9);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    /* ---- 地面影 ---- */
    const shg = ctx.createRadialGradient(cx, s * .9, 0, cx, s * .9, s * .3);
    shg.addColorStop(0, 'rgba(0,0,0,.38)'); shg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shg;
    ctx.beginPath(); ctx.ellipse(cx, s * .9, s * .3, s * .08, 0, 0, Math.PI * 2); ctx.fill();

    /* ---- 披风（身后，元素深色） ---- */
    const cape = mix(bodyLo, '#1a1030', .5);
    ctx.fillStyle = cape;
    ctx.beginPath();
    ctx.moveTo(cx - s * .20, s * .40);
    ctx.quadraticCurveTo(cx - s * .34, s * .56, cx - s * .27, s * .74);
    ctx.quadraticCurveTo(cx - s * .16, s * .70, cx - s * .12, s * .76);
    ctx.quadraticCurveTo(cx - s * .05, s * .70, cx + s * .04, s * .76);
    ctx.quadraticCurveTo(cx + s * .13, s * .70, cx + s * .24, s * .73);
    ctx.quadraticCurveTo(cx + s * .33, s * .55, cx + s * .20, s * .40);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = q;
    ctx.beginPath(); ctx.moveTo(cx - s * .13, s * .44); ctx.quadraticCurveTo(cx - s * .2, s * .58, cx - s * .16, s * .72); ctx.stroke();

    /* ---- 腿 + 靴 ---- */
    for (const lx of [-s * .13, s * .04]) {
      ctx.fillStyle = '#242c48';
      M.roundRect(ctx, cx + lx, s * .66, s * .09, s * .17, s * .025); ctx.fill();
      ctx.fillStyle = mix('#161c30', elem, .18);
      M.roundRect(ctx, cx + lx - s * .012, s * .79, s * .115, s * .055, s * .02); ctx.fill();
    }

    /* ---- 躯干铠甲 ---- */
    const tg = metalGrad(ctx, 0, s * .38, 0, s * .72, bodyHi, body, bodyLo);
    ctx.fillStyle = tg;
    M.roundRect(ctx, cx - s * .21, s * .38, s * .42, s * .34, s * .07); ctx.fill();
    ctx.strokeStyle = 'rgba(10,14,34,.55)'; ctx.lineWidth = q * 1.2;
    M.roundRect(ctx, cx - s * .21, s * .38, s * .42, s * .34, s * .07); ctx.stroke();
    /* 胸甲中缝 + 腰带 */
    ctx.strokeStyle = 'rgba(10,14,34,.4)'; ctx.lineWidth = q;
    ctx.beginPath(); ctx.moveTo(cx, s * .40); ctx.lineTo(cx, s * .64); ctx.stroke();
    ctx.fillStyle = 'rgba(12,16,32,.8)';
    M.roundRect(ctx, cx - s * .20, s * .615, s * .40, s * .045, s * .02); ctx.fill();
    ctx.fillStyle = met.base;
    M.roundRect(ctx, cx - s * .035, s * .605, s * .07, s * .062, s * .015); ctx.fill();
    ctx.fillStyle = met.hi;
    M.roundRect(ctx, cx - s * .028, s * .612, s * .055, s * .022, s * .01); ctx.fill();
    /* 胸章：元素菱形 */
    ctx.fillStyle = rgba(elem, .95);
    ctx.beginPath();
    ctx.moveTo(cx, s * .44); ctx.lineTo(cx + s * .05, s * .505); ctx.lineTo(cx, s * .57); ctx.lineTo(cx - s * .05, s * .505);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = q * .8; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath(); ctx.arc(cx, s * .49, s * .012, 0, Math.PI * 2); ctx.fill();

    /* ---- 肩甲（带沿口高光） ---- */
    for (const side of [-1, 1]) {
      const px = cx + side * s * .21 - (side < 0 ? 0 : s * .12);
      const pg = metalGrad(ctx, 0, s * .395, 0, s * .50, bodyHi, body, bodyLo);
      ctx.fillStyle = pg;
      M.roundRect(ctx, cx + side * s * .27 - s * .065, s * .395, s * .13, s * .115, s * .045); ctx.fill();
      ctx.strokeStyle = 'rgba(10,14,34,.5)'; ctx.lineWidth = q;
      M.roundRect(ctx, cx + side * s * .27 - s * .065, s * .395, s * .13, s * .115, s * .045); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = q * 1.1;
      ctx.beginPath(); ctx.arc(cx + side * s * .27, s * .43, s * .048, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      /* 品质铆钉 */
      ctx.fillStyle = met.base;
      ctx.beginPath(); ctx.arc(cx + side * s * .27, s * .485, s * .014, 0, Math.PI * 2); ctx.fill();
      /* 手臂 + 元素护手 */
      ctx.fillStyle = mix(body, '#000010', .2);
      M.roundRect(ctx, cx + side * s * .30 - s * .03, s * .49, s * .062, s * .15, s * .028); ctx.fill();
      ctx.fillStyle = mix(elem, '#20263c', .35);
      ctx.beginPath(); ctx.arc(cx + side * s * .30, s * .655, s * .042, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.4)';
      ctx.beginPath(); ctx.arc(cx + side * s * .30 - s * .014, s * .642, s * .013, 0, Math.PI * 2); ctx.fill();
    }

    /* ---- 头 + 头盔 ---- */
    ctx.fillStyle = '#e8bc8f';
    ctx.beginPath(); ctx.arc(cx, s * .305, s * .125, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    ctx.beginPath(); ctx.arc(cx, s * .315, s * .125, 0, Math.PI * .35, Math.PI * .65); ctx.fill();
    /* 盔体 */
    const hg = metalGrad(ctx, 0, s * .155, 0, s * .31, mix('#7d90c0', elem, .35), mix('#546e9e', elem, .5), mix('#33406b', elem, .35));
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.arc(cx, s * .288, s * .138, Math.PI, 0); ctx.fill();
    M.roundRect(ctx, cx - s * .138, s * .278, s * .276, s * .05, s * .015); ctx.fill();
    /* 面甲缝 + 阴影 */
    ctx.fillStyle = 'rgba(8,10,24,.75)';
    M.roundRect(ctx, cx - s * .092, s * .302, s * .184, s * .028, s * .012); ctx.fill();
    ctx.fillStyle = mix(elem, '#ffffff', .55);
    ctx.fillRect(cx - s * .062, s * .306, s * .03, s * .012);
    ctx.fillRect(cx + s * .032, s * .306, s * .03, s * .012);
    /* 盔沿高光 + 品质镶边 */
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = q;
    ctx.beginPath(); ctx.arc(cx, s * .288, s * .128, Math.PI * 1.12, Math.PI * 1.75); ctx.stroke();
    ctx.strokeStyle = met.base; ctx.lineWidth = q * 1.3;
    ctx.beginPath(); ctx.moveTo(cx - s * .138, s * .328); ctx.lineTo(cx + s * .138, s * .328); ctx.stroke();
    /* 盔顶脊 */
    ctx.strokeStyle = mix('#8fa3cf', elem, .4); ctx.lineWidth = q * 1.6;
    ctx.beginPath(); ctx.moveTo(cx, s * .16); ctx.lineTo(cx, s * .20); ctx.stroke();
    /* 羽饰（品质色，级数随品质） */
    const plumes = rarity === 2 ? 3 : rarity === 1 ? 2 : 1;
    for (let i = 0; i < plumes; i++) {
      const off = (i - (plumes - 1) / 2) * s * .05;
      ctx.strokeStyle = i === 1 && plumes === 3 ? mix(rc, '#ffffff', .3) : rc;
      ctx.lineWidth = s * .026; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cx + off * .4, s * .165);
      ctx.quadraticCurveTo(cx + off + s * .1, s * .1, cx + off * .8 + s * .035, s * .045);
      ctx.stroke();
    }

    /* ---- 武器 ---- */
    drawWeapon(ctx, def.vis, cx, s, elem, met);

    ctx.restore();
    spriteCache[key] = c;
    return c;
  };

  function drawWeapon(ctx, vis, cx, s, elem, met) {
    ctx.lineCap = 'round';
    const shaft = (x0, y0, x1, y1, w0) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, '#a98d6d'); g.addColorStop(.5, '#8d6e53'); g.addColorStop(1, '#5d4634');
      ctx.strokeStyle = g; ctx.lineWidth = w0;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    };
    const blade = (x0, y0, x1, y1, w0) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, '#ffffff'); g.addColorStop(.35, '#dbe4f2'); g.addColorStop(1, '#93a2b8');
      ctx.strokeStyle = g; ctx.lineWidth = w0;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.arc(x1, y1, w0 * .32, 0, Math.PI * 2); ctx.fill();
    };
    const H = elem;
    switch (vis) {
      case 'sword':
        blade(cx + s * .22, s * .56, cx + s * .38, s * .2, s * .042);
        shaft(cx + s * .17, s * .62, cx + s * .22, s * .56, s * .05);
        ctx.strokeStyle = met.base; ctx.lineWidth = s * .055;
        ctx.beginPath(); ctx.moveTo(cx + s * .17, s * .545); ctx.lineTo(cx + s * .245, s * .60); ctx.stroke();
        break;
      case 'dualsword':
        blade(cx + s * .2, s * .53, cx + s * .35, s * .23, s * .036);
        blade(cx - s * .2, s * .53, cx - s * .35, s * .23, s * .036);
        ctx.strokeStyle = H; ctx.lineWidth = s * .022;
        ctx.beginPath(); ctx.moveTo(cx + s * .19, s * .5); ctx.lineTo(cx + s * .3, s * .38); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx - s * .19, s * .5); ctx.lineTo(cx - s * .3, s * .38); ctx.stroke();
        break;
      case 'axe':
        shaft(cx + s * .2, s * .64, cx + s * .36, s * .22, s * .042);
        ctx.fillStyle = metalGrad(ctx, cx + s * .28, s * .16, cx + s * .44, s * .3, '#e8eef6', '#aebccb', '#5f6c80');
        ctx.beginPath();
        ctx.moveTo(cx + s * .30, s * .17); ctx.quadraticCurveTo(cx + s * .45, s * .2, cx + s * .42, s * .32);
        ctx.quadraticCurveTo(cx + s * .37, s * .3, cx + s * .29, s * .28); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(20,26,44,.5)'; ctx.lineWidth = s * .012; ctx.stroke();
        break;
      case 'hammer':
        shaft(cx + s * .2, s * .64, cx + s * .34, s * .3, s * .044);
        ctx.fillStyle = metalGrad(ctx, cx + s * .24, s * .16, cx + s * .42, s * .32, '#cfd9e6', '#93a2b5', '#546176');
        M.roundRect(ctx, cx + s * .25, s * .16, s * .17, s * .14, s * .025); ctx.fill();
        ctx.strokeStyle = 'rgba(20,26,44,.5)'; ctx.lineWidth = s * .012;
        M.roundRect(ctx, cx + s * .25, s * .16, s * .17, s * .14, s * .025); ctx.stroke();
        ctx.fillStyle = rgba(H, .8);
        M.roundRect(ctx, cx + s * .265, s * .185, s * .05, s * .09, s * .015); ctx.fill();
        break;
      case 'shield':
        ctx.fillStyle = metalGrad(ctx, cx + s * .14, s * .42, cx + s * .38, s * .7, '#dfe8f4', mix('#78909c', H, .3), '#4a5a70');
        ctx.beginPath();
        ctx.moveTo(cx + s * .26, s * .40);
        ctx.quadraticCurveTo(cx + s * .38, s * .42, cx + s * .37, s * .52);
        ctx.quadraticCurveTo(cx + s * .36, s * .64, cx + s * .26, s * .70);
        ctx.quadraticCurveTo(cx + s * .16, s * .64, cx + s * .15, s * .52);
        ctx.quadraticCurveTo(cx + s * .15, s * .42, cx + s * .26, s * .40);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = met.base; ctx.lineWidth = s * .026; ctx.stroke();
        ctx.fillStyle = rgba(H, .95);
        ctx.beginPath(); ctx.arc(cx + s * .26, s * .53, s * .05, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.6)';
        ctx.beginPath(); ctx.arc(cx + s * .245, s * .515, s * .016, 0, Math.PI * 2); ctx.fill();
        break;
      case 'spear':
        shaft(cx + s * .16, s * .66, cx + s * .4, s * .16, s * .034);
        ctx.fillStyle = metalGrad(ctx, cx + s * .36, s * .06, cx + s * .46, s * .22, '#ffffff', mix(H, '#dbe4f2', .4), '#93a2b8');
        ctx.beginPath(); ctx.moveTo(cx + s * .35, s * .2); ctx.lineTo(cx + s * .44, s * .06); ctx.lineTo(cx + s * .43, s * .22); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(20,26,44,.4)'; ctx.lineWidth = s * .012; ctx.stroke();
        break;
      case 'fist':
        for (const side of [-1, 1]) {
          const gx = cx + side * s * .3, gy = s * .5;
          const fg = ctx.createRadialGradient(gx, gy, 0, gx, gy, s * .1);
          fg.addColorStop(0, mix(H, '#ffffff', .5)); fg.addColorStop(1, rgba(H, .1));
          ctx.fillStyle = fg;
          ctx.beginPath(); ctx.arc(gx, gy, s * .1, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = H;
          ctx.beginPath(); ctx.arc(gx, gy, s * .06, 0, Math.PI * 2); ctx.fill();
        }
        break;
      case 'dagger':
        blade(cx + s * .24, s * .52, cx + s * .35, s * .3, s * .03);
        blade(cx - s * .24, s * .52, cx - s * .35, s * .3, s * .03);
        break;
      case 'katana':
        ctx.strokeStyle = '#f2f6fc'; ctx.lineWidth = s * .026;
        ctx.beginPath(); ctx.moveTo(cx + s * .2, s * .6);
        ctx.quadraticCurveTo(cx + s * .36, s * .36, cx + s * .3, s * .16); ctx.stroke();
        ctx.strokeStyle = rgba(H, .6); ctx.lineWidth = s * .012;
        ctx.beginPath(); ctx.moveTo(cx + s * .21, s * .585);
        ctx.quadraticCurveTo(cx + s * .35, s * .35, cx + s * .295, s * .18); ctx.stroke();
        break;
      case 'scythe':
        shaft(cx + s * .2, s * .64, cx + s * .3, s * .2, s * .032);
        ctx.strokeStyle = metalGrad(ctx, cx + s * .1, s * .1, cx + s * .35, s * .3, '#ffffff', mix(H, '#dbe4f2', .3), '#93a2b8');
        ctx.lineWidth = s * .04;
        ctx.beginPath(); ctx.arc(cx + s * .2, s * .22, s * .13, -Math.PI * .42, Math.PI * .45); ctx.stroke();
        break;
      case 'bow':
        ctx.strokeStyle = '#8d6e53'; ctx.lineWidth = s * .04;
        ctx.beginPath(); ctx.arc(cx + s * .26, s * .42, s * .16, -Math.PI * .45, Math.PI * .45); ctx.stroke();
        ctx.strokeStyle = rgba(H, .85); ctx.lineWidth = s * .014;
        ctx.beginPath(); ctx.moveTo(cx + s * .26 + s * .07, s * .3); ctx.lineTo(cx + s * .26 + s * .07, s * .54); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = s * .011;
        ctx.beginPath(); ctx.arc(cx + s * .26, s * .42, s * .16, -Math.PI * .4, -Math.PI * .05); ctx.stroke();
        break;
      case 'crossbow':
        shaft(cx + s * .16, s * .56, cx + s * .4, s * .36, s * .04);
        ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = s * .032;
        ctx.beginPath(); ctx.moveTo(cx + s * .24, s * .26); ctx.lineTo(cx + s * .42, s * .44); ctx.stroke();
        ctx.fillStyle = '#cfd8e8';
        ctx.beginPath(); ctx.moveTo(cx + s * .4, s * .36); ctx.lineTo(cx + s * .46, s * .33); ctx.lineTo(cx + s * .42, s * .4); ctx.closePath(); ctx.fill();
        break;
      case 'catapult':
        shaft(cx + s * .14, s * .62, cx + s * .36, s * .26, s * .042);
        ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = s * .03;
        ctx.beginPath(); ctx.moveTo(cx + s * .3, s * .3); ctx.lineTo(cx + s * .24, s * .18); ctx.stroke();
        ctx.fillStyle = '#78909c';
        ctx.beginPath(); ctx.arc(cx + s * .38, s * .22, s * .06, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.45)';
        ctx.beginPath(); ctx.arc(cx + s * .365, s * .205, s * .02, 0, Math.PI * 2); ctx.fill();
        break;
      case 'gun':
        ctx.fillStyle = metalGrad(ctx, cx + s * .16, s * .44, cx + s * .44, s * .55, '#b8c6d8', '#546e7a', '#2f3d4a');
        M.roundRect(ctx, cx + s * .16, s * .455, s * .27, s * .072, s * .02); ctx.fill();
        ctx.fillStyle = '#3b2f26';
        M.roundRect(ctx, cx + s * .2, s * .51, s * .07, s * .1, s * .02); ctx.fill();
        break;
      case 'staff':
        shaft(cx + s * .24, s * .64, cx + s * .32, s * .24, s * .032);
        const og = ctx.createRadialGradient(cx + s * .33, s * .19, 0, cx + s * .33, s * .19, s * .1);
        og.addColorStop(0, mix(H, '#ffffff', .65)); og.addColorStop(.5, H); og.addColorStop(1, rgba(H, 0));
        ctx.fillStyle = og;
        ctx.beginPath(); ctx.arc(cx + s * .33, s * .19, s * .1, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = s * .014;
        ctx.beginPath(); ctx.arc(cx + s * .33, s * .19, s * .055, -2.4, -0.8); ctx.stroke();
        break;
      case 'orb':
        const obx = cx + s * .3, oby = s * .4;
        const obg = ctx.createRadialGradient(obx - s * .02, oby - s * .03, 0, obx, oby, s * .11);
        obg.addColorStop(0, '#ffffff'); obg.addColorStop(.35, mix(H, '#ffffff', .3)); obg.addColorStop(1, mix(H, '#000020', .35));
        ctx.fillStyle = obg;
        ctx.beginPath(); ctx.arc(obx, oby, s * .08, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = s * .014;
        ctx.beginPath(); ctx.arc(obx, oby, s * .08, -2.4, -0.8); ctx.stroke();
        break;
      case 'tome':
        ctx.fillStyle = metalGrad(ctx, cx + s * .16, s * .4, cx + s * .36, s * .6, mix('#8d6e63', H, .3), mix('#5d4037', H, .4), '#33221c');
        M.roundRect(ctx, cx + s * .16, s * .42, s * .2, s * .16, s * .015); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.85)';
        ctx.fillRect(cx + s * .252, s * .42, s * .016, s * .16);
        ctx.strokeStyle = met.base; ctx.lineWidth = s * .012;
        M.roundRect(ctx, cx + s * .17, s * .43, s * .18, s * .14, s * .012); ctx.stroke();
        break;
      case 'potion':
        ctx.fillStyle = 'rgba(200,210,230,.9)';
        ctx.fillRect(cx + s * .27, s * .33, s * .06, s * .07);
        const pg2 = ctx.createLinearGradient(0, s * .4, 0, s * .58);
        pg2.addColorStop(0, mix(H, '#ffffff', .45)); pg2.addColorStop(1, mix(H, '#000020', .3));
        ctx.fillStyle = pg2;
        M.roundRect(ctx, cx + s * .24, s * .4, s * .12, s * .17, s * .045); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        ctx.beginPath(); ctx.arc(cx + s * .27, s * .445, s * .014, 0, Math.PI * 2); ctx.fill();
        break;
      default:
        blade(cx + s * .22, s * .58, cx + s * .36, s * .26, s * .036);
    }
  }

  /* ============ 卡面 ============ */
  // w×h 缓存：品质金属框 / 元素氛围 / 骑士立绘 / 铭牌
  art.cardFace = function (defId, rarity, w, h) {
    const key = defId + '|' + rarity + '|' + w + 'x' + h;
    if (cardCache[key]) return cardCache[key];
    const def = KB.knightById(defId);
    const c = makeCanvas(w, h), ctx = c.getContext('2d');
    const rc = KB.CONFIG.RARITY_COLOR[rarity];
    const met = rarityMetal(rarity);
    const elem = def.elem === 'none' ? '#90a4c0' : KB.CONFIG.ELEMENTS[def.elem];
    const rad = Math.max(5, w * .085);
    const fw = Math.max(2, w * .035);           // 框宽

    /* ---- 底板（品质深色渐变） ---- */
    const baseHi = rarity === 2 ? '#57440f' : rarity === 1 ? '#3a2765' : '#2a3352';
    const baseLo = rarity === 2 ? '#221806' : rarity === 1 ? '#170d2b' : '#0f1528';
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, baseHi); bg.addColorStop(1, baseLo);
    ctx.fillStyle = bg;
    M.roundRect(ctx, fw * .4, fw * .4, w - fw * .8, h - fw * .8, rad); ctx.fill();

    /* ---- 立绘区（裁剪） ---- */
    const pvTop = fw + h * .02, pvBot = h * .635;
    ctx.save();
    M.roundRect(ctx, fw, pvTop, w - fw * 2, pvBot - pvTop, rad * .6); ctx.clip();
    // 元素径向氛围
    const pcx = w / 2, pcy = (pvTop + pvBot) / 2;
    const pg = ctx.createRadialGradient(pcx, pcy, w * .04, pcx, pcy, w * .62);
    pg.addColorStop(0, rgba(elem, .34));
    pg.addColorStop(.55, rgba(elem, .1));
    pg.addColorStop(1, 'rgba(0,0,6,.5)');
    ctx.fillStyle = pg;
    ctx.fillRect(0, pvTop, w, pvBot - pvTop);
    // 斜向光束
    const rot = hash2(w, h) * Math.PI;
    ctx.save();
    ctx.translate(pcx, pcy); ctx.rotate(rot);
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    for (let i = -2; i <= 2; i++) {
      if (!i) continue;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(i * w * .22 - w * .05, -h);
      ctx.lineTo(i * w * .22 + w * .05, -h);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // 骑士立绘
    const spr = art.knightSprite(defId, rarity, 400);
    const sw = w * 1.18;
    ctx.drawImage(spr, pcx - sw / 2, pvBot - sw * .88, sw, sw);
    // 上下晕影
    const vg = ctx.createLinearGradient(0, pvTop, 0, pvBot);
    vg.addColorStop(0, 'rgba(0,0,10,.42)');
    vg.addColorStop(.25, 'rgba(0,0,10,0)');
    vg.addColorStop(.8, 'rgba(0,0,10,0)');
    vg.addColorStop(1, 'rgba(0,0,10,.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, pvTop, w, pvBot - pvTop);
    ctx.restore();

    /* ---- 铭牌区 ---- */
    const nbTop = pvBot - h * .015;
    const ng = ctx.createLinearGradient(0, nbTop, 0, h);
    ng.addColorStop(0, 'rgba(8,10,24,0)');
    ng.addColorStop(.35, 'rgba(8,10,24,.86)');
    ng.addColorStop(1, 'rgba(4,6,16,.94)');
    ctx.fillStyle = ng;
    M.roundRect(ctx, fw, nbTop, w - fw * 2, h - fw - nbTop, rad * .6); ctx.fill();
    // 品质分界细线
    ctx.strokeStyle = rgba(rc, .5); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(fw + w * .1, h * .685); ctx.lineTo(w - fw - w * .1, h * .685); ctx.stroke();

    /* ---- 名称 / 技能 ---- */
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = KB.ui.font(Math.max(9, Math.round(h * .128)), 'bold');
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillText(def.name, w / 2, h * .78 + 1);
    ctx.fillStyle = rarity === 2 ? '#ffe9a8' : '#fff';
    ctx.fillText(def.name, w / 2, h * .78);
    ctx.font = KB.ui.font(Math.max(7, Math.round(h * .095)));
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillText(def.skill, w / 2, h * .905);

    /* ---- 金属外框（三段渐变 + 内亮线） ---- */
    const mg = ctx.createLinearGradient(0, 0, w * .35, h);
    mg.addColorStop(0, met.hi); mg.addColorStop(.5, met.base); mg.addColorStop(1, met.lo);
    ctx.strokeStyle = mg; ctx.lineWidth = fw;
    M.roundRect(ctx, fw * .55, fw * .55, w - fw * 1.1, h - fw * 1.1, rad); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1;
    M.roundRect(ctx, fw + .5, fw + .5, w - fw * 2 - 1, h - fw * 2 - 1, rad * .6); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1;
    M.roundRect(ctx, fw * .55 + .5, fw * .55 + .5, w - fw * 1.1 - 1, h - fw * 1.1 - 1, rad); ctx.stroke();

    /* ---- 品质角饰 ---- */
    const cr = fw + Math.max(3, w * .05);
    if (rarity === 0) {
      // 铆钉 ×4
      ctx.fillStyle = met.hi;
      for (const [ax, ay] of [[cr, cr], [w - cr, cr], [cr, h - cr], [w - cr, h - cr]]) {
        ctx.beginPath(); ctx.arc(ax, ay, Math.max(1, w * .014), 0, Math.PI * 2); ctx.fill();
      }
    } else if (rarity === 1) {
      // 符文 ×4
      ctx.strokeStyle = rgba('#d8b0ff', .8); ctx.lineWidth = Math.max(1, w * .012);
      for (const [ax, ay, dx, dy] of [[cr, cr, 1, 1], [w - cr, cr, -1, 1], [cr, h - cr, 1, -1], [w - cr, h - cr, -1, -1]]) {
        const rr2 = Math.max(2, w * .028);
        ctx.beginPath();
        ctx.moveTo(ax - dx * rr2, ay); ctx.lineTo(ax, ay + dy * rr2); ctx.lineTo(ax + dx * rr2, ay);
        ctx.stroke();
      }
    } else {
      // 金色花体角 ×4
      ctx.strokeStyle = rgba('#ffe9a0', .9); ctx.lineWidth = Math.max(1, w * .014);
      for (const [ax, ay, dx, dy] of [[cr, cr, 1, 1], [w - cr, cr, -1, 1], [cr, h - cr, 1, -1], [w - cr, h - cr, -1, -1]]) {
        const L = w * .07;
        ctx.beginPath();
        ctx.moveTo(ax + dx * L, ay + dy * fw);
        ctx.quadraticCurveTo(ax + dx * L * .4, ay + dy * L * .35, ax + dx * fw, ay + dy * L);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(ax + dx * L * .55, ay + dy * L * .5, Math.max(1, w * .01), 0, Math.PI * 2); ctx.stroke();
      }
    }

    /* ---- 元素徽记（左上，避开战斗右上等级角标/左下费用） ---- */
    const ox = fw + w * .1, oy = fw + h * .06, orad = Math.max(2.5, w * .045);
    const og = ctx.createRadialGradient(ox, oy, 0, ox, oy, orad * 2.4);
    og.addColorStop(0, rgba(elem, .5)); og.addColorStop(1, rgba(elem, 0));
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(ox, oy, orad * 2.4, 0, Math.PI * 2); ctx.fill();
    const ob = ctx.createRadialGradient(ox - orad * .3, oy - orad * .3, 0, ox, oy, orad);
    ob.addColorStop(0, mix(elem, '#ffffff', .55)); ob.addColorStop(1, mix(elem, '#000020', .3));
    ctx.fillStyle = ob;
    ctx.beginPath(); ctx.arc(ox, oy, orad, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(ox, oy, orad, -2.5, -0.9); ctx.stroke();

    /* ---- 斜向玻璃反光 ---- */
    ctx.save();
    M.roundRect(ctx, fw, fw, w - fw * 2, h - fw * 2, rad * .8); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.055)';
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(w * .52, 0); ctx.lineTo(w * .18, h); ctx.lineTo(0, h);
    ctx.closePath(); ctx.fill();
    ctx.restore();

    cardCache[key] = c;
    return c;
  };

  /* ============ 棋盘底图 ============ */
  art.boardBg = function (worldIdx, cellW, cellH, rows, cols, coreW) {
    const w = Math.ceil(cols * cellW + coreW), h = Math.ceil(rows * cellH);
    const key = worldIdx + '|' + w + 'x' + h;
    if (boardCache[key]) return boardCache[key];
    const pal = KB.WORLDS[worldIdx].pal;
    const c = makeCanvas(w, h), ctx = c.getContext('2d');

    /* ---- 核心区：石砌城墙地基 ---- */
    const fg = ctx.createLinearGradient(0, 0, coreW, 0);
    fg.addColorStop(0, mix(pal.laneB, '#0a0a14', .55));
    fg.addColorStop(1, mix(pal.laneB, '#0a0a14', .3));
    ctx.fillStyle = fg;
    ctx.fillRect(0, 0, coreW, h);
    // 石块（错缝砌筑 + 每块明度抖动）
    const sh = Math.max(14, coreW / 4.2);
    for (let ry = 0, rIdx = 0; ry < h; ry += sh, rIdx++) {
      const off = (rIdx % 2) * sh * .5;
      for (let bx = -sh * .5; bx < coreW + sh; bx += sh) {
        const j = hash2(bx | 0 + rIdx * 31, rIdx);
        ctx.fillStyle = 'rgba(' + (j > .5 ? '255,255,255' : '0,0,10') + ',' + (0.03 + j * .05).toFixed(3) + ')';
        ctx.fillRect(bx + off + 1, ry + 1, sh - 2, sh - 2);
      }
      ctx.strokeStyle = 'rgba(0,0,8,.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(coreW, ry); ctx.stroke();
    }
    // 城墙右侧沿口（朝战场的亮边 + 阴影落板）
    ctx.fillStyle = 'rgba(255,255,255,.1)';
    ctx.fillRect(coreW - 3, 0, 3, h);
    ctx.fillStyle = 'rgba(0,0,10,.3)';
    ctx.fillRect(coreW, 0, 5, h);

    /* ---- 战场棋盘格（纹理化） ---- */
    for (let r = 0; r < rows; r++) {
      for (let col = 0; col < cols; col++) {
        const x = coreW + col * cellW, y = r * cellH;
        const j = hash2(col * 7 + 13, r * 5 + 3);
        const base = ((r + col) % 2 === 0) ? pal.laneA : pal.laneB;
        const cg = ctx.createLinearGradient(0, y, 0, y + cellH);
        cg.addColorStop(0, mix(base, '#ffffff', .06 + j * .05));
        cg.addColorStop(1, mix(base, '#000000', .1 + j * .07));
        ctx.fillStyle = cg;
        ctx.fillRect(x, y, cellW, cellH);
        // 砖沿口（上亮下暗 → 浮雕）
        ctx.fillStyle = 'rgba(255,255,255,.09)';
        ctx.fillRect(x, y, cellW, 1.5);
        ctx.fillStyle = 'rgba(0,0,10,.16)';
        ctx.fillRect(x, y + cellH - 1.5, cellW, 1.5);
        ctx.fillStyle = 'rgba(0,0,10,.07)';
        ctx.fillRect(x + cellW - 1, y, 1, cellH);
        // 概率装饰（草簇/碎石/裂纹，按世界调色）
        if (j > .68) {
          const dx = x + cellW * (.25 + j * .5), dy = y + cellH * (.3 + ((j * 7) % 1) * .4);
          if (j > .86) {  // 碎石
            ctx.fillStyle = mix(pal.accent, '#000010', .45);
            ctx.beginPath(); ctx.arc(dx, dy, 2.2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(dx + 4, dy + 1.5, 1.4, 0, Math.PI * 2); ctx.fill();
          } else {        // 草簇/纹理笔触
            ctx.strokeStyle = mix(pal.laneA, '#ffffff', .22);
            ctx.lineWidth = 1.2; ctx.lineCap = 'round';
            for (let t = -1; t <= 1; t++) {
              ctx.beginPath();
              ctx.moveTo(dx + t * 2.4, dy + 3);
              ctx.quadraticCurveTo(dx + t * 3, dy - 1, dx + t * 4, dy - 4);
              ctx.stroke();
            }
          }
        }
      }
      // 行间沟壑（暗线 + 下行投影）
      ctx.fillStyle = 'rgba(0,0,10,.14)';
      ctx.fillRect(coreW, r * cellH, cols * cellW, 1.5);
    }

    /* ---- 上下边缘暗角（棋盘落地感） ---- */
    const eT = ctx.createLinearGradient(0, 0, 0, cellH * .35);
    eT.addColorStop(0, 'rgba(0,0,10,.28)'); eT.addColorStop(1, 'rgba(0,0,10,0)');
    ctx.fillStyle = eT; ctx.fillRect(coreW, 0, cols * cellW, cellH * .35);
    const eB = ctx.createLinearGradient(0, h, 0, h - cellH * .35);
    eB.addColorStop(0, 'rgba(0,0,10,.34)'); eB.addColorStop(1, 'rgba(0,0,10,0)');
    ctx.fillStyle = eB; ctx.fillRect(coreW, h - cellH * .35, cols * cellW, cellH * .35);

    /* ---- 右侧敌军传送门 ---- */
    const pw = cellW * 1.1;
    const pg = ctx.createLinearGradient(w - pw, 0, w, 0);
    pg.addColorStop(0, 'rgba(60,6,10,0)');
    pg.addColorStop(.55, 'rgba(70,8,14,.4)');
    pg.addColorStop(1, 'rgba(24,2,6,.82)');
    ctx.fillStyle = pg; ctx.fillRect(w - pw, 0, pw, h);
    // 每行一个石拱门洞 + 尖刺
    for (let r = 0; r < rows; r++) {
      const cyc = r * cellH + cellH / 2;
      const aw = cellW * .42, ah = cellH * .6;
      const ax = w - aw * .78;
      // 拱外框
      ctx.fillStyle = 'rgba(16,10,18,.9)';
      ctx.beginPath();
      ctx.moveTo(ax - aw * .12, cyc + ah * .55);
      ctx.lineTo(ax - aw * .12, cyc - ah * .1);
      ctx.quadraticCurveTo(ax + aw * .5, cyc - ah * .85, ax + aw * 1.12, cyc - ah * .1);
      ctx.lineTo(ax + aw * 1.12, cyc + ah * .55);
      ctx.closePath(); ctx.fill();
      // 洞内红黑渐变
      const hg2 = ctx.createLinearGradient(ax, cyc - ah * .5, ax, cyc + ah * .5);
      hg2.addColorStop(0, '#3d0a10'); hg2.addColorStop(1, '#0c0206');
      ctx.fillStyle = hg2;
      ctx.beginPath();
      ctx.moveTo(ax, cyc + ah * .42);
      ctx.lineTo(ax, cyc - ah * .08);
      ctx.quadraticCurveTo(ax + aw * .5, cyc - ah * .62, ax + aw, cyc - ah * .08);
      ctx.lineTo(ax + aw, cyc + ah * .42);
      ctx.closePath(); ctx.fill();
      // 地面尖刺（朝左）
      ctx.fillStyle = 'rgba(190,200,215,.5)';
      for (let k = 0; k < 2; k++) {
        const sx = ax + aw * (.2 + k * .5), sy = cyc + ah * .45;
        ctx.beginPath();
        ctx.moveTo(sx - 5, sy); ctx.lineTo(sx + 4, sy - 4); ctx.lineTo(sx + 3, sy + 4);
        ctx.closePath(); ctx.fill();
      }
    }

    boardCache[key] = c;
    return c;
  };

  /* ============ 敌人 ============ */
  art.drawEnemy = function (ctx, e, time) {
    const r = e.r;
    const pal = e.pal;
    const body = e.kind === 'boss' ? pal.accent : pal.enemy;
    const bob = Math.sin(time * 6 + e.phase) * r * 0.06;
    ctx.save();
    ctx.lineJoin = 'round';
    // 地面阴影
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath(); ctx.ellipse(e.x, e.y + r * 1.02, r * .82, r * .2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(e.x, e.y + bob);

    const rimLight = (px, py, pr) => {
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = Math.max(1, r * .05);
      ctx.beginPath(); ctx.arc(px, py, pr * .82, -Math.PI * .85, -Math.PI * .25); ctx.stroke();
    };
    const outline = () => { ctx.strokeStyle = 'rgba(8,6,16,.55)'; ctx.lineWidth = Math.max(1, r * .07); ctx.stroke(); };
    const walk = Math.sin(time * 9 + e.phase) * r * .12;

    if (e.kind === 'boss') {
      // 脚步
      ctx.fillStyle = mix(body, '#000', .5);
      ctx.beginPath(); ctx.ellipse(-r * .35, r * 1.05, r * .22, r * .1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(r * .35, r * 1.05 + walk * .3, r * .22, r * .1, 0, 0, Math.PI * 2); ctx.fill();
      // 体（渐变 + 轮廓）
      const bg2 = ctx.createLinearGradient(0, -r * .6, 0, r * .7);
      bg2.addColorStop(0, mix(body, '#ffffff', .22)); bg2.addColorStop(.55, body); bg2.addColorStop(1, mix(body, '#000', .4));
      ctx.fillStyle = bg2;
      M.roundRect(ctx, -r * .7, -r * .6, r * 1.4, r * 1.3, r * .28); ctx.fill();
      outline();
      rimLight(0, -r * .1, r * .6);
      // 胸甲裂纹
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = r * .05;
      ctx.beginPath(); ctx.moveTo(-r * .3, r * .2); ctx.lineTo(-r * .05, r * .45); ctx.lineTo(r * .25, r * .3); ctx.stroke();
      // 眼（余晖）
      const eg = ctx.createRadialGradient(-r * .25, -r * .15, 0, -r * .25, -r * .15, r * .3);
      eg.addColorStop(0, '#ff8a80'); eg.addColorStop(1, 'rgba(255,80,60,0)');
      ctx.fillStyle = eg;
      ctx.beginPath(); ctx.arc(-r * .25, -r * .15, r * .3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff5252';
      ctx.beginPath(); ctx.arc(-r * .25, -r * .15, r * .12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * .25, -r * .15, r * .12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(-r * .22, -r * .18, r * .04, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * .28, -r * .18, r * .04, 0, Math.PI * 2); ctx.fill();
      // 角（渐变骨白）
      for (const side of [-1, 1]) {
        const hg3 = ctx.createLinearGradient(side * r * .5, -r * .55, side * r * .75, -r * .95);
        hg3.addColorStop(0, '#b8b2a6'); hg3.addColorStop(1, '#f2ece1');
        ctx.strokeStyle = hg3; ctx.lineWidth = r * .13;
        ctx.beginPath(); ctx.moveTo(side * r * .5, -r * .55);
        ctx.quadraticCurveTo(side * r * .72, -r * .78, side * r * .75, -r * .98); ctx.stroke();
      }
      // 王冠（金属渐变 + 尖钉）
      const cg2 = ctx.createLinearGradient(0, -r * .95, 0, -r * .68);
      cg2.addColorStop(0, '#ffe082'); cg2.addColorStop(1, '#c8961e');
      ctx.fillStyle = cg2;
      ctx.beginPath();
      ctx.moveTo(-r * .35, -r * .68); ctx.lineTo(-r * .3, -r * .9); ctx.lineTo(-r * .15, -r * .74);
      ctx.lineTo(0, -r * .98); ctx.lineTo(r * .15, -r * .74); ctx.lineTo(r * .3, -r * .9);
      ctx.lineTo(r * .35, -r * .68); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(90,60,0,.5)'; ctx.lineWidth = r * .03; ctx.stroke();
      ctx.fillStyle = '#ff5252';
      ctx.beginPath(); ctx.arc(0, -r * .8, r * .05, 0, Math.PI * 2); ctx.fill();
    } else {
      // 普通敌：按原型形状（均加轮廓 + 顶部环境光）
      switch (e.arch) {
        case 'runner': {
          const g2 = ctx.createLinearGradient(0, -r * .8, 0, r * .8);
          g2.addColorStop(0, mix(body, '#ffffff', .18)); g2.addColorStop(1, mix(body, '#000000', .3));
          ctx.fillStyle = g2;
          ctx.beginPath(); ctx.ellipse(0, 0, r * .6, r * .8, 0, 0, Math.PI * 2); ctx.fill();
          outline();
          rimLight(0, 0, r * .62);
          // 速度线
          ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = r * .06; ctx.lineCap = 'round';
          for (let k = 1; k <= 2; k++)
            { ctx.beginPath(); ctx.moveTo(r * (.5 + k * .18), -r * .15 * k); ctx.lineTo(r * (.9 + k * .18), -r * .15 * k); ctx.stroke(); }
          break;
        }
        case 'tank': {
          const g2 = ctx.createLinearGradient(0, -r * .62, 0, r * .68);
          g2.addColorStop(0, mix(body, '#ffffff', .14)); g2.addColorStop(1, mix(body, '#000000', .38));
          ctx.fillStyle = g2;
          M.roundRect(ctx, -r * .7, -r * .62, r * 1.4, r * 1.3, r * .2); ctx.fill();
          outline();
          rimLight(0, -r * .1, r * .6);
          // 铆钉装甲线
          ctx.strokeStyle = 'rgba(0,0,0,.3)'; ctx.lineWidth = r * .05;
          ctx.beginPath(); ctx.moveTo(-r * .6, -r * .05); ctx.lineTo(r * .6, -r * .05); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,.25)';
          for (let k = -1; k <= 1; k++)
            { ctx.beginPath(); ctx.arc(k * r * .4, -r * .38, r * .05, 0, Math.PI * 2); ctx.fill(); }
          break;
        }
        case 'bomber': {
          const g2 = ctx.createRadialGradient(-r * .2, -r * .25, 0, 0, 0, r * .8);
          g2.addColorStop(0, '#ff8a65'); g2.addColorStop(.6, '#d84315'); g2.addColorStop(1, mix('#d84315', '#000', .35));
          ctx.fillStyle = g2;
          ctx.beginPath(); ctx.arc(0, 0, r * .75, 0, Math.PI * 2); ctx.fill();
          outline();
          // 引线火花
          ctx.strokeStyle = '#ffca28'; ctx.lineWidth = r * .1;
          ctx.beginPath(); ctx.moveTo(0, -r * .75); ctx.quadraticCurveTo(r * .3, -r * 1.1, r * .1, -r * 1.2); ctx.stroke();
          const spark = .5 + .5 * Math.sin(time * 14 + e.phase);
          const sg2 = ctx.createRadialGradient(r * .1, -r * 1.25, 0, r * .1, -r * 1.25, r * .3);
          sg2.addColorStop(0, 'rgba(255,249,196,' + (0.6 + spark * .4) + ')');
          sg2.addColorStop(1, 'rgba(255,120,0,0)');
          ctx.fillStyle = sg2;
          ctx.beginPath(); ctx.arc(r * .1, -r * 1.25, r * .3, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'healer': {
          const g2 = ctx.createRadialGradient(-r * .2, -r * .25, 0, 0, 0, r * .72);
          g2.addColorStop(0, mix(body, '#8ef0a0', .5)); g2.addColorStop(1, mix(body, '#2e7d32', .5));
          ctx.fillStyle = g2;
          ctx.beginPath(); ctx.arc(0, 0, r * .7, 0, Math.PI * 2); ctx.fill();
          outline();
          // 医疗十字（发光）
          ctx.strokeStyle = 'rgba(220,255,225,.95)'; ctx.lineWidth = r * .14; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-r * .22, 0); ctx.lineTo(r * .22, 0); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, -r * .22); ctx.lineTo(0, r * .22); ctx.stroke();
          // 治疗环（呼吸）
          ctx.strokeStyle = 'rgba(140,240,170,' + (.25 + .2 * Math.sin(time * 3 + e.phase)).toFixed(2) + ')';
          ctx.lineWidth = r * .05;
          ctx.beginPath(); ctx.arc(0, 0, r * .95, 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case 'shielded': {
          const g2 = ctx.createLinearGradient(0, -r * .7, 0, r * .7);
          g2.addColorStop(0, mix(body, '#ffffff', .15)); g2.addColorStop(1, mix(body, '#000000', .3));
          ctx.fillStyle = g2;
          M.roundRect(ctx, -r * .55, -r * .7, r * 1.1, r * 1.4, r * .2); ctx.fill();
          outline();
          rimLight(0, 0, r * .55);
          // 前方鸢盾（金属渐变 + 铆钉 + 光沿）
          const sg3 = ctx.createLinearGradient(-r * .95, -r * .55, -r * .6, r * .55);
          sg3.addColorStop(0, '#e3ecf8'); sg3.addColorStop(.5, '#9fb2cc'); sg3.addColorStop(1, '#5a6c88');
          ctx.fillStyle = sg3;
          ctx.beginPath();
          ctx.moveTo(-r * .78, -r * .52);
          ctx.quadraticCurveTo(-r * .98, -r * .3, -r * .9, r * .05);
          ctx.quadraticCurveTo(-r * .84, r * .42, -r * .62, r * .55);
          ctx.quadraticCurveTo(-r * .78, 0, -r * .78, -r * .52);
          ctx.closePath(); ctx.fill();
          ctx.strokeStyle = 'rgba(20,28,48,.6)'; ctx.lineWidth = r * .05; ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,.4)';
          ctx.beginPath(); ctx.arc(-r * .84, -r * .3, r * .04, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'spawner': {
          const g2 = ctx.createRadialGradient(-r * .25, -r * .2, 0, 0, 0, r * .9);
          g2.addColorStop(0, mix(body, '#c0e882', .45)); g2.addColorStop(1, mix(body, '#33691e', .45));
          ctx.fillStyle = g2;
          ctx.beginPath(); ctx.ellipse(0, 0, r * .9, r * .75, 0, 0, Math.PI * 2); ctx.fill();
          outline();
          rimLight(0, 0, r * .8);
          // 孢子（脉动）
          for (let k = 0; k < 3; k++) {
            const pulse = .3 + .3 * Math.sin(time * 4 + k * 2.1 + e.phase);
            ctx.fillStyle = 'rgba(220,255,190,' + pulse.toFixed(2) + ')';
            ctx.beginPath(); ctx.arc(-r * .3 + k * r * .3, r * .15, r * .12, 0, Math.PI * 2); ctx.fill();
          }
          break;
        }
        case 'slinger': {
          const g2 = ctx.createRadialGradient(-r * .2, -r * .2, 0, 0, 0, r * .65);
          g2.addColorStop(0, mix(body, '#ffffff', .18)); g2.addColorStop(1, mix(body, '#000000', .28));
          ctx.fillStyle = g2;
          ctx.beginPath(); ctx.arc(0, 0, r * .62, 0, Math.PI * 2); ctx.fill();
          outline();
          rimLight(0, 0, r * .6);
          // 投石索
          const sw2 = Math.sin(time * 5 + e.phase) * .25;
          ctx.strokeStyle = '#a1887f'; ctx.lineWidth = r * .1; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-r * .1, 0);
          ctx.quadraticCurveTo(-r * .6, -r * .35 + sw2 * r, -r * .9, -r * .3 + sw2 * r); ctx.stroke();
          ctx.fillStyle = '#78909c';
          ctx.beginPath(); ctx.arc(-r * .9, -r * .3 + sw2 * r, r * .12, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'elite': {
          const g2 = ctx.createLinearGradient(0, -r * .85, 0, r * .85);
          g2.addColorStop(0, mix(body, '#ffe082', .35)); g2.addColorStop(.6, body); g2.addColorStop(1, mix(body, '#000', .38));
          ctx.fillStyle = g2;
          M.roundRect(ctx, -r * .6, -r * .85, r * 1.2, r * 1.7, r * .22); ctx.fill();
          outline();
          rimLight(0, -r * .2, r * .55);
          // 肩部金沿
          ctx.strokeStyle = 'rgba(255,213,79,.8)'; ctx.lineWidth = r * .08;
          ctx.beginPath(); ctx.moveTo(-r * .55, -r * .55); ctx.quadraticCurveTo(0, -r * .75, r * .55, -r * .55); ctx.stroke();
          // 利刃（金属渐变）
          const bg3 = ctx.createLinearGradient(r * .4, r * .3, r * .95, -r * .5);
          bg3.addColorStop(0, '#ffffff'); bg3.addColorStop(.5, '#d7e0ee'); bg3.addColorStop(1, '#8b9ab0');
          ctx.strokeStyle = bg3; ctx.lineWidth = r * .11; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(r * .4, r * .3); ctx.lineTo(r * .95, -r * .5); ctx.stroke();
          break;
        }
        default: { // scraper 基础怪
          const g2 = ctx.createRadialGradient(-r * .2, -r * .25, 0, 0, 0, r * .7);
          g2.addColorStop(0, mix(body, '#ffffff', .2)); g2.addColorStop(1, mix(body, '#000000', .3));
          ctx.fillStyle = g2;
          ctx.beginPath(); ctx.arc(0, 0, r * .68, 0, Math.PI * 2); ctx.fill();
          outline();
          rimLight(0, 0, r * .66);
          ctx.fillStyle = 'rgba(255,255,255,.85)';
          ctx.beginPath(); ctx.arc(-r * .2, -r * .15, r * .12, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(r * .2, -r * .15, r * .12, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#1a1020';
          ctx.beginPath(); ctx.arc(-r * .17, -r * .12, r * .05, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(r * .23, -r * .12, r * .05, 0, Math.PI * 2); ctx.fill();
        }
      }
      /* ---- 血条 ---- */
      const bw = r * 1.6, hpPct = M.clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      M.roundRect(ctx, -bw / 2, -r * 1.32, bw, r * .2, r * .1); ctx.fill();
      if (hpPct > 0) {
        const c = hpPct > .5 ? '#66bb6a' : hpPct > .25 ? '#ffa726' : '#ef5350';
        const hgc = ctx.createLinearGradient(0, -r * 1.32, 0, -r * 1.32 + r * .2);
        hgc.addColorStop(0, mix(c, '#ffffff', .35)); hgc.addColorStop(1, c);
        ctx.fillStyle = hgc;
        M.roundRect(ctx, -bw / 2, -r * 1.32, Math.max(bw * hpPct, r * .12), r * .2, r * .1); ctx.fill();
      }
      // 护盾条
      if (e.shield > 0) {
        const sc2 = 'rgba(120,200,255,.92)';
        ctx.fillStyle = sc2;
        M.roundRect(ctx, -bw / 2, -r * 1.32 - r * .24, Math.max(bw * M.clamp(e.shield / e.maxHp, 0, 1), r * .1), r * .15, r * .075); ctx.fill();
      }
    }
    ctx.restore();

    /* 状态标记 */
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
  art.drawCore = function (ctx, x, y, w, h, hpPct, time, showBar) {
    if (showBar === undefined) showBar = true;
    const flash = hpPct < 0.3 && Math.sin(time * 8) > 0;
    const stoneHi = flash ? '#b07272' : '#93a3e0';
    const stoneMid = flash ? '#a05252' : '#7987c9';
    const stoneLo = flash ? '#6d3030' : '#48558f';
    const roof = flash ? '#7d3a3a' : '#3d4a85';
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round';

    /* 石面纹理参数 */
    const speck = (bx, by, bw2, bh2, seed) => {
      for (let i = 0; i < 10; i++) {
        const hx = bx + hash2(seed + i, 7) * bw2, hy = by + hash2(i, seed + 3) * bh2;
        ctx.fillStyle = hash2(i, seed) > .5 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,10,.1)';
        ctx.fillRect(hx, hy, 2, 2);
      }
    };

    /* ---- 侧塔 ---- */
    for (const s of [-1, 1]) {
      const tx = s * w * .40;
      // 塔身
      const tg = ctx.createLinearGradient(tx - w * .1, 0, tx + w * .1, 0);
      tg.addColorStop(0, stoneLo); tg.addColorStop(.5, stoneMid); tg.addColorStop(1, stoneHi);
      ctx.fillStyle = tg;
      M.roundRect(ctx, tx - w * .1, -h * .36, w * .2, h * .68, 4); ctx.fill();
      speck(tx - w * .09, -h * .34, w * .18, h * .6, s > 0 ? 21 : 33);
      // 砖缝
      ctx.strokeStyle = 'rgba(16,22,52,.3)'; ctx.lineWidth = 1;
      for (let ry = -h * .28; ry < h * .3; ry += h * .14) {
        ctx.beginPath(); ctx.moveTo(tx - w * .1, ry); ctx.lineTo(tx + w * .1, ry); ctx.stroke();
      }
      // 塔顶锥（渐变 + 檐口）
      const rg = ctx.createLinearGradient(0, -h * .58, 0, -h * .36);
      rg.addColorStop(0, mix(roof, '#ffffff', .12)); rg.addColorStop(1, roof);
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.moveTo(tx - w * .13, -h * .36); ctx.lineTo(tx, -h * .58); ctx.lineTo(tx + w * .13, -h * .36);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.14)';
      ctx.fillRect(tx - w * .13, -h * .375, w * .26, h * .016);
      // 塔旗
      ctx.strokeStyle = '#cfd8e8'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(tx, -h * .58); ctx.lineTo(tx, -h * .68); ctx.stroke();
      ctx.fillStyle = '#ef5350';
      const fv = Math.sin(time * 2.4 + s) * h * .015;
      ctx.beginPath();
      ctx.moveTo(tx, -h * .68);
      ctx.lineTo(tx + s * w * .13, -h * .645 + fv);
      ctx.lineTo(tx, -h * .605);
      ctx.closePath(); ctx.fill();
      // 塔窗（暖光晕）
      for (const [wy, wa] of [[-h * .22, .95], [-h * .02, .55]]) {
        const wg = ctx.createRadialGradient(tx, wy, 0, tx, wy, w * .05);
        wg.addColorStop(0, 'rgba(255,196,96,' + wa + ')'); wg.addColorStop(1, 'rgba(255,196,96,0)');
        ctx.fillStyle = wg;
        ctx.beginPath(); ctx.arc(tx, wy, w * .05, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,214,120,' + wa + ')';
        ctx.beginPath(); ctx.arc(tx, wy, w * .022, 0, Math.PI * 2); ctx.fill();
      }
    }

    /* ---- 主楼 ---- */
    const bg4 = ctx.createLinearGradient(-w * .38, 0, w * .38, 0);
    bg4.addColorStop(0, stoneLo); bg4.addColorStop(.5, stoneMid); bg4.addColorStop(1, stoneLo);
    ctx.fillStyle = bg4;
    M.roundRect(ctx, -w * .34, -h * .3, w * .68, h * .62, 5); ctx.fill();
    // 砖缝（横 + 竖错缝）
    ctx.strokeStyle = 'rgba(16,22,52,.32)'; ctx.lineWidth = 1;
    for (let ry = -h * .22, k = 0; ry < h * .3; ry += h * .11, k++) {
      ctx.beginPath(); ctx.moveTo(-w * .32, ry); ctx.lineTo(w * .32, ry); ctx.stroke();
      for (let bx = -w * .3 + (k % 2) * w * .08; bx < w * .3; bx += w * .16) {
        ctx.beginPath(); ctx.moveTo(bx, ry); ctx.lineTo(bx, Math.min(ry + h * .11, h * .31)); ctx.stroke();
      }
    }
    speck(-w * .3, -h * .28, w * .6, h * .55, 55);
    // 城垛（带缺口阴影）
    ctx.fillStyle = flash ? '#b25b5b' : '#8b97d6';
    for (let i = 0; i < 4; i++) ctx.fillRect(-w * .32 + i * w * .17, -h * .38, w * .1, h * .1);
    ctx.fillStyle = 'rgba(0,0,10,.25)';
    for (let i = 0; i < 4; i++) ctx.fillRect(-w * .32 + i * w * .17, -h * .295, w * .1, h * .015);

    /* ---- 中央高塔 ---- */
    const ctg = ctx.createLinearGradient(-w * .09, 0, w * .09, 0);
    ctg.addColorStop(0, stoneLo); ctg.addColorStop(.6, stoneMid); ctg.addColorStop(1, mix(stoneMid, '#ffffff', .12));
    ctx.fillStyle = ctg;
    M.roundRect(ctx, -w * .09, -h * .52, w * .18, h * .26, 3); ctx.fill();
    const rg2 = ctx.createLinearGradient(0, -h * .72, 0, -h * .52);
    rg2.addColorStop(0, mix(roof, '#ffffff', .14)); rg2.addColorStop(1, roof);
    ctx.fillStyle = rg2;
    ctx.beginPath();
    ctx.moveTo(-w * .12, -h * .52); ctx.lineTo(0, -h * .72); ctx.lineTo(w * .12, -h * .52);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(-w * .12, -h * .53, w * .24, h * .012);

    /* ---- 门两侧火把（火光摇曳） ---- */
    for (const s of [-1, 1]) {
      const fx = s * w * .17, fy = h * .02;
      ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx, fy - h * .09); ctx.stroke();
      const flick = .7 + .3 * Math.sin(time * 9 + s * 2.7) + .1 * Math.sin(time * 23 + s);
      const fg2 = ctx.createRadialGradient(fx, fy - h * .11, 0, fx, fy - h * .11, h * .075);
      fg2.addColorStop(0, 'rgba(255,220,120,' + Math.min(1, flick) + ')');
      fg2.addColorStop(.4, 'rgba(255,150,60,' + (.5 * flick) + ')');
      fg2.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = fg2;
      ctx.beginPath(); ctx.arc(fx, fy - h * .11, h * .075, 0, Math.PI * 2); ctx.fill();
    }

    /* ---- 主旗 ---- */
    ctx.strokeStyle = '#cfd8e8'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -h * .72); ctx.lineTo(0, -h * .86); ctx.stroke();
    ctx.fillStyle = '#d23c3c';
    const fv2 = Math.sin(time * 2.8) * h * .018;
    ctx.beginPath();
    ctx.moveTo(0, -h * .86);
    ctx.quadraticCurveTo(w * .14, -h * .825 + fv2, w * .26, -h * .80 + fv2);
    ctx.lineTo(w * .26, -h * .72 + fv2);
    ctx.quadraticCurveTo(w * .14, -h * .715 + fv2, 0, -h * .70);
    ctx.closePath(); ctx.fill();
    // 旗上纹章
    ctx.fillStyle = '#ffe082';
    ctx.beginPath();
    ctx.moveTo(w * .13, -h * .80 + fv2); ctx.lineTo(w * .165, -h * .78 + fv2); ctx.lineTo(w * .13, -h * .755 + fv2);
    ctx.lineTo(w * .095, -h * .78 + fv2);
    ctx.closePath(); ctx.fill();

    /* ---- 拱门（石框 + 门栅 + 内部纵深） ---- */
    const dg = ctx.createLinearGradient(0, h * .06, 0, h * .32);
    dg.addColorStop(0, '#0c0604'); dg.addColorStop(1, '#241611');
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.moveTo(-w * .085, h * .32);
    ctx.lineTo(-w * .085, h * .06);
    ctx.arc(0, h * .06, w * .085, Math.PI, 0);
    ctx.lineTo(w * .085, h * .32);
    ctx.closePath(); ctx.fill();
    // 拱外框石
    ctx.strokeStyle = mix(stoneMid, '#000010', .25); ctx.lineWidth = w * .02;
    ctx.beginPath();
    ctx.moveTo(-w * .1, h * .32);
    ctx.lineTo(-w * .1, h * .06);
    ctx.arc(0, h * .06, w * .1, Math.PI, 0);
    ctx.lineTo(w * .1, h * .32);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(150,120,80,.55)'; ctx.lineWidth = 1.5;
    for (let gx = -w * .06; gx <= w * .06; gx += w * .04) {
      ctx.beginPath(); ctx.moveTo(gx, h * .3); ctx.lineTo(gx, h * .02); ctx.stroke();
    }

    /* ---- 主楼窗光（呼吸 + 拱形） ---- */
    const win = .55 + .45 * Math.sin(time * 1.8);
    for (const wx of [-w * .17, w * .17]) {
      ctx.fillStyle = 'rgba(255,196,96,' + (.4 + win * .4).toFixed(2) + ')';
      ctx.beginPath();
      ctx.moveTo(wx - w * .026, -h * .09);
      ctx.lineTo(wx - w * .026, -h * .16);
      ctx.arc(wx, -h * .16, w * .026, Math.PI, 0);
      ctx.lineTo(wx + w * .026, -h * .09);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(60,40,20,.5)'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();

    /* ---- 血量条 ---- */
    if (showBar) {
      const cx = x, cy = y + h * .45;
      ctx.fillStyle = 'rgba(0,0,0,.5)';
      M.roundRect(ctx, cx - w * .42, cy, w * .84, 8, 4); ctx.fill();
      const pct = M.clamp(hpPct, 0, 1);
      if (pct > 0) {
        const g = ctx.createLinearGradient(cx - w * .42, 0, cx - w * .42 + w * .84 * pct, 0);
        const c = pct > .5 ? '#66bb6a' : pct > .25 ? '#ffa726' : '#ef5350';
        g.addColorStop(0, c); g.addColorStop(1, mix(c, '#ffffff', .25));
        ctx.fillStyle = g;
        M.roundRect(ctx, cx - w * .42, cy, Math.max(8, w * .84 * pct), 8, 4); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1;
      M.roundRect(ctx, cx - w * .42 + .5, cy + .5, w * .84 - 1, 7, 3.5); ctx.stroke();
    }
  };

  /* ============ 项目精灵 ============ */
  art.drawProjectile = function (ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    const ang = Math.atan2(p.vy, p.vx);
    ctx.rotate(ang);
    const glow = (color, rr) => {
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
      g.addColorStop(0, color); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.fill();
    };
    switch (p.sprite) {
      case 'arrow': {
        glow('rgba(200,220,255,.18)', 10);
        ctx.strokeStyle = '#b08d5f'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(2, 0); ctx.stroke();
        const g2 = ctx.createLinearGradient(0, 0, 8, 0);
        g2.addColorStop(0, '#ffffff'); g2.addColorStop(1, '#b8c4d8');
        ctx.strokeStyle = g2; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(7, 0); ctx.stroke();
        ctx.fillStyle = '#e8eef8';
        ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(2, -3); ctx.lineTo(2, 3); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#4fc3f7'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(2, 0); ctx.stroke();
        break;
      }
      case 'rock': {
        const g2 = ctx.createRadialGradient(-2, -2, 0, 0, 0, 6);
        g2.addColorStop(0, '#a1887f'); g2.addColorStop(1, '#5d4037');
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.beginPath(); ctx.arc(2, 2, 2, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'bullet':
        glow('rgba(255,213,79,.4)', 9);
        ctx.fillStyle = '#ffe082';
        M.roundRect(ctx, -6, -2, 12, 4, 2); ctx.fill();
        ctx.fillStyle = '#fff8e1';
        M.roundRect(ctx, -2, -1, 6, 2, 1); ctx.fill();
        break;
      case 'bolt':
        glow('rgba(190,210,240,.3)', 8);
        ctx.fillStyle = '#cfd8e8';
        M.roundRect(ctx, -7, -1.5, 14, 3, 1.5); ctx.fill();
        ctx.fillStyle = '#8b9ab0';
        ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(3, -2.5); ctx.lineTo(3, 2.5); ctx.closePath(); ctx.fill();
        break;
      case 'fire': {
        glow('rgba(255,112,67,.45)', 13);
        ctx.fillStyle = '#ff7043';
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffab40';
        ctx.beginPath(); ctx.arc(-1.5, 0, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,235,59,.9)';
        ctx.beginPath(); ctx.arc(-3, 0, 2.2, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'orb': {
        const col = p.color || '#fff176';
        glow('rgba(255,241,118,.35)', 11);
        const g2 = ctx.createRadialGradient(-1.5, -1.5, 0, 0, 0, 5.5);
        g2.addColorStop(0, '#ffffff'); g2.addColorStop(.4, col); g2.addColorStop(1, mix(col, '#000020', .3));
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, 5.5, -2.4, -0.8); ctx.stroke();
        break;
      }
      case 'spear':
        ctx.strokeStyle = '#8d6e53'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(4, 0); ctx.stroke();
        ctx.fillStyle = '#dfe8f4';
        ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(3, -2.5); ctx.lineTo(3, 2.5); ctx.closePath(); ctx.fill();
        break;
      case 'potion':
        glow('rgba(156,204,101,.35)', 10);
        ctx.fillStyle = '#9ccc65';
        ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.6)';
        ctx.beginPath(); ctx.arc(-1.5, -1.5, 1.5, 0, Math.PI * 2); ctx.fill();
        break;
      case 'meteor': {
        glow('rgba(255,138,101,.5)', 16);
        ctx.fillStyle = '#ff8a65';
        ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffab40';
        ctx.beginPath(); ctx.arc(-2, 0, 5.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffd54f';
        ctx.beginPath(); ctx.arc(-3, -3, 3, 0, Math.PI * 2); ctx.fill();
        break;
      }
      default:
        glow('rgba(230,240,255,.3)', 8);
        ctx.fillStyle = '#eceff1';
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  };
})();
