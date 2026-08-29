/* ============================================================
 * 骑士基地：世界起源 - main.js
 * 启动 / DPR / 安全区 / 输入 / 主循环 / 存档落盘 / 竖屏提示
 * ============================================================ */
'use strict';
(function () {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const Main = KB.Main = {
    canvas, ctx,
    viewW: 0, viewH: 0,
    dpr: 1,
    time: 0,
    safe: { t: 0, r: 0, b: 0, l: 0 },
    portrait: false,
  };

  /* ---------- 安全区探测 ---------- */
  function probeSafeArea() {
    try {
      const div = document.createElement('div');
      div.style.cssText = 'position:fixed;top:env(safe-area-inset-top);right:env(safe-area-inset-right);bottom:env(safe-area-inset-bottom);left:env(safe-area-inset-left);visibility:hidden;pointer-events:none;';
      document.body.appendChild(div);
      const cs = getComputedStyle(div);
      Main.safe = {
        t: parseFloat(cs.top) || 0,
        r: parseFloat(cs.right) || 0,
        b: parseFloat(cs.bottom) || 0,
        l: parseFloat(cs.left) || 0,
      };
      document.body.removeChild(div);
    } catch (e) { /* 保持 0 */ }
  }

  /* ---------- 尺寸/DPR ---------- */
  function resize() {
    probeSafeArea();
    const vw = Math.max(1, window.innerWidth), vh = Math.max(1, window.innerHeight);
    Main.viewW = vw; Main.viewH = vh;
    Main.portrait = vh > vw * 1.05;
    Main.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(vw * Main.dpr);
    canvas.height = Math.round(vh * Main.dpr);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    KB.SceneManager.onResize();
  }

  /* ---------- 主循环 ---------- */
  let lastTs = 0;
  function loop(ts) {
    requestAnimationFrame(loop);
    if (!lastTs) lastTs = ts;
    let dt = (ts - lastTs) / 1000;
    lastTs = ts;
    if (dt > 0.1) dt = 0.1;   // 后台回来防跳变
    Main.time += dt;

    ctx.setTransform(Main.dpr, 0, 0, Main.dpr, 0, 0);
    ctx.clearRect(0, 0, Main.viewW, Main.viewH);

    if (Main.portrait) {
      drawRotateHint();
    } else {
      KB.SceneManager.update(dt);
      KB.SceneManager.draw(ctx);
    }
    KB.ui.updateToasts(dt);
    KB.ui.drawToasts(ctx, Main.viewW, Main.viewH);

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
    const W = Main.viewW, H = Main.viewH;
    ctx.fillStyle = '#0d1022';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
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

  /* ---------- 输入 ---------- */
  // 触摸 → 统一事件
  function handleTouch(type, touch) {
    const x = touch.clientX, y = touch.clientY;
    KB.SceneManager.onTouch(type, x, y);
  }
  // 双指缩放拦截
  document.addEventListener('gesturestart', e => e.preventDefault());
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) handleTouch('down', t);
  }, { passive: false });
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) handleTouch('move', t);
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) handleTouch('up', t);
  }, { passive: false });
  canvas.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) handleTouch('cancel', t);
  }, { passive: false });
  // 桌面调试：鼠标映射
  let mouseDown = false;
  canvas.addEventListener('mousedown', (e) => { mouseDown = true; KB.SceneManager.onTouch('down', e.clientX, e.clientY); });
  window.addEventListener('mousemove', (e) => { if (mouseDown) KB.SceneManager.onTouch('move', e.clientX, e.clientY); });
  window.addEventListener('mouseup', (e) => { if (mouseDown) { mouseDown = false; KB.SceneManager.onTouch('up', e.clientX, e.clientY); } });
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
