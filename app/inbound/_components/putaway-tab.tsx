"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import type { PutawayMove, PutawayPendingItem, PutawayRejectedDetail, PutawayTier } from "@/lib/types";
import { useSellers } from "../_data/use-inbound";
import {
  useLocationCapacityCheck,
  usePutawayConfirm,
  usePutawayPending,
  usePutawayRecommend,
} from "../_data/use-putaway";
import { PutawayLocationPanel } from "./putaway-location-panel";
import { PutawayPendingPanel } from "./putaway-pending-panel";
import { PutawayRecommendPanel } from "./putaway-recommend-panel";
import { w98Toast } from "./win98-ui";

/**
 * 진열(directed putaway) 탭 — 정본 §4.6, 브리프 §3 S4.3.
 *
 * 검수 탭(`page.tsx`)과 별도 탭이라 이 컴포넌트가 자기 상태·데이터 훅을 전부 들고 있다 —
 * `page.tsx` 는 탭 전환 상태만 갖고 이 컴포넌트를 그 자리에 꽂는다(아래 `page.tsx` 참고).
 * 3열 레이아웃은 검수 탭과 같은 폭 예산(좌 300 · 우 380)을 그대로 쓴다.
 *
 * 흐름: 대기 목록에서 품목 선택 → 수량 확인 → 추천 → 이동 목록 확인(필요하면 "다른 칸"으로
 * 교체) → 확정. 확정 성공 시 대기 목록·재고 전체(재고 창 + 3D·2D 점유)를 무효화한다
 * (`_data/use-putaway.ts` 의 `usePutawayConfirm`).
 */
export function PutawayTab() {
  const router = useRouter();

  const [sellerFilter, setSellerFilter] = useState("");
  const [selectedItem, setSelectedItem] = useState<PutawayPendingItem | null>(null);
  const [qty, setQty] = useState(0);
  const [moves, setMoves] = useState<PutawayMove[]>([]);
  const [unplacedQty, setUnplacedQty] = useState(0);
  const [otherCode, setOtherCode] = useState("");
  const [rejectedDetail, setRejectedDetail] = useState<PutawayRejectedDetail | null>(null);

  const sellersQuery = useSellers();
  const pendingQuery = usePutawayPending(sellerFilter === "" ? undefined : { seller: sellerFilter });
  const recommend = usePutawayRecommend();
  const confirm = usePutawayConfirm();
  const capacityCheck = useLocationCapacityCheck();

  const pendingItems = pendingQuery.data?.content ?? [];

  const resetRecommendation = useCallback(() => {
    setMoves([]);
    setUnplacedQty(0);
    setOtherCode("");
    setRejectedDetail(null);
    capacityCheck.reset();
  }, [capacityCheck]);

  /** 목록에서 품목 선택 — 이전 추천 결과·다른 칸 입력은 그 품목에만 유효하므로 비운다 */
  const handleSelect = useCallback(
    (item: PutawayPendingItem) => {
      setSelectedItem(item);
      setQty(item.qty);
      resetRecommendation();
    },
    [resetRecommendation],
  );

  const handleRecommend = useCallback(() => {
    if (selectedItem === null || qty <= 0) return;
    setRejectedDetail(null);
    setOtherCode("");
    capacityCheck.reset();
    recommend.mutate(
      { stockId: selectedItem.stockId, qty },
      {
        onSuccess: (data) => {
          setMoves(data.moves);
          setUnplacedQty(data.unplacedQty);
        },
        onError: (error) => {
          toast.error("추천에 실패했습니다", { ...w98Toast.notice, description: error.message });
        },
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- capacityCheck 는 reset 만 쓴다
  }, [selectedItem, qty, recommend]);

  const handleCheckOther = useCallback(() => {
    if (otherCode.trim() === "") return;
    capacityCheck.mutate(otherCode);
  }, [otherCode, capacityCheck]);

  /** "이 칸으로 교체" — 추천 목록을 이 칸 하나로 바꾼다. tier 는 지금 그 칸에 든 재고로
   * 로컬 판정한다(서버 추천이 아니라 사용자가 직접 고른 칸이라 서버가 tier 를 안 준다) */
  const handleReplaceWithOther = useCallback(() => {
    const capacity = capacityCheck.data;
    if (capacity === undefined || selectedItem === null || qty <= 0) return;

    const hasSameLot = capacity.items.some(
      (row) => row.product.gtin === selectedItem.product.gtin && row.lot.lotNo === selectedItem.lot.lotNo,
    );
    const tier: PutawayTier = capacity.items.length === 0 ? "EMPTY" : hasSameLot ? "SAME_LOT" : "SAME_SELLER";

    setMoves([
      { locationCode: capacity.locationCode, qty, tier, loadLevelAfterPct: capacity.loadLevelPct },
    ]);
    setUnplacedQty(0);
    setRejectedDetail(null);
  }, [capacityCheck.data, selectedItem, qty]);

  const handleConfirm = useCallback(() => {
    if (selectedItem === null || moves.length === 0) return;
    setRejectedDetail(null);
    confirm.mutate(
      {
        stockId: selectedItem.stockId,
        moves: moves.map((move) => ({ locationCode: move.locationCode, qty: move.qty })),
      },
      {
        onSuccess: () => {
          toast.success("진열 확정 완료", w98Toast.success);
          setSelectedItem(null);
          setQty(0);
          resetRecommendation();
        },
        onError: (error) => {
          if (error instanceof ApiError && error.is("PUTAWAY_REJECTED")) {
            const detail = error.detail as Partial<PutawayRejectedDetail> | undefined;
            if (detail?.locationCode !== undefined && detail.reason !== undefined) {
              setRejectedDetail({ locationCode: detail.locationCode, reason: detail.reason });
              return;
            }
          }
          toast.error("진열 확정에 실패했습니다", { ...w98Toast.notice, description: error.message });
        },
      },
    );
  }, [selectedItem, moves, confirm, resetRecommendation]);

  /** "3D에서 보기" — 분석 화면으로 넘어가 그 칸이 속한 존을 강조한다(정본 §4.6, 존 단위
   * 제약은 `app/analytics/page.tsx` 의 `HighlightFromQuery` 참고) */
  const handleGoTo3D = useCallback(
    (locationCode: string) => {
      router.push(`/analytics?highlight=${encodeURIComponent(locationCode)}`);
    },
    [router],
  );

  return (
    <div className="relative flex min-h-0 flex-1 gap-2">
      <div className="flex w-[300px] shrink-0 flex-col gap-2">
        <PutawayPendingPanel
          items={pendingItems}
          isLoading={pendingQuery.isLoading}
          errorMessage={pendingQuery.error?.message ?? null}
          sellers={sellersQuery.data}
          sellerFilter={sellerFilter}
          onSellerFilterChange={setSellerFilter}
          selectedStockId={selectedItem?.stockId ?? null}
          onSelect={handleSelect}
        />
      </div>

      <PutawayLocationPanel
        selectedItem={selectedItem}
        qty={qty}
        onQtyChange={setQty}
        onRecommend={handleRecommend}
        isRecommending={recommend.isPending}
        moves={moves}
        unplacedQty={unplacedQty}
        onGoTo3D={handleGoTo3D}
      />

      <PutawayRecommendPanel
        moves={moves}
        unplacedQty={unplacedQty}
        otherCode={otherCode}
        onOtherCodeChange={setOtherCode}
        onCheckOther={handleCheckOther}
        isCheckingOther={capacityCheck.isPending}
        otherCapacity={capacityCheck.data}
        otherCapacityError={capacityCheck.error?.message ?? null}
        selectedItem={selectedItem}
        onReplaceWithOther={handleReplaceWithOther}
        rejectedDetail={rejectedDetail}
        onRetryRecommend={handleRecommend}
        onConfirm={handleConfirm}
        isConfirming={confirm.isPending}
        canConfirm={selectedItem !== null && moves.length > 0}
      />
    </div>
  );
}
