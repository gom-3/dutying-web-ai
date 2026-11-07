import {expect, it, vi} from 'vitest';
import {useUIConfigStore} from '@/entities/ui/useUIConfig/store';
import {act, render, screen, userEvent, within} from '@/shared/util/test-utils';
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

    const table = within(groups[0]).getByRole('table');
    const before = within(table).getByRole('rowheader', {name: '변경 전'}).closest('tr')!;
    const after = within(table).getByRole('rowheader', {name: '변경 후'}).closest('tr')!;

    expect(
        within(table)
            .getAllByRole('columnheader')
            .map((column) => column.textContent),
    ).toEqual(['날짜', '11/1', '11/3']);
    expect(
        within(before)
            .getAllByRole('cell')
            .map((column) => column.textContent),
    ).toEqual(['O', 'O']);
    expect(
        within(after)
            .getAllByRole('cell')
            .map((column) => column.textContent),
    ).toEqual(['N', 'D']);
    await userEvent.click(outer.querySelector('summary')!);
    expect(outer).not.toHaveAttribute('open');
    expect(cells[0].date).toBe('2026-11-03');
});

it('matches shift chips by ward shift ID and keeps the code captured in the original schedule', async () => {
    const changed = {shiftNurseId: 1, date: '2026-11-01', wardShiftTypeId: 2, fixed: false};
    const source: TResultVersion = {
        versionId: 'source',
        parentVersionId: null,
        year: 2026,
        month: 11,
        cells: [{...changed, wardShiftTypeId: 1, shiftCode: 'OLD'}],
        rowOrder: [],
        carryOverCells: [],
        constraintsJson: '{}',
        inputDigest: '',
        createdAt: '',
    };

    render(
        <AiConversationChanges
            changedCells={[changed]}
            sourceVersionId="source"
            loadVersion={vi.fn().mockResolvedValue(source)}
            nurseName={() => '김간호'}
            label="실제 변경 내역"
            locale="ko"
            inline
            shiftTypes={[
                {wardShiftTypeId: 1, name: '기존 주간 근무', shortName: 'R', color: '#4DC2AD'},
                {wardShiftTypeId: 2, name: '교육 근무', shortName: 'R', color: '#3580FF'},
            ]}
        />,
    );

    const group = (await screen.findByText('김간호')).closest('details')!;

    await userEvent.click(group.querySelector('summary')!);
    expect(within(group).getByTitle('기존 주간 근무')).toHaveTextContent('OLD');
    expect(within(group).getByTitle('교육 근무')).toHaveTextContent('R');
    expect(within(group).getByRole('cell', {name: 'OLD'})).toBeVisible();
    expect(within(group).getByRole('cell', {name: 'R'})).toBeVisible();
});

it('distinguishes unassigned cells and keeps unfamiliar saved shift codes visible', async () => {
    const changed = {shiftNurseId: 1, date: '2026-11-01', wardShiftTypeId: 99, shiftCode: 'CUSTOM', fixed: false};
    const source: TResultVersion = {
        versionId: 'source',
        parentVersionId: null,
        year: 2026,
        month: 11,
        cells: [{...changed, wardShiftTypeId: null, shiftCode: null}],
        rowOrder: [],
        carryOverCells: [],
        constraintsJson: '{}',
        inputDigest: '',
        createdAt: '',
    };

    render(
        <AiConversationChanges
            changedCells={[changed]}
            sourceVersionId="source"
            loadVersion={vi.fn().mockResolvedValue(source)}
            nurseName={() => '김간호'}
            label="실제 변경 내역"
            locale="ko"
            inline
        />,
    );

    const group = (await screen.findByText('김간호')).closest('details')!;

    await userEvent.click(group.querySelector('summary')!);
    expect(within(group).getByTitle('미배정')).toHaveTextContent('-');
    expect(within(group).getByTitle('CUSTOM')).toHaveTextContent('CUSTOM');
    expect(within(group).getByRole('rowheader', {name: '변경 전'})).toBeVisible();
    expect(within(group).getByRole('cell', {name: 'CUSTOM'})).toBeVisible();
});

it.each(['background', 'text'] as const)('uses the schedule chip background and foreground in %s mode', async (mode) => {
    useUIConfigStore.getState().setShiftTypeColorStyle(mode);

    const cell = {shiftNurseId: 1, date: '2026-11-01', wardShiftTypeId: 1, shiftCode: 'D', fixed: false};
    const source: TResultVersion = {
        versionId: 'source',
        parentVersionId: null,
        year: 2026,
        month: 11,
        cells: [],
        rowOrder: [],
        carryOverCells: [],
        constraintsJson: '{}',
        inputDigest: '',
        createdAt: '',
    };

    render(
        <AiConversationChanges
            changedCells={[cell]}
            sourceVersionId="source"
            loadVersion={vi.fn().mockResolvedValue(source)}
            nurseName={() => '김간호'}
            label="실제 변경 내역"
            locale="ko"
            inline
            shiftTypes={[{wardShiftTypeId: 1, name: '주간 근무', shortName: 'D', color: '#156B57'}]}
        />,
    );

    const group = (await screen.findByText('김간호')).closest('details')!;

    await userEvent.click(group.querySelector('summary')!);

    const chip = within(group).getByTitle('주간 근무');

    expect(chip).toHaveTextContent('D');
    expect(chip).toHaveStyle({backgroundColor: mode === 'background' ? '#156B57' : '#FFFFFF'});

    if (mode === 'background') expect(chip).toHaveClass('text-white');
    else expect(chip).toHaveStyle({color: '#156B57'});

    act(() => useUIConfigStore.getState().setShiftTypeColorStyle('background'));
});
