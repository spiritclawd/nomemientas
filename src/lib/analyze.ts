import * as path from 'path'
import * as fs from 'fs'

const ANALYSIS_SYSTEM_PROMPT = `Eres un analista de discurso político estrictamente agnóstico. Tu único trabajo es desmontar lo que dice un político y explicar en lenguaje llano qué significa realmente.

No tomas partido por ninguna ideología. Un político de cualquier partido recibe exactamente el mismo tratamiento. Tu credibilidad depende de ser justo con TODOS.

Analiza el texto proporcionado y devuelve un JSON con esta estructura EXACTA:

{
  "resumen": "Un párrafo en lenguaje coloquial explicando qué dijo realmente el político, sin rodeos.",
  "afirmaciones_clave": [
    {
      "texto": "La afirmación concreta",
      "tipo": "dato|promesa|opinión|ataque",
      "verificable": true,
      "explicacion": "Qué significa esto en la práctica"
    }
  ],
  "lenguaje_emocional": ["Términos cargados emocionalmente que usó para manipular"],
  "falacias": [
    {
      "tipo": "Nombre de la falacia (hombre de paja, pendiente resbaladiza, etc.)",
      "ejemplo": "Lo que dijo exactamente",
      "explicacion": "Por qué es una falacia"
    }
  ],
  "vago_vs_concreto": {
    "vago": ["Frases vacías sin contenido real"],
    "concreto": ["Compromisos o datos verificables"]
  },
  "que_se_deja_fuera": "Lo que NO dijo que sería relevante mencionar sobre el tema",
  "traduccion_llana": "Si tuvieras que explicarle a tu abuela qué dijo este político en una frase",
  "nivel_honestidad": 0-10
}

REGLAS:
1. Identifica al político y su partido si puedes deducirlo del contexto
2. Si el texto menciona datos, indica si son verificables
3. Señala promesas vagas vs compromisos concretos
4. Detecta falacias lógicas por nombre
5. Señala lo que se calla intencionadamente
6. NO juzgues ideología - juzga honestidad discursiva
7. El mismo análisis se aplicaría idéntico sea de izquierdas o derechas
8. Responde en español`

export async function analyzeText(text: string): Promise<{
  analysis: Record<string, any>
  politician: string
  party: string
}> {
  if (!text || text.length < 50) {
    throw new Error('Texto insuficiente para analizar')
  }

  // Trim to reasonable length (most speeches are 5K-20K chars)
  const trimmedText = text.slice(0, 30000)

  const authPath = path.join(process.env.HOME || '/home/carlos', '.hermes', 'auth.json')
  let apiKey = ''
  let baseUrl = ''

  if (fs.existsSync(authPath)) {
    const auth = JSON.parse(fs.readFileSync(authPath, 'utf-8'))
    if (auth.providers?.nous) {
      apiKey = auth.providers.nous.agent_key
      baseUrl = auth.providers.nous.inference_base_url
    }
  }

  if (!apiKey) {
    throw new Error('Nous API credentials not found')
  }

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'moonshotai/kimi-k2',
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
        { role: 'user', content: `Analiza este discurso/texto político:\n\n${trimmedText}` }
      ],
      temperature: 0.3,
      max_tokens: 3000,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(60000),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content

  if (!content) {
    throw new Error('Empty response from analysis model')
  }

  // Parse JSON from the response (sometimes wrapped in markdown code blocks)
  let parsed: Record<string, any>
  try {
    const cleaned = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('Failed to parse analysis JSON response')
  }

  // Extract politician/party if detected (we'll pass this to the DB)
  let politician = 'Desconocido'
  let party = ''

  // Try to detect from source URL context - the LLM might include it in analisis
  if (parsed.resumen) {
    const nameMatch = parsed.resumen.match(/([A-Z][a-záéíóú]{3,}\s[A-ZÁÉÍÓÚ][a-záéíóú]{2,})/)
    if (nameMatch) politician = nameMatch[1]
  }

  return { analysis: parsed, politician, party }
}
