import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
if (!existsSync('.dev.vars')) {
  writeFileSync(
    '.dev.vars',
    `APP_URL=http://localhost:4317\nBETTER_AUTH_SECRET=${randomBytes(32).toString('hex')}\nENABLE_CHATGPT_AUTH=true\nADMIN_EMAILS=seedy@sites.test\n`,
    { mode: 0o600 },
  );
  console.log(
    'Created local-only environment. No production services enabled.',
  );
}
const result = spawnSync(
  'npx',
  [
    'wrangler',
    'd1',
    'migrations',
    'apply',
    'DB',
    '--local',
    '--config',
    'wrangler.local.json',
  ],
  { stdio: 'inherit' },
);
if (result.status !== 0) process.exit(result.status || 1);
