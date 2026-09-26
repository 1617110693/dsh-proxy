/**
 * Plugin configuration. Both sections are volatile: a Settings edit updates
 * the running references and fires `loader/volatile-update` instead of
 * remounting the plugin, so a changed proxy applies to the next request.
 */
import Schema from '@deepseek-ai/schemastery'

/** Global proxy: every outbound request of the Harness process. */
export interface GlobalProxyConfig {
  enabled: boolean
  /** `http://host:port` or `https://host:port`, optionally with `user:password@`. */
  url: string
  /** Hosts reached directly while the global proxy is on; loopback is always direct. */
  noProxy: readonly string[]
}

/** One LLM provider's own route, overriding the global one for its model requests. */
export interface ProviderProxyConfig {
  enabled: boolean
  /** `proxy` sends the provider through `url`; `direct` bypasses every proxy. */
  mode: 'proxy' | 'direct'
  url: string
}

export interface ProxySettings {
  global: GlobalProxyConfig
  providers: Record<string, ProviderProxyConfig>
}

export const GlobalProxyConfig = Schema.object({
  enabled: Schema.boolean().default(false).description('启用全局代理'),
  url: Schema.string().default('').description('全局代理地址，例如 http://127.0.0.1:7890'),
  noProxy: Schema.array(String).default([]).description('不走代理的主机名（本机回环地址始终直连）'),
})

export const ProviderProxyConfig = Schema.object({
  enabled: Schema.boolean().default(true).description('启用此提供商的单独代理设置'),
  mode: Schema.union(['proxy', 'direct'] as const).default('proxy').description('proxy：走下方地址；direct：强制直连'),
  url: Schema.string().default('').description('此提供商使用的代理地址，例如 http://127.0.0.1:7890'),
})

export const Config = Schema.object({
  global: GlobalProxyConfig.volatile(),
  providers: Schema.dict(ProviderProxyConfig).default({}).description('按 LLM 提供商 id 单独配置代理').volatile(),
})

/** The parsed plugin config: two live references. */
export type Config = ReturnType<typeof Config>
