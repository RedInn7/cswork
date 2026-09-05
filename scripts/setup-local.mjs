import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
if (!existsSync('.env')) {
  writeFileSync(
    '.env',
    `APP_URL=http://localhost:4317\nHOST=127.0.0.1\nPORT=4317\nBETTER_AUTH_SECRET=${randomBytes(48).toString('base64url')}\nADMIN_EMAILS=teacher@cswork.test\nDATABASE_PATH=data/cswork.sqlite\nATTACHMENTS_PATH=data/attachments\n`,
    { mode: 0o600 },
  );
}
const result = spawnSync(
  process.execPath,
  ['--env-file=.env', 'scripts/migrate.mjs'],
  { stdio: 'inherit' },
);
if (result.status !== 0) process.exit(result.status || 1);
console.log(
  'Create a local teacher: npm run admin:create -- teacher@cswork.test',
);
