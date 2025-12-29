import type {CellValue} from './types';

/**
 * Core 관점의 도메인 중립 문서 접근 인터페이스.
 * 구현체(예: schedule)는 자신의 doc을 이 인터페이스로 어댑트해서 Core 유틸을 재사용한다.
 */
export interface GridDoc {
    readonly rowCount: number;
    readonly colCount: number;
    getCell(row: number, col: number): CellValue;
}
