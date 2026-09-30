import { describe, expect, it } from 'vitest'
import { detectSystemProxy, pickWindowsProxy } from '../src/system-proxy.ts'
import { isLocalRequest, statusRoute } from '../src/status-route.ts'
import type { IncomingMessage, ServerResponse } from 'node:http'

describe('system proxy detection', () => {
  it('prefers valid HTTPS environment settings and skips SOCKS', async () => {
    expect(await detectSystemProxy({ platform: 'linux', env: { HTTPS_PROXY: 'socks5://x:1', HTTP_PROXY: '127.0.0.1:7890' } }))
      .toEqual({ url: 'http://127.0.0.1:7890', source: 'env HTTP_PROXY' })
    expect(await detectSystemProxy({ platform: 'linux', env: { HTTPS_PROXY: 'https://secure:9', HTTP_PROXY: 'plain:8' } }))
      .toEqual({ url: 'https://secure:9', source: 'env HTTPS_PROXY' })
  })
  it('reads only enabled Windows proxies and prefers HTTPS over HTTP', async () => {
    const run = async () => 'ProxyEnable REG_DWORD 0x1\nProxyServer REG_SZ http=plain:8;https=secure:9;socks=other:1'
    expect(await detectSystemProxy({ platform: 'win32', env: {}, run })).toEqual({ url: 'http://secure:9', source: 'Windows system proxy' })
    expect(await detectSystemProxy({ platform: 'win32', env: {}, run: async () => (await run()).replace('0x1', '0x0') })).toBeNull()
    expect(pickWindowsProxy('socks=other:1')).toBeUndefined()
  })
  it('reads macOS settings and handles missing/unsupported settings', async () => {
    expect(await detectSystemProxy({ platform: 'darwin', env: {}, run: async () => 'HTTPEnable : 1\nHTTPProxy : localhost\nHTTPPort : 7890' }))
      .toEqual({ url: 'http://localhost:7890', source: 'macOS system proxy' })
    expect(await detectSystemProxy({ platform: 'linux', env: { ALL_PROXY: 'socks5://x:8' } })).toBeNull()
  })
})

describe('status bridge', () => {
  const request = (overrides = {}) => ({ method: 'POST', socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'localhost:3000' }, ...overrides }) as IncomingMessage
  it('rejects remote, cross-origin and cross-site requests', () => {
    expect(isLocalRequest(request())).toBe(true)
    expect(isLocalRequest(request({ socket: { remoteAddress: '10.0.0.1' } }))).toBe(false)
    expect(isLocalRequest(request({ headers: { host: 'localhost:3000', origin: 'https://evil.test' } }))).toBe(false)
    expect(isLocalRequest(request({ headers: { host: 'localhost:3000', 'sec-fetch-site': 'cross-site' } }))).toBe(false)
  })
  it('returns a credential-redacted status and allows POST only', async () => {
    let status = 0, body = ''
    const res = { writeHead: (code: number) => { status = code }, end: (value: string) => { body = value } } as unknown as ServerResponse
    const route = statusRoute(async () => ({ url: 'http://alice:secret@localhost:7890', source: 'env HTTPS_PROXY' }))
    await route.handler(request(), res)
    expect(status).toBe(200)
    expect(body).toContain('http://***@localhost:7890')
    expect(body).not.toContain('secret')
    await route.handler(request({ method: 'GET' }), res)
    expect(status).toBe(405)
  })
})
