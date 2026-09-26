import Schema from "@deepseek-ai/schemastery";
import { Context } from "@deepseek-ai/cordis";
//#region src/config.d.ts
/** Global proxy: every outbound request of the Harness process. */
interface GlobalProxyConfig {
  enabled: boolean;
  /** `http://host:port` or `https://host:port`, optionally with `user:password@`. */
  url: string;
  /** Hosts reached directly while the global proxy is on; loopback is always direct. */
  noProxy: readonly string[];
}
/** One LLM provider's own route, overriding the global one for its model requests. */
interface ProviderProxyConfig {
  enabled: boolean;
  /** `proxy` sends the provider through `url`; `direct` bypasses every proxy. */
  mode: 'proxy' | 'direct';
  url: string;
}
interface ProxySettings {
  global: GlobalProxyConfig;
  providers: Record<string, ProviderProxyConfig>;
}
declare const GlobalProxyConfig: Schema<Schemastery.ObjectS<NoInfer<{
  enabled: Schema<boolean, boolean, "defined">;
  url: Schema<string, string, "defined">;
  noProxy: Schema<string[], string[], "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
  enabled: Schema<boolean, boolean, "defined">;
  url: Schema<string, string, "defined">;
  noProxy: Schema<string[], string[], "defined">;
}>>, "plain">;
declare const ProviderProxyConfig: Schema<Schemastery.ObjectS<NoInfer<{
  enabled: Schema<boolean, boolean, "defined">;
  mode: Schema<"direct" | "proxy", "direct" | "proxy", "defined">;
  url: Schema<string, string, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
  enabled: Schema<boolean, boolean, "defined">;
  mode: Schema<"direct" | "proxy", "direct" | "proxy", "defined">;
  url: Schema<string, string, "defined">;
}>>, "plain">;
export declare const Config: Schema<Schemastery.ObjectS<NoInfer<{
  global: Schema<NoInfer<Schemastery.ObjectS<NoInfer<{
    enabled: Schema<boolean, boolean, "defined">;
    url: Schema<string, string, "defined">;
    noProxy: Schema<string[], string[], "defined">;
  }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
    enabled: Schema<boolean, boolean, "defined">;
    url: Schema<string, string, "defined">;
    noProxy: Schema<string[], string[], "defined">;
  }>>>, "volatile">;
  providers: Schema<NoInfer<import("@deepseek-ai/cosmokit").Dict<{
    enabled?: boolean | null | undefined;
    mode?: "direct" | "proxy" | null | undefined;
    url?: string | null | undefined;
  } & import("@deepseek-ai/cosmokit").Dict, string>>, NoInfer<import("@deepseek-ai/cosmokit").Dict<Schemastery.ObjectT<NoInfer<{
    enabled: Schema<boolean, boolean, "defined">;
    mode: Schema<"direct" | "proxy", "direct" | "proxy", "defined">;
    url: Schema<string, string, "defined">;
  }>>, string>>, "volatile-defined">;
}>>, Schemastery.ObjectT<NoInfer<{
  global: Schema<NoInfer<Schemastery.ObjectS<NoInfer<{
    enabled: Schema<boolean, boolean, "defined">;
    url: Schema<string, string, "defined">;
    noProxy: Schema<string[], string[], "defined">;
  }>>>, NoInfer<Schemastery.ObjectT<NoInfer<{
    enabled: Schema<boolean, boolean, "defined">;
    url: Schema<string, string, "defined">;
    noProxy: Schema<string[], string[], "defined">;
  }>>>, "volatile">;
  providers: Schema<NoInfer<import("@deepseek-ai/cosmokit").Dict<{
    enabled?: boolean | null | undefined;
    mode?: "direct" | "proxy" | null | undefined;
    url?: string | null | undefined;
  } & import("@deepseek-ai/cosmokit").Dict, string>>, NoInfer<import("@deepseek-ai/cosmokit").Dict<Schemastery.ObjectT<NoInfer<{
    enabled: Schema<boolean, boolean, "defined">;
    mode: Schema<"direct" | "proxy", "direct" | "proxy", "defined">;
    url: Schema<string, string, "defined">;
  }>>, string>>, "volatile-defined">;
}>>, "plain">;
/** The parsed plugin config: two live references. */
export type Config = ReturnType<typeof Config>;
//#endregion
//#region src/proxy-url.d.ts
/** Proxy URL validation and credential-safe display. */
/** Why a proxy URL was refused, phrased for the user. */
export declare class ProxyUrlError extends Error {
  name: string;
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
export declare function parseProxyUrl(raw: string): URL;
/**
 * Render a proxy URL for logs and errors with any credentials masked.
 * @param url - a parsed proxy URL.
 * @returns `scheme://***@host:port` or `scheme://host:port`.
 */
export declare function redactProxyUrl(url: URL): string;
//#endregion
//#region src/index.d.ts
export declare const name = "dsh-network-proxy";
/**
 * How long a replaced provider route stays open. A stream that started on it
 * may still issue requests (a retry, a follow-up call) under its old scope.
 */
export declare const RETIRED_ROUTE_GRACE_MS: number;
export declare function apply(context: Context, config: Config): void;
//#endregion
export type { GlobalProxyConfig, ProviderProxyConfig, ProxySettings };