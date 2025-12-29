import type {CellPos, Selection} from './types';

export type GridBounds = {
    rowCount: number;
    colCount: number;
};

/**
 * Selection 계산은 Core 책임(React 비의존).
 * 구현체는 문서 크기(bounds)를 제공한다.
 */
export abstract class SelectionModel {
    abstract get(): Selection | null;

    /**
     * 방향키 이동/확장 정책은 editor.mdc 스펙을 따른다.
     * - shiftKey=false: single 이동
     * - shiftKey=true: range 확장
     */
    abstract move(dir: 'left' | 'right' | 'up' | 'down', bounds: GridBounds, shiftKey: boolean): Selection | null;

    /**
     * 선택을 강제 설정하고 싶을 때 사용(예: 정렬 후 초기화).
     */
    abstract set(sel: Selection | null): void;

    dispose(): void {
        // 기본 no-op
    }
}

export function clampPos(pos: CellPos, bounds: GridBounds): CellPos {
    return {
        row: Math.max(0, Math.min(bounds.rowCount - 1, pos.row)),
        col: Math.max(0, Math.min(bounds.colCount - 1, pos.col)),
    };
}
