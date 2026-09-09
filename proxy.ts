/**
 * 시연 접근 통제 — 팀원만 화면을 볼 수 있게 한다.
 *
 * 시연 서버는 공개 IP 에 떠 있고 팀원은 각자 다른 망(사무실·재택·모바일)에서 들어온다.
 * IP 로는 걸러낼 수 없으므로 화면 전체를 비밀번호로 막는다. 브라우저가 기본으로 지원하는
 * Basic 인증을 쓰면 로그인 화면을 따로 만들지 않아도 되고, 한 번 입력하면 창을 닫을 때까지
 * 유지된다.
 *
 * `APP_PASSWORD` 가 비어 있으면 아무것도 막지 않는다 — 로컬 개발이 지금처럼 그대로 돌아간다.
 * 아이디는 `APP_USER` 로 정하며, 비워 두면 아이디는 검사하지 않고 비밀번호만 본다.
 *
 * ⚠️ Basic 인증은 자격증명을 요청마다 보낸다. 지금 시연 서버는 HTTPS 가 아니라 같은 망을
 * 엿볼 수 있는 사람에게는 비밀번호가 노출된다. 시연 전용 비밀번호를 쓰고 끝나면 버린다.
 * (Next.js 16 부터 middleware.ts 가 proxy.ts 로 바뀌었다.)
 */
import { NextResponse, type NextRequest } from "next/server";

const REALM = "cj-ai demo";

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

function unauthorized(): NextResponse {
  return new NextResponse("인증이 필요합니다.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
      "Cache-Control": "no-store",
    },
  });
}

export function proxy(request: NextRequest): NextResponse {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return unauthorized();

  let decoded: string;
  try {
    decoded = atob(header.slice("Basic ".length));
  } catch {
    return unauthorized();
  }

  // 아이디에 콜론이 들어갈 수 없으므로 첫 콜론에서 자른다. 비밀번호에는 콜론이 있어도 된다.
  const separator = decoded.indexOf(":");
  const suppliedUser = separator === -1 ? decoded : decoded.slice(0, separator);
  const suppliedPassword = separator === -1 ? "" : decoded.slice(separator + 1);

  const expectedUser = process.env.APP_USER;
  // 아이디가 틀려도 비밀번호 비교를 건너뛰지 않는다 — 어느 쪽이 틀렸는지 응답 시간으로
  // 알아내지 못하게 한다.
  const userOk = !expectedUser || matches(suppliedUser, expectedUser);
  const passwordOk = matches(suppliedPassword, password);
  return userOk && passwordOk ? NextResponse.next() : unauthorized();
}

export const config = {
  /**
   * 정적 자산과 파비콘만 빼고 전부 막는다. `/api/v1/*` 도 여기 걸리므로 화면을 거치지 않고
   * API 만 직접 부르는 것도 함께 막힌다.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
