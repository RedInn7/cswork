import type { NextConfig } from 'next';

// Every UA gets blocking metadata, so crawlers (Googlebot included) see
// <title>/canonical inside <head>; our metadata is cheap SQLite reads.
const nextConfig: NextConfig = { output: 'standalone', htmlLimitedBots: /.*/ };

export default nextConfig;
