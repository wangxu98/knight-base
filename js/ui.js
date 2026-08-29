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
      const bg = this.enabled ? (this.pressed ? this.bgPress : this.bg) : '#3a4152';
      ctx.fillStyle = bg;
      M.roundRect(ctx, this.x, this.y, this.w, this.h, this.radius);
      ctx.fill();
      if (this.borderColor) {
        ctx.strokeStyle = this.borderColor; ctx.lineWidth = 2;
        M.roundRect(ctx, this.x + 1, this.y + 1, this.w - 2, this.h - 2, this.radius);
        ctx.stroke();
      }
      const cx = this.x + this.w / 2;
      let cy = this.y + this.h / 2;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (this.icon && this.label) {
        const total = this.iconSize + 6 + ctx.measureText(this.label).width;
        let ix = cx - total / 2 + this.iconSize / 2;
        ctx.font = this.iconSize + 'px ' + FONT;
        ctx.fillStyle = this.fg;
        ctx.fillText(this.icon, ix, cy);
        ctx.font = ui.font(this.fontSize, 'bold');
        ctx.fillText(this.label, ix + this.iconSize / 2 + 6, cy);
      } else if (this.icon) {
        ctx.font = this.iconSize + 'px ' + FONT;
        ctx.fillText(this.icon, cx, cy);
      } else if (this.label) {
        if (this.sub) cy -= 9;
        ctx.font = ui.font(this.fontSize, 'bold');
        ctx.fillStyle = this.fg;
        ctx.fillText(this.label, cx, cy);
        if (this.sub) {
          ctx.font = ui.font(this.fontSize - 5);
          ctx.fillStyle = 'rgba(255,255,255,.75)';
          ctx.fillText(this.sub, cx, cy + 16);
        }
      }
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
        ctx.fillStyle = this.bg;
        M.roundRect(ctx, this.x, this.y, this.w, this.h, this.radius);
        ctx.fill();
        if (this.borderColor) {
          ctx.strokeStyle = this.borderColor; ctx.lineWidth = 1.5;
          M.roundRect(ctx, this.x + .75, this.y + .75, this.w - 1.5, this.h - 1.5, this.radius);
          ctx.stroke();
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
        ctx.fillStyle = this.bg;
        M.roundRect(ctx, this.x, this.y, this.w, this.h, this.h / 2);
        ctx.fill();
        const w = Math.max(0, Math.min(1, this.pct)) * this.w;
        if (w > 0) {
          ctx.fillStyle = this.fg;
          M.roundRect(ctx, this.x, this.y, Math.max(w, this.h), this.h, this.h / 2);
          ctx.fill();
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
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + i * Math.PI / 5;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
  }
  ui.drawStar = drawStar;

  ui.drawCoin = function (ctx, x, y, r, color, glyph) {
    ctx.fillStyle = color || '#ffd54f';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1.5; ctx.stroke();
    if (glyph) {
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.font = ui.font(Math.round(r * 1.1), 'bold');
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(glyph, x, y + 1);
    }
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
      const a = Math.min(1, t.t / .25, (t.dur - t.t) / .35);
      const y = H * 0.32 + i * 46;
      ctx.font = ui.font(16, 'bold');
      const w = Math.min(W * 0.8, ctx.measureText(t.msg).width + 44);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(10,14,30,.9)';
      M.roundRect(ctx, (W - w) / 2, y - 20, w, 40, 20); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(t.msg, W / 2, y);
      ctx.globalAlpha = 1;
    });
  };

  /* ---------------- 通用确认弹窗（作为场景使用） ---------------- */
  ui.ConfirmScene = function (opts) {
    // 返回一个轻量"场景"对象：draw/onTouch，供 SceneManager.push
    const W = () => KB.Main.viewW, H = () => KB.Main.viewH;
    const btnYes = new Button({ label: opts.yes || '确定', bg: '#2e7d32', fontSize: 16 });
    const btnNo = opts.noText === null ? null : new Button({ label: opts.no || '取消', bg: '#546e7a', fontSize: 16 });
    return {
      opaque: false,
      update() {},
      draw(ctx) {
        const w = Math.min(420, W() * 0.86), h = 190;
        const x = (W() - w) / 2, y = (H() - h) / 2;
        ctx.fillStyle = 'rgba(0,0,0,.55)';
        ctx.fillRect(0, 0, W(), H());
        ctx.fillStyle = 'rgba(18,24,48,.97)';
        M.roundRect(ctx, x, y, w, h, 18); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 1.5;
        M.roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 17); ctx.stroke();
        ctx.font = ui.font(17, 'bold');
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        wrapText(ctx, opts.msg || '确认？', W() / 2, y + 52, w - 48, 24);
        const bw = 120, bh = 44, by = y + h - 62;
        if (btnNo) { btnNo.x = x + w / 2 - bw - 14; btnNo.y = by; btnNo.w = bw; btnNo.h = bh; }
        btnYes.x = x + w / 2 + 14; btnYes.y = by; btnYes.w = bw; btnYes.h = bh;
        if (btnNo) btnNo.draw(ctx);
        btnYes.draw(ctx);
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
