const DEBUG = false;
const log = (...args) => { if (DEBUG) console.debug('[Velopipe Hub]', ...args); };

// State
let rafScheduled = false;
let scrollTopTwoBtn = null;
let scrollTopThreeBtn = null;
let scrollTopFourBtn = null;
let navMenuStack = null;
let navToggleInline = null;
let currentExpandedCardElement = null;
let expandedObserver = null;
let userClosedNav = false;

// Splash visibility flag (true only when splash is substantially visible)
let splashMostlyInView = false;

const INITIAL_HIDE_ID = 'velopipe-scrolltop-init-hide';
const FLOATING_BTN_SELECTOR = '.scroll-top-btn';
const RAIL_BTN_SELECTORS = '.left-nav-menu-stack .scroll-top-two-btn, .left-nav-menu-stack .scroll-top-three-btn, .left-nav-menu-stack .scroll-top-four-btn';
const SHOW_THRESHOLD_PX = 300;

// Utilities
const getScrollTop = () => window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
const prefersReducedMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const safeScrollTo = ({ top = 0, behavior = 'smooth' } = {}) => {
  const finalTop = Math.round(top || 0);
  if (prefersReducedMotion()) {
    window.scrollTo(0, finalTop);
  } else {
    try {
      window.scrollTo({ top: finalTop, behavior });
    } catch (e) {
      window.scrollTo(0, finalTop);
    }
  }
};

// initial-hide guard to avoid flash
const ensureInitialFloatingHide = () => {
  if (document.getElementById(INITIAL_HIDE_ID)) return;
  const s = document.createElement('style');
  s.id = INITIAL_HIDE_ID;
  // hide floating button by default until JS decides to show it
  s.textContent = `
    .scroll-top-btn{ display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }
  `;
  document.head.appendChild(s);
};
const removeInitialFloatingHide = () => {
  const s = document.getElementById(INITIAL_HIDE_ID);
  if (s && s.parentNode) s.parentNode.removeChild(s);
};

// show/hide helpers
const applyHiddenStyles = (btn) => {
  if (!btn) return;
  btn.classList.remove('btn-visible');
  try {
    btn.style.setProperty('opacity', '0', 'important');
    btn.style.setProperty('visibility', 'hidden', 'important');
    btn.style.setProperty('pointer-events', 'none', 'important');
    // explicit display none to avoid flash when hiding
    btn.style.setProperty('display', 'none', 'important');
  } catch (e) {}
};

const applyVisibleStyles = (btn, isRailBtn = false) => {
  if (!btn) return;
  btn.classList.add('btn-visible');
  try {
    // floating uses flex (matches CSS .scroll-top-btn), rails use inline-flex
    const displayVal = isRailBtn ? 'inline-flex' : 'flex';
    btn.style.setProperty('display', displayVal, 'important');
    btn.style.setProperty('opacity', '1', 'important');
    btn.style.setProperty('visibility', 'visible', 'important');
    btn.style.setProperty('pointer-events', 'auto', 'important');
  } catch (e) {}
};

// Floating-only show/hide (keeps rails separate)
const showFloatingScrollTop = () => {
  removeInitialFloatingHide();
  const btn = document.querySelector(FLOATING_BTN_SELECTOR);
  if (!btn) return;
  applyVisibleStyles(btn, false);
};

const hideFloatingScrollTop = () => {
  const btn = document.querySelector(FLOATING_BTN_SELECTOR);
  if (!btn) return;
  applyHiddenStyles(btn);

  ensureInitialFloatingHide();
};

// Defensive show/hide for rail buttons (and floating when used together)
const hideScrollTopDefensive = () => {
  
  ensureInitialFloatingHide();

  
  const selector = FLOATING_BTN_SELECTOR;
  document.querySelectorAll(selector).forEach(btn => {
   
    if (btn.classList && btn.classList.contains('scroll-top-btn')) {
      try { btn.style.setProperty('display', 'none', 'important'); } catch (e) {}
    }
    applyHiddenStyles(btn);
  });
};

const showScrollTopDefensive = () => {
 
  removeInitialFloatingHide();

 
  const selector = FLOATING_BTN_SELECTOR;
  document.querySelectorAll(selector).forEach(btn => {
    applyVisibleStyles(btn, false);
  });
};

// Navigation visibility logic (keeps left rail behavior)
// NOTE: uses splashMostlyInView (set by observer) to avoid flicker when only a sliver of splash appears.
const forceShowNavOnMainPage = () => {
  navMenuStack = document.querySelector('.left-nav-menu-stack');
  if (!navMenuStack) return;

  const scrollPos = getScrollTop();
  const splashWrapper = document.getElementById('dashboard-splash-wrapper');


  const splashInView = splashWrapper ? splashMostlyInView : (scrollPos < 50);

  if (splashInView) {
   
    navMenuStack.style.setProperty('display', 'none', 'important');
    navMenuStack.style.setProperty('visibility', 'hidden', 'important');
  } else {
   
    if (!userClosedNav) {
      navMenuStack.classList.add('collapsed');
      document.body.classList.add('nav-collapsed');
    }
    navMenuStack.style.setProperty('display', 'flex', 'important');
    navMenuStack.style.setProperty('visibility', 'visible', 'important');
    navMenuStack.style.setProperty('opacity', '1', 'important');
    navMenuStack.style.setProperty('pointer-events', 'auto', 'important');
  }
};

// Master visibility engine: shows floating button after threshold unless expanded card is visible
const runVisibilityEngine = () => {
  const scrollPos = getScrollTop();
  log('runVisibilityEngine scrollPos=', scrollPos);

  const splashWrapper = document.getElementById('dashboard-splash-wrapper');
  const splashHeight = splashWrapper ? splashWrapper.offsetHeight : 0;
  const dynamicThreshold = splashHeight + SHOW_THRESHOLD_PX;

  const splashInView = splashWrapper ? splashMostlyInView : (scrollPos < 50);

  try {
    document.body.classList.toggle('splash-in-view', !!splashInView);
  } catch (e) { /* ignore in non-standard environments */ }

  forceShowNavOnMainPage();

  if (scrollPos < dynamicThreshold) {
    hideFloatingScrollTop();
    hideScrollTopDefensive();
    // forceShowNavOnMainPage already called above
    return;
  }

  if (currentExpandedCardElement) {
    const rect = currentExpandedCardElement.getBoundingClientRect();
    if (rect.bottom >= 0 && rect.top <= window.innerHeight) {
      log('expanded card visible — hiding floating & rails');
      hideFloatingScrollTop();
      hideScrollTopDefensive();
      return;
    }
  }

  log('showing floating + rails');
  showFloatingScrollTop();
 
  showScrollTopDefensive();
  forceShowNavOnMainPage();
};

const onScroll = () => {
  if (!rafScheduled) {
    rafScheduled = true;
    window.requestAnimationFrame(() => {
      runVisibilityEngine();
      rafScheduled = false;
    });
  }
};

/* ----- Splash visibility observer (avoid nav flicker) ----- */
const initSplashVisibilityObserver = () => {
  const splash = document.getElementById('dashboard-splash-wrapper');
  if (!splash) {
    splashMostlyInView = false;
    return;
  }

  // If IntersectionObserver available, use it and treat splash as "mostly visible" when intersectionRatio >= 0.5
  if (typeof IntersectionObserver !== 'undefined') {
    try {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.target !== splash) return;
          // Mark true only when at least half of the splash is visible.
          const mostly = !!entry.isIntersecting && entry.intersectionRatio >= 0.5;
          if (mostly !== splashMostlyInView) {
            splashMostlyInView = mostly;
            // trigger a run to update nav/controls quickly
            runVisibilityEngine();
          }
        });
      }, { root: null, threshold: [0, 0.25, 0.5, 0.75, 1] });
      io.observe(splash);

      // initialize flag synchronously
      try {
        const rect = splash.getBoundingClientRect();
        const approxRatio = Math.max(0, Math.min(1, (window.innerHeight - Math.max(0, rect.top)) / Math.max(1, rect.height)));
        splashMostlyInView = approxRatio >= 0.5;
      } catch (e) {
        splashMostlyInView = false;
      }
      return;
    } catch (e) {
      // fall through to fallback
    }
  }

  // Fallback: rAF-based bounding rect check (less precise)
  let rafScheduledFallback = false;
  const check = () => {
    try {
      const rect = splash.getBoundingClientRect();
      const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
      const ratio = visibleHeight / Math.max(1, rect.height);
      const mostly = ratio >= 0.5;
      if (mostly !== splashMostlyInView) {
        splashMostlyInView = mostly;
        runVisibilityEngine();
      }
    } catch (e) {
      splashMostlyInView = false;
    }
    rafScheduledFallback = false;
  };
  const schedule = () => { if (!rafScheduledFallback) { rafScheduledFallback = true; window.requestAnimationFrame(check); } };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  // initial check
  schedule();
};

/* ----- Expanded card observer ----- */
const initExpandedObserver = () => {
  if (typeof IntersectionObserver === 'undefined' || expandedObserver) return;
  expandedObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!currentExpandedCardElement || entry.target !== currentExpandedCardElement) return;
      // if expanded element mostly out of view, re-run engine (we might show floating)
      if (!entry.isIntersecting || entry.intersectionRatio < 0.05) {
        runVisibilityEngine();
      } else {
        hideFloatingScrollTop();
        hideScrollTopDefensive();
      }
    });
  }, { root: null, rootMargin: '0px', threshold: [0, 0.01, 0.05, 0.25, 0.5, 1] });
};

/* ----- Navigation controls initialization ----- */
const initializeNavigationControls = () => {
  // layout patch for collapsed nav to keep icons visible
  let stylePatch = document.getElementById('velopipe-layout-patch');
  if (!stylePatch) {
    stylePatch = document.createElement('style');
    stylePatch.id = 'velopipe-layout-patch';
    stylePatch.textContent = `
      .left-nav-menu-stack.collapsed .btn-char-icon,
      .left-nav-menu-stack.collapsed .nav-item-action-link svg,
      .left-nav-menu-stack.collapsed .btn-char-icon svg {
        display: inline-block !important;
        visibility: visible !important;
        opacity: 1 !important;
        width: 18px !important;
        height: 18px !important;
      }
      .left-nav-menu-stack.collapsed svg path,
      .left-nav-menu-stack.collapsed svg rect,
      .left-nav-menu-stack.collapsed svg circle,
      .left-nav-menu-stack.collapsed svg line {
        stroke: #ffffff !important;
        fill: none !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
      .left-nav-menu-stack.collapsed .btn-text-label {
        display: none !important;
        width: 0 !important;
      }
    `;
    document.head.appendChild(stylePatch);
  }

  // initial guard to avoid flash before JS runs
  ensureInitialFloatingHide();

  // ensure floating scroll-top exist
  if (!document.querySelector(FLOATING_BTN_SELECTOR)) {
    const btn = document.createElement('button');
    btn.className = 'scroll-top-btn';
    btn.setAttribute('aria-label', 'Scroll to Top');
    document.body.appendChild(btn);
  }

  // clear display inline flags to avoid mismatches
  document.querySelectorAll(`${FLOATING_BTN_SELECTOR}, ${RAIL_BTN_SELECTORS}`).forEach(b => {
    if (b.classList) b.classList.remove('btn-visible');
    try { b.style.removeProperty('display'); } catch (e) {}
  });

  // explicitly hide until engine allows showing
  hideScrollTopDefensive();

  // ensure left-nav exists (pre-rendering fallback)
  navMenuStack = document.querySelector('.left-nav-menu-stack');
  if (!navMenuStack) {
    navMenuStack = document.createElement('div');
    navMenuStack.className = 'left-nav-menu-stack collapsed';
    document.body.appendChild(navMenuStack);
  }

  // ensure toggle inline exists
  navToggleInline = navMenuStack.querySelector('.nav-toggle-inline');
  if (!navToggleInline) {
    navToggleInline = document.createElement('button');
    navToggleInline.className = 'nav-toggle-inline';
    navToggleInline.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 6h16M4 12h16M4 18h16"></path></svg>';
    navMenuStack.insertBefore(navToggleInline, navMenuStack.firstChild);
  }

  const ICON_SVGS = {
    aviation: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 12l20-7-7 20-3-8-8-3z"/></svg>',
    hydrogen: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>',
    infrastructure: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="7" height="14"/><rect x="14" y="7" width="7" height="10"/><path d="M7 21h10"/></svg>'
  };

  const ensureBtn = (className, handler, labelText = '', iconHtml = '') => {
    let btn = navMenuStack.querySelector(`.${className}`);
    if (!btn) {
      btn = document.createElement('button');
      btn.className = `${className} nav-item-action-link`;
      btn.innerHTML = `<span class="btn-char-icon" aria-hidden="true">${iconHtml}</span><span class="btn-text-label">${labelText}</span>`;
      navMenuStack.appendChild(btn);
    } else {
      let iconSpan = btn.querySelector('.btn-char-icon');
      if (!iconSpan) {
        iconSpan = document.createElement('span');
        iconSpan.className = 'btn-char-icon';
        iconSpan.setAttribute('aria-hidden', 'true');
        btn.insertBefore(iconSpan, btn.firstChild);
      }
      let textSpan = btn.querySelector('.btn-text-label');
      if (!textSpan) {
        textSpan = document.createElement('span');
        textSpan.className = 'btn-text-label';
        btn.appendChild(textSpan);
      }
      if (iconHtml) iconSpan.innerHTML = iconHtml;
      if (labelText) textSpan.textContent = labelText;
    }
    if (!btn.dataset.hasHandler) {
      btn.addEventListener('click', handler);
      btn.dataset.hasHandler = '1';
    }

    // Force the rail buttons to be visible immediately upon creation
    applyVisibleStyles(btn, true);
    return btn;
  };

  // rails: aviation/hydrogen/infrastructure
  scrollTopTwoBtn = ensureBtn('scroll-top-two-btn', () => {
    const el = document.querySelector('#aviation-section');
    if (!el) return;
    const top = getScrollTop() + el.getBoundingClientRect().top;
    safeScrollTo({ top: Math.max(0, top - 20) });
  }, 'Aviation', ICON_SVGS.aviation);

  scrollTopThreeBtn = ensureBtn('scroll-top-three-btn', () => {
    const el = document.querySelector('#hydrogen-section');
    if (!el) return;
    const top = getScrollTop() + el.getBoundingClientRect().top;
    safeScrollTo({ top: Math.max(0, top - 20) });
  }, 'Hydrogen', ICON_SVGS.hydrogen);

  scrollTopFourBtn = ensureBtn('scroll-top-four-btn', () => {
    const el = document.querySelector('#infrastructure-section');
    if (!el) return;
    const top = getScrollTop() + el.getBoundingClientRect().top;
    safeScrollTo({ top: Math.max(0, top - 20) });
  }, 'AI', ICON_SVGS.infrastructure);

  // floating click scrolls up to header (not to very top)
  document.querySelectorAll(FLOATING_BTN_SELECTOR).forEach(btn => {
    if (!btn.dataset.hasHandler) {
      btn.addEventListener('click', () => {
        const header = document.getElementById('live-header-anchor');
        if (header) {
          const absoluteTop = getScrollTop() + header.getBoundingClientRect().top;
          // a slight negative offset to ensure header is visible below any fixed UI if needed
          safeScrollTo({ top: Math.max(0, absoluteTop - 4), behavior: 'smooth' });
        } else {
          safeScrollTo({ top: 0, behavior: 'smooth' });
        }
      });
      btn.dataset.hasHandler = '1';
    }
    applyHiddenStyles(btn);
  });
};

/* ----- Nav handlers and card accordion setup ----- */
const attachRobustNavHandlers = () => {
  if (!navMenuStack || !navToggleInline) return;
  let backdrop = document.querySelector('.left-nav-backdrop') || document.createElement('div');
  if (!backdrop.parentNode) { backdrop.className = 'left-nav-backdrop'; document.body.appendChild(backdrop); }

  if (!navToggleInline.dataset.hasRobustToggle) {
    navToggleInline.addEventListener('click', (e) => {
      e.preventDefault();
      const isCollapsed = navMenuStack.classList.contains('collapsed');
      if (isCollapsed) {
        navMenuStack.classList.remove('collapsed');
        document.body.classList.add('nav-visible');
        userClosedNav = false;
        backdrop.classList.add('visible');
      } else {
        navMenuStack.classList.add('collapsed');
        document.body.classList.remove('nav-visible');
        userClosedNav = true;
        backdrop.classList.remove('visible');
      }
    });
    navToggleInline.dataset.hasRobustToggle = '1';
  }
};

const setupCardAccordions = () => {
  const sections = document.querySelectorAll('.section-wrapper');
  sections.forEach(section => {
    const listContainer = section.querySelector('.collapsible-pipeline-list');
    if (!listContainer) return;
    const listItems = listContainer.querySelectorAll('li');
    if (listItems.length <= 3) return;
    if (section.querySelector('.pipeline-toggle-btn')) return;

    for (let i = 3; i < listItems.length; i++) listItems[i].classList.add('row-collapsed-node');

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'pipeline-toggle-btn';
    toggleBtn.innerHTML = '<span>+ Read More</span>';
    section.appendChild(toggleBtn);

    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const isExpanded = toggleBtn.classList.contains('expanded');
      if (isExpanded) {
        for (let i = 3; i < listItems.length; i++) listItems[i].classList.add('row-collapsed-node');
        toggleBtn.classList.remove('expanded');
        toggleBtn.innerHTML = '<span>+ Read More</span>';
        if (currentExpandedCardElement === section) {
          // unobserve
          if (expandedObserver) expandedObserver.unobserve(currentExpandedCardElement);
          currentExpandedCardElement = null;
        }
        runVisibilityEngine();
        const top = getScrollTop() + section.getBoundingClientRect().top;
        safeScrollTo({ top: Math.max(0, top - 20), behavior: 'smooth' });
      } else {
        // collapse prior expanded if any
        if (currentExpandedCardElement && currentExpandedCardElement !== section) {
          try {
            const prevBtn = currentExpandedCardElement.querySelector('.pipeline-toggle-btn');
            if (prevBtn) {
              prevBtn.classList.remove('expanded');
              prevBtn.innerHTML = '<span>+ Read More</span>';
            }
            const prevItems = currentExpandedCardElement.querySelectorAll('.collapsible-pipeline-list li');
            for (let i = 3; i < prevItems.length; i++) prevItems[i].classList.add('row-collapsed-node');
            if (expandedObserver) expandedObserver.unobserve(currentExpandedCardElement);
          } catch (err) { /* swallow */ }
        }
        for (let i = 3; i < listItems.length; i++) listItems[i].classList.remove('row-collapsed-node');
        toggleBtn.classList.add('expanded');
        toggleBtn.innerHTML = '<span>- Read Less</span>';
        currentExpandedCardElement = section;
        // observe so we hide floating while it's visible
        if (expandedObserver) expandedObserver.observe(currentExpandedCardElement);
        hideFloatingScrollTop();
        hideScrollTopDefensive();
        setTimeout(() => {
          const targetTop = getScrollTop() + section.getBoundingClientRect().top;
          safeScrollTo({ top: Math.max(0, targetTop - 20), behavior: 'smooth' });
        }, 50);
      }
    });
  });
};

/* ----- Bootstrapping ----- */
const initVelopipeEngineNow = () => {
  log('Initializing Velopipe engine...');
  initializeNavigationControls();
  attachRobustNavHandlers();
  setupCardAccordions();
  initExpandedObserver();
  initSplashVisibilityObserver(); // <- initialize splash observer early so nav behavior is stable
  runVisibilityEngine();
};

if (document.readyState === 'interactive' || document.readyState === 'complete') {
  initVelopipeEngineNow();
} else {
  document.addEventListener('DOMContentLoaded', initVelopipeEngineNow);
}

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', () => runVisibilityEngine(), { passive: true });

// Splash click should go to header
const splash = document.getElementById('dashboard-splash-wrapper');
if (splash) {
  splash.addEventListener('click', () => {
    const header = document.getElementById('live-header-anchor');
    if (header) {
      const absoluteTop = getScrollTop() + header.getBoundingClientRect().top;
      safeScrollTo({ top: Math.max(0, absoluteTop - 4), behavior: 'smooth' });
    }
  });
}