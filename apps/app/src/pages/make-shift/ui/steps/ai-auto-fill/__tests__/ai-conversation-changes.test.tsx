import {expect, it, vi} from 'vitest';
import {render, screen, userEvent, within} from '@/shared/util/test-utils';
import type {TResultVersion} from '../../../../model/schedule-conversation-api';
import {AiConversationChanges} from '../ai-conversation-changes';

it('keeps both levels collapsed and groups interleaved cells by nurse ID in date order', async () => {
    const cells = [
        {shiftNurseId: 1, date: '2026-11-03', wardShiftTypeId: 1, shiftCode: 'D', fixed: false},
        {shiftNurseId: 2, date: '2026-11-02', wardShiftTypeId: 2, shiftCode: 'E', fixed: false},
        {shiftNurseId: 1, date: '2026-11-01', wardShiftTypeId: 3, shiftCode: 'N', fixed: false},
    ];
    const source: TResultVersion = {
        versionId: 'source',
        parentVersionId: null,
        year: 2026,
        month: 11,
        cells: cells.map((cell) => ({...cell, shiftCode: 'O', wardShiftTypeId: 4})),
        rowOrder: [],
        carryOverCells: [],
        constraintsJson: '{}',
        inputDigest: '',
        createdAt: '',
    };

    render(
        <AiConversationChanges
            changedCells={cells}
            sourceVersionId="source"
            loadVersion={vi.fn().mockResolvedValue(source)}
            nurseName={() => '김간호'}
            label="실제 변경 내역"
            locale="ko"
        />,
    );

    const region = await screen.findByRole('region', {name: '실제 변경 내역'});
    const outer = region.querySelector('details')!;

    expect(outer).not.toHaveAttribute('open');
    expect(outer.querySelector('summary')).toHaveTextContent('2명 · 3칸');
    await userEvent.click(outer.querySelector('summary')!);

    const groups = outer.querySelectorAll('details');

    expect(groups).toHaveLength(2);
    expect(groups[0]).not.toHaveAttribute('open');
    expect(groups[1]).not.toHaveAttribute('open');
    expect(groups[0].querySelector('summary')).toHaveTextContent('김간호2칸 변경');
    expect(groups[1].querySelector('summary')).toHaveTextContent('김간호1칸 변경');
    await userEvent.click(groups[0].querySelector('summary')!);
    expect(groups[0]).toHaveAttribute('open');
    expect(groups[1]).not.toHaveAttribute('open');

    const rows = within(groups[0]).getAllByRole('listitem');

    expect(rows[0]).toHaveTextContent('11월 1일');
    expect(rows[0]).toHaveTextContent('O → N');
    expect(rows[1]).toHaveTextContent('11월 3일');
    expect(rows[1]).toHaveTextContent('O → D');
    await userEvent.click(outer.querySelector('summary')!);
    expect(outer).not.toHaveAttribute('open');
    expect(cells[0].date).toBe('2026-11-03');
});
