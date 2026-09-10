import type { NextConfig } from 'next';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRootEnv } from './load-root-env.mjs';

loadRootEnv();

const monorepoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

const config: NextConfig = {
  reactStrictMode: true,
  // Stop Next picking a parent-folder lockfile as the workspace root.
  outputFileTracingRoot: monorepoRoot,
  // Docker image on a t4g.small: ship the traced server, not node_modules.
  output: 'standalone',
  // The workspace packages ship TypeScript source, not a build step.
  transpilePackages: ['@carnival/shared', '@carnival/db'],
  serverExternalPackages: ['postgres'],
  eslint: { ignoreDuringBuilds: true },
  poweredByHeader: false,
  webpack: (config) => {
    // The workspace packages are ESM TypeScript and import each other with the
    // `.js` specifiers Node requires. Webpack has to be told those resolve to
    // the `.ts` files they were written in.
    config.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'] };
    return config;
  },
};

export default config;
