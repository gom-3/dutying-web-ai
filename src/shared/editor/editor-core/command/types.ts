import type {Transaction} from '../types';

export type CommandContext<Doc, Sel> = {
    doc: Doc;
    selection: Sel;
};

export type CommandResult<Op> = {ok: true; tx: Transaction<Op>} | {ok: false; reason?: string};
