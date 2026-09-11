"use client";

import { useState } from "react";
import { Btn, Field, Panel, w98 } from "./win98-ui";

/**
 * 작업자 코드 입력 — 흐름의 첫 칸(브리프 §3 "작업자 코드 입력(localStorage) → OPEN 배치
 * 목록"). 인증이 아니라 문자열 하나다(정본 §7.1) — 형식 검사는 빈 값만 막는다.
 */
export function WorkerGatePanel({
  onSubmit,
  className = "",
}: {
  onSubmit: (code: string) => void;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const trimmed = value.trim();

  return (
    <Panel title="작업자 확인" className={className} bodyClassName="gap-3">
      <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>
        피킹을 시작하려면 작업자 코드를 입력하세요. 다음에 열 때도 이 단말에 기억됩니다.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmed.length === 0) return;
          onSubmit(trimmed);
        }}
        className="flex flex-col gap-2"
      >
        <Field
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="예: W-01"
          mono
          autoFocus
          className="h-9 px-2 text-[16px]"
        />
        <Btn
          type="submit"
          disabled={trimmed.length === 0}
          className="h-9 text-[15px] font-bold"
        >
          확인
        </Btn>
      </form>
    </Panel>
  );
}
