/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  turbopack: {},
  serverExternalPackages: ["@anthropic-ai/sdk"],
};

module.exports = config;
