import { once } from 'node:events'
import http from 'node:http'
import net from 'node:net'
import type { AddressInfo } from 'node:net'

export interface Target {
  port: number
  close(): Promise<void>
}

/** A plain HTTP server answering every request with its Host header. */
export async function startTarget(): Promise<Target> {
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/plain')
    res.end(`ok ${req.headers.host ?? ''}`)
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return {
    port: (server.address() as AddressInfo).port,
    close: () => new Promise(resolve => { server.closeAllConnections(); server.close(() => resolve()) }),
  }
}

export interface FakeProxy {
  url: string
  /** Host names requested through this proxy, in order. */
  hits: string[]
  /** Proxy-Authorization headers seen. */
  auth: (string | undefined)[]
  close(): Promise<void>
}

/**
 * A forward proxy that sends every CONNECT / absolute-form request to the
 * target server, whatever host it names, and records the host.
 */
export async function startProxy(target: Target): Promise<FakeProxy> {
  const hits: string[] = []
  const auth: (string | undefined)[] = []
  const sockets = new Set<net.Socket>()
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/')
    hits.push(url.hostname)
    auth.push(req.headers['proxy-authorization'])
    const upstream = http.request({
      host: '127.0.0.1', port: target.port, method: req.method, path: url.pathname + url.search,
      headers: { ...req.headers, host: url.host },
    }, (response) => {
      res.writeHead(response.statusCode ?? 502, response.headers)
      response.pipe(res)
    })
    req.pipe(upstream)
  })
  server.on('connect', (req: http.IncomingMessage, client: net.Socket, head: Buffer) => {
    const [host] = (req.url ?? '').split(':')
    hits.push(host ?? '')
    auth.push(req.headers['proxy-authorization'])
    const upstream = net.connect(target.port, '127.0.0.1', () => {
      client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
      if (head.length > 0) upstream.write(head)
      upstream.pipe(client)
      client.pipe(upstream)
    })
    sockets.add(upstream); sockets.add(client)
    upstream.on('error', () => client.destroy())
    client.on('error', () => upstream.destroy())
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return {
    url: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}`,
    hits,
    auth,
    close: () => new Promise(resolve => {
      for (const socket of sockets) socket.destroy()
      server.closeAllConnections()
      server.close(() => resolve())
    }),
  }
}

type Listener = (...args: any[]) => any

/** Just enough of a Cordis context to mount the plugin. */
export function fakeContext() {
  const effects: (() => unknown)[] = []
  const listeners = new Map<string, Listener[]>()
  const logs: string[] = []
  const llm = {
    discoverModels: async (_ns: string, request: { provider?: string; baseURL?: string }) => {
      const response = await fetch(request.baseURL ?? 'http://models.test/v1/models')
      return [{ id: await response.text() }]
    },
  }
  const ctx: any = {
    llm,
    webServer: { register: () => () => {} },
    logs,
    effect(execute: () => (() => unknown) | void) {
      const dispose = execute()
      if (typeof dispose === 'function') effects.push(dispose)
    },
    on(name: string, listener: Listener) {
      const list = listeners.get(name) ?? []
      list.push(listener)
      listeners.set(name, list)
      return () => { list.splice(list.indexOf(listener), 1) }
    },
    inject(_deps: string[], callback: (ctx: any) => void) { callback(ctx) },
    logger: () => ({ info: (m: string) => logs.push(`info ${m}`), warn: (m: string) => logs.push(`warn ${m}`) }),
    emit(name: string, ...args: unknown[]) {
      for (const listener of listeners.get(name) ?? []) listener(...args)
    },
    /** Run `next` through every `llm/stream` listener like LlmRuntime's waterfall. */
    stream(options: { provider: string }, next: () => AsyncIterable<unknown>): AsyncIterable<unknown> {
      const chain = [...listeners.get('llm/stream') ?? []]
      const run = (index: number): AsyncIterable<unknown> =>
        index >= chain.length ? next() : chain[index]!(options, () => run(index + 1))
      return run(0)
    },
    async dispose() {
      for (const dispose of effects.reverse()) await dispose()
    },
  }
  return ctx
}

/** A live config reference pair mimicking volatile fields. */
export function liveConfig(initial: { global?: unknown; providers?: unknown }) {
  const state = { global: initial.global, providers: initial.providers }
  return {
    config: {
      global: { get: () => state.global },
      providers: { get: () => state.providers },
    } as any,
    set(next: { global?: unknown; providers?: unknown }) {
      if ('global' in next) state.global = next.global
      if ('providers' in next) state.providers = next.providers
    },
  }
}

/** One model "request": an adapter stream that fetches `url` when consumed. */
export function adapterStream(url: string): () => AsyncIterable<string> {
  return () => (async function* () {
    await Promise.resolve()
    const response = await fetch(url)
    yield await response.text()
  })()
}

export async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = []
  for await (const item of iterable) out.push(item)
  return out
}

export const tick = (ms = 20) => new Promise(resolve => setTimeout(resolve, ms))
