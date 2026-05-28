import { MetadataRoute } from 'next'
import Database from 'better-sqlite3'
import * as path from 'path'

export default function sitemap(): MetadataRoute.Sitemap {
  const DB_PATH = path.join(process.cwd(), 'db', 'nomemientas.db')
  let db: Database.Database | null = null
  
  try {
    db = new Database(DB_PATH, { readonly: true })
    
    // Get all politicians
    const politicians = db.prepare('SELECT slug, updated_at FROM politicians').all() as any[]
    
    // Get all parties
    const parties = db.prepare('SELECT slug, updated_at FROM parties').all() as any[]
    
    // Static pages
    const staticPages = [
      {
        url: 'https://nomemientas.org',
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 1,
      },
    ]
    
    // Politician pages
    const politicianPages = politicians.map(p => ({
      url: `https://nomemientas.org/politico/${p.slug}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))
    
    // Party pages
    const partyPages = parties.map(p => ({
      url: `https://nomemientas.org/partido/${p.slug}`,
      lastModified: new Date(p.updated_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))
    
    // Comparison pages (top party combinations)
    const topParties = ['pp', 'psoe', 'vox', 'sumar', 'erc', 'junts', 'podemos']
    const comparisonPages = []
    for (let i = 0; i < topParties.length; i++) {
      for (let j = i + 1; j < topParties.length; j++) {
        comparisonPages.push({
          url: `https://nomemientas.org/comparar/${topParties[i]}-vs-${topParties[j]}`,
          lastModified: new Date(),
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        })
      }
    }
    
    return [...staticPages, ...politicianPages, ...partyPages, ...comparisonPages]
  } catch (e) {
    console.error('Sitemap error:', e)
    return [{ url: 'https://nomemientas.org', lastModified: new Date() }]
  } finally {
    db?.close()
  }
}
