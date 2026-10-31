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

  /* ───────── photos follow the mouse ───────── */
  // Each photo moves with the cursor by its own amount (some the other way), so they feel layered.
  // Used by the hero and by any photo group marked data-follow (About, home "about me").
  const follow = (area, photos, depth) => {
    area.addEventListener('mousemove', (e) => {
      const r = area.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      photos.forEach((img, i) => {
        const d = depth[i % depth.length];
        img.style.setProperty('--mx', `${(x * d * 1.6).toFixed(1)}px`);
        img.style.setProperty('--my', `${(y * d).toFixed(1)}px`);
      });
    });
    area.addEventListener('mouseleave', () =>
      photos.forEach((img) => {
        img.style.setProperty('--mx', '0px');
        img.style.setProperty('--my', '0px');
      }),
    );
  };
  if (!reduceMotion && window.matchMedia('(hover: hover)').matches) {
    const hero = $('.hero');
    if (hero) follow(hero, $$('.hero .hp'), [26, -20, 16, -30]);
    $$('[data-follow]').forEach((box) => follow(box.closest('section') || box, $$('img', box), [18, -14]));
  }

  /* ───────── testimonials: one row that slides sideways ───────── */
  const qcards = $('#qcards');
  if (qcards) {
    const step = () => (qcards.querySelector('.qcard')?.offsetWidth || 400) + 24;
    $$('[data-qdir]').forEach((b) =>
      b.addEventListener('click', () => qcards.scrollBy({ left: step() * Number(b.dataset.qdir), behavior: reduceMotion ? 'auto' : 'smooth' })),
    );
    // drag with the mouse (touch already scrolls on its own)
    let startX = 0, startLeft = 0, dragging = false;
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
