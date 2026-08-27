import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dockerfile 이 .next/standalone 만 런타임 이미지에 담는다 (docs 06 §3)
  output: "standalone",

  // 백엔드 호출은 app/api/v1/[...path]/route.ts 가 대신한다 → CORS 설정 불필요.
  // rewrites 를 쓰지 않는 이유는 두 가지다. (1) 요청 헤더를 붙일 수 없어 백엔드 열쇠를
  // 실을 자리가 없다 (D-26). (2) rewrites 는 빌드 때 계산돼 박히므로 배포 환경마다
  // 다시 빌드해야 한다.
};

export default nextConfig;
