# 2026-10-01 系统代理与菜单改进（0.4.0）

- 参考 dsh-free-search origin/master 的系统代理检测和 Select 菜单实现，为全局及单个提供商加入系统代理自动检测。
- 检测环境变量、Windows Internet Settings 与 macOS scutil；保留启动环境快照避免插件自反馈，30 秒刷新；保持旧手动配置兼容。
- 新增受本机及同源限制的状态接口，代理认证信息在显示及日志中遮蔽。
- 自定义菜单具有圆角浮层、悬停高亮、选中勾号，支持方向键、Home/End、Enter、Escape、Tab、点击外部关闭及滚动定位。
- 更新中英文文档、版本号与提交的构建产物。
- 验证：npm ci、typecheck、33 项测试、build、git diff --check 通过；本机检测得到 HTTP 代理 127.0.0.1:7892。浏览器模拟宿主验证了菜单显示、键盘选择、Escape 关闭和保存回读。
- 边界：界面验证使用模拟宿主，未在正在运行的真实 DSH 中加载新版插件。macOS 使用样本测试；不支持 SOCKS、PAC/WPAD。检测不到时恢复启动路由或跟随全局，并发出的旧请求继续原路由。
- 发布：使用现有 publish.yml，由主分支上的 v0.4.0 标签触发；具体运行与 npm 发布结果以 GitHub Actions 和 npm registry 为准。
