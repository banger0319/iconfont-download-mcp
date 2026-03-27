# gl-d-icon-font

基于 [Model Context Protocol](https://modelcontextprotocol.io) 的服务端：从 [iconfont.cn](https://www.iconfont.cn) 下载项目压缩包，并解压出 `iconfont.css`、`iconfont.ttf`、`iconfont.woff`、`iconfont.woff2`。

实现使用官方 SDK：`@modelcontextprotocol/sdk` + **stdio** 传输，可直接被 Cursor 作为本地 MCP 进程拉起。

## 在 Cursor 中安装

1. **依赖**：本机需安装 **Node.js 18+**。
2. **配置 MCP**：在 Cursor 中打开 **Settings → Tools & MCP**，点击 **Add new global MCP server**，或编辑配置文件（见下）。
3. **环境变量**：必须配置 `EGG_SESS_ICONFONT`（你在浏览器登录 iconfont.cn 后的 Cookie，用于调用下载接口）。

### 配置文件位置

- **用户级（推荐）**：`%USERPROFILE%\.cursor\mcp.json`（Windows）或 `~/.cursor/mcp.json`（macOS / Linux）
- **项目级**：仓库根目录下的 `.cursor/mcp.json`（可与用户级合并；同名服务器以项目级为准）

修改配置后建议**完全重启 Cursor** 再试。

### 示例：使用本仓库源码（开发 / 本地路径）

将 `command` / `args` 中的路径换成你本机克隆后的 **绝对路径**：

```json
{
  "mcpServers": {
    "iconfont": {
      "command": "node",
      "args": [
        "C:/Users/GL/.cursor/skills/figma-generate-component/mcp-server/index.js"
      ],
      "env": {
        "EGG_SESS_ICONFONT": "你的_iconfont_Cookie"
      }
    }
  }
}
```

### 示例：全局安装后使用 `gl-d-icon-font` 命令

```bash
npm install -g .
```

```json
{
  "mcpServers": {
    "iconfont": {
      "command": "gl-d-icon-font",
      "args": [],
      "env": {
        "EGG_SESS_ICONFONT": "你的_iconfont_Cookie"
      }
    }
  }
}
```

### 示例：不全局安装，用 `npx` 跑当前目录包（需已 `npm install`）

```json
{
  "mcpServers": {
    "iconfont": {
      "command": "npx",
      "args": ["gl-d-icon-font"],
      "cwd": "C:/path/to/mcp-server",
      "env": {
        "EGG_SESS_ICONFONT": "你的_iconfont_Cookie"
      }
    }
  }
}
```

若包名未发布到 npm，请将 `args` 改为 `[".", "gl-d-icon-font"]` 并把 `cwd` 指向本仓库根目录（依赖本地 `node_modules`）。

## 提供的工具

| 名称 | 说明 |
|------|------|
| `downloadIconfont` | 参数：`pid`（项目 ID）、`outputDir`（输出目录）。下载并解压字体相关文件到该目录。 |

## 环境变量

| 变量 | 说明 |
|------|------|
| `EGG_SESS_ICONFONT` | **必填**。iconfont.cn 请求下载接口时使用的 Cookie。 |

## 输出文件

成功后在 `outputDir` 中生成：

- `iconfont.css`
- `iconfont.ttf`
- `iconfont.woff`
- `iconfont.woff2`
