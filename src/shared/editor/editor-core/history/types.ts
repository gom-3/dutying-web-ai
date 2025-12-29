import type {Transaction} from '../types';

export type HistoryEntry<Op, Sel> = {
    tx: Transaction<Op>;
    inverseOps: Op[];
    prevSelection: Sel;
    nextSelection: Sel;
};
