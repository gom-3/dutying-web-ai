import {useMemo} from 'react';
import {useShiftEditorStore} from './store';
import type {TDutyDoc} from './types';
import {buildViolationMap} from './validator';

/**
 * 편집기 store의 violations를 doc 형상에 맞춰 ShiftCalendar / MakeShiftCalendar용 Map으로 변환.
 */
export function useViolationMap(doc: TDutyDoc) {
    const violations = useShiftEditorStore((s) => s.violations);

    return useMemo(() => buildViolationMap(violations, doc), [violations, doc]);
}
