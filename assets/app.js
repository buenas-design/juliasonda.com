/* juliasonda.com · v6
   Pages arrive as finished HTML (scripts/build.mjs). This file only adds
   behavior: header + mobile menu, things appearing as you scroll, photos
   drifting at different speeds, the testimonial slider, the fun facts
   cards that flip over and the contact form. */

(() => {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ───────── header ───────── */
  const hdr = $('#hdr');
  const onScroll = () => hdr && hdr.classList.toggle('is-solid', window.scrollY > 40);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const menuBtn = $('#menu-btn');
  const setMenu = (open) => {
    document.body.classList.toggle('menu-open', open);
    menuBtn?.setAttribute('aria-expanded', String(open));
  };
  menuBtn?.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  $$('#nav a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  window.addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));

  /* ───────── appear on scroll ───────── */
  // Titles (data-reveal="title"): each word sits in a mask and slides up on its own.
  // Words keep their italic/highlight tags; the highlighter then "draws" across.
  if (!reduceMotion) {
    $$('[data-reveal="title"]').forEach((el) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const texts = [];
      while (walker.nextNode()) texts.push(walker.currentNode);
      let i = 0;
      texts.forEach((node) => {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.append(part);
          const mask = document.createElement('span');
          mask.className = 'w';
          const word = document.createElement('span');
          word.className = 'w__i';
          word.style.setProperty('--i', String(i++));
          word.textContent = part;
          mask.append(word);
          frag.append(mask);
        });
        node.replaceWith(frag);
      });
    });
  }

  const reveal = $$('[data-reveal]');
  // A picture hidden behind its curtain (clip-path at 100%) has no visible area, so the
  // observer would never see it: pictures are watched through their parent instead.
  const groups = new Map(); // watched element → elements to reveal
  reveal.forEach((el) => {
    const target = el.tagName === 'IMG' && el.dataset.reveal === 'img' ? el.parentElement : el;
    if (!groups.has(target)) groups.set(target, []);
    groups.get(target).push(el);
  });
  const show = (target, order) =>
    (groups.get(target) || []).forEach((el, k) => {
      el.style.setProperty('--d', `${Math.min((order + k) * 0.09, 0.55)}s`);
      el.classList.add('is-in');
    });

  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveal.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        // things that come into view together appear one after another
        entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left)
          .forEach((e, i) => {
            show(e.target, i);
            io.unobserve(e.target);
          });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.06 },
    );
    groups.forEach((_, target) => io.observe(target));
    // Safety net: whatever is already on screen shows up even if the observer is late
    // (background tabs, slow devices).
    setTimeout(() => {
      let i = 0;
      groups.forEach((els, target) => {
        if (els.every((el) => el.classList.contains('is-in'))) return;
        const r = target.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) {
          show(target, i++);
          io.unobserve(target);
        }
      });
    }, 600);
  }

  /* ───────── photos drifting at their own speed (data-speed) ───────── */
  const drifting = $$('[data-speed]');
  // rows of project images that slide sideways (data-drift="-1" or "1")
  const sliding = $$('[data-drift]');
  // floating photos that drift to their side and tilt as their section passes (data-sway="-1" or "1")
  const swaying = $$('[data-sway]');
  if (!reduceMotion && (drifting.length || sliding.length || swaying.length)) {
    let queued = false;
    const update = () => {
      queued = false;
      const mid = window.innerHeight / 2;
      for (const el of sliding) {
        const r = (el.closest('section') || el.parentElement).getBoundingClientRect();
        if (r.bottom < -200 || r.top > window.innerHeight + 200) continue;
        const offset = r.top + r.height / 2 - mid;
        el.style.setProperty('--px', `${(offset * 0.35 * Number(el.dataset.drift)).toFixed(1)}px`);
      }
      // hero photos spread apart (and tilt a little) as the hero scrolls away
      for (const el of $$('[data-side]')) {
        const hero = el.closest('section').getBoundingClientRect();
        const p = Math.min(Math.max(-hero.top / hero.height, 0), 1);
        const side = Number(el.dataset.side);
        el.style.setProperty('--sx', `${(p * window.innerWidth * 0.22 * side).toFixed(1)}px`);
        el.style.setProperty('--rot', `${(p * 7 * side).toFixed(2)}deg`);
      }
      for (const el of swaying) {
        const r = el.closest('section').getBoundingClientRect();
        if (r.bottom < -200 || r.top > window.innerHeight + 200) continue;
        const offset = (r.top + r.height / 2 - mid) / window.innerHeight; // about -1 … 1
        const side = Number(el.dataset.sway);
        el.style.setProperty('--sx', `${(-offset * window.innerWidth * 0.07 * side).toFixed(1)}px`);
        el.style.setProperty('--rot', `${(-offset * 6 * side).toFixed(2)}deg`);
      }
      for (const el of drifting) {
        // measure the section, not the photo, so the photo's own movement doesn't feed back
        const host = el.closest('section') || el.parentElement;
        const r = host.getBoundingClientRect();
        if (r.bottom < -200 || r.top > window.innerHeight + 200) continue;
        const offset = r.top + r.height / 2 - mid;
        el.style.setProperty('--py', `${(-offset * Number(el.dataset.speed)).toFixed(1)}px`);
      }
    };
    const queue = () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
    update();
  }

  /* ───────── "your agency" types itself again as "your studio", "your team"… ───────── */
  // Words come from site.typewriter (site.yml), passed on the header as data-tw, unless the title
  // brings its own list (data-tw-words, e.g. the CV). Screen readers keep the original words; only
  // the visible copy changes.
  const siteWords = ($('#hdr')?.dataset.tw || '').split('|').filter(Boolean);
  $$('.tw').forEach((m) => {
    const own = (m.closest('[data-tw-words]')?.dataset.twWords || '').split('|').filter(Boolean);
    const twWords = own.length > 1 ? own : siteWords;
    if (twWords.length < 2) return;
    m.setAttribute('aria-hidden', 'true');
    // reserve the width of the longest word, so typing never pushes the rest of the title around
    // (measured once the title has finished appearing, and again when the window changes size)
    const fit = () => {
      const keep = m.textContent;
      m.style.width = '';
      m.style.display = 'inline-block';
      let w = 0;
      for (const word of twWords) { m.textContent = word; w = Math.max(w, m.getBoundingClientRect().width); }
      m.textContent = keep;
      m.style.display = '';
      m.style.width = `${Math.ceil(w)}px`;
    };
    window.addEventListener('resize', fit);
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = twWords[0];
    m.after(sr);
    if (reduceMotion) return;
    let k = 0;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const run = async () => {
      await wait(3200); // let the title appear first
      fit();
      for (;;) {
        const next = twWords[(k + 1) % twWords.length];
        let text = m.textContent;
        while (text.length) { text = text.slice(0, -1); m.textContent = text; await wait(55); }
        await wait(250);
        for (const ch of next) { text += ch; m.textContent = text; await wait(95); }
        k = (k + 1) % twWords.length;
        await wait(2200);
      }
    };
    run();
  });

  /* ───────── CV timeline: the big year follows the step in the middle of the screen ───────── */
  // and the line fills up to the middle of the screen, lighting each dot it passes (--fill, .is-lit)
  const steps = $('.cv-steps');
  if (steps) {
    const items = $$('[data-year]', steps);
    const yearEl = $('.cv-year__n');
    let shown = yearEl?.textContent || '';
    const setYear = (y) => {
      if (!yearEl || y === shown) return;
      shown = y;
      yearEl.textContent = y;
      yearEl.classList.remove('is-flip');
      void yearEl.offsetWidth; // restart the animation
      yearEl.classList.add('is-flip');
    };
    let queuedSteps = false;
    const paintSteps = () => {
      queuedSteps = false;
      const mid = window.innerHeight * 0.55;
      const r = steps.getBoundingClientRect();
      steps.style.setProperty('--fill', Math.min(Math.max((mid - r.top) / r.height, 0), 1).toFixed(3));
      let current = items[0];
      for (const el of items) {
        const lit = el.getBoundingClientRect().top < mid;
        el.classList.toggle('is-lit', lit);
        if (lit) current = el;
      }
      if (current) setYear(current.dataset.year);
    };
    const queueSteps = () => {
      if (!queuedSteps) { queuedSteps = true; requestAnimationFrame(paintSteps); }
    };
    window.addEventListener('scroll', queueSteps, { passive: true });
    window.addEventListener('resize', queueSteps);
    paintSteps();
  }

  /* ───────── text that fades away as it scrolls up (data-scroll-fade, About "How I work") ───────── */
  // Each block keeps its full colour until its bottom passes the upper half of the screen; then a gradient
  // climbs over it from the bottom (her reference: Cember Studio's About). The next one is already rising in.
  const fading = $$('[data-scroll-fade] > p'); // the paragraphs, not the title
  if (fading.length && !reduceMotion) {
    let queuedFade = false;
    const paintFade = () => {
      queuedFade = false;
      const vh = window.innerHeight;
      for (const el of fading) {
        const r = el.getBoundingClientRect();
        // 0 while its bottom is below 45% of the screen, 1 once it reaches 10%
        el.style.setProperty('--fade', Math.min(Math.max((vh * 0.45 - r.bottom) / (vh * 0.35), 0), 1).toFixed(3));
      }
    };
    const queueFade = () => {
      if (!queuedFade) { queuedFade = true; requestAnimationFrame(paintFade); }
    };
    window.addEventListener('scroll', queueFade, { passive: true });
    window.addEventListener('resize', queueFade);
    paintFade();
  }

  /* ───────── Work: the mosaic opens up as you scroll (data-mosaic) ───────── */
  // It starts zoomed in on the middle picture (filling the screen) and shrinks back to the whole mosaic
  // while its section passes; the section is taller than the screen and the mosaic stays put (sticky).
  // The mosaic is laid out at the big size and scaled DOWN (not a small one scaled up), so the
  // pictures are drawn at full size and stay sharp while zoomed in (her note, 02/11/2026).
  const mosaic = $('[data-mosaic]');
  if (mosaic && !reduceMotion) {
    const stick = $('.mosaic__stick', mosaic);
    const grid = $('.mosaic__grid', mosaic);
    const center = $('.mosaic__tile--center', mosaic);
    let zoom = 1;
    const measure = () => {
      Object.assign(grid.style, { transform: 'none', width: '', height: '', left: '', top: '' });
      grid.style.removeProperty('--g');
      const g = grid.getBoundingClientRect();
      const c = center.getBoundingClientRect();
      zoom = Math.max(g.width / c.width, g.height / c.height) * 1.04; // the middle picture covers the screen
      const gap = parseFloat(getComputedStyle(grid).getPropertyValue('--g')) || 12;
      const cx = (c.left - g.left + c.width / 2) * zoom;
      const cy = (c.top - g.top + c.height / 2) * zoom;
      const s = stick.getBoundingClientRect();
      Object.assign(grid.style, { width: `${g.width * zoom}px`, height: `${g.height * zoom}px`, left: `${s.width / 2 - cx}px`, top: `${s.height / 2 - cy}px`, transformOrigin: `${cx}px ${cy}px` });
      grid.style.setProperty('--g', `${gap * zoom}px`);
    };
    let queuedMosaic = false;
    const paintMosaic = () => {
      queuedMosaic = false;
      const r = mosaic.getBoundingClientRect();
      const p = Math.min(Math.max(-r.top / (r.height - window.innerHeight), 0), 1);
      const eased = 1 - (1 - p) ** 2;
      grid.style.transform = `scale(${(1 + (1 / zoom - 1) * eased).toFixed(4)})`;
    };
    const queueMosaic = () => {
      if (!queuedMosaic) { queuedMosaic = true; requestAnimationFrame(paintMosaic); }
    };
    window.addEventListener('scroll', queueMosaic, { passive: true });
    window.addEventListener('resize', () => { measure(); queueMosaic(); });
    measure();
    paintMosaic();
  }

  /* ───────── industry cards: project pictures take turns while hovered ───────── */
  $$('.ind__card').forEach((card) => {
    const pics = $$('.ind__pics img', card);
    if (!pics.length) return;
    pics[0].classList.add('is-on');
    let k = 0, timer = null;
    card.addEventListener('mouseenter', () => {
      if (reduceMotion || pics.length < 2) return;
      timer = setInterval(() => {
        pics[k].classList.remove('is-on');
        k = (k + 1) % pics.length;
        pics[k].classList.add('is-on');
      }, 900);
    });
    card.addEventListener('mouseleave', () => clearInterval(timer));
  });

  /* ───────── page colour changes while scrolling ───────── */
  // Each section names its colour (data-tone). One gradient runs down the whole page: every tone
  // sits in the middle of its section and blends slowly into the next one, with no hard edges.
  const tones = $$('[data-tone]');
  const paintPage = () => {
    const stops = tones.map((el) => {
      const r = el.getBoundingClientRect();
      return `var(--tone-${el.dataset.tone}) ${Math.round(r.top + window.scrollY + r.height / 2)}px`;
    });
    const first = `var(--tone-${tones[0].dataset.tone})`;
    document.body.style.setProperty('--page-gradient', `linear-gradient(180deg in oklab, ${first} 0px, ${stops.join(', ')})`);
  };
  if (tones.length) {
    let queuedPaint = false;
    const queuePaint = () => {
      if (queuedPaint) return;
      queuedPaint = true;
      requestAnimationFrame(() => { queuedPaint = false; paintPage(); });
    };
    paintPage();
    // sections change height while images load, accordions open, the window resizes...
    if ('ResizeObserver' in window) new ResizeObserver(queuePaint).observe(document.body);
    window.addEventListener('load', queuePaint);
  }
  if (tones.length && 'IntersectionObserver' in window) {
    const toneIo = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) document.documentElement.style.setProperty('--page-bg', `var(--tone-${e.target.dataset.tone})`);
        }),
      { rootMargin: '-48% 0px -50% 0px' },
    );
    tones.forEach((el) => toneIo.observe(el));
  }

  /* ───────── testimonials: one row that slides sideways ───────── */
  const qcards = $('#qcards');
  if (qcards) {
    const step = () => (qcards.querySelector('.qcard')?.offsetWidth || 400) + 24;
    $$('[data-qdir]').forEach((b) =>
      b.addEventListener('click', () => qcards.scrollBy({ left: step() * Number(b.dataset.qdir), behavior: reduceMotion ? 'auto' : 'smooth' })),
    );
    // endless row: a copy of the cards on each side, and when the row drifts into a copy it jumps back
    // by exactly one set (same cards, same spot), so after the last testimonial the first one comes again
    const originals = $$('.qcard', qcards);
    const copyOf = (card) => {
      const c = card.cloneNode(true);
      c.removeAttribute('data-reveal');
      c.classList.add('is-in');
      c.setAttribute('aria-hidden', 'true');
      return c;
    };
    if (originals.length > 1) {
      originals.forEach((card) => qcards.append(copyOf(card)));
      [...originals].reverse().forEach((card) => qcards.prepend(copyOf(card)));
    }
    const setWidth = () => (originals.length > 1 ? qcards.children[originals.length * 2].offsetLeft - originals[0].offsetLeft : 0);
    let startX = 0, startLeft = 0, dragging = false;
    const recenter = () => {
      const w = setWidth();
      if (!w) return;
      let shift = 0;
      if (qcards.scrollLeft < w * 0.5) shift = w;
      else if (qcards.scrollLeft > w * 1.5) shift = -w;
      if (!shift) return;
      qcards.style.scrollSnapType = 'none';
      qcards.scrollLeft += shift;
      startLeft += shift;
      qcards.style.scrollSnapType = '';
    };
    if (originals.length > 1) {
      qcards.scrollLeft = setWidth();
      let settle = null;
      qcards.addEventListener('scroll', () => {
        clearTimeout(settle);
        // close to either end (a long flick): jump right away; otherwise wait until the row stops
        const room = qcards.scrollWidth - qcards.clientWidth - qcards.scrollLeft;
        if (qcards.scrollLeft < setWidth() * 0.25 || room < setWidth() * 0.25) recenter();
        else settle = setTimeout(recenter, 140);
      }, { passive: true });
      window.addEventListener('resize', () => { qcards.scrollLeft = setWidth() + (qcards.scrollLeft % setWidth()); });
    }
    // drag with the mouse (touch already scrolls on its own)
    qcards.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      dragging = true; startX = e.clientX; startLeft = qcards.scrollLeft;
      qcards.classList.add('is-dragging');
    });
    window.addEventListener('pointermove', (e) => { if (dragging) qcards.scrollLeft = startLeft - (e.clientX - startX); });
    window.addEventListener('pointerup', () => {
      if (!dragging) return;
      dragging = false;
      qcards.classList.remove('is-dragging');
    });
  }

  /* ───────── testimonials: one at a time (old layout, kept in case it comes back) ───────── */
  const quotes = $('#quotes');
  const quoteNav = $('#quotes-nav');
  if (quotes && quoteNav) {
    const list = $$('.quote', quotes);
    if (list.length > 1) {
      quotes.closest('.quotes').classList.add('is-slider');
      quoteNav.hidden = false;
      const bars = $$('.quotes__bar span', quoteNav);
      let current = 0;
      const show = (k) => {
        current = (k + list.length) % list.length;
        list.forEach((q, j) => {
          q.classList.toggle('is-active', j === current);
          q.setAttribute('aria-hidden', String(j !== current));
        });
        bars.forEach((b, j) => b.classList.toggle('is-on', j === current));
      };
      $$('[data-q]', quoteNav).forEach((b) => b.addEventListener('click', () => show(current + Number(b.dataset.q))));
      show(0);
    }
  }

  /* ───────── About page: fun facts flip over ───────── */
  // On a computer the card turns while the mouse is over it (CSS); on a phone a tap turns it.
  $$('.fun__card').forEach((card) => {
    card.addEventListener('click', () => card.classList.toggle('is-open'));
    card.addEventListener('mouseleave', () => card.classList.remove('is-open'));
  });

  /* ───────── contact form ───────── */
  const form = $('#contact-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const status = $('#form-status');
    status.className = 'form__status';
    status.textContent = '';

    let firstBad = null;
    ['#f-name', '#f-email'].map((s) => $(s, form)).forEach((input) => {
      const bad = !input.value.trim() || (input.type === 'email' && !input.checkValidity());
      input.setAttribute('aria-invalid', String(bad));
      if (bad && !firstBad) firstBad = input;
    });
    if (firstBad) {
      status.textContent = form.dataset.error;
      status.classList.add('is-error');
      firstBad.focus();
      return;
    }

    const fd = new FormData(form);
    // the boxes ticked under "What are you looking for help with?" go as one line
    const needs = fd.getAll('needs');
    fd.delete('needs');
    fd.append('needs', needs.join(', ') || '-');
    const done = () => {
      $('#form-fields').hidden = true;
      form.classList.add('is-sent');
      const box = $('#form-done');
      box.hidden = false;
      box.focus();
    };
    // If sending fails, say so and show the address (the visitor's email app never opens by itself).
    const failed = () => {
      status.textContent = `${form.dataset.fallback} `;
      const a = document.createElement('a');
      a.href = `mailto:${form.dataset.email}`;
      a.textContent = form.dataset.email;
      status.append(a, '.');
      status.classList.add('is-error');
    };

    // The message goes straight to Julia's inbox through FormSubmit (contact.form_endpoint).
    const endpoint = (form.dataset.endpoint || '').trim();
    if (!endpoint) return failed();
    const btn = form.querySelector('[type="submit"]');
    btn.disabled = true;
    try {
      const res = await fetch(endpoint, { method: 'POST', body: fd, headers: { Accept: 'application/json' } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || String(data.success) === 'false') throw new Error(data.message || String(res.status));
      form.reset();
      done();
    } catch {
      failed();
    } finally {
      btn.disabled = false;
    }
  });

  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
