/**
 * @copylee/dsh-proxy — proxy settings for DeepSeek Harness.
 *
 * - `global`: one HTTP(S) proxy for every outbound request of the Harness
 *   (model calls, web search / fetch, HTTP MCP, spawned tools).
 * - `providers.<id>`: a proxy (or forced direct connection) for one LLM
 *   provider's model requests, overriding the global route for that provider.
 *
 * Both sections are volatile config, edited from the Settings page this
 * package ships (or `cordis.patch.yml`); changes apply to the next request.
 *
 * ```yaml
 * - id: dsh-proxy
 *   name: '@copylee/dsh-proxy'
 *   config:
 *     global:
 *       enabled: true
 *       url: http://127.0.0.1:7890
 *     providers:
 *       anthropic: { mode: proxy, url: http://127.0.0.1:7890 }
 *       deepseek: { mode: direct }
 * ```
 *
 * @module @copylee/dsh-proxy
 */
import type { Context } from '@deepseek-ai/cordis'
import { Config, type ProviderProxyConfig, type ProxySettings } from './config.ts'
import { acquireFetchRouter } from './fetch-router.ts'
import { detectSystemProxy } from './system-proxy.ts'
import { statusRoute } from './status-route.ts'
import { GlobalProxyLayer } from './global.ts'
import { createRouteTable, type RouteTable } from './provider-routes.ts'

export { Config } from './config.ts'
export type { GlobalProxyConfig, ProviderProxyConfig, ProxySettings } from './config.ts'
export { parseProxyUrl, redactProxyUrl, ProxyUrlError } from './proxy-url.ts'

export const name = '@copylee/dsh-proxy'

/**
 * How long a replaced provider route stays open. A stream that started on it
 * may still issue requests (a retry, a follow-up call) under its old scope.
 */
export const RETIRED_ROUTE_GRACE_MS = 10 * 60_000

/** The parts of the Harness `llm` service this plugin touches. */
interface LlmService {
  discoverModels?: (settingsNs: string, request: { provider?: string }, signal?: AbortSignal) => Promise<unknown>
}

/** The Context surface used here, typed locally so the plugin needs no dsh type packages. */
interface ProxyContext {
  effect(execute: () => (() => unknown) | void, label?: string): unknown
  on(name: string, listener: (...args: any[]) => any, options?: { global?: boolean }): () => void
  inject(deps: string[], callback: (ctx: ProxyContext) => void): unknown
  logger(name: string): { info(message: string): void; warn(message: string): void }
  webServer: { register(route: ReturnType<typeof statusRoute>): () => void }
  llm: LlmService
}

/** Read both live references once, for one reconciliation. */
function snapshot(config: Config): ProxySettings {
  return {
    global: config.global.get() ?? { enabled: false, url: '', noProxy: [] },
    providers: config.providers.get() ?? {},
  }
}

export function apply(context: Context, config: Config): void {
  const ctx = context as unknown as ProxyContext
  const logger = ctx.logger('dsh-proxy')
  // Keep the launch environment separate from proxy variables installed by this plugin.
  const launchEnv = { ...process.env }
  const detect = () => detectSystemProxy({ env: launchEnv })
  const global = new GlobalProxyLayer({
    detectSystemProxy: detect,
    info: message => { logger.info(message) },
    warn: message => { logger.warn(message) },
  })

  // Provider routes: rebuilt on every change, read on every request.
  let table: RouteTable = createRouteTable({}).table
  const retired = new Set<ReturnType<typeof setTimeout>>()
  let lastProviders: Readonly<Record<string, ProviderProxyConfig>> | undefined

  const updateProviders = (providers: Readonly<Record<string, ProviderProxyConfig>>): void => {
    if (providers === lastProviders) return
    lastProviders = providers
    const { table: next, issues } = createRouteTable(providers)
    for (const issue of issues) logger.warn(`提供商 ${issue.provider} 的代理未生效：${issue.message}`)
    for (const [provider, route] of next.routes) logger.info(`提供商 ${provider} → ${route.label}`)
    const previous = table
    table = next
    const timer = setTimeout(() => {
      retired.delete(timer)
      void previous.close()
    }, RETIRED_ROUTE_GRACE_MS)
    timer.unref?.()
    retired.add(timer)
  }

  let generation = 0
  let stopped = false
  let resolvedKey = ''
  const reconcile = (): void => {
    const settings = snapshot(config)
    const current = ++generation
    if (Object.values(settings.providers).some(entry => entry.enabled && entry.mode === 'system')) {
      void detect().then(system => {
        if (stopped || current !== generation) return
        const resolved = Object.fromEntries(Object.entries(settings.providers).map(([id, entry]) =>
          [id, entry.mode === 'system' ? { ...entry, mode: 'proxy' as const, url: system?.url ?? '' } : entry]))
        const key = JSON.stringify(resolved)
        if (key !== resolvedKey) { resolvedKey = key; updateProviders(resolved) }
      }).catch(error => logger.warn(`系统代理检测失败：${String(error)}`))
    } else {
      resolvedKey = ''
      updateProviders(settings.providers)
    }
    global.apply(settings.global).catch((error: unknown) => {
      logger.warn(`全局代理安装失败：${error instanceof Error ? error.message : String(error)}`)
    })
  }

  ctx.effect(() => {
    reconcile()
    const stop = ctx.on('loader/volatile-update', () => { reconcile() })
    const poll = setInterval(() => { if (snapshot(config).global.mode === 'system' || Object.values(snapshot(config).providers).some(entry => entry.enabled && entry.mode === 'system')) reconcile() }, 30_000)
    poll.unref?.()
    return async () => {
      stopped = true
      stop()
      clearInterval(poll)
      for (const timer of retired) clearTimeout(timer)
      retired.clear()
      await Promise.allSettled([global.close(), table.close()])
    }
  }, 'dsh-proxy: routes')

  ctx.inject(['webServer'], serverCtx => {
    serverCtx.effect(() => serverCtx.webServer.register(statusRoute(detect)), 'dsh-proxy: system proxy status')
  })

  // The provider layer needs the llm service; without it only the global layer runs.
  ctx.inject(['llm'], (llmCtx) => {
    llmCtx.effect(() => {
      const router = acquireFetchRouter()
      const stopStream = llmCtx.on('llm/stream', (options: { provider?: string }, next: () => AsyncIterable<unknown>) => {
        const route = options.provider === undefined ? undefined : table.routes.get(options.provider)
        return route === undefined ? next() : router.wrap(route.dispatcher, next)
      }, { global: true })

      // "Fetch available models" on the Models page should use the same route.
      const llm = llmCtx.llm
      const original = llm.discoverModels
      let patched: LlmService['discoverModels'] | undefined
      if (typeof original === 'function') {
        patched = function discoverModels(this: unknown, settingsNs, request, signal) {
          const route = request?.provider === undefined ? undefined : table.routes.get(request.provider)
          const call = () => original.call(this, settingsNs, request, signal)
          return route === undefined ? call() : router.run(route.dispatcher, call)
        }
        try {
          llm.discoverModels = patched
        } catch {
          patched = undefined
        }
      }

      return () => {
        stopStream()
        if (patched !== undefined && llm.discoverModels === patched) llm.discoverModels = original
        router.release()
      }
    }, 'dsh-proxy: provider routing')
  })
}
