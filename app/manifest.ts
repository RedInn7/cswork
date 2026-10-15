import type { MetadataRoute } from 'next';

/**
 * /manifest.webmanifest: installs cswork to a home screen; colours are the light theme's page.
 * In English, the default locale: browsers fetch it without cookies, so it can't follow the reader's.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'cswork',
    short_name: 'cswork',
    description: 'Algorithm problems, company OAs, mock interviews and a job search guide.',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    theme_color: '#f3f6f4',
    background_color: '#f3f6f4',
    lang: 'en',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
