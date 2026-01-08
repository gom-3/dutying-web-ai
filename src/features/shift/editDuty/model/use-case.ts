import {AbstractUseCase} from '@/shared/abstract/abstract-use-case';
import {NurseAPI, WardAPI} from '@/shared/api';
import type {WardShiftsDTO} from '@/shared/api/ward/type';
import {
    ClearShiftCommand,
    createDutyValidator,
    DutyEditorState,
    type EditorOp,
    EditorPersistence,
    EditorStore,
    invertOps,
    makeDutyDraftStorageKey,
    MemoryEditorHistory,
    PasteShiftCommand,
    SetShiftCommand,
    type Selection,
    type Violation,
} from '@/shared/editor';
import type {DutyDoc} from '@/shared/editor/duty/doc';
import {moveSelection, type ClipboardPayload} from '@/shared/editor/editor-core';
import type {WardConstraint} from '@/shared/types/ward';
import {type EditDutyStore} from './store';
import {type Focus} from './utils/faults';
import {getPreferredShiftTeamId, setPreferredShiftTeamId} from './utils/prefs';
import {buildDutyDocFromShift} from './utils/shift';

export class EditDutyUseCase extends AbstractUseCase {
    constructor(private readonly _store: EditDutyStore) {
        super();

        this.init();
    }

    init(): void {
        this._doAction(async () => {
            this._store.init();

            const wardId = this._store.wardId;

            if (!wardId) return;

            await this._loadShiftTeams(wardId);

            if (!this._store.currentShiftTeamId) return;

            await this._loadWardConstraint(wardId, this._store.currentShiftTeamId);
            await this._loadShift(wardId, this._store.currentShiftTeamId);
            this._ensureDutyEngine(wardId, this._store.currentShiftTeamId);
        });
    }

    changeShiftTeam(shiftTeamId: number) {
        this._doAction(() => {
            setPreferredShiftTeamId(shiftTeamId);

            this.init();
        });
    }

    toggleLayer(key: 'fault' | 'check' | 'slash') {
        this._store.toggleLayer(key);
    }

    foldLevel(level: number) {
        this._store.foldLevel(level);
    }

    changeMonth(type: 'prev' | 'next') {
        this._doAction(() => {
            if (type === 'prev') {
                if (this._store.month === 1) {
                    this._store.setMonth(12);
                    this._store.setYear(this._store.year - 1);
                } else {
                    this._store.setMonth(this._store.month - 1);
                }
            } else {
                if (this._store.month === 12) {
                    this._store.setMonth(1);
                    this._store.setYear(this._store.year + 1);
                } else {
                    this._store.setMonth(this._store.month + 1);
                }
            }

            this._store.setSelection(null);
            this._store.setShift(null);
            this._store.setShiftStatus('idle');
            this._store.setSaveStatus('idle');
        });
    }

    changeFocus(focus: Focus | null) {
        this._doAction(() => {
            if (!focus) {
                this._store.setSelection(null);

                return;
            }

            const rowIdx = this._store.rowIndexByShiftNurseId.get(focus.shiftNurseId);

            if (rowIdx === undefined) return;

            this._store.setSelection({type: 'single', anchor: {row: rowIdx, col: focus.day}});
        });
    }

    moveSelectionByArrow(direction: 'left' | 'right' | 'up' | 'down', moveEnd: boolean) {
        this._doAction(() => {
            if (!this._store.shift) return;

            const bounds = {
                rowCount: this._store.shift.divisionShiftNurses.flatMap((d) => d).length,
                colCount: this._store.shift.days.length,
            };
            const next = moveSelection(this._store.selection, direction, bounds, false, moveEnd);

            this._store.setSelection(next);
        });
    }

    applyShiftTypeId(shiftTypeId: number | null) {
        this._doAction(() => {
            if (this._store.readonly) return;

            if (!this._store.shift || !this._store.wardShiftTypeMap) return;

            if (!this._store.dutyStore || !this._store.dutyHistory || !this._store.dutyPersistence) return;

            const focus = this._store.focus;

            if (!focus) return;

            const shiftCode = shiftTypeId ? (this._store.wardShiftTypeMap.get(shiftTypeId)?.shortName ?? null) : null;
            const res = shiftCode
                ? new SetShiftCommand().run(
                      {doc: this._store.dutyStore.state.doc, selection: this._store.dutyStore.state.selection},
                      shiftCode,
                  )
                : new ClearShiftCommand().run({
                      doc: this._store.dutyStore.state.doc,
                      selection: this._store.dutyStore.state.selection,
                  });

            if (!res.ok) return;

            this._store.dutyStore.applyTransaction(res.tx, invertOps(res.tx.ops));
            this._store.setSelection(this._store.dutyStore.state.selection);
            this._store.dutyPersistence.scheduleSave(this._store.dutyStore.state.doc, this._store.dutyHistory);
            this._store.syncShiftFromDutyDoc();
            this._store.setSaveStatus('idle');
        });
    }

    pasteFromClipboardText(text: string) {
        this._doAction(async () => {
            if (this._store.readonly) return;

            if (!this._store.dutyStore || !this._store.dutyHistory || !this._store.dutyPersistence) return;

            const rows = text
                .replace(/\r/g, '')
                .split('\n')
                .filter((x) => x.length > 0)
                .map((x) => x.split('\t'));
            const payload: ClipboardPayload = {
                height: rows.length,
                width: rows[0]?.length ?? 0,
                cells: rows.map((r) => r.map((v) => (v ? v : null))),
            };
            const res = new PasteShiftCommand().run(
                {doc: this._store.dutyStore.state.doc, selection: this._store.dutyStore.state.selection},
                payload,
            );

            if (!res.ok) return;

            this._store.dutyStore.applyTransaction(res.tx, invertOps(res.tx.ops));
            this._store.setSelection(this._store.dutyStore.state.selection);
            this._store.dutyPersistence.scheduleSave(this._store.dutyStore.state.doc, this._store.dutyHistory);
            this._store.syncShiftFromDutyDoc();
            this._store.setSaveStatus('idle');
        });
    }

    undo() {
        this._doAction(() => {
            if (!this._store.dutyStore || !this._store.dutyHistory || !this._store.dutyPersistence) return;

            this._store.dutyStore.undo((inverseOps) => ({ops: inverseOps, source: 'system', timestamp: Date.now()}));
            this._store.setSelection(this._store.dutyStore.state.selection);
            this._store.dutyPersistence.scheduleSave(this._store.dutyStore.state.doc, this._store.dutyHistory);
            this._store.syncShiftFromDutyDoc();
            this._store.setSaveStatus('idle');
        });
    }

    redo() {
        this._doAction(() => {
            if (!this._store.dutyStore || !this._store.dutyHistory || !this._store.dutyPersistence) return;

            this._store.dutyStore.redo();
            this._store.setSelection(this._store.dutyStore.state.selection);
            this._store.dutyPersistence.scheduleSave(this._store.dutyStore.state.doc, this._store.dutyHistory);
            this._store.syncShiftFromDutyDoc();
            this._store.setSaveStatus('idle');
        });
    }

    toggleEditModeAndMaybeSave() {
        this._doAction(async () => {
            if (this._store.readonly) {
                this._store.setReadonly(false);

                return;
            }

            await this.save();
            this._store.setReadonly(true);
            this._store.setSelection(null);
        });
    }

    save() {
        this._doAction(async () => {
            const wardId = this._store.wardId;

            if (!wardId || !this._store.currentShiftTeamId || !this._store.shift || !this._store.baselineDoc || !this._store.dutyStore)
                return;

            if (!this._store.wardShiftTypeMap) return;

            this._store.setSaveStatus('pending');

            try {
                const dto = this._buildDiffDTO();

                if (dto.length > 0) await WardAPI.updateShifts(wardId, dto);

                if (this._store.wardConstraint)
                    await WardAPI.updateWardConstraint(wardId, this._store.currentShiftTeamId, this._store.wardConstraint);

                this._store.setSaveStatus('success');
                this._store.setBaselineDoc(this._store.dutyStore.state.doc);
            } catch {
                this._store.setSaveStatus('error');
            }
        });
    }

    postShift() {
        this._doAction(async () => {
            const wardId = this._store.wardId;

            if (!wardId || !this._store.currentShiftTeamId) return;

            await WardAPI.postShift(wardId, this._store.currentShiftTeamId, this._store.year, this._store.month);
        });
    }

    updateCarry(shiftNurseId: number, value: number) {
        this._doAction(async () => {
            if (!this._store.shift) return;

            await NurseAPI.updateNurseCarry(shiftNurseId, value);

            const row = this._store.shift.divisionShiftNurses.flatMap((d) => d).find((x) => x.shiftNurse.shiftNurseId === shiftNurseId);

            if (row) row.shiftNurse.carried = value;
        });
    }

    updateConstraint(constraint: WardConstraint) {
        this._doAction(() => {
            // 로컬만 변경 (서버 호출 제거)
            this._store.setWardConstraint(constraint);
            this._store.setSaveStatus('idle');
        });
    }

    restoreDraftForWard(): void {
        this._doAction(() => {
            const wardId = this._store.wardId;

            if (!wardId) return;

            if (!this._store.currentShiftTeamId) return;

            if (!this._store.shift || !this._store.wardShiftTypeMap || !this._store.wardConstraint) return;

            const key = makeDutyDraftStorageKey({
                wardId,
                shiftTeamId: this._store.currentShiftTeamId,
                year: this._store.year,
                month: this._store.month,
            });
            const persistence = new EditorPersistence<DutyDoc, EditorOp>({storageKey: key});
            const persisted = persistence.load();

            if (!persisted) return;

            // 현재 월/팀/간호사 구성과 row/col이 다르면 복구하지 않는다.
            const {
                doc: expectedDoc,
                requestedOffByRow,
                rowIndexByShiftNurseId,
            } = buildDutyDocFromShift(this._store.shift, this._store.wardShiftTypeMap, this._store.year, this._store.month);

            if (persisted.doc.columns.length !== expectedDoc.columns.length) return;

            if (persisted.doc.rows.length !== expectedDoc.rows.length) return;

            this._store.setRequestedOffByRow(requestedOffByRow);
            this._store.setRowIndexByShiftNurseId(rowIndexByShiftNurseId);
            this._store.setShortNameToId(
                new Map(this._store.shift.wardShiftTypes.map((t) => [t.shortName.toLowerCase(), t.wardShiftTypeId])),
            );

            const history = new MemoryEditorHistory<EditorOp, Selection | null>(200);

            history.hydrate(persisted.history);

            const validators = [createDutyValidator({wardConstraint: this._store.wardConstraint, mode: {requestedOffByRow}})];
            const initialState = new DutyEditorState({doc: persisted.doc, selection: this._store.selection, validators});
            const store = new EditorStore<DutyDoc, Selection | null, EditorOp, Violation>({initialState, history});

            // 기존 persistence timer 정리
            this._store.dutyPersistence?.dispose();

            this._store.setDutyHistory(history);
            this._store.setDutyPersistence(persistence);
            this._store.setDutyStore(store);
            this._store.setBaselineDoc(persisted.doc);

            this._store.syncShiftFromDutyDoc();
        });
    }

    clearDraftForWard(): void {
        this._doAction(() => {
            const wardId = this._store.wardId;

            if (!wardId) return;

            if (!this._store.currentShiftTeamId) return;

            const key = makeDutyDraftStorageKey({
                wardId,
                shiftTeamId: this._store.currentShiftTeamId,
                year: this._store.year,
                month: this._store.month,
            });

            window.localStorage.removeItem(key);
        });
    }

    createNextMonthShift() {
        this._doAction(() => {
            const nextMonth = new Date().getMonth() + 2;

            if (nextMonth > 12) {
                this._store.setYear(this._store.year + 1);
                this._store.setMonth(1);
            } else {
                this._store.setMonth(nextMonth);
            }

            this._store.setReadonly(true);
            this._store.setSelection(null);
        });
    }

    private _buildDiffDTO(): WardShiftsDTO {
        if (!this._store.baselineDoc || !this._store.dutyStore) return [];

        const before = this._store.baselineDoc;
        const after = this._store.dutyStore.state.doc;
        const dtos: WardShiftsDTO = [];

        for (let r = 0; r < after.rows.length; r++) {
            for (let c = 0; c < after.columns.length; c++) {
                const prev = before.rows[r]?.cells[c] ?? null;
                const next = after.rows[r]?.cells[c] ?? null;

                if (prev === next) continue;

                const workerId = after.rows[r]?.workerId;
                const date = after.columns[c];

                if (!workerId || !date) continue;

                dtos.push({
                    shiftNurseId: Number(workerId),
                    date,
                    wardShiftTypeId: next === null ? null : (this._store.shortNameToId.get(next.toLowerCase()) ?? null),
                });
            }
        }

        return dtos;
    }

    private async _loadShiftTeams(wardId: number): Promise<void> {
        const res = await WardAPI.getShiftTeams(wardId);

        this._store.setShiftTeams(res);

        const preferred = getPreferredShiftTeamId();

        if (!this._store.currentShiftTeamId && preferred && res.some((x) => x.shiftTeamId === preferred))
            this._store.setCurrentShiftTeamId(preferred);

        this._store.setCurrentShiftTeamId(res[0]?.shiftTeamId ?? null);

        if (this._store.currentShiftTeamId && res.every((x) => x.shiftTeamId !== this._store.currentShiftTeamId)) {
            this._store.setCurrentShiftTeamId(res[0]?.shiftTeamId ?? null);
        }
    }

    private async _loadWardConstraint(wardId: number, shiftTeamId: number): Promise<void> {
        const c = await WardAPI.getWardConstraint(wardId, shiftTeamId);

        this._store.setWardConstraint(c);
    }

    private async _loadShift(wardId: number, shiftTeamId: number): Promise<void> {
        this._store.setShiftStatus('pending');

        try {
            const s = await WardAPI.getShift(wardId, shiftTeamId, this._store.year, this._store.month);

            this._store.setShift(s);
            this._store.setShiftStatus(s ? 'success' : 'error');

            if (s) {
                this._store.setWardShiftTypeMap(new Map(s.wardShiftTypes.map((t) => [t.wardShiftTypeId, t])));

                if (!this._store.foldedLevels || this._store.foldedLevels.length !== s.divisionShiftNurses.length) {
                    this._store.setFoldedLevels(s.divisionShiftNurses.map(() => false));
                }
            }
        } catch {
            this._store.setShiftStatus('error');
        }
    }

    private _ensureDutyEngine(wardId: number, shiftTeamId: number): void {
        if (!this._store.shift || !this._store.wardShiftTypeMap || !this._store.wardConstraint) return;

        const key = makeDutyDraftStorageKey({wardId, shiftTeamId, year: this._store.year, month: this._store.month});

        this._store.setShortNameToId(new Map(this._store.shift.wardShiftTypes.map((t) => [t.shortName.toLowerCase(), t.wardShiftTypeId])));

        const {doc, requestedOffByRow, rowIndexByShiftNurseId} = buildDutyDocFromShift(
            this._store.shift,
            this._store.wardShiftTypeMap,
            this._store.year,
            this._store.month,
        );

        this._store.setRequestedOffByRow(requestedOffByRow);
        this._store.setRowIndexByShiftNurseId(rowIndexByShiftNurseId);

        const history = new MemoryEditorHistory<EditorOp, Selection | null>(200);
        const persistence = new EditorPersistence<DutyDoc, EditorOp>({storageKey: key});
        const persisted = persistence.load();
        const initialDoc =
            persisted && persisted.doc.columns.length === doc.columns.length && persisted.doc.rows.length === doc.rows.length
                ? persisted.doc
                : doc;

        if (persisted) history.hydrate(persisted.history);

        const validators = [createDutyValidator({wardConstraint: this._store.wardConstraint, mode: {requestedOffByRow}})];
        const initialState = new DutyEditorState({doc: initialDoc, selection: this._store.selection, validators});
        const store = new EditorStore<DutyDoc, Selection | null, EditorOp, Violation>({initialState, history});

        this._store.setDutyHistory(history);
        this._store.setDutyPersistence(persistence);
        this._store.setDutyStore(store);
        this._store.setBaselineDoc(initialDoc);

        // UI용 shift를 doc 기준으로 한번 동기화
        this._store.syncShiftFromDutyDoc();
    }
}
