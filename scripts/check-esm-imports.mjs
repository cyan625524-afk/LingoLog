#!/usr/bin/env node
/**
 * 云平台 ESM 导入检查
 *
 * 为什么需要这个检查：package.json 是 "type": "module"，云平台函数以原生 ESM 运行，
 * 而 ESM **不做扩展名补全** —— 相对导入少一个 .js 后缀，函数会在模块加载阶段
 * 就报 ERR_MODULE_NOT_FOUND，线上只表现为 FUNCTION_INVOCATION_FAILED (500)。
 * 崩在模块加载阶段，所以 api/*.ts 里那层 try/catch 一行都执行不到。
 *
 * 这个错误有三层伪装，靠常规手段发现不了：
 *   1. tsconfig 是 moduleResolution: "bundler"，无后缀写法 tsc 一路绿灯；
 *   2. 本地跑（tsx / Vite / esbuild）都会自动补后缀，怎么测都正常；
 *   3. 构建产物看起来完全正常（实测 .vercel/output 里的引用是对的）。
 * 「本地跑通」「类型检查通过」「构建通过」都不构成「线上接口能跑」的证据。
 *
 * 实现说明：这里**不用正则**。逐行正则抓不住跨行导入（`import {\\n a,\\n} from './x'`
 * 的 from 单独一行），漏检方向是危险的。改用 esbuild 的 metafile —— 它是真解析器，
 * 能给出每个文件原始的导入说明符。bare 导入（node_modules）全部标记为 external，
 * 所以只会遍历本站自己的相对导入链，不会跟进依赖树。
 *
 * 用法：npm run check:esm（已并入 npm run lint）。退出码 1 = 禁止部署。
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JS_EXT_RE = /\.(js|mjs|cjs)$/;

let esbuild;
try {
  esbuild = await import(pathToFileURL(path.join(ROOT, 'node_modules', 'esbuild', 'lib', 'main.js')).href);
} catch {
  try {
    esbuild = await import('esbuild');
  } catch {
    console.error('⚠️  找不到 esbuild，跳过 ESM 导入检查（先执行 npm install）。');
    process.exit(0);
  }
}

function collectEntryPoints() {
  const entries = [];
  const apiDir = path.join(ROOT, 'api');
  if (fs.existsSync(apiDir)) {
    for (const f of fs.readdirSync(apiDir)) {
      if (/\.(ts|tsx|js|mjs)$/.test(f) && !f.endsWith('.d.ts')) entries.push(path.join(apiDir, f));
    }
  }
  const serverEntry = path.join(ROOT, 'server.ts');
  if (fs.existsSync(serverEntry)) entries.push(serverEntry);
  return entries;
}

const entryPoints = collectEntryPoints();
if (entryPoints.length === 0) {
  console.error('⚠️  没找到 api/* + server.ts 入口，检查脚本是否放错了位置。');
  process.exit(0);
}

let metafile;
try {
  const result = await esbuild.build({
    entryPoints,
    absWorkingDir: ROOT,
    bundle: true,
    write: false,          // 只在内存里解析，不落盘
    metafile: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    logLevel: 'silent',
    outdir: path.join(ROOT, '.esm-check-out'),
    plugins: [
      {
        // 只用 external 排除 bare 导入（三方包），相对导入必须继续解析、
        // 从而进入 metafile —— 否则整条本站导入链会被一起排除掉，等于什么都没查。
        // 注意入口点是绝对路径（Windows 下形如 D:\...），不能当 bare 处理，
        // 否则 esbuild 会报 "entry point cannot be marked as external"。
        name: 'externalize-bare-imports',
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            if (args.kind === 'entry-point') return undefined;
            const p = args.path;
            const isRelativeOrAbsolute =
              p.startsWith('./') || p.startsWith('../') || p === '.' || p === '..' || path.isAbsolute(p);
            if (isRelativeOrAbsolute) return undefined; // 本站代码：继续解析
            return { path: p, external: true }; // 三方包：不跟进
          });
        },
      },
    ],
  });
  metafile = result.metafile;
} catch (err) {
  console.error('❌ 解析导入链失败 —— 说明有相对导入指向了不存在的文件，或语法错误：');
  console.error(String(err?.message || err).split('\n').slice(0, 20).join('\n'));
  process.exit(1);
}

const problems = [];
let scannedFiles = 0;
let relativeImports = 0;

for (const [file, info] of Object.entries(metafile.inputs)) {
  scannedFiles++;
  for (const imp of info.imports || []) {
    const original = imp.original ?? imp.path;
    if (!original || !original.startsWith('.')) continue; // 只看相对导入
    relativeImports++;
    if (!JS_EXT_RE.test(original)) {
      problems.push({ file, original, resolved: imp.path });
    }
  }
}

const rel = (p) => p.replace(/\\/g, '/');

if (problems.length === 0) {
  console.log(
    `✅ ESM 导入检查通过：解析 ${scannedFiles} 个文件，${relativeImports} 处相对导入均带扩展名。`
  );
  process.exit(0);
}

console.error('❌ ESM 导入检查未通过 —— 这样部署上去，云平台函数会 FUNCTION_INVOCATION_FAILED (500)。\n');
console.error(`以下 ${problems.length} 处相对导入缺少 .js 后缀（ESM 不补扩展名）：\n`);
for (const p of problems) {
  console.error(`  ${rel(p.file)}`);
  console.error(`      '${p.original}'   →  应为 '${p.original}.js'`);
}
console.error('\n修复方式：给这些相对导入补上 .js 后缀。');
console.error('前端（Vite）与 esbuild 都会把 "./x.js" 解析回 x.ts，所以补后缀不影响本地构建与开发。');
console.error('只补第一跳不够 —— 整条链（api/* → server.ts → src/**）每一段都要带后缀，本检查会全部列出。');
process.exit(1);
