import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 대용량 아이콘 배럴 → 사용한 아이콘만 번들(빌드/번들 경량화).
  experimental: {
    optimizePackageImports: ["@tabler/icons-react"],
  },
};

export default nextConfig;
