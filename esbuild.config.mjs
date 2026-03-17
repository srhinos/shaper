import { build, context } from 'esbuild';
import { cpSync, mkdirSync } from 'fs';

const watch = process.argv.includes('--watch');

const shared = {
  bundle: true,
  sourcemap: true,
  target: 'firefox67',
  format: 'iife',
  logLevel: 'info',
};

async function run() {
  mkdirSync('dist/popup', { recursive: true });
  mkdirSync('dist/dashboard', { recursive: true });

  cpSync('static', 'dist', { recursive: true });
  cpSync('src/popup/popup.html', 'dist/popup/popup.html');
  cpSync('src/dashboard/dashboard.html', 'dist/dashboard/dashboard.html');

  const configs = [
    { ...shared, entryPoints: ['src/background.ts'], outfile: 'dist/background.js' },
    { ...shared, entryPoints: ['src/popup/popup.ts'], outfile: 'dist/popup/popup.js' },
    { ...shared, entryPoints: ['src/dashboard/dashboard.ts'], outfile: 'dist/dashboard/dashboard.js' },
  ];

  if (watch) {
    for (const config of configs) {
      const ctx = await context(config);
      await ctx.watch();
    }
    console.log('Watching for changes...');
  } else {
    await Promise.all(configs.map(c => build(c)));
  }
}

run();
