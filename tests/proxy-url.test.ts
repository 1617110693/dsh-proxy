import { describe, expect, it } from 'vitest'
import { parseProxyUrl, redactProxyUrl } from '../src/proxy-url.ts'

describe('parseProxyUrl', () => {
  it('accepts http and https proxies', () => {
    expect(parseProxyUrl('http://127.0.0.1:7890').href).toBe('http://127.0.0.1:7890/')
    expect(parseProxyUrl(' https://proxy.example:8443 ').host).toBe('proxy.example:8443')
  })

  it('reads a bare host:port as http', () => {
    expect(parseProxyUrl('127.0.0.1:7890').href).toBe('http://127.0.0.1:7890/')
  })

  it('refuses SOCKS, other schemes, paths and empty values', () => {
    expect(() => parseProxyUrl('socks5://127.0.0.1:7891')).toThrow(/SOCKS/)
    expect(() => parseProxyUrl('ftp://127.0.0.1:21')).toThrow(/只支持/)
    expect(() => parseProxyUrl('http://127.0.0.1:7890/path')).toThrow(/路径/)
    expect(() => parseProxyUrl('   ')).toThrow(/为空/)
    expect(() => parseProxyUrl('http://')).toThrow()
  })

  it('never puts credentials in an error or a label', () => {
    const url = parseProxyUrl('http://alice:s3cret@proxy.example:8080')
    expect(redactProxyUrl(url)).toBe('http://***@proxy.example:8080')
    try {
      parseProxyUrl('socks5://alice:s3cret@proxy.example:1080')
    } catch (error) {
      expect(String(error)).not.toContain('s3cret')
    }
  })
})
