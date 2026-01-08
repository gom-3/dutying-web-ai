import {computed, makeObservable, observable} from 'mobx';
import type {EditDutyStore} from '@/features/shift/editDuty/model/store';
import {AbstractStore} from '@/shared/abstract';

export type MakeShiftStep = 1 | 2 | 3 | 4 | 5;

type FlowPhase = 'overview' | 'stepping';

/**
 * make-shift 플로우의 스텝 진행 상태만 담당한다.
 * - step1 진입 시 draft 존재하면 복구 모달을 띄우는 트리거 제공
 * - 실제 근무표 편집 로직은 Step5(에디터) 및 개별 step widget로 위임
 */
export class MakeShiftFlowStore extends AbstractStore {
    private _phase!: FlowPhase;
    private _currentStep!: MakeShiftStep;

    // draft restore flow
    private _restoreDraftModalOpen!: boolean;
    private _shouldRestoreDraft!: boolean;

    constructor(private readonly _editDutyStore: EditDutyStore) {
        super();

        this.init();

        const observableMap = {
            _phase: observable,
            _currentStep: observable,
            _restoreDraftModalOpen: observable,
            _shouldRestoreDraft: observable,
            phase: computed,
            currentStep: computed,
            restoreDraftModalOpen: computed,
            draftExists: computed,
            shouldRestoreDraft: computed,
        };

        makeObservable(this, observableMap);
    }

    override init(): void {
        this._phase = 'overview';
        this._currentStep = 1;
        this._restoreDraftModalOpen = false;
        this._shouldRestoreDraft = false;
    }

    get phase(): FlowPhase {
        return this._phase;
    }

    get currentStep(): MakeShiftStep {
        return this._currentStep;
    }

    get restoreDraftModalOpen(): boolean {
        return this._restoreDraftModalOpen;
    }

    get draftExists(): boolean {
        return this._editDutyStore.draftExists;
    }

    get shouldRestoreDraft(): boolean {
        return this._shouldRestoreDraft;
    }

    /** "근무표 생성" 클릭 시 호출 */
    startFromStep1(): void {
        this._phase = 'stepping';
        this._currentStep = 1;
        this._shouldRestoreDraft = false;

        if (this._editDutyStore.draftExists) this._restoreDraftModalOpen = true;
    }

    confirmRestoreDraft(): void {
        this._restoreDraftModalOpen = false;
        this._shouldRestoreDraft = true;
    }

    declineRestoreDraft(): void {
        this._restoreDraftModalOpen = false;
        this._shouldRestoreDraft = false;
    }

    closeRestoreDraftModal(): void {
        this._restoreDraftModalOpen = false;
    }

    canGoPrev(): boolean {
        return this._phase === 'stepping' && this._currentStep > 1;
    }

    canGoNext(): boolean {
        if (this._phase !== 'stepping') return false;

        // 준비 작업 단계: 상세 검증은 각 step widget에서 확장
        return this._currentStep < 5;
    }

    goPrev(): void {
        if (!this.canGoPrev()) return;

        this._currentStep = (this._currentStep - 1) as MakeShiftStep;
    }

    goNext(): void {
        if (!this.canGoNext()) return;

        this._currentStep = (this._currentStep + 1) as MakeShiftStep;
    }

    goToStep(step: MakeShiftStep): void {
        // 선형 정책: 현재보다 미래 step으로 점프는 막는다(향후 unlock 정책으로 확장)
        if (this._phase !== 'stepping') return;

        if (step > this._currentStep) return;

        this._currentStep = step;
    }

    resetToOverview(): void {
        this._phase = 'overview';
        this._currentStep = 1;
        this._restoreDraftModalOpen = false;
        this._shouldRestoreDraft = false;
    }
}
