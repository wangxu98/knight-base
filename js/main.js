/* ============================================================
 * 骑士基地：世界起源 - main.js
 * 固定逻辑舞台 1280×800 + 等比缩放 letterbox / DPR / 安全区 /
 * 输入坐标反变换 / 主循环 / 存档落盘 / 竖屏提示
 * ============================================================ */
'use strict';
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  /* ---------- 逻辑舞台：所有场景都在此坐标系内绘制 ---------- */
  const STAGE_W = 1280, STAGE_H = 800;

  const Main = KB.Main = {
    canvas, ctx,
    viewW: STAGE_W, viewH: STAGE_H,   // 场景永远看到固定逻辑尺寸
    stage: { x: 0, y: 0, w: STAGE_W, h: STAGE_H, scale: 1 },
    dpr: 1,
    time: 0,
    safe: { t: 6, r: 10, b: 10, l: 10 },  // 舞台内呼吸边距（外层已避让系统安全区）
    portrait: false,
  };

  /* ---------- 安全区探测 ---------- */
  function probeSafeArea() {
    try {
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;top:env(safe-area-inset-top);right:env(safe-area-inset-right);bottom:env(safe-area-inset-bottom);left:env(safe-area-inset-left);visibility:hidden;pointer-events:none;';
      document.body.appendChild(div);
      const cs = getComputedStyle(div);
      const inset = {
        t: parseFloat(cs.top) || 0,
        r: parseFloat(cs.right) || 0,
        b: parseFloat(cs.bottom) || 0,
        l: parseFloat(cs.left) || 0,
      };
      document.body.removeChild(div);
      return inset;
    } catch (e) { return { t: 0, r: 0, b: 0, l: 0 }; }
  }

  /* ---------- 尺寸/DPR：把舞台等比放进「安全区内的可用矩形」并居中 ---------- */
  function resize() {
    const winSafe = probeSafeArea();
    const vw = Math.max(1, window.innerWidth), vh = Math.max(1, window.innerHeight);
    Main.dpr = Math.min(2, window.devicePixelRatio || 1);

    const availW = Math.max(64, vw - winSafe.l - winSafe.r);
    const availH = Math.max(64, vh - winSafe.t - winSafe.b);
    const scale = Math.min(availW / STAGE_W, availH / STAGE_H);
    const st = Main.stage;
    st.scale = scale;
    st.w = STAGE_W * scale; st.h = STAGE_H * scale;
    st.x = winSafe.l + (availW - st.w) / 2;
    st.y = winSafe.t + (availH - st.h) / 2;

    Main.portrait = vh > vw * 1.05;
    canvas.width = Math.round(vw * Main.dpr);
    canvas.height = Math.round(vh * Main.dpr);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    KB.SceneManager.onResize();
  }

  /* ---------- 舞台外的剧场背景（屏幕坐标系） ---------- */
  function drawBackdrop() {
    const vw = Main.canvas.width / Main.dpr, vh = Main.canvas.height / Main.dpr;
    const g = ctx.createLinearGradient(0, 0, 0, vh);
    g.addColorStop(0, '#04060f');
    g.addColorStop(.55, '#070c1d');
    g.addColorStop(1, '#030510');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, vw, vh);
    // 中央微光
    const r = ctx.createRadialGradient(vw / 2, vh / 2, 0, vw / 2, vh / 2, Math.max(vw, vh) * .62);
    r.addColorStop(0, 'rgba(92,124,255,.075)');
    r.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, vw, vh);
  }

  /* ---------- 舞台装饰边框（屏幕坐标系，绘制在场景之后） ---------- */
  function drawStageFrame() {
    const st = Main.stage;
    const x = st.x, y = st.y, w = st.w, h = st.h;
    const r = Math.max(6, 22 * st.scale);
    // 外圈光晕描边
    ctx.strokeStyle = 'rgba(120,148,255,.10)'; ctx.lineWidth = 7;
    M.roundRect(ctx, x - 3.5, y - 3.5, w + 7, h + 7, r + 3); ctx.stroke();
    // 主边框
    ctx.strokeStyle = 'rgba(158,178,255,.34)'; ctx.lineWidth = 1.5;
    M.roundRect(ctx, x - .75, y - .75, w + 1.5, h + 1.5, r); ctx.stroke();
    // 内侧暗线（立体感）
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2;
    M.roundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, Math.max(4, r - 2)); ctx.stroke();
    // 四角金色饰角
    const L = Math.max(14, 30 * st.scale);
    ctx.strokeStyle = 'rgba(255,213,79,.85)'; ctx.lineWidth = Math.max(2, 2.5 * st.scale);
    ctx.lineCap = 'round';
    const corners = [
      [x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1],
    ];
    for (const [cx, cy, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx + sx * r * .4, cy + sy * (r * .4 + L));
      ctx.lineTo(cx + sx * r * .4, cy + sy * r * .4);
      ctx.lineTo(cx + sx * (r * .4 + L), cy + sy * r * .4);
      ctx.stroke();
    }
  }

  const M = KB.math;

  /* ---------- 主循环 ---------- */
  let lastTs = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (dt > 0.1) dt = 0.1;   // 后台回来防跳变
    Main.time += dt;

    const st = Main.stage;
    // 1) 屏幕坐标系：剧场背景
    ctx.setTransform(Main.dpr, 0, 0, Main.dpr, 0, 0);
    ctx.clearRect(0, 0, Main.canvas.width / Main.dpr, Main.canvas.height / Main.dpr);
    drawBackdrop();

    if (Main.portrait) {
      drawRotateHint();
      KB.ui.updateToasts(dt);
      KB.ui.drawToasts(ctx, Main.viewW, Main.viewH);
      saveFlush(dt);
      return;
    }

    // 2) 舞台坐标系：圆角裁剪后渲染场景
    ctx.setTransform(Main.dpr * st.scale, 0, 0, Main.dpr * st.scale, Main.dpr * st.x, Main.dpr * st.y);
    ctx.save();
    ctx.beginPath();
    M.roundRect(ctx, 0, 0, STAGE_W, STAGE_H, 22);
    ctx.clip();
    KB.SceneManager.update(dt);
    KB.SceneManager.draw(ctx);
    KB.ui.updateToasts(dt);
    KB.ui.drawToasts(ctx, Main.viewW, Main.viewH);
    ctx.restore();

    // 3) 屏幕坐标系：装饰边框
    ctx.setTransform(Main.dpr, 0, 0, Main.dpr, 0, 0);
    drawStageFrame();

    // 存档防抖落盘
    saveFlush(dt);
  }

  let saveTimer = 0;
  function saveFlush(dt) {
    saveTimer += dt;
    if (saveTimer >= 2) {
      saveTimer = 0;
      if (KB.Player && KB.Player.state && KB.Player.isDirty()) {
        KB.Save.flush(KB.Player.state);
        KB.Player.saved();
      }
    }
  }

  function drawRotateHint() {
    const vw = Main.canvas.width / Main.dpr, vh = Main.canvas.height / Main.dpr;
    ctx.fillStyle = '#0d1022';
    ctx.fillRect(0, 0, vw, vh);
    ctx.save();
    ctx.translate(vw / 2, vh / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = KB.ui.font(22, 'bold');
    ctx.fillStyle = '#fff';
    ctx.fillText('📱 请横屏使用', 0, -20);
    ctx.font = KB.ui.font(14);
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.fillText('骑士基地：世界起源 为横屏游戏', 0, 20);
    ctx.restore();
  }

  /* ---------- 输入：屏幕坐标 → 舞台逻辑坐标 ---------- */
  function toStage(cx, cy) {
    const st = Main.stage;
    return { x: (cx - st.x) / st.scale, y: (cy - st.y) / st.scale };
  }
  function handleTouch(type, clientX, clientY) {
    const p = toStage(clientX, clientY);
    KB.SceneManager.onTouch(type, p.x, p.y);
  }
  // 双指缩放拦截
  document.addEventListener('gesturestart', e => e.preventDefault());
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) handleTouch('down', t.clientX, t.clientY);
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) handleTouch('move', t.clientX, t.clientY);
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) handleTouch('up', t.clientX, t.clientY);
  }, { passive: false });
  canvas.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) handleTouch('cancel', t.clientX, t.clientY);
  }, { passive: false });
  // 桌面：鼠标映射
  let mouseDown = false;
  canvas.addEventListener('mousedown', (e) => { mouseDown = true; handleTouch('down', e.clientX, e.clientY); });
  window.addEventListener('mousemove', (e) => { if (mouseDown) handleTouch('move', e.clientX, e.clientY); });
  window.addEventListener('mouseup', (e) => { if (mouseDown) { mouseDown = false; handleTouch('up', e.clientX, e.clientY); } });
  // 双击缩放拦截（iOS Safari 老版本）
  let lastTap = 0;
  canvas.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTap < 350) e.preventDefault();
    lastTap = now;
  });

  /* ---------- 生命周期 ---------- */
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 250));
  window.visualViewport && window.visualViewport.addEventListener('resize', resize);
  window.addEventListener('pagehide', () => {
    if (KB.Player && KB.Player.state) KB.Save.flush(KB.Player.state);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && KB.Player && KB.Player.state) KB.Save.flush(KB.Player.state);
  });

  /* ---------- 启动 ---------- */
  resize();
  // emoji 字体就绪后重刷精灵缓存
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => KB.art.clearCaches());
  }
  KB.SceneManager.push(new KB.scenes.BootScene());
  requestAnimationFrame(loop);
})();
