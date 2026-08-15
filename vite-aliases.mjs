import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const klankAliases = {
  '@klank/ui': resolve(__dirname, 'libs/ui/src/index.ts'),
  '@klank/store': resolve(__dirname, 'libs/store/src/index.ts'),
  '@klank/platform-api': resolve(__dirname, 'libs/platform-api/src/index.ts'),
  '@klank/audio': resolve(__dirname, 'libs/audio/src/index.ts'),
};
