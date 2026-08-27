/**
 * 시연 초기화 — 비밀번호를 받고 서버에서 확인한 뒤에만 백엔드로 넘긴다.
 *
 * 초기화는 주문·측정 세션·재고 원장을 통째로 비운다. 태스크바 `Start` 는 누르기 쉬운 자리라
 * 시연 중 실수로 닿으면 진행 중이던 작업이 사라진다. 그래서 화면에 들어올 때 쓰는 것과
 * 같은 비밀번호를 한 번 더 받는다.
 *
 * 확인을 서버에서 하는 이유는 하나다 — 비밀번호를 브라우저로 내려보내면 확인하는 의미가 없다.
 * 화면은 입력값만 보내고, 맞는지는 여기서만 안다.
 */
import { type NextRequest, NextResponse } from "next/server";

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8000";
const API_KEY = process.env.DEMO_API_KEY ?? "";

/** 길이가 달라도 같은 시간이 걸리게 비교한다 — 응답 시간으로 비밀번호를 좁혀 나가지 못하게. */
function matches(input: string, expected: string): boolean {
  const a = new TextEncoder().encode(input);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const expected = process.env.DEMO_PASSWORD ?? "";

  // 비밀번호를 걸지 않은 환경(로컬 개발)에서는 확인 없이 지나간다 — 화면 접근도 열려 있다.
  if (expected) {
    let supplied = "";
    try {
      supplied = ((await request.json()) as { password?: string }).password ?? "";
    } catch {
      supplied = "";
    }
    if (!matches(supplied, expected)) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "비밀번호가 맞지 않습니다." },
        { status: 401 },
      );
    }
  }

  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (API_KEY) headers["X-Demo-Key"] = API_KEY;

  try {
    const response = await fetch(`${BACKEND_ORIGIN}/api/v1/admin/demo/reset`, {
      method: "POST",
      headers,
      cache: "no-store",
    });
    return new NextResponse(response.body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch (error) {
    console.error("시연 초기화 실패", error);
    return NextResponse.json(
      { code: "BACKEND_UNREACHABLE", message: "백엔드에 연결하지 못했습니다." },
      { status: 502 },
    );
  }
}
