window.__ModuleLoader__.load({
	id: "dsh-network-proxy",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		//#region src/client/locales.ts
		/** Settings page copy. */
		const zh = {
			nav: "网络代理",
			title: "网络代理",
			subtitle: "为 DeepSeek Harness 配置全局代理，或为某个模型提供商单独配置代理。保存后立即生效，无需重启。",
			globalTitle: "全局代理",
			globalHint: "开启后，模型请求、联网搜索、网页抓取、HTTP MCP 以及 Agent 启动的命令都走这个代理。关闭时沿用启动时的 HTTP(S)_PROXY 环境变量。",
			enabled: "启用",
			proxyUrl: "代理地址",
			proxyUrlPlaceholder: "http://127.0.0.1:7890",
			noProxy: "不走代理的主机",
			noProxyHint: "每行一个或用逗号分隔，例如 internal.example.com；会同时匹配子域名。本机地址始终直连。",
			providersTitle: "按提供商代理",
			providersHint: "只影响该提供商的模型请求（含“获取可用模型”），优先级高于全局代理。",
			followGlobal: "跟随全局",
			useProxy: "使用代理",
			direct: "直连",
			noProviders: "还没有已配置的模型提供商。可以在下方输入提供商 id 添加（例如 deepseek-official、anthropic）。",
			addProvider: "添加提供商 id",
			addProviderPlaceholder: "例如 anthropic、openai、my-gateway",
			add: "添加",
			save: "保存",
			discard: "放弃修改",
			saving: "正在保存…",
			saved: "已保存，已对后续请求生效。",
			loading: "正在加载…",
			loadFailed: "加载失败：",
			saveFailed: "保存失败：",
			readOnly: "当前配置是只读的（可能被启动参数或全局补丁覆盖），无法在这里修改。",
			notMounted: "没有找到 dsh-proxy 插件条目，请确认插件已安装并启用。",
			invalid: "地址无效：",
			unsaved: "有未保存的修改"
		};
		const en = {
			nav: "Network proxy",
			title: "Network proxy",
			subtitle: "Set a global proxy for DeepSeek Harness, or a proxy for one model provider. Changes apply immediately, no restart needed.",
			globalTitle: "Global proxy",
			globalHint: "When on, model requests, web search, web fetch, HTTP MCP and commands the agent runs all use this proxy. When off, the HTTP(S)_PROXY variables from launch apply.",
			enabled: "Enabled",
			proxyUrl: "Proxy URL",
			proxyUrlPlaceholder: "http://127.0.0.1:7890",
			noProxy: "Hosts that bypass the proxy",
			noProxyHint: "One per line or comma-separated, e.g. internal.example.com; subdomains match too. Loopback is always direct.",
			providersTitle: "Per-provider proxy",
			providersHint: "Affects only that provider's model requests (including \"Fetch available models\") and takes precedence over the global proxy.",
			followGlobal: "Follow global",
			useProxy: "Use proxy",
			direct: "Direct",
			noProviders: "No model providers are configured yet. Add a provider id below (e.g. deepseek-official, anthropic).",
			addProvider: "Add provider id",
			addProviderPlaceholder: "e.g. anthropic, openai, my-gateway",
			add: "Add",
			save: "Save",
			discard: "Discard changes",
			saving: "Saving…",
			saved: "Saved. Applies to the next request.",
			loading: "Loading…",
			loadFailed: "Failed to load: ",
			saveFailed: "Failed to save: ",
			readOnly: "This configuration is read-only here (a launch flag or home patch overrides it).",
			notMounted: "No dsh-proxy plugin entry was found. Make sure the plugin is installed and enabled.",
			invalid: "Invalid URL: ",
			unsaved: "Unsaved changes"
		};
		//#endregion
		//#region src/proxy-url.ts
		/** Proxy URL validation and credential-safe display. */
		/** Why a proxy URL was refused, phrased for the user. */
		var ProxyUrlError = class extends Error {
			name = "ProxyUrlError";
		};
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
		function parseProxyUrl(raw) {
			const text = raw.trim();
			if (text.length === 0) throw new ProxyUrlError("代理地址为空");
			const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `http://${text}`;
			let url;
			try {
				url = new URL(candidate);
			} catch {
				throw new ProxyUrlError("代理地址不是合法的 URL");
			}
			if (url.protocol === "socks:" || url.protocol.startsWith("socks")) throw new ProxyUrlError("不支持 SOCKS 代理，请改用代理软件的 HTTP 端口（如 Clash 的 7890 混合端口）");
			if (url.protocol !== "http:" && url.protocol !== "https:") throw new ProxyUrlError(`不支持的代理协议 ${url.protocol}，只支持 http:// 或 https://`);
			if (url.hostname.length === 0) throw new ProxyUrlError("代理地址缺少主机名");
			if (url.pathname !== "" && url.pathname !== "/" || url.search !== "" || url.hash !== "") throw new ProxyUrlError("代理地址不能包含路径、查询参数或片段");
			return url;
		}
		//#endregion
		//#region src/client/model.ts
		/** Read a stored (possibly partial or foreign) section into the form. */
		function draftFrom(value) {
			const section = isObject(value) ? value : {};
			const global = isObject(section.global) ? section.global : {};
			const providers = isObject(section.providers) ? section.providers : {};
			const draft = {
				global: {
					enabled: global.enabled === true,
					url: typeof global.url === "string" ? global.url : "",
					noProxyText: Array.isArray(global.noProxy) ? global.noProxy.filter((item) => typeof item === "string").join("\n") : ""
				},
				providers: {}
			};
			for (const [id, raw] of Object.entries(providers)) {
				if (!isObject(raw)) continue;
				const url = typeof raw.url === "string" ? raw.url : "";
				const choice = !(raw.enabled !== false) ? "global" : raw.mode === "direct" ? "direct" : "proxy";
				draft.providers[id] = {
					choice,
					url
				};
			}
			return draft;
		}
		/** Build the section to store. "Follow global" keeps a typed URL as a disabled entry so it is not lost. */
		function settingsFrom(draft) {
			const providers = {};
			for (const [id, entry] of Object.entries(draft.providers)) {
				const url = entry.url.trim();
				if (entry.choice === "global") {
					if (url !== "") providers[id] = {
						enabled: false,
						mode: "proxy",
						url
					};
				} else providers[id] = {
					enabled: true,
					mode: entry.choice,
					url: entry.choice === "proxy" ? url : ""
				};
			}
			return {
				global: {
					enabled: draft.global.enabled,
					url: draft.global.url.trim(),
					noProxy: splitHosts(draft.global.noProxyText)
				},
				providers
			};
		}
		/** Split a NO_PROXY text box on commas, whitespace and newlines. */
		function splitHosts(text) {
			return [...new Set(text.split(/[\s,;]+/).map((item) => item.trim()).filter(Boolean))];
		}
		/**
		* Validate what would be applied.
		* @returns field key (`global` or a provider id) → message; empty when valid.
		*/
		function validate(draft) {
			const errors = {};
			const check = (key, url) => {
				try {
					parseProxyUrl(url);
				} catch (error) {
					errors[key] = error.message;
				}
			};
			if (draft.global.enabled) check("global", draft.global.url);
			for (const [id, entry] of Object.entries(draft.providers)) if (entry.choice === "proxy") check(id, entry.url);
			return errors;
		}
		/**
		* The providers the page lists: the ones currently registered (configured on
		* the Models page) and any id the section already names. Catalog providers
		* that are only declared are offered as suggestions instead, so the list does
		* not fill with every provider the installed catalog knows.
		*/
		function providerRows(registered, declared, configured) {
			const names = /* @__PURE__ */ new Map();
			for (const item of declared) names.set(item.provider, item.displayName ?? item.provider);
			const rows = /* @__PURE__ */ new Map();
			for (const item of registered) rows.set(item.id, {
				id: item.id,
				name: names.get(item.id) ?? item.name ?? item.id
			});
			for (const id of configured) if (!rows.has(id)) rows.set(id, {
				id,
				name: names.get(id) ?? id
			});
			const suggestions = [...names].filter(([id]) => !rows.has(id)).map(([id, name]) => ({
				id,
				name
			}));
			return {
				rows: [...rows.values()],
				suggestions
			};
		}
		/** A provider id a user may type: what the Models page accepts. */
		function isProviderId(text) {
			return /^[a-z0-9][a-z0-9._-]{0,63}$/.test(text);
		}
		function isObject(value) {
			return typeof value === "object" && value !== null && !Array.isArray(value);
		}
		//#endregion
		//#region src/client/index.ts
		/**
		* Browser half: the "Network proxy" section in Settings. It reads the
		* plugin's own entry (`dsh-proxy`) through `remote.settings.describe()`,
		* lists providers through `remote.llm`, and writes with
		* `remote.settings.mutate()`. The host applies the edit as a volatile update,
		* so it reaches the next request without a restart.
		*
		* Built by tsdown into `client/client.js` in the ModuleLoader format; React is
		* the only import taken from the host's module table.
		*/
		/** The Loader entry id this page edits; see cordis.patch.yml. */
		const ENTRY_ID = "dsh-proxy";
		const NS = "settings.dshProxy";
		const h = react.createElement;
		const S = {
			page: {
				display: "grid",
				gap: 20,
				maxWidth: 880,
				paddingBottom: 32,
				color: "var(--dsw-alias-label-primary, inherit)"
			},
			title: {
				margin: 0,
				fontSize: 20,
				fontWeight: 600
			},
			subtitle: {
				margin: "6px 0 0",
				fontSize: 13,
				lineHeight: 1.6,
				color: "var(--dsw-alias-label-secondary, #666)"
			},
			card: {
				display: "grid",
				gap: 14,
				padding: 16,
				borderRadius: "var(--dsw-radius-lg, 12px)",
				border: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.25))"
			},
			cardTitle: {
				margin: 0,
				fontSize: 15,
				fontWeight: 600
			},
			hint: {
				margin: 0,
				fontSize: 12,
				lineHeight: 1.55,
				color: "var(--dsw-alias-label-tertiary, #888)"
			},
			label: {
				display: "grid",
				gap: 6,
				fontSize: 13,
				fontWeight: 500
			},
			input: {
				boxSizing: "border-box",
				width: "100%",
				padding: "8px 10px",
				fontSize: 13,
				borderRadius: "var(--dsw-radius-md, 8px)",
				border: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3))",
				background: "transparent",
				color: "inherit",
				fontFamily: "var(--ds-font-family-code, monospace)"
			},
			row: {
				display: "grid",
				gridTemplateColumns: "minmax(120px, 1fr) 150px minmax(180px, 1.4fr)",
				gap: 10,
				alignItems: "center",
				padding: "8px 0",
				borderTop: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.15))"
			},
			providerName: {
				fontSize: 13,
				fontWeight: 500,
				overflow: "hidden",
				textOverflow: "ellipsis"
			},
			providerId: {
				fontSize: 11,
				color: "var(--dsw-alias-label-tertiary, #888)",
				fontFamily: "var(--ds-font-family-code, monospace)"
			},
			error: {
				fontSize: 12,
				color: "var(--dsw-alias-state-error-primary, #d33)"
			},
			ok: {
				fontSize: 12,
				color: "var(--dsw-alias-state-success-primary, #2a2)"
			},
			toggle: {
				display: "flex",
				gap: 8,
				alignItems: "center",
				fontSize: 13,
				cursor: "pointer"
			},
			actions: {
				display: "flex",
				gap: 10,
				alignItems: "center",
				flexWrap: "wrap"
			},
			primary: {
				padding: "7px 16px",
				fontSize: 13,
				borderRadius: "var(--dsw-radius-md, 8px)",
				border: "1px solid var(--dsw-alias-state-business-primary, #2f7cff)",
				background: "var(--dsw-alias-state-business-primary, #2f7cff)",
				color: "var(--dsw-alias-label-primary-inverted, #fff)",
				cursor: "pointer"
			},
			secondary: {
				padding: "7px 14px",
				fontSize: 13,
				borderRadius: "var(--dsw-radius-md, 8px)",
				border: "1px solid var(--dsw-alias-border-l2, rgba(127,127,127,.3))",
				background: "transparent",
				color: "inherit",
				cursor: "pointer"
			},
			addRow: {
				display: "flex",
				gap: 8
			}
		};
		function ProxySection({ api }) {
			const { t } = api;
			const [status, setStatus] = react.useState("loading");
			const [message, setMessage] = react.useState(null);
			const [writable, setWritable] = react.useState(false);
			const [view, setView] = react.useState(void 0);
			const [providers, setProviders] = react.useState([]);
			const [suggestions, setSuggestions] = react.useState([]);
			const [draft, setDraft] = react.useState(() => draftFrom(void 0));
			const [dirty, setDirty] = react.useState(false);
			const [saving, setSaving] = react.useState(false);
			const [newId, setNewId] = react.useState("");
			const dirtyRef = react.useRef(false);
			dirtyRef.current = dirty;
			const load = react.useCallback(async (resetDraft) => {
				try {
					const result = await api.load();
					setWritable(result.writable);
					setView(result.view);
					setProviders(result.providers);
					setSuggestions(result.suggestions);
					if (resetDraft || !dirtyRef.current) {
						setDraft(draftFrom(result.view?.value));
						setDirty(false);
					}
					setStatus("ready");
				} catch (error) {
					setStatus("error");
					setMessage({
						kind: "error",
						text: t("loadFailed") + error.message
					});
				}
			}, [api, t]);
			react.useEffect(() => {
				load(true);
				return api.subscribe(() => {
					load(false);
				});
			}, [api, load]);
			const errors = validate(draft);
			const edit = (update) => {
				setDraft((previous) => {
					const next = structuredClone(previous);
					update(next);
					return next;
				});
				setDirty(true);
				setMessage(null);
			};
			const save = async () => {
				if (view === void 0 || Object.keys(errors).length > 0) return;
				setSaving(true);
				try {
					await api.save(draft, view.revision);
					setMessage({
						kind: "ok",
						text: t("saved")
					});
					setDirty(false);
					await load(true);
				} catch (error) {
					setMessage({
						kind: "error",
						text: t("saveFailed") + error.message
					});
				} finally {
					setSaving(false);
				}
			};
			if (status === "loading") return h("div", { style: S.page }, t("loading"));
			const disabled = !writable || view === void 0 || saving;
			const shown = [...providers];
			for (const id of Object.keys(draft.providers)) if (!shown.some((row) => row.id === id)) shown.push({
				id,
				name: id
			});
			const choiceOf = (id) => draft.providers[id]?.choice ?? "global";
			const urlOf = (id) => draft.providers[id]?.url ?? "";
			return h("div", { style: S.page }, h("div", null, h("h2", { style: S.title }, t("title")), h("p", { style: S.subtitle }, t("subtitle"))), view === void 0 ? h("div", { style: S.error }, t("notMounted")) : null, view !== void 0 && !writable ? h("div", { style: S.error }, t("readOnly")) : null, h("section", { style: S.card }, h("h3", { style: S.cardTitle }, t("globalTitle")), h("p", { style: S.hint }, t("globalHint")), h("label", { style: S.toggle }, h("input", {
				type: "checkbox",
				checked: draft.global.enabled,
				disabled,
				onChange: (event) => {
					const on = event.target.checked;
					edit((next) => {
						next.global.enabled = on;
					});
				}
			}), t("enabled")), h("label", { style: S.label }, t("proxyUrl"), h("input", {
				style: S.input,
				value: draft.global.url,
				placeholder: t("proxyUrlPlaceholder"),
				disabled,
				spellCheck: false,
				onChange: (event) => {
					const value = event.target.value;
					edit((next) => {
						next.global.url = value;
					});
				}
			}), errors.global === void 0 ? null : h("span", { style: S.error }, t("invalid") + errors.global)), h("label", { style: S.label }, t("noProxy"), h("textarea", {
				style: {
					...S.input,
					minHeight: 64,
					resize: "vertical"
				},
				value: draft.global.noProxyText,
				disabled,
				spellCheck: false,
				onChange: (event) => {
					const value = event.target.value;
					edit((next) => {
						next.global.noProxyText = value;
					});
				}
			}), h("span", { style: S.hint }, t("noProxyHint")))), h("section", { style: S.card }, h("h3", { style: S.cardTitle }, t("providersTitle")), h("p", { style: S.hint }, t("providersHint")), shown.length === 0 ? h("p", { style: S.hint }, t("noProviders")) : null, ...shown.map((row) => h("div", {
				key: row.id,
				style: S.row
			}, h("div", null, h("div", {
				style: S.providerName,
				title: row.name
			}, row.name), h("div", { style: S.providerId }, row.id)), h("select", {
				style: {
					...S.input,
					fontFamily: "inherit"
				},
				value: choiceOf(row.id),
				disabled,
				onChange: (event) => {
					const choice = event.target.value;
					edit((next) => {
						next.providers[row.id] = {
							choice,
							url: next.providers[row.id]?.url ?? ""
						};
					});
				}
			}, h("option", { value: "global" }, t("followGlobal")), h("option", { value: "proxy" }, t("useProxy")), h("option", { value: "direct" }, t("direct"))), h("div", null, choiceOf(row.id) === "proxy" ? h("input", {
				style: S.input,
				value: urlOf(row.id),
				placeholder: t("proxyUrlPlaceholder"),
				disabled,
				spellCheck: false,
				onChange: (event) => {
					const value = event.target.value;
					edit((next) => {
						next.providers[row.id] = {
							choice: "proxy",
							url: value
						};
					});
				}
			}) : null, errors[row.id] === void 0 ? null : h("div", { style: S.error }, t("invalid") + errors[row.id])))), h("div", { style: S.addRow }, h("input", {
				style: {
					...S.input,
					flex: 1
				},
				value: newId,
				placeholder: t("addProviderPlaceholder"),
				disabled,
				spellCheck: false,
				"aria-label": t("addProvider"),
				list: "dsh-proxy-provider-suggestions",
				onChange: (event) => {
					setNewId(event.target.value.trim());
				}
			}), h("button", {
				type: "button",
				style: S.secondary,
				disabled: disabled || !isProviderId(newId) || shown.some((row) => row.id === newId),
				onClick: () => {
					const id = newId;
					edit((next) => {
						next.providers[id] = {
							choice: "proxy",
							url: ""
						};
					});
					setNewId("");
				}
			}, t("add")), h("datalist", { id: "dsh-proxy-provider-suggestions" }, ...suggestions.filter((row) => !shown.some((item) => item.id === row.id)).map((row) => h("option", {
				key: row.id,
				value: row.id
			}, row.name))))), h("div", { style: S.actions }, h("button", {
				type: "button",
				style: {
					...S.primary,
					opacity: disabled || !dirty || Object.keys(errors).length > 0 ? .5 : 1
				},
				disabled: disabled || !dirty || Object.keys(errors).length > 0,
				onClick: () => {
					save();
				}
			}, saving ? t("saving") : t("save")), h("button", {
				type: "button",
				style: S.secondary,
				disabled: !dirty || saving,
				onClick: () => {
					setDraft(draftFrom(view?.value));
					setDirty(false);
					setMessage(null);
				}
			}, t("discard")), dirty ? h("span", { style: S.hint }, t("unsaved")) : null, message === null ? null : h("span", { style: message.kind === "ok" ? S.ok : S.error }, message.text)));
		}
		function unwrap(result) {
			if (result.ok) return result.value;
			throw new Error(result.error.message);
		}
		function createApi(ctx, t) {
			return {
				t,
				async load() {
					const [described, registered, declared] = await Promise.all([
						ctx.remote.settings.describe(),
						ctx.remote.llm.listProviders().catch(() => ({
							ok: true,
							value: []
						})),
						ctx.remote.llm.listConfigurableProviders().catch(() => ({
							ok: true,
							value: []
						}))
					]);
					const settings = unwrap(described);
					const view = settings.namespaces.find((item) => item.ns === ENTRY_ID);
					const configured = Object.keys(draftFrom(view?.value).providers);
					const { rows, suggestions } = providerRows(registered.ok ? registered.value : [], declared.ok ? declared.value : [], configured);
					return {
						writable: settings.writable,
						view,
						providers: rows,
						suggestions
					};
				},
				async save(draft, revision) {
					const next = settingsFrom(draft);
					unwrap(await ctx.remote.settings.mutate(ENTRY_ID, [{
						op: "set",
						path: ["global"],
						value: next.global
					}, {
						op: "set",
						path: ["providers"],
						value: next.providers
					}], revision));
				},
				subscribe(listener) {
					return ctx.remote.$on?.("settings/document-updated", (ns) => {
						if (ns === "dsh-proxy") listener();
					}) ?? (() => {});
				}
			};
		}
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.settings",
			"remote.llm"
		];
		function apply(ctx) {
			let t = (key) => zh[key];
			if (ctx.locale !== void 0) {
				const locale = ctx.locale;
				ctx.effect(() => locale.register(NS, {
					zh,
					en
				}), "dsh-proxy: dictionaries");
				const bound = locale.bind(NS);
				t = (key) => bound(key);
			} else if (typeof navigator !== "undefined" && !navigator.language.startsWith("zh")) t = (key) => en[key];
			const api = createApi(ctx, t);
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "dsh-proxy",
				order: 60,
				label: () => t("nav")
			}, () => h(ProxySection, { api })));
		}
		//#endregion
		exports.ENTRY_ID = ENTRY_ID;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
