/**
 * The Settings page's form model: converting between the plugin's stored
 * section and what the form edits, validating it, and joining the provider
 * directory. Pure, so it is unit-tested without a browser.
 */
import type { ProviderProxyConfig, ProxySettings } from '../config.ts'
import { parseProxyUrl } from '../proxy-url.ts'

export type ProviderChoice = 'global' | 'proxy' | 'direct' | 'system'

export interface ProviderDraft {
  choice: ProviderChoice
  url: string
}

export interface Draft {
  global: { enabled: boolean; mode?: 'proxy' | 'system'; url: string; noProxyText: string }
  providers: Record<string, ProviderDraft>
}

export interface ProviderRow {
  id: string
  name: string
}

/** Read a stored (possibly partial or foreign) section into the form. */
export function draftFrom(value: unknown): Draft {
  const section = isObject(value) ? value : {}
  const global = isObject(section.global) ? section.global : {}
  const providers = isObject(section.providers) ? section.providers : {}
  const draft: Draft = {
    global: {
      enabled: global.enabled === true,
      ...(global.mode === 'system' ? { mode: 'system' as const } : {}),
      url: typeof global.url === 'string' ? global.url : '',
      noProxyText: Array.isArray(global.noProxy) ? global.noProxy.filter(item => typeof item === 'string').join('\n') : '',
    },
    providers: {},
  }
  for (const [id, raw] of Object.entries(providers)) {
    if (!isObject(raw)) continue
    const url = typeof raw.url === 'string' ? raw.url : ''
    const enabled = raw.enabled !== false
    const choice: ProviderChoice = !enabled ? 'global' : raw.mode === 'direct' ? 'direct' : raw.mode === 'system' ? 'system' : 'proxy'
    draft.providers[id] = { choice, url }
  }
  return draft
}

/** Build the section to store. "Follow global" keeps a typed URL as a disabled entry so it is not lost. */
export function settingsFrom(draft: Draft): ProxySettings {
  const providers: Record<string, ProviderProxyConfig> = {}
  for (const [id, entry] of Object.entries(draft.providers)) {
    const url = entry.url.trim()
    if (entry.choice === 'global') {
      if (url !== '') providers[id] = { enabled: false, mode: 'proxy', url }
    } else {
      providers[id] = { enabled: true, mode: entry.choice, url: entry.choice === 'proxy' ? url : '' }
    }
  }
  return {
    global: {
      enabled: draft.global.enabled,
      ...(draft.global.mode === 'system' ? { mode: 'system' as const } : {}),
      url: draft.global.url.trim(),
      noProxy: splitHosts(draft.global.noProxyText),
    },
    providers,
  }
}

/** Split a NO_PROXY text box on commas, whitespace and newlines. */
export function splitHosts(text: string): string[] {
  return [...new Set(text.split(/[\s,;]+/).map(item => item.trim()).filter(Boolean))]
}

/**
 * Validate what would be applied.
 * @returns field key (`global` or a provider id) → message; empty when valid.
 */
export function validate(draft: Draft): Record<string, string> {
  const errors: Record<string, string> = {}
  const check = (key: string, url: string) => {
    try {
      parseProxyUrl(url)
    } catch (error) {
      errors[key] = (error as Error).message
    }
  }
  if (draft.global.enabled && draft.global.mode !== 'system') check('global', draft.global.url)
  for (const [id, entry] of Object.entries(draft.providers)) {
    if (entry.choice === 'proxy') check(id, entry.url)
  }
  return errors
}

/**
 * The providers the page lists: the ones currently registered (configured on
 * the Models page) and any id the section already names. Catalog providers
 * that are only declared are offered as suggestions instead, so the list does
 * not fill with every provider the installed catalog knows.
 */
export function providerRows(
  registered: readonly { id: string; name?: string }[],
  declared: readonly { provider: string; displayName?: string }[],
  configured: readonly string[],
): { rows: ProviderRow[]; suggestions: ProviderRow[] } {
  const names = new Map<string, string>()
  for (const item of declared) names.set(item.provider, item.displayName ?? item.provider)
  const rows = new Map<string, ProviderRow>()
  for (const item of registered) rows.set(item.id, { id: item.id, name: names.get(item.id) ?? item.name ?? item.id })
  for (const id of configured) if (!rows.has(id)) rows.set(id, { id, name: names.get(id) ?? id })
  const suggestions = [...names].filter(([id]) => !rows.has(id)).map(([id, name]) => ({ id, name }))
  return { rows: [...rows.values()], suggestions }
}

/** A provider id a user may type: what the Models page accepts. */
export function isProviderId(text: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{0,63}$/.test(text)
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
