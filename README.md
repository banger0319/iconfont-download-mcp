# figma-developer-mcp

MCP server for downloading and extracting iconfont files from iconfont.cn.

## Installation

```bash
npm install -g figma-developer-mcp
```

## Configuration

Add to your Kiro MCP configuration (`~/.kiro/settings/mcp.json` or `.kiro/settings/mcp.json`):

```json
{
  "mcpServers": {
    "iconfont": {
      "command": "cmd",
      "args": [
        "/c",
        "npx",
        "-y",
        "figma-developer-mcp",
        "--stdio"
      ],
      "env": {
        "EGG_SESS_ICONFONT": "your_iconfont_cookie_here"
      }
    }
  }
}
```

## Usage

The server provides a `downloadIconfont` tool with parameters:
- `pid`: Project ID from iconfont.cn
- `outputDir`: Directory to save extracted files

## Environment Variables

- `EGG_SESS_ICONFONT`: Cookie for iconfont.cn authentication (required)

## Files Extracted

- iconfont.css
- iconfont.ttf
- iconfont.woff
- iconfont.woff2
