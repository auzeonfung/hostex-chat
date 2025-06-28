const { execSync } = require('child_process');
const path = require('path');
const root = path.resolve(__dirname, '..');
const tscCmd = 'npx tsc ' +
  path.join(root, 'frontend/src/lib/*.ts') +
  ' --module commonjs --target es2020 --moduleResolution node --esModuleInterop --lib ES2020 --typeRoots ' +
  path.join(root, 'frontend/node_modules/@types') +
  ' --skipLibCheck --outDir ' +
  path.join(root, 'tests/build');
execSync(tscCmd, { stdio: 'inherit' });
const env = { ...process.env, NODE_PATH: path.join(root, 'frontend/node_modules') };
execSync('node --test', { stdio: 'inherit', cwd: root, env });
