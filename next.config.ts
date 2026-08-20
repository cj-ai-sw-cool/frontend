import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dockerfile 이 .next/standalone 만 런타임 이미지에 담는다 (docs 06 §3)
  output: "standalone",

  // 브라우저는 프론트만 보고, 백엔드 호출은 Next 서버가 대신한다 → CORS 설정 불필요.
  // 컨테이너 안에서는 backend:8000, 로컬 직접 실행 시엔 127.0.0.1:8000 (docs 06 §5)
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8000"}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
