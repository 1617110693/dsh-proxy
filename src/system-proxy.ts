import { execFile } from 'node:child_process'
import { parseProxyUrl } from './proxy-url.ts'

export interface SystemProxy { url: string; source: string }
export interface DetectionOptions {
  env?: NodeJS.ProcessEnv
  platform?: string
  run?: (file: string, args: string[]) => Promise<string>
}

function runCommand(file: string, args: string[]): Promise<string> {
  return new Promise(resolve => {
    execFile(file, args, { timeout: 3000, windowsHide: true }, (error, stdout) => resolve(error ? '' : stdout))
  })
}

export function pickWindowsProxy(server: string): string | undefined {
  if (!server.includes('=')) return server.trim() || undefined
  const parts = Object.fromEntries(server.split(';').map(part => part.split('=').map(x => x.trim())).filter(pair => pair.length === 2 && pair[1]))
  return parts.https ?? parts.http
}

/** Same priority as dsh-free-search: environment, Windows Internet Settings, macOS scutil. */
export async function detectSystemProxy(options: DetectionOptions = {}): Promise<SystemProxy | null> {
  const env = options.env ?? process.env
  const platform = options.platform ?? process.platform
  const run = options.run ?? runCommand
  const candidates: SystemProxy[] = []
  for (const name of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy', 'ALL_PROXY', 'all_proxy']) {
    if (env[name]) candidates.push({ url: env[name]!, source: `env ${name}` })
  }
  if (platform === 'win32') {
    const out = await run('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings'])
    const server = out.match(/ProxyServer\s+REG_SZ\s+(.+)/i)?.[1]
    const picked = /ProxyEnable\s+REG_DWORD\s+0x0*1\b/i.test(out) && server ? pickWindowsProxy(server) : undefined
    if (picked) candidates.push({ url: picked, source: 'Windows system proxy' })
  } else if (platform === 'darwin') {
    const out = await run('scutil', ['--proxy'])
    const field = (key: string) => out.match(new RegExp(`\\b${key}\\s*:\\s*(\\S+)`))?.[1]
    for (const kind of ['HTTPS', 'HTTP']) {
      const host = field(`${kind}Proxy`)
      if (field(`${kind}Enable`) === '1' && host) {
        candidates.push({ url: `${host.includes(':') ? `[${host}]` : host}:${field(`${kind}Port`) ?? '80'}`, source: 'macOS system proxy' })
      }
    }
  }
  for (const candidate of candidates) {
    try { return { ...candidate, url: parseProxyUrl(candidate.url).href.replace(/\/$/, '') } } catch { /* Try the next HTTP(S) candidate. */ }
  }
  return null
}
