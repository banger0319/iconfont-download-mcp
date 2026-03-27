#!/usr/bin/env node

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import extract from 'extract-zip';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Support --stdio flag
const args = process.argv.slice(2);
if (args.includes('--stdio')) {
  // Continue with stdio mode
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function sendResponse(id, result) {
  console.log(JSON.stringify({
    jsonrpc: '2.0',
    id,
    result
  }));
}

function sendError(id, code, message) {
  console.log(JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: { code, message }
  }));
}

async function downloadIconfont(pid, outputDir) {
  const cookie = process.env.EGG_SESS_ICONFONT;
  if (!cookie) {
    throw new Error('EGG_SESS_ICONFONT environment variable not set');
  }

  const zipPath = path.join(outputDir, 'iconfont.zip');
  const extractDir = path.join(outputDir, 'temp');

  return new Promise((resolve, reject) => {
    https.get(`https://www.iconfont.cn/api/project/download.zip?pid=${pid}`, {
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0'
      }
    }, async (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: ${res.statusCode}`));
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
            throw new Error('Font directory not found');
          }

          const sourceDir = path.join(extractDir, subDir);
          files.forEach(file => {
            const src = path.join(sourceDir, file);
            const dest = path.join(outputDir, file);
            if (fs.existsSync(src)) {
              fs.copyFileSync(src, dest);
            }
          });

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

rl.on('line', async (line) => {
  try {
    const msg = JSON.parse(line);
    const { id, method, params } = msg;

    if (method === 'initialize') {
      sendResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: {},
        serverInfo: {
          name: 'iconfont-mcp',
          version: '1.0.0'
        }
      });
    } else if (method === 'tools/list') {
      sendResponse(id, {
        tools: [{
          name: 'downloadIconfont',
          description: 'Download and extract iconfont files',
          inputSchema: {
            type: 'object',
            properties: {
              pid: { type: 'string', description: 'Project ID' },
              outputDir: { type: 'string', description: 'Output directory' }
            },
            required: ['pid', 'outputDir']
          }
        }]
      });
    } else if (method === 'tools/call') {
      const { name, arguments: args } = params;
      if (name === 'downloadIconfont') {
        const result = await downloadIconfont(args.pid, args.outputDir);
        sendResponse(id, result);
      } else {
        sendError(id, -32601, 'Tool not found');
      }
    } else {
      sendError(id, -32601, 'Method not found');
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
});
