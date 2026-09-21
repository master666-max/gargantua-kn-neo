# THIRD-PARTY NOTICES — gargantua-kn-neo

本项目自身代码以 **MIT** 授权（见 [LICENSE](LICENSE)）。
本项目**包含**以下第三方组件，其版权归各自作者所有，按其自身许可分发。
依 MIT 的要求，以下版权声明与许可全文均**原样保留**在对应文件中。

---

## 1. Three.js

| 项 | 内容 |
|---|---|
| 组件 | Three.js（`three.module.js`，REVISION `160`） |
| 位置 | `vendor/three.module.js`、`vendor/jsm/controls/` |
| 版本 | r160 |
| 版权 | **Copyright 2010-2023 Three.js Authors** |
| 许可 | **MIT**（`SPDX-License-Identifier: MIT`） |
| 项目主页 | https://threejs.org/ |
| 源码仓库 | https://github.com/mrdoob/three.js |

该文件的文件头**已保留**原始声明：

```js
/**
 * @license
 * Copyright 2010-2023 Three.js Authors
 * SPDX-License-Identifier: MIT
 */
```

**MIT 许可全文**（Three.js 适用）与本仓库 [LICENSE](LICENSE) 正文相同（同为 MIT），
差异仅在版权署名主体（Three.js Authors / 本项目作者）。

---

## 关于本项目自身的许可范围

- **属于本项目原创**：`js/`、`shaders/`、`css/`、`index.html`、`tools/`、
  `docs/`、各 `.cmd` / `.vbs` 启动脚本、README 等
- **第三方**：仅 `vendor/` 下的 Three.js 及其 addons

> 若后续再 vendor 其它第三方库，请在此文件按同样格式追加一节
> （位置 / 版本 / 版权 / 许可 / 来源），并在对应文件内保留原始声明。
