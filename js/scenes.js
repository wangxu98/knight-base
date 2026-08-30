/* ============================================================
 * 骑士基地：世界起源 - scenes.js
 * SceneManager + 全部场景：Boot/Home/WorldMap/Loadout/Battle/
 * Result/Temple/Fusion/Shop/BaseUp/Guide/DevPanel
 * ============================================================ */
'use strict';
(function () {
  const M = KB.math, ui = KB.ui, CFG = KB.CONFIG;
  const W = () => KB.Main.viewW, H = () => KB.Main.viewH, SAFE = () => KB.Main.safe;

  /* ================= 场景管理器 ================= */
  const SM = KB.SceneManager = {
    stack: [],
    push(s) { this.stack.push(s); if (s.enter) s.enter(); if (s.buildUI) s.buildUI(); s._born = KB.Main.time; },
    pop() {
      const s = this.stack.pop();
      if (s && s.exit) s.exit();
      if (!this.stack.length) this.push(new Boot.HomeScene()); // 空栈兜底
      return s;
    },
    replace(s) { this.stack.pop(); this.push(s); },
    top() { return this.stack[this.stack.length - 1]; },
    update(dt) { const t = this.top(); if (t && t.update) t.update(dt); },
    draw(ctx) {
      for (const s of this.stack) {
        if (!s || !s.draw) continue;
        // 入场动效：淡入 + 轻微上滑（0.24s）
        let a = 1, dy = 0;
        if (s._born !== undefined) {
          const k = M.clamp((KB.Main.time - s._born) / .24, 0, 1);
          a = k; dy = (1 - k) * 14;
        }
        ctx.save();
        ctx.globalAlpha = a;
        if (dy) ctx.translate(0, dy);
        s.draw(ctx);
        ctx.restore();
      }
    },
    onTouch(type, x, y) {
      for (let i = this.stack.length - 1; i >= 0; i--) {
        const s = this.stack[i];
        if (s && s.onTouch) {
          if (s.onTouch(type, x, y)) return true;
        }
        if (!s || s.opaque !== false) return true; // 全屏场景拦截
      }
      return false;
    },
    onResize() { for (const s of this.stack) if (s.buildUI) s.buildUI(); },
  };

  /* ================= 通用：背景与顶栏 ================= */
  // 夜空装饰层（确定性生成，避免每帧闪烁）
  const skyStars = [];
  {
    const rng = KB.RNG(20240601);
    for (let i = 0; i < 64; i++) {
      skyStars.push({ x: rng(), y: rng() * .62, r: .6 + rng() * 1.3, tw: rng() * Math.PI * 2, sp: .5 + rng() * 1.5 });
    }
  }
  function drawSkyBg(ctx, top, bottom, o) {
    o = o || {};
    const w = W(), h = H();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, top || '#1a2444');
    g.addColorStop(.72, shadeMix(top || '#1a2444', bottom || '#0d1022', .55));
    g.addColorStop(1, bottom || '#0d1022');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    // 星星（闪烁）
    const t = KB.Main.time;
    for (const s of skyStars) {
      const a = .28 + .55 * Math.abs(Math.sin(s.tw + t * s.sp));
      ctx.fillStyle = 'rgba(214,226,255,' + a.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // 月亮（右上，带光晕；主界面自绘大月亮，可传 {moon:false} 跳过）
    if (o.moon !== false) {
      const mx = w * .84, my = h * .13, mr = Math.min(34, w * .03);
      const halo = ctx.createRadialGradient(mx, my, mr * .4, mx, my, mr * 3.4);
      halo.addColorStop(0, 'rgba(226,234,255,.24)');
      halo.addColorStop(1, 'rgba(226,234,255,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(mx - mr * 3.4, my - mr * 3.4, mr * 6.8, mr * 6.8);
      ctx.fillStyle = '#dfe7fb';
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(160,175,210,.5)';
      ctx.beginPath(); ctx.arc(mx - mr * .3, my - mr * .18, mr * .16, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(mx + mr * .26, my + mr * .3, mr * .11, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(mx + mr * .1, my - mr * .42, mr * .08, 0, Math.PI * 2); ctx.fill();
    }
    // 流云（两层视差）
    if (o.clouds !== false) {
      const drift = KB.Main.time;
      ctx.fillStyle = 'rgba(190,205,255,.05)';
      for (let i = 0; i < 3; i++) {
        const cx = ((drift * (5 + i * 3) + i * 470) % (w + 380)) - 190;
        const cy = h * (.12 + i * .09);
        ctx.beginPath();
        ctx.ellipse(cx, cy, 150 - i * 26, 17 - i * 3, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 90, cy + 7, 95 - i * 16, 12 - i * 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 底部地平微光
    const hz = ctx.createLinearGradient(0, h * .68, 0, h);
    hz.addColorStop(0, 'rgba(70,100,220,0)');
    hz.addColorStop(1, 'rgba(70,100,220,.10)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, h * .68, w, h * .32);
    // 暗角
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .42, w / 2, h / 2, Math.max(w, h) * .74);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,10,.38)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }
  function shadeMix(c1, c2, t) {
    const p = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    try {
      const a = p(c1), b = p(c2);
      return 'rgb(' + a.map((v, i) => Math.round(v * (1 - t) + b[i] * t)).join(',') + ')';
    } catch (e) { return c1; }
  }
  // 远山剪影（确定性起伏）
  function drawRidge(ctx, w, baseY, amp, seed) {
    ctx.beginPath();
    ctx.moveTo(0, baseY + amp);
    for (let x = 0; x <= w; x += 40) {
      const y = baseY - Math.abs(Math.sin(x * .004 + seed) * amp * .8 + Math.sin(x * .013 + seed * 3) * amp * .3);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, baseY + amp * 2);
    ctx.lineTo(0, baseY + amp * 2);
    ctx.closePath(); ctx.fill();
  }
  function drawDiamond(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
    ctx.closePath(); ctx.fill();
  }
  // 旗帜（随风摆动）dir: 1 右飘 / -1 左飘
  function drawBanner(ctx, x, y, dir, time) {
    ctx.save();
    // 杆
    ctx.strokeStyle = '#5d5548'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y + 60); ctx.lineTo(x, y - 66); ctx.stroke();
    ctx.fillStyle = '#d9a92e';
    ctx.beginPath(); ctx.arc(x, y - 70, 4, 0, Math.PI * 2); ctx.fill();
    // 旗面（波动）
    const wave = Math.sin(time * 2.2 + x * .01) * 6;
    const g = ctx.createLinearGradient(x, 0, x + dir * 58, 0);
    g.addColorStop(0, '#d23c3c'); g.addColorStop(1, '#8f1f1f');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x, y - 62);
    ctx.quadraticCurveTo(x + dir * 30, y - 58 + wave, x + dir * 58, y - 50);
    ctx.lineTo(x + dir * 58, y - 26);
    ctx.quadraticCurveTo(x + dir * 30, y - 30 + wave, x, y - 34);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function makeTopBar(title, onBack, opts) {
    // 返回一个 widget 组合（手动绘制版本由场景处理）
    opts = opts || {};
    const safe = SAFE();
    const bar = new ui.Panel({ bg: 'transparent', radius: 0, borderColor: null });
    bar.h = 56; bar.w = W(); bar.x = 0; bar.y = safe.t;
    const titleL = new ui.Label({ text: title, fontSize: 20, weight: 'bold' });
    bar.add(titleL);
    if (onBack) {
      const back = new ui.Button({ label: '‹', bg: '#28345c', fontSize: 22, radius: 19, minW: 38 });
      back.onTap = onBack;
      bar.add(back);
      bar._back = back;
    }
    // 货币显示
    bar._coins = true;
    bar.layout = () => {
      bar.w = W(); bar.y = SAFE().t; bar.h = 56;
      titleL.w = 300; titleL.h = 56;
      titleL.x = W() / 2 - 150; titleL.y = bar.y;
      if (bar._back) {
        bar._back.w = 38; bar._back.h = 38;
        bar._back.x = SAFE().l + 14; bar._back.y = bar.y + 9;
      }
    };
    bar._draw = (ctx) => {
      const s = SAFE();
      // 玻璃顶栏
      const g = ctx.createLinearGradient(0, bar.y, 0, bar.y + bar.h);
      g.addColorStop(0, 'rgba(15,21,44,.88)');
      g.addColorStop(1, 'rgba(9,13,30,.66)');
      ctx.fillStyle = g;
      ctx.fillRect(0, bar.y, W(), bar.h);
      // 底部金线 + 分隔光
      const gold = ctx.createLinearGradient(0, 0, W(), 0);
      gold.addColorStop(0, 'rgba(255,213,79,0)');
      gold.addColorStop(.5, 'rgba(255,213,79,.55)');
      gold.addColorStop(1, 'rgba(255,213,79,0)');
      ctx.fillStyle = gold;
      ctx.fillRect(0, bar.y + bar.h - 1.5, W(), 1.5);
      // 标题（柔影）+ 小饰线
      ctx.font = ui.font(20, 'bold');
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tx = W() / 2, ty = bar.y + bar.h / 2;
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillText(title, tx, ty + 1.5);
      ctx.fillStyle = '#f4f7ff';
      ctx.fillText(title, tx, ty);
      // 货币胶囊
      const coins = M.fmtNum(KB.Player.coins());
      ctx.font = ui.font(15, 'bold');
      const cw = ctx.measureText(coins).width + 52;
      const cx = W() - s.r - 14 - cw;
      const cy = bar.y + 11, chh = 32;
      ui.glass(ctx, cx, cy, cw, chh, 16, { top: 'rgba(38,49,94,.8)', bottom: 'rgba(13,18,38,.85)' });
      ui.drawCoin(ctx, cx + 19, cy + chh / 2, 11, '#ffd54f', '');
      ctx.font = ui.font(15, 'bold');
      ctx.fillStyle = '#ffe9a8'; ctx.textAlign = 'left';
      ctx.fillText(coins, cx + 36, cy + chh / 2);
    };
    return bar;
  }

  /* ================= Boot ================= */
  const Boot = KB.scenes = {};
  Boot.BootScene = function () {
    let t = 0, done = false;
    return {
      enter() { KB.Player.init(); },
      update(dt) {
        t += dt;
        if (t > 0.4 && !done) {
          done = true;
          KB.art.init && KB.art.init();
          SM.replace(new Boot.HomeScene());
          if (!KB.Player.state.guide.done) SM.push(new Boot.GuideScene());
        }
      },
      draw(ctx) {
        drawSkyBg(ctx);
        ctx.font = ui.font(28, 'bold');
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('骑士基地：世界起源', W() / 2, H() / 2 - 20);
        ctx.font = ui.font(14);
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.fillText('加载中…', W() / 2, H() / 2 + 24);
      },
      onTouch() { return true; },
    };
  };

  /* ================= Home 主基地 ================= */
  Boot.HomeScene = function () {
    const root = new ui.Widget();
    let pressT = 0, pressTimer = null;
    const self = this;
    // 萤火虫（确定性分布）
    const fireflies = [];
    {
      const rng = KB.RNG(99001);
      for (let i = 0; i < 16; i++) {
        fireflies.push({
          x: (rng() - .5) * 640, y: 470 + rng() * 130,
          ph: rng() * Math.PI * 2, sp: .4 + rng() * .8, r: 1.4 + rng() * 1.4,
        });
      }
    }
    // 星空 / 视差云 / 树线 / 草丛（确定性分布，绘制时只做轻量动画）
    const stars = [], clouds = [], trees = [], grass = [];
    {
      const rng = KB.RNG(77041);
      for (let i = 0; i < 90; i++) stars.push({ x: rng() * 1280, y: rng() * 400, r: .5 + rng() * 1.1, ph: rng() * Math.PI * 2 });
      for (let i = 0; i < 6; i++) clouds.push({ x: rng() * 1440, y: 46 + rng() * 170, s: 38 + rng() * 58, sp: 4 + rng() * 8, far: rng() > .5 });
      for (let i = 0; i < 18; i++) trees.push({ x: rng() * 1300 - 10, hh: 26 + rng() * 36, ph: rng() * 6 });
      for (let i = 0; i < 56; i++) grass.push({ x: rng() * 1280, y: 630 + rng() * 156, s: .7 + rng() * .9, ph: rng() * Math.PI * 2 });
    }

    function build() {
      root.removeAll();
      const w = W(), h = H(), s = SAFE();
      root.x = 0; root.y = 0; root.w = w; root.h = h;   // 命中区必须覆盖全屏，否则按钮无法点击
      // 顶栏：左币右星 状态胶囊
      root.add((function () {
        const p = new ui.Panel({ bg: 'transparent', radius: 0, borderColor: null });
        p.w = w; p.h = 40; p.x = 0; p.y = s.t + 8;
        p._draw = (ctx) => {
          const st = KB.Player.state;
          const y = SAFE().t + 28;
          ctx.textBaseline = 'middle';
          // 骑士币胶囊（左）
          ctx.font = ui.font(15, 'bold');
          const coins = M.fmtNum(st.player.coins);
          const cw = ctx.measureText(coins).width + 56;
          ui.glass(ctx, SAFE().l + 14, y - 17, cw, 34, 17, { top: 'rgba(38,49,94,.78)', bottom: 'rgba(13,18,38,.84)' });
          ui.drawCoin(ctx, SAFE().l + 33, y, 12, '#ffd54f', '骑');
          ctx.fillStyle = '#ffe9a8'; ctx.textAlign = 'left';
          ctx.fillText(coins, SAFE().l + 52, y);
          // 总星数胶囊（右）
          const total = KB.Player.totalStars() + ' / ' + KB.WORLDS.reduce((a, x) => a + x.levels * 10, 0);
          ctx.font = ui.font(15, 'bold');
          const sw = ctx.measureText('★ ' + total).width + 40;
          const sx = W() - SAFE().r - 14 - sw;
          ui.glass(ctx, sx, y - 17, sw, 34, 17, { top: 'rgba(38,49,94,.78)', bottom: 'rgba(13,18,38,.84)' });
          ctx.fillStyle = '#ffd54f'; ctx.textAlign = 'left';
          ctx.fillText('★ ' + total, sx + 20, y);
        };
        return p;
      })());

      // 主功能卡片 2×3（固定逻辑舞台，坐标即设计稿）
      const bw = 214, bh = 94, gapX = 22, gapY = 20;
      const gx = w / 2 - (bw * 3 + gapX * 2) / 2;
      const gy = 556;
      const items = [
        { icon: '🗺️', label: '世界征途', sub: '推图闯关', bg: '#1d6e42', act: () => SM.push(new Boot.WorldMapScene()) },
        { icon: '⚔️', label: '骑士防线', sub: '快速开战', bg: '#a03038', act: quickBattle },
        { icon: '🏛️', label: '骑士圣殿', sub: '查看升级', bg: '#4b3d9e', act: () => SM.push(new Boot.TempleScene()) },
        { icon: '🔮', label: '融合祭坛', sub: '白→紫→金', bg: '#7a2f9e', act: () => SM.push(new Boot.FusionScene()) },
        { icon: '🏪', label: '商店', sub: '招募骑士', bg: '#b8641c', act: () => SM.push(new Boot.ShopScene()) },
        { icon: '🏰', label: '基地升级', sub: 'Lv.' + KB.Player.baseLevel(), bg: '#0e6e85', act: () => SM.push(new Boot.BaseUpScene()) },
      ];
      self._rects = {};
      items.forEach((it, i) => {
        const r = Math.floor(i / 3), c = i % 3;
        const btn = new ui.Button({
          icon: it.icon, label: it.label, sub: it.sub, bg: it.bg,
          fontSize: 18, iconSize: 26, radius: 18,
        });
        btn.onTap = it.act;
        btn.x = gx + c * (bw + gapX); btn.y = gy + r * (bh + gapY);
        btn.w = bw; btn.h = bh;
        root.add(btn);
        self._rects[it.label] = btn;
      });

      // 版本号（长按开 DevPanel）
      root.add((function () {
        const l = new ui.Label({ text: 'v1.0 骑士基地 · 长按版本号开启调试', fontSize: 11, color: 'rgba(255,255,255,.35)' });
        l.w = 300; l.h = 20; l.x = 14; l.y = H() - SAFE().b - 22;
        l._rect = { x: l.x, y: l.y, w: l.w, h: l.h };
        return l;
      })());
    }

    function quickBattle() {
      // 找当前进度最近的未通关关卡
      const st = KB.Player.state;
      for (let wIdx = 0; wIdx < KB.WORLDS.length; wIdx++) {
        if (!KB.Player.isWorldUnlocked(wIdx)) break;
        for (let i = 0; i < KB.WORLDS[wIdx].levels; i++) {
          if (KB.Player.levelStars(wIdx, i) < 0) {
            if (!KB.Player.loadoutKnights().length) { SM.push(new Boot.LoadoutScene(wIdx, i)); return; }
            SM.push(new Boot.BattleScene(wIdx, i, { from: 'quick' }));
            return;
          }
        }
      }
      ui.toast('全部关卡已通关！敬请期待新世界');
    }

    return {
      _self: self,
      buildUI: build,
      update() {},
      draw(ctx) {
        const w = W(), h = H(), s = SAFE();
        const time = KB.Main.time;
        drawSkyBg(ctx, '#1d2c58', '#0a1124', { moon: false });   // 主界面自绘大月亮

        /* ---- 星空（闪烁） ---- */
        for (const st of stars) {
          const tw = .25 + .55 * Math.abs(Math.sin(time * 1.1 + st.ph));
          ctx.fillStyle = 'rgba(214,226,255,' + tw.toFixed(2) + ')';
          ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill();
        }
        /* ---- 月亮（光晕 + 环形山 + 暗缘） ---- */
        const mx = 1082, my = 118, mr = 40;
        const mglow = ctx.createRadialGradient(mx, my, mr * .5, mx, my, mr * 3.2);
        mglow.addColorStop(0, 'rgba(235,240,255,.22)');
        mglow.addColorStop(.5, 'rgba(200,215,255,.08)');
        mglow.addColorStop(1, 'rgba(200,215,255,0)');
        ctx.fillStyle = mglow;
        ctx.fillRect(mx - mr * 3.2, my - mr * 3.2, mr * 6.4, mr * 6.4);
        const mg2 = ctx.createRadialGradient(mx - mr * .35, my - mr * .4, mr * .1, mx, my, mr);
        mg2.addColorStop(0, '#ffffff'); mg2.addColorStop(.55, '#e8edf8'); mg2.addColorStop(1, '#b9c4dd');
        ctx.fillStyle = mg2;
        ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(150,160,190,.35)';
        ctx.beginPath(); ctx.arc(mx - mr * .3, my - mr * .12, mr * .16, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(mx + mr * .22, my + mr * .3, mr * .1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(mx + mr * .05, my - mr * .4, mr * .07, 0, Math.PI * 2); ctx.fill();

        /* ---- 远层云（慢速，淡） ---- */
        const drawCloud = (cx0, cy0, cs, ca) => {
          ctx.fillStyle = 'rgba(178,196,232,' + ca + ')';
          ctx.beginPath();
          ctx.arc(cx0, cy0, cs * .55, 0, Math.PI * 2);
          ctx.arc(cx0 - cs * .55, cy0 + cs * .12, cs * .38, 0, Math.PI * 2);
          ctx.arc(cx0 + cs * .58, cy0 + cs * .14, cs * .42, 0, Math.PI * 2);
          ctx.arc(cx0 + cs * .1, cy0 - cs * .22, cs * .34, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(10,16,38,' + (ca * .5) + ')';
          ctx.beginPath(); ctx.ellipse(cx0, cy0 + cs * .3, cs * .9, cs * .16, 0, 0, Math.PI); ctx.fill();
        };
        for (const c of clouds) if (c.far) drawCloud(((c.x + time * c.sp) % 1520) - 120, c.y, c.s, .16);

        /* ---- 远山三层剪影 ---- */
        ctx.fillStyle = '#182448';
        drawRidge(ctx, w, 488, 130, 0.7);
        ctx.fillStyle = '#141f3e';
        drawRidge(ctx, w, 512, 120, 0.9);
        ctx.fillStyle = '#0f1730';
        drawRidge(ctx, w, 538, 90, 1.6);

        /* ---- 近层云（快速，稍亮） ---- */
        for (const c of clouds) if (!c.far) drawCloud(((c.x + time * c.sp) % 1520) - 120, c.y, c.s, .22);

        /* ---- 树线剪影（地平线前，随风微摆） ---- */
        for (const t of trees) {
          const sway = Math.sin(time * .9 + t.ph) * 1.2;
          const bx = t.x, base = 552, th = t.hh;
          ctx.fillStyle = 'rgba(9,17,14,.9)';
          ctx.fillRect(bx - 1.2, base - th * .3, 2.4, th * .3 + 4);
          for (let ly = 0; ly < 3; ly++) {
            const lw2 = th * (.42 - ly * .1), ly2 = base - th * .28 - ly * th * .26;
            ctx.beginPath();
            ctx.moveTo(bx - lw2, ly2);
            ctx.lineTo(bx + sway * (ly + 1) * .4, ly2 - th * .38);
            ctx.lineTo(bx + lw2, ly2);
            ctx.closePath(); ctx.fill();
          }
        }

        /* ---- 标题徽章区 ---- */
        const tcx = w / 2;
        // 徽章光晕
        const glow = ctx.createRadialGradient(tcx, 108, 8, tcx, 108, 90);
        glow.addColorStop(0, 'rgba(255,213,79,.16)');
        glow.addColorStop(1, 'rgba(255,213,79,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(tcx - 90, 18, 180, 180);
        // 盾形徽章
        ctx.save();
        ctx.translate(tcx, 106);
        const shield = new Path2D();
        shield.moveTo(0, -30); shield.quadraticCurveTo(26, -30, 26, -12);
        shield.quadraticCurveTo(26, 12, 0, 32);
        shield.quadraticCurveTo(-26, 12, -26, -12);
        shield.quadraticCurveTo(-26, -30, 0, -30);
        const sg = ctx.createLinearGradient(0, -30, 0, 32);
        sg.addColorStop(0, '#3b4a86'); sg.addColorStop(1, '#1c2650');
        ctx.fillStyle = sg; ctx.fill(shield);
        ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 2.5; ctx.stroke(shield);
        ctx.strokeStyle = 'rgba(255,213,79,.35)'; ctx.lineWidth = 6; ctx.stroke(shield);
        ctx.fillStyle = '#ffe9a8';
        ctx.font = ui.font(26, 'bold');
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('⚔', 0, 1);
        ctx.restore();
        // 主标题（金色渐变 + 柔影）
        ctx.font = ui.font(34, 'bold');
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillText('骑士基地 · 世界起源', tcx, 174 + 2);
        const tg = ctx.createLinearGradient(0, 158, 0, 190);
        tg.addColorStop(0, '#ffe9a8'); tg.addColorStop(.55, '#ffd54f'); tg.addColorStop(1, '#d9a92e');
        ctx.fillStyle = tg;
        ctx.fillText('骑士基地 · 世界起源', tcx, 174);
        // 饰线 ◆—◆
        ctx.strokeStyle = 'rgba(255,213,79,.5)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(tcx - 150, 204); ctx.lineTo(tcx - 16, 204); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tcx + 16, 204); ctx.lineTo(tcx + 150, 204); ctx.stroke();
        ctx.fillStyle = '#ffd54f';
        drawDiamond(ctx, tcx, 204, 4.5);

        /* ---- 地面（承托层） ---- */
        const gg = ctx.createLinearGradient(0, 620, 0, h);
        gg.addColorStop(0, '#0c1d12');
        gg.addColorStop(1, '#07130c');
        ctx.fillStyle = gg;
        ctx.fillRect(0, 620, w, h - 620);

        /* ---- 中央城堡与山丘 ---- */
        const hillY = 566;
        // 城堡背光
        const cg = ctx.createRadialGradient(w / 2, 452, 20, w / 2, 452, 240);
        cg.addColorStop(0, 'rgba(120,150,255,.14)');
        cg.addColorStop(1, 'rgba(120,150,255,0)');
        ctx.fillStyle = cg;
        ctx.fillRect(w / 2 - 240, 212, 480, 480);
        // 山丘
        const hg = ctx.createLinearGradient(0, hillY - 60, 0, hillY + 130);
        hg.addColorStop(0, '#1a3524'); hg.addColorStop(1, '#0a1a10');
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.moveTo(w / 2 - 430, hillY + 120);
        ctx.quadraticCurveTo(w / 2 - 300, hillY - 66, w / 2, hillY - 60);
        ctx.quadraticCurveTo(w / 2 + 300, hillY - 66, w / 2 + 430, hillY + 120);
        ctx.closePath(); ctx.fill();
        // 石径（石板逐块）
        ctx.strokeStyle = 'rgba(196,181,148,.16)'; ctx.lineWidth = 26; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(w / 2, 588);
        ctx.quadraticCurveTo(w / 2 + 26, 664, w / 2 + 10, 760);
        ctx.stroke();
        ctx.fillStyle = 'rgba(206,192,160,.26)';
        for (let i = 0; i < 7; i++) {
          const tt = .12 + i * .13;
          const sx2 = w / 2 + 52 * tt * (1 - tt) + 10 * tt * tt;   // 贝塞尔 x(t)
          const sy2 = 588 + 152 * tt + 20 * tt * tt;                // 贝塞尔 y(t)
          const sw3 = 15 - i * 1.1;
          ctx.beginPath(); ctx.ellipse(sx2, sy2, sw3, sw3 * .6, tt * .5, 0, Math.PI * 2); ctx.fill();
        }
        // 城堡（主界面不显示血条）
        KB.art.drawCore(ctx, w / 2, 452, 190, 250, 1, time, false);
        // 两翼旗帜
        drawBanner(ctx, w / 2 - 205, hillY - 48, 1, time);
        drawBanner(ctx, w / 2 + 205, hillY - 40, -1, time);

        /* ---- 前景草丛（随风摆动） ---- */
        ctx.lineCap = 'round';
        for (const g of grass) {
          const sway2 = Math.sin(time * 1.6 + g.ph) * 2.2 * g.s;
          ctx.strokeStyle = 'rgba(52,96,66,.8)';
          ctx.lineWidth = 1.4 * g.s;
          for (let k = -1; k <= 1; k++) {
            ctx.beginPath();
            ctx.moveTo(g.x + k * 2.6 * g.s, g.y);
            ctx.quadraticCurveTo(g.x + k * 3 * g.s, g.y - 5 * g.s, g.x + k * 4 * g.s + sway2, g.y - 9 * g.s);
            ctx.stroke();
          }
        }

        /* ---- 萤火虫 ---- */
        ctx.save();
        for (let i = 0; i < fireflies.length; i++) {
          const f = fireflies[i];
          const fx = w / 2 + f.x + Math.sin(time * f.sp + f.ph) * 26;
          const fy = f.y + Math.cos(time * f.sp * .8 + f.ph) * 18;
          const fa = .25 + .55 * Math.abs(Math.sin(time * 1.6 + f.ph * 2));
          ctx.fillStyle = 'rgba(255,224,130,' + fa.toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(fx, fy, f.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();

        root.draw(ctx);
      },
      onTouch(type, x, y) {
        if (type === 'down') {
          pressT = KB.Main.time;
          pressTimer = setInterval(() => {
            if (KB.Main.time - pressT > 1.4) {
              clearInterval(pressTimer); pressTimer = null;
              SM.push(new Boot.DevPanelScene());
            }
          }, 300);
        } else if (type === 'up' || type === 'cancel') {
          if (pressTimer) { clearInterval(pressTimer); pressTimer = null; }
        }
        root.onTouch(type, x, y);
        return true;
      },
    };
  };

  /* ================= 世界地图 ================= */
  Boot.WorldMapScene = function () {
    let curWorld = Math.min(KB.Player.state.unlockedWorld, KB.WORLDS.length - 1);
    const self = this;

    function levelUnlocked(w, i) {
      if (!KB.Player.isWorldUnlocked(w)) return false;
      if (i === 0) return true;
      return KB.Player.levelStars(w, i - 1) >= 0;
    }

    function build() { self._nodeRects = []; }
    build();

    return {
      _self: self,
      buildUI: build,
      update() {},
      draw(ctx) {
        drawSkyBg(ctx, '#1d2c50', '#0d1022');
        const w = W(), h = H(), s = SAFE();
        const world = KB.WORLDS[curWorld];
        // 顶栏
        ctx.fillStyle = 'rgba(10,14,30,.85)';
        ctx.fillRect(0, s.t, w, 52);
        // 返回
        self._backRect = { x: s.l + 8, y: s.t + 6, w: 76, h: 40 };
        drawBackBtn(ctx, s.l + 8, s.t + 6);
        ctx.font = ui.font(19, 'bold');
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('世界征途', w / 2, s.t + 26);
        // 世界 chips
        const chipW = Math.min(120, (w - s.l - s.r - 130) / KB.WORLDS.length);
        const chipsX = s.l + 96;
        self._chips = [];
        KB.WORLDS.forEach((wd, i) => {
          const x = chipsX + i * (chipW + 6);
          const unlocked = KB.Player.isWorldUnlocked(i);
          const sel = i === curWorld;
          ctx.fillStyle = sel ? wd.pal.accent : (unlocked ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.06)');
          M.roundRect(ctx, x, s.t + 8, chipW, 36, 10); ctx.fill();
          ctx.font = ui.font(sel ? 14 : 13, sel ? 'bold' : '');
          ctx.fillStyle = unlocked ? (sel ? '#1a1a2e' : 'rgba(255,255,255,.8)') : 'rgba(255,255,255,.3)';
          ctx.textAlign = 'center';
          ctx.fillText(unlocked ? wd.name : '🔒' + wd.name, x + chipW / 2, s.t + 26);
          self._chips.push({ x, y: s.t + 8, w: chipW, h: 36, i });
        });
        // 本世界星数
        let stars = 0, cleared = 0;
        for (let i = 0; i < world.levels; i++) {
          const st = KB.Player.levelStars(curWorld, i);
          if (st >= 0) { stars += st; cleared++; }
        }
        ctx.textAlign = 'left';
        ctx.font = ui.font(14, 'bold');
        ctx.fillStyle = '#ffd54f';
        ctx.fillText('★ ' + stars + ' / ' + world.levels * 10 + '　进度 ' + cleared + '/' + world.levels, s.l + 20, s.t + 76);

        // 关卡网格
        const cols = 5;
        const areaY = s.t + 96, areaH = h - s.b - areaY - 10;
        const nodeR = Math.min(52, (areaH / Math.ceil(world.levels / cols)) / 2 - 8, (w - s.l - s.r) / cols / 2 - 8);
        const bossIdxArr = KB.bossLevelIndices(world);
        self._nodeRects = [];
        for (let i = 0; i < world.levels; i++) {
          const r = Math.floor(i / cols), c = i % cols;
          const cx = s.l + (w - s.l - s.r) / cols * (c + 0.5);
          const cy = areaY + areaH / Math.ceil(world.levels / cols) * (r + 0.5);
          const unlocked = levelUnlocked(curWorld, i);
          const st = KB.Player.levelStars(curWorld, i);
          const isBoss = bossIdxArr.includes(i + 1);
          // 节点
          ctx.beginPath(); ctx.arc(cx, cy, nodeR, 0, Math.PI * 2);
          ctx.fillStyle = !unlocked ? 'rgba(255,255,255,.08)' : isBoss ? 'rgba(198,40,40,.85)' : world.pal.laneA;
          ctx.fill();
          ctx.lineWidth = 3;
          ctx.strokeStyle = st >= 0 ? '#ffd54f' : 'rgba(255,255,255,.35)';
          ctx.stroke();
          ctx.font = ui.font(Math.round(nodeR * 0.55), 'bold');
          ctx.fillStyle = unlocked ? '#fff' : 'rgba(255,255,255,.3)';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(isBoss ? '👑' : String(i + 1), cx, cy - 4);
          if (unlocked) {
            ctx.font = ui.font(Math.round(nodeR * 0.32), 'bold');
            ctx.fillStyle = st > 0 ? '#ffd54f' : 'rgba(255,255,255,.5)';
            ctx.fillText(st > 0 ? '★' + st : '未通关', cx, cy + nodeR * 0.55);
          }
          self._nodeRects.push({ x: cx - nodeR, y: cy - nodeR, w: nodeR * 2, h: nodeR * 2, i });
          // 连接线
          if (i % cols < cols - 1 && i + 1 < world.levels) {
            const nx = s.l + (w - s.l - s.r) / cols * ((i % cols) + 1.5);
            ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(cx + nodeR + 4, cy); ctx.lineTo(nx - nodeR - 4, cy); ctx.stroke();
          }
        }
        // 世界说明
        ctx.font = ui.font(12);
        ctx.fillStyle = 'rgba(255,255,255,.45)';
        ctx.textAlign = 'center';
        ctx.fillText('Boss：' + world.bosses.slice(0, 3).join('、') + ' …（每世界 6 位）', w / 2, h - s.b - 18);
      },
      onTouch(type, x, y) {
        if (type !== 'up') return true;
        const inR = (r) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
        if (inR(self._backRect)) { SM.pop(); return true; }
        for (const c of (self._chips || [])) {
          if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
            if (KB.Player.isWorldUnlocked(c.i)) { curWorld = c.i; } else ui.toast('先通关前面的世界');
            return true;
          }
        }
        for (const n of (self._nodeRects || [])) {
          if (x >= n.x && x <= n.x + n.w && y >= n.y && y <= n.y + n.h) {
            if (levelUnlocked(curWorld, n.i)) {
              SM.push(new Boot.LoadoutScene(curWorld, n.i));
            } else ui.toast('先通关上一关');
            return true;
          }
        }
        return true;
      },
    };
  };

  function drawBackBtn(ctx, x, y, onTap) {
    // 只画；触控由场景 _backRect 处理
    ctx.fillStyle = '#37474f';
    M.roundRect(ctx, x, y, 76, 40, 10); ctx.fill();
    ctx.font = ui.font(15, 'bold');
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('‹ 返回', x + 38, y + 20);
  }

  /* ================= 出战阵容选择 ================= */
  Boot.LoadoutScene = function (worldIdx, levelIdx0) {
    const self = this;
    let selected = KB.Player.loadoutKnights().map(k => k.uid);
    const MAX = CFG.MAX_LOADOUT;

    function build() {
      self._cards = [];
      const w = W(), h = H(), s = SAFE();
      const knights = KB.Player.knights();
      const areaY = s.t + 118, areaH = h - s.b - areaY - 86;
      const cols = Math.min(8, Math.max(4, Math.floor(knights.length ? knights.length / 3 + 2 : 4)));
      const cw = Math.min(96, (w - s.l - s.r - 24) / cols - 8);
      const rows = Math.ceil(knights.length / cols);
      const ch = Math.min(110, areaH / Math.max(1, rows) - 10);
      knights.forEach((k, i) => {
        const r = Math.floor(i / cols), c = i % cols;
        const totalW = cols * (cw + 8) - 8;
        const x = (w - totalW) / 2 + c * (cw + 8);
        const y = areaY + r * (ch + 10);
        self._cards.push({ x, y, w: cw, h: ch, k });
      });
      self._startBtn = {
        x: w / 2 + 14, y: h - s.b - 66, w: 170, h: 52,
      };
      self._clearBtn = { x: w / 2 - 188, y: h - s.b - 66, w: 170, h: 52 };
    }
    build();

    return {
      _self: self,
      buildUI: build,
      update() {},
      draw(ctx) {
        drawSkyBg(ctx, '#1d2c50', '#0d1022');
        const w = W(), h = H(), s = SAFE();
        const lv = KB.getLevelDef(worldIdx, levelIdx0);
        ctx.fillStyle = 'rgba(10,14,30,.85)';
        ctx.fillRect(0, s.t, w, 52);
        self._backRect = { x: s.l + 8, y: s.t + 6, w: 76, h: 40 };
        drawBackBtn(ctx, s.l + 8, s.t + 6);
        ctx.font = ui.font(18, 'bold');
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('出击准备', w / 2, s.t + 26);
        // 关卡信息
        ctx.font = ui.font(15, 'bold');
        ctx.fillStyle = lv.isBoss ? '#ff8a80' : '#a5d6a7';
        ctx.fillText(lv.world.name + ' 第' + (levelIdx0 + 1) + '关' + (lv.isBoss ? ' · 👑' + lv.bossName : '') +
          '　⚔️' + lv.waves.length + '波　奖励 ' + (KB.Player.firstClear(worldIdx, levelIdx0) ? lv.reward.first : lv.reward.replay) + '币',
          w / 2, s.t + 84);

        // 卡片
        for (const c of self._cards) {
          const sel = selected.includes(c.k.uid);
          const face = KB.art.cardFace(c.k.defId, c.k.rarity, Math.round(c.w), Math.round(c.h));
          ctx.save();
          if (!sel) ctx.globalAlpha = 0.55;
          ctx.drawImage(face, c.x, c.y, c.w, c.h);
          if (sel) {
            ctx.strokeStyle = '#69f0ae'; ctx.lineWidth = 3;
            M.roundRect(ctx, c.x + 1, c.y + 1, c.w - 2, c.h - 2, 10); ctx.stroke();
            ctx.fillStyle = '#69f0ae';
            ctx.beginPath(); ctx.arc(c.x + c.w - 10, c.y + 10, 9, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1b5e20'; ctx.font = ui.font(11, 'bold'); ctx.textAlign = 'center';
            ctx.fillText('✓', c.x + c.w - 10, c.y + 11);
          }
          if (c.k.level > 1) {
            ctx.font = ui.font(10, 'bold'); ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
            ctx.fillText('Lv' + c.k.level, c.x + 5, c.y + 11);
          }
          ctx.restore();
        }
        if (!KB.Player.knights().length) {
          ctx.font = ui.font(15);
          ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.textAlign = 'center';
          ctx.fillText('还没有骑士，先去商店招募吧！', w / 2, h / 2);
        }
        // 底部
        ctx.fillStyle = 'rgba(10,14,30,.9)';
        ctx.fillRect(0, h - s.b - 80, w, 80 + s.b);
        ctx.font = ui.font(14);
        ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.textAlign = 'center';
        ctx.fillText('已选 ' + selected.length + ' / ' + MAX + '（点击卡片切换出战）', w / 2, h - s.b - 58);
        // 清空按钮
        ctx.fillStyle = '#546e7a';
        M.roundRect(ctx, self._clearBtn.x, self._clearBtn.y, self._clearBtn.w, self._clearBtn.h, 12); ctx.fill();
        ctx.font = ui.font(16, 'bold'); ctx.fillStyle = '#fff';
        ctx.fillText('清空', self._clearBtn.x + self._clearBtn.w / 2, self._clearBtn.y + 26);
        // 开战按钮
        const can = selected.length > 0;
        ctx.fillStyle = can ? '#c62828' : '#455a64';
        M.roundRect(ctx, self._startBtn.x, self._startBtn.y, self._startBtn.w, self._startBtn.h, 12); ctx.fill();
        ctx.font = ui.font(18, 'bold'); ctx.fillStyle = '#fff';
        ctx.fillText('⚔️ 开战', self._startBtn.x + self._startBtn.w / 2, self._startBtn.y + 27);
      },
      onTouch(type, x, y) {
        if (type !== 'up') return true;
        const inR = (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
        if (self._backRect && inR(self._backRect)) { SM.pop(); return true; }
        if (inR(self._startBtn)) {
          if (!selected.length) { ui.toast('至少选择一名骑士'); return true; }
          KB.Player.setLoadout(selected);
          SM.replace(new Boot.BattleScene(worldIdx, levelIdx0, { from: 'map' }));
          return true;
        }
        if (inR(self._clearBtn)) { selected = []; return true; }
        for (const c of self._cards) {
          if (inR(c)) {
            const i = selected.indexOf(c.k.uid);
            if (i >= 0) selected.splice(i, 1);
            else if (selected.length < MAX) selected.push(c.k.uid);
            else ui.toast('最多携带 ' + MAX + ' 名');
            return true;
          }
        }
        return true;
      },
    };
  };

  /* ================= 战斗场景 ================= */
  Boot.BattleScene = function (worldIdx, levelIdx0, opts) {
    opts = opts || {};
    const self = this;
    let battle = null, acc = 0;
    const levelDef = KB.getLevelDef(worldIdx, levelIdx0);

    function start() {
      const loadout = KB.Player.loadoutKnights();
      battle = KB.Battle({
        levelDef,
        loadout,
        onEnd: (data) => handleEnd(data),
      });
      battle.computeLayout();
      acc = 0;
    }

    function handleEnd(data) {
      if (data.restart) { start(); return; }
      if (data.quit) {
        SM.pop(); // 弹掉 Battle 自身，回到来源（WorldMap / Home）
        return;
      }
      SM.push(new Boot.ResultScene(worldIdx, levelIdx0, data, opts));
    }

    start();

    return {
      update(dt) {
        if (!battle || battle.paused) return;
        acc += dt * battle.speed;
        const step = 1 / 60;
        let n = 0;
        while (acc >= step && n < 8) { battle.update(step); acc -= step; n++; }
        if (n >= 8) acc = 0;
      },
      draw(ctx) { if (battle) battle.draw(ctx, KB.Main.time); },
      onTouch(type, x, y) { if (battle) battle.onTouch(type, x, y); return true; },
      _battle: () => battle,
    };
  };

  /* ================= 结算 ================= */
  Boot.ResultScene = function (worldIdx, levelIdx0, result, opts) {
    const self = this;
    const lv = KB.getLevelDef(worldIdx, levelIdx0);
    const first = KB.Player.firstClear(worldIdx, levelIdx0);
    let coins = 0, dropKnight = null;

    // 进场即结算入档
    if (result.win) {
      coins = first ? lv.reward.first : lv.reward.replay;
      KB.Player.addCoins(coins);
      KB.Player.state.stats.battlesWon++;
      if (first && lv.reward.dropKnight) {
        dropKnight = KB.Player.grant(KB.math.pick(KB.WHITE_IDS), 0);
      }
      KB.Player.recordResult(worldIdx, levelIdx0, result.stars, true);
    }
    const isFinal = worldIdx === KB.WORLDS.length - 1 && levelIdx0 === KB.WORLDS[worldIdx].levels - 1 && result.win;

    function build() {
      const w = W(), h = H(), s = SAFE();
      self._btns = [
        { id: 'next', label: '下一关 ›', x: w / 2 + 14, y: h - s.b - 150, w: 150, h: 48, color: '#2e7d32', show: result.win && !isFinal },
        { id: 'replay', label: '🔄 再来一次', x: w / 2 - 164, y: h - s.b - 150, w: 150, h: 48, color: '#ef6c00', show: true },
        { id: 'exit', label: '返回', x: w / 2 - 75, y: h - s.b - 92, w: 150, h: 44, color: '#546e7a', show: true },
      ].filter(b => b.show);
    }
    build();

    return {
      _self: self,
      opaque: false,
      buildUI: build,
      update() {},
      draw(ctx) {
        const w = W(), h = H(), s = SAFE();
        ctx.fillStyle = 'rgba(0,0,0,.65)';
        ctx.fillRect(0, 0, w, h);
        const pw = Math.min(460, w * 0.9), ph = Math.min(480, h * 0.82);
        const px = (w - pw) / 2, py = (h - ph) / 2;
        ctx.fillStyle = 'rgba(16,22,44,.97)';
        M.roundRect(ctx, px, py, pw, ph, 20); ctx.fill();
        ctx.strokeStyle = result.win ? 'rgba(255,213,79,.6)' : 'rgba(255,138,128,.5)';
        ctx.lineWidth = 2;
        M.roundRect(ctx, px + 1, py + 1, pw - 2, ph - 2, 19); ctx.stroke();

        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = ui.font(24, 'bold');
        ctx.fillStyle = result.win ? '#ffd54f' : '#ff8a80';
        ctx.fillText(result.win ? '🏆 关卡完成！' : '💀 防线失守', w / 2, py + 42);

        if (result.win) {
          // 大星星
          ctx.font = ui.font(46, 'bold');
          ctx.fillStyle = '#ffd54f';
          ctx.fillText('★ ' + result.stars, w / 2, py + 96);
          ctx.font = ui.font(13);
          ctx.fillStyle = 'rgba(255,255,255,.6)';
          ctx.fillText('满分 10 星', w / 2, py + 126);
          // 判定项
          const items = [
            ['通关', result.flags.win], ['不用道具', result.flags.noItems],
            ['3分钟内', result.flags.fast], ['不损失骑士', result.flags.noLoss],
            ['核心100%血量', result.flags.coreFull],
          ];
          items.forEach((it, i) => {
            const iy = py + 156 + i * 28;
            ctx.textAlign = 'left';
            ctx.font = ui.font(14);
            ctx.fillStyle = 'rgba(255,255,255,.75)';
            ctx.fillText(it[0], px + 56, iy);
            ctx.textAlign = 'right';
            ctx.fillStyle = it[1] ? '#69f0ae' : 'rgba(255,255,255,.3)';
            ctx.font = ui.font(14, 'bold');
            ctx.fillText(it[1] ? '✓ +' + (i === 4 ? 3 : 2) : '✗', px + pw - 56, iy);
          });
          // 奖励
          ctx.textAlign = 'center';
          ctx.font = ui.font(15, 'bold');
          ctx.fillStyle = '#ffd54f';
          let rw = '奖励：骑士币 ×' + coins + (first ? '（首通）' : '');
          if (dropKnight) {
            const def = KB.knightById(dropKnight.defId);
            rw += '　新骑士 ' + def.name;
          }
          ctx.fillText(rw, w / 2, py + ph - 176);
          if (isFinal) {
            ctx.font = ui.font(17, 'bold');
            ctx.fillStyle = '#ff8a80';
            ctx.fillText('🌌 最终Boss「抹除者」已击败！', w / 2, py + ph - 148);
            ctx.font = ui.font(14);
            ctx.fillStyle = 'rgba(255,255,255,.7)';
            ctx.fillText('新世界 敬请期待', w / 2, py + ph - 126);
          }
        } else {
          ctx.font = ui.font(15);
          ctx.fillStyle = 'rgba(255,255,255,.75)';
          KB.ui.wrapText(ctx, '基地核心被摧毁了。升级骑士、融合更强的卡，或调整阵容再试一次！', w / 2, py + 120, pw - 60, 26);
          ctx.font = ui.font(13);
          ctx.fillStyle = 'rgba(255,255,255,.5)';
          ctx.fillText('坚持了 ' + M.fmtTime(result.time), w / 2, py + 190);
        }
        // 按钮
        for (const b of self._btns) {
          ctx.fillStyle = b.color;
          M.roundRect(ctx, b.x, b.y, b.w, b.h, 12); ctx.fill();
          ctx.font = ui.font(16, 'bold');
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
          ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
        }
      },
      onTouch(type, x, y) {
        if (type !== 'up') return true;
        const inR = (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
        for (const b of self._btns) {
          if (!inR(b)) continue;
          if (b.id === 'next') {
            // 下一关（本世界或下一世界第1关）
            let nw = worldIdx, ni = levelIdx0 + 1;
            if (ni >= KB.WORLDS[worldIdx].levels) { nw++; ni = 0; }
            SM.pop(); // 弹掉 Result 自身
            if (nw >= KB.WORLDS.length) {
              SM.pop(); // 已是最后一关：回到 WorldMap / Home
            } else {
              SM.replace(new Boot.LoadoutScene(nw, ni)); // 弹掉旧 Battle，进入下一关布阵
            }
            return true;
          }
          if (b.id === 'replay') {
            SM.replace(new Boot.BattleScene(worldIdx, levelIdx0, opts));
            return true;
          }
          if (b.id === 'exit') {
            SM.pop(); // Result
            SM.pop(); // Battle → 回到 WorldMap / Home
            return true;
          }
        }
        return true;
      },
    };
  };

  /* ================= 骑士圣殿 ================= */
  Boot.TempleScene = function () {
    const self = this;
    let selUid = null;

    function getKnights() {
      const ks = KB.Player.knights().slice();
      ks.sort((a, b) => (b.rarity - a.rarity) || (b.level - a.level));
      return ks;
    }

    function build() {
      const w = W(), h = H(), s = SAFE();
      const listW = Math.min(430, w * 0.42);
      self._listArea = { x: s.l + 8, y: s.t + 60, w: listW, h: h - s.b - s.t - 70 };
      self._detail = { x: s.l + listW + 24, y: s.t + 60, w: w - s.r - listW - 40, h: h - s.b - s.t - 70 };
      self._upBtn = null;
      self._scroll = { y: 0, max: 0 };
      const ks = getKnights();
      if (!selUid && ks.length) selUid = ks[0].uid;
    }
    build();

    return {
      _self: self,
      buildUI: build,
      update() {},
      draw(ctx) {
        drawSkyBg(ctx, '#1d2c50', '#0d1022');
        const w = W(), h = H(), s = SAFE();
        ctx.fillStyle = 'rgba(10,14,30,.85)';
        ctx.fillRect(0, s.t, w, 52);
        self._backRect = { x: s.l + 8, y: s.t + 6, w: 76, h: 40 };
        drawBackBtn(ctx, s.l + 8, s.t + 6);
        ctx.font = ui.font(19, 'bold');
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('骑士圣殿（共 ' + KB.Player.knights().length + ' 名）', w / 2, s.t + 26);

        const ks = getKnights();
        if (!ks.length) {
          ctx.font = ui.font(15);
          ctx.fillStyle = 'rgba(255,255,255,.6)';
          ctx.fillText('还没有骑士，去商店招募吧', w / 2, h / 2);
          return;
        }
        // 列表
        const A = self._listArea;
        ctx.save();
        ctx.beginPath(); ctx.rect(A.x, A.y, A.w, A.h); ctx.clip();
        const rh = 74, gap = 6;
        self._rows = [];
        ks.forEach((k, i) => {
          const y = A.y + i * (rh + gap) - self._scroll.y;
          if (y > A.y + A.h || y + rh < A.y) { self._rows.push({ y, k }); return; }
          const sel = k.uid === selUid;
          ctx.fillStyle = sel ? 'rgba(105,240,174,.16)' : 'rgba(255,255,255,.06)';
          M.roundRect(ctx, A.x, y, A.w, rh, 12); ctx.fill();
          if (sel) { ctx.strokeStyle = '#69f0ae'; ctx.lineWidth = 2; M.roundRect(ctx, A.x + 1, y + 1, A.w - 2, rh - 2, 11); ctx.stroke(); }
          const face = KB.art.cardFace(k.defId, k.rarity, 62, rh - 10);
          ctx.drawImage(face, A.x + 6, y + 5, 62, rh - 10);
          const def = KB.knightById(k.defId);
          ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
          ctx.font = ui.font(15, 'bold');
          ctx.fillStyle = CFG.RARITY_COLOR[k.rarity];
          ctx.fillText(def.name + ' ' + CFG.RARITY_NAME[k.rarity] + (k.greatBonus ? '✨' : ''), A.x + 78, y + 20);
          ctx.font = ui.font(12);
          ctx.fillStyle = 'rgba(255,255,255,.7)';
          const st = KB.StatCalc.calc(k);
          ctx.fillText('Lv.' + k.level + '　血' + st.hp + ' 攻' + st.atk + ' 防' + st.defv, A.x + 78, y + 42);
          ctx.fillStyle = 'rgba(255,255,255,.5)';
          ctx.fillText((k.skills || [def.skill]).join(' · '), A.x + 78, y + 60);
          self._rows.push({ y, k, rowY: y, h: rh });
        });
        ctx.restore();
        self._scroll.max = Math.max(0, ks.length * (rh + gap) - A.h);
        // 滚动条
        if (self._scroll.max > 0) {
          const th = A.h * (A.h / (ks.length * (rh + gap)));
          ctx.fillStyle = 'rgba(255,255,255,.2)';
          M.roundRect(ctx, A.x + A.w - 5, A.y + (self._scroll.y / self._scroll.max) * (A.h - th), 3, th, 2); ctx.fill();
        }

        // 详情
        const D = self._detail;
        const k = KB.Player.byUid(selUid) || ks[0];
        if (k) {
          const def = KB.knightById(k.defId);
          const st = KB.StatCalc.calc(k);
          ctx.fillStyle = 'rgba(255,255,255,.05)';
          M.roundRect(ctx, D.x, D.y, D.w, D.h, 16); ctx.fill();
          // 大精灵
          const spr = KB.art.knightSprite(k.defId, k.rarity, 170);
          ctx.drawImage(spr, D.x + 20, D.y + 16, 170, 170);
          ctx.textAlign = 'left';
          ctx.font = ui.font(22, 'bold');
          ctx.fillStyle = CFG.RARITY_COLOR[k.rarity];
          ctx.fillText(def.name + '（' + CFG.RARITY_NAME[k.rarity] + '卡）' + (k.greatBonus ? ' ✨大成功' : ''), D.x + 205, D.y + 36);
          ctx.font = ui.font(14);
          ctx.fillStyle = 'rgba(255,255,255,.8)';
          ctx.fillText('等级 Lv.' + k.level + ' / ' + CFG.LEVEL_MAX + '　元素 ' + (def.elem === 'none' ? '无' : def.elem), D.x + 205, D.y + 66);
          ctx.fillText('类型 ' + (def.melee ? '近战' : '远程') + '　局内费用 ' + def.cost + ' 勇气币', D.x + 205, D.y + 90);
          // 属性
          const stats = [
            ['❤️ 生命', st.hp], ['⚔️ 攻击', st.atk], ['🛡️ 防御', st.defv],
            ['⏱️ 攻速', st.atkInterval.toFixed(2) + 's'], ['🎯 射程', def.rangeCells + '格'],
          ];
          stats.forEach((it, i) => {
            const sx = D.x + 205 + (i % 2) * 170, sy = D.y + 120 + Math.floor(i / 2) * 30;
            ctx.font = ui.font(14);
            ctx.fillStyle = 'rgba(255,255,255,.75)';
            ctx.fillText(it[0] + '  ' + it[1], sx, sy);
          });
          // 技能
          const skills = k.skills || [def.skill];
          skills.forEach((name, i) => {
            const sy = D.y + 200 + i * 44;
            const rec = KB.SKILLS[name];
            const awk = KB.AWAKENS.find(a => a.name === name);
            ctx.font = ui.font(14, 'bold');
            ctx.fillStyle = awk ? '#b388ff' : '#ffd54f';
            ctx.fillText((awk ? '✨觉醒·' : '🎯') + name + (awk ? '：' + awk.d : ''), D.x + 24, sy);
            if (rec) {
              ctx.font = ui.font(12);
              ctx.fillStyle = 'rgba(255,255,255,.6)';
              ctx.fillText(rec.d, D.x + 24, sy + 20);
            }
          });
          // 升级按钮
          const cost = KB.StatCalc.upCost(k);
          const can = k.level < CFG.LEVEL_MAX && KB.Player.coins() >= cost;
          const bw2 = 190, bh2 = 46;
          self._upBtn = { x: D.x + D.w - bw2 - 20, y: D.y + D.h - bh2 - 16, w: bw2, h: bh2 };
          ctx.fillStyle = k.level >= CFG.LEVEL_MAX ? '#455a64' : can ? '#2e7d32' : '#546e7a';
          M.roundRect(ctx, self._upBtn.x, self._upBtn.y, bw2, bh2, 12); ctx.fill();
          ctx.font = ui.font(15, 'bold');
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
          ctx.fillText(k.level >= CFG.LEVEL_MAX ? '已满级' : '升级（' + cost + '币）', self._upBtn.x + bw2 / 2, self._upBtn.y + bh2 / 2);
        }
      },
      onTouch(type, x, y) {
        const A = self._listArea;
        // 滚动
        if (type === 'down' && x >= A.x && x <= A.x + A.w && y >= A.y && y <= A.y + A.h) {
          self._drag = { y0: y, sy: self._scroll.y, moved: false };
          return true;
        }
        if (type === 'move' && self._drag) {
          const dy = y - self._drag.y0;
          if (Math.abs(dy) > 8) self._drag.moved = true;
          self._scroll.y = M.clamp(self._drag.sy - dy, 0, self._scroll.max);
          return true;
        }
        if (type === 'up') {
          const inR = (r) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
          if (inR(self._backRect)) { SM.pop(); return true; }
          if (inR(self._upBtn)) {
            const r = KB.Player.upgradeKnight(selUid);
            if (r.ok) ui.toast('升级成功 → Lv.' + r.level);
            else ui.toast(r.err);
            return true;
          }
          if (self._drag && !self._drag.moved) {
            for (const row of self._rows) {
              if (row.rowY !== undefined && x >= A.x && x <= A.x + A.w && y >= row.rowY && y <= row.rowY + row.h) {
                selUid = row.k.uid;
                break;
              }
            }
          }
          self._drag = null;
          return true;
        }
        return true;
      },
    };
  };

  /* ================= 融合祭坛 ================= */
  Boot.FusionScene = function () {
    const self = this;
    let sel = [];   // [uid, uid]
    let _prevKey = '', _preview = null;  // 预览缓存（防止随机结果每帧闪烁）

    function build() {
      const w = W(), h = H(), s = SAFE();
      self._grid = { x: s.l + 10, y: s.t + 150, w: w - s.l - s.r - 20, h: h - s.b - s.t - 260 };
      self._fuseBtn = { x: w / 2 - 100, y: h - s.b - 92, w: 200, h: 52 };
    }
    build();

    function fusePair() {
      if (sel.length !== 2) return null;
      const a = KB.Player.byUid(sel[0]), b = KB.Player.byUid(sel[1]);
      if (!a || !b || a.rarity !== b.rarity || a.rarity >= 2) return null;
      return [a, b];
    }

    // 选中对不变时复用同一份预览结果
    function previewOf(pair) {
      const key = pair[0].uid + ':' + pair[1].uid;
      if (key !== _prevKey) { _prevKey = key; _preview = KB.Fusion.fuse(pair[0], pair[1]); }
      return _preview;
    }

    return {
      _self: self,
      buildUI: build,
      update() {},
      draw(ctx) {
        drawSkyBg(ctx, '#2a1d4e', '#0d1022');
        const w = W(), h = H(), s = SAFE();
        ctx.fillStyle = 'rgba(10,14,30,.85)';
        ctx.fillRect(0, s.t, w, 52);
        self._backRect = { x: s.l + 8, y: s.t + 6, w: 76, h: 40 };
        drawBackBtn(ctx, s.l + 8, s.t + 6);
        ctx.font = ui.font(19, 'bold');
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🔮 融合祭坛　白+白→紫(100币)　紫+紫→金(1000币)', w / 2, s.t + 26);
        // 说明
        ctx.font = ui.font(12);
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.fillText('选择两张相同品质的骑士卡进行融合，技能继承父母各一 + 随机觉醒技', w / 2, s.t + 76);
        ctx.font = ui.font(13, 'bold');
        ctx.fillStyle = '#b388ff';
        const eff = KB.BaseCfg.effects(KB.Player.baseLevel());
        ctx.fillText('当前基地加成：融合费用 -' + Math.round(eff.fusionDiscount * 100) + '%　大成功(属性+10%)概率 ' + Math.round(eff.greatChance * 100) + '%', w / 2, s.t + 100);

        // 选择预览
        const pair = fusePair();
        const prevY = s.t + 118;
        if (pair) {
          const cost = Math.round(KB.Fusion.cost(pair[0].rarity) * (1 - eff.fusionDiscount));
          const preview = previewOf(pair);
          [pair[0], pair[1]].forEach((k, i) => {
            const face = KB.art.cardFace(k.defId, k.rarity, 64, 88);
            ctx.drawImage(face, w / 2 - 180 + i * 90, prevY, 64, 88);
          });
          ctx.font = ui.font(28, 'bold');
          ctx.fillStyle = '#b388ff';
          ctx.fillText('+', w / 2 - 80, prevY + 44);
          ctx.font = ui.font(24, 'bold');
          ctx.fillText('→', w / 2 + 10, prevY + 44);
          if (preview) {
            const face = KB.art.cardFace(preview.defId, preview.rarity, 64, 88);
            ctx.drawImage(face, w / 2 + 60, prevY, 64, 88);
            ctx.font = ui.font(12);
            ctx.fillStyle = 'rgba(255,255,255,.75)';
            const pdef = KB.knightById(preview.defId);
            ctx.fillText(pdef.name + '·' + CFG.RARITY_NAME[preview.rarity] + ' ' + preview.skills.join('/'), w / 2 + 100, prevY + 30);
            ctx.fillStyle = '#ffd54f';
            ctx.font = ui.font(13, 'bold');
            ctx.fillText('费用 ' + cost + ' 骑士币', w / 2 + 100, prevY + 56);
          }
        } else {
          ctx.font = ui.font(14);
          ctx.fillStyle = 'rgba(255,255,255,.55)';
          ctx.fillText(sel.length === 2 ? '两张卡品质不同，无法融合' : '从下方选择 2 张同品质骑士卡' + (sel.length === 1 ? '（已选1张）' : ''), w / 2, prevY + 40);
        }

        // 卡池网格
        const G = self._grid;
        const ks = KB.Player.knights().slice().sort((a, b) => b.rarity - a.rarity || a.level - b.level);
        const cols = Math.min(10, Math.max(4, Math.floor(G.w / 86)));
        const cw = Math.min(82, G.w / cols - 8), ch = Math.min(110, cw * 1.34);
        self._cells = [];
        ctx.save();
        ctx.beginPath(); ctx.rect(G.x, G.y, G.w, G.h); ctx.clip();
        // 简单分页滚动
        const perPage = cols * Math.floor(G.h / (ch + 10));
        const pages = Math.max(1, Math.ceil(ks.length / perPage));
        if (self._page === undefined) self._page = 0;
        self._page = M.clamp(self._page, 0, pages - 1);
        const start = self._page * perPage;
        ks.slice(start, start + perPage).forEach((k, i) => {
          const r = Math.floor(i / cols), c = i % cols;
          const x = G.x + (G.w - cols * (cw + 8) + 8) / 2 + c * (cw + 8);
          const y = G.y + 10 + r * (ch + 10);
          const isSel = sel.includes(k.uid);
          const face = KB.art.cardFace(k.defId, k.rarity, Math.round(cw), Math.round(ch));
          ctx.save();
          if (sel.length && !isSel && (sel.length === 2 || KB.Player.byUid(sel[0]).rarity !== k.rarity)) ctx.globalAlpha = 0.35;
          ctx.drawImage(face, x, y, cw, ch);
          if (isSel) {
            ctx.strokeStyle = '#b388ff'; ctx.lineWidth = 3;
            M.roundRect(ctx, x + 1, y + 1, cw - 2, ch - 2, 10); ctx.stroke();
          }
          if (k.level > 1) {
            ctx.font = ui.font(9, 'bold'); ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
            ctx.fillText('Lv' + k.level, x + 4, y + 11);
          }
          if (k.rarity >= 2) {
            ctx.font = ui.font(9); ctx.fillStyle = '#ffd54f'; ctx.textAlign = 'right';
            ctx.fillText('MAX', x + cw - 4, y + 11);
          }
          ctx.restore();
          self._cells.push({ x, y, w: cw, h: ch, k });
        });
        ctx.restore();
        // 分页按钮
        if (pages > 1) {
          ctx.font = ui.font(18, 'bold');
          ctx.fillStyle = 'rgba(255,255,255,.6)';
          ctx.textAlign = 'center';
          ctx.fillText('‹', G.x + 16, G.y + G.h / 2);
          ctx.fillText('›', G.x + G.w - 16, G.y + G.h / 2);
          ctx.font = ui.font(11);
          ctx.fillText((self._page + 1) + '/' + pages, G.x + G.w / 2, G.y + G.h + 2);
          self._pgRects = [
            { x: G.x, y: G.y, w: 40, h: G.h, d: -1 },
            { x: G.x + G.w - 40, y: G.y, w: 40, h: G.h, d: 1 },
          ];
        } else self._pgRects = [];

        // 融合按钮
        const can = pair && KB.Player.coins() >= Math.round(KB.Fusion.cost(pair[0].rarity) * (1 - eff.fusionDiscount));
        ctx.fillStyle = can ? '#6a1b9a' : '#455a64';
        M.roundRect(ctx, self._fuseBtn.x, self._fuseBtn.y, self._fuseBtn.w, self._fuseBtn.h, 14); ctx.fill();
        ctx.font = ui.font(17, 'bold');
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.fillText('✨ 开始融合', w / 2, self._fuseBtn.y + 26);
      },
      onTouch(type, x, y) {
        if (type !== 'up') return true;
        const inR = (r) => r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
        if (inR(self._backRect)) { SM.pop(); return true; }
        for (const p of self._pgRects || []) if (inR(p)) { self._page += p.d; return true; }
        if (inR(self._fuseBtn)) {
          const r = KB.Player.fuse(sel[0], sel[1]);
          if (r.ok) {
            const def = KB.knightById(r.knight.defId);
            ui.toast('融合成功！' + def.name + ' ' + CFG.RARITY_NAME[r.knight.rarity] + '卡' + (r.knight.greatBonus ? ' ✨大成功！' : '') + '（-' + r.cost + '币）');
            sel = [];
          } else ui.toast(r.err);
          return true;
        }
        for (const c of self._cells) {
          if (inR(c)) {
            if (c.k.rarity >= 2) { ui.toast('金卡已是最终形态'); return true; }
            const i = sel.indexOf(c.k.uid);
            if (i >= 0) sel.splice(i, 1);
            else {
              if (sel.length === 2) { ui.toast('最多选2张'); return true; }
              if (sel.length === 1 && KB.Player.byUid(sel[0]).rarity !== c.k.rarity) { ui.toast('需选择相同品质'); return true; }
              sel.push(c.k.uid);
            }
            return true;
          }
        }
        return true;
      },
    };
  };

  /* ================= 商店 ================= */
  Boot.ShopScene = function () {
    const self = this;
    let lastPulls = [];

    function build() {
      const w = W(), h = H(), s = SAFE();
      self._btns = {
        one: { x: w / 2 - 250, y: s.t + 210, w: 220, h: 54, label: '招募 ×1' },
        ten: { x: w / 2 + 30, y: s.t + 210, w: 220, h: 54, label: '招募 ×10（9折）' },
      };
      self._pullArea = { x: s.l + 20, y: s.t + 290, w: w - s.l - s.r - 40, h: h - s.b - s.t - 310 };
    }
    build();

    return {
      _self: self,
      buildUI: build,
      update() {},
      draw(ctx) {
        drawSkyBg(ctx, '#4e342e', '#0d1022');
        const w = W(), h = H(), s = SAFE();
        ctx.fillStyle = 'rgba(10,14,30,.85)';
        ctx.fillRect(0, s.t, w, 52);
        self._backRect = { x: s.l + 8, y: s.t + 6, w: 76, h: 40 };
        drawBackBtn(ctx, s.l + 8, s.t + 6);
        ctx.font = ui.font(19, 'bold');
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🏪 商店', w / 2, s.t + 26);

        // 招募面板
        ctx.fillStyle = 'rgba(255,255,255,.06)';
        M.roundRect(ctx, s.l + 20, s.t + 64, w - s.l - s.r - 40, 210, 16); ctx.fill();
        ctx.font = ui.font(17, 'bold');
        ctx.fillStyle = '#ffd54f';
        ctx.fillText('⚔️ 骑士招募', w / 2, s.t + 92);
        ctx.font = ui.font(13);
        ctx.fillStyle = 'rgba(255,255,255,.7)';
        ctx.fillText('白卡90% / 紫卡9% / 金卡1%　十连保底紫 · 三十连保底金', w / 2, s.t + 116);
        // 保底进度
        const shop = KB.Player.state.shop;
        ctx.textAlign = 'left';
        ctx.fillText('距保底紫：', w / 2 - 220, s.t + 150);
        drawBar(ctx, w / 2 - 140, s.t + 144, 180, 10, shop.sincePurple / CFG.GACHA_PITY_PURPLE, '#b06cf5');
        ctx.fillText('距保底金：', w / 2 - 220, s.t + 172);
        drawBar(ctx, w / 2 - 140, s.t + 166, 180, 10, shop.sinceGold / CFG.GACHA_PITY_GOLD, '#ffc93c');
        ctx.textAlign = 'right';
        ctx.fillText(shop.sincePurple + '/' + CFG.GACHA_PITY_PURPLE, w / 2 + 60, s.t + 150);
        ctx.fillText(shop.sinceGold + '/' + CFG.GACHA_PITY_GOLD, w / 2 + 60, s.t + 172);
        ctx.font = ui.font(12);
        ctx.fillStyle = 'rgba(255,255,255,.45)';
        ctx.textAlign = 'center';
        ctx.fillText('已招募 ' + shop.totalPulls + ' 次', w / 2 + 170, s.t + 160);

        // 按钮
        for (const id in self._btns) {
          const b = self._btns[id];
          const cost = id === 'one' ? CFG.GACHA_SINGLE : CFG.GACHA_TEN;
          const can = KB.Player.coins() >= cost;
          ctx.fillStyle = can ? '#ef6c00' : '#455a64';
          M.roundRect(ctx, b.x, b.y, b.w, b.h, 13); ctx.fill();
          ctx.font = ui.font(17, 'bold');
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
          ctx.fillText(b.label, b.x + b.w / 2, b.y + 20);
          ctx.font = ui.font(13);
          ctx.fillText('🪙 ' + cost + ' 骑士币', b.x + b.w / 2, b.y + 40);
        }

        // 结果展示
        if (lastPulls.length) {
          const A = self._pullArea;
          const cols = Math.min(10, lastPulls.length);
          const cw = Math.min(82, A.w / Math.max(1, cols) - 8), ch = cw * 1.3;
          lastPulls.forEach((k, i) => {
            const c = i % cols, r = Math.floor(i / cols);
            const x = A.x + (A.w - cols * (cw + 8) + 8) / 2 + c * (cw + 8);
            const y = A.y + r * (ch + 8);
            const face = KB.art.cardFace(k.defId, k.rarity, Math.round(cw), Math.round(ch));
            ctx.drawImage(face, x, y, cw, ch);
          });
        } else {
          ctx.font = ui.font(14);
          ctx.fillStyle = 'rgba(255,255,255,.45)';
          ctx.textAlign = 'center';
          ctx.fillText('※ 宝箱 / 星尘商店 / 荣耀商店 · 敬请期待（测试版未开放）', w / 2, h - s.b - 60);
        }
      },
      onTouch(type, x, y) {
        if (type !== 'up') return true;
        const inR = (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
        if (inR(self._backRect)) { SM.pop(); return true; }
        const pull = (n) => {
          const cost = n === 1 ? CFG.GACHA_SINGLE : CFG.GACHA_TEN;
          if (!KB.Player.trySpend(cost)) { ui.toast('骑士币不足'); return; }
          lastPulls = [];
          for (let i = 0; i < n; i++) lastPulls.push(KB.Player.gachaPull());
          const gold = lastPulls.filter(k => k.rarity === 2).length;
          const purple = lastPulls.filter(k => k.rarity === 1).length;
          ui.toast('招募完成！金×' + gold + ' 紫×' + purple + ' 白×' + (n - gold - purple));
        };
        if (inR(self._btns.one)) pull(1);
        else if (inR(self._btns.ten)) pull(10);
        return true;
      },
    };
  };

  function drawBar(ctx, x, y, w, h, pct, color) {
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    M.roundRect(ctx, x, y, w, h, h / 2); ctx.fill();
    if (pct > 0) {
      ctx.fillStyle = color;
      M.roundRect(ctx, x, y, Math.max(h, w * M.clamp(pct, 0, 1)), h, h / 2); ctx.fill();
    }
  }

  /* ================= 基地升级 ================= */
  Boot.BaseUpScene = function () {
    const self = this;

    function build() {
      const w = W(), h = H(), s = SAFE();
      self._upBtn = { x: w / 2 - 100, y: h - s.b - 80, w: 200, h: 50 };
    }
    build();

    return {
      _self: self,
      buildUI: build,
      update() {},
      draw(ctx) {
        drawSkyBg(ctx, '#123a44', '#0d1022');
        const w = W(), h = H(), s = SAFE();
        ctx.fillStyle = 'rgba(10,14,30,.85)';
        ctx.fillRect(0, s.t, w, 52);
        self._backRect = { x: s.l + 8, y: s.t + 6, w: 76, h: 40 };
        drawBackBtn(ctx, s.l + 8, s.t + 6);
        ctx.font = ui.font(19, 'bold');
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🏰 基地升级', w / 2, s.t + 26);

        const lvl = KB.Player.baseLevel();
        const eff = KB.BaseCfg.effects(lvl);
        // 等级
        ctx.font = ui.font(56, 'bold');
        ctx.fillStyle = '#4dd0e1';
        ctx.fillText('Lv.' + lvl, w / 2, s.t + 120);
        ctx.font = ui.font(13);
        ctx.fillStyle = 'rgba(255,255,255,.5)';
        ctx.fillText('最高 20 级', w / 2, s.t + 165);

        // 20级轨道
        const trackY = s.t + 205, tw = Math.min(680, w - 80);
        const tx = (w - tw) / 2;
        ctx.fillStyle = 'rgba(255,255,255,.12)';
        M.roundRect(ctx, tx, trackY, tw, 14, 7); ctx.fill();
        ctx.fillStyle = '#4dd0e1';
        M.roundRect(ctx, tx, trackY, Math.max(14, tw * lvl / 20), 14, 7); ctx.fill();
        for (let i = 1; i <= 20; i++) {
          const px = tx + tw * i / 20;
          ctx.beginPath(); ctx.arc(px, trackY + 7, i % 5 === 0 ? 7 : 4, 0, Math.PI * 2);
          ctx.fillStyle = i <= lvl ? '#fff' : 'rgba(255,255,255,.3)';
          ctx.fill();
          if (i % 5 === 0) {
            ctx.font = ui.font(11);
            ctx.fillStyle = 'rgba(255,255,255,.5)';
            ctx.fillText(String(i), px, trackY + 30);
          }
        }

        // 当前效果
        ctx.textAlign = 'left';
        ctx.font = ui.font(15, 'bold');
        ctx.fillStyle = '#80deea';
        ctx.fillText('当前加成', tx, trackY + 66);
        const rows = [
          '全体骑士属性 +' + Math.round((eff.statMult - 1) * 100) + '%',
          '开局勇气 +' + Math.round(eff.energyStart - CFG.ENERGY_START) + '　回复 +' + (eff.energyRegen - CFG.ENERGY_REGEN).toFixed(2) + '/秒',
          '骑士升级费用 -' + Math.round(eff.upDiscount * 100) + '%（上限30%）',
          '融合费用 -' + Math.round(eff.fusionDiscount * 100) + '%　大成功率 ' + Math.round(eff.greatChance * 100) + '%',
        ];
        rows.forEach((t, i) => {
          ctx.font = ui.font(14);
          ctx.fillStyle = 'rgba(255,255,255,.8)';
          ctx.fillText('· ' + t, tx + 8, trackY + 92 + i * 26);
        });
        ctx.font = ui.font(12);
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.fillText('※ 训练场经验 / 圣泉恢复 将在后续版本生效', tx + 8, trackY + 92 + rows.length * 26 + 8);

        // 升级按钮
        const cost = KB.Player.baseUpCost();
        const maxed = lvl >= 20;
        const can = !maxed && KB.Player.coins() >= cost;
        ctx.fillStyle = maxed ? '#455a64' : can ? '#00838f' : '#546e7a';
        M.roundRect(ctx, self._upBtn.x, self._upBtn.y, self._upBtn.w, self._upBtn.h, 13); ctx.fill();
        ctx.font = ui.font(16, 'bold');
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.fillText(maxed ? '已达最高等级' : '升级（' + cost + ' 骑士币）', w / 2, self._upBtn.y + 25);
      },
      onTouch(type, x, y) {
        if (type !== 'up') return true;
        const inR = (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
        if (inR(self._backRect)) { SM.pop(); return true; }
        if (inR(self._upBtn)) {
          const r = KB.Player.tryBaseUp();
          if (r.ok) { ui.toast('基地升级成功 → Lv.' + r.level + '！'); KB.art.clearCaches(); }
          else ui.toast(r.err);
          return true;
        }
        return true;
      },
    };
  };

  /* ================= 新手引导 ================= */
  Boot.GuideScene = function () {
    const self = this;
    let step = 0;
    const starters = [
      { id: 'm01', name: '见习骑士' }, { id: 'm07', name: '拳师' }, { id: 'm04', name: '盾兵' },
      { id: 'm05', name: '枪兵' }, { id: 'r01', name: '弓箭手' }, { id: 'r05', name: '法师学徒' },
    ];

    function build() {
      const w = W(), h = H(), s = SAFE();
      const cols = 3, cw = Math.min(150, w / cols - 30), ch = cw * 1.2;
      self._cards = [];
      starters.forEach((st, i) => {
        const r = Math.floor(i / cols), c = i % cols;
        const x = w / 2 - (cols * (cw + 14) - 14) / 2 + c * (cw + 14);
        const y = h / 2 - 30 + r * (ch + 14);
        self._cards.push({ x, y, w: cw, h: ch, st });
      });
      self._next = { x: w / 2 - 90, y: h - SAFE().b - 90, w: 180, h: 46 };
    }
    build();

    return {
      _self: self,
      opaque: false,
      buildUI: build,
      update() {},
      draw(ctx) {
        const w = W(), h = H();
        ctx.fillStyle = 'rgba(0,0,0,.72)';
        ctx.fillRect(0, 0, w, h);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (step === 0) {
          ctx.font = ui.font(26, 'bold');
          ctx.fillStyle = '#ffd54f';
          ctx.fillText('👑 欢迎来到骑士基地！', w / 2, h / 2 - 150);
          ctx.font = ui.font(16);
          ctx.fillStyle = 'rgba(255,255,255,.85)';
          KB.ui.wrapText(ctx, '防御塔防玩法：把骑士拖到格子里阻挡敌人，保护左侧基地核心。相同骑士可以拖拽合并变强！', w / 2, h / 2 - 70, w * 0.7, 26);
          ctx.fillStyle = '#69f0ae';
          ctx.font = ui.font(15, 'bold');
          ctx.fillText('点按任意处继续', w / 2, h / 2 + 90);
        } else if (step === 1) {
          ctx.font = ui.font(22, 'bold');
          ctx.fillStyle = '#ffd54f';
          ctx.fillText('选择你的初始骑士（免费赠送 + 300 骑士币）', w / 2, h / 2 - 170);
          for (const c of self._cards) {
            const face = KB.art.cardFace(c.st.id, 0, Math.round(c.w), Math.round(c.h));
            ctx.drawImage(face, c.x, c.y, c.w, c.h);
          }
        } else if (step === 2) {
          ctx.font = ui.font(24, 'bold');
          ctx.fillStyle = '#69f0ae';
          ctx.fillText('✅ 已赠送！', w / 2, h / 2 - 80);
          ctx.font = ui.font(16);
          ctx.fillStyle = '#fff';
          ctx.fillText('接下来：点击「世界征途」开始第一关', w / 2, h / 2 - 20);
          ctx.font = ui.font(14);
          ctx.fillStyle = 'rgba(255,255,255,.6)';
          ctx.fillText('（点按任意处关闭引导）', w / 2, h / 2 + 30);
        }
      },
      onTouch(type, x, y) {
        if (type !== 'up') return true;
        const inR = (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
        if (step === 0) { step = 1; return true; }
        if (step === 1) {
          for (const c of self._cards) {
            if (inR(c)) {
              KB.Player.grant(c.st.id, 0);
              KB.Player.setLoadout(KB.Player.knights().map(k => k.uid).slice(-1));
              KB.Player.addCoins(CFG.STARTER_COINS);
              KB.Player.state.guide.starter = c.st.id;
              step = 2;
              return true;
            }
          }
          return true;
        }
        if (step === 2) {
          KB.Player.state.guide.done = true;
          KB.Player.markDirty();
          SM.pop();
          return true;
        }
        return true;
      },
    };
  };

  /* ================= 调试面板 ================= */
  Boot.DevPanelScene = function () {
    const self = this;
    function build() {
      const w = W(), h = H(), s = SAFE();
      const items = [
        ['+1万骑士币', () => { KB.Player.addCoins(10000); ui.toast('+10000币'); }],
        ['+10万骑士币', () => { KB.Player.addCoins(100000); ui.toast('+100000币'); }],
        ['解锁全部世界', () => {
          for (let i = 0; i < KB.WORLDS.length; i++) {
            if (!KB.Player.state.progress[i]) KB.Player.state.progress[i] = { cleared: false, stars: {} };
          }
          KB.Player.state.unlockedWorld = KB.WORLDS.length - 1;
          KB.Player.markDirty(); ui.toast('全部世界已解锁');
        }],
        ['基地+1级', () => { KB.Player.state.base.level = Math.min(20, KB.Player.state.base.level + 1); KB.art.clearCaches(); ui.toast('基地 Lv.' + KB.Player.state.base.level); }],
        ['骑士全部满级', () => {
          for (const k of KB.Player.knights()) k.level = CFG.LEVEL_MAX;
          KB.Player.markDirty(); ui.toast('全部骑士已满级');
        }],
        ['赠送各品质卡', () => {
          KB.Player.grant('m01', 0); KB.Player.grant('m01', 0);
          KB.Player.grant('m09', 1); KB.Player.grant('m09', 1);
          KB.Player.grant('m11', 2);
          ui.toast('已赠送测试卡');
        }],
        ['重置存档', () => {
          SM.push(ui.ConfirmScene({
            msg: '确定要删除全部进度吗？此操作不可恢复！',
            onYes: () => { KB.Save.wipe(); location.reload(); },
          }));
        }],
      ];
      self._items = items;
      const bw = 220, bh = 48, cols = 2;
      self._btns = items.map((it, i) => ({
        x: w / 2 - (cols * (bw + 14) - 14) / 2 + (i % cols) * (bw + 14),
        y: h / 2 - (Math.ceil(items.length / 2) * (bh + 12)) / 2 + Math.floor(i / cols) * (bh + 12),
        w: bw, h: bh, label: it[0], fn: it[1],
      }));
      self._close = { x: w / 2 - 60, y: h / 2 + Math.ceil(items.length / 2) * (bh + 12) / 2 + 10, w: 120, h: 44 };
    }
    build();
    return {
      _self: self,
      opaque: false,
      buildUI: build,
      update() {},
      draw(ctx) {
        const w = W(), h = H();
        ctx.fillStyle = 'rgba(0,0,0,.7)';
        ctx.fillRect(0, 0, w, h);
        const pw = 520, ph = 420, px = (w - pw) / 2, py = (h - ph) / 2;
        ctx.fillStyle = 'rgba(16,22,44,.97)';
        M.roundRect(ctx, px, py, pw, ph, 18); ctx.fill();
        ctx.font = ui.font(18, 'bold');
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('🛠 调试面板', w / 2, py + 30);
        for (const b of self._btns) {
          ctx.fillStyle = '#37474f';
          M.roundRect(ctx, b.x, b.y, b.w, b.h, 10); ctx.fill();
          ctx.font = ui.font(14, 'bold');
          ctx.fillStyle = '#fff';
          ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
        }
        ctx.fillStyle = '#c62828';
        M.roundRect(ctx, self._close.x, self._close.y, self._close.w, self._close.h, 10); ctx.fill();
        ctx.font = ui.font(15, 'bold');
        ctx.fillStyle = '#fff';
        ctx.fillText('关闭', self._close.x + self._close.w / 2, self._close.y + self._close.h / 2);
      },
      onTouch(type, x, y) {
        if (type !== 'up') return true;
        const inR = (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
        if (inR(self._close)) { SM.pop(); return true; }
        for (const b of self._btns) if (inR(b)) { b.fn(); return true; }
        return true;
      },
    };
  };
})();
