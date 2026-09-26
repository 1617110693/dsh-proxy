import { describe, expect, it } from 'vitest'
import { draftFrom, providerRows, settingsFrom, splitHosts, validate } from '../src/client/model.ts'

describe('settings page model', () => {
  it('round-trips a stored section', () => {
    const stored = {
      global: { enabled: true, url: 'http://127.0.0.1:7890', noProxy: ['a.example', 'b.example'] },
      providers: {
        anthropic: { enabled: true, mode: 'proxy', url: 'http://127.0.0.1:7891' },
        deepseek: { enabled: true, mode: 'direct', url: '' },
        parked: { enabled: false, mode: 'proxy', url: 'http://127.0.0.1:1' },
      },
    }
    const draft = draftFrom(stored)
    expect(draft.providers).toEqual({
      anthropic: { choice: 'proxy', url: 'http://127.0.0.1:7891' },
      deepseek: { choice: 'direct', url: '' },
      parked: { choice: 'global', url: 'http://127.0.0.1:1' },
    })
    expect(settingsFrom(draft)).toEqual(stored)
  })

  it('drops a follow-global provider without a URL', () => {
    const settings = settingsFrom({ global: { enabled: false, url: '', noProxyText: '' }, providers: { x: { choice: 'global', url: ' ' } } })
    expect(settings.providers).toEqual({})
  })

  it('tolerates a missing or foreign section', () => {
    expect(draftFrom(undefined)).toEqual({ global: { enabled: false, url: '', noProxyText: '' }, providers: {} })
  })

  it('splits NO_PROXY text', () => {
    expect(splitHosts('a.example, b.example\nc.example;a.example')).toEqual(['a.example', 'b.example', 'c.example'])
  })

  it('validates only what would apply', () => {
    expect(validate({ global: { enabled: false, url: 'socks5://x:1', noProxyText: '' }, providers: {} })).toEqual({})
    const errors = validate({
      global: { enabled: true, url: 'socks5://x:1', noProxyText: '' },
      providers: { a: { choice: 'proxy', url: '' }, b: { choice: 'direct', url: 'nonsense' } },
    })
    expect(Object.keys(errors).sort()).toEqual(['a', 'global'])
  })

  it('lists registered and configured providers, suggesting the rest', () => {
    expect(providerRows(
      [{ id: 'deepseek-official', name: 'DeepSeek' }, { id: 'openai', name: 'openai' }],
      [{ provider: 'openai', displayName: 'OpenAI' }, { provider: 'anthropic', displayName: 'Anthropic' }],
      ['my-gateway', 'openai'],
    )).toEqual({
      rows: [
        { id: 'deepseek-official', name: 'DeepSeek' },
        { id: 'openai', name: 'OpenAI' },
        { id: 'my-gateway', name: 'my-gateway' },
      ],
      suggestions: [{ id: 'anthropic', name: 'Anthropic' }],
    })
  })
})
