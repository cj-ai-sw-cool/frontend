"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { w98Toast } from "@/lib/win98-toast";
import { ApiError } from "@/lib/api";
import type { OrderStatus } from "@/lib/types";
import {
  useCancelOrder,
  useImportOrders,
  useOrderDetail,
  useOrdersList,
  useSellers,
} from "../_data/use-orders";
import { OrderDetailPanel } from "./order-detail-panel";
import { OrderImportPanel } from "./order-import-panel";
import { OrderListPanel } from "./order-list-panel";
import { CANCELLABLE_ORDER_STATUSES } from "@/lib/types";

const PAGE_SIZE = 20;

/**
 * "주문" 탭 — 정본 §5.8, 브리프 §3 S5.4.
 *
 * 포장 탭(`page.tsx`)과 별도 탭이라 이 컴포넌트가 자기 상태·데이터 훅을 전부 들고 있다
 * (Stage 4 진열 탭 `putaway-tab.tsx` 와 같은 관례). 3열: 목록(320) · 상세(flex-1) ·
 * 테스트 접수 폼(340) — 진열 탭의 3열 배치를 그대로 잇는다.
 */
export function OrdersTab() {
  const [sellerFilter, setSellerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const sellersQuery = useSellers();
  const ordersQuery = useOrdersList({
    seller: sellerFilter === "" ? undefined : sellerFilter,
    status: statusFilter === "ALL" ? undefined : statusFilter,
    page,
    size: PAGE_SIZE,
  });
  const orderDetailQuery = useOrderDetail(selectedId);
  const cancelOrder = useCancelOrder();
  const importOrders = useImportOrders();

  const ordersPage = ordersQuery.data;
  const order = orderDetailQuery.data ?? null;

  const handleSellerFilterChange = useCallback((code: string) => {
    setSellerFilter(code);
    setPage(0);
  }, []);

  const handleStatusFilterChange = useCallback((status: OrderStatus | "ALL") => {
    setStatusFilter(status);
    setPage(0);
  }, []);

  const handleCancel = useCallback(() => {
    if (selectedId === null) return;
    cancelOrder.mutate(selectedId, {
      onSuccess: () => {
        toast.success("주문 취소 완료", w98Toast.success);
      },
      onError: (error) => {
        toast.error("주문 취소에 실패했습니다", { ...w98Toast.notice, description: error.message });
      },
    });
  }, [selectedId, cancelOrder]);

  const handleImportSubmit = useCallback(
    (input: {
      sellerCode: string;
      receiptNo: string;
      regionCode: string;
      items: { gtin: string; qty: number }[];
      cutoffAt: string;
    }) => {
      importOrders.mutate(
        {
          batchId: `WEB-${Date.now()}`,
          sellerCode: input.sellerCode,
          orders: [
            {
              receiptNo: input.receiptNo,
              regionCode: input.regionCode,
              orderedAt: new Date().toISOString(),
              cutoffAt: input.cutoffAt === "" ? undefined : new Date(input.cutoffAt).toISOString(),
              items: input.items,
            },
          ],
        },
        {
          onSuccess: (data) => {
            if (data.rejected.length === 0) {
              toast.success("주문 접수 완료", w98Toast.success);
            } else {
              toast.error(`접수 거부 — ${data.rejected[0]?.reason ?? ""}`, w98Toast.notice);
            }
          },
          onError: (error) => {
            toast.error("접수 요청에 실패했습니다", { ...w98Toast.notice, description: error.message });
          },
        },
      );
    },
    [importOrders],
  );

  const isCancellable =
    order !== null && CANCELLABLE_ORDER_STATUSES.includes(order.status);

  return (
    <div className="relative flex min-h-0 flex-1 gap-2">
      <OrderListPanel
        items={ordersPage?.content ?? []}
        isLoading={ordersQuery.isLoading}
        errorMessage={ordersQuery.error?.message ?? null}
        sellers={sellersQuery.data}
        sellerFilter={sellerFilter}
        onSellerFilterChange={handleSellerFilterChange}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        selectedId={selectedId}
        onSelect={setSelectedId}
        page={ordersPage?.number ?? page}
        totalPages={ordersPage?.totalPages ?? 0}
        onPageChange={setPage}
        className="w-[320px] shrink-0"
      />

      <OrderDetailPanel
        order={order}
        isLoading={orderDetailQuery.isLoading}
        errorMessage={orderDetailQuery.error?.message ?? null}
        isCancellable={isCancellable}
        onCancel={handleCancel}
        isCancelling={cancelOrder.isPending}
        cancelErrorMessage={
          cancelOrder.error instanceof ApiError ? cancelOrder.error.message : null
        }
      />

      <OrderImportPanel
        sellers={sellersQuery.data}
        isSubmitting={importOrders.isPending}
        onSubmit={handleImportSubmit}
        result={importOrders.data ?? null}
        errorMessage={importOrders.error?.message ?? null}
        className="w-[340px] shrink-0"
      />
    </div>
  );
}
