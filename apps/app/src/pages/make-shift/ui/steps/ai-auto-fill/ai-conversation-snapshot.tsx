import * as Dialog from '@radix-ui/react-dialog';
import {useMemo, useState} from 'react';
import i18n from '@/i18n';
import {buildConversationSnapshot} from '../../../model/conversation-snapshot';
import type {TResultVersion} from '../../../model/schedule-conversation-api';
import {MakeShiftCalendar} from '../shared/make-shift-calendar';

type TProps = {
    version: TResultVersion;
    before?: TResultVersion;
    disabled: boolean;
    onClose: () => void;
    onContinue: (version: TResultVersion) => void;
};

export default function AiConversationSnapshot({version, before, disabled, onClose, onContinue}: TProps) {
    const [showBefore, setShowBefore] = useState(false);
    const ko = i18n.language.startsWith('ko');
    const copy = (korean: string, english: string) => (ko ? korean : english);
    const selected = showBefore && before ? before : version;
    const {shift, doc} = useMemo(() => buildConversationSnapshot(selected), [selected]);
    const violations = useMemo(() => new Map(), []);

    return (
        <Dialog.Root
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[1500] bg-black/20" />
                <Dialog.Content
                    className="text-gray-1 fixed inset-0 z-[1501] flex flex-col bg-white outline-none"
                    onKeyDown={(event) => event.stopPropagation()}
                    onPaste={(event) => event.stopPropagation()}
                >
                    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-gray-6 px-6 py-4">
                        <div>
                            <Dialog.Title className="text-xl font-semibold">
                                {selected.year}
                                {copy('년 ', ' / ')}
                                {selected.month}
                                {copy('월 근무표', ' schedule')}
                            </Dialog.Title>
                            <Dialog.Description className="text-sm text-gray-4">
                                {copy('읽기 전용 스냅샷', 'Read-only snapshot')} ·{' '}
                                {showBefore ? copy('실행 전', 'Before') : copy('실행 결과', 'Result')}
                            </Dialog.Description>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {before && (
                                <div role="group" aria-label={copy('전후 비교', 'Compare')} className="flex gap-2">
                                    <button
                                        type="button"
                                        aria-pressed={showBefore}
                                        onClick={() => setShowBefore(true)}
                                        className="rounded-lg border border-gray-5 px-3 py-2 text-sm aria-pressed:bg-main-light"
                                    >
                                        {copy('실행 전', 'Before')}
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={!showBefore}
                                        onClick={() => setShowBefore(false)}
                                        className="rounded-lg border border-gray-5 px-3 py-2 text-sm aria-pressed:bg-main-light"
                                    >
                                        {copy('실행 결과', 'Result')}
                                    </button>
                                </div>
                            )}
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => onContinue(selected)}
                                className="rounded-lg bg-main-1 px-4 py-2 text-sm text-white disabled:opacity-40"
                            >
                                {copy('이 표에서 이어서 작성', 'Continue from this result')}
                            </button>
                            <button type="button" onClick={onClose} className="rounded-lg border border-gray-5 px-3 py-2 text-sm">
                                {copy('미리보기 닫기', 'Close preview')}
                            </button>
                        </div>
                    </header>
                    <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
                        <div className="[container-type:inline-size] min-w-[1000px]">
                            <MakeShiftCalendar
                                shift={shift}
                                doc={doc}
                                violationMap={violations}
                                showFaults={false}
                                readonly
                                staticPreview
                                borderlessPreview
                                showCellStatusPins
                                showDivisionHeaders
                                showDivisionStatistics
                                nurseNameMaxChars={5}
                            />
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
