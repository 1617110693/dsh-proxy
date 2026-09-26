# dsh-network-proxy

[English](README.md) | 中文

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）的网络代理插件：

- **全局代理**：在「设置 → 网络代理」里填 `http://127.0.0.1:7890`，模型请求、联网搜索、网页抓取、HTTP MCP 以及 Agent 启动的命令都走这个代理；
- **按提供商代理**：给某个模型提供商单独指定代理地址，或强制直连，例如 Anthropic 走 `http://127.0.0.1:7890`、DeepSeek 直连；
- **保存即生效**：不需要重启 dsh。

优先级：提供商设置 > 全局代理 > 启动时的 `HTTP(S)_PROXY` 环境变量。

## 安装

```sh
dsh plugin --profile web add github:1617110693/dsh-proxy
```

仓库里已提交构建产物（`lib/`、`client/`），从 GitHub 安装不需要执行构建脚本，也不需要配置 `allowBuilds`。
重启 `dsh web` 后，「设置」中会出现「网络代理」页面。

> 请用上面的 `github:` 地址安装。npm 上同名的 `dsh-network-proxy` 是另一个无关的包，`dsh plugin add dsh-network-proxy` 装到的不是本插件。

### 从旧名称 `dsh-plugin-proxy` 升级

0.2.0 起包名改为 `dsh-network-proxy`。先卸载旧包再安装：

```sh
dsh plugin --profile web remove dsh-plugin-proxy
dsh plugin --profile web add github:1617110693/dsh-proxy
```

如果之前在设置页保存过代理配置，打开 `$DSH_HOME/profiles/web/cordis.patch.yml`，把 `id: dsh-proxy` 那一项里的 `name: dsh-plugin-proxy` 改成 `name: dsh-network-proxy`（或删掉这一行）。代理配置本身不用改。

## 使用

打开「设置 → 网络代理」：

| 区域 | 说明 |
|---|---|
| 全局代理 | 勾选「启用」，填写代理地址（如 `http://127.0.0.1:7890`）。「不走代理的主机」每行一个，会同时匹配子域名；`localhost` / `127.0.0.1` 始终直连。 |
| 按提供商代理 | 列出已配置的模型提供商，每个可选「跟随全局 / 使用代理 / 直连」。未列出的提供商可以在下方输入 id 添加（如 `deepseek-official`、`anthropic`、`openai`，或你在「模型」页自定义的 Provider ID）。 |

点「保存」后立即对后续请求生效，包括「模型」页的「获取可用模型」。

### 直接写配置文件

也可以编辑 `$DSH_HOME/profiles/<profile>/cordis.patch.yml`（Web UI 默认 profile 为 `web`），效果相同：

```yaml
- id: dsh-proxy
  config:
    global:
      enabled: true
      url: http://127.0.0.1:7890
      noProxy: [internal.example.com]
    providers:
      anthropic:
        mode: proxy
        url: http://127.0.0.1:7890
      deepseek-official:
        mode: direct
```

| 字段 | 说明 |
|---|---|
| `global.enabled` | 是否启用全局代理，默认 `false`（沿用启动环境变量）。 |
| `global.url` | 全局代理地址。 |
| `global.noProxy` | 全局代理下直连的主机列表。 |
| `providers.<id>.enabled` | 是否启用该提供商的单独设置，默认 `true`；`false` 时跟随全局。 |
| `providers.<id>.mode` | `proxy`（走 `url`）或 `direct`（强制直连，连全局代理也绕过）。 |
| `providers.<id>.url` | 该提供商的代理地址。 |

代理地址支持 `http://` 和 `https://`，可以写成 `127.0.0.1:7890`（自动补 `http://`），需要认证时写 `http://user:password@host:port`。

## 工作原理

- **全局代理** 通过 dsh 自带的 `@deepseek-ai/dsh-http-proxy` 安装（启动器处理 `HTTP(S)_PROXY` 用的就是它），因此本机回环直连、`NO_PROXY` 匹配、`web_fetch` 的路由判断、子进程的代理环境变量都与官方行为一致。关闭全局代理会恢复启动时的设置。
- **按提供商代理** 挂在 `llm/stream` 中间件上：该提供商的一次模型调用在一个异步上下文里进行，插件把对应的 undici `ProxyAgent`（或直连 `Agent`）放进 AsyncLocalStorage，`fetch` 在这个上下文里就会使用它；其他请求不受影响，并发的不同提供商请求互不干扰。
- 两部分配置都是 Cordis 的 volatile 字段：设置页保存后，dsh 触发 `loader/volatile-update`，插件原地切换路由，不会重载。

## 限制

- 只支持 HTTP(S) 代理，不支持 SOCKS5。Clash、v2rayN 等的「混合端口」（如 7890）同时支持 HTTP，填这个端口即可。
- 按提供商代理只作用于该提供商的模型请求（含获取模型列表）。联网搜索、网页抓取等其他请求走全局代理。
- 用户名和密码会以明文保存在 profile 的 `cordis.patch.yml` 中，全局代理的地址还会通过环境变量传给 Agent 启动的命令。
- 遥测上报使用 Node 的 `http` 模块，不经过代理（与 dsh 官方行为一致）。

## 开发

```sh
npm install
npm run typecheck
npm test        # 用本地假代理验证全局 / 提供商 / 直连路由
npm run build   # 生成 lib/ 与 client/（需提交）
```

在本地 dsh 中调试：`dsh plugin --profile web add /path/to/dsh-proxy`。

## License

MIT
