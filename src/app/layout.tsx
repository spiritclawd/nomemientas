import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'nomemientas — ¿Qué te están diciendo realmente?',
  description: 'Analiza discursos políticos. Quita la retórica y te dice lo que realmente significan las palabras de los políticos. Agnóstico, sin partidismo.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🗣️</text></svg>" />
      </head>
      <body>{children}</body>
    </html>
  )
}
