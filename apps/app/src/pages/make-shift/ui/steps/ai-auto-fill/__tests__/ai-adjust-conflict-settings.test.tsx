import type {TScheduleAdjustInterpretRes} from '@dutying/api/ward';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createRef} from 'react';
import {beforeEach, expect, it, vi} from 'vitest';
import type {TShift} from '@/entities/shift';
import i18n from '@/i18n';
import type * as ClientModule from '@/shared/api/client';
import type {TAiConversationFailure} from '../../../../model/ai-conversation-failure';
import AiAdjustDialog from '../ai-adjust-dialog';

const mocks = vi.hoisted(() => ({get: vi.fn(), put: vi.fn(), refresh: vi.fn(), reload: vi.fn()}));

vi.mock('@/shared/api/client', async (importOriginal) => ({
    ...(await importOriginal<typeof ClientModule>()),
    adminAxiosInstance: {get: mocks.get, put: mocks.put},
}));
vi.mock('../../../../model/use-ai-active-conditions', () => ({
    useAiActiveConditions: () => ({
        wardRules: [],
        requests: [],
        loading: false,
        error: false,
        removingId: null,
        reload: mocks.reload,
        refreshAfterRuleChange: mocks.refresh,
    }),
}));

vi.mock('../../constraints', () => ({Constraints: () => <p>공통 제약조건 편집기</p>}));

const failure: TAiConversationFailure = {
    message: '이간호: 휴무 목표 9일, 배정 가능 0~8일',
    blocked: false,
    recovery: 'revise',
    conditionConflict: true,
    settingsTarget: 'rest',
    restConflicts: [{nurseId: 2, nurseName: '이간호', shiftCodes: ['O'], expected: 9, minimumAssignments: 0, maximumAssignments: 8}],
};
const generate = vi.fn();
const interpret = vi.fn<() => Promise<TScheduleAdjustInterpretRes>>();
const apply = vi.fn();

function mount(value = failure) {
    render(
        <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
            <AiAdjustDialog
                open
                onClose={vi.fn()}
                wardId={1}
                teamId={7}
                year={2026}
                month={11}
                onRegenerate={generate}
                onGenerate={generate}
                generationFailure={value}
                disabled={false}
                textInputRef={createRef()}
                onPickExample={vi.fn()}
                interpret={interpret}
                onApply={apply}
                goalNurses={[
                    {nurseId: 1, name: '김간호'},
                    {nurseId: 2, name: '이간호'},
                ]}
                requests={[]}
                disablingRequestId={null}
                onDisableRequest={vi.fn()}
                snapshotShift={{wardShiftTypes: []} as unknown as TShift}
            />
        </QueryClientProvider>,
    );
}

beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('ko');
    mocks.get.mockResolvedValue({data: {nurseId: 2, year: 2026, month: 11, offDays: 9, annualDaysByWardShiftTypeId: {}, version: 0}});
    mocks.put.mockResolvedValue({data: {nurseId: 2, year: 2026, month: 11, offDays: 8, annualDaysByWardShiftTypeId: {}, version: 1}});
    mocks.refresh.mockResolvedValue(undefined);
});
it('opens the common rule editor for a legacy monthly-rest failure without using the separate policy API', async () => {
    mount();
    await userEvent.click(await screen.findByRole('button', {name: i18n.t('aiAutofillUi.conflictReview.editSettings')}));

    const modal = screen.getByRole('dialog', {name: '제약조건'});

    expect(modal).toBeVisible();
    expect(screen.queryByRole('dialog', {name: '휴무 설정 충돌'})).not.toBeInTheDocument();
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(interpret).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
});
it('keeps an unknown old rest identity in the common team rule editor instead of selecting another nurse', async () => {
    mount({...failure, restConflicts: [{...failure.restConflicts![0], nurseId: 999}]});
    await userEvent.click(await screen.findByRole('button', {name: i18n.t('aiAutofillUi.conflictReview.editSettings')}));
    expect(screen.getByRole('dialog', {name: '제약조건'})).toBeVisible();
    expect(mocks.get).not.toHaveBeenCalled();
});
