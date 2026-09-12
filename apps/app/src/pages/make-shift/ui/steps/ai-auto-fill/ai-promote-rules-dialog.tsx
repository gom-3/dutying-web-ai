import type {TScheduleMonthRequestRes} from '@dutying/api/ward';
import {cn} from '@dutying/utils/style';
import {useEffect, useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import ConfirmActionDialog from '@/shared/ui/ConfirmActionDialog';

type TProps = {
    open: boolean;
    /** 이번 달에 문장으로 건 규칙 중 아직 승격되지 않은 것. */
    candidates: TScheduleMonthRequestRes[];
    onClose: () => void;
    onConfirm: (requestIds: number[]) => void;
};

/**
 * 확정 직전에 한 번 묻는다 — "이 규칙, 다음 달에도 쓸까요?"
 *
 * 전부 미선택으로 시작한다. 문장으로 건 규칙은 그 달의 사정인 경우가 대부분이고, 기본
 * 선택이면 사용자가 만든 적 없는 제약조건이 다음 달에 나타난다. 제약조건 화면을 오염시키지
 * 않는다는 약속이 거기서 깨진다.
 *
 * 아무것도 안 고르고 확정하는 것이 정상 경로다 — 그때 규칙은 이번 달로 끝난다.
 * 자동 승격(3개월 반복 감지 같은 것)은 여전히 하지 않는다.
 */
export default function AiPromoteRulesDialog({open, candidates, onClose, onConfirm}: TProps) {
    const {t} = useTypedTranslation();
    const [selected, setSelected] = useState<Set<number>>(() => new Set());

    useEffect(() => {
        // 다이얼로그를 다시 열 때마다 미선택으로 돌아간다. 지난번 선택이 남아 있으면
        // 사용자가 보지 않은 체크가 그대로 승격된다.
        if (open) setSelected(new Set());
    }, [open]);

    const toggle = (id: number, on: boolean) => {
        setSelected((current) => {
            const next = new Set(current);

            if (on) next.add(id);
            else next.delete(id);

            return next;
        });
    };

    return (
        <ConfirmActionDialog
            open={open}
            title={t('page.makeShift.aiRefill.adjust.promote.title')}
            description={
                /* ConfirmActionDialog 의 설명은 <p> 안에 들어간다(Radix Dialog.Description).
                   ul·li·div 는 <p> 안에서 유효하지 않아 브라우저가 문단을 조기에 닫아 버린다 —
                   레이아웃이 조용히 깨지므로 phrasing content(span·button)만 쓴다. */
                <span className="flex flex-col gap-2 text-left">
                    <span className="text-13 text-sub">{t('page.makeShift.aiRefill.adjust.promote.description')}</span>
                    <span className="flex flex-col gap-1">
                        {candidates.map((candidate) => {
                            const isSelected = selected.has(candidate.id);

                            return (
                                <span key={candidate.id} className="flex flex-wrap items-center gap-2">
                                    <span className="text-13 flex-1">{candidate.displayLabel}</span>
                                    <span role="group" aria-label={candidate.displayLabel} className="flex gap-1">
                                        <button
                                            type="button"
                                            aria-pressed={isSelected}
                                            onClick={() => toggle(candidate.id, true)}
                                            className={cn(
                                                'text-12 rounded-full border px-2 py-0.5 transition-colors',
                                                isSelected
                                                    ? 'border-primary bg-primary/10 font-semibold text-primary'
                                                    : 'border-line text-sub hover:bg-sub-bg',
                                            )}
                                        >
                                            {t('page.makeShift.aiRefill.adjust.promote.keep')}
                                        </button>
                                        <button
                                            type="button"
                                            aria-pressed={!isSelected}
                                            onClick={() => toggle(candidate.id, false)}
                                            className={cn(
                                                'text-12 rounded-full border px-2 py-0.5 transition-colors',
                                                !isSelected
                                                    ? 'border-primary bg-primary/10 font-semibold text-primary'
                                                    : 'border-line text-sub hover:bg-sub-bg',
                                            )}
                                        >
                                            {t('page.makeShift.aiRefill.adjust.promote.discard')}
                                        </button>
                                    </span>
                                </span>
                            );
                        })}
                    </span>
                </span>
            }
            confirmLabel={t('page.makeShift.aiRefill.adjust.promote.confirm')}
            cancelLabel={t('page.makeShift.aiRefill.adjust.promote.cancel')}
            onClose={onClose}
            onConfirm={() => onConfirm([...selected])}
        />
    );
}
