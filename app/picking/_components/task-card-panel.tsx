"use client";

import { useState } from "react";
import type { PickTask } from "@/lib/types";
import { Btn, Field, Panel, Sunken, w98 } from "./win98-ui";

/**
 * 태스크 카드 한 장 — 브리프 §3 "태스크 카드(순서 n/N, 칸 코드 크게, 존·랙·단·열, 상품명·
 * GTIN, 로트·유통기한, 지시 수량, 수량 입력 기본=지시) → 확정". PDA 폭(480px) 가정이라
 * 칸 코드를 화면에서 가장 큰 글자로 둔다 — 작업자가 실제로 눈으로 맞추는 값이다.
 *
 * 수량 입력이 지시 수량보다 작으면 그대로 `onConfirm` 에 넘긴다 — 확인 대화(부족 처리)는
 * 부모(`page.tsx`)가 지시 수량과 비교해 연다. 이 카드는 입력 범위(0~지시 수량)만 막는다.
 */
export function TaskCardPanel({
  task,
  seqPosition,
  totalTasks,
  onConfirm,
  isConfirming,
  className = "",
}: {
  task: PickTask;
  /** 이 태스크가 현재 배치에서 몇 번째로 "다음 집을 것"인지 — 반드시 `task.seqNo` 와 같지
   * 않다(재할당 태스크가 끼어들면 seqNo 는 그대로 두고 화면 표시만 순서를 센다) */
  seqPosition: number;
  totalTasks: number;
  onConfirm: (qty: number) => void;
  isConfirming: boolean;
  className?: string;
}) {
  const [qtyText, setQtyText] = useState(String(task.qty));

  /** 태스크가 바뀌면(다음 칸으로 넘어가면) 입력을 다시 지시 수량으로 되돌린다.
   *
   * 렌더 중에 상태를 조정한다(useEffect 를 안 쓴다) — `order-import-panel.tsx` 와 같은
   * 이유다. effect 로 하면 커밋 뒤 한 프레임 늦게 리셋돼 이전 태스크의 수량이 잠깐
   * 보인다. React 공식 권장 패턴("Adjusting state when a prop changes")대로 이전
   * `pickTaskId` 를 기억해 두고 렌더 중 비교한다. */
  const [prevTaskId, setPrevTaskId] = useState(task.pickTaskId);
  if (task.pickTaskId !== prevTaskId) {
    setPrevTaskId(task.pickTaskId);
    setQtyText(String(task.qty));
  }

  const parsedQty = Number(qtyText);
  const isValidQty = Number.isInteger(parsedQty) && parsedQty >= 0 && parsedQty <= task.qty;

  return (
    <Panel
      title={`피킹 ${seqPosition}/${totalTasks}`}
      right={
        <span className={`${w98.small} shrink-0 text-[color:var(--muted-foreground)]`}>
          {task.sellerCode}
        </span>
      }
      className={className}
      bodyClassName="gap-3"
    >
      {/* 칸 코드 — 이 화면에서 가장 큰 글자 */}
      <Sunken className="flex flex-col items-center gap-1 px-2 py-4">
        <span className={`${w98.mono} text-[48px] leading-none font-bold tracking-wider`}>
          {task.locationCode}
        </span>
        <span className={`${w98.small} ${w98.mono} text-[color:var(--muted-foreground)]`}>
          존 {task.zoneCode ?? "—"} · 랙 {task.rackNo ?? "—"} · 단 {task.levelNo ?? "—"} · 열{" "}
          {task.colNo ?? "—"}
        </span>
      </Sunken>

      {/* 상품 */}
      <div className="flex flex-col gap-0.5">
        <span className="text-[17px] font-bold">{task.productName}</span>
        <span className={`${w98.small} ${w98.mono} text-[color:var(--muted-foreground)]`}>
          {task.gtin}
        </span>
      </div>

      {/* 로트·유통기한 — FEFO 확인 자리(정본 §6.8) */}
      <div className={`${w98.small} grid grid-cols-2 gap-x-3`}>
        <span>
          로트 <b className={`${w98.mono} text-[color:var(--primary)]`}>{task.lotNo}</b>
        </span>
        <span>
          유통기한{" "}
          <b className={`${w98.mono} text-[color:var(--primary)]`}>{task.expiresOn ?? "—"}</b>
        </span>
      </div>

      {/* 수량 */}
      <div className="flex items-end justify-between gap-3">
        <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>
          지시 수량
          <span className={`${w98.mono} ml-1.5 block text-[26px] font-bold text-[color:var(--foreground)]`}>
            {task.qty}
          </span>
        </span>
        <label className="flex flex-col items-end gap-1">
          <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>담은 수량</span>
          <Field
            type="number"
            inputMode="numeric"
            min={0}
            max={task.qty}
            value={qtyText}
            onChange={(event) => setQtyText(event.target.value)}
            mono
            className="h-11 w-24 text-right text-[22px] font-bold"
          />
        </label>
      </div>
      {!isValidQty ? (
        <p className={`${w98.small} font-bold text-[color:var(--status-error)]`}>
          0 이상 지시 수량({task.qty}) 이하로 입력하세요.
        </p>
      ) : null}

      <Btn
        onClick={() => onConfirm(parsedQty)}
        disabled={!isValidQty || isConfirming}
        className="h-12 text-[18px] font-bold"
      >
        {isConfirming ? "확정하는 중…" : "확정"}
      </Btn>
    </Panel>
  );
}
