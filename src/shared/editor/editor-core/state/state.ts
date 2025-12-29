import type {Transaction} from '../types';

/**
 * 도메인 중립 에디터 상태.
 * - Core는 row/col/cell 수준의 추상만 다룬다.
 * - 구체 Doc/Selection/Operation/Violation은 구현체(또는 상위 레이어)가 제공한다.
 */
export abstract class EditorState<Doc, Sel, Op, Vio> {
    abstract readonly doc: Doc;
    abstract readonly selection: Sel;
    abstract readonly violations: Vio[];

    abstract apply(tx: Transaction<Op>): EditorState<Doc, Sel, Op, Vio>;

    abstract withSelection(selection: Sel): EditorState<Doc, Sel, Op, Vio>;

    dispose(): void {
        // 기본 no-op: 외부 리소스를 사용하면 override
    }
}
