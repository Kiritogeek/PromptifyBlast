import type { Metadata } from 'next'
import './globals.css'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { OrganizationSchema, WebSiteSchema, SoftwareApplicationSchema } from '@/components/StructuredData'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://promptifyblast.com'),
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },
  title: {
    default: 'PromptifyBlast - Générateur de Prompts IA Optimisés',
    template: '%s | PromptifyBlast'
  },
  description: 'Générez des prompts optimisés pour ChatGPT, Gemini et Grok. Transformez vos idées en prompts parfaits pour l\'IA en quelques secondes. Mode Basique, Pro et Ultra-Optimisé.',
  keywords: ['prompt IA', 'générateur prompt', 'ChatGPT prompt', 'Gemini prompt', 'Grok prompt', 'optimisation prompt', 'prompt engineering', 'IA', 'intelligence artificielle'],
  authors: [{ name: 'PromptifyBlast' }],
  creator: 'PromptifyBlast',
  publisher: 'PromptifyBlast',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: '/',
    siteName: 'PromptifyBlast',
    title: 'PromptifyBlast - Générateur de Prompts IA Optimisés',
    description: 'Générez des prompts optimisés pour ChatGPT, Gemini et Grok. Transformez vos idées en prompts parfaits pour l\'IA.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'PromptifyBlast - Générateur de Prompts IA',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PromptifyBlast - Générateur de Prompts IA Optimisés',
    description: 'Générez des prompts optimisés pour ChatGPT, Gemini et Grok.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // google: 'votre-code-verification-google',
    // yandex: 'votre-code-verification-yandex',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className="flex flex-col min-h-screen">
        <OrganizationSchema />
        <WebSiteSchema />
        <SoftwareApplicationSchema />
        <Header />
        <main className="flex-grow">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}


