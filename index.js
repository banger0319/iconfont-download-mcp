#!/usr/bin/env node

import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import extract from 'extract-zip';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 接受纯数字 pid，或 iconfont.cn 项目/管理页 URL，解析出项目 ID。
 */
function resolveIconfontProjectId(raw) {
  const s = String(raw).trim();
  if (!s) {
    throw new Error('pid 不能为空');
  }
  if (/^\d+$/.test(s)) {
    return s;
  }

  let url;
  try {
    url = new URL(s);
  } catch {
    const q = s.match(/(?:projectId|pid)=(\d+)/i);
    if (q) {
      return q[1];
    }
    throw new Error('无法从内容中解析项目 ID，请传入纯数字 pid 或 iconfont.cn 项目链接');
  }

  if (!url.hostname.includes('iconfont.cn')) {
    throw new Error('链接需为 iconfont.cn 域名，或为纯数字项目 ID');
  }

  const fromQuery =
    url.searchParams.get('projectId') ||
    url.searchParams.get('pid');
  if (fromQuery && /^\d+$/.test(fromQuery)) {
    return fromQuery;
  }

  const pathMatch = url.pathname.match(/\/(?:project|detail)\/(\d+)/i);
  if (pathMatch) {
    return pathMatch[1];
  }

  const loose = s.match(/(?:projectId|pid)=(\d+)/i);
  if (loose) {
    return loose[1];
  }

  throw new Error('链接中未找到 projectId / pid，请打开项目「管理」或「我的项目」复制带 projectId 的地址');
}

async function downloadIconfont(pid, outputDir) {
  const cookie = process.env.EGG_SESS_ICONFONT;
  if (!cookie) {
    throw new Error('缺少环境变量 EGG_SESS_ICONFONT（iconfont.cn 登录 Cookie）');
  }

  const zipPath = path.join(outputDir, 'iconfont.zip');
  const extractDir = path.join(outputDir, 'temp');

  return new Promise((resolve, reject) => {
    https.get(`https://www.iconfont.cn/api/project/download.zip?pid=${pid}`, {
      headers: {
        Cookie: cookie,
        'User-Agent': 'Mozilla/5.0'
      }
    }, async (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`下载失败: HTTP ${res.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(zipPath);
      res.pipe(file);

      file.on('finish', async () => {
        file.close();
        try {
          if (fs.existsSync(extractDir)) {
            fs.rmSync(extractDir, { recursive: true });
          }
          fs.mkdirSync(extractDir, { recursive: true });

          await extract(zipPath, { dir: extractDir });

          const files = ['iconfont.css', 'iconfont.ttf', 'iconfont.woff', 'iconfont.woff2'];
          const subDir = fs.readdirSync(extractDir).find(name => name.startsWith('font_'));

          if (!subDir) {
            throw new Error('未在压缩包中找到 font_ 目录');
          }

          const sourceDir = path.join(extractDir, subDir);
          for (const name of files) {
            const src = path.join(sourceDir, name);
            const dest = path.join(outputDir, name);
            if (fs.existsSync(src)) {
              fs.copyFileSync(src, dest);
            }
          }

          fs.rmSync(extractDir, { recursive: true });
          fs.unlinkSync(zipPath);

          resolve({ success: true, outputDir });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

const server = new McpServer(
  { name: 'gl-d-icon-font', version: '1.0.0' },
  {
    instructions: [
      '【意图】当用户消息里出现 iconfont.cn 的链接（尤其是 manage/index、含 projectId= 或 pid= 的地址），应视为要下载该项目字体资源，并优先调用工具 downloadIconfont，而不是只解释链接。',
      '【参数】pid 传用户给出的完整 URL 或纯数字项目 ID；outputDir 若用户未指定，先简短询问保存目录，或使用当前工作区下的合理路径（如 assets/iconfont）并说明。',
      '【前提】需已在 MCP 环境配置 EGG_SESS_ICONFONT（iconfont 登录 Cookie）。',
      '【能力】服务端会从 URL 中解析 projectId，例如 manage/index?...&projectId=2615915。'
    ].join('\n')
  }
);

server.registerTool(
  'downloadIconfont',
  {
    description:
      '从 iconfont.cn 下载指定项目的字体包，并解压 iconfont.css / ttf / woff / woff2 到 outputDir。用户粘贴 manage/index?...projectId=xxx 等完整链接时，将整段 URL 作为 pid 传入即可。pid 也可为纯数字。',
    inputSchema: {
      pid: z
        .string()
        .describe(
          '项目 ID：纯数字，或 iconfont.cn 项目页/管理页完整 URL（例如含 ?projectId=123456）'
        ),
      outputDir: z.string().describe('输出目录的绝对路径或相对路径')
    }
  },
  async ({ pid, outputDir }) => {
    const resolvedPid = resolveIconfontProjectId(pid);
    const resolved = path.isAbsolute(outputDir)
      ? outputDir
      : path.resolve(process.cwd(), outputDir);
    const result = await downloadIconfont(resolvedPid, resolved);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ ...result, pid: resolvedPid }, null, 2)
        }
      ]
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
