# 2026-10-01 添加提供商菜单遗漏修复（0.4.1）

- 用户截图指出「添加提供商」候选列表仍为浏览器原生样式。确认 0.4.0 只替换了代理方式菜单，遗漏 input + datalist。
- 新增 ProviderPicker，移除原生 datalist，复用代理菜单的浮层背景、圆角、阴影和悬停样式，宽度上限 440px、高度上限 280px，空间不足时向上展开。
- 保留手动填写 ID、按 ID/名称筛选，支持方向键、Enter、Esc、Tab 和点击外部关闭；候选项排除已添加的提供商。
- 验证：npm ci、typecheck、33 项测试、build、diff --check 通过。浏览器模拟宿主实际验证了 22 项候选列表限高滚动、moon 筛选、键盘选中、点击添加、自定义 ID、Esc 关闭和放弃修改回读。
- 预览保存在 Codex visualizations 的 provider-picker.png。验证使用模拟宿主，尚未替用户升级或重启正在运行的真实 DSH。
- 修正版通过主分支上的 v0.4.1 标签触发既有 npm 发布 Action。
