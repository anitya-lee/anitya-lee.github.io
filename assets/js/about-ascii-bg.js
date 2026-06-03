/* ─────────────────────────────────────────────────────────────────────────
 * about-ascii-bg.js
 *
 * Fills the About section background with the ASCII motion design.
 * Every cell of the base noise is part of the binary form of "yuri lee".
 * 8 multilingual greetings cycle in-place at fixed (row, startCol) cells:
 * noise wakes → decodes into greeting binary → glitches → settles as the
 * actual text → fades back to noise. Half the events anchor text to the
 * slot's left, the other half to the right, so coverage stays balanced
 * across the section width even for long phrases.
 *
 * HUD chrome from the mock is removed — this is pure background motion.
 * Per-cell density (6px font / 8px line-height) matches the 1080×1920
 * design; the renderer adapts row/col counts to the host element's size
 * (ResizeObserver). "yuri lee" itself is never rendered as text — only
 * its binary tiles the background.
 * ───────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  const GREETINGS = [
    { lang: 'EN', text: 'hello, nice to meet you' },
    { lang: 'KO', text: '안녕하세요, 만나서 반갑습니다' },
    { lang: 'JA', text: 'こんにちは、はじめまして' },
    { lang: 'ZH', text: '你好，很高兴见到你' },
    { lang: 'ES', text: 'hola, encantado de conocerte' },
    { lang: 'FR', text: 'bonjour, enchanté de vous rencontrer' },
    { lang: 'AR', text: 'مرحبا، تشرفت بلقائك' },
    { lang: 'HI', text: 'नमस्ते, आपसे मिलकर खुशी हुई' },
  ];

  const PADDING            = 0;
  const FONT_SIZE          = 16;
  const LINE_HEIGHT        = 22;
  const MAX_EVENTS         = 100;
  const NOISE_BASE_OPACITY = 0.18;

  /* ─── helpers ──────────────────────────────────── */
  const cps = (s) => Array.from(s);
  function toBin(ch) {
    const cp = ch.codePointAt(0);
    const bits = cp < 0x80 ? 8 : 16;
    return cp.toString(2).padStart(bits, '0');
  }
  const bins  = (s) => cps(s).map(toBin);
  const asBin = (s) => bins(s).join(' ');
  const rand  = (a, b) => a + Math.random() * (b - a);
  const ri    = (a, b) => Math.floor(rand(a, b + 1));

  const GLITCH_CHARS = '█▓▒░|/_\\=+-#@*∙◇◆◢◣◤◥▮◯';
  const glitchPick = () => GLITCH_CHARS[Math.floor(Math.random() * GLITCH_CHARS.length)];

  const YURI_BIN = asBin('yuri lee'); // 71-char binary signature

  /* ─── runtime state ─────────────────────────────── */
  let containerEl = null;
  let gridEl      = null;
  let CHAR_WIDTH  = 3.6;
  let COLS_VAL    = 0;
  let ROWS_VAL    = 0;
  let noiseGrid   = [];
  let rows        = [];
  let events      = [];
  let rafId       = 0;
  let resizeObs   = null;
  let resizeTimer = 0;

  /* ─── measure exact monospace advance ──────────── */
  function measureCharWidth() {
    const probe = document.createElement('span');
    probe.style.cssText =
      'position:absolute;visibility:hidden;left:-9999px;top:-9999px;' +
      'white-space:pre;letter-spacing:0;' +
      'font-family:\'JetBrains Mono\',monospace;' +
      'font-size:' + FONT_SIZE + 'px;line-height:' + LINE_HEIGHT + 'px;' +
      'font-feature-settings:"tnum" 1,"zero" 1;';
    probe.textContent = '0'.repeat(500);
    document.body.appendChild(probe);
    CHAR_WIDTH = probe.getBoundingClientRect().width / 500;
    probe.remove();
  }

  /* ─── noise grid (every cell is part of yuri lee binary) ─ */
  function buildNoise() {
    noiseGrid = [];
    const L = YURI_BIN.length;
    for (let r = 0; r < ROWS_VAL; r++) {
      const offset = ri(0, L - 1);
      const row = new Array(COLS_VAL);
      for (let c = 0; c < COLS_VAL; c++) {
        row[c] = YURI_BIN[(c + offset) % L];
      }
      noiseGrid.push(row);
    }
  }
  function noiseSlice(row, startCol, len) {
    const line = noiseGrid[row];
    const L = YURI_BIN.length;
    let out = '';
    for (let i = 0; i < len; i++) {
      const c = startCol + i;
      if (line && c >= 0 && c < line.length) out += line[c];
      else {
        const k = ((c % L) + L) % L;
        out += YURI_BIN[k];
      }
    }
    return out;
  }
  function rowToString(idx) { return noiseGrid[idx].join(''); }

  /* ─── Row: one grid line, may hold an active event slot ─ */
  class Row {
    constructor(idx) {
      this.idx = idx;
      this.el = document.createElement('div');
      this.el.className = 'aab-row';
      this.el.textContent = rowToString(idx);
      this.activeEvent = null;
      this.slotSpan = null;
    }
    attach(ev) {
      if (this.activeEvent && this.activeEvent !== ev) {
        this.activeEvent._displaced = true;
      }
      this.activeEvent = ev;

      const noiseLine  = rowToString(this.idx);
      const beforeEnd  = Math.max(0, ev.startCol);
      const afterStart = Math.max(0, ev.startCol + ev.slotLen);
      const before = noiseLine.slice(0, beforeEnd);
      const after  = noiseLine.slice(afterStart);

      this.el.textContent = '';
      if (before) this.el.appendChild(document.createTextNode(before));
      const span = document.createElement('span');
      span.className = 'aab-ev' + (ev.tone ? ' ' + ev.tone : '');
      span.style.width = (ev.slotLen * CHAR_WIDTH).toFixed(2) + 'px';
      if (ev.startCol < 0) {
        span.style.marginLeft = (ev.startCol * CHAR_WIDTH).toFixed(2) + 'px';
      }
      this.el.appendChild(span);
      if (after) this.el.appendChild(document.createTextNode(after));

      this.slotSpan = span;
      this.update();
    }
    update() {
      if (!this.activeEvent || !this.slotSpan) return;
      this.slotSpan.textContent = this.activeEvent.payload;
      this.slotSpan.style.opacity = this.activeEvent.opacity.toFixed(3);
    }
    detach(ev) {
      if (this.activeEvent !== ev) return;
      this.activeEvent = null;
      this.slotSpan = null;
      this.el.textContent = rowToString(this.idx);
    }
  }

  /* ─── row reservation manager ──────────────────── */
  const rowMgr = {
    inUse: new Set(),
    topSkip: 14,
    bottomSkip: 14,
    reset() { this.inUse.clear(); },
    pickRow() {
      const lo = this.topSkip;
      const hi = ROWS_VAL - this.bottomSkip - 1;
      for (let i = 0; i < 220; i++) {
        const r = ri(lo, hi);
        if (!this.inUse.has(r)) { this.inUse.add(r); return r; }
      }
      const r = ri(lo, hi);
      this.inUse.add(r);
      return r;
    },
    release(r) { this.inUse.delete(r); }
  };

  /* ─── Event ─────────────────────────────────────── */
  class Event {
    constructor() { this.respawn(rand(0, 5500)); }
    pickPhrase() { return GREETINGS[ri(0, GREETINGS.length - 1)]; }

    respawn(delay) {
      this.phrase  = this.pickPhrase();
      this.tokens  = bins(this.phrase.text);
      this.fullBin = this.tokens.join(' ');
      this.text    = this.phrase.text;
      this.chars   = cps(this.text);
      this.textLen = this.chars.length;
      this.slotLen = this.fullBin.length;

      this.row    = rowMgr.pickRow();
      this.rowObj = rows[this.row];

      /* 3-band text position + 50/50 L/R anchor for balanced coverage */
      const buf        = 20;
      const maxTextCol = Math.max(0, COLS_VAL - this.textLen - buf);
      const bandW      = maxTextCol / 3;
      const band       = ri(0, 2);
      const textCol    = ri(Math.floor(band * bandW), Math.floor((band + 1) * bandW));
      this.anchor      = Math.random() < 0.5 ? 'L' : 'R';
      if (this.anchor === 'L') {
        this.startCol = textCol;
        this.textPos  = 0;
      } else {
        this.textPos  = this.slotLen - this.textLen;
        this.startCol = textCol - this.textPos;
      }
      this.noiseSlice = noiseSlice(this.row, this.startCol, this.slotLen);

      this.tone = '';
      const t = Math.random();
      if      (t < 0.20) this.tone = 'l2';
      else if (t < 0.48) this.tone = 'l1';

      this._displaced = false;
      this.state   = 'wait';
      this.t0      = performance.now() + (delay ?? rand(120, 1800));

      this.payload = this.noiseSlice;
      this.opacity = NOISE_BASE_OPACITY;

      this.dWake    = ri(280, 480);
      this.dDecode  = ri(550, 900);
      this.dHoldBin = ri(220, 600);
      this.dGlitch  = ri(420, 760);
      this.dHoldTxt = ri(1400, 2700);
      this.dFade    = ri(250, 470);

      this.rowObj.attach(this);
    }

    end() {
      rowMgr.release(this.row);
      this.rowObj.detach(this);
      this.respawn(rand(120, 1800));
    }

    render() {
      if (this._displaced || this.rowObj.activeEvent !== this) return;
      this.rowObj.update();
    }

    tick(now) {
      const dt = now - this.t0;
      if (dt < 0) return;

      switch (this.state) {
        case 'wait':
          this.state = 'wake'; this.t0 = now;
          this.render();
          break;
        case 'wake': {
          const r = Math.min(1, dt / this.dWake);
          this.opacity = NOISE_BASE_OPACITY + (1 - NOISE_BASE_OPACITY) * r;
          this.payload = this.noiseSlice;
          this.render();
          if (r >= 1) { this.state = 'decode'; this.t0 = now; this.opacity = 1; }
          break;
        }
        case 'decode': {
          const r = Math.min(1, dt / this.dDecode);
          let out = '';
          for (let i = 0; i < this.slotLen; i++) {
            out += Math.random() < r ? this.fullBin[i] : (this.noiseSlice[i] ?? this.fullBin[i]);
          }
          this.payload = out;
          this.render();
          if (r >= 1) { this.state = 'hold-bin'; this.t0 = now; }
          break;
        }
        case 'hold-bin':
          if (this.payload !== this.fullBin) {
            this.payload = this.fullBin;
            this.render();
          }
          if (dt > this.dHoldBin) { this.state = 'glitch'; this.t0 = now; }
          break;
        case 'glitch': {
          const r = Math.min(1, dt / this.dGlitch);
          const chars = this.chars;
          let textPart = '';
          for (let i = 0; i < chars.length; i++) {
            const rr = Math.random();
            if (rr < r) textPart += chars[i];
            else if (rr < 0.72) {
              const tok = this.tokens[i];
              const cut = ri(2, Math.min(4, tok.length));
              textPart += tok.slice(0, cut);
            } else {
              textPart += glitchPick();
            }
          }
          let out;
          if (this.anchor === 'L') {
            out = textPart + this.noiseSlice.slice(textPart.length);
          } else {
            const padLen = Math.max(0, this.slotLen - textPart.length);
            out = this.noiseSlice.slice(0, padLen) + textPart;
          }
          this.payload = out.slice(0, this.slotLen);
          this.render();
          if (dt > this.dGlitch) { this.state = 'settle'; this.t0 = now; }
          break;
        }
        case 'settle':
          if (this.anchor === 'L') {
            this.payload = this.text + this.noiseSlice.slice(this.textLen);
          } else {
            this.payload = this.noiseSlice.slice(0, this.textPos) + this.text;
          }
          this.state = 'hold-text'; this.t0 = now;
          this.render();
          break;
        case 'hold-text':
          if (dt > this.dHoldTxt) { this.state = 'fade'; this.t0 = now; }
          break;
        case 'fade': {
          const r = Math.min(1, dt / this.dFade);
          this.opacity = 1 - (1 - NOISE_BASE_OPACITY) * r;
          const baseText = this.text;
          const textPos  = this.textPos;
          let out = '';
          for (let i = 0; i < this.slotLen; i++) {
            if (Math.random() < r) out += this.noiseSlice[i];
            else {
              const ti = i - textPos;
              out += (ti >= 0 && ti < baseText.length) ? baseText[ti] : this.noiseSlice[i];
            }
          }
          this.payload = out;
          this.render();
          if (r >= 1) { this.end(); return; }
          break;
        }
      }
    }
  }

  /* ─── build / rebuild ──────────────────────────── */
  function tearDown() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    events = [];
    rows = [];
    rowMgr.reset();
    if (gridEl) gridEl.innerHTML = '';
  }

  function build() {
    tearDown();

    const W = containerEl.clientWidth;
    const H = containerEl.clientHeight;
    if (W < 60 || H < 60) return;

    measureCharWidth();
    COLS_VAL = Math.floor((W - PADDING * 2) / CHAR_WIDTH);
    ROWS_VAL = Math.floor((H - PADDING * 2) / LINE_HEIGHT);
    if (COLS_VAL < 20 || ROWS_VAL < 30) return;

    buildNoise();
    for (let r = 0; r < ROWS_VAL; r++) {
      const row = new Row(r);
      rows.push(row);
      gridEl.appendChild(row.el);
    }

    /* Cap events at usable row count × 0.85 — rowMgr needs unique rows */
    const usableRows = ROWS_VAL - rowMgr.topSkip - rowMgr.bottomSkip;
    const numEvents  = Math.min(MAX_EVENTS, Math.max(8, Math.floor(usableRows * 0.85)));
    for (let i = 0; i < numEvents; i++) events.push(new Event());

    function loop() {
      const now = performance.now();
      for (const e of events) e.tick(now);
      rafId = requestAnimationFrame(loop);
    }
    rafId = requestAnimationFrame(loop);
  }

  /* ─── boot ─────────────────────────────────────── */
  async function start() {
    containerEl = document.getElementById('about-ascii-bg');
    if (!containerEl) return;

    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (_) {}
    }

    gridEl = document.createElement('div');
    gridEl.className = 'aab-grid';
    containerEl.appendChild(gridEl);

    build();

    if (typeof ResizeObserver !== 'undefined') {
      resizeObs = new ResizeObserver(() => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(build, 220);
      });
      resizeObs.observe(containerEl);
    } else {
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(build, 220);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
