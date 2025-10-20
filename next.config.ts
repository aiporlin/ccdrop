import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 配置图片优化
  images: {
    unoptimized: true,
  },
  // 配置基础路径（如果部署在子路径）
  basePath: "",
  // 排除workers目录，因为它是Cloudflare Workers后端代码
  pageExtensions: ['tsx', 'ts'],
  // 启用静态导出
  output: 'export',
  // 配置路径别名
  webpack: (config) => {
    // 排除workers目录
    config.module.rules.push({
      test: /src\\workers\\/,
      loader: 'ignore-loader',
    });
    return config;
  },
};

export default nextConfig;
