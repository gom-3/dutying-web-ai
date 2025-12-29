export type CellPos = {row: number; col: number};

export type Selection = {type: 'single'; anchor: CellPos} | {type: 'range'; from: CellPos; to: CellPos};
