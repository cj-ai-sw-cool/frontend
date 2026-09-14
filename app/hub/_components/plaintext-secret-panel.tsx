"use client";

/**
 * 평문 1회 표시 패널 — 키 발급·비밀 재발급 공용(정본 §14.2·§14.5 "생성·재발급 응답에만
 * 평문 1회"). 대화 상자를 직접 열지 않는다 — 호출부의 `DialogContent` 안에 넣고, "닫기
 * 확인 없이 닫히면 안 된다"(브리프 §2)는 가드는 호출부가 `onCopiedChange`로 받은 값을
 * 자신의 `onOpenChange`에서 확인한다(복사 버튼 또는 "복사했습니다" 체크가 필요).
 */

import { useEffect, useState } from "react";
import { Btn, Checkbox, Sunken, w98 } from "./win98-ui";

export function PlaintextSecretPanel({
  description,
  value,
  onCopiedChange,
  onClose,
}: {
  /** 값 위에 놓을 한 줄 설명(예: "발급된 API 키") */
  description: string;
  value: string;
  onCopiedChange: (copied: boolean) => void;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    onCopiedChange(copied);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [copied]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // 클립보드 권한이 없어도 "복사했습니다" 체크만으로 닫을 수 있게 한다
    }
    setCopied(true);
  };

  return (
    <>
      <div className="flex flex-col gap-2 p-3">
        <span className={`${w98.small} font-bold text-[color:var(--status-error)]`}>
          {description} — 이 창을 닫으면 다시 볼 수 없습니다.
        </span>
        <Sunken className={`${w98.mono} p-2 text-[13px] break-all`}>{value}</Sunken>
        <Btn onClick={handleCopy} className="h-7 font-bold">
          {copied ? "복사됨 ✓" : "복사"}
        </Btn>
        <Checkbox label="복사했습니다" checked={copied} onToggle={() => setCopied((c) => !c)} />
      </div>
      <div className="flex justify-end gap-2 border-t-2 border-[color:var(--surface-dim)] p-2">
        <Btn disabled={!copied} onClick={onClose} className="h-7 w-24 font-bold">
          닫기
        </Btn>
      </div>
    </>
  );
}
