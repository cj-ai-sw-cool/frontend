"use client";

/**
 * 작업자 코드 로컬 저장 — 정본 §7.1 "작업자 식별은 화면에서 입력한 작업자 코드(문자열).
 * 인증·작업자 마스터는 Stage 11A", 브리프 §3 "작업자 코드 입력(localStorage, try/catch)".
 *
 * 인증이 없어서 코드는 그냥 문자열이고, 이 저장소는 "다음에 열 때 다시 안 치게" 하는
 * 편의일 뿐이다 — 시크릿 모드·저장소 차단 환경에서 던지면 화면 전체가 죽으므로 항상
 * try/catch 로 감싼다(실패하면 매번 다시 입력하는 것으로 충분하다).
 */
const STORAGE_KEY = "picking.workerCode";

export function loadWorkerCode(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveWorkerCode(code: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // 저장 실패해도 화면은 그대로 진행한다 — 다음 방문에 다시 입력하면 된다
  }
}

export function clearWorkerCode(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}
