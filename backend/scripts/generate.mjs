import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cli = require.resolve('prisma/build/index.js');
const result = spawnSync(process.execPath, [cli, 'generate'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    // Prisma's generator uses its bundled WASM parser. Pointing the legacy schema
    // engine check at Node avoids unnecessary binary downloads in offline builds.
    PRISMA_SCHEMA_ENGINE_BINARY: process.env.PRISMA_SCHEMA_ENGINE_BINARY || process.execPath,
  },
});
process.exit(result.status ?? 1);
