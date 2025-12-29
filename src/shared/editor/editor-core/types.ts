export type CellValue = string | null;

export type TransactionSource = 'user' | 'ai' | 'system';

export type Transaction<Op> = {
    ops: Op[];
    source: TransactionSource;
    timestamp: number;
};
