import { Metadata } from 'next'
import Database from 'better-sqlite3'
import * as path from 'path'

type Props = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  
  const DB_PATH = path.join(process.cwd(), 'db', 'nomemientas.db')
  let db: Database.Database | null = null
  
  try {
    db = new Database(DB_PATH, { readonly: true })
    
    const politician = db.prepare(`
      SELECT p.*, pa.name as party_name, pa.short_name as party_short_name
      FROM politicians p
      LEFT JOIN parties pa ON p.party_id = pa.id
      WHERE p.slug = ?
    `).get(slug) as any
    
    if (!politician) {
      return { title: 'Político no encontrado — nomemientas' }
    }
    
    const score = db.prepare(`
      SELECT score FROM score_history 
      WHERE politician_id = ? AND score_type = 'composite'
    `).get(politician.id) as any
    
    const scoreValue = score?.score?.toFixed(1) || '?'
    const partyText = politician.party_short_name ? ` (${politician.party_short_name})` : ''
    
    return {
      title: `${politician.display_name}${partyText} — Honestidad ${scoreValue}/10 | nomemientas`,
      description: `Análisis de honestidad de ${politician.display_name}${partyText}: ${scoreValue}/10. Biografía, promesas, legislación y análisis de discursos.`,
      openGraph: {
        title: `${politician.display_name}${partyText} — Honestidad ${scoreValue}/10`,
        description: `Análisis completo de ${politician.display_name}: biografía, promesas y nivel de honestidad según nomemientas.`,
        url: `https://nomemientas.org/politico/${slug}`,
        siteName: 'nomemientas',
        locale: 'es_ES',
        type: 'profile',
        images: [{
          url: `https://nomemientas.org/api/og?politician=${encodeURIComponent(politician.display_name)}&score=${scoreValue}&party=${encodeURIComponent(politician.party_short_name || '')}`,
          width: 1200,
          height: 630,
        }],
      },
      twitter: {
        card: 'summary_large_image',
        title: `${politician.display_name}${partyText} — Honestidad ${scoreValue}/10`,
        description: `Análisis de honestidad de ${politician.display_name} según nomemientas`,
        images: [`https://nomemientas.org/api/og?politician=${encodeURIComponent(politician.display_name)}&score=${scoreValue}&party=${encodeURIComponent(politician.party_short_name || '')}`],
      },
    }
  } catch (e) {
    return { title: 'nomemientas — Análisis político' }
  } finally {
    db?.close()
  }
}

export default function PoliticoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
