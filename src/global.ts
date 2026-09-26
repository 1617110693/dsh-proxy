/**
 * Global layer: route every outbound request of this process through one
 * proxy chosen in Settings.
 *
 * It installs through the Harness's own `@deepseek-ai/dsh-http-proxy`, the
 * package the launcher already used for `HTTP(S)_PROXY`, so the loopback
 * bypass, `NO_PROXY` matching, `proxyRouteFor()` (web_fetch) and the proxy
 * environment of spawned tools all see the same answer. That package's
 * installs stack and each disposer restores the layer beneath it, so this
 * layer always disposes the previous install before making the next one.
 */
import type { GlobalProxyConfig } from './config.ts'
import { parseProxyUrl, redactProxyUrl } from './proxy-url.ts'

type Dispose = () => Promise<void>

/** The subset of `@deepseek-ai/dsh-http-proxy` this layer uses. */
export interface HttpProxyModule {
  installProxyFromEnvironment(
    env: { get(name: string): { readonly value: string } | undefined },
    report: (message: string) => void,
  ): Promise<Dispose>
}

export interface GlobalLayerOptions {
  /** Loads the Harness's proxy package; resolves `undefined` when the host does not ship it. */
  loadHttpProxy?: () => Promise<HttpProxyModule | undefined>
  info(message: string): void
  warn(message: string): void
}

/** Loopback is always direct: the Web UI and local servers would otherwise loop through the proxy. */
const LOOPBACK = ['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']

async function loadHostHttpProxy(): Promise<HttpProxyModule | undefined> {
  try {
    return await import('@deepseek-ai/dsh-http-proxy') as HttpProxyModule
  } catch {
    return undefined
  }
}

/**
 * Fallback for a Harness without `dsh-http-proxy`: swap undici's global
 * dispatcher directly.
 */
async function installWithUndici(url: string, noProxy: readonly string[]): Promise<Dispose> {
  const { EnvHttpProxyAgent, getGlobalDispatcher, setGlobalDispatcher } = await import('undici')
  const previous = getGlobalDispatcher()
  const agent = new EnvHttpProxyAgent({
    httpProxy: url,
    httpsProxy: url,
    noProxy: [...LOOPBACK, ...noProxy].join(','),
  })
  setGlobalDispatcher(agent)
  return async () => {
    if (getGlobalDispatcher() === agent) setGlobalDispatcher(previous)
    await agent.close()
  }
}

/** Stable key of what an install depends on; `undefined` means "no global proxy". */
function keyOf(config: GlobalProxyConfig): string | undefined {
  if (!config.enabled || config.url.trim() === '') return undefined
  return JSON.stringify([config.url.trim(), config.noProxy.map(host => host.trim()).filter(Boolean)])
}

export class GlobalProxyLayer {
  private key: string | undefined
  private dispose: Dispose | undefined
  /** Serializes installs: the host package requires LIFO disposal. */
  private queue: Promise<void> = Promise.resolve()

  constructor(private readonly options: GlobalLayerOptions) {}

  /**
   * Bring the process-wide proxy in line with `config`.
   * @param config - the current global section.
   * @returns resolves once the new route is installed (or the invalid value was reported).
   */
  apply(config: GlobalProxyConfig): Promise<void> {
    const next = this.queue.then(() => this.reconcile(config))
    this.queue = next.catch(() => {})
    return next
  }

  /** Remove this layer, restoring the launcher's own proxy policy. */
  close(): Promise<void> {
    const next = this.queue.then(() => this.release())
    this.queue = next.catch(() => {})
    return next
  }

  private async release(): Promise<void> {
    const dispose = this.dispose
    this.dispose = undefined
    this.key = undefined
    await dispose?.()
  }

  private async reconcile(config: GlobalProxyConfig): Promise<void> {
    const key = keyOf(config)
    if (key === this.key) return
    await this.release()
    if (key === undefined) {
      this.options.info('全局代理已关闭，恢复启动时的代理设置')
      return
    }
    let url: URL
    try {
      url = parseProxyUrl(config.url)
    } catch (error) {
      this.options.warn(`全局代理未生效：${(error as Error).message}`)
      return
    }
    const proxy = url.href.replace(/\/$/, '')
    const noProxy = config.noProxy.map(host => host.trim()).filter(Boolean)
    const module = await (this.options.loadHttpProxy ?? loadHostHttpProxy)()
    if (module === undefined) {
      this.dispose = await installWithUndici(proxy, noProxy)
    } else {
      const values: Record<string, string> = {
        HTTP_PROXY: proxy,
        HTTPS_PROXY: proxy,
        ...noProxy.length === 0 ? {} : { NO_PROXY: noProxy.join(',') },
      }
      this.dispose = await module.installProxyFromEnvironment(
        { get: name => name in values ? { value: values[name]! } : undefined },
        message => { this.options.warn(`全局代理：${message}`) },
      )
    }
    this.key = key
    this.options.info(`全局代理已启用：${redactProxyUrl(url)}`)
  }
}
