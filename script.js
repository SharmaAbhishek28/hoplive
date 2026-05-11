/* ============================================================
   Hoplive — homepage script
   Lenis smooth scroll + GSAP reveals + ScrollTrigger eclipse scrub.
   Words always render visible by default; only the JS below ever
   hides them (briefly) to play the reveal animation. If GSAP fails
   to load or motion is reduced, content stays on screen as plain text.
   ============================================================ */
(function(){
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const haveGSAP = !!window.gsap;
  const haveST = !!window.ScrollTrigger;
  const motionOk = haveGSAP && !reduceMotion;

  /* ============================================================
     LENIS SMOOTH SCROLL
     duration 1.2s, cubic-out easing — the spec
     ============================================================ */
  let lenis = null;
  if (window.Lenis && !reduceMotion){
    lenis = new Lenis({
      duration: 1.2,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      smoothWheel: true,
      smoothTouch: false
    });
    function raf(time){ lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);

    if (haveST){
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
  }

  /* ============================================================
     SPLIT WORD-BY-WORD HEADLINES — walk DOM text nodes only,
     so inline tags (<br>, <span class="spike">, etc.) are preserved.
     ============================================================ */
  function wrapWordsInTextNode(textNode){
    const text = textNode.nodeValue;
    if (!text || !text.trim()) return; // pure-whitespace text node, leave it
    const parts = text.split(/(\s+)/); // keep whitespace as separate chunks
    const frag = document.createDocumentFragment();
    parts.forEach((p) => {
      if (p.length === 0) return;
      if (/^\s+$/.test(p)){
        frag.appendChild(document.createTextNode(p));
      } else {
        const outer = document.createElement('span');
        outer.className = 'reveal-word';
        const inner = document.createElement('span');
        inner.textContent = p;
        outer.appendChild(inner);
        frag.appendChild(outer);
      }
    });
    textNode.parentNode.replaceChild(frag, textNode);
  }
  function walkAndWrap(node){
    if (node.nodeType === 1 && node.tagName === 'BR') return;
    if (node.nodeType === 3){ wrapWordsInTextNode(node); return; }
    if (node.nodeType === 1){
      const kids = Array.from(node.childNodes);
      kids.forEach(walkAndWrap);
    }
  }
  function splitWords(el){
    if (el.dataset.splitDone) return;
    Array.from(el.childNodes).forEach(walkAndWrap);
    el.dataset.splitDone = '1';
  }
  document.querySelectorAll('[data-split]').forEach(splitWords);

  /* ============================================================
     GSAP — register, then build all reveals & scroll behaviour.
     If GSAP / ScrollTrigger / motion isn't available, this whole
     block skips and the page renders as fully-visible static content.
     ============================================================ */
  if (motionOk){
    if (haveST) gsap.registerPlugin(ScrollTrigger);

    /* HEADLINE REVEAL — robust pattern.
       1. gsap.set inline-hides every reveal-word inner span (opacity 0,
          translated 40px down). Inline styles override anything in CSS.
       2. Hero animates immediately on load.
       3. Section headlines animate when their h2 enters the viewport
          via IntersectionObserver — no Lenis/ScrollTrigger sync issues. */
    gsap.set('.reveal-word > span', { y: 40, opacity: 0 });

    // Hero — immediate
    gsap.to('.hero [data-split] .reveal-word > span', {
      y: 0, opacity: 1,
      duration: 0.8,
      stagger: 0.05,
      ease: 'power3.out',
      delay: 0.15
    });

    // Hero supporting elements (eyebrow, subhead)
    gsap.from('.hero-eyebrow, .hero-sub', {
      opacity: 0, y: 20,
      duration: 0.8,
      stagger: 0.1,
      ease: 'power2.out',
      delay: 0.5
    });

    /* Search pill expansion — pill morphs out of the coral search button.
       Use measured pixel values (not calc()) so GSAP can interpolate the
       clip-path cleanly; mixed unit calc() expressions stutter mid-animation
       and produce a visible "glitch" frame on the right edge. */
    const pill = document.getElementById('searchPill');
    if (pill){
      const segs = pill.querySelectorAll('.search-seg');
      const buttonReserve = 76; // matches CSS initial clip-path
      // Measure once at intro — pill is in its expanded layout at this point
      // because the CSS clip-path doesn't change layout, only painting.
      const pillWidth = pill.offsetWidth || 600;
      const startInset = `inset(0 0 0 ${pillWidth - buttonReserve}px round 999px)`;
      const endInset   = 'inset(0 0 0 0px round 999px)';
      gsap.set(pill, { clipPath: startInset, opacity: 1, willChange: 'clip-path' });
      gsap.set(segs, { opacity: 0, x: -12 });

      const pillTl = gsap.timeline({ delay: 0.85, onComplete: () => {
        // Important: do NOT clearProps the clipPath — that would let the
        // CSS rule `.js .search-pill { clip-path: inset(...) }` cascade
        // back in and re-clip the pill to its start state. Set it to
        // 'none' inline so the pill stays fully visible after the reveal.
        gsap.set(pill, { clearProps: 'willChange', clipPath: 'none' });
      }});
      pillTl
        .to(pill, {
          clipPath: endInset,
          duration: 0.9,
          ease: 'power3.out'
        })
        .to(segs, {
          opacity: 1, x: 0,
          duration: 0.45,
          stagger: 0.07,
          ease: 'power2.out'
        }, '-=0.5')
        .from('.search-go svg', {
          scale: 0.4, opacity: 0,
          duration: 0.4,
          ease: 'back.out(2)'
        }, '-=0.55');

      /* Click micro-pulse on any segment for tactile feedback */
      segs.forEach((seg) => {
        seg.addEventListener('click', () => {
          gsap.fromTo(pill,
            { scale: 1 },
            { scale: 1.015, yoyo: true, repeat: 1, duration: 0.18, ease: 'power1.out' }
          );
        });
      });
    }

    // Polaroid scatter — float in with rotation preserved
    gsap.utils.toArray('.polaroid').forEach((el, i) => {
      gsap.from(el, {
        opacity: 0, y: 40, scale: 0.92,
        duration: 1.0,
        delay: 0.7 + i * 0.12,
        ease: 'power3.out'
      });
    });

    // Section headlines — IntersectionObserver triggers per element
    const headlineObs = ('IntersectionObserver' in window) ? new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const spans = el.querySelectorAll('.reveal-word > span');
        if (!spans.length){ headlineObs.unobserve(el); return; }
        gsap.to(spans, {
          y: 0, opacity: 1,
          duration: 0.8,
          stagger: 0.04,
          ease: 'power3.out'
        });
        headlineObs.unobserve(el);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }) : null;

    document.querySelectorAll('[data-split]').forEach((el) => {
      if (el.closest('.hero')) return;       // hero handled above
      if (headlineObs) headlineObs.observe(el);
      else {
        // No IntersectionObserver — just reveal everything
        gsap.to(el.querySelectorAll('.reveal-word > span'), {
          y: 0, opacity: 1, duration: 0.8, stagger: 0.04, ease: 'power3.out'
        });
      }
    });

    /* ScrollTrigger-only effects below — skip if ST isn't loaded.
       Headline reveals above will still work via IntersectionObserver. */
    if (haveST){
      // Stats count-up
      document.querySelectorAll('.count').forEach((el) => {
        const target = parseInt(el.dataset.target, 10);
        const obj = { v: 0 };
        ScrollTrigger.create({
          trigger: el, start: 'top 85%', once: true,
          onEnter: () => {
            gsap.to(obj, {
              v: target, duration: 1.6, ease: 'power2.out',
              onUpdate: () => { el.textContent = Math.round(obj.v); }
            });
          }
        });
      });

      // Booking flow — eclipse mark progresses through 4 states.
      // Coral cx values: opening 28 → primary 38 → aligned 50 → closing 62.
      // Desktop: tied to vertical page scroll across the .booking section.
      // Mobile: tied to horizontal scroll of the .booking-steps card strip.
      const bookingCoral = document.getElementById('bookingCoral');
      const stateLabel = document.getElementById('bookingStateLabel');
      const stateNames = ['opening · browse', 'primary · pick', 'aligned · lock', 'closing · hop in'];
      const cxStops = [28, 38, 50, 62];
      const rStops = [45.5, 45.5, 45.5, 45.5];

      function applyMarkProgress(p){
        p = Math.max(0, Math.min(1, p));
        const phase = Math.min(3, Math.floor(p * 4));
        const localT = (p * 4) - phase;
        const next = Math.min(3, phase + 1);
        const cx = cxStops[phase] + (cxStops[next] - cxStops[phase]) * localT;
        const r = rStops[phase] + (rStops[next] - rStops[phase]) * localT;
        if (bookingCoral){
          bookingCoral.setAttribute('cx', cx.toFixed(2));
          bookingCoral.setAttribute('r', r.toFixed(2));
        }
        if (stateLabel){ stateLabel.textContent = stateNames[phase]; }
      }

      const isMobileBooking = window.matchMedia('(max-width: 760px)').matches;

      if (isMobileBooking){
        // Mobile: hook horizontal scroll of the cards strip
        const stepsStrip = document.querySelector('.booking-steps');
        if (stepsStrip){
          let rafId = 0;
          const onScroll = () => {
            if (rafId) return;
            rafId = requestAnimationFrame(() => {
              rafId = 0;
              const max = stepsStrip.scrollWidth - stepsStrip.clientWidth;
              const p = max > 0 ? stepsStrip.scrollLeft / max : 0;
              applyMarkProgress(p);
            });
          };
          stepsStrip.addEventListener('scroll', onScroll, { passive: true });
          // Initial state
          applyMarkProgress(0);
        }
      } else {
        // Desktop: vertical-scrub trigger (original behaviour)
        ScrollTrigger.create({
          trigger: '.booking',
          start: 'top top',
          end: 'bottom bottom',
          scrub: 1,
          onUpdate: (self) => applyMarkProgress(self.progress)
        });
      }

      // Bento + cards subtle reveal on scroll (per element)
      gsap.utils.toArray('.tile, .pcard, .conv-card, .b2b-stat, .city, .next-card, .room-card, .common-spaces > div').forEach((el) => {
        gsap.from(el, {
          opacity: 0, y: 30,
          duration: 0.7, ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true }
        });
      });

      /* Group reveals — stagger inside container.
         Use a single trigger so the cluster animates together. */
      const groupReveal = (containerSel, childSel) => {
        document.querySelectorAll(containerSel).forEach((container) => {
          const kids = container.querySelectorAll(childSel);
          if (!kids.length) return;
          gsap.from(kids, {
            opacity: 0, y: 24, scale: 0.98,
            duration: 0.7, ease: 'power3.out', stagger: 0.08,
            scrollTrigger: { trigger: container, start: 'top 82%', once: true }
          });
        });
      };
      groupReveal('.collage', '.frame');
      groupReveal('.collage', '.floater');
      groupReveal('.feat-grid', '.feat');
      groupReveal('.foot-grid', '.foot-col, .foot-brand');
      groupReveal('.gallery', '.g-frame');

      /* Subtle parallax drift on collage frames as they pass through */
      gsap.utils.toArray('.collage .frame').forEach((f, i) => {
        const dir = (i % 2 === 0) ? -1 : 1;
        gsap.to(f, {
          yPercent: dir * 6,
          ease: 'none',
          scrollTrigger: {
            trigger: f.closest('.collage'),
            start: 'top bottom',
            end: 'bottom top',
            scrub: true
          }
        });
      });

      /* Footer elastic morph — bouncy curve when footer enters viewport.
         Uses GSAP's free attr plugin (built into core); both paths share
         the same SVG command structure so the d-string interpolates cleanly.
         Visually equivalent to MorphSVG for this two-keyframe case. */
      const bouncyPath = document.getElementById('bouncy-path');
      if (bouncyPath){
        const downPath   = 'M0-0.3C0-0.3,464,156,1139,156S2278-0.3,2278-0.3V683H0V-0.3z';
        const centerPath = 'M0-0.3C0-0.3,464,0,1139,0S2278-0.3,2278-0.3V683H0V-0.3z';
        gsap.set(bouncyPath, { attr: { d: downPath } });
        ScrollTrigger.create({
          trigger: '.foot',
          start: 'top bottom',
          toggleActions: 'play none none reverse',
          onEnter: (self) => {
            const v = (typeof self.getVelocity === 'function') ? self.getVelocity() : 0;
            const variation = Math.max(-0.5, Math.min(0.5, v / 10000));
            gsap.fromTo(bouncyPath,
              { attr: { d: downPath } },
              {
                duration: 1.6,
                attr: { d: centerPath },
                ease: `elastic.out(${1 + variation}, ${1 - variation})`,
                overwrite: 'auto'
              }
            );
          },
          onLeaveBack: () => {
            gsap.set(bouncyPath, { attr: { d: downPath } });
          }
        });
      }
    }
  }

  /* Mobile hamburger menu is handled by the original initMobileNav()
     function further down in this file (.nav-burger + .nav-drawer).
     A duplicate setup was previously here and got removed to fix the
     "two hamburgers" bug. */

  /* ============================================================
     NAV SHRINK + SEARCH FAB SHOW after hero
     ============================================================ */
  const nav = document.getElementById('nav');
  const fab = document.getElementById('searchFab');
  const heroSection = document.querySelector('.hero');

  function onScroll(){
    if (!heroSection || !nav || !fab) return;
    const heroBottom = heroSection.getBoundingClientRect().bottom;
    if (heroBottom < 64){
      nav.classList.add('scrolled');
      fab.classList.add('visible');
    } else {
      nav.classList.remove('scrolled');
      fab.classList.remove('visible');
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ============================================================
     FILTER CHIPS — toggle active + actually filter cards.
     Reads filterable data straight from each card's DOM (meta line,
     price, live tag) so we don't need to maintain a parallel JS list.
     Used on homepage (.filters .chip) and /properties (.filter-sticky .chip).
     ============================================================ */
  function readCardFilterData(card){
    const get = (sel) => {
      const el = card.querySelector(sel);
      return el ? el.textContent.trim() : '';
    };
    const meta      = get('.meta');
    const priceVal  = get('.price .val');
    const priceQual = get('.price .qual');
    const live      = get('.live');
    const priceNum  = parseInt(priceVal.replace(/[^\d]/g, ''), 10) || 0;
    return { meta, priceVal, priceQual, priceNum, live };
  }
  // Filter predicates keyed by either data-filter attr or chip text (lowercased).
  const filterFns = {
    'all':              () => true,
    'trending':         () => true,
    'bangalore':        c => /bangalore/i.test(c.meta),
    'hyderabad':        c => /hyderabad/i.test(c.meta),
    'gurgaon':          c => /gurgaon/i.test(c.meta),
    'solo':             c => /solo/i.test(c.priceQual),
    'twin':             c => /twin/i.test(c.priceQual),
    'under ₹16k':       c => c.priceNum > 0 && c.priceNum < 16000,
    'under16k':         c => c.priceNum > 0 && c.priceNum < 16000,
    'premium hops':     c => c.priceNum >= 14500,
    'premium':          c => c.priceNum >= 14500,
    'hop-in this week': c => /beds?\s+left/i.test(c.live),
    'movein':           c => /beds?\s+left/i.test(c.live),
    'pet-friendly':     c => /pet/i.test(c.meta),
    'pet':              c => /pet/i.test(c.meta),
    'near tech parks':  c => /orr|cyber\s*hub|hitec|itpl|tech\s*park|forum|metro|hub/i.test(c.meta),
  };
  function chipKey(chip){
    const raw = (chip.dataset.filter || chip.textContent || '').trim().toLowerCase();
    return raw.replace(/\s+/g, ' ');
  }
  function applyFilter(container, key){
    if (!container) return;
    const fn = filterFns[key] || (() => true);
    let shown = 0;
    container.querySelectorAll('.pcard').forEach((card) => {
      const data = readCardFilterData(card);
      const match = fn(data);
      card.style.display = match ? '' : 'none';
      if (match) shown += 1;
    });
    // Empty-state hook: container can have a sibling [data-empty] element.
    const empty = container.parentElement && container.parentElement.querySelector('[data-empty]');
    if (empty) empty.style.display = shown ? 'none' : '';
  }
  function wireChipGroup(chipSelector, targetEl){
    const chips = document.querySelectorAll(chipSelector);
    if (!chips.length || !targetEl) return;
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        applyFilter(targetEl, chipKey(chip));
      });
    });
    // Apply the currently-active chip on load (so the filter respects the
    // initial active state instead of just visual styling).
    const initial = document.querySelector(`${chipSelector}.active`);
    if (initial) applyFilter(targetEl, chipKey(initial));
  }
  wireChipGroup('.filters .chip', document.getElementById('propsRow'));
  wireChipGroup('.filter-sticky .chip', document.getElementById('propsGrid'));

  /* ============================================================
     WISHLIST + AUTH — frontend only, localStorage-backed.
     Backend (real auth, real wishlist API) is a follow-up task.
     ============================================================ */
  const WL_KEY = 'hoplive_wishlist_v1';
  const AUTH_KEY = 'hoplive_user_v1';

  // --- Wishlist storage helpers (exposed on window for the /wishlist page) ---
  function getWishlist(){
    try { return JSON.parse(localStorage.getItem(WL_KEY) || '[]'); }
    catch(e){ return []; }
  }
  function saveWishlist(arr){
    try { localStorage.setItem(WL_KEY, JSON.stringify(arr)); } catch(e){}
    updateWishlistBadges(arr.length);
  }
  function isInWishlist(id){ return getWishlist().some((p) => p.id === id); }
  function addToWishlist(p){
    const list = getWishlist();
    if (!list.some((x) => x.id === p.id)){ list.push(p); saveWishlist(list); }
  }
  function removeFromWishlist(id){
    saveWishlist(getWishlist().filter((p) => p.id !== id));
  }
  function updateWishlistBadges(count){
    if (typeof count !== 'number') count = getWishlist().length;
    document.querySelectorAll('[data-wishlist-count]').forEach((el) => {
      el.textContent = count;
      el.setAttribute('data-count', count);
    });
  }

  // --- Read property data from a pcard's DOM (name, location, price, image, href) ---
  function readCardData(card){
    const title = card.querySelector('.title-row h3');
    const meta  = card.querySelector('.meta');
    const priceVal = card.querySelector('.price .val');
    const priceQual = card.querySelector('.price .qual');
    const img = card.querySelector('.img-ph img');
    const live = card.querySelector('.img .live');
    const star = card.querySelector('.star');
    const name = title ? title.textContent.trim() : 'hoplive property';
    const id = card.dataset.pid || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    // href on the card itself (if it's an <a>) or fallback
    const href = card.getAttribute('href') || (card.closest('a') ? card.closest('a').getAttribute('href') : '../property/');
    return {
      id,
      name,
      meta: meta ? meta.textContent.trim() : '',
      priceVal: priceVal ? priceVal.textContent.trim() : '',
      priceQual: priceQual ? priceQual.textContent.trim() : '',
      image: img ? img.getAttribute('src') : '',
      live: live ? live.textContent.trim() : '',
      star: star ? star.textContent.trim() : '',
      href
    };
  }

  // --- Heart save toggle: writes to wishlist + reflects visual state ---
  function paintHeart(h, saved){
    h.classList.toggle('saved', saved);
    const svg = h.querySelector('svg');
    if (svg) svg.style.fill = saved ? 'currentColor' : 'none';
  }
  function initHearts(){
    document.querySelectorAll('.pcard .heart').forEach((h) => {
      if (h.dataset.bound) return;
      h.dataset.bound = '1';
      const card = h.closest('.pcard');
      const data = readCardData(card);
      // initial state from storage
      paintHeart(h, isInWishlist(data.id));
      h.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isInWishlist(data.id)){
          removeFromWishlist(data.id);
          paintHeart(h, false);
        } else {
          addToWishlist(data);
          paintHeart(h, true);
          // small visual feedback ping on the nav heart icon
          const navHeart = document.querySelector('.nav-icon-wishlist');
          if (navHeart && window.gsap){
            gsap.fromTo(navHeart, { scale: 1 }, { scale: 1.2, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out' });
          }
        }
      });
    });
  }
  initHearts();
  updateWishlistBadges();

  // Expose helpers for the wishlist page renderer
  window.hoplive = window.hoplive || {};
  window.hoplive.getWishlist = getWishlist;
  window.hoplive.removeFromWishlist = (id) => {
    removeFromWishlist(id);
    // re-render the wishlist page list if present
    if (typeof window.renderWishlist === 'function') window.renderWishlist();
  };

  /* ============================================================
     AUTH — sign-in modal, localStorage-backed (frontend only)
     ============================================================ */
  function getUser(){
    try { return JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); }
    catch(e){ return null; }
  }
  function setUser(u){
    try { localStorage.setItem(AUTH_KEY, JSON.stringify(u)); } catch(e){}
    paintAuthState();
  }
  function clearUser(){
    try { localStorage.removeItem(AUTH_KEY); } catch(e){}
    paintAuthState();
  }
  function paintAuthState(){
    const u = getUser();
    document.querySelectorAll('.nav-icon-login').forEach((el) => {
      el.classList.toggle('hidden', !!u);
    });
    document.querySelectorAll('.nav-user-pill').forEach((el) => {
      el.classList.toggle('hidden', !u);
      if (u){
        const av = el.querySelector('.avatar');
        const nm = el.querySelector('.user-name');
        if (av) av.textContent = (u.name || u.email || 'H').trim().charAt(0).toUpperCase();
        if (nm) nm.textContent = (u.name || u.email || '').split(' ')[0] || 'You';
      }
    });
    document.querySelectorAll('.user-menu .um-name').forEach((el) => { el.textContent = (u && u.name) || 'Welcome'; });
    document.querySelectorAll('.user-menu .um-email').forEach((el) => { el.textContent = (u && u.email) || ''; });
  }
  paintAuthState();

  // Bind nav buttons (login icon, user pill, sign-out, menu links)
  document.querySelectorAll('.nav-icon-login').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openAuthModal();
    });
  });
  const userMenu = document.getElementById('userMenu');
  document.querySelectorAll('.nav-user-pill').forEach((pill) => {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      if (userMenu) userMenu.classList.toggle('open');
    });
  });
  if (userMenu){
    document.addEventListener('click', (e) => {
      if (!userMenu.contains(e.target) && !e.target.closest('.nav-user-pill')){
        userMenu.classList.remove('open');
      }
    });
    const signOut = userMenu.querySelector('.um-signout');
    if (signOut) signOut.addEventListener('click', () => {
      clearUser();
      userMenu.classList.remove('open');
    });
  }

  function openAuthModal(){
    const m = document.getElementById('authModal');
    if (!m) return;
    m.hidden = false;
    void m.offsetWidth;
    m.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeAuthModal(){
    const m = document.getElementById('authModal');
    if (!m) return;
    m.classList.remove('open');
    setTimeout(() => {
      m.hidden = true;
      document.body.style.overflow = '';
    }, 350);
  }
  const authModal = document.getElementById('authModal');
  if (authModal){
    const closeBtn = document.getElementById('authClose');
    const backdrop = document.getElementById('authBackdrop');
    if (closeBtn) closeBtn.addEventListener('click', closeAuthModal);
    if (backdrop) backdrop.addEventListener('click', closeAuthModal);
    // Tabs
    authModal.querySelectorAll('.auth-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        authModal.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        const heading = authModal.querySelector('h2');
        const cta = authModal.querySelector('button[type="submit"]');
        if (tab.dataset.tab === 'signup'){
          heading.textContent = 'Create your account.';
          cta.textContent = 'Create account';
        } else {
          heading.textContent = 'Welcome back.';
          cta.textContent = 'Sign in';
        }
      });
    });
    // Form submit — fake sign-in for now
    const form = document.getElementById('authForm');
    if (form){
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = new FormData(form);
        const email = (data.get('email') || '').toString().trim();
        const name = (data.get('name') || '').toString().trim() || email.split('@')[0] || 'You';
        if (!email){ form.reportValidity(); return; }
        setUser({ name, email });
        closeAuthModal();
      });
    }
    // Google button (visual only)
    const google = document.getElementById('authGoogle');
    if (google){
      google.addEventListener('click', () => {
        setUser({ name: 'You', email: 'you@gmail.com' });
        closeAuthModal();
      });
    }
    // Escape to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !authModal.hidden) closeAuthModal();
    });
  }

  /* ============================================================
     KEYBOARD SCROLL FOR PROPERTY ROW
     ============================================================ */
  const propsRow = document.getElementById('propsRow');
  if (propsRow){
    propsRow.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight'){ propsRow.scrollBy({ left: 340, behavior: 'smooth' }); }
      if (e.key === 'ArrowLeft'){ propsRow.scrollBy({ left: -340, behavior: 'smooth' }); }
    });
  }

  /* ============================================================
     FAQ ACCORDION (/how page)
     Plain CSS toggle via .open class — max-height transitions handle the rest.
     ============================================================ */
  document.querySelectorAll('.faq-item .faq-q').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const wasOpen = item.classList.contains('open');
      // Close siblings for cleaner one-at-a-time feel
      item.parentElement.querySelectorAll('.faq-item.open').forEach((o) => o.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });

  /* ============================================================
     PROPERTIES LISTING — chip filter
     Toggle data-filter on chips, hide/show cards by class match.
     For demo purposes the filter classes are inferred from card content;
     a real CMS would tag each card with structured data attributes.
     ============================================================ */
  const propsGrid = document.getElementById('propsGrid');
  if (propsGrid){
    const cards = Array.from(propsGrid.querySelectorAll('.pcard'));
    // Tag cards with city + amenity hints derived from .meta text
    cards.forEach((c) => {
      const meta = (c.querySelector('.meta')?.textContent || '').toLowerCase();
      const price = parseInt((c.querySelector('.price .val')?.textContent || '0').replace(/[^\d]/g,''), 10);
      const live = (c.querySelector('.live')?.textContent || '').toLowerCase();
      const tags = [];
      if (meta.includes('bangalore')) tags.push('bangalore');
      if (meta.includes('hyderabad')) tags.push('hyderabad');
      if (meta.includes('gurgaon')) tags.push('gurgaon');
      if (meta.includes('solo') || /\bsolo\b/.test(c.textContent)) tags.push('solo');
      if (meta.includes('twin') || /\btwin\b/.test(c.textContent)) tags.push('twin');
      if (meta.includes('pet')) tags.push('pet');
      if (price && price < 16000) tags.push('under16k');
      if (live.includes('beds left') || live.includes('opening')) tags.push('movein');
      c.dataset.tags = tags.join(' ');
    });
    document.querySelectorAll('.filter-row .chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const f = chip.dataset.filter;
        document.querySelectorAll('.filter-row .chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        cards.forEach((card) => {
          const tags = (card.dataset.tags || '').split(' ');
          card.style.display = (f === 'all' || tags.includes(f)) ? '' : 'none';
        });
      });
    });
  }

  /* ============================================================
     BOOKING WIZARD (/book) — 4-step state machine
     Step pips reflect progress, prev/next buttons advance through steps,
     summary populates from picked options before final confirm.
     ============================================================ */
  const wizard = document.getElementById('wizard');
  if (wizard){
    const steps = wizard.querySelectorAll('.wiz-step');
    const pips = wizard.querySelectorAll('.wiz-pip');
    const state = {
      property: null,
      propertyName: null,
      propertyLocality: null,
      room: null,
      roomName: null,
      roomPrice: null,
      name: null,
      whatsapp: null,
      email: null,
      date: null
    };

    function showStep(n){
      steps.forEach((s) => s.classList.toggle('active', parseInt(s.dataset.step,10) === n));
      pips.forEach((p) => {
        const pn = parseInt(p.dataset.pip,10);
        p.classList.toggle('active', pn === n);
        p.classList.toggle('done', pn < n);
      });
      // Smooth scroll to top of wizard for the new step
      window.scrollTo({ top: wizard.offsetTop - 80, behavior: 'smooth' });
    }

    // Option pickers (step 1: property, step 2: room)
    wizard.querySelectorAll('.wiz-step[data-step="1"] .wiz-opt').forEach((opt) => {
      opt.addEventListener('click', () => {
        wizard.querySelectorAll('.wiz-step[data-step="1"] .wiz-opt').forEach((o) => o.classList.remove('selected'));
        opt.classList.add('selected');
        state.property = opt.dataset.property;
        state.propertyName = opt.dataset.name;
        state.propertyLocality = opt.dataset.locality;
        wizard.querySelector('.wiz-step[data-step="1"] [data-wiz-next]').disabled = false;
      });
    });
    wizard.querySelectorAll('.wiz-step[data-step="2"] .wiz-opt').forEach((opt) => {
      opt.addEventListener('click', () => {
        wizard.querySelectorAll('.wiz-step[data-step="2"] .wiz-opt').forEach((o) => o.classList.remove('selected'));
        opt.classList.add('selected');
        state.room = opt.dataset.room;
        state.roomName = opt.dataset.roomName;
        state.roomPrice = parseInt(opt.dataset.roomPrice, 10);
        wizard.querySelector('.wiz-step[data-step="2"] [data-wiz-next]').disabled = false;
      });
    });

    // Next / back buttons
    wizard.querySelectorAll('[data-wiz-next]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cur = parseInt(btn.closest('.wiz-step').dataset.step, 10);
        // Capture form values when leaving step 3
        if (cur === 3){
          state.name = document.getElementById('b-name')?.value || 'Resident';
          state.whatsapp = document.getElementById('b-wa')?.value || '';
          state.email = document.getElementById('b-email')?.value || '';
          state.date = document.getElementById('b-date')?.value || '';
        }
        // Populate summary on entering step 4
        if (cur === 3){
          document.getElementById('sum-property').textContent = state.propertyName + (state.propertyLocality ? ', ' + state.propertyLocality : '');
          document.getElementById('sum-room').textContent = state.roomName || '—';
          document.getElementById('sum-date').textContent = state.date ? new Date(state.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
          document.getElementById('sum-name').textContent = state.name;
          document.getElementById('sum-rent').textContent = state.roomPrice ? '₹' + state.roomPrice.toLocaleString('en-IN') + '/mo' : '—';
        }
        showStep(cur + 1);
      });
    });
    wizard.querySelectorAll('[data-wiz-back]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cur = parseInt(btn.closest('.wiz-step').dataset.step, 10);
        showStep(cur - 1);
      });
    });

    // Final confirm — generate fake booking ID, advance to success
    const confirmBtn = wizard.querySelector('[data-wiz-confirm]');
    if (confirmBtn){
      confirmBtn.addEventListener('click', () => {
        const id = 'HL-2026-' + Math.floor(1000 + Math.random() * 9000);
        document.getElementById('success-id').textContent = id;
        document.getElementById('success-property').textContent = state.propertyName || '';
        showStep(5);
      });
    }
  }

})();

/* ============================================================
   MOBILE NAV DRAWER + WHATSAPP CHAT-BUBBLE TOOLTIP
   Auto-injected on every consumer page that has .nav and/or .wa-fab.
   No DOM-touch on the operator brief — that page has its own nav.
   ============================================================ */
(function(){
  'use strict';

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init(){
    initMobileNav();
    initWaTooltip();
  }

  function initMobileNav(){
    const nav = document.querySelector('.nav');
    if (!nav || nav.querySelector('.nav-burger')) return;

    // Compute prefix based on directory depth so links work from /, /book/, /property/, etc.
    const path  = location.pathname.replace(/^\/+|\/+$/g, '');
    const depth = path ? path.split('/').filter(Boolean).length : 0;
    const prefix = depth ? '../'.repeat(depth) : '';
    const here  = '/' + path + (path ? '/' : '');

    const PRIMARY = [
      { label: 'Home',         href: prefix || './',                match: /^\/?$/ },
      { label: 'Properties',   href: prefix + 'properties/',        match: /^\/properties\/?$/ },
      { label: 'Cities',       href: prefix + 'cities/',            match: /^\/cities\/?$/ },
      { label: 'How it works', href: prefix + 'how/',               match: /^\/how\/?$/ },
      { label: 'List with us', href: prefix + 'list-property/',     match: /^\/list-property\/?$/ },
      { label: 'Book a room',  href: prefix + 'book/',              match: /^\/book\/?$/ }
    ];
    const SECONDARY = [
      { label: 'WhatsApp us',  href: 'https://wa.me/91XXXXXXXXXX?text=Hi%2C%20asking%20about%20hoplive', external: true },
      { label: 'Refer & earn', href: '#' },
      { label: 'About',        href: '#' }
    ];

    const burger = document.createElement('button');
    burger.className = 'nav-burger';
    burger.setAttribute('aria-label', 'Open menu');
    burger.setAttribute('aria-expanded', 'false');
    burger.innerHTML = '<span></span><span></span><span></span>';
    // Place the burger on the RIGHT — inside nav-cta after the icon buttons.
    // Falls back to end-of-nav if nav-cta isn't there for any reason.
    const navCta = nav.querySelector('.nav-cta');
    if (navCta) navCta.appendChild(burger);
    else nav.appendChild(burger);

    const drawer = document.createElement('div');
    drawer.className = 'nav-drawer';
    drawer.setAttribute('aria-hidden', 'true');

    const primaryHTML = PRIMARY.map(function(r){
      const active = r.match.test(here);
      const dot = active ? '<span class="active-dot" aria-hidden="true"></span>' : '';
      return '<a href="' + r.href + '" class="nav-drawer-item' + (active ? ' is-active' : '') + '">' + dot + r.label + '</a>';
    }).join('');
    const secondaryHTML = SECONDARY.map(function(r){
      const ext = r.external ? ' target="_blank" rel="noopener"' : '';
      return '<a href="' + r.href + '" class="nav-drawer-item nav-drawer-item--sec"' + ext + '>' + r.label + '</a>';
    }).join('');

    drawer.innerHTML =
      '<div class="nav-drawer-backdrop"></div>' +
      '<aside class="nav-drawer-panel" role="dialog" aria-label="Site navigation" aria-modal="true">' +
        '<button class="nav-drawer-close" aria-label="Close menu">&times;</button>' +
        '<nav class="nav-drawer-list">' + primaryHTML +
          '<hr class="nav-drawer-rule" />' + secondaryHTML +
        '</nav>' +
      '</aside>';
    document.body.appendChild(drawer);

    const open = function(){
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');
      burger.setAttribute('aria-expanded', 'true');
      burger.classList.add('is-active');
      document.body.classList.add('nav-locked');
    };
    const close = function(){
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      burger.setAttribute('aria-expanded', 'false');
      burger.classList.remove('is-active');
      document.body.classList.remove('nav-locked');
    };

    burger.addEventListener('click', function(){
      drawer.classList.contains('is-open') ? close() : open();
    });
    drawer.querySelector('.nav-drawer-backdrop').addEventListener('click', close);
    drawer.querySelector('.nav-drawer-close').addEventListener('click', close);
    drawer.querySelectorAll('.nav-drawer-item').forEach(function(a){
      a.addEventListener('click', close);
    });
    document.addEventListener('keydown', function(e){
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) close();
    });
  }

  function initWaTooltip(){
    const fab = document.querySelector('.wa-fab');
    if (!fab) return;

    const KEY = 'hoplive_wa_tip_count';
    const MAX_ROTATIONS = 3;
    let count = parseInt(sessionStorage.getItem(KEY) || '0', 10);
    if (count >= MAX_ROTATIONS) return;

    const MESSAGES = [
      'Need help?',
      'Need assistance?',
      'Manager replies in 5 min',
      'Chat with us',
      'Got a question?'
    ];

    const tip = document.createElement('div');
    tip.className = 'wa-tip';
    tip.setAttribute('role', 'status');
    tip.setAttribute('aria-live', 'polite');
    tip.innerHTML = '<span class="wa-tip-text"></span>';
    document.body.appendChild(tip);

    let dismissTimer = null;
    let nextTimer = null;

    const showOne = function(index){
      if (count >= MAX_ROTATIONS) return;
      const msg = MESSAGES[index % MESSAGES.length];
      tip.querySelector('.wa-tip-text').textContent = msg;
      requestAnimationFrame(function(){ tip.classList.add('is-visible'); });
      dismissTimer = setTimeout(function(){
        tip.classList.remove('is-visible');
        count++;
        sessionStorage.setItem(KEY, String(count));
        if (count < MAX_ROTATIONS){
          const delay = 25000 + Math.floor(Math.random() * 5000);
          nextTimer = setTimeout(function(){ showOne(index + 1); }, delay);
        }
      }, 5000);
    };

    let triggered = false;
    const trigger = function(){
      if (triggered) return;
      triggered = true;
      const startIndex = Math.floor(Math.random() * MESSAGES.length);
      showOne(startIndex);
    };

    setTimeout(trigger, 4000);
    const onScroll = function(){
      if (window.scrollY > 600) {
        trigger();
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    tip.addEventListener('click', function(){
      clearTimeout(dismissTimer);
      clearTimeout(nextTimer);
      tip.classList.remove('is-visible');
      sessionStorage.setItem(KEY, String(MAX_ROTATIONS));
      window.open(fab.href, '_blank', 'noopener');
    });
  }
})();
