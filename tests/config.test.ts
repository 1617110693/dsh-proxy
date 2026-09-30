import { describe, expect, it } from 'vitest'
import { Config } from '../src/config.ts'

describe('Config', () => {
  it('fills defaults and exposes live references', () => {
    const config = Config({ providers: { anthropic: { url: 'http://127.0.0.1:7890' } } })
    expect(config.global.get()).toEqual({ enabled: false, mode: 'proxy', url: '', noProxy: [] })
    expect(config.providers.get()).toEqual({
      anthropic: { enabled: true, mode: 'proxy', url: 'http://127.0.0.1:7890' },
    })
  })

  it('rejects a wrong mode', () => {
    expect(() => Config({ providers: { x: { mode: 'socks' as never } } })).toThrow()
  })

  it('serializes its schema for the Settings page with the volatile marker', () => {
    expect(JSON.stringify(Config.toJSON())).toContain('"volatile":true')
  })
})
