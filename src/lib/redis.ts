import { Redis } from '@upstash/redis'

let redis: Redis | null = null

function getClient(): Redis {
  if (!redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN
    if (!url || !token) throw new Error('UPSTASH_NOT_CONFIGURED')
    redis = new Redis({ url, token })
  }
  return redis
}

export async function saveAnalysis(data: {
  url: string
  sourceType: string
  politician: string
  party: string
  translation: string
  honestyScore: number
  createdAt: string
}): Promise<string> {
  try {
    const client = getClient()
    const id = `an:${Date.now()}`
    await client.hset(id, {
      url: data.url,
      sourceType: data.sourceType,
      politician: data.politician,
      party: data.party,
      translation: data.translation,
      honestyScore: String(data.honestyScore),
      createdAt: data.createdAt,
    })
    await client.zadd('analyses', { score: Date.now(), member: id })
    const count = await client.zcard('analyses')
    if (count > 10000) await client.zremrangebyrank('analyses', 0, count - 10001)
    if (data.politician && data.politician !== 'Desconocido') {
      const pk = `pol:${data.politician.toLowerCase().replace(/\s+/g, '_')}`
      await client.hincrby(pk, 'total_checks', 1)
      await client.hincrby(pk, 'honesty_sum', data.honestyScore)
      await client.hset(pk, { latest_translation: data.translation, last_seen: data.createdAt, name: data.politician })
      await client.sadd('politicians', pk)
    }
    return id
  } catch {
    return `an:${Date.now()}`
  }
}

export async function getRecentAnalyses(limit = 20): Promise<any[]> {
  try {
    const client = getClient()
    const ids = await client.zrange<string[]>('analyses', 0, limit - 1, { rev: true })
    if (!ids?.length) return []
    const results: any[] = []
    for (const id of ids) {
      const r = await client.hgetall(id) as Record<string, string>
      if (r?.createdAt) {
        results.push({
          politician: r.politician || '',
          party: r.party || '',
          honestyScore: parseFloat(r.honestyScore || '0'),
          translation: r.translation || '',
          createdAt: r.createdAt,
        })
      }
    }
    return results
  } catch {
    return []
  }
}

export async function getLeaderboard(limit = 20): Promise<any[]> {
  try {
    const client = getClient()
    const keys = await client.smembers('politicians')
    if (!keys?.length) return []
    const results: any[] = []
    for (const key of keys) {
      const r = await client.hgetall(key) as Record<string, string>
      if (r?.total_checks) {
        results.push({
          name: r.name || 'Desconocido',
          total_checks: parseInt(r.total_checks),
          avg_honesty: r.honesty_sum
            ? parseFloat((parseFloat(r.honesty_sum) / parseInt(r.total_checks)).toFixed(1))
            : 0,
          latest_translation: r.latest_translation || '',
          last_seen: r.last_seen || '',
        })
      }
    }
    return results.sort((a, b) => b.total_checks - a.total_checks).slice(0, limit)
  } catch {
    return []
  }
}

export async function getTodayStats(): Promise<{ analysesToday: number; positive: number; negative: number }> {
  try {
    const client = getClient()
    const today = new Date().toISOString().slice(0, 10)
    const data = await client.hgetall(`stats:${today}`) as Record<string, string>
    return {
      analysesToday: parseInt(String(data?.analyses || '0')),
      positive: parseInt(String(data?.positive || '0')),
      negative: parseInt(String(data?.negative || '0')),
    }
  } catch {
    return { analysesToday: 0, positive: 0, negative: 0 }
  }
}

export async function incrementAnalysesCount(): Promise<void> {
  try {
    const client = getClient()
    const today = new Date().toISOString().slice(0, 10)
    await client.hincrby(`stats:${today}`, 'analyses', 1)
  } catch {}
}

export async function recordFeedback(_analysisId: string | null, vote: 'up' | 'down'): Promise<void> {
  try {
    const client = getClient()
    const today = new Date().toISOString().slice(0, 10)
    await client.hincrby(`stats:${today}`, vote === 'up' ? 'positive' : 'negative', 1)
  } catch {}
}

export async function recordEvent(eventType: string): Promise<void> {
  try {
    const client = getClient()
    const today = new Date().toISOString().slice(0, 10)
    await client.hincrby(`events:${today}`, eventType, 1)
  } catch {}
}

export async function checkRateLimit(ip: string, max = 10, window = 60): Promise<boolean> {
  try {
    const client = getClient()
    const key = `ratelimit:${ip}`
    const count = await client.incr(key)
    if (count === 1) await client.expire(key, window)
    return count <= max
  } catch {
    return true
  }
}
