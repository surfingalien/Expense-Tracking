import type { MetadataRoute } from 'next'

// Web app manifest: lets the tracker be installed to a phone's home screen
// and open full-screen like a native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Expense Tracker',
    short_name: 'Expenses',
    description: 'Track expenses, scan receipts and stay on budget.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f6f7f6',
    theme_color: '#059669',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
