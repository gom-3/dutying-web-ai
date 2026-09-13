import type {TScheduleAdjustInterpretRes, TScheduleMonthRequestRes} from '@dutying/api/ward';
import * as Dialog from '@radix-ui/react-dialog';
import {X} from 'lucide-react';
import type {Ref} from 'react';
import aiAutofillSparkleIcon from '@/shared/assets/images/ai-autofill-sparkle.png';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import type {TInterpretCardItem} from '../../../model/schedule-month-requests';
import AiAdjustExamples from './ai-adjust-examples';
import AiAdjustTextInput, {type TAdjustTextInputHandle} from './ai-adjust-text-input';
import AiMonthRequestList from './ai-month-request-list';

type TProps = {
    open: boolean;
    onClose: () => void;
    /** 조절 없이 그대로 다시 생성한다. 방향을 말하지 않고 한 번 더 돌려 보는 것이 가장 흔한 경로다. */
    onRegenerate: () => void;
    disabled: boolean;
    textInputRef: Ref<TAdjustTextInputHandle>;
    /** 예시를 누르면 입력창에 채워질 뿐 바로 실행되지 않는다. */
    onPickExample: (sentence: string) => void;
    interpret: (text: string) => Promise<TScheduleAdjustInterpretRes>;
    onApply: (items: TInterpretCardItem[], requestText: string) => void;
    requests: TScheduleMonthRequestRes[];
    disablingRequestId: number | null;
    onDisableRequest: (request: TScheduleMonthRequestRes) => void;
};

/**
 * "다시 생성"을 누르면 먼저 여기부터 묻는다 — 그냥 한 번 더 돌릴지, 방향을 말하고 돌릴지.
 *
 * 조절은 근무표를 다시 만드는 순간에만 쓰는 도구인데, 예시·입력창·요청 목록을 표 위에
 * 늘 펼쳐 두면 정작 봐야 할 표가 밀린다. 그래서 상시 노출을 걷어내고 이 대화상자로 모았다.
 * 실제로 다시 푸는 순간에는 대화상자를 닫는다 — 결과는 표에서 봐야 하고, 무엇이 바뀌었는지는
 * 표 위의 결과 한 줄(AiAdjustResultNote)이 이어서 말해 준다.
 */
export default function AiAdjustDialog({
    open,
    onClose,
    onRegenerate,
    disabled,
    textInputRef,
    onPickExample,
    interpret,
    onApply,
    requests,
    disablingRequestId,
    onDisableRequest,
}: TProps) {
    const {t} = useTypedTranslation();
    const portalContainer = typeof document === 'undefined' ? undefined : (document.getElementById('modal-root') ?? document.body);

    return (
        <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <Dialog.Portal container={portalContainer}>
                <Dialog.Overlay className="fixed inset-0 z-[1100] bg-[#111827]/58 p-3 sm:p-5" />
                <Dialog.Content className="fixed top-1/2 left-1/2 z-[1101] flex max-h-[calc(100vh-24px)] w-[calc(100vw-24px)] max-w-[720px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[26px] bg-white sm:max-h-[calc(100vh-40px)] sm:rounded-[30px]">
                    <div className="shrink-0 bg-[#FAF8FF] px-5 pt-5 pb-4 sm:px-7 sm:pt-6 sm:pb-5">
                        <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <Dialog.Title className="font-apple text-[22px] leading-7 font-semibold tracking-[-0.025em] text-sub-1 sm:text-[25px] sm:leading-8">
                                    {t('page.makeShift.aiRefill.adjust.dialog.title')}
                                </Dialog.Title>
                                <Dialog.Description className="mt-1.5 font-apple text-[14px] leading-5.5 whitespace-pre-line text-gray-3 sm:text-[15px] sm:leading-6">
                                    {t('page.makeShift.aiRefill.adjust.dialog.description')}
                                </Dialog.Description>
                            </div>
                            <Dialog.Close asChild>
                                <button
                                    type="button"
                                    className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-gray-7 text-gray-3 transition-colors hover:bg-gray-6 focus-visible:bg-main-1 focus-visible:text-white focus-visible:outline-none"
                                    aria-label={t('shared.confirmActionDialog.close')}
                                >
                                    <X className="size-4" strokeWidth={2.2} />
                                </button>
                            </Dialog.Close>
                        </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto bg-white py-4">
                        <AiAdjustExamples disabled={disabled} onPick={onPickExample} />
                        <AiAdjustTextInput ref={textInputRef} disabled={disabled} interpret={interpret} onApply={onApply} />
                        <AiMonthRequestList
                            requests={requests}
                            disabled={disabled}
                            disablingRequestId={disablingRequestId}
                            onDisable={onDisableRequest}
                        />
                    </div>

                    <div className="flex shrink-0 items-center justify-end gap-2 bg-[#F8F7FB] px-5 py-4 sm:px-7 sm:py-5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-gray-2 inline-flex min-h-11 cursor-pointer items-center rounded-[11px] bg-gray-7 px-4 font-apple text-[14px] font-semibold transition-colors hover:bg-gray-6"
                        >
                            {t('page.makeShift.aiRefill.adjust.dialog.close')}
                        </button>
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={onRegenerate}
                            className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[13px] bg-[linear-gradient(90deg,#C241F4_0%,#6B45F4_100%)] px-6 font-apple text-[13px] leading-none font-bold whitespace-nowrap text-white transition-[filter] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <img src={aiAutofillSparkleIcon} alt="" aria-hidden className="size-4 shrink-0 object-contain" />
                            {t('page.makeShift.aiRefill.adjust.dialog.regenerate')}
                        </button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
