import {useCallback} from 'react';
import {createPortal} from 'react-dom';
import {useMakeShiftStore} from '../model/store';
import {useMakeShiftUseCase} from '../model/use-case';

export const RestoreDraftModal = () => {
    const root = document.getElementById('modal-root')!;
    const restoreDraftModalOpen = useMakeShiftStore((s) => s.restoreDraftModalOpen);
    const useCase = useMakeShiftUseCase();

    if (!restoreDraftModalOpen) {
        return null;
    }

    const handleClose = useCallback(() => {
        useCase.closeRestoreDraftModal();
    }, [useCase]);
    const handleConfirm = useCallback(() => {
        useCase.confirmRestoreDraft();
    }, [useCase]);
    const handleDecline = useCallback(() => {
        useCase.declineRestoreDraft();
    }, [useCase]);

    return createPortal(
        <div className="fixed inset-0 z-1000 flex items-center justify-center bg-black/40 px-4" onClick={handleClose}>
            <div className="w-full max-w-[420px] rounded-xl bg-white p-5 shadow-shadow-3" onClick={(e) => e.stopPropagation()}>
                <p className="font-apple text-lg font-semibold text-sub-1">편집하던 내용을 불러올까요?</p>
                <p className="mt-2 font-apple text-sm text-sub-3">
                    이전에 작성하던 근무표 초안이 남아있습니다. 확인을 누르면 이어서 작성할 수 있어요.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                    <button className="h-9 rounded-lg bg-sub-5 px-3 font-apple text-sm text-sub-2.5" onClick={handleDecline} type="button">
                        새로 시작
                    </button>
                    <button className="h-9 rounded-lg bg-main-2 px-3 font-apple text-sm text-white" onClick={handleConfirm} type="button">
                        불러오기
                    </button>
                </div>
            </div>
        </div>,
        root,
    );
};
