/**
 * fetch 래퍼 — 시연용 규모에 axios 불필요 (D-08).
 * docs/02-api-spec.md §0 의 공통 에러 포맷을 여기서 한 번만 처리한다.
 */
import type { ApiErrorBody, ApiErrorCode } from "./types";

export const API_BASE = "/api/v1";

/**
 * 브라우저에서는 상대경로 → next.config.ts 의 rewrites 가 백엔드로 프록시한다.
 * 서버 컴포넌트/라우트 핸들러에는 rewrites 가 적용되지 않으므로 절대주소가 필요하다.
 */
function resolveUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  if (typeof window !== "undefined") return `${API_BASE}${suffix}`;
  const origin = process.env.BACKEND_ORIGIN ?? "http://127.0.0.1:8000";
  return `${origin}${API_BASE}${suffix}`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | string;
  readonly detail?: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.detail = body.detail;
  }

  is(code: ApiErrorCode): boolean {
    return this.code === code;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(resolveUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!res.ok) {
    // 에러 바디가 계약대로 오지 않는 경우(프록시 5xx, HTML 에러페이지)도 방어한다
    let body: ApiErrorBody;
    try {
      body = (await res.json()) as ApiErrorBody;
    } catch {
      body = { code: "UNKNOWN", message: `${res.status} ${res.statusText}` };
    }
    throw new ApiError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, init?: RequestInit) =>
    request<T>(path, { ...init, method: "GET" }),

  post: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),

  /**
   * 본문이 없을 수도 있는 POST. 서버가 204 를 주면 `null` 이다.
   * "더 줄 게 없다"를 에러가 아니라 값으로 받는 자리에 쓴다.
   */
  postOrNull: async <T>(path: string, body?: unknown, init?: RequestInit) =>
    (await request<T | undefined>(path, {
      ...init,
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    })) ?? null,

  put: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),

  /** 부분 갱신 — Stage 5 `PATCH /sellers/{code}` 가 처음 쓴다 */
  patch: <T>(path: string, body?: unknown, init?: RequestInit) =>
    request<T>(path, {
      ...init,
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
};
