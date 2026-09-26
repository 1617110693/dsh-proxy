/**
 * The per-provider route table: provider id → the dispatcher its model
 * requests use. Dispatchers are shared per proxy URL, and a replaced table is
 * closed gracefully (`close()`, not `destroy()`) so a stream already running
 * on it finishes.
 */
import { Agent, ProxyAgent, type Dispatcher } from 'undici'
import type { ProviderProxyConfig } from './config.ts'
import { parseProxyUrl, redactProxyUrl } from './proxy-url.ts'

export interface ProviderRoute {
  readonly dispatcher: Dispatcher
  /** Credential-free description for logs and status. */
  readonly label: string
}

export interface RouteTable {
  readonly routes: ReadonlyMap<string, ProviderRoute>
  close(): Promise<void>
}

export interface RouteIssue {
  provider: string
  message: string
}

/**
 * Build the dispatchers for every enabled provider entry.
 * @param providers - the `providers` section.
 * @returns the table, plus one issue per entry that could not be used (it stays on the global route).
 */
export function createRouteTable(providers: Readonly<Record<string, ProviderProxyConfig>>): { table: RouteTable; issues: RouteIssue[] } {
  const routes = new Map<string, ProviderRoute>()
  const owned = new Map<string, Dispatcher>()
  const issues: RouteIssue[] = []
  for (const [provider, entry] of Object.entries(providers)) {
    if (!entry.enabled) continue
    if (entry.mode === 'direct') {
      let direct = owned.get('direct')
      if (direct === undefined) owned.set('direct', direct = new Agent())
      routes.set(provider, { dispatcher: direct, label: '直连' })
      continue
    }
    let url: URL
    try {
      url = parseProxyUrl(entry.url)
    } catch (error) {
      issues.push({ provider, message: (error as Error).message })
      continue
    }
    const key = url.href
    let dispatcher = owned.get(key)
    if (dispatcher === undefined) owned.set(key, dispatcher = new ProxyAgent({ uri: key.replace(/\/$/, '') }))
    routes.set(provider, { dispatcher, label: redactProxyUrl(url) })
  }
  return {
    table: {
      routes,
      async close() {
        await Promise.allSettled([...owned.values()].map(dispatcher => dispatcher.close()))
      },
    },
    issues,
  }
}
