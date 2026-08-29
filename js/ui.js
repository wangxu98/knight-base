/* ============================================================
 * 骑士基地：世界起源 - ui.js
 * Canvas 自绘 UI 框架：Widget/Button/Panel/Label/ProgressBar/
 * ScrollView/Toast / 触控路由
 * ============================================================ */
'use strict';
(function () {
  const M = KB.math;
  const FONT = '-apple-system,"PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif';
  const ui = KB.ui = {};

  ui.font = (px, weight) => (weight ? weight + ' ' : '') + px + 'px ' + FONT;
  ui.FONT = FONT;

  /* ---------------- 设计令牌与通用质感 ---------------- */
  const T = ui.T = {
    gold: '#ffd54f', goldDeep: '#c9982a',
    text: '#eef2ff', sub: 'rgba(210,222,255,.6)',
    edge: 'rgba(150,172,255,.22)', edgeSoft: 'rgba(150,172,255,.12)',
  };
  // 颜色加深/提亮：t>0 提亮，t<0 加深
  function shade(hex, t) {
    if (typeof hex !== 'string' || hex[0] !== '#') return hex;
    const a = parseInt(hex.slice(1), 16);
    const to = t > 0 ? 255 : 0, k = Math.min(1, Math.abs(t));
    const r = Math.round(((a >> 16) & 255) * (1 - k) + to * k);
    const g = Math.round(((a >> 8) & 255) * (1 - k) + to * k);
    const b = Math.round((a & 255) * (1 - k) + to * k);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  ui.shade = shade;
  // 玻璃拟态面板：渐变底 + 暗外线 + 亮内线 + 顶部高光
  ui.glass = function (ctx, x, y, w, h, r, o) {
    o = o || {};
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, o.top || 'rgba(30,40,78,.92)');
    g.addColorStop(1, o.bottom || 'rgba(12,17,38,.94)');
    ctx.fillStyle = o.fill || g;
    M.roundRect(ctx, x, y, w, h, r); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1;
    M.roundRect(ctx, x - .5, y - .5, w + 1, h + 1, r); ctx.stroke();
    ctx.strokeStyle = o.edge || T.edge; ctx.lineWidth = 1;
    M.roundRect(ctx, x + .5, y + .5, w - 1, h - 1, Math.max(0, r - 1)); ctx.stroke();
    if (h > 10) {
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      M.roundRect(ctx, x + 2, y + 2, w - 4, Math.min(h * .35, 12), Math.max(0, r - 2)); ctx.fill();
    }
  };

  /* ---------------- Widget 基类 ---------------- */
  class Widget {
    constructor() {
      this.children = [];
      this.visible = true;
      this.x = 0; this.y = 0; this.w = 0; this.h = 0;
      this.onTap = null;          // function(widget)
      this.userData = null;
    }
    add(c) { this.children.push(c); return c; }
    remove(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); }
    removeAll() { this.children.length = 0; }
    contains(x, y) { return x >= this.x && x <= this.x + this.w && y >= this.y && y <= this.y + this.h; }
    // 命中：返回最深的可交互 widget
    hit(x, y) {
      if (!this.visible) return null;
      if (!this.contains(x, y)) return null;
      for (let i = this.children.length - 1; i >= 0; i--) {
        const r = this.children[i].hit(x, y);
        if (r) return r;
      }
      return this;
    }
    // 触控分发：返回 true 表示已消费
    onTouch(type, x, y) {
      const target = this.hit(x, y);
      if (!target) return false;
      if (target._touch && target._touch(type, x, y)) return true;
      if (type === 'up' && target.onTap) { target.onTap(target); return true; }
      return true; // 命中即消费，防止穿透
    }
    layout() { for (const c of this.children) if (c.layout) c.layout(); }
    draw(ctx) {
      if (!this.visible) return;
      if (this._draw) this._draw(ctx);
      for (const c of this.children) c.draw(ctx);
    }
  }
  ui.Widget = Widget;

  /* ---------------- Button ---------------- */
  class Button extends Widget {
    constructor(o) {
      super();
      o = o || {};
      this.label = o.label || '';
      this.sub = o.sub || '';
      this.icon = o.icon || null;         // emoji 字符
      this.bg = o.bg || '#2c3f6e';
      this.bgPress = o.bgPress || '#3d5aa0';
      this.fg = o.fg || '#ffffff';
      this.radius = o.radius !== undefined ? o.radius : 12;
      this.fontSize = o.fontSize || 17;
      this.iconSize = o.iconSize || 24;
      this.enabled = o.enabled !== false;
      this.onTap = o.onTap || null;
      this.pressed = false;
      this.borderColor = o.borderColor || null;
      this.minW = o.minW || 0;
    }
    _touch(type, x, y) {
      if (!this.enabled) { this.pressed = false; return true; }
      if (type === 'down') { this.pressed = true; }
      else if (type === 'move') { if (!this.contains(x, y)) this.pressed = false; }
      else if (type === 'up') {
        if (this.pressed && this.contains(x, y) && this.onTap) { this.pressed = false; this.onTap(this); }
        this.pressed = false;
      } else if (type === 'cancel') this.pressed = false;
      return true;
    }
    _draw(ctx) {
      const r = this.radius;
      const x = this.x, y = this.y, w = this.w, h = this.h;
      const base = this.enabled ? (this.pressed ? shade(this.bg, -.22) : this.bg) : '#3a4152';
      ctx.save();
      // 投影
      if (this.enabled) {
        ctx.fillStyle = 'rgba(3,6,16,.5)';
        M.roundRect(ctx, x + 1.5, y + 3.5, w, h, r); ctx.fill();
      }
      // 主体渐变
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, shade(base, .24));
      g.addColorStop(.5, base);
      g.addColorStop(1, shade(base, -.16));
      ctx.fillStyle = g;
      M.roundRect(ctx, x, y, w, h, r); ctx.fill();
      // 顶部光泽
      if (h > 12) {
        ctx.fillStyle = 'rgba(255,255,255,.12)';
        M.roundRect(ctx, x + 2, y + 2, w - 4, Math.max(4, h * .42), Math.max(0, r - 2)); ctx.fill();
      }
      // 边框
      ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1;
      M.roundRect(ctx, x + .5, y + .5, w - 1, h - 1, Math.max(0, r - 1)); ctx.stroke();
      if (this.borderColor) {
        ctx.strokeStyle = this.borderColor; ctx.lineWidth = 2;
        M.roundRect(ctx, x + 1.5, y + 1.5, w - 3, h - 3, Math.max(0, r - 1.5)); ctx.stroke();
      }
      if (!this.enabled) {
        ctx.fillStyle = 'rgba(22,28,50,.5)';
        M.roundRect(ctx, x, y, w, h, r); ctx.fill();
      }
      // 文案（带柔影，按下下沉）
      const dy = (this.pressed && this.enabled) ? 1.5 : 0;
      const cx = x + w / 2;
      let cy = y + h / 2 + dy;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.globalAlpha = this.enabled ? 1 : .6;
      const label = (txt, font, color, lx, ly) => {
        ctx.font = font;
        ctx.fillStyle = 'rgba(0,0,0,.38)';
        ctx.fillText(txt, lx, ly + 1.5);
        ctx.fillStyle = color;
        ctx.fillText(txt, lx, ly);
      };
      if (this.icon && this.label) {
        ctx.font = ui.font(this.fontSize, 'bold');
        const lw = ctx.measureText(this.label).width;
        const iw = this.iconSize * 1.05;
        const total = iw + 10 + lw;
        const ix = cx - total / 2 + iw / 2;
        if (h >= 44) {  // 图标底托
          ctx.fillStyle = 'rgba(255,255,255,.16)';
          ctx.beginPath(); ctx.arc(ix, cy, this.iconSize * .74, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(ix, cy, this.iconSize * .74, 0, Math.PI * 2); ctx.stroke();
        }
        label(this.icon, this.iconSize + 'px ' + FONT, this.fg, ix, cy + 1);
        const lx = ix + iw / 2 + 10;
        if (this.sub && h >= 60) {  // 双行：标题 + 副标题
          label(this.label, ui.font(this.fontSize, 'bold'), this.fg, lx, cy - 10);
          ctx.font = ui.font(this.fontSize - 5);
          ctx.fillStyle = 'rgba(255,255,255,.72)';
          ctx.fillText(this.sub, lx, cy + 14);
        } else {
          label(this.label, ui.font(this.fontSize, 'bold'), this.fg, lx, cy);
        }
      } else if (this.icon) {
        if (h >= 44) {
          ctx.fillStyle = 'rgba(255,255,255,.16)';
          ctx.beginPath(); ctx.arc(cx, cy, this.iconSize * .74, 0, Math.PI * 2); ctx.fill();
        }
        label(this.icon, this.iconSize + 'px ' + FONT, this.fg, cx, cy + 1);
      } else if (this.label) {
        if (this.sub) cy -= 9;
        label(this.label, ui.font(this.fontSize, 'bold'), this.fg, cx, cy);
        if (this.sub) {
          ctx.font = ui.font(this.fontSize - 5);
          ctx.fillStyle = 'rgba(255,255,255,.72)';
          ctx.fillText(this.sub, cx, cy + 17);
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }
  ui.Button = Button;

  /* ---------------- Panel ---------------- */
  class Panel extends Widget {
    constructor(o) {
      super();
      o = o || {};
      this.bg = o.bg || 'rgba(16,22,44,.92)';
      this.radius = o.radius !== undefined ? o.radius : 16;
      this.borderColor = o.borderColor || 'rgba(255,255,255,.14)';
      this._draw = (ctx) => {
        const x = this.x, y = this.y, w = this.w, h = this.h, r = this.radius;
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, 'rgba(255,255,255,.05)');
        g.addColorStop(1, 'rgba(0,0,0,.14)');
        ctx.fillStyle = this.bg;   // 透出底色的基调
        M.roundRect(ctx, x, y, w, h, r); ctx.fill();
        ctx.fillStyle = g;         // 上下光影
        M.roundRect(ctx, x, y, w, h, r); ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.38)'; ctx.lineWidth = 1;
        M.roundRect(ctx, x - .5, y - .5, w + 1, h + 1, r); ctx.stroke();
        if (this.borderColor) {
          ctx.strokeStyle = this.borderColor; ctx.lineWidth = 1.5;
          M.roundRect(ctx, x + .75, y + .75, w - 1.5, h - 1.5, r); ctx.stroke();
        } else if (r > 4) {
          ctx.strokeStyle = T.edgeSoft; ctx.lineWidth = 1;
          M.roundRect(ctx, x + .5, y + .5, w - 1, h - 1, Math.max(0, r - 1)); ctx.stroke();
        }
        if (h > 10) {  // 顶部内高光
          ctx.fillStyle = 'rgba(255,255,255,.05)';
          M.roundRect(ctx, x + 2, y + 2, w - 4, Math.min(h * .35, 12), Math.max(0, r - 2)); ctx.fill();
        }
      };
    }
  }
  ui.Panel = Panel;

  /* ---------------- Label ---------------- */
  class Label extends Widget {
    constructor(o) {
      super();
      o = o || {};
      this.text = o.text || '';
      this.fontSize = o.fontSize || 15;
      this.color = o.color || '#e8ecf5';
      this.align = o.align || 'center';
      this.weight = o.weight || '';
      this._draw = (ctx) => {
        ctx.font = ui.font(this.fontSize, this.weight);
        ctx.fillStyle = this.color;
        ctx.textAlign = this.align; ctx.textBaseline = 'middle';
        ctx.fillText(this.text, this.align === 'left' ? this.x : this.x + this.w / 2, this.y + this.h / 2);
      };
    }
  }
  ui.Label = Label;

  /* ---------------- ProgressBar ---------------- */
  class ProgressBar extends Widget {
    constructor(o) {
      super();
      o = o || {};
      this.pct = o.pct || 0;
      this.bg = o.bg || 'rgba(0,0,0,.45)';
      this.fg = o.fg || '#4caf50';
      this._draw = (ctx) => {
        const x = this.x, y = this.y, w = this.w, h = this.h;
        // 轨道
        M.roundRect(ctx, x, y, w, h, h / 2);
        ctx.fillStyle = this.bg; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1;
        M.roundRect(ctx, x + .5, y + .5, w - 1, h - 1, h / 2 - .5); ctx.stroke();
        const p = M.clamp(this.pct, 0, 1), fw = p * w;
        if (fw > 2) {
          ctx.save();
          ctx.beginPath();
          M.roundRect(ctx, x, y, w, h, h / 2);
          ctx.clip();
          const g = ctx.createLinearGradient(0, y, 0, y + h);
          g.addColorStop(0, shade(this.fg, .35));
          g.addColorStop(.45, this.fg);
          g.addColorStop(1, shade(this.fg, -.2));
          ctx.fillStyle = g;
          ctx.fillRect(x, y, fw, h);
          ctx.fillStyle = 'rgba(255,255,255,.25)';
          ctx.fillRect(x, y, fw, Math.max(1.5, h * .32));  // 顶光泽
          ctx.restore();
        }
      };
    }
  }
  ui.ProgressBar = ProgressBar;

  /* ---------------- ScrollView（纵向滚动） ---------------- */
  class ScrollView extends Widget {
    constructor(o) {
      super();
      o = o || {};
      this.contentH = 0;
      this.scrollY = 0;
      this._drag = null;
      this.itemTap = o.itemTap || null;   // function(childWidget)
      this.clip = o.clip !== false;
      this._touch = (type, x, y) => {
        if (type === 'down') {
          this._drag = { y, sy: this.scrollY, moved: false, target: this.hit(x, y) };
        } else if (type === 'move' && this._drag) {
          const dy = y - this._drag.y;
          if (Math.abs(dy) > 10) this._drag.moved = true;
          const max = Math.max(0, this.contentH - this.h);
          this.scrollY = M.clamp(this._drag.sy - dy, 0, max);
        } else if (type === 'up' && this._drag) {
          if (!this._drag.moved) {
            const t = this._drag.target;
            if (t && t !== this) {
              if (this.itemTap) this.itemTap(t);
              else if (t.onTap) t.onTap(t);
            }
          }
          this._drag = null;
        } else if (type === 'cancel') this._drag = null;
        return true;
      };
    }
    layout() {
      // 子元素从 y=scrollY 起纵向排布（children 自带 h，gap 由外部控制）
      let y = this.y - this.scrollY;
      for (const c of this.children) { c.x = this.x; c.y = y; y += c.h; }
      this.contentH = y - this.y + this.scrollY;
    }
    _draw(ctx) {
      if (!this.clip) { Widget.prototype.draw.call(this, ctx); return; }
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.x, this.y, this.w, this.h);
      ctx.clip();
      Widget.prototype.draw.call(this, ctx);
      ctx.restore();
    }
  }
  ui.ScrollView = ScrollView;

  /* ---------------- 通用绘制助手 ---------------- */
  ui.drawStars = function (ctx, x, y, size, stars, max) {
    max = max || 10;
    // 10星用数字+★，5星内画星
    if (max <= 5) {
      for (let i = 0; i < max; i++) {
        drawStar(ctx, x + i * (size + 2) + size / 2, y, size / 2, i < stars ? '#ffd54f' : 'rgba(255,255,255,.22)');
      }
    } else {
      ctx.font = ui.font(size, 'bold');
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = stars > 0 ? '#ffd54f' : 'rgba(255,255,255,.3)';
      ctx.fillText('★' + stars, x, y);
    }
  };
  function drawStar(ctx, cx, cy, r, color) {
    ctx.save();
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + i * Math.PI / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,.35)';   // 柔影
    ctx.save(); ctx.translate(0, 1); ctx.fill(); ctx.restore();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.28)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  ui.drawStar = drawStar;

  ui.drawCoin = function (ctx, x, y, r, color, glyph) {
    const c = color || '#ffd54f';
    ctx.save();
    // 投影
    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath(); ctx.arc(x, y + 1.5, r, 0, Math.PI * 2); ctx.fill();
    // 立体币面
    const g = ctx.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r);
    g.addColorStop(0, shade(c, .45));
    g.addColorStop(.65, c);
    g.addColorStop(1, shade(c, -.25));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(90,60,10,.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r - .5, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.32)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r * .72, 0, Math.PI * 2); ctx.stroke();
    if (glyph) {
      ctx.font = ui.font(Math.round(r * 1.05), 'bold');
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(glyph, x, y + 1.5);
      ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillText(glyph, x, y + .5);
    }
    // 高光点
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.ellipse(x - r * .38, y - r * .45, r * .18, r * .1, -.7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  /* ---------------- Toast 全局提示 ---------------- */
  const toasts = [];
  ui.toast = function (msg, dur) {
    toasts.push({ msg, t: 0, dur: dur || 2.2 });
    if (toasts.length > 4) toasts.shift();
  };
  ui.updateToasts = function (dt) { for (let i = toasts.length - 1; i >= 0; i--) { toasts[i].t += dt; if (toasts[i].t > toasts[i].dur) toasts.splice(i, 1); } };
  ui.drawToasts = function (ctx, W, H) {
    if (!toasts.length) return;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    toasts.forEach((t, i) => {
      const ain = Math.min(1, t.t / .22);
      const a = Math.min(1, ain, (t.dur - t.t) / .35);
      const ease = 1 - Math.pow(1 - ain, 3);       // 上滑缓动
      const y = H * 0.30 + i * 48 + (1 - ease) * 12;
      ctx.font = ui.font(16, 'bold');
      const w = Math.min(W * 0.8, ctx.measureText(t.msg).width + 60);
      ctx.globalAlpha = a;
      const x = (W - w) / 2;
      const g = ctx.createLinearGradient(0, y - 21, 0, y + 21);
      g.addColorStop(0, 'rgba(38,49,94,.96)');
      g.addColorStop(1, 'rgba(13,18,38,.97)');
      ctx.fillStyle = g;
      M.roundRect(ctx, x, y - 21, w, 42, 21); ctx.fill();
      ctx.strokeStyle = 'rgba(158,178,255,.28)'; ctx.lineWidth = 1;
      M.roundRect(ctx, x + .5, y - 20.5, w - 1, 41, 20.5); ctx.stroke();
      ctx.fillStyle = T.gold;
      ctx.beginPath(); ctx.arc(x + 20, y, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(t.msg, W / 2 + 10, y);
      ctx.globalAlpha = 1;
    });
  };

  /* ---------------- 通用确认弹窗（作为场景使用） ---------------- */
  ui.ConfirmScene = function (opts) {
    // 返回一个轻量"场景"对象：draw/onTouch，供 SceneManager.push
    const W = () => KB.Main.viewW, H = () => KB.Main.viewH;
    const btnYes = new Button({ label: opts.yes || '确定', bg: '#2e7d32', fontSize: 16 });
    const btnNo = opts.noText === null ? null : new Button({ label: opts.no || '取消', bg: '#546e7a', fontSize: 16 });
    const born = KB.Main ? KB.Main.time : 0;
    return {
      opaque: false,
      update() {},
      draw(ctx) {
        const w = Math.min(460, W() * 0.86), h = 200;
        const x = (W() - w) / 2, y = (H() - h) / 2;
        // 遮罩 + 弹入
        const t = (KB.Main.time - born) || 0;
        const k = Math.min(1, t / .18);
        ctx.save();
        ctx.fillStyle = 'rgba(4,7,18,.6)';
        ctx.fillRect(0, 0, W(), H());
        ctx.translate(0, (1 - k) * 16);
        // 玻璃面板
        ui.glass(ctx, x, y, w, h, 20);
        // 金色顶饰线
        const gold = ctx.createLinearGradient(x, 0, x + w, 0);
        gold.addColorStop(0, 'rgba(255,213,79,0)');
        gold.addColorStop(.5, 'rgba(255,213,79,.9)');
        gold.addColorStop(1, 'rgba(255,213,79,0)');
        ctx.fillStyle = gold;
        M.roundRect(ctx, x + 26, y + 13, w - 52, 2.5, 1.25); ctx.fill();
        ctx.font = ui.font(17, 'bold');
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        wrapText(ctx, opts.msg || '确认？', W() / 2, y + 56, w - 48, 24);
        const bw = 132, bh = 46, by = y + h - 66;
        if (btnNo) { btnNo.x = x + w / 2 - bw - 12; btnNo.y = by; btnNo.w = bw; btnNo.h = bh; }
        btnYes.x = x + w / 2 + 12; btnYes.y = by; btnYes.w = bw; btnYes.h = bh;
        if (btnNo) btnNo.draw(ctx);
        btnYes.draw(ctx);
        ctx.restore();
      },
      onTouch(type, x, y) {
        if (type === 'down') {
          if (btnYes.hit(x, y)) btnYes._touch('down', x, y);
          else if (btnNo && btnNo.hit(x, y)) btnNo._touch('down', x, y);
          return true;
        }
        if (type === 'up') {
          if (btnYes.hit(x, y) && btnYes.pressed) { btnYes.pressed = false; KB.SceneManager.pop(); if (opts.onYes) opts.onYes(); return true; }
          if (btnNo && btnNo.hit(x, y) && btnNo.pressed) { btnNo.pressed = false; KB.SceneManager.pop(); if (opts.onNo) opts.onNo(); return true; }
          btnYes.pressed = false; if (btnNo) btnNo.pressed = false;
          return true;
        }
        return true; // 模态拦截
      },
    };
  };

  function wrapText(ctx, text, cx, cy, maxW, lineH) {
    const lines = [];
    let line = '';
    for (const ch of text) {
      if (ctx.measureText(line + ch).width > maxW) { lines.push(line); line = ch; }
      else line += ch;
    }
    lines.push(line);
    const y0 = cy - (lines.length - 1) * lineH / 2;
    lines.forEach((l, i) => ctx.fillText(l, cx, y0 + i * lineH));
  }
  ui.wrapText = wrapText;
})();
