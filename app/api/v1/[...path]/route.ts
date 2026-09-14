/**
 * 백엔드로 넘기는 통로 (D-26).
 *
 * next.config.ts 의 rewrites 로는 요청 헤더를 붙일 수 없어 여기서 직접 넘긴다. 백엔드는
 * 인터넷에 열려 있고 로그인이 없어서 `X-Api-Key` 를 요구하는데, 그 열쇠를 브라우저에 내려보내면
 * 막는 의미가 없다. 그래서 서버에서만 붙인다 — 화면은 열쇠를 모른 채 `/api/v1/...` 을 부른다.
 *
 * 화면 자체는 proxy.ts 의 계정으로 막혀 있으므로, 여기까지 오는 요청은 이미 팀원이다.
 */
import { type NextRequest, NextResponse } from "next/server";

// Stage 11A(정본 §13.3) — `/events/stream`(SSE)이 이 라우트를 거친다. 정적 최적화
// 후보로 잡히면 스트리밍 응답이 끝까지 버퍼링된 뒤에야 브라우저로 가는 문제가
// 라이브 검증에서 나왔다(curl 로 백엔드는 즉시 스트리밍, 이 라우트를 거치면 6초
// 넘게 0바이트) — 항상 동적으로 처리해 응답 바디를 그대로 흘려보낸다.
export const dynamic = "force-dynamic";

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8000";
const API_KEY = process.env.API_KEY ?? "";

/** 백엔드가 판단에 쓰지 않거나, 넘기면 오히려 깨지는 헤더는 뺀다. */
const DROPPED = new Set([
  "host",
  "connection",
  "content-length",
  "accept-encoding",
  "authorization", // 화면 접근용 계정이다. 백엔드는 이걸 모른다
]);

async function forward(request: NextRequest, path: string[]): Promise<NextResponse> {
  const target = `${BACKEND_ORIGIN}/api/v1/${path.join("/")}${request.nextUrl.search}`;

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!DROPPED.has(key.toLowerCase())) headers.set(key, value);
  });
  if (API_KEY) headers.set("X-Api-Key", API_KEY);

  const hasBody = request.method !== "GET" && request.method !== "HEAD";

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody ? await request.text() : undefined,
      cache: "no-store",
    });

    // 상태와 본문을 그대로 흘려보낸다. 02 §1-3 처럼 실패도 200 에 상태값으로 오는 계약이 있어
    // 여기서 해석하면 화면의 분기가 어긋난다.
    return new NextResponse(response.body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch (error) {
    console.error("백엔드 호출 실패", target, error);
    return NextResponse.json(
      { code: "BACKEND_UNREACHABLE", message: "백엔드에 연결하지 못했습니다." },
      { status: 502 },
    );
  }
}

type Params = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, { params }: Params) {
  return forward(request, (await params).path);
}
export async function POST(request: NextRequest, { params }: Params) {
  return forward(request, (await params).path);
}
export async function PUT(request: NextRequest, { params }: Params) {
  return forward(request, (await params).path);
}
export async function PATCH(request: NextRequest, { params }: Params) {
  return forward(request, (await params).path);
}
export async function DELETE(request: NextRequest, { params }: Params) {
  return forward(request, (await params).path);
}
