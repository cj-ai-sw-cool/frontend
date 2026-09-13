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
import { parsePutawayLocationCode } from "./putaway-tier";
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

  /** `stockId`+`qty` 를 같이 보낸다 — 백엔드가 `acceptable`/`rejectReason`/`maxQty` 를 그
   * 조합으로 계산해 준다(2026-09-11 라이브 보고). 혼적·온도·규격 규칙을 화면이 다시 베끼지
   * 않는다(정본 §4.1 "규칙 검증은 확정 시점에 잠금 아래 다시 한다" 의 정신과도 맞다 —
   * 여기 표시도 서버 판정을 그대로 보여줄 뿐, 화면이 판정하지 않는다). */
  const handleCheckOther = useCallback(() => {
    if (otherCode.trim() === "" || selectedItem === null || qty <= 0) return;
    capacityCheck.mutate({ locationCode: otherCode, stockId: selectedItem.stockId, qty });
  }, [otherCode, selectedItem, qty, capacityCheck]);

  /** "이 칸으로 교체" — 추천 목록을 이 칸 하나로 바꾼다. `acceptable=false` 면 버튼 자체가
   * 안 뜬다(recommend-panel.tsx). tier 는 서버가 안 줘서(추천이 아니라 사용자가 직접 고른
   * 칸) 지금 그 칸에 든 재고로 로컬 판정한다 — 화면 표기용일 뿐 확정 요청에는 안 실린다.
   * `maxQty` 가 요청 수량보다 작으면 그만큼만 옮긴다(나머지는 대기 목록에 남는다). */
  const handleReplaceWithOther = useCallback(() => {
    const capacity = capacityCheck.data;
    if (capacity === undefined || capacity.acceptable !== true || selectedItem === null || qty <= 0) return;

    const placeQty = capacity.maxQty !== null ? Math.min(qty, capacity.maxQty) : qty;
    const hasSameLot = capacity.items.some(
      (row) => row.product.gtin === selectedItem.product.gtin && row.lot.lotNo === selectedItem.lot.lotNo,
    );
    const tier: PutawayTier = capacity.items.length === 0 ? "EMPTY" : hasSameLot ? "SAME_LOT" : "SAME_SELLER";
    const address = parsePutawayLocationCode(capacity.locationCode);

    setMoves([
      {
        locationCode: capacity.locationCode,
        zoneCode: address?.zoneCode ?? capacity.zoneCode ?? "",
        aisleNo: address?.aisleNo ?? 0,
        bayNo: address?.bayNo ?? 0,
        levelNo: address?.levelNo ?? 0,
        positionNo: address?.positionNo ?? 0,
        qty: placeQty,
        tier,
        loadLevelAfterPct: capacity.loadLevelPct,
      },
    ]);
    setUnplacedQty(Math.max(0, qty - placeQty));
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
