import type {EditorOp} from '../../editor-core/operation';
import {invertOps} from '../../editor-core/operation';
import type {Transaction} from '../../editor-core/types';

export function makeSystemTx(inverseOps: EditorOp[]): Transaction<EditorOp> {
    return {ops: inverseOps, source: 'system', timestamp: Date.now()};
}

export function inverseFromTx(tx: Transaction<EditorOp>): EditorOp[] {
    return invertOps(tx.ops);
}
