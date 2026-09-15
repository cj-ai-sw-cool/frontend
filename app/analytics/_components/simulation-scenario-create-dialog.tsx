"use client";

/**
 * "새 시나리오" Dialog — 상단 시나리오 목록 위 버튼(정본 §16.6, §16.3 params 표).
 * `slotting-params-edit-dialog.tsx` 와 같은 골격: 뮤테이션 훅은 `DialogContent` 안에서만
 * 만든다(코딩 규칙) — 닫힐 때 언마운트되어 다음에 열면 폼이 기본값으로 다시 시작한다.
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { simulationScenarioId, type CreateSimulationScenarioRequest, type OrderProfileKind } from "@/lib/types";
import { useCreateScenario } from "../_data/use-simulation-mutations";
import { Btn, Checkbox, Field, Select, w98 } from "./win98-ui";

/** 폼 전용 값 — 전부 채워서 보낸다(라이브 시나리오의 `params` 는 전부 null 허용이라
 * "비우면 센터 기본값 상속"이 뜻이지만(`lib/types.ts` `SimulationScenarioParams` 머리말),
 * 이 폼에는 "비워 두기" UI 가 없어 항상 값을 다 채운 요청을 보낸다). */
interface ScenarioFormParams {
  durationHours: number;
  orderProfile: OrderProfileKind;
  pickers: number;
  rebinners: number;
  packers: number;
  batchSize: number;
  totes: number;
  packStations: number;
  rebinSlots: number;
  waveIntervalMin: number;
  applySlotting: boolean;
  seed: number;
}

/** 정본 §16.3 params 표 기본값 */
const DEFAULT_PARAMS: ScenarioFormParams = {
  durationHours: 24,
  orderProfile: "default",
  pickers: 22,
  rebinners: 8,
  packers: 45,
  batchSize: 50,
  totes: 600,
  packStations: 45,
  rebinSlots: 1200,
  waveIntervalMin: 15,
  applySlotting: false,
  seed: 20260915,
};

const PROFILE_OPTIONS: { value: OrderProfileKind; label: string }[] = [
  { value: "default", label: "기본(피크 20~23시)" },
  { value: "flat", label: "평탄" },
  { value: "custom", label: "사용자 정의 24칸" },
];

export function SimulationScenarioCreateDialog({
  open,
  onOpenChange,
  center,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  center: string;
  onCreated: (scenarioId: number) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={`${w98.dialogTheme} ${w98.raised} w-[520px] max-w-none gap-0 rounded-none border-0 p-[3px] shadow-[3px_3px_0_0_rgba(0,0,0,0.35)] sm:max-w-none`}
      >
        <DialogHeader
          className={`${w98.titleText} h-6 flex-row items-center gap-1 space-y-0 bg-[color:var(--title-navy)] px-1 text-[color:var(--primary-foreground)]`}
        >
          <DialogTitle className={w98.titleText}>새 시나리오</DialogTitle>
          <DialogDescription className="sr-only">
            가상 시간·유입 프로파일·자원 수를 입력해 시뮬레이션 시나리오를 만듭니다.
          </DialogDescription>
        </DialogHeader>
        <DialogBody center={center} onClose={() => onOpenChange(false)} onCreated={onCreated} />
      </DialogContent>
    </Dialog>
  );
}

function DialogBody({
  center,
  onClose,
  onCreated,
}: {
  center: string;
  onClose: () => void;
  onCreated: (scenarioId: number) => void;
}) {
  const createScenario = useCreateScenario(center);
  const [name, setName] = useState("");
  const [params, setParams] = useState<ScenarioFormParams>(DEFAULT_PARAMS);

  const setField = <K extends keyof ScenarioFormParams>(key: K) => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setParams((p) => ({ ...p, [key]: value }));
  };

  const submit = () => {
    if (!name.trim()) return;
    const body: CreateSimulationScenarioRequest = { center, name: name.trim(), params };
    createScenario.mutate(body, {
      onSuccess: (data) => onCreated(simulationScenarioId(data)),
      onSettled: () => onClose(),
    });
  };

  return (
    <>
      <div className="flex max-h-[440px] flex-col gap-3 overflow-y-auto p-3">
        <label className="flex flex-col gap-0.5">
          <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>시나리오 이름</span>
          <Field value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-[13px]" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <NumField label="가상 시간(h)" value={params.durationHours} onChange={setField("durationHours")} />
          <label className="flex flex-col gap-0.5">
            <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>유입 프로파일</span>
            <Select
              value={params.orderProfile}
              onChange={(e) => setParams((p) => ({ ...p, orderProfile: e.target.value as OrderProfileKind }))}
              className="h-8 text-[12px]"
            >
              {PROFILE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </label>
          <NumField label="피커 수" value={params.pickers} onChange={setField("pickers")} />
          <NumField label="리빈 작업자 수" value={params.rebinners} onChange={setField("rebinners")} />
          <NumField label="포장 작업자 수" value={params.packers} onChange={setField("packers")} />
          <NumField label="배치 크기" value={params.batchSize} onChange={setField("batchSize")} />
          <NumField label="토트 수" value={params.totes} onChange={setField("totes")} />
          <NumField label="포장대 수" value={params.packStations} onChange={setField("packStations")} />
          <NumField label="리빈 슬롯 수" value={params.rebinSlots} onChange={setField("rebinSlots")} />
          <NumField label="웨이브 주기(분)" value={params.waveIntervalMin} onChange={setField("waveIntervalMin")} />
          <NumField label="시드" value={params.seed} onChange={setField("seed")} />
        </div>

        <Checkbox
          label="시작 전 슬로팅 제안 적용(§15.6)"
          checked={params.applySlotting}
          onToggle={() => setParams((p) => ({ ...p, applySlotting: !p.applySlotting }))}
        />
      </div>

      {createScenario.error ? (
        <p role="alert" className={`${w98.small} mx-3 mb-2 bg-[#ffdad6] p-2 font-bold text-[color:var(--status-error)]`}>
          {createScenario.error.message}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 border-t-2 border-[color:var(--surface-dim)] p-2">
        <Btn disabled={createScenario.isPending || !name.trim()} onClick={submit} className="h-7 w-24 font-bold">
          {createScenario.isPending ? "생성 중…" : "생성"}
        </Btn>
        <Btn onClick={onClose} disabled={createScenario.isPending} className="h-7 w-20">
          취소
        </Btn>
      </div>
    </>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className={`${w98.small} text-[color:var(--muted-foreground)]`}>{label}</span>
      <Field type="number" mono value={value} onChange={onChange} className="h-8 text-[13px]" />
    </label>
  );
}
