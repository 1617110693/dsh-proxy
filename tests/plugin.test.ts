import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { apply, Config } from '../src/index.ts'
import {
  adapterStream, collect, fakeContext, liveConfig, startProxy, startTarget, tick,
  type FakeProxy, type Target,
} from './helpers.ts'

let target: Target
let globalProxy: FakeProxy
let providerProxy: FakeProxy
const originalFetch = globalThis.fetch

beforeAll(async () => {
  target = await startTarget()
  globalProxy = await startProxy(target)
  providerProxy = await startProxy(target)
})
afterAll(async () => { await Promise.all([globalProxy.close(), providerProxy.close(), target.close()]) })
afterEach(() => { globalProxy.hits.length = 0; providerProxy.hits.length = 0; providerProxy.auth.length = 0 })

describe('dsh-network-proxy', () => {
  it('sends a configured provider through its own proxy and the rest through the global one', async () => {
    const ctx = fakeContext()
    apply(ctx, Config({
      global: { enabled: true, url: globalProxy.url },
      providers: {
        anthropic: { url: providerProxy.url },
        deepseek: { mode: 'direct' },
        disabled: { enabled: false, url: providerProxy.url },
      },
    }))
    await tick()

    // Interleave two streams to prove the route follows each request's own context.
    const anthropic = ctx.stream({ provider: 'anthropic' }, adapterStream('http://api.anthropic.test/v1/messages'))
    const openai = ctx.stream({ provider: 'openai' }, adapterStream('http://api.openai.test/v1/chat'))
    const [x, y] = await Promise.all([collect(anthropic), collect(openai)])
    expect(x).toEqual(['ok api.anthropic.test'])
    expect(y).toEqual(['ok api.openai.test'])
    expect(providerProxy.hits).toEqual(['api.anthropic.test'])
    expect(globalProxy.hits).toEqual(['api.openai.test'])

    // A disabled entry falls back to the global route.
    await collect(ctx.stream({ provider: 'disabled' }, adapterStream('http://api.disabled.test/')))
    expect(globalProxy.hits).toContain('api.disabled.test')

    // `direct` bypasses the global proxy: a fake host cannot resolve without it.
    await expect(collect(ctx.stream({ provider: 'deepseek' }, adapterStream('http://api.deepseek.test/')))).rejects.toThrow()
    expect(globalProxy.hits).not.toContain('api.deepseek.test')

    // Plain fetch outside any model call keeps the global route.
    await fetch('http://search.example.test/')
    expect(globalProxy.hits).toContain('search.example.test')

    await ctx.dispose()
    expect(globalThis.fetch).toBe(originalFetch)
  })

  it('handles Request objects and POST bodies inside a routed call', async () => {
    const ctx = fakeContext()
    apply(ctx, Config({ providers: { anthropic: { url: providerProxy.url } } }))
    const stream = ctx.stream({ provider: 'anthropic' }, () => (async function* () {
      const byRequest = await fetch(new Request('http://api.anthropic.test/a', { method: 'POST', body: '{"x":1}', headers: { 'content-type': 'application/json' } }))
      yield await byRequest.text()
      const byInit = await fetch('http://api.anthropic.test/b', { method: 'POST', body: JSON.stringify({ y: 2 }) })
      yield byInit.status
    })())
    expect(await collect(stream)).toEqual(['ok api.anthropic.test', 200])
    expect(providerProxy.hits).toEqual(['api.anthropic.test', 'api.anthropic.test'])
    await ctx.dispose()
  })

  it('routes model discovery for a provider through that provider', async () => {
    const ctx = fakeContext()
    apply(ctx, Config({ providers: { anthropic: { url: providerProxy.url } } }))
    await ctx.llm.discoverModels('llm-pi-ai', { provider: 'anthropic', baseURL: 'http://api.anthropic.test/v1/models' })
    expect(providerProxy.hits).toEqual(['api.anthropic.test'])
    await ctx.dispose()
  })

  it('passes proxy credentials from the URL', async () => {
    const ctx = fakeContext()
    const withAuth = providerProxy.url.replace('http://', 'http://alice:s3cret@')
    apply(ctx, Config({ providers: { anthropic: { url: withAuth } } }))
    await collect(ctx.stream({ provider: 'anthropic' }, adapterStream('http://api.anthropic.test/')))
    expect(providerProxy.auth).toEqual([`Basic ${Buffer.from('alice:s3cret').toString('base64')}`])
    expect(ctx.logs.join('\n')).not.toContain('s3cret')
    await ctx.dispose()
  })

  it('applies a Settings edit on loader/volatile-update without a remount', async () => {
    const ctx = fakeContext()
    const live = liveConfig({ global: { enabled: false, url: '', noProxy: [] }, providers: {} })
    apply(ctx, live.config)
    await tick()
    await expect(fetch('http://api.openai.test/')).rejects.toThrow()

    live.set({
      global: { enabled: true, url: globalProxy.url, noProxy: [] },
      providers: { anthropic: { enabled: true, mode: 'proxy', url: providerProxy.url } },
    })
    ctx.emit('loader/volatile-update', [['global'], ['providers']])
    await tick()
    await fetch('http://api.openai.test/')
    await collect(ctx.stream({ provider: 'anthropic' }, adapterStream('http://api.anthropic.test/')))
    expect(globalProxy.hits).toEqual(['api.openai.test'])
    expect(providerProxy.hits).toEqual(['api.anthropic.test'])

    live.set({ global: { enabled: false, url: '', noProxy: [] }, providers: {} })
    ctx.emit('loader/volatile-update', [['global'], ['providers']])
    await tick()
    await expect(fetch('http://api.openai.test/')).rejects.toThrow()
    await ctx.dispose()
  })

  it('skips an invalid provider entry with a warning', async () => {
    const ctx = fakeContext()
    apply(ctx, Config({ providers: { bad: { url: 'socks5://127.0.0.1:1080' } } }))
    expect(ctx.logs.join('\n')).toMatch(/bad 的代理未生效.*SOCKS/)
    await ctx.dispose()
  })
})
