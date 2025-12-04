import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PromptifyBlast - Générateur de Prompts IA',
    short_name: 'PromptifyBlast',
    description: 'Générez des prompts optimisés pour ChatGPT, Gemini et Grok',
    start_url: '/',
    display: 'standalone',
    background_color: '#111827',
    theme_color: '#2563eb',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}

