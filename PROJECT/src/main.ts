import { initLandingAnimation } from './animation';
import { getLandingHTML } from './template';
import landingCSS from './style.css?inline';

const FONT_PRECONNECT_URLS = [
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
] as const;
const FONT_STYLESHEET_URL = 'https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap';

export type MountLandingOptions = {
  appUrl?: string;
  onLogin?: () => void;
  onRegister?: () => void;
};

export function mountLanding(container: HTMLElement, options: MountLandingOptions = {}): () => void {
  const style = document.createElement('style');
  style.textContent = landingCSS;
  document.head.appendChild(style);

  const preconnectLinks = FONT_PRECONNECT_URLS.map((href) => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = href;
    if (href.includes('gstatic')) {
      link.crossOrigin = 'anonymous';
    }
    document.head.appendChild(link);
    return link;
  });

  const fontStylesheet = document.createElement('link');
  fontStylesheet.rel = 'stylesheet';
  fontStylesheet.href = FONT_STYLESHEET_URL;
  document.head.appendChild(fontStylesheet);

  container.innerHTML = getLandingHTML(options.appUrl ?? '');

  container.querySelectorAll<HTMLElement>('[data-kort-action]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const action = el.dataset.kortAction;
      if (action === 'login') options.onLogin?.();
      else if (action === 'register') options.onRegister?.();
    });
  });

  let cleanup: (() => void) | undefined;
  try {
    cleanup = initLandingAnimation(container);
  } catch (error) {
    console.error('[landing] animation init failed:', error);
  }

  return () => {
    cleanup?.();
    container.innerHTML = '';
    style.remove();
    fontStylesheet.remove();
    preconnectLinks.forEach((link) => link.remove());
  };
}

const standaloneRoot = document.querySelector<HTMLElement>('#project-landing-root');

if (standaloneRoot) {
  mountLanding(standaloneRoot);
}
