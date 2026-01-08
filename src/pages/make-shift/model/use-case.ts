import type {EditDutyUseCase} from '@/features/shift/editDuty/model/use-case';
import {AbstractUseCase} from '@/shared/abstract/abstract-use-case';
import type {MakeShiftStep} from './store';
import type {MakeShiftFlowStore} from './store';

export class MakeShiftFlowUseCase extends AbstractUseCase {
    constructor(
        private readonly _store: MakeShiftFlowStore,
        private readonly _editDutyUseCase: EditDutyUseCase,
    ) {
        super();
    }

    start(): void {
        this._doAction(() => {
            this._store.startFromStep1();
        });
    }

    confirmRestoreDraft(): void {
        this._doAction(() => {
            this._store.confirmRestoreDraft();
            this._editDutyUseCase.restoreDraftForWard();
        });
    }

    closeRestoreDraftModal(): void {
        this._doAction(() => {
            this._store.closeRestoreDraftModal();
        });
    }

    declineRestoreDraft(): void {
        this._doAction(() => {
            this._store.declineRestoreDraft();
            // "새로 시작"을 택한 경우 기존 draft는 제거한다.
            this._editDutyUseCase.clearDraftForWard();
        });
    }

    complete(): void {
        this._doAction(() => {
            this._editDutyUseCase.clearDraftForWard();
            this._store.resetToOverview();
        });
    }

    prev(): void {
        this._doAction(() => {
            this._store.goPrev();
        });
    }

    next(): void {
        this._doAction(() => {
            this._store.goNext();
        });
    }

    goToStep(step: MakeShiftStep): void {
        this._doAction(() => {
            this._store.goToStep(step);
        });
    }
}
