import {fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import AiAdjustExamples from '../ai-adjust-examples';

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({t: (key: string) => key}),
}));

describe('AiAdjustExamples', () => {
    it('예시를 누르면 실행하지 않고 문장만 넘긴다', () => {
        // 칩과의 결정적 차이다. 예시는 출발점이지 명령이 아니다 — 사용자는 숫자·이름·근무를
        // 고친 뒤 "조절"을 누른다.
        const onPick = vi.fn();

        render(<AiAdjustExamples disabled={false} onPick={onPick} />);
        fireEvent.click(screen.getByText('page.makeShift.aiRefill.adjust.examples.maxConsecutiveDay'));

        expect(onPick).toHaveBeenCalledWith('page.makeShift.aiRefill.adjust.examples.maxConsecutiveDay');
    });

    it('첫 화면에는 일부만 보이고 더 보기로 나머지가 열린다', () => {
        render(<AiAdjustExamples disabled={false} onPick={vi.fn()} />);

        expect(screen.queryByText('page.makeShift.aiRefill.adjust.examples.weekendCap')).toBeNull();

        fireEvent.click(screen.getByText('page.makeShift.aiRefill.adjust.examplesMore'));

        expect(screen.getByText('page.makeShift.aiRefill.adjust.examples.weekendCap')).toBeTruthy();
    });

    it('조절이 도는 동안에는 누를 수 없다', () => {
        const onPick = vi.fn();

        render(<AiAdjustExamples disabled onPick={onPick} />);
        fireEvent.click(screen.getByText('page.makeShift.aiRefill.adjust.examples.clusterOn'));

        expect(onPick).not.toHaveBeenCalled();
    });
});
