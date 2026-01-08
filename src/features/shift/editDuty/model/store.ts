import {computed, makeObservable, observable} from 'mobx';
import {AbstractStore} from '@/shared/abstract';
import {createDutyValidator, type DutyRuleKey, type DutyDoc} from '@/shared/editor/duty';
import type {EditorOp, Selection, Violation} from '@/shared/editor/editor-core';
import type {MemoryEditorHistory} from '@/shared/editor/editor-core/history/memory-history';
import {makeDutyDraftStorageKey} from '@/shared/editor/editor-persistence/keys';
import type {EditorPersistence} from '@/shared/editor/editor-persistence/persistence';
import type {EditorStore} from '@/shared/editor/editor-store/store';
import type {Shift} from '@/shared/types/shift';
import type {ShiftTeam, WardConstraint, WardShiftType} from '@/shared/types/ward';
import {buildCheckFaultOptions, type Faults, type Focus} from './utils/faults';

export type ShiftStatus = 'idle' | 'pending' | 'success' | 'error';
export type SaveStatus = 'idle' | 'pending' | 'success' | 'error';

export class EditDutyStore extends AbstractStore {
    // view state
    private _year!: number;
    private _month!: number;
    private _readonly!: boolean;
    private _showLayer!: {fault: boolean; check: boolean; slash: boolean};
    private _foldedLevels!: boolean[] | null;

    // server loaded
    private _shiftTeams!: ShiftTeam[] | undefined;
    private _currentShiftTeamId!: number | null;
    private _wardConstraint!: WardConstraint | null;
    private _wardShiftTypeMap!: Map<number, WardShiftType> | null;
    private _shift!: Shift | null;
    private _shiftStatus!: ShiftStatus;
    private _saveStatus!: SaveStatus;

    // editor selection (source of truth)
    private _selection!: Selection | null;

    // duty editor engine
    private _dutyStore!: EditorStore<DutyDoc, Selection | null, EditorOp, Violation> | null;
    private _dutyHistory!: MemoryEditorHistory<EditorOp, Selection | null> | null;
    private _dutyPersistence!: EditorPersistence<DutyDoc, EditorOp> | null;
    private _baselineDoc!: DutyDoc | null;
    private _requestedOffByRow!: boolean[][];
    private _rowIndexByShiftNurseId!: Map<number, number>;
    private _shortNameToId!: Map<string, number>;

    constructor(private readonly wardIdProvider: () => number | null) {
        super();

        this.init();

        const observableMap = {
            _year: observable,
            _month: observable,
            _readonly: observable,
            _showLayer: observable,
            _foldedLevels: observable,
            _shiftTeams: observable,
            _currentShiftTeamId: observable,
            _wardConstraint: observable,
            _wardShiftTypeMap: observable,
            _shift: observable,
            _shiftStatus: observable,
            _saveStatus: observable,
            _selection: observable,
            _dutyStore: observable,
            _dutyHistory: observable,
            _dutyPersistence: observable,
            _baselineDoc: observable,
            _requestedOffByRow: observable,
            _rowIndexByShiftNurseId: observable,
            _shortNameToId: observable,
            year: computed,
            month: computed,
            readonly: computed,
            showLayer: computed,
            foldedLevels: computed,
            shiftTeams: computed,
            currentShiftTeamId: computed,
            wardConstraint: computed,
            wardShiftTypeMap: computed,
            shift: computed,
            shiftStatus: computed,
            saveStatus: computed,
            selection: computed,
            dutyStore: computed,
            dutyHistory: computed,
            dutyPersistence: computed,
            baselineDoc: computed,
            requestedOffByRow: computed,
            rowIndexByShiftNurseId: computed,
            shortNameToId: computed,
        };

        makeObservable(this, observableMap);
    }

    override init(): void {
        this._year = new Date().getFullYear();
        this._month = new Date().getMonth() + 1;
        this._readonly = true;
        this._showLayer = {fault: true, check: true, slash: true};
        this._foldedLevels = null;

        this._shiftTeams = undefined;
        this._currentShiftTeamId = null;
        this._wardConstraint = null;
        this._wardShiftTypeMap = null;
        this._shift = null;
        this._shiftStatus = 'idle';
        this._saveStatus = 'idle';
        this._selection = null;

        this._dutyStore = null;
        this._dutyHistory = null;
        this._dutyPersistence = null;
        this._baselineDoc = null;
        this._requestedOffByRow = [];
        this._rowIndexByShiftNurseId = new Map();
        this._shortNameToId = new Map();
    }

    get year(): number {
        return this._year;
    }

    get month(): number {
        return this._month;
    }

    get readonly(): boolean {
        return this._readonly;
    }

    get showLayer(): {fault: boolean; check: boolean; slash: boolean} {
        return this._showLayer;
    }

    get foldedLevels(): boolean[] | null {
        return this._foldedLevels;
    }

    get shiftTeams(): ShiftTeam[] | undefined {
        return this._shiftTeams;
    }

    get currentShiftTeamId(): number | null {
        return this._currentShiftTeamId;
    }

    get wardConstraint(): WardConstraint | null {
        return this._wardConstraint;
    }

    get wardShiftTypeMap(): Map<number, WardShiftType> | null {
        return this._wardShiftTypeMap;
    }

    get shift(): Shift | null {
        return this._shift;
    }

    get shiftStatus(): ShiftStatus {
        return this._shiftStatus;
    }

    get saveStatus(): SaveStatus {
        return this._saveStatus;
    }

    get selection(): Selection | null {
        return this._selection;
    }

    get requestedOffByRow(): boolean[][] {
        return this._requestedOffByRow;
    }

    get rowIndexByShiftNurseId(): Map<number, number> {
        return this._rowIndexByShiftNurseId;
    }

    get dutyStore(): EditorStore<DutyDoc, Selection | null, EditorOp, Violation> | null {
        return this._dutyStore;
    }

    get dutyHistory(): MemoryEditorHistory<EditorOp, Selection | null> | null {
        return this._dutyHistory;
    }

    get dutyPersistence(): EditorPersistence<DutyDoc, EditorOp> | null {
        return this._dutyPersistence;
    }

    get baselineDoc(): DutyDoc | null {
        return this._baselineDoc;
    }

    get shortNameToId(): Map<string, number> {
        return this._shortNameToId;
    }

    setDutyStore(dutyStore: EditorStore<DutyDoc, Selection | null, EditorOp, Violation> | null) {
        this._dutyStore = dutyStore;
    }

    setDutyHistory(dutyHistory: MemoryEditorHistory<EditorOp, Selection | null> | null) {
        this._dutyHistory = dutyHistory;
    }

    setDutyPersistence(dutyPersistence: EditorPersistence<DutyDoc, EditorOp> | null) {
        this._dutyPersistence = dutyPersistence;
    }

    setBaselineDoc(baselineDoc: DutyDoc | null) {
        this._baselineDoc = baselineDoc;
    }

    setRequestedOffByRow(requestedOffByRow: boolean[][]) {
        this._requestedOffByRow = requestedOffByRow;
    }

    setRowIndexByShiftNurseId(rowIndexByShiftNurseId: Map<number, number>) {
        this._rowIndexByShiftNurseId = rowIndexByShiftNurseId;
    }

    setShortNameToId(shortNameToId: Map<string, number>) {
        this._shortNameToId = shortNameToId;
    }

    setWardShiftTypeMap(wardShiftTypeMap: Map<number, WardShiftType> | null) {
        this._wardShiftTypeMap = wardShiftTypeMap;
    }

    setFoldedLevels(foldedLevels: boolean[] | null) {
        this._foldedLevels = foldedLevels;
    }

    setShift(shift: Shift | null) {
        this._shift = shift;
    }

    setShiftStatus(shiftStatus: ShiftStatus) {
        this._shiftStatus = shiftStatus;
    }

    setWardConstraint(wardConstraint: WardConstraint) {
        this._wardConstraint = wardConstraint;
    }

    setShiftTeams(shiftTeams: ShiftTeam[]) {
        this._shiftTeams = shiftTeams;
    }

    setCurrentShiftTeamId(currentShiftTeamId: number | null) {
        this._currentShiftTeamId = currentShiftTeamId;
    }

    setSelection(sel: Selection | null) {
        this._selection = sel;

        if (this._dutyStore) {
            this._dutyStore.state = this._dutyStore.state.withSelection(sel);
        }
    }

    setSaveStatus(saveStatus: SaveStatus) {
        this._saveStatus = saveStatus;
    }

    toggleLayer(key: 'fault' | 'check' | 'slash') {
        this._showLayer = {...this._showLayer, [key]: !this._showLayer[key]};
    }

    foldLevel(level: number) {
        if (!this._foldedLevels) return;

        this._foldedLevels = this._foldedLevels.map((x, idx) => (idx === level ? !x : x));
    }

    setYear(year: number) {
        this._year = year;
    }

    setMonth(month: number) {
        this._month = month;
    }

    setReadonly(readonly: boolean) {
        this._readonly = readonly;

        if (readonly) this._selection = null;
    }

    get wardId(): number | null {
        return this.wardIdProvider();
    }

    get currentShiftTeam(): ShiftTeam | undefined {
        if (!this._shiftTeams || !this._currentShiftTeamId) return undefined;

        return this._shiftTeams.find((x) => x.shiftTeamId === this._currentShiftTeamId);
    }

    get checkFaultOptions() {
        if (!this._wardConstraint) return null;

        return buildCheckFaultOptions(this._wardConstraint);
    }

    get focus(): Focus | null {
        if (!this._selection || !this._shift) return null;

        const pos = this._selection.type === 'single' ? this._selection.anchor : this._selection.from;
        const rowsFlat = this._shift.divisionShiftNurses.flatMap((d) => d);
        const row = rowsFlat[pos.row];

        if (!row) return null;

        return {shiftNurseId: row.shiftNurse.shiftNurseId, shiftNurseName: row.shiftNurse.name, day: pos.col};
    }

    get faults(): Faults {
        if (!this._dutyStore || !this._wardConstraint || !this._shift) return new Map();

        const validator = createDutyValidator({wardConstraint: this._wardConstraint, mode: {requestedOffByRow: this._requestedOffByRow}});
        const violations = validator(this._dutyStore.state.doc);

        return this._violationsToFaults(violations);
    }

    get draftExists(): boolean {
        const wardId = this.wardIdProvider();

        if (!wardId) return false;

        if (!this._currentShiftTeamId) return false;

        const key = makeDutyDraftStorageKey({wardId, shiftTeamId: this._currentShiftTeamId, year: this._year, month: this._month});

        return window.localStorage.getItem(key) != null;
    }

    syncShiftFromDutyDoc() {
        if (!this._shift || !this._dutyStore) return;

        const doc = this._dutyStore.state.doc;
        const rowsFlat = this._shift.divisionShiftNurses.flatMap((d) => d);

        for (let r = 0; r < doc.rows.length; r++) {
            const workerId = doc.rows[r]?.workerId;

            if (!workerId) continue;

            const shiftNurseId = Number(workerId);
            const row = rowsFlat.find((x) => x.shiftNurse.shiftNurseId === shiftNurseId);

            if (!row) continue;

            for (let c = 0; c < doc.columns.length; c++) {
                const code = doc.rows[r]!.cells[c];

                row.wardShiftList[c] = code === null ? null : (this._shortNameToId.get(code.toLowerCase()) ?? null);
            }
        }
    }

    private _violationsToFaults(violations: Violation[]): Faults {
        const faults: Faults = new Map();
        const c = this._wardConstraint;

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

            const row = this._shift?.divisionShiftNurses.flatMap((d) => d)[first.row];

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
