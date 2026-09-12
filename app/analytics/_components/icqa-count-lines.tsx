"use client";

/**
 * 블라인드 카운트 표 — `icqa-count-dialog.tsx`의 `lines` 단계(정본 §10.1·§10.4).
 *
 * 시작 응답의 라인(화주·상품·로트·상태, 전산 수량 없음)마다 수량 입력칸 하나. "없는 품목
 * 추가"로 스냅샷에 없는 키(전산 0)도 같은 표에 더해 입력할 수 있다(정본 §10.1 "스냅샷에 없는
 * 키도 입력할 수 있다"). 미입력 라인은 0으로 보내 제출한다(정본 §10.3 "미입력 라인은 counted
 * 0") — 빈 칸과 명시적 0 입력을 구분하지 않는다.
 */

import { useState } from "react";
import type { CountTaskBlindLine, StockStatus, SubmitCountTaskLine } from "@/lib/types";
import { useSellers } from "../_data/use-master";
import { Btn, Field, Select, Sunken, w98 } from "./win98-ui";

const STATUS_LABEL: Record<StockStatus, string> = {
  AVAILABLE: "정상",
  HOLD: "보류",
  DAMAGED: "파손",
};

interface AddedLine {
  key: string;
  sellerCode: string;
  gtin: string;
  lotNo: string;
  status: StockStatus;
}

function lineKey(sellerCode: string, gtin: string, lotNo: string, status: string): string {
  return `${sellerCode}|${gtin}|${lotNo}|${status}`;
}

export function IcqaCountLines({
  blindLines,
  isSubmitting,
  errorMessage,
  onCancel,
  onSubmit,
}: {
  blindLines: CountTaskBlindLine[];
  isSubmitting: boolean;
  errorMessage: string | null;
  onCancel: () => void;
  onSubmit: (lines: SubmitCountTaskLine[]) => void;
}) {
  const { data: sellers } = useSellers();
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [addedLines, setAddedLines] = useState<AddedLine[]>([]);

  const [addSeller, setAddSeller] = useState("");
  const [addGtin, setAddGtin] = useState("");
  const [addLot, setAddLot] = useState("");
  const [addStatus, setAddStatus] = useState<StockStatus>("AVAILABLE");

  const addLine = () => {
    if (addSeller === "" || addGtin.trim() === "" || addLot.trim() === "") return;
    const key = lineKey(addSeller, addGtin.trim(), addLot.trim(), addStatus);
    setAddedLines((prev) => (prev.some((l) => l.key === key) ? prev : [...prev, { key, sellerCode: addSeller, gtin: addGtin.trim(), lotNo: addLot.trim(), status: addStatus }]));
    setAddGtin("");
    setAddLot("");
  };

  const removeAdded = (key: string) => {
    setAddedLines((prev) => prev.filter((l) => l.key !== key));
    setCounts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const submit = () => {
    const lines: SubmitCountTaskLine[] = [
      ...blindLines.map((line) => {
        const key = lineKey(line.sellerCode, line.gtin, line.lotNo, line.status);
        const parsed = Number.parseInt(counts[key] ?? "0", 10);
        return {
          sellerCode: line.sellerCode,
          gtin: line.gtin,
          lotNo: line.lotNo,
          status: line.status,
          countedQty: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
        };
      }),
      ...addedLines.map((line) => {
        const parsed = Number.parseInt(counts[line.key] ?? "0", 10);
        return {
          sellerCode: line.sellerCode,
          gtin: line.gtin,
          lotNo: line.lotNo,
          status: line.status,
          countedQty: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0,
        };
      }),
    ];
    onSubmit(lines);
  };

  return (
    <>
      <div className="flex max-h-[65vh] flex-col gap-2 overflow-y-auto p-3">
        <Sunken className={`${w98.scroll} max-h-[280px] overflow-y-auto`}>
          <table className="w-full border-collapse text-left text-[13px]">
            <thead className="sticky top-0 bg-[color:var(--surface)]">
              <tr>
                <th className={`${w98.titleText} border-b border-[color:var(--border)] p-1.5`}>화주</th>
                <th className={`${w98.titleText} border-b border-[color:var(--border)] p-1.5`}>상품</th>
                <th className={`${w98.titleText} border-b border-[color:var(--border)] p-1.5`}>로트</th>
                <th className={`${w98.titleText} border-b border-[color:var(--border)] p-1.5`}>상태</th>
                <th className={`${w98.titleText} border-b border-[color:var(--border)] p-1.5 text-right`}>수량</th>
                <th className={`${w98.titleText} border-b border-[color:var(--border)] p-1.5`} />
              </tr>
            </thead>
            <tbody>
              {blindLines.length === 0 && addedLines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-3 text-[color:var(--muted-foreground)]">
                    이 칸에 스냅샷 라인이 없습니다. &ldquo;없는 품목 추가&rdquo;로 입력하세요.
                  </td>
                </tr>
              ) : (
                <>
                  {blindLines.map((line) => {
                    const key = lineKey(line.sellerCode, line.gtin, line.lotNo, line.status);
                    return (
                      <tr key={key} className="border-t border-[color:var(--border)]">
                        <td className={`${w98.mono} p-1.5`}>{line.sellerCode}</td>
                        <td className="p-1.5">
                          {line.name}
                          <span className={`${w98.mono} block text-[11px] text-[color:var(--muted-foreground)]`}>
                            {line.gtin}
                          </span>
                        </td>
                        <td className={`${w98.mono} p-1.5`}>{line.lotNo}</td>
                        <td className="p-1.5">{STATUS_LABEL[line.status]}</td>
                        <td className="p-1.5 text-right">
                          <Field
                            value={counts[key] ?? ""}
                            onChange={(e) => setCounts((prev) => ({ ...prev, [key]: e.target.value }))}
                            placeholder="0"
                            inputMode="numeric"
                            className="h-6 w-20 text-right text-[13px]"
                            mono
                          />
                        </td>
                        <td className="p-1.5" />
                      </tr>
                    );
                  })}
                  {addedLines.map((line) => (
                    <tr key={line.key} className="border-t border-[color:var(--border)] bg-[color:var(--surface-variant)]">
                      <td className={`${w98.mono} p-1.5`}>{line.sellerCode}</td>
                      <td className={`${w98.mono} p-1.5`}>{line.gtin}</td>
                      <td className={`${w98.mono} p-1.5`}>{line.lotNo}</td>
                      <td className="p-1.5">{STATUS_LABEL[line.status]}</td>
                      <td className="p-1.5 text-right">
                        <Field
                          value={counts[line.key] ?? ""}
                          onChange={(e) => setCounts((prev) => ({ ...prev, [line.key]: e.target.value }))}
                          placeholder="0"
                          inputMode="numeric"
                          className="h-6 w-20 text-right text-[13px]"
                          mono
                        />
                      </td>
                      <td className="p-1.5">
                        <Btn onClick={() => removeAdded(line.key)} className="h-6 px-2 text-[11px]">
                          제거
                        </Btn>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </Sunken>

        {/* 없는 품목 추가 — 스냅샷에 없는 키(전산 0) */}
        <div className={`${w98.raised} flex flex-wrap items-end gap-2 bg-[color:var(--surface)] p-2`}>
          <span className={`${w98.small} w-full font-bold`}>없는 품목 추가</span>
          <label className="flex flex-col gap-0.5 text-[12px]">
            화주
            <Select value={addSeller} onChange={(e) => setAddSeller(e.target.value)} className="h-6 w-[120px] text-[12px]">
              <option value="">선택</option>
              {sellers?.map((s) => (
                <option key={s.id} value={s.code}>
                  {s.code}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-0.5 text-[12px]">
            GTIN
            <Field value={addGtin} onChange={(e) => setAddGtin(e.target.value)} className="h-6 w-[130px] text-[12px]" mono />
          </label>
          <label className="flex flex-col gap-0.5 text-[12px]">
            로트
            <Field value={addLot} onChange={(e) => setAddLot(e.target.value)} className="h-6 w-[100px] text-[12px]" mono />
          </label>
          <label className="flex flex-col gap-0.5 text-[12px]">
            상태
            <Select value={addStatus} onChange={(e) => setAddStatus(e.target.value as StockStatus)} className="h-6 w-[90px] text-[12px]">
              <option value="AVAILABLE">정상</option>
              <option value="HOLD">보류</option>
              <option value="DAMAGED">파손</option>
            </Select>
          </label>
          <Btn
            onClick={addLine}
            disabled={addSeller === "" || addGtin.trim() === "" || addLot.trim() === ""}
            className="h-6 px-3 text-[12px] font-bold"
          >
            추가
          </Btn>
        </div>

        {errorMessage ? (
          <div
            role="alert"
            className={`${w98.sunken} ${w98.small} bg-[#ffdad6] p-2 font-bold text-[color:var(--status-error)]`}
          >
            {errorMessage}
          </div>
        ) : null}
      </div>

      <div className="flex justify-end gap-2 border-t-2 border-[color:var(--surface-dim)] p-2">
        <Btn disabled={isSubmitting} onClick={submit} className="h-7 w-24 font-bold">
          {isSubmitting ? "제출 중…" : "제출"}
        </Btn>
        <Btn onClick={onCancel} className="h-7 w-24">
          취소
        </Btn>
      </div>
    </>
  );
}
