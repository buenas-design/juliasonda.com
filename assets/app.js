/* juliasonda.com · v6
   Pages arrive as finished HTML (scripts/build.mjs). This file only adds
   behavior: header + mobile menu, things appearing as you scroll, photos
   drifting at different speeds, the scroll-driven About sections, the
   testimonial slider and the contact form. */

(() => {
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = document.documentElement.classList.contains('save-data');
  // the full video only for a box wider than 640px on a screen at least 540px tall (a computer or a tablet); a phone,
  // standing or lying down, gets the light copy (hero-card.mp4)
  const bigBox = (v) => v.parentElement.clientWidth > 640 && window.innerHeight >= 540;

  // A project that opens with a video (render.mjs → moduleImg) plays it by itself, silent and in a loop, but the
  // same way as the covers below: only while it is on screen, and nothing downloads before that (preload="none"). On
  // a phone it plays the light copy (data-small-src). With "reduce motion" or the data saver it doesn't play by
  // itself: it stays on its first frame, with the controls to play it.
  $$('.pm video[data-autoplay]').forEach((v) => {
    if (v.dataset.smallSrc && !bigBox(v)) v.src = v.dataset.smallSrc;
    if (reduceMotion || saveData) { v.removeAttribute('data-autoplay'); v.controls = true; }
  });

  // A project's video is also its cover (cards, "Next project", Work panels; render.mjs → coverVideo, her request
  // 04/11/2026). Cards and "Next project" have the light copy (hero-card.mp4, ~2.5 MB); a big box (bigBox: the big
  // card on the home, on a computer) switches to the full video (data-big-src) at load, before anything plays. A
  // Work panel's video has its files in data-src/data-poster and gets them a screen before the panel comes into view,
  // and only where the CSS shows it (PANEL_VIDEO: a wide screen that fits the whole panel; on a phone her photo
  // stays). preload="none": nothing downloads until play(), which waits until at least 40% of the box has been on
  // screen for 0.6s, so a cover that only flies past while scrolling never loads (the poster is the video's first
  // frame, so the wait doesn't show).
  // Once a video has started, the browser keeps downloading the rest even while it is paused off screen (that is why
  // the cards get the light copy). Never plays with "reduce motion" or the data saver (save-data, head.html): the
  // first frame stays.
  const coverVideos = $$('video[data-autoplay]');
  const PANEL_VIDEO = '(min-aspect-ratio: 5/4) and (min-height: 540px)'; // same as styles.css (.panel__img video)
  const shown = (v) => v.offsetWidth > 0; // a panel's video is display: none where her photo stays
  const prepare = (v) => {
    if (saveData || !shown(v)) return;
    const d = v.dataset;
    if (d.bigSrc && bigBox(v)) { v.poster = d.bigPoster; v.src = d.bigSrc; }
    if (d.src) { v.poster = d.poster; v.src = d.src; }
    ['bigSrc', 'bigPoster', 'src', 'poster'].forEach((k) => delete d[k]); // decided once
  };
  // muted again from here too: iPhones only let a video play by itself when it is muted at play()
  coverVideos.forEach((v) => { v.muted = true; if (!v.dataset.src) prepare(v); });
  if (coverVideos.length && !reduceMotion && !saveData && 'IntersectionObserver' in window) {
    const SHOW = 0.4; // share of the box on screen before it plays
    // ...except a project page's own video, which on a short screen is only partly in view at the top of the page
    const need = (v) => (v.closest('.pm') ? 0.1 : SHOW);
    const seen = new Set(); // covers at least that much on screen
    const waiting = new Map(); // cover → timer before it plays
    // The Work panels stack (sticky), so a panel hidden under the next one is still on screen for the observer:
    // it counts as hidden once less than 48px of it shows above the next panel (at the end of the list the one
    // before the last is pushed up with it, 24px apart, so "reached its top" is never exact)
    const covered = (v) => {
      const panel = v.closest('.panel');
      const next = panel?.nextElementSibling;
      return Boolean(next) && next.getBoundingClientRect().top - Math.max(panel.getBoundingClientRect().top, 0) < 48;
    };
    const onScreen = (v) => seen.has(v) && shown(v) && !covered(v);
    // An iPhone in Low Power Mode (the yellow battery) never lets a video start by itself, not even a silent one: the
    // project's video stayed on its first frame until she pressed play (her report, 05/11/2026). So when the phone
    // refuses, the videos on screen start at the first tap on the page, which the phone takes as the person asking
    // for it (a swipe doesn't count): right then, without the 0.6s wait, or the tap no longer counts. Until then the
    // poster shows (no autoplay attribute anywhere: with it the iPhone puts its big play button over the video).
    // An app that opens links in a bare web view (no inline video) would open the phone's full-screen player on that
    // tap: then it leaves full screen and the videos stay on their posters for the rest of the visit.
    const touches = ['touchend', 'pointerup', 'click', 'keydown'];
    let touchWatch = false;
    let noInline = false;
    const wakeUp = () => seen.forEach((v) => { if (!noInline && onScreen(v) && v.paused) { prepare(v); v.play()?.catch(() => {}); } });
    const play = (v) => noInline || v.play()?.catch((e) => {
      if (touchWatch || noInline || e?.name !== 'NotAllowedError') return;
      touchWatch = true;
      touches.forEach((t) => document.addEventListener(t, wakeUp, { capture: true, passive: true }));
    });
    const leaveFullScreen = (e) => {
      const v = e.target;
      noInline = true;
      touches.forEach((t) => document.removeEventListener(t, wakeUp, { capture: true }));
      v.pause();
      try { v.webkitExitFullscreen?.(); } catch { /* already out */ }
    };
    coverVideos.forEach((v) => v.addEventListener('webkitbeginfullscreen', leaveFullScreen));
    const syncCover = (v) => {
      if (!onScreen(v)) {
        clearTimeout(waiting.get(v));
        waiting.delete(v);
        if (!v.paused) v.pause();
        return;
      }
      if (!v.paused || waiting.has(v)) return;
      waiting.set(v, setTimeout(() => {
        waiting.delete(v);
        if (!onScreen(v)) return;
        prepare(v);
        play(v); // blocked (iPhone in Low Power Mode): it starts at the first touch (wakeUp)
      }, 600));
    };
    // watched through the box around it: its curtain (data-reveal="img", clip-path) would hide it from the observer
    const videoOf = new Map(coverVideos.map((v) => [v.parentElement, v]));
    const coverIo = new IntersectionObserver((entries) =>
      entries.forEach((e) => {
        const v = videoOf.get(e.target);
        if (e.isIntersecting && e.intersectionRatio >= need(v)) seen.add(v);
        else seen.delete(v);
        syncCover(v);
      }),
    { threshold: [0, 0.1, SHOW] });
    videoOf.forEach((v, box) => coverIo.observe(box));
    if (coverVideos.some((v) => v.closest('.panel'))) {
      let queuedCovers = false;
      window.addEventListener('scroll', () => {
        if (queuedCovers) return;
        queuedCovers = true;
        requestAnimationFrame(() => { queuedCovers = false; seen.forEach(syncCover); });
      }, { passive: true });
      // a panel's video gets its files (its poster is a big picture) once the panel is a screen away
      const nearIo = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && prepare(videoOf.get(e.target))), { rootMargin: '100% 0px' });
      const watchPanels = () => videoOf.forEach((v, box) => { if (v.dataset.src) { nearIo.unobserve(box); nearIo.observe(box); } });
      watchPanels();
      // turning a tablet or resizing the window can show or hide the panels' videos (CSS: PANEL_VIDEO):
      // watching the panels again reports the ones near the screen, which get their files if they are shown now
      matchMedia(PANEL_VIDEO).addEventListener?.('change', () => { watchPanels(); coverVideos.forEach(syncCover); });
    }
  }

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

  // The photos of the phone menu (the CSS "GIF"): as lazy images in a hidden menu they only started
  // downloading when the menu opened, so the first rounds had empty frames and stuttered. On phones
  // they now load in the background once the page is ready (or as soon as the menu button is touched),
  // and the GIF only starts when every frame is decoded.
  const pics = $('.nav__pics');
  if (pics && window.matchMedia('(max-width: 860px)').matches) {
    const frames = $$('img', pics);
    let loading = false;
    const ready = () => pics.classList.add('is-ready');
    const load = () => {
      if (loading) return;
      loading = true;
      frames.forEach((img) => { img.loading = 'eager'; });
      Promise.all(frames.map((img) => img.decode().catch(() => {}))).then(ready);
      setTimeout(ready, 5000); // slow connection: start anyway
    };
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 600));
    if (document.readyState === 'complete') idle(load);
    else window.addEventListener('load', () => idle(load));
    menuBtn?.addEventListener('pointerdown', load, { once: true });
  }

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
      if (el.tagName === 'IMG' && el.dataset.reveal === 'img') {
        const done = (e) => { if (e.propertyName === 'clip-path') { el.classList.add('is-done'); el.removeEventListener('transitionend', done); } };
        el.addEventListener('transitionend', done);
        setTimeout(() => el.classList.add('is-done'), 2600);
      }
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
  if (!reduceMotion && (drifting.length || sliding.length)) {
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

  /* ───────── the sections that follow the scroll (About and the home, 05/11/2026) ───────── */
  // data-scrub="0.95 0.35": --k is 0 while the element's top is below 95% of the screen height and reaches 1 when its
  // top gets to 35%; data-scrub-ease="out" eases it. The CSS turns --k into the movement (the closing title's lines
  // sliding in) and defaults it to 1, so without JS or with reduced motion all of it sits in its
  // final place.
  // data-ink: the words of a line go from faint to solid in reading order (--o per word), by default from the moment
  // the line's top is at 88% of the screen until it reaches 30%; data-ink="0.9 0.42" names other points.
  // data-slide: the fun facts row moves sideways while its section passes, on a computer only (--slide); on a phone
  // it is a row to swipe. All the rects are read first and written after, once per frame.
  const scrubbed = $$('[data-scrub]');
  const inked = $$('[data-ink]');
  const slideRow = $('[data-slide]');
  if (!reduceMotion && (scrubbed.length || inked.length || slideRow)) {
    const conf = scrubbed.map((el) => {
      const [from = 0.95, to = 0.35] = el.dataset.scrub.trim().split(/\s+/).map(Number);
      return { from, to, out: el.dataset.scrubEase === 'out', last: '' };
    });
    const set = (el, name, value, holder) => {
      if (holder.last === value) return;
      holder.last = value;
      el.style.setProperty(name, value);
    };
    const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
    // each word (and the typing word, as one piece) gets its own span, also inside the line's accent and labels
    const splitInk = (parent, words) => {
      [...parent.childNodes].forEach((node) => {
        if (node.nodeType !== Node.TEXT_NODE) {
          if (node.nodeType !== Node.ELEMENT_NODE || node.classList.contains('sr-only')) return;
          if (node.classList.contains('tw')) { node.classList.add('ab-ink'); words.push({ el: node, last: '' }); }
          else splitInk(node, words);
          return;
        }
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.append(part);
          const word = document.createElement('span');
          word.className = 'ab-ink';
          word.textContent = part;
          words.push({ el: word, last: '' });
          frag.append(word);
        });
        node.replaceWith(frag);
      });
    };
    const inks = inked.map((el) => {
      const words = [];
      splitInk(el, words);
      const [from = 0.88, to = 0.3] = (el.dataset.ink || '').trim().split(/\s+/).filter(Boolean).map(Number);
      return { el, words, from, to };
    });
    let slideRoom = 0;
    const hdrHeight = $('#hdr')?.offsetHeight || 0;
    const slideOn = window.matchMedia('(min-width: 861px)');
    const slideState = { last: '' };
    const measureSlide = () => {
      if (!slideRow) return;
      slideRow.classList.toggle('is-drifting', slideOn.matches);
      slideRoom = slideOn.matches ? Math.max(slideRow.offsetWidth - document.documentElement.clientWidth, 0) : 0;
      if (!slideOn.matches) { slideRow.style.removeProperty('--slide'); slideState.last = ''; }
    };
    let queuedScrub = false;
    const paintScrub = () => {
      queuedScrub = false;
      const vh = window.innerHeight;
      const tops = scrubbed.map((el) => el.getBoundingClientRect().top);
      const inkTops = inks.map((ink) => ink.el.getBoundingClientRect().top);
      const rowBox = slideRoom ? slideRow.getBoundingClientRect() : null;
      tops.forEach((top, i) => {
        const { from, to, out } = conf[i];
        let k = clamp01((from * vh - top) / Math.max((from - to) * vh, 1));
        if (out) k = 1 - (1 - k) ** 3;
        set(scrubbed[i], '--k', k.toFixed(3), conf[i]);
      });
      inks.forEach(({ words, from, to }, n) => {
        const p = clamp01((vh * from - inkTops[n]) / (vh * (from - to)));
        const span = words.length + 3; // each word takes 4 words' time, so they overlap softly
        words.forEach((w, i) => set(w.el, '--o', clamp01((p * span - i) / 4).toFixed(3), w));
      });
      // the row rests at both ends while its cards are whole on screen, so the first and the last card can be read
      if (slideRoom) {
        const start = vh - rowBox.height - 30;
        const end = hdrHeight + 64;
        set(slideRow, '--slide', `${(-slideRoom * clamp01((start - rowBox.top) / Math.max(start - end, 1))).toFixed(1)}px`, slideState);
      }
    };
    const queueScrub = () => {
      if (!queuedScrub) { queuedScrub = true; requestAnimationFrame(paintScrub); }
    };
    window.addEventListener('scroll', queueScrub, { passive: true });
    window.addEventListener('resize', () => { measureSlide(); queueScrub(); });
    window.addEventListener('load', () => { measureSlide(); queueScrub(); });
    document.fonts?.ready.then(() => { measureSlide(); queueScrub(); });
    measureSlide();
    paintScrub();
  }

  // The home's projects (05/11/2026): the screen stays still and one row of cards passes sideways as the page goes
  // down. The section's height comes from the row's width (--room), so the row ends exactly when the scroll does; it
  // starts a little to the right and is already moving while the stage arrives. Pinned only where the CSS pins it.
  const sideways = $('[data-sideways]');
  if (sideways && !reduceMotion) {
    const row = $('.hm-work__row', sideways);
    const pinned = window.matchMedia('(min-width: 861px) and (min-height: 600px)');
    let room = 0;
    let last = '';
    const measureRow = () => {
      room = pinned.matches ? Math.max(row.offsetWidth - document.documentElement.clientWidth, 0) : 0;
      if (room) sideways.style.setProperty('--room', `${room}px`);
      else { sideways.style.removeProperty('--room'); row.style.removeProperty('--slide'); last = ''; }
    };
    let queuedRow = false;
    const paintRow = () => {
      queuedRow = false;
      if (!room) return;
      const top = sideways.getBoundingClientRect().top;
      const vh = window.innerHeight;
      const passed = Math.min(Math.max(-top / room, 0), 1);
      const arriving = Math.min(Math.max(top / (vh * 0.75), 0), 1);
      const x = `${(arriving * window.innerWidth * 0.16 - room * passed).toFixed(1)}px`;
      if (x !== last) { last = x; row.style.setProperty('--slide', x); }
    };
    const queueRow = () => { if (!queuedRow) { queuedRow = true; requestAnimationFrame(paintRow); } };
    // a link reached with the Tab key may be far along the row: the page goes to where the row shows it
    row.addEventListener('focusin', (e) => {
      if (!room) return;
      const card = [...row.children].find((el) => el.contains(e.target));
      const along = Math.min(Math.max(card.offsetLeft - row.children[0].offsetLeft, 0), room);
      window.scrollTo({ top: sideways.getBoundingClientRect().top + window.scrollY + along, behavior: 'auto' });
    });
    window.addEventListener('scroll', queueRow, { passive: true });
    window.addEventListener('resize', () => { measureRow(); queueRow(); });
    window.addEventListener('load', () => { measureRow(); queueRow(); });
    measureRow();
    paintRow();
  }

  // The hello text stays put while the plum band rises over it (sticky, styles.css). If the text is taller than the
  // screen it pins with its bottom at the bottom of the screen, so no line is lost.
  const hello = $('[data-hello]');
  if (hello && !reduceMotion) {
    const fitHello = () => hello.style.setProperty('--hello-top', `${Math.min(window.innerHeight - hello.offsetHeight, 0)}px`);
    window.addEventListener('resize', fitHello);
    document.fonts?.ready.then(fitHello);
    fitHello();
  }

  /* ───────── Home: an industry's pictures pop up at the section's corners while the mouse is on its name ───────── */
  const cornersBox = $('[data-corners]');
  if (cornersBox && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const sets = $$('.hm-ind__set', cornersBox);
    $$('.hm-ind__item', cornersBox).forEach((el, i) => {
      el.addEventListener('pointerenter', () => sets[i]?.classList.add('is-on'));
      el.addEventListener('pointerleave', () => sets[i]?.classList.remove('is-on'));
    });
  }

  /* ───────── One at a time while the screen stays still (About and the home) ───────── */
  // data-steps="0.45" (How I work, What I do): the section is taller than the screen and its [data-stage] is sticky. The
  // [data-step] items share one place and take turns, 0.45 stage heights of scroll each: each comes out of the blur,
  // holds, and blurs away as the next one arrives (--v, 0 to 1). [data-step-name] items follow along.
  // data-rise (What I can help with): the first panel is already there and each next one rises from below the screen
  // over the previous one (--e, 0 to 1). Her request, 05/11/2026. Short screens get a plain list (styles.css), where
  // these variables do nothing.
  const clamp01 = (n) => Math.min(Math.max(n, 0), 1);
  const stepBoxes = $$('[data-steps]').map((box) => ({
    box,
    stage: $('[data-stage]', box),
    each: Number(box.dataset.steps) || 0.45,
    items: $$('[data-step]', box),
    names: $$('[data-step-name]', box),
  }));
  const riseBox = $('[data-rise]');
  if ((stepBoxes.length || riseBox) && !reduceMotion) {
    const risers = riseBox ? $$('.ab-panel', riseBox).slice(1) : [];
    // the stages are 100svh tall, so they are the measure, not the window (it grows when a phone's address bar hides)
    const riseStage = riseBox && $('.ab-caps__stage', riseBox);
    let queuedTurns = false;
    const paintTurns = () => {
      queuedTurns = false;
      stepBoxes.forEach(({ box, stage, each, items, names }) => {
        const x = -box.getBoundingClientRect().top / (stage.offsetHeight * each);
        items.forEach((el, i) => {
          let d = Math.abs(x - i);
          if (x < i && i === 0) d *= 0.4; // the first one comes into focus slowly, while the section arrives
          if (x > i && i === items.length - 1) d = 0; // the last one stays until the section leaves
          const v = clamp01((0.55 - d) / 0.25).toFixed(3);
          el.style.setProperty('--v', v);
          names[i]?.style.setProperty('--v', v);
        });
      });
      if (riseBox) {
        const r = riseBox.getBoundingClientRect();
        const p = clamp01(-r.top / Math.max(r.height - riseStage.offsetHeight, 1));
        const span = 1 / risers.length;
        risers.forEach((el, i) => {
          const t = clamp01((p - i * span - span * 0.08) / (span * 0.76));
          el.style.setProperty('--e', (1 - (1 - t) ** 3).toFixed(4));
        });
      }
    };
    const queueTurns = () => {
      if (!queuedTurns) { queuedTurns = true; requestAnimationFrame(paintTurns); }
    };
    window.addEventListener('scroll', queueTurns, { passive: true });
    window.addEventListener('resize', queueTurns);
    paintTurns();
  }

  /* ───────── About: travel photos rise and pile up while the text stays (data-stack) ───────── */
  // The track is taller than the screen and the pile is sticky inside it. The first photo is already there when the
  // pile pins; each next one rises from below the screen and settles tilted on the pile over its own stretch of scroll.
  // --e goes 0 → 1 per photo (CSS turns it into the movement); her reference: Country Living Fair (03/11/2026).
  const stack = $('[data-stack]');
  if (stack && !reduceMotion) {
    const track = $('.outside__track', stack);
    const box = $('.outside__pile', stack);
    const pile = $$('.pile', stack);
    let queuedStack = false;
    const paintStack = () => {
      queuedStack = false;
      const r = track.getBoundingClientRect();
      const vh = window.innerHeight;
      const lead = vh * 0.12; // the second piece starts rising a little before the pile pins
      const travel = (r.height - box.offsetHeight) * 0.94 + lead; // the last piece lands just before the pile lets go
      const p = Math.min(Math.max((parseFloat(getComputedStyle(box).top) + lead - r.top) / Math.max(travel, 1), 0), 1);
      const steps = pile.length - 1;
      pile.forEach((el, i) => {
        if (!i) return;
        const t = Math.min(Math.max(p * steps - (i - 1), 0), 1);
        el.style.setProperty('--e', (1 - (1 - t) ** 3).toFixed(4));
      });
    };
    const queueStack = () => {
      if (!queuedStack) { queuedStack = true; requestAnimationFrame(paintStack); }
    };
    window.addEventListener('scroll', queueStack, { passive: true });
    window.addEventListener('resize', queueStack);
    paintStack();
  }

  /* ───────── Photos that spread to the corners as you scroll (data-spread) ───────── */
  // About opening: they start piled on the title. Home (05/11/2026): the text is marked data-spread-clear and they
  // start gathered right around it, never covering it: beside the text where there is room, above and below it on a phone.
  if (!reduceMotion) $$('[data-spread]').forEach((spread) => {
    const stage = $('.about-open__stage, .hm-hero__stage', spread);
    const photos = $$('.ao, .hp', spread);
    const clear = $$('[data-spread-clear]', spread);
    const GATHERED = 0.8; // their scale when gathered, same as styles.css (.hm-hero .hp)
    const GAP = 18;
    const aroundText = () => {
      const boxes = clear.map((el) => el.getBoundingClientRect());
      const c = {
        left: Math.min(...boxes.map((b) => b.left)), right: Math.max(...boxes.map((b) => b.right)),
        top: Math.min(...boxes.map((b) => b.top)), bottom: Math.max(...boxes.map((b) => b.bottom)),
      };
      const midX = (c.left + c.right) / 2;
      const midY = (c.top + c.bottom) / 2;
      const s = stage.getBoundingClientRect();
      photos.forEach((el) => {
        const r = el.getBoundingClientRect();
        const toLeft = r.left + r.width / 2 < midX;
        const toTop = r.top + r.height / 2 < midY;
        const w = r.width * GATHERED;
        const h = r.height * GATHERED;
        const room = toLeft ? c.left - s.left : s.right - c.right;
        let x;
        let y;
        if (room >= w + GAP * 1.5) { // beside the text, overlapping the other photo on its side a little
          x = toLeft ? c.left - GAP - w / 2 : c.right + GAP + w / 2;
          y = midY + (toTop ? -1 : 1) * Math.min(h * 0.46, (c.bottom - c.top) / 2);
        } else { // above or below the text, near the middle
          x = midX + (toLeft ? -1 : 1) * w * 0.42;
          y = toTop ? c.top - GAP * 0.8 - h / 2 : c.bottom + GAP * 0.8 + h / 2;
        }
        el.style.setProperty('--dx', `${(x - (r.left + r.width / 2)).toFixed(1)}px`);
        el.style.setProperty('--dy', `${(y - (r.top + r.height / 2)).toFixed(1)}px`);
      });
    };
    const overText = () => {
      const s = stage.getBoundingClientRect();
      photos.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        // back to (near) the middle, each one a little off so they form a loose pile over the title
        const jitterX = [-0.06, 0.07, 0.05, -0.08, -0.02, 0.03][i % 6] * s.width;
        const jitterY = [-0.08, -0.05, 0.07, 0.06, -0.1, 0.09][i % 6] * s.height;
        el.style.setProperty('--dx', `${(s.left + s.width / 2 + jitterX - (r.left + r.width / 2)).toFixed(1)}px`);
        el.style.setProperty('--dy', `${(s.top + s.height / 2 + jitterY - (r.top + r.height / 2)).toFixed(1)}px`);
      });
    };
    const measure = () => {
      photos.forEach((el) => el.style.setProperty('--p', 1));
      if (clear.length) aroundText();
      else overText();
    };
    let queuedSpread = false;
    const paintSpread = () => {
      queuedSpread = false;
      const r = spread.getBoundingClientRect();
      const p = Math.min(Math.max(-r.top / Math.max(r.height - window.innerHeight, 1), 0), 1);
      photos.forEach((el, i) => {
        const t = Math.min(Math.max(p * 1.35 - i * 0.05, 0), 1);
        el.style.setProperty('--p', (1 - (1 - t) ** 2).toFixed(4));
      });
    };
    const queueSpread = () => { if (!queuedSpread) { queuedSpread = true; requestAnimationFrame(paintSpread); } };
    window.addEventListener('scroll', queueSpread, { passive: true });
    window.addEventListener('resize', () => { measure(); paintSpread(); });
    if (clear.length) document.fonts?.ready.then(() => { measure(); paintSpread(); }); // the text's box depends on its font
    measure();
    paintSpread();
  });

  /* ───────── About: the round badge on the half-circle tab turns as you scroll ───────── */
  const badge = $('.outside__badge');
  if (badge && !reduceMotion) {
    let queuedSpin = false;
    const spin = () => { queuedSpin = false; badge.style.setProperty('--spin', `${(window.scrollY * 0.12).toFixed(1)}deg`); };
    window.addEventListener('scroll', () => { if (!queuedSpin) { queuedSpin = true; requestAnimationFrame(spin); } }, { passive: true });
    spin();
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
      status.textContent = '';
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
    // The form service can take several seconds to answer: the button says it is sending, so the click
    // never looks like it did nothing, and after 30 s the visitor gets the error with the e-mail address.
    const pt = document.documentElement.lang.startsWith('pt');
    const label = btn.innerHTML;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.textContent = pt ? 'Enviando…' : 'Sending…';
    status.textContent = pt ? 'Enviando sua mensagem, pode levar alguns segundos…' : 'Sending your message, this can take a few seconds…';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    try {
      const res = await fetch(endpoint, { method: 'POST', body: fd, headers: { Accept: 'application/json' }, signal: ctrl.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || String(data.success) === 'false') throw new Error(data.message || String(res.status));
      form.reset();
      done();
    } catch {
      failed();
    } finally {
      clearTimeout(timer);
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.innerHTML = label;
    }
  });

  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
