/** Proxy URL validation and credential-safe display. */

/** Why a proxy URL was refused, phrased for the user. */
export class ProxyUrlError extends Error {
  override name = 'ProxyUrlError'
}

/**
 * Parse a proxy URL the user typed.
 *
 * Only `http:` and `https:` forward proxies are accepted: the Harness transport
 * (undici's ProxyAgent, like the launcher's own env-var policy) speaks CONNECT
 * over HTTP. A bare `127.0.0.1:7890` is read as `http://127.0.0.1:7890`.
 *
 * @param raw - the configured value.
 * @returns the normalized URL.
 * @throws ProxyUrlError when the value cannot be used; the message never contains credentials.
 */
export function parseProxyUrl(raw: string): URL {
  const text = raw.trim()
  if (text.length === 0) throw new ProxyUrlError('代理地址为空')
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    throw new ProxyUrlError('代理地址不是合法的 URL')
  }
  if (url.protocol === 'socks:' || url.protocol.startsWith('socks')) {
    throw new ProxyUrlError('不支持 SOCKS 代理，请改用代理软件的 HTTP 端口（如 Clash 的 7890 混合端口）')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ProxyUrlError(`不支持的代理协议 ${url.protocol}，只支持 http:// 或 https://`)
  }
  if (url.hostname.length === 0) throw new ProxyUrlError('代理地址缺少主机名')
  if ((url.pathname !== '' && url.pathname !== '/') || url.search !== '' || url.hash !== '') {
    throw new ProxyUrlError('代理地址不能包含路径、查询参数或片段')
  }
  return url
}

/**
 * Render a proxy URL for logs and errors with any credentials masked.
 * @param url - a parsed proxy URL.
 * @returns `scheme://***@host:port` or `scheme://host:port`.
 */
export function redactProxyUrl(url: URL): string {
  const auth = url.username !== '' || url.password !== '' ? '***@' : ''
  return `${url.protocol}//${auth}${url.host}`
}
