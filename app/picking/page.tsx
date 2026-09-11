"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { w98Toast } from "@/lib/win98-toast";
import type { PickTask, PickTaskPickResponse } from "@/lib/types";
import { BatchCompletePanel } from "./_components/batch-complete-panel";
import { BatchQueuePanel } from "./_components/batch-queue-panel";
import { BatchTotePanel } from "./_components/batch-tote-panel";
import { PickOutcomeBanner } from "./_components/pick-outcome-banner";
import { ShortConfirmDialog } from "./_components/short-confirm-dialog";
import { TaskCardPanel } from "./_components/task-card-panel";
import { WorkerGatePanel } from "./_components/worker-gate-panel";
import { Panel, w98 } from "./_components/win98-ui";
import { clearWorkerCode, loadWorkerCode, saveWorkerCode } from "./_data/worker-code";
import {
  useClaimPickBatch,
  useCompletePickBatch,
  useOpenPickBatches,
  usePickBatch,
  usePickTask,
  useStartPickBatch,
} from "./_data/use-picking";

const CARD_WIDTH = "w-[480px]";

/**
 * 피킹 화면 (Stage 7, 브리프 §3 S7.4) — 작업자 코드 → OPEN 배치 목록 → claim → 배치 토트 →
 * 태스크 카드 한 장씩 → 배치 완료. PDA 폭을 가정해 **가운데 480px 카드 한 열**만 그린다
 * (셸은 다른 win98 화면과 같은 사본, `_components/shell.tsx`).
 *
 * 상태는 대부분 서버가 들고 있다 — 이 컴포넌트는 "지금 어느 배치·어느 태스크를 보고
 * 있는가"만 로컬로 쥐고(`activeBatchId`), 나머지(claimedBy·진행·다음 태스크)는 배치 상세
 * 조회(`usePickBatch`)를 다시 읽어서 얻는다. 그래서 새로고침해도 `activeBatchId` 만 있으면
 * 같은 화면으로 돌아온다(작업자 코드는 localStorage, 배치 id는 이 세션 한정 — 새로고침 시
 * 배치를 다시 골라야 하는 것은 의도된 단순화다. 정본에 재진입 계약이 없다).
 */
export default function PickingPage() {
  const [workerCode, setWorkerCode] = useState<string | null>(null);
  const [isWorkerLoaded, setIsWorkerLoaded] = useState(false);
  const [activeBatchId, setActiveBatchId] = useState<number | null>(null);
  const [lastOutcome, setLastOutcome] = useState<PickTaskPickResponse | null>(null);
  const [pendingShort, setPendingShort] = useState<{ task: PickTask; qty: number } | null>(null);

  // 첫 렌더는 서버와 같아야 하이드레이션이 어긋나지 않는다 — localStorage 읽기는 마운트 뒤.
  // `shell.tsx` 의 TrayClock 과 같은 형태(effect 는 로컬 함수 하나만 부른다)다.
  useEffect(() => {
    const loadOnMount = () => {
      setWorkerCode(loadWorkerCode());
      setIsWorkerLoaded(true);
    };
    loadOnMount();
  }, []);

  const openBatchesQuery = useOpenPickBatches(
    isWorkerLoaded && workerCode !== null && activeBatchId === null,
  );
  const batchQuery = usePickBatch(activeBatchId);
  const claimMutation = useClaimPickBatch();
  const startMutation = useStartPickBatch();
  const pickMutation = usePickTask(activeBatchId);
  const completeMutation = useCompletePickBatch();

  const batch = batchQuery.data ?? null;

  /** 다음에 집을 태스크 — seqNo 가 가장 빠른 PENDING. 재할당으로 배치 끝에 태스크가
   * 추가돼도 이 계산 하나로 자동으로 잡힌다(정본 §7.3, PickTaskPickResponse.nextTaskId 와
   * 같은 규칙을 화면이 자체 계산으로 다시 확인하는 셈이다) */
  const currentTask = useMemo(() => {
    if (batch === null) return null;
    const pending = batch.tasks.filter((task) => task.status === "PENDING");
    if (pending.length === 0) return null;
    return pending.slice().sort((a, b) => a.seqNo - b.seqNo)[0];
  }, [batch]);

  const progress = useMemo(() => {
    if (batch === null) return { position: 0, total: 0 };
    const total = batch.tasks.length;
    const settled = batch.tasks.filter((task) => task.status !== "PENDING").length;
    return { position: Math.min(settled + 1, total), total };
  }, [batch]);

  function handleWorkerSubmit(code: string) {
    saveWorkerCode(code);
    setWorkerCode(code);
  }

  function handleChangeWorker() {
    clearWorkerCode();
    setWorkerCode(null);
    setActiveBatchId(null);
  }

  function handleClaim(batchId: number) {
    if (workerCode === null) return;
    claimMutation.mutate(
      { id: batchId, worker: workerCode },
      {
        onSuccess: (data) => {
          setActiveBatchId(data.pickBatchId);
          toast.success("배치를 받았습니다", w98Toast.success);
        },
        onError: (error) => {
          if (error instanceof ApiError && error.is("ALREADY_CLAIMED")) {
            toast.error("다른 작업자가 가져갔습니다", w98Toast.notice);
            void openBatchesQuery.refetch();
            return;
          }
          if (error instanceof ApiError && error.is("NO_TOTE")) {
            toast.error("배치 토트가 부족합니다 — 잠시 뒤 다시 시도하세요", w98Toast.notice);
            return;
          }
          toast.error("배치를 받지 못했습니다", { ...w98Toast.notice, description: error.message });
        },
      },
    );
  }

  function handleStart() {
    if (activeBatchId === null) return;
    startMutation.mutate(activeBatchId, {
      onError: (error) => {
        toast.error("피킹을 시작하지 못했습니다", { ...w98Toast.notice, description: error.message });
      },
    });
  }

  function submitPick(task: PickTask, qty: number) {
    pickMutation.mutate(
      { taskId: task.pickTaskId, body: { qty, worker: workerCode ?? "" } },
      {
        onSuccess: (data) => {
          setPendingShort(null);
          if (data.status === "SHORT") {
            setLastOutcome(data);
          } else {
            toast.success("확정했습니다", w98Toast.success);
          }
        },
        onError: (error) => {
          toast.error("확정하지 못했습니다", { ...w98Toast.notice, description: error.message });
        },
      },
    );
  }

  function handleConfirm(task: PickTask, qty: number) {
    if (qty < task.qty) {
      setPendingShort({ task, qty });
      return;
    }
    submitPick(task, qty);
  }

  function handleComplete() {
    if (activeBatchId === null) return;
    completeMutation.mutate(activeBatchId, {
      onError: (error) => {
        toast.error("배치를 완료하지 못했습니다", { ...w98Toast.notice, description: error.message });
      },
    });
  }

  function handleNextBatch() {
    setActiveBatchId(null);
    setLastOutcome(null);
  }

  const content = renderContent();

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center">
      {content}
      {pendingShort !== null ? (
        <ShortConfirmDialog
          task={pendingShort.task}
          qty={pendingShort.qty}
          open
          onOpenChange={(open) => {
            if (!open) setPendingShort(null);
          }}
          onConfirm={() => submitPick(pendingShort.task, pendingShort.qty)}
          isSubmitting={pickMutation.isPending}
        />
      ) : null}
    </div>
  );

  function renderContent() {
    if (!isWorkerLoaded) return null;

    if (workerCode === null) {
      return <WorkerGatePanel onSubmit={handleWorkerSubmit} className={CARD_WIDTH} />;
    }

    if (activeBatchId === null) {
      return (
        <BatchQueuePanel
          workerCode={workerCode}
          items={openBatchesQuery.data?.items ?? []}
          isLoading={openBatchesQuery.isLoading}
          errorMessage={openBatchesQuery.error?.message ?? null}
          onClaim={handleClaim}
          isClaiming={claimMutation.isPending}
          claimingBatchId={claimMutation.variables?.id ?? null}
          onChangeWorker={handleChangeWorker}
          className={CARD_WIDTH}
        />
      );
    }

    if (batch === null) {
      return (
        <Panel title="불러오는 중" className={CARD_WIDTH}>
          <p className={`${w98.small} p-2 text-[color:var(--muted-foreground)]`}>
            {batchQuery.error?.message ?? "배치 정보를 불러오는 중…"}
          </p>
        </Panel>
      );
    }

    if (batch.status === "CLAIMED") {
      return (
        <BatchTotePanel
          batch={batch}
          onStart={handleStart}
          isStarting={startMutation.isPending}
          className={CARD_WIDTH}
        />
      );
    }

    if (batch.status === "DONE") {
      return (
        <BatchCompletePanel
          batch={batch}
          onComplete={handleComplete}
          isCompleting={completeMutation.isPending}
          onNextBatch={handleNextBatch}
          className={CARD_WIDTH}
        />
      );
    }

    if (lastOutcome !== null) {
      return (
        <PickOutcomeBanner
          result={lastOutcome}
          onDismiss={() => setLastOutcome(null)}
          className={CARD_WIDTH}
        />
      );
    }

    if (currentTask !== null) {
      return (
        <TaskCardPanel
          task={currentTask}
          seqPosition={progress.position}
          totalTasks={progress.total}
          onConfirm={(qty) => handleConfirm(currentTask, qty)}
          isConfirming={pickMutation.isPending}
          className={CARD_WIDTH}
        />
      );
    }

    return (
      <BatchCompletePanel
        batch={batch}
        onComplete={handleComplete}
        isCompleting={completeMutation.isPending}
        onNextBatch={handleNextBatch}
        className={CARD_WIDTH}
      />
    );
  }
}
