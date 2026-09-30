import type { IncomingMessage, ServerResponse } from 'node:http'
import { redactProxyUrl } from './proxy-url.ts'
import type { SystemProxy } from './system-proxy.ts'

export const STATUS_PATH = '/api/dsh-proxy/proxy-status'

/** Match the free-search bridge's loopback and same-origin checks. */
export function isLocalRequest(req: IncomingMessage): boolean {
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '')) return false
  try {
    const host = new URL(`http://${req.headers.host ?? ''}`)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(host.hostname) || req.headers['sec-fetch-site'] === 'cross-site') return false
    return req.headers.origin === undefined || new URL(req.headers.origin).host === host.host
  } catch { return false }
}

export function statusRoute(detect: () => Promise<SystemProxy | null>) {
  return {
    kind: 'exact' as const,
    path: STATUS_PATH,
    async handler(req: IncomingMessage, res: ServerResponse) {
      const send = (status: number, body: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
        res.end(JSON.stringify(body))
      }
      if (!isLocalRequest(req)) return send(403, { ok: false })
      if (req.method !== 'POST') return send(405, { ok: false })
      const system = await detect()
      send(200, { ok: true, value: { system: system ? { ...system, url: redactProxyUrl(new URL(system.url)) } : null } })
    },
  }
}
