import type {TScheduleMonthRequestRes} from '@dutying/api/ward';
import {fireEvent, render, screen, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import AiPromoteRulesDialog from '../ai-promote-rules-dialog';

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({t: (key: string) => key}),
}));

function rule(id: number, displayLabel: string): TScheduleMonthRequestRes {
    return {
        id,
        kind: 'RULE',
        lifetime: 'MONTH',
        status: 'ACTIVE',
        origin: 'TEXT',
        displayLabel,
        templateCode: 'MAX_CONSECUTIVE_SHIFT',
        severity: 'SOFT',
    };
}

const CANDIDATES = [rule(1, '데이는 4일 연속까지만'), rule(2, '나이트 끝나면 이틀 휴무')];

describe('AiPromoteRulesDialog', () => {
    it('아무것도 고르지 않은 채 확정하면 승격 대상이 비어 나간다', () => {
        // 기본 미선택이 이 화면의 핵심이다. 기본 선택이면 사용자가 만든 적 없는 제약조건이
        // 다음 달에 나타나고, 제약조건 화면을 오염시키지 않는다는 약속이 깨진다.
        const onConfirm = vi.fn();

        render(<AiPromoteRulesDialog open candidates={CANDIDATES} onClose={vi.fn()} onConfirm={onConfirm} />);
        fireEvent.click(screen.getByText('page.makeShift.aiRefill.adjust.promote.confirm'));

        expect(onConfirm).toHaveBeenCalledWith([]);
    });

    it('남기기로 고른 것만 승격 대상이 된다', () => {
        const onConfirm = vi.fn();

        render(<AiPromoteRulesDialog open candidates={CANDIDATES} onClose={vi.fn()} onConfirm={onConfirm} />);

        const [first] = screen.getAllByRole('group');

        fireEvent.click(within(first!).getByText('page.makeShift.aiRefill.adjust.promote.keep'));
        fireEvent.click(screen.getByText('page.makeShift.aiRefill.adjust.promote.confirm'));

        expect(onConfirm).toHaveBeenCalledWith([1]);
    });

    it('다시 고르면 되돌릴 수 있다', () => {
        const onConfirm = vi.fn();

        render(<AiPromoteRulesDialog open candidates={CANDIDATES} onClose={vi.fn()} onConfirm={onConfirm} />);

        const [first] = screen.getAllByRole('group');

        fireEvent.click(within(first!).getByText('page.makeShift.aiRefill.adjust.promote.keep'));
        fireEvent.click(within(first!).getByText('page.makeShift.aiRefill.adjust.promote.discard'));
        fireEvent.click(screen.getByText('page.makeShift.aiRefill.adjust.promote.confirm'));

        expect(onConfirm).toHaveBeenCalledWith([]);
    });
});
