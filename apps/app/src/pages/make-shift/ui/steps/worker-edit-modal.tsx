import * as Dialog from '@radix-ui/react-dialog';
import {X} from 'lucide-react';
import {useCallback, useEffect, useRef, useState} from 'react';
import {type TShiftTeam, type TWardShiftType} from '@/entities';
import useEditShiftTeam from '@/features/edit-shift-team';
import NurseDetailPanel, {type TNurseDetailDraftActions} from '@/pages/member/ui/nurse-detail-panel';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';

type TWorkerEditModalProps = {
    open: boolean;
    onClose: () => void;
    onOpenWardCodeGuide: () => void;
    shiftTeams: TShiftTeam[] | undefined;
    onMoveShiftTeam: (shiftTeamId: number) => Promise<boolean>;
    wardShiftTypes: TWardShiftType[] | undefined;
};

export function WorkerEditModal({open, onClose, onOpenWardCodeGuide, shiftTeams, onMoveShiftTeam, wardShiftTypes}: TWorkerEditModalProps) {
    const {t} = useTypedTranslation();
    const {
        state: {selectedNurse, isNurseDraftDirty},
    } = useEditShiftTeam();
    const [closeGuardOpen, setCloseGuardOpen] = useState(false);
    const draftActionsRef = useRef<TNurseDetailDraftActions | null>(null);
    const lastSelectedNurseIdRef = useRef<number | null>(null);
    const selectedNurseId = selectedNurse?.nurseId ?? null;

    if (selectedNurseId !== null) {
        lastSelectedNurseIdRef.current = selectedNurseId;
    }

    useEffect(() => {
        if (open) return;

        setCloseGuardOpen(false);
        draftActionsRef.current = null;
    }, [open]);

    const closeModal = useCallback(() => {
        setCloseGuardOpen(false);
        onClose();
    }, [onClose]);
    const requestClose = useCallback(
        (hasUnsavedChanges?: boolean) => {
            const shouldConfirmDiscard = hasUnsavedChanges ?? draftActionsRef.current?.hasChanges() ?? isNurseDraftDirty;

            if (shouldConfirmDiscard) {
                setCloseGuardOpen(true);

                return;
            }

            closeModal();
        },
        [closeModal, isNurseDraftDirty],
    );
    const discardAndClose = () => {
        draftActionsRef.current?.discard();
        closeModal();
    };

    return (
        <>
            <Dialog.Root
                open={open}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) requestClose();
                }}
            >
                <Dialog.Portal>
                    <Dialog.Overlay
                        data-worker-edit-backdrop
                        className="fixed inset-0 z-[1000] bg-[#20232B]/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:animate-none"
                        onClick={() => requestClose()}
                    />
                    <Dialog.Content
                        className="fixed top-1/2 left-1/2 z-[1001] flex h-[min(800px,calc(100vh-32px))] w-[min(620px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[24px] bg-white data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none max-sm:h-dvh max-sm:w-screen max-sm:rounded-none"
                        onInteractOutside={(event) => event.preventDefault()}
                        onCloseAutoFocus={(event) => {
                            event.preventDefault();

                            const lastSelectedNurseId = lastSelectedNurseIdRef.current;

                            if (lastSelectedNurseId === null) return;

                            document.querySelector<HTMLElement>(`[data-worker-edit-trigger="${lastSelectedNurseId}"]`)?.focus();
                        }}
                    >
                        <header className="flex shrink-0 items-start justify-between gap-5 px-7 pt-7 pb-4 max-sm:px-5 max-sm:pt-5">
                            <div className="min-w-0">
                                <Dialog.Title className="font-apple text-[24px] leading-[1.35] font-bold tracking-[-0.02em] text-sub-1">
                                    {t('page.makeShift.workers.editModal.title')}
                                </Dialog.Title>
                                <Dialog.Description className="mt-1.5 font-apple text-[14px] leading-5 font-medium text-gray-3">
                                    {t('page.makeShift.workers.editModal.description')}
                                </Dialog.Description>
                            </div>
                            <button
                                type="button"
                                className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-[#F2F4F6] text-gray-3 transition-colors hover:bg-[#E7EAF0] hover:text-sub-1 focus-visible:bg-[#E5DEFF] focus-visible:text-main-1 focus-visible:outline-none"
                                onClick={() => requestClose()}
                                aria-label={t('page.member.detail.close')}
                            >
                                <X aria-hidden="true" className="size-5" strokeWidth={2.4} />
                            </button>
                        </header>
                        <div className="min-h-0 flex-1">
                            <NurseDetailPanel
                                variant="modal"
                                onClose={closeModal}
                                onRequestClose={requestClose}
                                onSaveSuccess={closeModal}
                                onOpenWardCodeGuide={onOpenWardCodeGuide}
                                onRegisterDraftActions={(actions) => {
                                    draftActionsRef.current = actions;
                                }}
                                shiftTeams={shiftTeams}
                                onMoveShiftTeam={onMoveShiftTeam}
                                wardShiftTypes={wardShiftTypes}
                            />
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>

            <Dialog.Root open={closeGuardOpen} onOpenChange={setCloseGuardOpen}>
                <Dialog.Portal>
                    <Dialog.Overlay className="fixed inset-0 z-[1010] bg-[#20232B]/55" />
                    <Dialog.Content className="fixed top-1/2 left-1/2 z-[1011] w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-[24px] bg-white p-7 motion-reduce:animate-none max-sm:p-6">
                        <Dialog.Title className="font-apple text-[22px] leading-[1.4] font-bold tracking-[-0.02em] text-sub-1">
                            {t('page.makeShift.workers.editExit.title')}
                        </Dialog.Title>
                        <Dialog.Description className="mt-2 font-apple text-[15px] leading-6 font-medium text-gray-3">
                            {t('page.makeShift.workers.editExit.description')}
                        </Dialog.Description>
                        <div className="mt-7 grid grid-cols-2 gap-2.5 max-[380px]:grid-cols-1">
                            <button
                                type="button"
                                className="h-12 rounded-[14px] bg-[#F2F4F6] px-3 font-apple text-[15px] font-semibold text-gray-3 transition-colors hover:bg-[#E7EAF0] hover:text-sub-1 focus-visible:bg-[#E5DEFF] focus-visible:text-main-1 focus-visible:outline-none"
                                onClick={() => setCloseGuardOpen(false)}
                            >
                                {t('page.makeShift.workers.editExit.continueEditing')}
                            </button>
                            <button
                                type="button"
                                className="h-12 rounded-[14px] bg-[#FFF0F0] px-3 font-apple text-[15px] font-semibold text-[#C23D3D] transition-colors hover:bg-[#FFE3E3] hover:text-[#A52F2F] focus-visible:bg-[#FFD9D9] focus-visible:text-[#8F2525] focus-visible:outline-none"
                                onClick={discardAndClose}
                            >
                                {t('page.makeShift.workers.editExit.discardAndClose')}
                            </button>
                        </div>
                    </Dialog.Content>
                </Dialog.Portal>
            </Dialog.Root>
        </>
    );
}
