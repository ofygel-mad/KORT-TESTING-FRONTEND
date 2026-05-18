import landingTemplate from './landing.html?raw';

const LANDING_ASSET_BASE = '/landing';

const assetMap = {
  '{{PHOTO_SRC}}': `${LANDING_ASSET_BASE}/hero-bg.jpg`,
  '{{LOGO_SRC}}': `${LANDING_ASSET_BASE}/KORT_logo.png`,
  '{{INTRO_VIDEO_SRC}}': 'https://pub-54ef96240f3c45c6acd4dcef2d6b0d7c.r2.dev/dp3gVMPnDTxLXWhpni3d+d2f3GpMzqFQ.mp4',
  '{{KASPI_LOGO_SRC}}': `${LANDING_ASSET_BASE}/kaspi.svg`,
  '{{WHATSAPP_LOGO_SRC}}': `${LANDING_ASSET_BASE}/whatsapp.svg`,
  '{{POWERBI_LOGO_SRC}}': `${LANDING_ASSET_BASE}/powerbi.svg`,
} as const;

function normalizeAppUrl(appUrl: string): string {
  return appUrl.replace(/\/+$/, '');
}

export function getLandingHTML(appUrl: string): string {
  let html = landingTemplate;

  Object.entries(assetMap).forEach(([token, value]) => {
    html = html.split(token).join(value);
  });

  return html.split('{{APP_URL}}').join(normalizeAppUrl(appUrl));
}
