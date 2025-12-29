import {makeAutoObservable, runInAction} from 'mobx';
import {WardAPI} from '@/shared/api';
import {NurseAPI} from '@/shared/api';
import type {WardShiftsDTO} from '@/shared/api/ward/type';
import {
    ClearShiftCommand,
    DutyEditorState,
    EditorPersistence,
    EditorStore,
    invertOps,
    MemoryEditorHistory,
    PasteShiftCommand,
    SetShiftCommand,
} from '@/shared/editor';
import type {DutyDoc} from '@/shared/editor/duty/doc';
import {createDutyValidator, type DutyRuleKey} from '@/shared/editor/duty/validation/validator';
import type {ClipboardPayload} from '@/shared/editor/editor-core/clipboard';
import type {EditorOp} from '@/shared/editor/editor-core/operation';
import type {Selection} from '@/shared/editor/editor-core/selection';
import {moveSelection} from '@/shared/editor/editor-core/selection';
import type {Violation} from '@/shared/editor/editor-core/validation';
import type {Shift} from '@/shared/types/shift';
import type {ShiftTeam, WardConstraint, WardShiftType} from '@/shared/types/ward';
import {buildCheckFaultOptions, type Faults, type Focus} from './faults';
import {getPreferredShiftTeamId} from './prefs';
import type {EditDutyViewState, SaveStatus, ShiftStatus} from './types';

export class EditDutyStore {
    // view state
    year = new Date().getFullYear();
    month = new Date().getMonth() + 1;
    readonly = true;
    showLayer = {fault: true, check: true, slash: true};
    foldedLevels: boolean[] | null = null;

    // server loaded
    shiftTeams: ShiftTeam[] | undefined = undefined;
    currentShiftTeamId: number | null = null;
    wardConstraint: WardConstraint | null = null;
    wardShiftTypeMap: Map<number, WardShiftType> | null = null;
    shift: Shift | null = null;
    shiftStatus: ShiftStatus = 'idle';
    saveStatus: SaveStatus = 'idle';

    // editor selection (source of truth)
    selection: Selection | null = null;

    // duty editor engine
    private dutyStore: EditorStore<DutyDoc, Selection | null, EditorOp, Violation> | null = null;
    private dutyHistory: MemoryEditorHistory<EditorOp, Selection | null> | null = null;
    private dutyPersistence: EditorPersistence<DutyDoc, EditorOp> | null = null;
    private baselineDoc: DutyDoc | null = null;
    private requestedOffByRow: boolean[][] = [];
    private rowIndexByShiftNurseId = new Map<number, number>();
    private shortNameToId = new Map<string, number>();

    constructor(private readonly wardIdProvider: () => number | null) {
        makeAutoObservable(this, {}, {autoBind: true});
    }

    get currentShiftTeam(): ShiftTeam | undefined {
        if (!this.shiftTeams || !this.currentShiftTeamId) return undefined;

        return this.shiftTeams.find((x) => x.shiftTeamId === this.currentShiftTeamId);
    }

    get checkFaultOptions() {
        if (!this.wardConstraint) return null;

        return buildCheckFaultOptions(this.wardConstraint);
    }

    get focus(): Focus | null {
        if (!this.selection || !this.shift) return null;

        const pos = this.selection.type === 'single' ? this.selection.anchor : this.selection.from;
        const rowsFlat = this.shift.divisionShiftNurses.flatMap((d) => d);
        const row = rowsFlat[pos.row];

        if (!row) return null;

        return {shiftNurseId: row.shiftNurse.shiftNurseId, shiftNurseName: row.shiftNurse.name, day: pos.col};
    }

    get faults(): Faults {
        if (!this.dutyStore || !this.wardConstraint || !this.shift) return new Map();

        const validator = createDutyValidator({wardConstraint: this.wardConstraint, mode: {requestedOffByRow: this.requestedOffByRow}});
        const violations = validator(this.dutyStore.state.doc);

        return this.violationsToFaults(violations);
    }

    get viewState(): EditDutyViewState {
        return {
            year: this.year,
            month: this.month,
            shift: this.shift,
            focus: this.focus,
            faults: this.faults,
            foldedLevels: this.foldedLevels,
            checkFaultOptions: this.checkFaultOptions,
            wardShiftTypeMap: this.wardShiftTypeMap,
            wardConstraint: this.wardConstraint,
            readonly: this.readonly,
            showLayer: this.showLayer,
            currentShiftTeam: this.currentShiftTeam,
            shiftTeams: this.shiftTeams,
            shiftStatus: this.shiftStatus,
            saveStatus: this.saveStatus,
        };
    }

    async init(activeEffect: boolean) {
        if (!activeEffect) return;

        const wardId = this.wardIdProvider();

        if (!wardId) return;

        await this.loadShiftTeams(wardId);

        if (!this.currentShiftTeamId) return;

        await this.loadWardConstraint(wardId, this.currentShiftTeamId);
        await this.loadShift(wardId, this.currentShiftTeamId);
        this.ensureDutyEngine(wardId, this.currentShiftTeamId);
    }

    async changeShiftTeam(shiftTeamId: number) {
        const wardId = this.wardIdProvider();

        if (!wardId) return;

        this.currentShiftTeamId = shiftTeamId;
        this.selection = null;
        this.shift = null;
        this.dutyStore = null;
        this.dutyHistory = null;
        this.dutyPersistence = null;
        this.baselineDoc = null;
        await this.loadWardConstraint(wardId, shiftTeamId);
        await this.loadShift(wardId, shiftTeamId);
        this.ensureDutyEngine(wardId, shiftTeamId);
    }

    async loadShiftTeams(wardId: number) {
        const res = await WardAPI.getShiftTeams(wardId);

        runInAction(() => {
            this.shiftTeams = res;

            const preferred = getPreferredShiftTeamId();

            if (!this.currentShiftTeamId && preferred && res.some((x) => x.shiftTeamId === preferred)) this.currentShiftTeamId = preferred;

            this.currentShiftTeamId ??= res[0]?.shiftTeamId ?? null;

            if (this.currentShiftTeamId && res.every((x) => x.shiftTeamId !== this.currentShiftTeamId)) {
                this.currentShiftTeamId = res[0]?.shiftTeamId ?? null;
            }
        });
    }

    async loadWardConstraint(wardId: number, shiftTeamId: number) {
        const c = await WardAPI.getWardConstraint(wardId, shiftTeamId);

        runInAction(() => {
            this.wardConstraint = c;
        });
    }

    async loadShift(wardId: number, shiftTeamId: number) {
        this.shiftStatus = 'pending';

        try {
            const s = await WardAPI.getShift(wardId, shiftTeamId, this.year, this.month);

            runInAction(() => {
                this.shift = s;
                this.shiftStatus = s ? 'success' : 'error';

                if (s) {
                    this.wardShiftTypeMap = new Map(s.wardShiftTypes.map((t) => [t.wardShiftTypeId, t]));

                    if (!this.foldedLevels || this.foldedLevels.length !== s.divisionShiftNurses.length) {
                        this.foldedLevels = s.divisionShiftNurses.map(() => false);
                    }
                }
            });
        } catch {
            runInAction(() => {
                this.shiftStatus = 'error';
            });
        }
    }

    setSelection(sel: Selection | null) {
        this.selection = sel;

        if (this.dutyStore) {
            this.dutyStore.state = this.dutyStore.state.withSelection(sel);
        }
    }

    changeFocus(focus: Focus | null) {
        if (!focus) {
            this.setSelection(null);

            return;
        }

        const rowIdx = this.rowIndexByShiftNurseId.get(focus.shiftNurseId);

        if (rowIdx === undefined) return;

        this.setSelection({type: 'single', anchor: {row: rowIdx, col: focus.day}});
    }

    toggleLayer(key: 'fault' | 'check' | 'slash') {
        this.showLayer = {...this.showLayer, [key]: !this.showLayer[key]};
    }

    foldLevel(level: number) {
        if (!this.foldedLevels) return;

        this.foldedLevels = this.foldedLevels.map((x, idx) => (idx === level ? !x : x));
    }

    changeMonth(type: 'prev' | 'next') {
        if (type === 'prev') {
            if (this.month === 1) {
                this.month = 12;
                this.year -= 1;
            } else this.month -= 1;
        } else {
            if (this.month === 12) {
                this.month = 1;
                this.year += 1;
            } else this.month += 1;
        }

        this.selection = null;
        this.shift = null;
        this.shiftStatus = 'idle';
        this.saveStatus = 'idle';
    }

    createNextMonthShift() {
        const nextMonth = new Date().getMonth() + 2;

        if (nextMonth > 12) {
            this.year += 1;
            this.month = 1;
        } else {
            this.month = nextMonth;
        }

        this.readonly = true;
        this.selection = null;
    }

    moveSelectionByArrow(direction: 'left' | 'right' | 'up' | 'down', moveEnd: boolean) {
        if (!this.shift) return;

        const bounds = {rowCount: this.shift.divisionShiftNurses.flatMap((d) => d).length, colCount: this.shift.days.length};
        const next = moveSelection(this.selection, direction, bounds, false, moveEnd);

        this.setSelection(next);
    }

    applyShiftTypeId(shiftTypeId: number | null) {
        if (this.readonly) return;

        if (!this.shift || !this.wardShiftTypeMap) return;

        if (!this.dutyStore || !this.dutyHistory || !this.dutyPersistence) return;

        const focus = this.focus;

        if (!focus) return;

        const shiftCode = shiftTypeId ? (this.wardShiftTypeMap.get(shiftTypeId)?.shortName ?? null) : null;
        const res = shiftCode
            ? new SetShiftCommand().run({doc: this.dutyStore.state.doc, selection: this.dutyStore.state.selection}, shiftCode)
            : new ClearShiftCommand().run({doc: this.dutyStore.state.doc, selection: this.dutyStore.state.selection});

        if (!res.ok) return;

        this.dutyStore.applyTransaction(res.tx, invertOps(res.tx.ops));
        this.selection = this.dutyStore.state.selection;
        this.dutyPersistence.scheduleSave(this.dutyStore.state.doc, this.dutyHistory);
        this.syncShiftFromDutyDoc();
        this.saveStatus = 'idle';
    }

    async pasteFromClipboardText(text: string) {
        if (this.readonly) return;

        if (!this.dutyStore || !this.dutyHistory || !this.dutyPersistence) return;

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
        const res = new PasteShiftCommand().run({doc: this.dutyStore.state.doc, selection: this.dutyStore.state.selection}, payload);

        if (!res.ok) return;

        this.dutyStore.applyTransaction(res.tx, invertOps(res.tx.ops));
        this.selection = this.dutyStore.state.selection;
        this.dutyPersistence.scheduleSave(this.dutyStore.state.doc, this.dutyHistory);
        this.syncShiftFromDutyDoc();
        this.saveStatus = 'idle';
    }

    undo() {
        if (!this.dutyStore || !this.dutyHistory || !this.dutyPersistence) return;

        this.dutyStore.undo((inverseOps) => ({ops: inverseOps, source: 'system', timestamp: Date.now()}));
        this.selection = this.dutyStore.state.selection;
        this.dutyPersistence.scheduleSave(this.dutyStore.state.doc, this.dutyHistory);
        this.syncShiftFromDutyDoc();
        this.saveStatus = 'idle';
    }

    redo() {
        if (!this.dutyStore || !this.dutyHistory || !this.dutyPersistence) return;

        this.dutyStore.redo();
        this.selection = this.dutyStore.state.selection;
        this.dutyPersistence.scheduleSave(this.dutyStore.state.doc, this.dutyHistory);
        this.syncShiftFromDutyDoc();
        this.saveStatus = 'idle';
    }

    async toggleEditModeAndMaybeSave() {
        if (this.readonly) {
            this.readonly = false;

            return;
        }

        await this.save();
        this.readonly = true;
        this.selection = null;
    }

    setReadonly(readonly: boolean) {
        this.readonly = readonly;

        if (readonly) this.selection = null;
    }

    async postShift() {
        const wardId = this.wardIdProvider();

        if (!wardId || !this.currentShiftTeamId) return;

        await WardAPI.postShift(wardId, this.currentShiftTeamId, this.year, this.month);
    }

    async updateCarry(shiftNurseId: number, value: number) {
        if (!this.shift) return;

        await NurseAPI.updateNurseCarry(shiftNurseId, value);

        const row = this.shift.divisionShiftNurses.flatMap((d) => d).find((x) => x.shiftNurse.shiftNurseId === shiftNurseId);

        if (row) row.shiftNurse.carried = value;
    }

    updateConstraint(constraint: WardConstraint) {
        // 로컬만 변경 (서버 호출 제거)
        this.wardConstraint = constraint;
        this.saveStatus = 'idle';
    }

    async save() {
        const wardId = this.wardIdProvider();

        if (!wardId || !this.currentShiftTeamId || !this.shift || !this.baselineDoc || !this.dutyStore) return;

        if (!this.wardShiftTypeMap) return;

        this.saveStatus = 'pending';

        try {
            const dto = this.buildDiffDTO();

            if (dto.length > 0) await WardAPI.updateShifts(wardId, dto);

            if (this.wardConstraint) await WardAPI.updateWardConstraint(wardId, this.currentShiftTeamId, this.wardConstraint);

            runInAction(() => {
                this.saveStatus = 'success';
                this.baselineDoc = this.dutyStore!.state.doc;
            });
        } catch {
            runInAction(() => {
                this.saveStatus = 'error';
            });
        }
    }

    private ensureDutyEngine(wardId: number, shiftTeamId: number) {
        if (!this.shift || !this.wardShiftTypeMap || !this.wardConstraint) return;

        const key = `duty:${wardId}:${shiftTeamId}:${this.year}:${this.month}`;

        this.shortNameToId = new Map(this.shift.wardShiftTypes.map((t) => [t.shortName.toLowerCase(), t.wardShiftTypeId]));

        const {doc, requestedOffByRow, rowIndexByShiftNurseId} = buildDutyDocFromShift(
            this.shift,
            this.wardShiftTypeMap,
            this.year,
            this.month,
        );

        this.requestedOffByRow = requestedOffByRow;
        this.rowIndexByShiftNurseId = rowIndexByShiftNurseId;

        const history = new MemoryEditorHistory<EditorOp, Selection | null>(200);
        const persistence = new EditorPersistence<DutyDoc, EditorOp>({storageKey: key});
        const persisted = persistence.load();
        const initialDoc =
            persisted && persisted.doc.columns.length === doc.columns.length && persisted.doc.rows.length === doc.rows.length
                ? persisted.doc
                : doc;

        if (persisted) history.hydrate(persisted.history);

        const validators = [createDutyValidator({wardConstraint: this.wardConstraint, mode: {requestedOffByRow}})];
        const initialState = new DutyEditorState({doc: initialDoc, selection: this.selection, validators});
        const store = new EditorStore<DutyDoc, Selection | null, EditorOp, Violation>({initialState, history});

        this.dutyHistory = history;
        this.dutyPersistence = persistence;
        this.dutyStore = store;
        this.baselineDoc = initialDoc;

        // UI용 shift를 doc 기준으로 한번 동기화
        this.syncShiftFromDutyDoc();
    }

    private syncShiftFromDutyDoc() {
        if (!this.shift || !this.dutyStore) return;

        const doc = this.dutyStore.state.doc;
        const rowsFlat = this.shift.divisionShiftNurses.flatMap((d) => d);

        for (let r = 0; r < doc.rows.length; r++) {
            const workerId = doc.rows[r]?.workerId;

            if (!workerId) continue;

            const shiftNurseId = Number(workerId);
            const row = rowsFlat.find((x) => x.shiftNurse.shiftNurseId === shiftNurseId);

            if (!row) continue;

            for (let c = 0; c < doc.columns.length; c++) {
                const code = doc.rows[r]!.cells[c];

                row.wardShiftList[c] = code === null ? null : (this.shortNameToId.get(code.toLowerCase()) ?? null);
            }
        }
    }

    private buildDiffDTO(): WardShiftsDTO {
        if (!this.baselineDoc || !this.dutyStore) return [];

        const before = this.baselineDoc;
        const after = this.dutyStore.state.doc;
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
                    wardShiftTypeId: next === null ? null : (this.shortNameToId.get(next.toLowerCase()) ?? null),
                });
            }
        }

        return dtos;
    }

    private violationsToFaults(violations: Violation[]): Faults {
        const faults: Faults = new Map();
        const c = this.wardConstraint;

        if (!c) return faults;

        const messageByType: Record<string, string> = {
            maxContinuousWork: `근무는 연속 ${c.maxContinuousWorkVal}일을 초과할 수 없습니다.`,
            minNightInterval: `나이트 간격이 최소 ${c.minNightIntervalVal}일 이상이어야 합니다.`,
            maxContinuousNight: `나이트 근무가 연속 ${c.maxContinuousNightVal}일을 초과했습니다`,
            minContinuousNight: `나이트 근무는 최소 ${c.minContinuousNightVal}일 이상 배정해야 합니다.`,
            minOffAssignAfterNight: `나이트 근무 후 ${c.minOffAssignAfterNightVal}일 이상 OFF를 권장합니다.`,
            excludeCertainWorkTypes: `ND/ED/NE/NOD 형태의 근무는 권장되지 않습니다.`,
            excludeNightBeforeReqOff: `신청 오프 전날에는 나이트 근무를 권장하지 않습니다.`,
        };

        for (const v of violations) {
            const [prefix, key] = v.ruleId.split('.');

            if (prefix !== 'duty') continue;

            if (!key) continue;

            const first = v.cells[0];

            if (!first) continue;

            const row = this.shift?.divisionShiftNurses.flatMap((d) => d)[first.row];

            if (!row) continue;

            const focus: Focus = {shiftNurseId: row.shiftNurse.shiftNurseId, shiftNurseName: row.shiftNurse.name, day: first.col};

            faults.set([focus.shiftNurseId, focus.day].join(','), {
                type: v.level === 'error' ? 'wrong' : 'bad',
                faultType: key as DutyRuleKey,
                nurseName: focus.shiftNurseName,
                focus,
                message: messageByType[key] ?? '',
                matchString: '',
                length: v.cells.length,
            });
        }

        return faults;
    }
}

function buildDutyDocFromShift(
    shift: Shift,
    wardShiftTypeMap: Map<number, WardShiftType>,
    year: number,
    month: number,
): {doc: DutyDoc; requestedOffByRow: boolean[][]; rowIndexByShiftNurseId: Map<number, number>} {
    const columns = shift.days.map((_, idx) => `${year}-${month.toString().padStart(2, '0')}-${(idx + 1).toString().padStart(2, '0')}`);
    const rowsFlat = shift.divisionShiftNurses.flatMap((division) => division);
    const rowIndexByShiftNurseId = new Map<number, number>();
    const rows = rowsFlat.map((row, idx) => {
        rowIndexByShiftNurseId.set(row.shiftNurse.shiftNurseId, idx);

        return {
            workerId: String(row.shiftNurse.shiftNurseId),
            cells: row.wardShiftList.map((id) => (id ? (wardShiftTypeMap.get(id)?.shortName ?? null) : null)),
        };
    });
    const workerMeta = rowsFlat.reduce<Record<string, {name: string}>>((acc, row) => {
        acc[String(row.shiftNurse.shiftNurseId)] = {name: row.shiftNurse.name};

        return acc;
    }, {});
    const requestedOffByRow = rowsFlat.map((row) =>
        row.wardShiftList.map((currentId, col) => {
            if (!currentId) return false;

            const reqId = row.wardReqShiftList[col];

            if (!reqId) return false;

            if (reqId !== currentId) return false;

            return wardShiftTypeMap.get(currentId)?.isOff === true;
        }),
    );

    return {doc: {columns, rows, workerMeta}, requestedOffByRow, rowIndexByShiftNurseId};
}
