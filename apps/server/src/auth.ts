import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { and, eq } from 'drizzle-orm'
import { db } from '@scrolltell/db'
import { organizationMembers, organizations, oauthAccounts, sessions, users, workspaces } from '@scrolltell/db/schema'

const SESSION_COOKIE = 'scrolltell_session'
const STATE_COOKIE = 'scrolltell_oauth_state'
const sessionTtlMs = 1000 * 60 * 60 * 24 * 30
const isProduction = process.env.NODE_ENV === 'production'
const appUrl = process.env.APP_URL ?? `http://127.0.0.1:${process.env.PORT ?? 8787}`

export type AuthUser = typeof users.$inferSelect
export type AuthContext = { user: AuthUser; organizationId: string; role: 'owner' | 'admin' | 'member' }

type Provider = 'github' | 'google'
type ProviderProfile = { id: string; email: string; name: string }

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function cookieOptions(maxAge?: number) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: isProduction, path: '/', ...(maxAge === undefined ? {} : { maxAge }) }
}

export function getAppUrl() {
  return appUrl.replace(/\/$/, '')
}

export function getProviderConfig(provider: Provider) {
  const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`]
  const clientSecret = process.env[`${provider.toUpperCase()}_CLIENT_SECRET`]
  if (!clientId || !clientSecret) return null
  return { clientId, clientSecret }
}

export function beginOAuth(reply: FastifyReply, provider: Provider) {
  const config = getProviderConfig(provider)
  if (!config) return false
  const state = randomBytes(32).toString('hex')
  reply.setCookie(STATE_COOKIE, `${provider}:${state}`, { ...cookieOptions(600), signed: false })
  const redirectUri = `${getAppUrl()}/auth/${provider}/callback`
  const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: redirectUri, state })
  if (provider === 'github') {
    params.set('scope', 'read:user user:email')
    reply.redirect(`https://github.com/login/oauth/authorize?${params}`)
  } else {
    params.set('response_type', 'code')
    params.set('scope', 'openid email profile')
    reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  }
  return true
}

export function validateOAuthState(request: FastifyRequest, provider: Provider) {
  const expected = request.cookies[STATE_COOKIE]
  const [stateProvider, state] = expected?.split(':') ?? []
  const provided = (request.query as { state?: string }).state
  return stateProvider === provider && !!state && !!provided && state === provided
}

async function fetchProfile(provider: Provider, code: string) {
  const config = getProviderConfig(provider)
  if (!config) throw new Error(`${provider} OAuth is not configured`)
  const redirectUri = `${getAppUrl()}/auth/${provider}/callback`
  const tokenParams = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: redirectUri })
  const tokenResponse = await fetch(provider === 'github' ? 'https://github.com/login/oauth/access_token' : 'https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' }, body: tokenParams,
  })
  if (!tokenResponse.ok) throw new Error(`OAuth token exchange failed: ${tokenResponse.status}`)
  const token = await tokenResponse.json() as { access_token?: string }
  if (!token.access_token) throw new Error('OAuth provider returned no access token')
  if (provider === 'github') {
    const profileResponse = await fetch('https://api.github.com/user', { headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token.access_token}` } })
    if (!profileResponse.ok) throw new Error('Could not load GitHub profile')
    const profile = await profileResponse.json() as { id: number; login: string; name?: string; email?: string }
    let email = profile.email
    if (!email) {
      const emailsResponse = await fetch('https://api.github.com/user/emails', { headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token.access_token}` } })
      const emails = await emailsResponse.json() as Array<{ email: string; primary: boolean; verified: boolean }>
      email = emails.find((item) => item.primary && item.verified)?.email ?? emails.find((item) => item.verified)?.email
    }
    if (!email) throw new Error('GitHub did not provide a verified email address')
    return { profile: { id: String(profile.id), email: email.toLowerCase(), name: profile.name ?? profile.login }, accessToken: token.access_token }
  }
  const profileResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: `Bearer ${token.access_token}` } })
  if (!profileResponse.ok) throw new Error('Could not load Google profile')
  const profile = await profileResponse.json() as { sub: string; email?: string; email_verified?: boolean; name?: string }
  if (!profile.email || !profile.email_verified) throw new Error('Google did not provide a verified email address')
  return { profile: { id: profile.sub, email: profile.email.toLowerCase(), name: profile.name ?? profile.email.split('@')[0] }, accessToken: token.access_token }
}

export async function completeOAuth(request: FastifyRequest, reply: FastifyReply, provider: Provider) {
  if (!validateOAuthState(request, provider)) throw new Error('Invalid OAuth state')
  const code = (request.query as { code?: string }).code
  if (!code) throw new Error('OAuth provider returned no authorization code')
  const { profile } = await fetchProfile(provider, code)
  const now = new Date().toISOString()
  let [user] = await db.select().from(users).where(eq(users.email, profile.email)).limit(1)
  if (!user) {
    const userId = randomUUID()
    await db.insert(users).values({ id: userId, email: profile.email, displayName: profile.name, createdAt: now, updatedAt: now })
    ;[user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  } else {
    await db.update(users).set({ displayName: profile.name, updatedAt: now }).where(eq(users.id, user.id))
  }
  const existingAccount = await db.select().from(oauthAccounts).where(and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerAccountId, profile.id))).limit(1)
  if (!existingAccount.length) await db.insert(oauthAccounts).values({ id: randomUUID(), userId: user.id, provider, providerAccountId: profile.id, createdAt: now, updatedAt: now })
  let [membership] = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, user.id)).limit(1)
  if (!membership) {
    const organizationId = randomUUID()
    await db.insert(organizations).values({ id: organizationId, name: `${profile.name}'s organization`, slug: `org-${user.id.slice(0, 8)}`, createdAt: now, updatedAt: now })
    await db.insert(organizationMembers).values({ id: randomUUID(), organizationId, userId: user.id, role: 'owner', createdAt: now, updatedAt: now })
    await db.insert(workspaces).values({ id: randomUUID(), organizationId, ownerUserId: user.id, name: 'Personal workspace', slug: `personal-${user.id.slice(0, 8)}`, createdAt: now, updatedAt: now })
    ;[membership] = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, user.id)).limit(1)
  }
  const rawToken = randomBytes(32).toString('hex')
  await db.insert(sessions).values({ id: randomUUID(), userId: user.id, tokenHash: hash(rawToken), expiresAt: new Date(Date.now() + sessionTtlMs).toISOString(), createdAt: now })
  reply.clearCookie(STATE_COOKIE, cookieOptions())
  reply.setCookie(SESSION_COOKIE, rawToken, cookieOptions(Math.floor(sessionTtlMs / 1000)))
  return { user, membership }
}

export async function getAuthContext(request: FastifyRequest): Promise<AuthContext | null> {
  const rawToken = request.cookies[SESSION_COOKIE]
  if (!rawToken) return null
  const [session] = await db.select({ session: sessions, user: users }).from(sessions).innerJoin(users, eq(sessions.userId, users.id)).where(eq(sessions.tokenHash, hash(rawToken))).limit(1)
  if (!session || session.session.expiresAt <= new Date().toISOString() || session.user.status !== 'active') return null
  const [membership] = await db.select().from(organizationMembers).where(eq(organizationMembers.userId, session.user.id)).limit(1)
  if (!membership) return null
  return { user: session.user, organizationId: membership.organizationId, role: membership.role }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const context = await getAuthContext(request)
  if (!context) {
    await reply.code(401).send({ error: 'Authentication required' })
    return null
  }
  return context
}

export function clearSession(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, cookieOptions())
}

export const authCookieName = SESSION_COOKIE
export const authSessionHash = hash
export type { Provider, ProviderProfile }
export { fetchProfile }
