/* ============================================================
   ABOUT — Generative kinetic typography background
   Sentence-cluster sequencing inspired by Max Cooper "Symphony in Acid"
   Canvas, vanilla JS, no dependencies.
   ============================================================ */

(function () {
  // ─────────────────────────────────────────────────────────
  // CONFIG — tune everything here
  // ─────────────────────────────────────────────────────────
  const CONFIG = {
    // ── Palette ─────────────────────────────────────────
    // Flat color palette — chips
    colors: {
      pageBackground: '#F3EFE7',
      darkBackground: '#050505',
      textOnDark:     '#F3EFE7',
      textOnLight:    '#111111',
      mutedBlack:     '#222222',
      redAccent:      '#E6372E',
      blueAccent:     '#1E3A8A',
      cyanAccent:     '#3BBFC3',
      warmGray:       '#C8C2B8',
      softBeigeGray:  '#DDD6CB',
    },
    // Block color spawn weights (sum ≈ 1.0) — keys must match colors above
    blockWeights: {
      redAccent:     0.14,
      blueAccent:    0.14,
      cyanAccent:    0.10,
      warmGray:      0.22,
      softBeigeGray: 0.22,
      mutedBlack:    0.18,
    },
    // Text color used when text sits on a colored block (contrast pinning)
    textOnBlock: {
      redAccent:     '#F3EFE7',
      blueAccent:    '#F3EFE7',
      cyanAccent:    '#111111',
      warmGray:      '#111111',
      softBeigeGray: '#111111',
      mutedBlack:    '#F3EFE7',
    },

    // ── Typography ─────────────────────────────────────
    font: {
      family:   '"JetBrains Mono", "IBM Plex Mono", "SF Mono", Menlo, monospace',
      fragment: [10, 18],   // sentence fragments [min, max] px
      keyword:  [18, 25],   // standalone keywords [min, max] px
    },

    // ── Typing reveal (fragments only) ────────────────
    typing: {
      enabled:        true,
      chance:         0.30,   // 30% of fragments type-reveal; 70% appear at once
      msPerChar:      28,     // milliseconds per character
      minDurationMs:  140,    // floor for very short fragments
    },

    // ── Content pools — DO NOT alter outside this block ─
    phrases: [
      'The limits of my language mean the limits of my world.',
      'Whereof one cannot speak, thereof one must be silent.',
      'Existence precedes essence',
      'Cogito, ergo sum',
      'Die Sprache ist das Haus des Seins',
      'Human beings are thrown into the world',
      'Language is the house of being',
      'There is nothing outside the text',
      'Thoughts without content are empty, intuitions without concepts are blind.',
      'Human, more than Human',
      'The door of the Perception',
    ],
    keywords: [
      'Existence',
      'Becoming',
      'Gott ist tot',
      'Deconstruction',
      'Différance',
      'Cognition',
      'Simulacra',
      'Episteme',
    ],

    // ── Spawn intervals (independent schedulers) ───────
    intervals: {
      sentenceMs:        [84, 156],   // center ≈ 120 ms
      keywordMs:         [84, 156],   // center ≈ 120 ms
      standaloneBlockMs: [2400, 4200],
    },
    fragmentDelayMs:     [120, 320],   // stagger between fragments in a cluster
    fragmentWordCount:   [1, 4],       // 1..4 words per fragment

    // ── Lifetime (ms) ──────────────────────────────────
    lifetime: {
      fragment: [2600, 5200],
      keyword:  [3500, 7000],
      block:    [2200, 5400],
    },
    fadeMs: { in: 380, out: 700 },

    // ── Density tier ───────────────────────────────────
    density: {
      desktop: { maxActive: 1200, minActive: 700, sizeScale: 1.00 },
      tablet:  { maxActive:  780, minActive: 455, sizeScale: 0.92 },
      mobile:  { maxActive:  400, minActive: 230, sizeScale: 0.78 },
    },

    // ── Opacity ranges (target per element; faded by lifecycle) ─
    opacity: {
      text:        { min: 1.00, max: 1.00 },   /* always fully opaque (no random transparency) */
      block:       { min: 1.00, max: 1.00 },
      canvasGlobal: 1.0,
    },

    // ── Motion ─────────────────────────────────────────
    // Max Cooper "Symphony in Acid" — text appears IN PLACE, holds, fades.
    // No drift. Only entry glitch micro-offset.
    drift: {
      speedRange: [0, 0],
      horizontalBias: 0,
    },

    // ── Block behavior ─────────────────────────────────
    // Boxes never visually cover text — all blocks render below text (layer 0).
    // Text-on-block dominant — most fragments sit inside a colored box.
    blockProbabilities: {
      highlight:  0.62,   // text has a highlight box behind it
      adjacent:   0.30,   // text + nearby companion blocks
      standalone: 0.03,   // very rare pure block (no text)
      mask:       0,      // REMOVED — boxes must not cover text
    },
    adjacentBlocks: {
      count: [1, 2],          // how many blocks beside a text element
      gap:   [10, 36],        // px gap between text edge and block
      sides: ['left', 'right', 'above', 'below'],
    },
    blockSize: {
      width:  [40, 280],
      height: [8, 26],
    },

    // ── Glitch ─────────────────────────────────────────
    glitch: {
      chance:        0.18,
      durationMs:    100,
      offsetPx:      3,
      letterSpacing: { chance: 0.25, px: 2 },
    },

    // ── Layout ─────────────────────────────────────────
    rowHeight: 26,
    padding:   { x: 4, y: 2 },

    // ── Anchor distribution ───────────────────────────
    anchorSpread: {
      margin:            20,  // px kept clear from canvas edge for anchor picks (lower = closer to edges)
      avoidRecentRadius: 160, // min distance from last anchors (lower = denser coverage)
      anchorHistory:     5,
    },

    // ── Reduced motion ─────────────────────────────────
    reducedMotion: {
      enabled:        true,
      snapshotCount:  22,
    },
  };

  // ─────────────────────────────────────────────────────────
  // Internals
  // ─────────────────────────────────────────────────────────
  const canvas = document.getElementById('about-bg');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });

  let elements      = [];
  let recentAnchors = [];
  let viewWidth = 0, viewHeight = 0;
  let density = CONFIG.density.desktop;
  let isVisible = false;
  let rafId = null;
  let resizeTimer = null;
  let nextSentenceAt = 0;
  let nextKeywordAt  = 0;
  let nextStandaloneAt = 0;
  let lastFrameTime = 0;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─────────────────────────────────────────────────────────
  // Utilities
  // ─────────────────────────────────────────────────────────
  const randRange = (a, b) => a + Math.random() * (b - a);
  const randInt   = (a, b) => Math.floor(randRange(a, b + 1));
  const pick      = (arr)  => arr[Math.floor(Math.random() * arr.length)];
  const snapY     = (y)    => Math.round(y / CONFIG.rowHeight) * CONFIG.rowHeight;
  const S         = (px)   => px * density.sizeScale;

  function pickBlockColorKey() {
    const r = Math.random();
    let acc = 0;
    for (const k of Object.keys(CONFIG.blockWeights)) {
      acc += CONFIG.blockWeights[k];
      if (r < acc) return k;
    }
    return 'lightGray';
  }
  const pickBlockColor = () => CONFIG.colors[pickBlockColorKey()];

  function measureText(content, fontSize, letterSpacing) {
    ctx.font = `${fontSize}px ${CONFIG.font.family}`;
    let w = ctx.measureText(content).width;
    if (letterSpacing > 0) w += letterSpacing * Math.max(0, content.length - 1);
    return w;
  }

  // True if a candidate text bbox would overlap any existing text bbox (with padding)
  function isTextOverlap(x, y, w, h, gap) {
    gap = gap || 6;
    for (const el of elements) {
      if (el.kind !== 'text') continue;
      const ax1 = x - gap, ay1 = y - gap, ax2 = x + w + gap, ay2 = y + h + gap;
      const bx1 = el.x, by1 = el.y, bx2 = el.x + el.w, by2 = el.y + el.h;
      if (ax1 < bx2 && bx1 < ax2 && ay1 < by2 && by1 < ay2) return true;
    }
    return false;
  }

  function pickAnchor() {
    const m = CONFIG.anchorSpread.margin || 20;
    for (let i = 0; i < 6; i++) {
      const x = randRange(m, Math.max(m + 1, viewWidth - m));
      const y = snapY(randRange(m, Math.max(m + 1, viewHeight - m)));
      const tooClose = recentAnchors.some(a => Math.hypot(a.x - x, a.y - y) < CONFIG.anchorSpread.avoidRecentRadius);
      if (!tooClose) {
        recentAnchors.push({ x, y });
        if (recentAnchors.length > CONFIG.anchorSpread.anchorHistory) recentAnchors.shift();
        return { x, y };
      }
    }
    // fallback random
    return { x: randRange(m, Math.max(m + 1, viewWidth - m)), y: snapY(randRange(m, Math.max(m + 1, viewHeight - m))) };
  }

  function pickDrift() {
    const speed = randRange(...CONFIG.drift.speedRange);
    const angle = Math.random() * Math.PI * 2;
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed * CONFIG.drift.horizontalBias,
    };
  }

  // ─────────────────────────────────────────────────────────
  // Element factories — minimal allocations
  // ─────────────────────────────────────────────────────────
  function makeText(type, content, x, y, fontSize) {
    const letterSpaced = type === 'fragment' && Math.random() < CONFIG.glitch.letterSpacing.chance;
    const letterSpacing = letterSpaced ? CONFIG.glitch.letterSpacing.px : 0;
    const w = measureText(content, fontSize, letterSpacing);
    const lifetime = type === 'keyword'
      ? randRange(...CONFIG.lifetime.keyword)
      : randRange(...CONFIG.lifetime.fragment);
    const d = pickDrift();
    // Typing reveal — only for fragments, and only `chance` of them (mix with instant)
    const typing = (CONFIG.typing && CONFIG.typing.enabled
                    && type === 'fragment'
                    && Math.random() < CONFIG.typing.chance)
      ? Math.max(CONFIG.typing.minDurationMs, content.length * CONFIG.typing.msPerChar)
      : 0;
    return {
      kind: 'text',
      type,                       // 'fragment' | 'keyword'
      layer: 1,
      content,
      x, y,
      w, h: fontSize + 4,
      fontSize,
      letterSpacing,
      vx: d.vx, vy: d.vy,
      targetOpacity: randRange(CONFIG.opacity.text.min, CONFIG.opacity.text.max),
      glitch: (Math.random() < CONFIG.glitch.chance) ? {
        offsetX: (Math.random() - 0.5) * CONFIG.glitch.offsetPx * 2,
        durationMs: CONFIG.glitch.durationMs,
      } : null,
      typeDurationMs: typing,
      bornAt: performance.now(),
      lifetime,
    };
  }

  function makeBlock(role, x, y, w, h, color) {
    const lifetime = randRange(...CONFIG.lifetime.block);
    const d = pickDrift();
    return {
      kind: 'block',
      role,                       // 'highlight' | 'adjacent' | 'standalone'
      layer: 0,                   // always below text — boxes never cover text
      x, y, w, h, color,
      vx: d.vx, vy: d.vy,
      targetOpacity: randRange(CONFIG.opacity.block.min, CONFIG.opacity.block.max),
      bornAt: performance.now(),
      lifetime,
    };
  }

  function makeHighlightBlockFor(textEl) {
    const padX = textEl.type === 'keyword' ? 10 : 6;
    const padY = textEl.type === 'keyword' ? 4 : 3;
    const colorKey = pickBlockColorKey();
    const blockColor = CONFIG.colors[colorKey];
    // Pin text color for contrast against this block's color
    textEl.textColor = CONFIG.textOnBlock[colorKey] || CONFIG.colors.textOnDark;
    // Sync block lifetime to text lifetime so they appear & vanish together
    const block = makeBlock(
      'highlight',
      textEl.x - padX,
      textEl.y - padY,
      textEl.w + padX * 2,
      textEl.h + padY * 2,
      blockColor
    );
    block.lifetime = textEl.lifetime;
    block.bornAt = textEl.bornAt;
    block.targetOpacity = Math.max(block.targetOpacity, 0.85);
    return block;
  }

  function pushAdjacentBlocksFor(textEl) {
    if (Math.random() >= CONFIG.blockProbabilities.adjacent) return;
    const [minN, maxN] = CONFIG.adjacentBlocks.count;
    const count = randInt(minN, maxN);
    for (let i = 0; i < count; i++) {
      const side = pick(CONFIG.adjacentBlocks.sides);
      const gap = randRange(...CONFIG.adjacentBlocks.gap);
      const blockW = randRange(40, Math.max(60, textEl.w * 0.7));
      const blockH = randRange(8, Math.max(10, textEl.h + 2));
      let x, y;
      if (side === 'left') {
        x = textEl.x - blockW - gap;
        y = textEl.y + (Math.random() - 0.5) * 6;
      } else if (side === 'right') {
        x = textEl.x + textEl.w + gap;
        y = textEl.y + (Math.random() - 0.5) * 6;
      } else if (side === 'above') {
        x = textEl.x + (Math.random() - 0.5) * 60;
        y = textEl.y - blockH - gap;
      } else {
        x = textEl.x + (Math.random() - 0.5) * 60;
        y = textEl.y + textEl.h + gap;
      }
      // Bounds clamp — skip if off-canvas
      if (x < CONFIG.padding.x || x + blockW > viewWidth - CONFIG.padding.x) continue;
      if (y < CONFIG.padding.y || y + blockH > viewHeight - CONFIG.padding.y) continue;
      // Final guard: skip if block would visually intersect the text bounding box
      const intersects = !(x + blockW < textEl.x || x > textEl.x + textEl.w ||
                           y + blockH < textEl.y || y > textEl.y + textEl.h);
      if (intersects) continue;
      elements.push(makeBlock('adjacent', x, y, blockW, blockH, pickBlockColor()));
    }
  }

  // ─────────────────────────────────────────────────────────
  // Sentence cluster spawning — the heart of the system
  // ─────────────────────────────────────────────────────────
  function splitSentence(sentence) {
    const words = sentence.split(/\s+/);
    const out = [];
    let i = 0;
    while (i < words.length) {
      const size = Math.min(words.length - i, randInt(...CONFIG.fragmentWordCount));
      out.push(words.slice(i, i + size).join(' '));
      i += size;
    }
    return out;
  }

  function spawnSentenceCluster() {
    if (elements.length >= density.maxActive) return;
    const sentence = pick(CONFIG.phrases);
    const fragments = splitSentence(sentence);
    const anchor = pickAnchor();

    let cumulativeDelay = 0;
    fragments.forEach((text, i) => {
      const thisDelay = cumulativeDelay;
      setTimeout(() => {
        if (!isVisible) return;
        if (elements.length >= density.maxActive) return;
        const fontSize = S(randRange(...CONFIG.font.fragment));
        // try up to 18 positions around the anchor — skip if all overlap
        for (let attempt = 0; attempt < 18; attempt++) {
          const xOffset = (Math.random() - 0.5) * (240 + attempt * 40);
          const yOffset = (i - (fragments.length - 1) / 2) * CONFIG.rowHeight + (Math.random() - 0.5) * 22 + attempt * 6;
          const x = Math.max(CONFIG.padding.x, Math.min(viewWidth - CONFIG.padding.x - 100, anchor.x + xOffset));
          const y = snapY(Math.max(CONFIG.padding.y, Math.min(viewHeight - CONFIG.padding.y - fontSize, anchor.y + yOffset)));
          const el = makeText('fragment', text, x, y, fontSize);
          if (isTextOverlap(el.x, el.y, el.w, el.h, 6)) continue;
          elements.push(el);
          if (Math.random() < CONFIG.blockProbabilities.highlight) elements.push(makeHighlightBlockFor(el));
          pushAdjacentBlocksFor(el);
          return;
        }
      }, thisDelay);
      cumulativeDelay += randRange(...CONFIG.fragmentDelayMs);
    });
  }

  // ─────────────────────────────────────────────────────────
  // Keyword + standalone block spawning
  // ─────────────────────────────────────────────────────────
  function spawnKeyword() {
    if (elements.length >= density.maxActive) return;
    const content = pick(CONFIG.keywords);
    const fontSize = S(randRange(...CONFIG.font.keyword));
    for (let attempt = 0; attempt < 20; attempt++) {
      const anchor = pickAnchor();
      const x = Math.max(CONFIG.padding.x, Math.min(viewWidth - CONFIG.padding.x - 200, anchor.x - 80));
      const y = snapY(Math.max(CONFIG.padding.y, Math.min(viewHeight - CONFIG.padding.y - fontSize, anchor.y)));
      const el = makeText('keyword', content, x, y, fontSize);
      if (isTextOverlap(el.x, el.y, el.w, el.h, 8)) continue;
      elements.push(el);
      if (Math.random() < CONFIG.blockProbabilities.highlight * 0.55) elements.push(makeHighlightBlockFor(el));
      pushAdjacentBlocksFor(el);
      return;
    }
  }

  function spawnStandaloneBlock() {
    if (elements.length >= density.maxActive) return;
    if (Math.random() >= CONFIG.blockProbabilities.standalone * 4) return; // very rare — text dominant
    const w = randRange(...CONFIG.blockSize.width) * density.sizeScale;
    const h = randRange(...CONFIG.blockSize.height);
    const x = randRange(CONFIG.padding.x, Math.max(CONFIG.padding.x + 1, viewWidth - w - CONFIG.padding.x));
    const y = snapY(randRange(CONFIG.padding.y, Math.max(CONFIG.padding.y + 1, viewHeight - h - CONFIG.padding.y)));
    elements.push(makeBlock('standalone', x, y, w, h, pickBlockColor()));
  }

  // ─────────────────────────────────────────────────────────
  // Drift + opacity update
  // ─────────────────────────────────────────────────────────
  function updatePhysics(dtFrames) {
    for (const el of elements) {
      el.x += el.vx * dtFrames;
      el.y += el.vy * dtFrames;
    }
  }

  function computeOpacity(el, now) {
    const age = now - el.bornAt;
    const fin = CONFIG.fadeMs.in;
    const fout = CONFIG.fadeMs.out;
    let phase = 1;
    if (age < fin) phase = age / fin;
    else if (age > el.lifetime - fout) phase = Math.max(0, 1 - (age - (el.lifetime - fout)) / fout);
    return phase * el.targetOpacity;
  }

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────
  function render(now) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = CONFIG.colors.darkBackground;
    ctx.fillRect(0, 0, viewWidth, viewHeight);

    // Layered draw — sort once per frame (small N)
    elements.sort((a, b) => a.layer - b.layer);

    for (const el of elements) {
      const op = computeOpacity(el, now);
      if (op <= 0.001) continue;
      ctx.globalAlpha = Math.min(1, op * CONFIG.opacity.canvasGlobal);

      if (el.kind === 'block') {
        ctx.fillStyle = el.color;
        ctx.fillRect(el.x, el.y, el.w, el.h);
      } else if (el.kind === 'text') {
        ctx.fillStyle = el.textColor || CONFIG.colors.textOnDark;
        ctx.font = `${el.fontSize}px ${CONFIG.font.family}`;
        ctx.textBaseline = 'top';
        let tx = el.x;
        let ty = el.y;
        if (el.glitch && (now - el.bornAt) < el.glitch.durationMs) tx += el.glitch.offsetX;

        // Typing reveal — fragments grow letter-by-letter; keywords appear whole
        let visible = el.content;
        if (el.typeDurationMs > 0) {
          const t = (now - el.bornAt) / el.typeDurationMs;
          if (t < 1) {
            const charsVisible = Math.max(1, Math.floor(el.content.length * t));
            visible = el.content.slice(0, charsVisible);
          }
        }

        if (el.letterSpacing > 0) {
          let cx = tx;
          for (const ch of visible) {
            ctx.fillText(ch, cx, ty);
            cx += ctx.measureText(ch).width + el.letterSpacing;
          }
        } else {
          ctx.fillText(visible, tx, ty);
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // ─────────────────────────────────────────────────────────
  // Loop
  // ─────────────────────────────────────────────────────────
  function tick(now) {
    if (!isVisible) { rafId = null; return; }
    const dt = lastFrameTime ? Math.min(2, (now - lastFrameTime) / 16.6667) : 1;
    lastFrameTime = now;

    // Cull
    elements = elements.filter(el => (now - el.bornAt) < el.lifetime);

    // Ensure minimum density — spawn aggressively if below floor
    const minA = density.minActive || 0;
    if (minA > 0 && elements.length < minA) {
      let safety = 0;
      while (elements.length < minA && safety < 12) {
        if (Math.random() < 0.72) spawnSentenceCluster();
        else spawnKeyword();
        safety++;
      }
    }

    // Schedulers
    if (now >= nextSentenceAt) {
      spawnSentenceCluster();
      nextSentenceAt = now + randRange(...CONFIG.intervals.sentenceMs);
    }
    if (now >= nextKeywordAt) {
      spawnKeyword();
      nextKeywordAt = now + randRange(...CONFIG.intervals.keywordMs);
    }
    if (now >= nextStandaloneAt) {
      spawnStandaloneBlock();
      nextStandaloneAt = now + randRange(...CONFIG.intervals.standaloneBlockMs);
    }

    // Update + render
    updatePhysics(dt);
    render(now);
    rafId = requestAnimationFrame(tick);
  }

  // ─────────────────────────────────────────────────────────
  // Resize / DPR
  // ─────────────────────────────────────────────────────────
  function applySize() {
    const rect = canvas.getBoundingClientRect();
    viewWidth = Math.max(1, rect.width);
    viewHeight = Math.max(1, rect.height);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(viewWidth * dpr);
    canvas.height = Math.round(viewHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (viewWidth < 600) density = CONFIG.density.mobile;
    else if (viewWidth < 1000) density = CONFIG.density.tablet;
    else density = CONFIG.density.desktop;
  }

  function debounceResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      applySize();
      elements = elements.filter(el => el.x < viewWidth + 80 && el.y < viewHeight + 80);
    }, 150);
  }

  // ─────────────────────────────────────────────────────────
  // Visibility
  // ─────────────────────────────────────────────────────────
  function activate() {
    if (rafId || !isVisible) return;
    const now = performance.now();
    lastFrameTime = now;
    // pre-spawn 1 cluster so something is visible immediately
    if (elements.length === 0) spawnSentenceCluster();
    nextSentenceAt   = now + 400;
    nextKeywordAt    = now + 1200;
    nextStandaloneAt = now + 700;
    rafId = requestAnimationFrame(tick);
  }

  const intersectionObs = new IntersectionObserver((entries) => {
    for (const e of entries) {
      isVisible = e.isIntersecting;
      if (isVisible) activate();
    }
  }, { threshold: 0.05 });

  // ResizeObserver — re-measure when CSS finishes loading or section resizes
  if (typeof ResizeObserver !== 'undefined') {
    const resizeObs = new ResizeObserver(() => {
      const prevW = viewWidth, prevH = viewHeight;
      applySize();
      // First real layout — canvas went from tiny to real size — restart
      if (prevW < 100 && viewWidth >= 100) {
        elements = [];
        recentAnchors = [];
        lastFrameTime = 0;
        isVisible = true;
        activate();
      }
    });
    resizeObs.observe(canvas);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { isVisible = false; }
    else { isVisible = true; activate(); }
  });

  window.addEventListener('resize', debounceResize);

  // ─────────────────────────────────────────────────────────
  // Reduced motion — static snapshot
  // ─────────────────────────────────────────────────────────
  function staticSnapshot() {
    applySize();
    // Sparse mix of keywords + fragments
    const target = CONFIG.reducedMotion.snapshotCount;
    let attempts = 0;
    while (elements.length < target && attempts < target * 4) {
      attempts++;
      const roll = Math.random();
      if (roll < 0.30) spawnKeyword();
      else if (roll < 0.85) spawnSentenceCluster();
      else spawnStandaloneBlock();
    }
    // Freeze: full opacity, no drift, infinite lifetime
    for (const el of elements) {
      el.vx = 0; el.vy = 0;
      el.bornAt = performance.now() - CONFIG.fadeMs.in;
      el.lifetime = Number.MAX_SAFE_INTEGER;
      el.glitch = null;
    }
    render(performance.now());
  }

  // ─────────────────────────────────────────────────────────
  // Async text pool loader — overrides inline CONFIG.phrases / .keywords
  // ─────────────────────────────────────────────────────────
  async function loadTextPool() {
    const candidates = ['assets/data/text-pool.json', '/assets/data/text-pool.json', '/files/text-pool.json'];
    for (const url of candidates) {
      try {
        const r = await fetch(url, { cache: 'no-cache' });
        if (!r.ok) continue;
        const data = await r.json();
        if (Array.isArray(data.phrases) && data.phrases.length)   CONFIG.phrases  = data.phrases;
        if (Array.isArray(data.keywords) && data.keywords.length) CONFIG.keywords = data.keywords;
        console.log('[AboutBg] text-pool loaded from', url, '·',
          CONFIG.phrases.length, 'phrases ·', CONFIG.keywords.length, 'keywords');
        return;
      } catch (e) { /* try next */ }
    }
  }

  // ─────────────────────────────────────────────────────────
  // Init
  // ─────────────────────────────────────────────────────────
  function init() {
    applySize();
    intersectionObs.observe(canvas);
    if (prefersReducedMotion && CONFIG.reducedMotion.enabled) {
      staticSnapshot();
      return;
    }
    // Optimistic start — IntersectionObserver will pause if actually off-screen
    isVisible = true;
    activate();
    // Async load — replaces inline pool when ready; ongoing spawns pick up new entries automatically
    loadTextPool();
    console.log('[AboutBg] init complete · canvas size:', viewWidth, 'x', viewHeight);
  }

  // Expose for runtime tuning from devtools
  window.AboutBg = {
    CONFIG,
    restart: () => { elements = []; recentAnchors = []; lastFrameTime = 0; }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
