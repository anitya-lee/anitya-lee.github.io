/* ============================================================
   Hero typing animation
   ============================================================ */

(function () {
  const hero = document.getElementById('hero');
  if (!hero) return;

  const originalHTML = hero.innerHTML;
  let activeTimers = [];
  let caret = null;

  function runTyping() {
    activeTimers.forEach(t => clearTimeout(t));
    activeTimers = [];
    if (caret) caret.remove();
    hero.innerHTML = originalHTML;

    const wrapperData = new Map();
    const allChars = [];

    function walk(el) {
      if (
        el.classList && (
          el.classList.contains('kw-tech') ||
          el.classList.contains('kw-human') ||
          el.classList.contains('kw-q')
        )
      ) {
        el.classList.add('hide-frame');
      }
      for (const node of [...el.childNodes]) {
        if (node.nodeType === 3) {
          const text = node.textContent;
          const frag = document.createDocumentFragment();
          for (const ch of text) {
            const span = document.createElement('span');
            span.className = 'tchar';
            if (ch === ' ') span.innerHTML = '&nbsp;';
            else span.textContent = ch;
            const wrapper = el.closest && el.closest('.kw-tech, .kw-human, .kw-q');
            allChars.push({ span, wrapper });
            if (wrapper) {
              if (!wrapperData.has(wrapper)) wrapperData.set(wrapper, { total: 0, typed: 0 });
              wrapperData.get(wrapper).total++;
            }
            frag.appendChild(span);
          }
          node.parentNode.replaceChild(frag, node);
        } else if (node.nodeType === 1 && node.tagName !== 'BR') {
          walk(node);
        }
      }
    }
    walk(hero);

    const stepMs = 40;
    allChars.forEach((item, i) => {
      const t = setTimeout(() => {
        item.span.classList.add('show');
        if (item.wrapper) {
          const data = wrapperData.get(item.wrapper);
          data.typed++;
          if (data.typed === 1) {
            if (item.wrapper.classList.contains('kw-human')) {
              const sweepDur = data.total * stepMs;
              item.wrapper.style.setProperty('--sweep-dur', sweepDur + 'ms');
              item.wrapper.classList.add('sweeping');
            } else {
              item.wrapper.classList.remove('hide-frame');
            }
          }
        }
        if (caret) caret.remove();
        caret = document.createElement('span');
        caret.className = 'caret';
        item.span.appendChild(caret);
      }, 350 + i * stepMs);
      activeTimers.push(t);
    });
  }

  // Expose to global so the replay button can call it
  window.runTyping = runTyping;

  // Run on load
  window.addEventListener('load', () => setTimeout(runTyping, 200));
})();
