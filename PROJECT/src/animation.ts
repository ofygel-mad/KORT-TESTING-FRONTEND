import { gsap } from 'gsap';

const PHOTO_SCREEN = {
  left: 30.15,
  top: 31.15,
  width: 39.55,
  height: 41.9,
};

export function initLandingAnimation(root: HTMLElement): () => void {
  function req<T extends Element>(sel: string): T {
    const el = root.querySelector<T>(sel);
    if (!el) throw new Error(`Landing: missing element "${sel}"`);
    return el;
  }

  const body        = document.body;
  const intro       = req<HTMLElement>('[data-intro]');
  const introBrand  = req<HTMLElement>('[data-intro-brand]');
  const introVeil   = req<HTMLElement>('[data-intro-veil]');
  const introHint   = root.querySelector<HTMLElement>('[data-intro-hint]');
  const photo       = req<HTMLImageElement>('[data-photo]');
  const photoCanvas = req<HTMLElement>('[data-photo-canvas]');
  const photoScreen = req<HTMLElement>('[data-photo-screen]');
  const introVideo  = root.querySelector<HTMLVideoElement>('[data-intro-video]');
  const landingRoot = req<HTMLElement>('[data-landing-root]');
  const siteHeader  = req<HTMLElement>('[data-site-header]');
  const heroCopy    = req<HTMLElement>('[data-hero-copy]');
  const revealBlocks = gsap.utils.toArray<HTMLElement>('[data-reveal]', root);

  let introPlayed = false;

  function playVideo() {
    if (!introVideo) return;
    void introVideo.play().catch(() => undefined);
  }

  function getCoverBounds() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const nw = photo.naturalWidth || vw;
    const nh = photo.naturalHeight || vh;
    const scale = Math.max(vw / nw, vh / nh);
    const width  = nw * scale;
    const height = nh * scale;
    return { left: (vw - width) / 2, top: (vh - height) / 2, width, height };
  }

  function updatePhotoLayout() {
    const { left, top, width, height } = getCoverBounds();
    photoCanvas.style.left   = `${left}px`;
    photoCanvas.style.top    = `${top}px`;
    photoCanvas.style.width  = `${width}px`;
    photoCanvas.style.height = `${height}px`;
  }

  function applyPhotoScreenRect() {
    photoScreen.style.setProperty('--screen-left',   `${PHOTO_SCREEN.left}%`);
    photoScreen.style.setProperty('--screen-top',    `${PHOTO_SCREEN.top}%`);
    photoScreen.style.setProperty('--screen-width',  `${PHOTO_SCREEN.width}%`);
    photoScreen.style.setProperty('--screen-height', `${PHOTO_SCREEN.height}%`);
  }

  function getPhotoZoomMetrics() {
    const { left, top, width, height } = getCoverBounds();
    const sl = left + width  * (PHOTO_SCREEN.left   / 100);
    const st = top  + height * (PHOTO_SCREEN.top    / 100);
    const sw = width  * (PHOTO_SCREEN.width  / 100);
    const sh = height * (PHOTO_SCREEN.height / 100);
    const cx = sl + sw / 2;
    const cy = st + sh / 2;
    const scale = Math.max(window.innerWidth / sw, window.innerHeight / sh) * 0.80;
    return { x: window.innerWidth / 2 - cx, y: window.innerHeight / 2 - cy, scale, originX: cx - left, originY: cy - top };
  }

  function revealLanding() {
    gsap.set(landingRoot, { opacity: 0, y: 18, pointerEvents: 'none' });
    gsap.set(siteHeader,  { opacity: 0, y: -14 });
    gsap.set(heroCopy,    { opacity: 0, y: 28 });
    gsap.set(revealBlocks, { opacity: 0, y: 22 });
  }

  function triggerHeroSub() {
    const sub = root.querySelector<HTMLElement>('.hero-sub');
    if (sub) sub.classList.add('animate');
  }

  function revealVisibleBlocks() {
    const viewportHeight = window.innerHeight;

    revealBlocks.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const isVisible = rect.top < viewportHeight - 36 && rect.bottom > 0;

      if (isVisible) {
        gsap.set(el, { clearProps: 'opacity,transform' });
        el.classList.add('visible');
      }
    });
  }

  function runIntro() {
    if (introPlayed) return;
    introPlayed = true;

    const { x, y, scale, originX, originY } = getPhotoZoomMetrics();
    photoCanvas.style.transformOrigin = `${originX}px ${originY}px`;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(landingRoot,  { opacity: 1, y: 0, pointerEvents: 'auto' });
      gsap.set(siteHeader,   { opacity: 1, y: 0 });
      gsap.set(heroCopy,     { opacity: 1, y: 0 });
      gsap.set(revealBlocks, { clearProps: 'opacity,transform' });
      revealBlocks.forEach((el) => el.classList.add('visible'));
      gsap.set(intro, { autoAlpha: 0, pointerEvents: 'none' });
      body.classList.remove('intro-locked');
      revealVisibleBlocks();
      triggerHeroSub();
      return;
    }

    const ZOOM_END      = 0.05 + 1.18;
    const HOLD_DURATION = 0.6;
    const FADE_IN       = ZOOM_END + HOLD_DURATION;

    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      onComplete: () => {
        gsap.set(landingRoot, { pointerEvents: 'auto', clearProps: 'y' });
        body.classList.remove('intro-locked');
        revealVisibleBlocks();
        if (introVideo) introVideo.pause();
      },
    });

    tl.to(introBrand,  { opacity: 0, y: -20, duration: 0.32, ease: 'power2.out' }, 0)
      .to(introVeil,   { opacity: 0.7, duration: 0.82, ease: 'power2.inOut' }, 0)
      .to(photoCanvas, { x, y: y - 8, scale, duration: 1.18, ease: 'expo.inOut' }, 0.05)
      .to(photoScreen, { borderRadius: '0rem', duration: 0.96, ease: 'expo.inOut' }, 0.08);

    if (introHint) {
      tl.to(introHint, { opacity: 0, duration: 0.28 }, 0);
    }

    tl.to(introVeil, { opacity: 0, duration: 0.75, ease: 'power1.inOut' }, ZOOM_END + 0.1);

    if (introVideo) {
      tl.to(introVideo, { opacity: 0, duration: 0.9, ease: 'power2.inOut' }, FADE_IN);
    }

    tl.to(intro, { autoAlpha: 0, duration: 0.7, ease: 'power2.inOut' }, FADE_IN + 0.3)
      .to(landingRoot, { opacity: 1, y: 0, duration: 0.72, ease: 'power2.out' }, FADE_IN + 0.4)
      .to(siteHeader,  { opacity: 1, y: 0, duration: 0.4,  ease: 'power2.out' }, FADE_IN + 0.65)
      .to(heroCopy,    { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }, FADE_IN + 0.78)
      .call(triggerHeroSub, undefined, FADE_IN + 1.05);
  }

  function initHeroSub() {
    const ruText    = 'Единая платформа для управления производством, складом, финансами и командой. Быстрое внедрение. Всё в одном контуре.';
    const highlights = ['производством', 'складом', 'финансами'];
    const container = root.querySelector<HTMLElement>('#hero-sub-text .ru');
    if (!container) return;

    container.innerHTML = ruText.split(' ').map((word, i) => {
      const clean = word.replace(/[.,]/g, '');
      const punct = word.slice(clean.length);
      const delay = (0.05 + i * 0.045).toFixed(3);
      const inner = highlights.includes(clean)
        ? `<span class="word-highlight">${clean}</span>${punct}`
        : `${clean}${punct}`;
      return `<span class="word" style="animation-delay:${delay}s">${inner}</span>`;
    }).join(' ');
  }

  function initLang() {
    let lang = localStorage.getItem('kort-lang') ?? 'ru';

    function apply(l: string) {
      lang = l;
      localStorage.setItem('kort-lang', l);
      const on = l, off = l === 'ru' ? 'kz' : 'ru';
      root.querySelectorAll<HTMLElement>(`.${on}`).forEach(e => { e.style.display = ''; });
      root.querySelectorAll<HTMLElement>(`.${off}`).forEach(e => { e.style.display = 'none'; });
      root.querySelectorAll<HTMLButtonElement>('.lang-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.lang === l);
      });
      document.documentElement.lang = l === 'kz' ? 'kk' : 'ru';
    }

    root.querySelectorAll<HTMLButtonElement>('.lang-btn').forEach(b => {
      b.addEventListener('click', () => apply(b.dataset.lang ?? 'ru'));
    });
    apply(lang);
  }

  function initHeaderScroll(): () => void {
    const h = root.querySelector('.site-header');
    const handler = () => h?.classList.toggle('scrolled', window.scrollY > 24);
    window.addEventListener('scroll', handler, { passive: true });
    return handler;
  }

  function initReveal(): IntersectionObserver {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          gsap.set(e.target, { clearProps: 'opacity,transform' });
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -36px 0px' });
    root.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));
    return io;
  }

  // Boot
  body.classList.add('intro-locked');
  updatePhotoLayout();
  applyPhotoScreenRect();
  revealLanding();
  playVideo();
  initHeroSub();
  initLang();
  const scrollHandler = initHeaderScroll();
  const revealObserver = initReveal();

  if (!photo.complete) {
    photo.addEventListener('load', updatePhotoLayout, { once: true });
  }
  photoScreen.addEventListener('click', runIntro, { once: true });

  const resizeHandler = () => { updatePhotoLayout(); applyPhotoScreenRect(); };
  window.addEventListener('resize', resizeHandler);

  return () => {
    window.removeEventListener('resize', resizeHandler);
    window.removeEventListener('scroll', scrollHandler);
    revealObserver.disconnect();
    body.classList.remove('intro-locked');
    const targets = [landingRoot, siteHeader, heroCopy, intro, introBrand, introVeil, photoCanvas, photoScreen, introVideo, introHint, ...revealBlocks].filter(Boolean);
    gsap.killTweensOf(targets);
  };
}
