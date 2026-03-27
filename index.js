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
  { instructions: '从 iconfont.cn 下载项目字体包并解压出 CSS 与字体文件。需设置 EGG_SESS_ICONFONT。' }
);

server.registerTool(
  'downloadIconfont',
  {
    description: '从 iconfont.cn 下载指定项目（pid）的字体包，并解压 iconfont.css / ttf / woff / woff2 到 outputDir',
    inputSchema: {
      pid: z.string().describe('iconfont 项目 ID'),
      outputDir: z.string().describe('输出目录的绝对路径或相对路径')
    }
  },
  async ({ pid, outputDir }) => {
    const resolved = path.isAbsolute(outputDir)
      ? outputDir
      : path.resolve(process.cwd(), outputDir);
    const result = await downloadIconfont(pid, resolved);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
