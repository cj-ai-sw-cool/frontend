"use client";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { w98Toast } from "@/lib/win98-toast";
import type { BoxType, DamageReportResponse, ShipmentItem } from "@/lib/types";
import { Btn, Panel, w98 } from "./_components/win98-ui";
import { BoxRecommendationPanel, boxLabel } from "./_components/box-recommendation-panel";
import { Box3DViewer } from "./_components/box-3d-viewer";
import { DamageReportDialog, type DamageReportTarget } from "./_components/damage-report-dialog";
import { LineShipmentsPanel } from "./_components/line-shipments-panel";
import { PackActions } from "./_components/pack-actions";
import { OrdersTab } from "./_components/orders-tab";
import { ProductImagePanel } from "./_components/product-image-panel";
import { ShipmentItemsPanel } from "./_components/shipment-items-panel";
import { ToteScanPanel } from "./_components/tote-scan-panel";
import { WaveCreateDialog } from "./_components/wave-create-dialog";
import { WavesTab } from "./_components/waves-tab";
import { useLines } from "./_data/use-lines";
import { useLineShipments } from "./_data/use-line-shipments";
import {
  useBoxTypes,
  useCompletePacking,
  useNextTote,
  useOverrideBox,
  useProductImages,
  useRescan,
  useScanItem,
  useShipmentDetail,
  useToteScan,
} from "./_data/use-shipment-detail";
import { useCreateWave } from "./_data/use-waves";

/**
 * 출고 포장 화면 (win98 스킨) — P2 담당 화면의 디자인 작업본이다.
 *
 * ⚠️ **원본 `/packing` 은 건드리지 않았다.** 그쪽이 P2 담당이고 팀 다른 트랙이라, 여기는
 *    `/packing-v2` 로 나란히 둔다. 로직(`_data`/`_mock`)은 원본에서 복사해 왔고 계약 해석은
 *    그대로다 — 바뀐 것은 화면뿐이다.
 *
 * 셸(데스크톱·태스크바·창 크롬·좌측 네비)은 이 라우트 그룹의 layout.tsx 가 그린다.
 * 목업 HTML 에는 출고 화면이 없어서, **입고 화면의 표현 규칙을 그대로 적용**했다:
 *   패널 = 튀어나온 판 + 제목 + etched 구분선 / 값 표시 = 파인 상자 /
 *   사진 = 파인 상자 + 네이비 캡션 줄 + 검정 화면 / 강조 = 색이 아니라 굵기·폭
 *
 * 호출 순서 (docs/02-api-spec.md §3)
 *   3-5 토트 스캔 → 3-2 상세 → [3-3 박스 오버라이드] → 3-8 포장 완료
 *   품목 사진은 1-6 을 그대로 쓴다(입고와 같은 API).
 *
 * ── 세로 예산 (검산) ─────────────────────────────────────────────────────
 *   화면 영역 = 1390 × 872 (layout.tsx 주석 참고)
 *   세로: 토트 바 ≈ 78 + gap 8 + 2단 flex-1 = 872
 *   가로: 좌 flex-1(802) + gap 8 + 우 580 = 1390
 *   우측 세로: 3D 상자 flex-1 + gap 8 + [제품 이미지 | 박스 추천] 230 + 액션(버튼 64)
 *             → 실패 배너가 뜨면 그만큼 3D 상자가 줄어든다. 합은 항상 고정이다.
 *   ⚠️ 이 화면은 스크롤이 없다 — 표와 박스 패널만 자기 안에서 스크롤한다.
 *
 * ── 탭 — 포장 / 주문 (Stage 5, 브리프 §3 S5.4) ────────────────────────────
 *   입고 화면의 검수/진열 탭(`app/inbound/page.tsx`)과 같은 방식: 탭 바 h-5(20px) +
 *   루트 gap 을 2(8px)→1(4px) 로 줄여 4px 를 되찾고, 나머지 20px 은 아래 872px 짜리
 *   포장 영역의 flex-1 칸(3D 상자·품목 표)이 그만큼 줄어들며 흡수한다 — 둘 다 flex-1 이라
 *   찌그러질 뿐 넘치지 않는다(브라우저로 두 탭 모두 overflow 0 재확인, 브리프 §5).
 *   "주문" 탭은 언마운트 없이 hidden 으로만 감춘다 — 포장 탭의 스캔 중간 상태(아래
 *   `barcode`/`shipmentId` 등)가 탭을 오가도 사라지지 않아야 한다(입고 화면 주석과 같은 이유).
 */
export default function PackingV2Page() {
  /** 포장 / 주문 / 웨이브 세 탭 (Stage 6, 정본 §6.7). "주문"·"웨이브" 탭은 각자 자기
   * 상태·데이터 훅을 통째로 들고 있다(`orders-tab.tsx`/`waves-tab.tsx` 머리말 참고) —
   * 여기서는 지금 켜진 탭만 기억한다. */
  const [activeTab, setActiveTab] = useState<"packing" | "orders" | "waves">("packing");
  /** "주문 투입" 대화 상자 — 탭과 무관하게 항상 누를 수 있어 탭 바 옆에 둔다(정본 §6.7,
   * 브리프 §3 S6.5 "포장 화면 '주문 투입' 버튼"). */
  const [isWaveDialogOpen, setIsWaveDialogOpen] = useState(false);
  const createWave = useCreateWave();
  /* ── 화면 상태 (서버 데이터가 아닌 것만) ────────────────── */
  const [barcode, setBarcode] = useState("");
  const [shipmentId, setShipmentId] = useState<number | null>(null);
  /** "다음 토트" 큐가 비었을 때만 채운다(Stage 8, 정본 §8.4) — 스캔 실패(`scan.error`)와
   * 자리를 나눠 쓰므로 `runScan`이 부르면(성공이든 실패든) 지운다. */
  const [nextToteMessage, setNextToteMessage] = useState<string | null>(null);
  /** "파손 신고" 대화 상자가 다룰 품목 — null 이면 닫힌 상태(정본 §9.4) */
  const [damageTarget, setDamageTarget] = useState<DamageReportTarget | null>(null);
  const [selectedBoxTypeId, setSelectedBoxTypeId] = useState<number | null>(
    null,
  );
  const [selectedProductId, setSelectedProductId] = useState<number | null>(
    null,
  );
  /**
   * 상자 뚜껑이 열려 있는가 — 박스 추천 패널의 3D 상자가 이 값을 따라 움직인다.
   * 토트를 스캔해 박스가 정해지면 열리고, 포장 완료를 누르면 닫힌다 (사용자 요청).
   * 상태를 하나 더 두는 대신 `shipment !== undefined` 로 대신할 수도 있지만, 그러면
   * 포장 완료 순간 배송단위가 사라지면서 **닫히는 동작을 볼 새가 없다**.
   */
  const [isLidOpen, setIsLidOpen] = useState(false);
  /**
   * 어느 3D 모델을 띄울 것인가 — 둘을 눈으로 비교하려고 둔 전환이다 (사용자 요청).
   * ⚠️ 화면 상태일 뿐 계약과 무관하다. 어느 쪽을 쓸지 정해지면 이 상태와 헤더 버튼을 지우고
   *    BOX_MODELS 에서 하나만 남기면 된다.
   */
  /* ★ 기본을 실사2(carton-v3) 에서 **실사(meshy)** 로 바꿨다 (사용자 요청).
     화면을 열자마자 보이는 상자라, 어느 것이 기본인지가 곧 "우리 상자"가 된다. */
  const [modelKey, setModelKey] = useState<BoxModelKey>("meshy");
  /**
   * "라인별 배송 내역" 패널의 LINE 탭이 지금 보고 있는 라인. 토트 스캔(3-5)과는 별개다 —
   * 이 값은 그 패널만 바꾸고, 스캔된 배송단위가 실제로 어느 라인 소속인지와는 무관하다.
   */
  const [selectedLineId, setSelectedLineId] = useState<number | null>(null);
  /* ── 데이터 ────────────────────────────────────────────── */
  const scan = useToteScan(); // 3-5
  const shipmentQuery = useShipmentDetail(shipmentId); // 3-2
  const boxTypesQuery = useBoxTypes(); // 3-4 — 박스 변경 드롭다운의 선택지
  const productImagesQuery = useProductImages(selectedProductId); // 1-6
  const overrideBox = useOverrideBox(); // 3-3
  const completePacking = useCompletePacking(); // 3-8
  const linesQuery = useLines(); // 라인 목록 — LINE 탭
  const nextTote = useNextTote(); // Stage 8 — "다음 토트" 버튼
  const scanItem = useScanItem(); // Stage 9 — 품목 낱개 스캔
  const rescan = useRescan(); // Stage 9 — "재스캔" 버튼

  const shipment = shipmentQuery.data;
  const boxes = useMemo<BoxType[]>(
    () => boxTypesQuery.data ?? [],
    [boxTypesQuery.data],
  );
  const lines = useMemo(() => linesQuery.data?.lines ?? [], [linesQuery.data]);

  /**
   * 탭에서 아직 아무것도 안 골랐으면 첫 번째 활성 라인을 기본값으로 쓴다.
   * 렌더에서 파생시킨다(effect 로 setState 하지 않는다) — 라인 목록이 아직 없거나
   * 활성 라인이 하나도 없으면 계속 null 이고, 그 동안 3-1 조회는 나가지 않는다.
   */
  const effectiveLineId =
    selectedLineId ?? lines.find((line) => line.status === "ACTIVE")?.lineId ?? null;
  const lineShipmentsQuery = useLineShipments(effectiveLineId); // 3-1

  /** 지금 화면이 말하는 박스 — 방금 고른 것 > 서버가 준 finalBox 순이다 */
  const finalBox = useMemo<BoxType | null>(() => {
    if (selectedBoxTypeId !== null) {
      const picked = boxes.find((box) => box.boxTypeId === selectedBoxTypeId);
      if (picked !== undefined) return picked;
    }
    return shipment?.finalBox ?? null;
  }, [selectedBoxTypeId, boxes, shipment]);

  /** 3D 상자와 아래 정보 패널이 **같은 박스**를 봐야 해서 여기서 한 번만 정한다 */
  const effectiveBox = finalBox ?? shipment?.recommendedBox ?? null;
  const activeModel =
    SHOWN_MODELS.find((model) => model.key === modelKey) ?? SHOWN_MODELS[0];

  const selectedItem = useMemo(
    () =>
      shipment?.items.find((item) => item.productId === selectedProductId) ??
      null,
    [shipment, selectedProductId],
  );

  /* ── 이벤트 ────────────────────────────────────────────── */

  /**
   * 3-5. 재스캔은 멱등이다 (D-14) — 새 토트를 잡으면 이전 화면 상태를 전부 버린다.
   *
   * ⚠️ **값을 인자로 받는다.** `barcode` 상태를 직접 읽으면 다음 토트 버튼처럼 "값을 받아
   *    곧바로 조회"하는 경로에서 한 박자 늦은 값이 나간다(setState 는 즉시 반영되지 않는다).
   */
  const runScan = useCallback(
    (value: string) => {
      setBarcode(value);
      setNextToteMessage(null);
      scan.mutate(value, {
        onSuccess: (detail) => {
          setShipmentId(detail.shipmentId);
          setSelectedBoxTypeId(null);
          // 사진은 맨 위 품목이 먼저 뜬다 — 품목이 없는 배송단위는 비운 채로 둔다
          setSelectedProductId(detail.items[0]?.productId ?? null);
          overrideBox.reset();
          completePacking.reset();
          // 새 배송단위라 이전 것의 품목 스캔·파손 신고 상태를 들고 있으면 안 된다
          scanItem.reset();
          rescan.reset();
          setDamageTarget(null);
          setBarcode("");
          // 박스가 정해졌다 = 이제 여기 담는다. 상자가 천천히 한 번 열린다
          setIsLidOpen(true);
        },
      });
    },
    [scan, overrideBox, completePacking, scanItem, rescan],
  );

  /** 입력창에서 Enter · Scan 버튼 — 토트 모드면 토트 스캔(3-5), 품목 모드면 낱개 스캔
   * (Stage 9, 정본 §9.3)을 부른다. 같은 입력란·버튼을 두 흐름이 나눠 쓴다(정본 §9.4) */
  const handleScan = useCallback(() => {
    if (shipment === undefined) {
      runScan(barcode);
      return;
    }
    const gtin = barcode.trim();
    if (gtin === "") return;
    const currentShipmentId = shipment.shipmentId;
    scanItem.mutate(
      { shipmentId: currentShipmentId, gtin, qty: 1 },
      { onSuccess: () => setBarcode("") },
    );
  }, [shipment, runScan, barcode, scanItem]);

  /** "재스캔" — verified_qty 전부 0(정본 §9.3·§9.4) */
  const handleRescan = useCallback(() => {
    if (shipment === undefined) return;
    rescan.mutate(shipment.shipmentId);
  }, [shipment, rescan]);

  /** LINE 탭 — 배송 내역 조회(3-1)가 이 값을 바로 쓴다 */
  const handleSelectLine = useCallback((lineId: number) => {
    setSelectedLineId(lineId);
  }, []);

  /**
   * "다음 토트" — Stage 8, 정본 §8.3·§8.4. `GET /packing/queue?lineId=`의 첫 행을 스캔
   * 입력에 넣고 곧바로 조회한다(브리프 §3 "첫 토트 코드를 스캔 입력에 넣고 조회"). 큐가
   * 비면 조회 없이 안내만 남긴다.
   */
  const handleNextTote = useCallback(() => {
    if (effectiveLineId === null) return;
    setNextToteMessage(null);
    nextTote.mutate(effectiveLineId, {
      onSuccess: (queue) => {
        if (queue.length === 0) {
          setNextToteMessage("대기 중인 토트 없음");
          return;
        }
        runScan(queue[0].toteCode);
      },
    });
  }, [effectiveLineId, nextTote, runScan]);

  /** 품목 표 "파손 신고" 버튼 — 대화 상자를 연다(정본 §9.4). `shipmentId` 는 여는 순간
   * 값으로 굳혀 둔다(`damage-report-dialog.tsx` 상단 주석 참고) */
  const handleOpenDamageDialog = useCallback(
    (item: ShipmentItem) => {
      if (shipment === undefined) return;
      setDamageTarget({
        shipmentId: shipment.shipmentId,
        gtin: item.gtin,
        name: item.name,
        qty: item.qty,
        verifiedQty: item.verifiedQty,
      });
    },
    [shipment],
  );

  const handleDamageDialogOpenChange = useCallback((open: boolean) => {
    if (!open) setDamageTarget(null);
  }, []);

  /**
   * 파손 신고 결과(정본 §9.3) — 주문 취소(ORDER_CANCELLED)면 배송단위·토트가 사라지므로
   * 화면을 스캔 대기 상태로 되돌린다. 보충(REPLENISH)이면 배송단위가 그대로 남아 있으니
   * 화면은 손대지 않는다 — 상세 재조회(`useDamageReport`)가 "보충 대기" 배지를 채운다.
   */
  const handleDamageOutcome = useCallback(
    (result: DamageReportResponse) => {
      if (result.outcome !== "ORDER_CANCELLED") return;
      setShipmentId(null);
      setBarcode("");
      setSelectedBoxTypeId(null);
      setSelectedProductId(null);
      setIsLidOpen(false);
      scan.reset();
      completePacking.reset();
      scanItem.reset();
      rescan.reset();
    },
    [scan, completePacking, scanItem, rescan],
  );

  /** 3-3. 낙관적으로 화면부터 바꾸고 요청을 보낸다 — 실패하면 패널이 에러를 그린다 */
  const handleOverride = useCallback(
    (boxTypeId: number) => {
      if (shipment === undefined) return;
      setSelectedBoxTypeId(boxTypeId);
      overrideBox.mutate({ shipmentId: shipment.shipmentId, boxTypeId });
    },
    [shipment, overrideBox],
  );

  /**
   * 3-8. 성공하면 화면을 비우고 다음 토트를 받는다.
   *
   * ★ 누르는 **즉시** 뚜껑을 닫는다 — 서버 응답을 기다리지 않는다. 포장을 끝냈다는 손의
   *   동작에 상자가 바로 반응해야 "내가 닫았다"로 읽힌다(응답은 곧 따라온다).
   * ⚠️ 화면 비우기는 뚜껑이 다 닫힌 뒤로 미룬다. 바로 비우면 배송단위가 사라지면서 상자가
   *    통째로 언마운트돼 **닫히는 동작을 볼 새가 없다** — 그러면 애니메이션을 넣은 의미가 없다.
   * ⚠️ 미루는 동안 버튼은 잠긴다(아래 PackActions 의 disabled 조건에 완료 여부가 들어 있다).
   *    안 잠그면 그 1.9초 사이에 한 번 더 눌러 재고가 두 번 빠진다.
   */
  const handleComplete = useCallback(() => {
    if (shipment === undefined) return;
    setIsLidOpen(false);
    completePacking.mutate(shipment.shipmentId, {
      onSuccess: (result) => {
        toast.success(
          `포장 완료 — ${shipment.line.name} 처리량 ${result.line.packedCount}건`,
          w98Toast.success,
        );
        window.setTimeout(() => {
          setShipmentId(null);
          setBarcode("");
          setSelectedBoxTypeId(null);
          setSelectedProductId(null);
          scan.reset();
          scanItem.reset();
          rescan.reset();
        }, LID_CLOSE_MS);
      },
    });
  }, [shipment, completePacking, scan, scanItem, rescan]);

  const isScanning = scan.isPending || shipmentQuery.isLoading;

  /** 같은 스캔 필드가 지금 무엇을 찾는 중인가(정본 §9.4) — 배송단위가 없으면 토트, 있으면
   * 품목. `useShipmentDetail` 은 `shipmentId` 가 바뀌는 순간 이전 데이터를 들고 있을 수
   * 있어 `shipmentId` 자체가 아니라 조회된 `shipment` 로 가른다(로딩 중엔 토트 모드로 둔다). */
  const scanMode: "tote" | "item" = shipment === undefined ? "tote" : "item";
  const replenishPending = shipment?.replenish !== undefined && shipment?.replenish !== null;
  /** 포장완료 활성 조건 — 전 품목 대조 완료 + 보충 없음(정본 §9.3·§9.4) */
  const canComplete =
    shipment !== undefined &&
    shipment.items.length > 0 &&
    shipment.items.every((item) => item.verifiedQty === item.qty) &&
    !replenishPending;

  /**
   * "웨이브 생성" 제출 — 정본 §6.4. 성공은 대화 상자 안 결과 뷰로 보여 주고(토스트로만
   * 흘려보내지 않는다 — 화면 체크 2번이 주문 수·배치 수·태스크 수·skipped 를 직접 봐야
   * 한다), 실패는 대화 상자 안 에러 문구로만 보여준다(폼이 그대로 남아 다시 시도할 수 있게).
   */
  const handleCreateWave = useCallback(
    (cutoffAt: string) => {
      createWave.mutate(
        { cutoffAt },
        {
          onSuccess: (data) => {
            toast.success(`웨이브 ${data.waveNo} 생성 완료`, w98Toast.success);
          },
          onError: (error) => {
            toast.error("웨이브 생성에 실패했습니다", { ...w98Toast.notice, description: error.message });
          },
        },
      );
    },
    [createWave],
  );

  /** 대화 상자를 닫을 때 이전 결과를 지운다 — 안 지우면 다시 열었을 때 결과 뷰가 먼저
   * 보이고 폼으로 못 돌아간다(뮤테이션 상태는 대화 상자 열림과 무관하게 남아 있다). */
  const handleWaveDialogOpenChange = useCallback(
    (open: boolean) => {
      setIsWaveDialogOpen(open);
      if (!open) createWave.reset();
    },
    [createWave],
  );

  /* ── 표시 ──────────────────────────────────────────────── */
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      {/* ── 탭 — 포장 / 주문 / 웨이브 (Stage 5·6) ────────────────
          ⚠️ 높이 h-5(20px) — 입고 화면의 검수/진열 탭 바와 같은 값. 위 docstring "세로 예산"
             참고. 아래 gap-1 도 그 계산에 들어간다. 탭이 셋으로 늘어도 가로 폭만 늘 뿐
             세로 예산은 그대로다. */}
      <div className="flex shrink-0 items-center justify-between gap-1">
        <div className="flex gap-1">
          <Btn
            pressed={activeTab === "packing"}
            onClick={() => setActiveTab("packing")}
            className="h-5 px-3 text-[13px] font-bold"
          >
            포장
          </Btn>
          <Btn
            pressed={activeTab === "orders"}
            onClick={() => setActiveTab("orders")}
            className="h-5 px-3 text-[13px] font-bold"
          >
            주문
          </Btn>
          <Btn
            pressed={activeTab === "waves"}
            onClick={() => setActiveTab("waves")}
            className="h-5 px-3 text-[13px] font-bold"
          >
            웨이브
          </Btn>
        </div>

        {/* "주문 투입" — 탭과 무관한 전역 액션이라 탭 바 오른쪽에 고정한다(정본 §6.7) */}
        <Btn
          onClick={() => setIsWaveDialogOpen(true)}
          className="h-5 px-3 text-[13px] font-bold"
        >
          주문 투입
        </Btn>
      </div>

      {activeTab === "orders" ? <OrdersTab /> : null}
      {activeTab === "waves" ? <WavesTab /> : null}

      {/* 포장 탭 — 기존 화면. 언마운트하지 않고 숨기기만 한다: 토트 스캔 중간 상태가 탭을
          오가도 사라지지 않아야, 실수로 주문 탭을 눌렀다가 돌아와도 하던 작업이 남는다. */}
      <div className="flex min-h-0 flex-1 flex-col gap-2" hidden={activeTab !== "packing"}>
      {/* 3-5 진입점. TOTE_NOT_ASSIGNED(404) 는 이 바 오른쪽에 표시된다. 배송단위가 열리면
          같은 입력란이 품목 스캔으로 모드를 바꾼다(Stage 9, 정본 §9.4) */}
      <ToteScanPanel
        mode={scanMode}
        value={barcode}
        onChange={setBarcode}
        onScan={handleScan}
        isPending={isScanning || scanItem.isPending}
        error={scan.error?.message ?? nextTote.error?.message ?? null}
        summary={
          shipment === undefined
            ? null
            : {
                lineName: shipment.line.name,
                seqNo: shipment.seqNo,
                toteBarcode: shipment.tote?.barcode ?? null,
              }
        }
        replenishPending={replenishPending}
        lines={lines}
        linesLoading={linesQuery.isLoading}
        selectedLineId={effectiveLineId}
        onSelectLine={handleSelectLine}
        onNextTote={handleNextTote}
        isNextTotePending={nextTote.isPending}
        queueMessage={nextToteMessage}
        onRescan={handleRescan}
        isRescanPending={rescan.isPending}
      />

      <div className="flex min-h-0 flex-1 gap-2">
        {/* ── 좌: 배송 내역 + 품목 ──────────────────────────── */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
          {/* 3-1 GET /lines/{lineId}/shipments — 위 토트 스캔 패널의 `LINE:` 탭에서 고른
              라인의 배송단위를 대기중(TOTE_ASSIGNED)/진행중(PACKING)/완료(PACKED) 로 표시
              (D-12). 라인은 여기서 다시 고르지 않는다(`line-shipments-panel.tsx`). */}
          {/* ★ 132 → **340px** (사용자 결정 — 라인별 배송 내역을 더 크게).
              이 칸은 라인의 배송단위가 **여러 줄로 쌓이는** 자리라 132px 로는 두세 줄이
              한계였다. 늘어난 208px 은 아래 품목 표(flex-1)가 내준다 — 품목은 보통 서너
              줄이라 지금도 아래쪽이 절반 넘게 비어 있었다.
              ⚠️ 품목 표가 줄어드는 건 맞지만 잘리지는 않는다. 표 안이 `overflow-y-auto` 라
                 품목이 많아지면 표 안에서 스크롤된다(패널이 늘어나지 않는다).
              ⚠️ 이 숫자 하나만 바꾸면 두 칸의 비율이 정해진다. 왼쪽 열 높이가 약 764px 이라
                 340 이면 배송 내역 : 품목 = 340 : 416 이다. */}
          <LineShipmentsPanel
            selectedLineId={effectiveLineId}
            linesLoading={linesQuery.isLoading}
            shipments={lineShipmentsQuery.data?.shipments ?? []}
            shipmentsLoading={lineShipmentsQuery.isLoading}
            shipmentsError={lineShipmentsQuery.isError}
          />

          {/* 3-2 items + 파생 취급속성. 낱개 스캔 누계(verifiedQty)는 서버 값 그대로
              (Stage 9, 정본 §9.3 — D-06 의 프론트 전용 실수량을 대체한다) */}
          <ShipmentItemsPanel
            items={shipment?.items ?? []}
            selectedProductId={selectedProductId}
            onSelectProduct={setSelectedProductId}
            onDamageReport={handleOpenDamageDialog}
            replenishPending={replenishPending}
            scanError={scanItem.error ?? rescan.error}
            isLoading={shipmentQuery.isLoading}
            hasShipment={shipment !== undefined}
          />
        </div>

        {/* ── 우 580px: 사진 + 박스 + 액션 ────────────────────
            ★ 380 → 480 → 580 으로 두 번 넓혔다 (사용자 지시).
              380 에서는 3D 상자 옆 이름·내치수·재고가 두 줄로 접히고 `박스 변경` 셀렉트에
              `C호 · 34.0 × 25.0 × 21.0 cm · 재고 31개` 가 안 들어갔다. 580 이면 그 줄들이
              한 줄로 펴지고 제품 사진도 크게 뜬다.
            ⚠️ 좌측에 802px 이 남는다. 원본 /packing 의 691:718 과 비슷한 균형이라 품목 표가
              좁아 보이지는 않는다 — 표는 열이 비율(46/12/16/26%)이라 폭에 따라 같이 줄고,
              가장 넓은 제품명 열이 802 × 46% ≈ 369px 로 이름이 잘리지 않는다.
              더 넓히려면 여기 숫자만 바꾸면 되지만, 700 을 넘기면 제품명 열이 300px 아래로
              떨어져 긴 이름이 잘리기 시작한다. */}
        {/* ★ 580 → **700px** (사용자 결정 — 박스 추천 칸이 좁았다).
            늘어난 120px 은 왼쪽 열(라인별 배송 내역 + 품목)이 내준다. 왼쪽은 `flex-1` 이라
            남는 폭을 먹는 쪽이고, 표가 들어 있어 줄어들 여지가 있다 — 제품명이 가장 긴
            열인데 그 열만 `min-w-0` 로 줄어들고 나머지(주문·실수량·취급주의)는 폭이 고정이다.
            ⚠️ 왼쪽이 822 → 702px 이 된다. 여기서 더 줄이면 품목 표의 제품명이 잘리기
               시작하므로, 오른쪽을 더 넓혀야 하면 표의 열 구성을 먼저 손봐야 한다. */}
        <div className="flex w-[700px] shrink-0 flex-col gap-2">
          {/* ── 위: 3D 상자 ───────────────────────────────────────────────
              ★ 상자를 크게 보고 싶다는 요구로 **오른쪽 열 맨 위**에 통째로 올렸다
                (사용자 결정). 전에는 박스 추천 패널 안에 260px 정사각형으로 들어 있었다.
                남는 세로를 전부 먹으므로 아래 두 칸의 높이가 곧 이 상자의 크기를 정한다.
              ⚠️ 추천 박스가 없으면(스캔 전) 점선 윤곽만 뜬다 — 비율을 모르는데 상자를
                 그리면 아무 박스나 그린 셈이 된다. */}
          <Panel
            title="박스 미리보기"
            right={
              /* 모델 전환 — 제목 줄 오른쪽의 작은 탭 두 개. 눌린 쪽이 지금 보고 있는 것이다 */
              <span className="flex shrink-0 gap-1">
                {SHOWN_MODELS.map((model) => (
                  <Btn
                    key={model.key}
                    pressed={model.key === modelKey}
                    onClick={() => setModelKey(model.key)}
                    title={model.title}
                    className={`${w98.small} h-5 px-2 font-normal`}
                  >
                    {model.label}
                  </Btn>
                ))}
              </span>
            }
            className="min-h-0 flex-1"
            bodyClassName="min-h-0"
          >
            <Box3DViewer
              modelUrl={activeModel.url}
              pixelScale={activeModel.pixelScale}
              decalUrl={activeModel.decalUrl}
              innerCm={effectiveBox?.innerCm ?? null}
              name={effectiveBox ? boxLabel(effectiveBox.name) : null}
              lidOpen={isLidOpen}
              pigs={activeModel.pigs ?? false}
              className="min-h-0 flex-1"
            />
          </Panel>

          {/* ── 아래: 제품 이미지 | 박스 추천 정보 (가로 2단) ──────────────
              둘 다 "지금 잡은 배송단위를 설명하는 값"이라 한 줄에 나란히 둔다.
              높이는 박스 추천 쪽이 결정한다 — 이름·내치수·재고·충전재·박스 변경까지
              다섯 줄이 접히지 않고 들어가는 최소치다.
              ★ 230 → **290px** (사용자 요청 — 위로 조금 더). 박스 이름을 56px 로 키우면서
                230px 에서는 `B호` 의 윗부분이 잘렸다. 늘어난 60px 은 위의 Box Preview(flex-1)가
                내주므로, 3D 상자가 그만큼 작아진다 — 상자는 이미 충분히 크다. */}
          <div className="flex h-[290px] shrink-0 gap-2">
            {/* 1-6. 좌측에서 고른 품목의 사진을 대표 한 장만 띄운다 */}
            <ProductImagePanel
              productName={selectedItem?.name ?? null}
              productGtin={selectedItem?.gtin ?? null}
              data={productImagesQuery.data}
              isLoading={productImagesQuery.isLoading}
              className="min-w-0 flex-1"
            />

            {/* 3-2 recommendedBox / finalBox / fillerRecommended 표시 + 3-3 오버라이드 */}
            <BoxRecommendationPanel
              recommendedBox={shipment?.recommendedBox ?? null}
              finalBox={finalBox}
              fillerRecommended={shipment?.fillerRecommended ?? false}
              availableBoxes={boxes}
              onOverride={handleOverride}
              isPending={overrideBox.isPending}
              error={overrideBox.error?.message ?? null}
              hasShipment={shipment !== undefined}
              /* ★ 272 → 350 → **470px** (사용자 결정). 박스 이름·내치수·재고·충전재·박스
                 변경까지 다섯 줄이 들어가는 칸이라 제품 이미지보다 넓어야 한다. 특히
                 `박스 변경` 셀렉트가 `C호 · 34.0 × 25.0 × 21.0 cm · 재고 31개` 를 한 줄로
                 담아야 하는데, 350px 에서는 그 줄이 잘렸다.
                 ★ 오른쪽 열을 넓히며 생긴 120px 을 **전부 여기로 보냈다.** 제품 이미지는
                   그대로 222px 다 — 그 칸은 사진 한 장이라 넓힌다고 더 읽히지 않는다. */
              className="w-[470px] shrink-0"
            />
          </div>

          {/* 3-8. OUT_OF_STOCK · INVALID_STATE(409) 방어는 컴포넌트 안에서 문구를 가른다.
              활성 조건 — 전 품목 대조 완료 + 보충 없음(Stage 9, 정본 §9.3·§9.4) */}
          <PackActions
            onComplete={handleComplete}
            disabled={!canComplete || completePacking.data !== undefined}
            isPending={completePacking.isPending}
            error={completePacking.error}
          />
        </div>
      </div>
      </div>

      {/* 품목 표 "파손 신고" — 정본 §9.3·§9.4 */}
      <DamageReportDialog
        target={damageTarget}
        onOpenChange={handleDamageDialogOpenChange}
        onOutcome={handleDamageOutcome}
      />

      <WaveCreateDialog
        open={isWaveDialogOpen}
        onOpenChange={handleWaveDialogOpenChange}
        onSubmit={handleCreateWave}
        isSubmitting={createWave.isPending}
        result={createWave.data ?? null}
        error={createWave.error?.message ?? null}
      />
    </div>
  );
}

/**
 * 뚜껑이 다 닫히는 데 걸리는 시간(ms). 화면을 비우기 전에 이만큼 기다린다.
 * ⚠️ `_components/chest-3d.tsx` 의 LID_SECONDS 와 같은 값이어야 한다 — 여기가 더 짧으면
 *    닫히다 만 채로 상자가 사라지고, 더 길면 다 닫힌 상자를 멀뚱히 보고 있게 된다.
 */
/* 포장 완료를 누르고 화면을 비우기까지 기다리는 시간 — 뚜껑이 다 닫힐 때까지(약 1.9초)다.
   먼저 지워지면 배송단위가 사라지면서 상자가 통째로 언마운트돼, 닫히는 장면이 중간에 끊긴다. */
const LID_CLOSE_MS = 1900;

/* ── 3D 모델 ────────────────────────────────────────────────────────────────
   둘 다 **코드로 만든다** — GLB 파일을 쓰지 않는다 (사용자 요청: 크랙 없애기).

   사용자가 만들어 온 GLB 두 개는 표면이 닫혀 있지 않았다(열린 모서리 마크 6,583 · 택배
   9,788개). 그 구멍으로 배경이 비쳐 흰 금처럼 보이던 것이 크랙의 정체였고, 재질·필터로는
   고칠 수 없었다. 상자는 원래 정육면체 몇 개면 되는 모양이라 코드로 세우는 편이
   **크랙이 없고, 가볍고(삼각형 36·72개), 파일도 필요 없다.**

   ⚠️ 원본 GLB 는 `public/models/` 에 그대로 있다. 비교해 보고 싶으면 아래에
      `{ key: "glb", label: "원본", url: "/models/minecraft-chest.glb" }` 처럼 한 줄 더
      넣으면 된다 — 뷰어가 GLB 경로도 그대로 받는다. 대신 크랙이 같이 돌아온다. */
/* ⚠️ 저폴리 두 종(`chest`·`carton`)을 목록에서 뺐다 (사용자 결정 — 실사 둘만 남긴다).
      코드로 상자를 만드는 기능 자체는 뷰어에 그대로 있다(`low-poly-boxes.ts`). 모델 파일 없이
      3D 를 확인해야 할 때 쓰는 안전망이라, 목록에서만 내리고 기능은 지우지 않았다. */
type BoxModelKey = "chest-real" | "meshy" | "carton-v3";

/**
 * 화면에 띄울 상자 목록.
 *
 * ★ `localOnly` 가 붙은 것은 **배포본에서 뺀다** (사용자 요청). GLB 가 한 덩어리에
 *   10~15MB 라 `public/` 이 39MB 였고, 배포가 그 폴더를 통째로 올리는 구조여서 매번
 *   20분씩 걸렸다. 시연에 실제로 쓰는 상자는 하나뿐이라 나머지를 안 올린다.
 * ⚠️ 파일 자체는 저장소에 남긴다. 지우면 팀원이 받았을 때 로컬에서도 안 보인다 —
 *    올리지 않는 것과 없애는 것은 다르다. 제외는 `.vercelignore` 가 한다.
 * ⚠️ 마크 상자(`chest-split.glb`)는 **목록에서만 빼고 파일은 올린다.** 분석 화면의
 *    이스터에그(상자가 열리며 돼지가 튀어나오는 것)가 같은 파일을 쓴다 — 안 올리면
 *    그 연출이 서버에서 깨진다.
 * ⚠️ 목록에서 빼는 것과 파일을 안 올리는 것을 **함께** 해야 한다. 목록에만 남기면
 *    배포본에서 그 버튼을 눌렀을 때 404 가 난다.
 */
const BOX_MODELS: {
  key: BoxModelKey;
  label: string;
  /** 참이면 개발 중에만 보인다 (위 주석 참고) */
  localOnly?: boolean;
  title: string;
  url: string;
  /** 1 이면 도트 없이 또렷하게. 마크 상자만 굵은 도트로 그린다 */
  pixelScale: number;
  /** 앞면에 얹을 택배사 인쇄. 없으면 민무늬 상자다 */
  decalUrl?: string;
  /** 🐷 뚜껑이 열릴 때 돼지가 튀어나오는가 (이스터에그). 마크 상자만 */
  pigs?: boolean;
}[] = [
  {
    /* 팀원이 블렌더로 몸체·뚜껑을 갈라 준 원본 모델.
       ★ OBJ 로 받아 `tools/obj-to-glb.py` 로 GLB 변환하면서 **경첩을 뚜껑 노드의 원점으로**
         박았다(몸체의 뒤쪽 위 모서리). 그래서 애니메이션 클립이 없어도 뷰어가 직접 여닫는다.
       ⚠️ 34MB OBJ → 10.4MB GLB. 그래도 무거우니 배포 전에는 폴리곤을 줄이는 게 좋다
          (몸체 230,292 + 뚜껑 126,992 삼각형). */
    key: "chest-real",
    label: "마크(실사)",
    localOnly: true,
    title: "마인크래프트 상자 — 팀원이 자른 원본 (뚜껑 분리)",
    url: "/models/chest-split.glb",
    pixelScale: 1,
    pigs: true,
  },
  {
    /* Meshy AI 로 뽑아 온 사실적인 상자.
       ★ **표면이 닫혀 있다**(열린 모서리 0개) — 그래서 크랙이 없다. 앞서 문제였던 GLB 둘과
         갈리는 지점이 정확히 이것이고, 용량과는 무관했다.
       ⚠️ 대신 **여닫히지 않는다.** 파트가 하나뿐이고 애니메이션이 없어서, 처음부터 열려 있는
          모양 그대로 서 있다. 여닫는 연출이 필요하면 뚜껑을 분리한 버전으로 다시 뽑아야 한다.
       ⚠️ 16MB · 삼각형 428,160개다. 시연에는 문제없지만 실제 배포 전에는 줄여야 한다. */
    key: "meshy",
    label: "실사",
    title: "Meshy AI 상자 — 사실적, 크랙 없음. 단 여닫히지 않는다",
    /* ★ 팀원이 블렌더에서 **날개 4장을 떼어 준** 모델. 통짜였던
         `/models/meshy-open-box.glb` → `carton-split.glb` → **`carton-split-v2.glb`** 로
         두 번 갈아탔다. 노드 구성은 몸체 1 + 날개 4 이고, 각 날개의 원점이 이미 경첩 변에
         잡혀 있어 rotation 만 돌리면 접힌다. 회전 축·각도·방향은 뷰어가 모델을 재서 스스로
         구한다(box-3d-viewer 의 날개 자동 리깅 참고) — 여기에 숫자를 적어 두면 다시 잘라
         올 때마다 고쳐야 한다.

       ★ v2 에서 좋아진 것 (실측):
           날개 길이   0.412~0.418 → 0.456~0.461
           경첩 간격   1.229/1.234 → 1.122/1.116   (상자가 정사각형에 가까워졌다)
           못 만나는 양 0.41       → 0.20          (가운데 구멍 넓이가 1/4 로)
           피벗 밖 삐짐 0.078~0.104 → 0.021~0.063
       ⚠️ 그래도 **아직 완전히는 안 닫힌다.** 마주 보는 날개가 만나려면 한 장이 0.56 이어야
          하는데 0.46 이다 — 한 장에 0.10(약 22%)씩 더 길어야 한다. 지금은 가운데에
          0.21 × 0.20 짜리 구멍이 남는다.
       ⚠️ 15.6MB · 428,621 삼각형. 배포 전에는 줄이는 게 좋다.
       ⚠️ 첫 번째 컷(`carton-split.glb`)은 v2 로 대체되어 지웠다. */
    url: "/models/carton-split-v2.glb",
    pixelScale: 1,
    decalUrl: "/textures/onepack-decal.png",
  },
  {
    /* ★ 팀원이 **세 번째로** 잘라 준 모델. 앞의 둘과 갈리는 점이 둘 있다:
         ① 날개가 훨씬 얇다 — 단면이 0.019~0.027 로 v2(0.053)의 절반이다. 접었을 때 상자
            윗변에 서던 턱이 그만큼 낮다.
         ② **날개 노드에 회전이 들어 있다.** 앞의 둘은 이동만 있었다. 뷰어가 그 회전을
            기하에 구워 넣은 뒤 리깅하므로(box-3d-viewer 참고) 여기서 따로 할 일은 없다.
       ⚠️ Z벽 쌍은 이미 가운데서 만나고(겹침 0.023), X벽 쌍만 0.091 모자라 뷰어가 늘린다.
       ⚠️ 14.3MB · 341,008 삼각형. 배포 전에는 줄이는 게 좋다. */
    key: "carton-v3",
    label: "실사2",
    localOnly: true,
    title: "택배 상자 — 팀원이 세 번째로 자른 원본 (날개 4장, 얇은 단면)",
    url: "/models/carton-split-v3.glb",
    pixelScale: 1,
    decalUrl: "/textures/onepack-decal.png",
  },
];

/* 이 빌드에서 실제로 보여 줄 상자. 배포본에서는 `localOnly` 를 뺀다 (위 주석 참고).
   ⚠️ `NODE_ENV` 로 가른다. Next 가 빌드 때 이 값을 상수로 바꿔 넣으므로, 배포본 번들에는
      뺀 항목이 아예 안 들어간다 — 실행 중에 판단하는 것이 아니다. */
const SHOWN_MODELS = BOX_MODELS.filter(
  (m) => process.env.NODE_ENV !== "production" || m.localOnly !== true,
);
