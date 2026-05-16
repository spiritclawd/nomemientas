import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'nomemientas — ¿Qué dicen realmente los políticos?',
  description: 'Analiza discursos políticos al instante. Quita la retórica y descubre lo que realmente significan las palabras. Agnostico, sin partidismo. YouTube, Twitter, artículos y texto libre.',
  openGraph: {
    title: 'nomemientas — Analizador de discursos políticos',
    description: 'Pega una URL o un discurso y descubre el nivel de honestidad, las falacias y lo que realmente quieren decir.',
    url: 'https://nomemientas.org',
    siteName: 'nomemientas',
    locale: 'es_ES',
    type: 'website',
    images: [{ url: 'https://nomemientas.org/og.png', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'nomemientas — Analizador de discursos políticos',
    description: '¿Qué dicen cuando hablan? Analiza cualquier discurso político al instante.',
    images: ['https://nomemientas.org/og.png'],
  },
  robots: { index: true, follow: true },
  icons: { icon: '/favicon.svg' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-neutral-950 text-white antialiased">{children}</body>
    </html>
  )
}
