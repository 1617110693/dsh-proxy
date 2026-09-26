import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { GlobalProxyLayer } from '../src/global.ts'
import { startProxy, startTarget, type FakeProxy, type Target } from './helpers.ts'

let target: Target
let a: FakeProxy
let b: FakeProxy
const warnings: string[] = []

beforeAll(async () => {
  target = await startTarget()
  a = await startProxy(target)
  b = await startProxy(target)
})
afterAll(async () => { await Promise.all([a.close(), b.close(), target.close()]) })
afterEach(() => { a.hits.length = 0; b.hits.length = 0; warnings.length = 0 })

for (const variant of ['dsh-http-proxy', 'undici fallback'] as const) {
  describe(`GlobalProxyLayer (${variant})`, () => {
    const layer = () => new GlobalProxyLayer({
      info: () => {},
      warn: message => { warnings.push(message) },
      ...variant === 'undici fallback' ? { loadHttpProxy: async () => undefined } : {},
    })

    it('routes fetch through the proxy, switches, and restores on close', async () => {
      const global = layer()
      const before = process.env.HTTPS_PROXY
      await global.apply({ enabled: true, url: a.url, noProxy: [] })
      expect(await (await fetch('http://api.example.test/v1')).text()).toBe('ok api.example.test')
      expect(a.hits).toEqual(['api.example.test'])

      await global.apply({ enabled: true, url: b.url, noProxy: [] })
      await fetch('http://api.example.test/v1')
      expect(b.hits).toEqual(['api.example.test'])
      expect(a.hits).toHaveLength(1)

      await global.close()
      await expect(fetch('http://api.example.test/v1')).rejects.toThrow()
      expect(b.hits).toHaveLength(1)
      expect(process.env.HTTPS_PROXY).toBe(before)
    })

    it('keeps loopback and NO_PROXY hosts direct', async () => {
      const global = layer()
      await global.apply({ enabled: true, url: a.url, noProxy: ['direct.example.test'] })
      expect(await (await fetch(`http://127.0.0.1:${String(target.port)}/`)).text()).toContain('ok')
      await expect(fetch('http://direct.example.test/')).rejects.toThrow()
      expect(a.hits).toEqual([])
      await global.close()
    })

    it('reports an unusable URL and stays off', async () => {
      const global = layer()
      await global.apply({ enabled: true, url: 'socks5://127.0.0.1:7891', noProxy: [] })
      expect(warnings.join('\n')).toMatch(/SOCKS/)
      await expect(fetch('http://api.example.test/')).rejects.toThrow()
      await global.apply({ enabled: false, url: '', noProxy: [] })
      await global.close()
    })
  })
}
