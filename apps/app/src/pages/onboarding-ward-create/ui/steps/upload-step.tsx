import {Upload} from 'lucide-react';
import {useRef} from 'react';
import Card from '@/shared/ui/Card';
import Button from '@/shared/ui/form-controls/Button';
import {Input} from '@/shared/ui/primitives/input';
import {Switch} from '@/shared/ui/primitives/switch';
import type {TOnboardingConstraintDraft, TOnboardingWardDraft} from '../../model';

interface IUploadStepProps {
    draft: TOnboardingWardDraft;
    onUpload: (file: File) => void;
    isUploading: boolean;
    uploadError: string | null;
    uploadWarnings: string[];
    onConstraintToggle: (constraintId: string, selected: boolean) => void;
    onConstraintCountChange: (constraintId: string, count: number) => void;
    onConstraintStaffingCountChange: (constraintId: string, staffingIndex: number, count: number) => void;
}

const CONSTRAINT_TITLES: Record<string, string> = {
    MIN_STAFF_BY_SHIFT: '근무별 최소 인원',
    MAX_CONSECUTIVE_WORK_DAYS: '최대 연속 근무',
    MAX_CONSECUTIVE_N: '최대 연속 나이트',
    MIN_OFF_AFTER_N: '나이트 후 최소 오프',
    FORBID_N_THEN_D: '나이트 다음 데이 금지',
    FORBID_N_THEN_E: '나이트 다음 이브닝 금지',
    FORBID_E_THEN_D: '이브닝 다음 데이 금지',
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
    value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
const asNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const getConfidenceLabel = (confidence: number | null) => (confidence == null ? null : `${Math.round(confidence * 100)}%`);
const getShiftLabel = (value: unknown) => {
    if (typeof value === 'string') return value;

    const shift = asRecord(value);

    return typeof shift?.label === 'string' ? shift.label : typeof shift?.code === 'string' ? shift.code : '';
};

function ConstraintCountInput({
    value,
    disabled,
    ariaLabel,
    onChange,
}: {
    value: number;
    disabled: boolean;
    ariaLabel: string;
    onChange: (value: number) => void;
}) {
    return (
        <Input
            type="number"
            min={1}
            max={100}
            value={value}
            disabled={disabled}
            aria-label={ariaLabel}
            variant="foundation"
            fieldSize="md"
            className="h-9 w-20 rounded-[8px] text-center font-apple text-[15px]"
            onChange={(event) => {
                const nextValue = Number(event.target.value);

                if (Number.isFinite(nextValue)) {
                    onChange(nextValue);
                }
            }}
        />
    );
}

function ConstraintCandidateControls({
    candidate,
    onCountChange,
    onStaffingCountChange,
}: {
    candidate: TOnboardingConstraintDraft;
    onCountChange: (constraintId: string, count: number) => void;
    onStaffingCountChange: (constraintId: string, staffingIndex: number, count: number) => void;
}) {
    const count = asNumber(candidate.params.count);
    const staffing = Array.isArray(candidate.params.staffing) ? candidate.params.staffing : null;

    if (staffing && staffing.length > 0) {
        return (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {staffing.map((item, index) => {
                    const record = asRecord(item);
                    const shiftLabel = getShiftLabel(record?.shift);
                    const staffingCount = asNumber(record?.count) ?? 1;

                    return (
                        <label
                            key={`${candidate.id}-staffing-${index}`}
                            className="flex min-h-10 items-center justify-between gap-2 rounded-[8px] bg-gray-7 px-3 font-apple text-[14px] text-gray-3"
                        >
                            <span className="font-medium text-sub-1">{shiftLabel || '근무'}</span>
                            <ConstraintCountInput
                                value={staffingCount}
                                disabled={!candidate.selected}
                                ariaLabel={`${shiftLabel || '근무'} 최소 인원`}
                                onChange={(value) => onStaffingCountChange(candidate.id, index, value)}
                            />
                        </label>
                    );
                })}
            </div>
        );
    }

    if (count != null) {
        return (
            <label className="mt-3 flex w-fit items-center gap-2 rounded-[8px] bg-gray-7 px-3 py-2 font-apple text-[14px] text-gray-3">
                <span className="font-medium text-sub-1">값</span>
                <ConstraintCountInput
                    value={count}
                    disabled={!candidate.selected}
                    ariaLabel={`${CONSTRAINT_TITLES[candidate.templateCode] ?? candidate.templateCode} 값`}
                    onChange={(value) => onCountChange(candidate.id, value)}
                />
            </label>
        );
    }

    return null;
}

function UploadStep({
    draft,
    onUpload,
    isUploading,
    uploadError,
    uploadWarnings,
    onConstraintToggle,
    onConstraintCountChange,
    onConstraintStaffingCountChange,
}: IUploadStepProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const selectedConstraintCount = draft.constraintCandidates.filter((candidate) => candidate.selected).length;

    return (
        <div className="space-y-6">
            <Card
                variant="muted"
                padding="none"
                className="flex min-h-[204px] flex-col items-center justify-center bg-white px-10 py-[60px]"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                    event.preventDefault();

                    const file = event.dataTransfer.files?.[0];

                    if (file) {
                        onUpload(file);
                    }
                }}
            >
                <p className="font-apple text-[20px] font-medium text-gray-3">근무표 파일을 여기에 놓아 주세요</p>
                <input
                    ref={inputRef}
                    data-testid="upload-input"
                    hidden
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={(event) => {
                        const file = event.target.files?.[0];

                        if (file) {
                            onUpload(file);
                            event.target.value = '';
                        }
                    }}
                />
                <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    className="mt-5 h-10 rounded-[10px] px-4 text-[20px] font-medium enabled:cursor-pointer"
                    disabled={isUploading}
                    onClick={() => inputRef.current?.click()}
                >
                    {isUploading ? '파일 해석 중...' : '파일 업로드'}
                    <Upload className="h-5 w-5" />
                </Button>
            </Card>
            {draft.uploadedFileName ? (
                <Card variant="success" padding="none" className="rounded-[10px] px-5 py-4 font-apple text-[18px]">
                    업로드됨: {draft.uploadedFileName}
                </Card>
            ) : null}
            {draft.constraintCandidates.length > 0 ? (
                <Card padding="none" className="rounded-[10px] border border-[#DDE8F4] bg-white px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <p className="font-apple text-[18px] font-semibold text-sub-1">기존 근무표 제약조건</p>
                            <p className="mt-1 font-apple text-[14px] text-gray-3">{selectedConstraintCount}개 저장 예정</p>
                        </div>
                    </div>
                    <div className="mt-4 space-y-3">
                        {draft.constraintCandidates.map((candidate) => {
                            const confidenceLabel = getConfidenceLabel(candidate.confidence);

                            return (
                                <div
                                    key={candidate.id}
                                    data-testid="constraint-candidate"
                                    className="rounded-[10px] border border-gray-6 bg-[#FAFCFE] px-4 py-3"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-apple text-[16px] font-semibold text-sub-1">
                                                    {CONSTRAINT_TITLES[candidate.templateCode] ?? candidate.templateCode}
                                                </p>
                                                {confidenceLabel ? (
                                                    <span className="rounded-full bg-[#EEF4FF] px-2 py-0.5 font-apple text-[12px] font-medium text-[#315D9E]">
                                                        {confidenceLabel}
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="mt-1 font-apple text-[14px] leading-5 text-gray-3">{candidate.evidenceSummary}</p>
                                            {candidate.riskNote ? (
                                                <p className="mt-1 font-apple text-[13px] leading-5 text-[#8A6A2A]">{candidate.riskNote}</p>
                                            ) : null}
                                        </div>
                                        <Switch
                                            checked={candidate.selected}
                                            onCheckedChange={(checked) => onConstraintToggle(candidate.id, checked)}
                                            aria-label={`${CONSTRAINT_TITLES[candidate.templateCode] ?? candidate.templateCode} 저장 여부`}
                                            className="data-[state=checked]:bg-main-1"
                                        />
                                    </div>
                                    <ConstraintCandidateControls
                                        candidate={candidate}
                                        onCountChange={onConstraintCountChange}
                                        onStaffingCountChange={onConstraintStaffingCountChange}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </Card>
            ) : null}
            {uploadWarnings.length > 0 ? (
                <Card
                    data-testid="upload-warning"
                    padding="none"
                    className="rounded-[10px] border border-[#FFE0A3] bg-[#FFF9EA] px-5 py-4 font-apple text-[16px] text-[#A56600]"
                >
                    <p className="text-[18px] font-semibold">일부 데이터만 반영했어요</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                        {uploadWarnings.map((warning) => (
                            <li key={warning}>{warning}</li>
                        ))}
                    </ul>
                </Card>
            ) : null}
            {uploadError ? (
                <Card
                    data-testid="upload-error"
                    padding="none"
                    className="rounded-[10px] border border-[#F3C6C6] bg-[#FFF5F5] px-5 py-4 font-apple text-[16px] text-[#7A4F4F]"
                >
                    <p className="text-[18px] font-semibold text-[#C55252]">파일 업로드에 실패했어요</p>
                    <p className="mt-2">{uploadError}</p>
                </Card>
            ) : null}
        </div>
    );
}

export default UploadStep;
