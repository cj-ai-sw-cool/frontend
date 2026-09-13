"use client";

/**
 * 허브 "이동" 탭 — 정본 §12.5·§12.6, 브리프 §2.
 *
 * 좌 — `GET /hub/transfers` 표(번호·출발→도착·화주·상태·품목 수) + "이동 생성" 대화 상자.
 * 우 — 행을 클릭하면 상세(`GET /hub/transfers/{id}`)에서 shipped/received 진행을 보여주고,
 * `CREATED` 상태면 "출발" 버튼(`POST /hub/transfers/{id}/dispatch`)이 뜬다. 409
 * `INSUFFICIENT_ATP` 는 토스트로 안내한다(정본 §12.5 ①·②, 화면 체크 4).
 */

import { useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { w98Toast } from "@/lib/win98-toast";
import type { CreateTransferRequest, TransferStatus } from "@/lib/types";
import {
  useCreateTransfer,
  useDispatchTransfer,
  useHubCenters,
  useSellers,
  useTransferDetail,
  useTransfers,
} from "../_data/use-hub";
import { Th, Td } from "./table";
import { TransferCreateDialog } from "./transfer-create-dialog";
import { Btn, Select, Sunken, w98 } from "./win98-ui";

const STATUS_LABEL: Record<TransferStatus, string> = {
  CREATED: "생성됨",
  DISPATCHED: "출발",
  RECEIVED: "도착완료",
  CLOSED: "종료",
};

export function TransfersTab() {
  const { data: centers } = useHubCenters();
  const sellersQuery = useSellers();
  const [statusFilter, setStatusFilter] = useState<TransferStatus | "">("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: page, isLoading, error } = useTransfers({ status: statusFilter || undefined });
  const detail = useTransferDetail(selectedId);
  const createTransfer = useCreateTransfer();
  const dispatchTransfer = useDispatchTransfer();

  const handleCreate = (body: CreateTransferRequest) => {
    createTransfer.mutate(body, {
      onSuccess: (data) => {
        toast.success(`이동 오더 ${data.transferNo} 생성`, w98Toast.success);
        setSelectedId(data.transferId);
        setIsCreateOpen(false);
      },
      onError: (err) => {
        toast.error("이동 생성에 실패했습니다", { ...w98Toast.notice, description: err.message });
      },
    });
  };

  const handleDispatch = (id: number) => {
    dispatchTransfer.mutate(id, {
      onSuccess: (data) => {
        toast.success(`${data.transferNo} 출발 — 도착 센터 ASN 생성`, w98Toast.success);
      },
      onError: (err) => {
        if (err instanceof ApiError && err.is("INSUFFICIENT_ATP")) {
          toast.error("출발 센터 ATP 부족", { ...w98Toast.notice, description: err.message });
          return;
        }
        toast.error("출발 처리에 실패했습니다", { ...w98Toast.notice, description: err.message });
      },
    });
  };

  return (
    <div className="flex h-full min-h-0 gap-2">
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <div className="flex shrink-0 items-center justify-between gap-2">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TransferStatus | "")}
            className="w-40"
          >
            <option value="">상태 전체</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Btn onClick={() => setIsCreateOpen(true)} className="h-7 px-3 font-bold">
            이동 생성
          </Btn>
        </div>

        <Sunken className={`${w98.scroll} min-h-0 flex-1 overflow-y-auto`}>
          <table className="w-full border-collapse text-left text-[13px]">
            <thead className="sticky top-0 bg-[color:var(--surface)]">
              <tr>
                <Th>번호</Th>
                <Th>출발 → 도착</Th>
                <Th>화주</Th>
                <Th>상태</Th>
                <Th>품목 수</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-3 text-[color:var(--muted-foreground)]">
                    이동 목록을 불러오는 중…
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="p-3 text-[color:var(--status-error)]">
                    이동 목록을 불러오지 못했습니다.
                  </td>
                </tr>
              ) : page?.content.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-[color:var(--muted-foreground)]">
                    조건에 맞는 이동 오더가 없습니다.
                  </td>
                </tr>
              ) : (
                page?.content.map((t) => (
                  <tr
                    key={t.transferId}
                    onClick={() => setSelectedId(t.transferId)}
                    className={`cursor-pointer border-t border-[color:var(--border)] hover:bg-[color:var(--surface-variant)] ${
                      t.transferId === selectedId ? "bg-[color:var(--surface-variant)] font-bold" : ""
                    }`}
                  >
                    <Td mono>{t.transferNo}</Td>
                    <Td mono>
                      {t.fromCenter} → {t.toCenter}
                    </Td>
                    <Td mono>{t.sellerCode}</Td>
                    <Td>{STATUS_LABEL[t.status]}</Td>
                    <Td mono>{t.items.length}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Sunken>
      </div>

      <Sunken className={`${w98.scroll} flex w-[420px] shrink-0 flex-col gap-2 overflow-y-auto p-2`}>
        {selectedId === null ? (
          <span className="p-1 text-[13px] text-[color:var(--muted-foreground)]">
            행을 클릭하면 이동 진행(shipped/received)을 보여줍니다.
          </span>
        ) : detail.isLoading ? (
          <span className="p-1 text-[13px] text-[color:var(--muted-foreground)]">상세 조회 중…</span>
        ) : detail.data === undefined || detail.data === null ? (
          <span className="p-1 text-[13px] text-[color:var(--status-error)]">상세를 불러오지 못했습니다.</span>
        ) : (
          (() => {
            const data = detail.data;
            return (
              <>
                <div className="flex items-center justify-between">
                  <span className={w98.titleText}>{data.transferNo}</span>
                  <span className="text-[12px] font-bold">{STATUS_LABEL[data.status]}</span>
                </div>
                <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>
                  {data.fromCenter} → {data.toCenter} · {data.sellerCode}
                </span>
                {data.asnNo ? (
                  <span className={`${w98.mono} ${w98.small}`}>
                    도착 ASN: <b>{data.asnNo}</b>
                  </span>
                ) : null}

                <table className="w-full border-collapse text-left text-[12px]">
                  <thead>
                    <tr>
                      <Th>GTIN</Th>
                      <Th>수량</Th>
                      <Th>출발</Th>
                      <Th>도착</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.gtin} className="border-t border-[color:var(--border)]">
                        <Td mono>{item.gtin}</Td>
                        <Td mono>{item.qty}</Td>
                        <Td mono>{item.shippedQty}</Td>
                        <Td mono>{item.receivedQty}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {data.status === "CREATED" ? (
                  <Btn
                    onClick={() => handleDispatch(data.transferId)}
                    disabled={dispatchTransfer.isPending}
                    className="h-7 font-bold"
                  >
                    {dispatchTransfer.isPending ? "출발 처리 중…" : "출발"}
                  </Btn>
                ) : null}
              </>
            );
          })()
        )}
      </Sunken>

      <TransferCreateDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        centers={centers ?? []}
        sellers={sellersQuery.data}
        sellersLoading={sellersQuery.isLoading}
        onSubmit={handleCreate}
        isSubmitting={createTransfer.isPending}
        error={createTransfer.error?.message ?? null}
      />
    </div>
  );
}
