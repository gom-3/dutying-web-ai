import type {CellValue} from '../../editor-core/types';

export type DateKey = string; // YYYY-MM-DD
export type WorkerId = string;

export type DutyRow = {
    workerId: WorkerId;
    cells: CellValue[];
};

export type WorkerMeta = Record<WorkerId, {name: string}>;

export type DutyDoc = {
    columns: DateKey[];
    rows: DutyRow[];
    workerMeta: WorkerMeta;
};
