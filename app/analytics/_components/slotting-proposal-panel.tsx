"use client";

/**
 * 슬로팅 탭 하단 — 재배치 제안 목록(정본 §15.9). 제안 생성 → 표(체크) → 선택 적용 →
 * 자동 처리(OPEN 항목을 작업자 시뮬레이터로) → 재평가. 뮤테이션 훅은 이 패널이 아니라
 * `use-slotting-mutations.ts` 에 있고, "자동 처리" 대화 상자 자신의 시뮬레이터 훅만
 * 그 Dialog `DialogContent` 안에 둔다(코딩 규칙).
 */

import { useMemo, useState } from "react";
import { useProposalDetail } from "../_data/use-slotting";
import { useApplyProposal, useCompareProposal, useCreateProposal } from "../_data/use-slotting-mutations";
import { SlottingRelocationDialog } from "./slotting-relocation-dialog";
import { Btn, Checkbox, Sunken, w98 } from "./win98-ui";
import type { RelocationItemKind, RelocationItemReason, RelocationItemStatus } from "@/lib/types";

const KIND_LABEL: Record<RelocationItemKind, string> = { MOVE_IN: "들이기", EVICT: "내보내기" };
const REASON_LABEL: Record<RelocationItemReason, string> = {
  A_OUTSIDE_GOLDEN: "A상품이 골든존 밖",
  EVICT_C: "골든존 C상품 비움",
  HARD_ALLOCATED: "할당 중이라 제외",
  NO_GOLDEN_BIN: "옮길 골든존 칸 없음",
};
const STATUS_LABEL: Record<RelocationItemStatus, string> = {
  PROPOSED: "제안됨",
  OPEN: "적용됨(대기)",
  DONE: "완료",
  SKIPPED: "건너뜀",
};

export function SlottingProposalPanel({
  center,
  activeProposalId,
  onProposalChange,
}: {
  center: string;
  activeProposalId: number | null;
  onProposalChange: (id: number) => void;
}) {
  const proposal = useProposalDetail(activeProposalId);
  const createProposal = useCreateProposal(center);
  const applyProposal = useApplyProposal(activeProposalId ?? -1);
  const compareProposal = useCompareProposal(activeProposalId ?? -1);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [simulateOpen, setSimulateOpen] = useState(false);

  const items = useMemo(() => proposal?.items ?? [], [proposal]);
  const openItems = useMemo(() => items.filter((i) => i.status === "OPEN"), [items]);

  const toggle = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleCreate = () => {
    createProposal.mutate(
      { center },
      {
        onSuccess: (data) => {
          onProposalChange(data.proposalId);
          setChecked(new Set(data.items.filter((i) => i.status === "PROPOSED").map((i) => i.itemId)));
        },
      },
    );
  };

  const handleApply = () => {
    if (activeProposalId === null || checked.size === 0) return;
    applyProposal.mutate({ itemIds: Array.from(checked) }, { onSuccess: () => setChecked(new Set()) });
  };

  /* `waveIds` 를 비우면 서버가 최근 웨이브 20개를 고정으로 쓴다(백엔드 노트 §1.14) */
  const handleReevaluate = () => {
    if (activeProposalId === null) return;
    compareProposal.mutate({ waveIds: [] });
  };

  if (proposal === null) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <p className={`${w98.small} text-[color:var(--muted-foreground)]`}>
          아직 생성된 제안이 없습니다. A등급 상품을 골든존으로 옮기는 목록을 만듭니다.
        </p>
        <Btn disabled={createProposal.isPending} onClick={handleCreate} className="h-8 px-4 font-bold">
          {createProposal.isPending ? "생성 중…" : "제안 생성"}
        </Btn>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center gap-2">
        <span className={`${w98.small}`}>
          제안 #{proposal.proposalId} · {proposal.status} · 항목 {items.length}건
        </span>
        <div className="flex-1" />
        <Btn
          disabled={checked.size === 0 || applyProposal.isPending}
          onClick={handleApply}
          className="h-7 px-3 text-[12px]"
        >
          {applyProposal.isPending ? "적용 중…" : `선택 적용 (${checked.size})`}
        </Btn>
        <Btn disabled={openItems.length === 0} onClick={() => setSimulateOpen(true)} className="h-7 px-3 text-[12px]">
          자동 처리 ({openItems.length})
        </Btn>
        <Btn disabled={compareProposal.isPending} onClick={handleReevaluate} className="h-7 px-3 text-[12px]">
          {compareProposal.isPending ? "재평가 중…" : "재평가"}
        </Btn>
      </div>

      {/* ⚠️ `border-collapse` 는 쓰지 않는다. sticky thead 와 같이 쓰면 tbody 첫 행이 collapse
       * 된 경계선 자리에서 헤더 배경 위로 비쳐 보인다(스크롤해 보면 헤더 위로 잘린 행 하나가
       * 겹쳐 보이는 결함, 2026-09-14 화면 체크 s11b-3d 캡처에서 발견). `border-separate` +
       * `border-spacing-0` 로 바꾸고, 배경은 `<thead>` 뿐 아니라 각 `<Th>` 에도 칠해 win98
       * 표면 톤으로 완전히 덮는다. */}
      <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
        <table className="w-full border-separate border-spacing-0 text-left text-[12px]">
          <thead className="sticky top-0 z-10 bg-[color:var(--surface)]">
            <tr>
              <Th></Th>
              <Th>상품</Th>
              <Th>등급</Th>
              <Th>라인</Th>
              <Th>from → to</Th>
              <Th>종류</Th>
              <Th>이유</Th>
              <Th>상태</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.itemId}>
                <td className="border-t border-[color:var(--border)] p-1.5">
                  {item.status === "PROPOSED" ? (
                    <Checkbox label="" checked={checked.has(item.itemId)} onToggle={() => toggle(item.itemId)} />
                  ) : null}
                </td>
                <td className={`${w98.mono} border-t border-[color:var(--border)] p-1.5`}>{item.productName}</td>
                <td className="border-t border-[color:var(--border)] p-1.5">{item.grade}</td>
                <td className={`${w98.mono} border-t border-[color:var(--border)] p-1.5`}>{item.lines}</td>
                <td className={`${w98.mono} border-t border-[color:var(--border)] p-1.5 text-[11px]`}>
                  {item.fromLocationCode ?? "—"} → {item.toLocationCode ?? "—"}
                </td>
                <td className="border-t border-[color:var(--border)] p-1.5">{KIND_LABEL[item.kind]}</td>
                <td
                  className={`${w98.small} border-t border-[color:var(--border)] p-1.5 text-[color:var(--muted-foreground)]`}
                >
                  {REASON_LABEL[item.reason]}
                </td>
                <td className="border-t border-[color:var(--border)] p-1.5 font-bold">{STATUS_LABEL[item.status]}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={8} className="border-t border-[color:var(--border)] p-3 text-center text-[color:var(--muted-foreground)]">
                  항목 없음
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Sunken>

      <SlottingRelocationDialog
        open={simulateOpen}
        onOpenChange={setSimulateOpen}
        proposalId={activeProposalId}
        items={openItems}
      />
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="border-b-2 border-[color:var(--border)] bg-[color:var(--surface)] p-1.5 font-bold">
      {children}
    </th>
  );
}
