import { prisma } from '@/lib/prisma'

interface TokenCache {
  token: string
  expiresAt: number
}

let tokenCache: TokenCache | null = null

export async function getPayrocToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.token
  }

  const dbToken = await prisma.payrocToken.findFirst({
    orderBy: { createdAt: 'desc' },
  })

  if (dbToken && dbToken.expiresAt.getTime() > Date.now() + 60000) {
    tokenCache = {
      token: dbToken.token,
      expiresAt: dbToken.expiresAt.getTime(),
    }
    return dbToken.token
  }

  const apiKey = process.env.PAYROC_API_KEY
  const authUrl = process.env.PAYROC_AUTH_URL

  if (!apiKey || !authUrl) {
    throw new Error('Payroc credentials not configured')
  }

  const response = await fetch(authUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({}),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Payroc auth failed: ${response.status} ${error}`)
  }

  const data = await response.json()
  const expiresAt = Date.now() + data.expiresIn * 1000

  tokenCache = {
    token: data.token,
    expiresAt,
  }

  await prisma.payrocToken.deleteMany({})
  await prisma.payrocToken.create({
    data: {
      token: data.token,
      expiresAt: new Date(expiresAt),
    },
  })

  return tokenCache.token
}

export async function payrocRequest<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<T> {
  const token = await getPayrocToken()
  const baseUrl = process.env.PAYROC_API_URL

  if (!baseUrl) {
    throw new Error('Payroc API URL not configured')
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Payroc API error: ${response.status} ${path} ${error}`)
  }

  if (response.status === 204) {
    return {} as T
  }

  return response.json()
}
