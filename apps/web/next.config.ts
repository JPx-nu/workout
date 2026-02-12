import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
