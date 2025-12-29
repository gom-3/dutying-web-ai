import type {CellPos} from '../selection';

export type Violation = {
    ruleId: string;
    cells: CellPos[];
    level: 'warning' | 'error';
};

export type Validator<Doc> = (doc: Doc) => Violation[];
