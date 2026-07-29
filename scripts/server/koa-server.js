const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const Koa = require('koa');
const serve = require('koa-static');
const proxy = require('koa-proxies');

function findStaticRoot() {
  const execDir = path.dirname(process.execPath);
  const projectRoot = path.resolve(__dirname, '..', '..');
  const cwd = process.cwd();

  const candidates = [
    // Running from source (node scripts/server/koa-server.js)
    path.join(cwd, 'dist', 'web'),
    path.join(projectRoot, 'dist', 'web'),

    // Running packaged exe from repository root
    path.join(execDir, 'dist', 'web'),

    // Running packaged exe from dist folder (dist/coder-online-tools-lab.exe + dist/web)
    path.join(execDir, 'web'),
    path.join(cwd, 'web'),

    // Fallback: parent of current directory contains dist/web
    path.join(cwd, '..', 'dist', 'web'),
    path.join(execDir, '..', 'dist', 'web')
  ];

  for (const dir of candidates) {
    const indexFile = path.join(dir, 'index.html');
    if (fs.existsSync(indexFile)) {
      return dir;
    }
  }

  return null;
}

function safeWriteFile(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (_) {
    // Ignore file write errors to avoid masking startup issue.
  }
}

function showWindowsMessageBox(message) {
  if (process.platform !== 'win32') return;

  // Escape single quotes for PowerShell single-quoted string.
  const escaped = String(message).replace(/'/g, "''");
  const script = [
    'Add-Type -AssemblyName PresentationFramework',
    `[System.Windows.MessageBox]::Show('${escaped}', 'js-tools-server 启动失败') | Out-Null`
  ].join('; ');

  try {
    spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    }).unref();
  } catch (_) {
    // Ignore popup failures and rely on console/file message.
  }
}

function exitWithStartupError(candidates) {
  const execDir = path.dirname(process.execPath);
  const detailLines = [
    'Cannot find index.html under expected static roots.',
    '',
    `cwd: ${process.cwd()}`,
    `execPath: ${process.execPath}`,
    '',
    'Checked paths:',
    ...candidates.map(dir => `- ${path.join(dir, 'index.html')}`)
  ];
  const detail = detailLines.join('\n');

  console.error(detail);

  const logPath = path.join(execDir, 'startup-error.log');
  safeWriteFile(logPath, `${new Date().toISOString()}\n${detail}\n`);

  showWindowsMessageBox(`找不到静态资源，请确认同目录存在 web 文件夹。\n\n详情日志: ${logPath}`);
  process.exit(1);
}

const app = new Koa();
const host = process.env.HOST || '0.0.0.0';
const port = Number(process.env.PORT || 8181);
const apiTarget = process.env.API_TARGET || 'http://www.abc.com';
const staticRoot = findStaticRoot();

if (!staticRoot) {
  const execDir = path.dirname(process.execPath);
  const projectRoot = path.resolve(__dirname, '..', '..');
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, 'dist', 'web'),
    path.join(projectRoot, 'dist', 'web'),
    path.join(execDir, 'dist', 'web'),
    path.join(execDir, 'web'),
    path.join(cwd, 'web'),
    path.join(cwd, '..', 'dist', 'web'),
    path.join(execDir, '..', 'dist', 'web')
  ];
  exitWithStartupError(candidates);
}

app.use(proxy('/api', {
  target: apiTarget,
  changeOrigin: true,
  rewrite: p => p.replace(/^\/api/, '/api'),
  logs: true
}));

app.use(serve(staticRoot));

app.use(async (ctx, next) => {
  await next();

  if (
    ctx.status === 404 &&
    ctx.method === 'GET' &&
    !ctx.path.startsWith('/api') &&
    !path.extname(ctx.path)
  ) {
    ctx.type = 'html';
    ctx.body = fs.createReadStream(path.join(staticRoot, 'index.html'));
  }
});

app.listen(port, host, () => {
  console.log('Koa service started.');
  console.log(`- URL: http://${host}:${port}`);
  console.log(`- Static Root: ${staticRoot}`);
  console.log(`- API Proxy: /api -> ${apiTarget}/api`);
});
