import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {TShift} from '@/entities/shift';
import type * as ShiftEditorModule from '@/features/shift-editor';
import {useShiftEditorStore} from '@/features/shift-editor/model/store';
import {render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import type * as ConversationApiModule from '../../../../model/schedule-conversation-api';
import type {TConversationDetail, TConversationOperation, TResultVersion} from '../../../../model/schedule-conversation-api';
import AiConversationSidebar from '../ai-conversation-sidebar';

const mocks = vi.hoisted(() => ({
    list: vi.fn(),
    create: vi.fn(),
    detail: vi.fn(),
    sync: vi.fn(),
    interpret: vi.fn(),
    execute: vi.fn(),
    version: vi.fn(),
    branch: vi.fn(),
    preferences: vi.fn(),
    savePreference: vi.fn(),
    deletePreference: vi.fn(),
    applyAdjustedDoc: vi.fn(),
    clearScheduleValidationFromApi: vi.fn(),
    confirm: vi.fn(),
}));

vi.mock('../../../../model/schedule-conversation-api', async (original) => ({
    ...(await original<typeof ConversationApiModule>()),
    conversationApi: () => mocks,
}));
vi.mock('@/features/shift-editor', async (original) => ({
    ...(await original<typeof ShiftEditorModule>()),
    useShiftEditorCommands: () => ({
        applyAdjustedDoc: mocks.applyAdjustedDoc,
        clearScheduleValidationFromApi: mocks.clearScheduleValidationFromApi,
    }),
}));
vi.mock('@/features/shift-editor/model/schedule-authoring', () => ({
    buildAutofillDTO: () => ({
        year: 2026,
        month: 11,
        cells: [{shiftNurseId: 1, date: '2026-11-01', wardShiftTypeId: 4, fixed: false}],
        rowOrder: [],
        carryOverCells: [],
    }),
}));

const cell = {shiftNurseId: 1, date: '2026-11-01', wardShiftTypeId: 4, shiftCode: 'O', fixed: false};
const source: TResultVersion = {
    versionId: 'source:1',
    parentVersionId: null,
    year: 2026,
    month: 11,
    cells: [cell],
    rowOrder: [],
    carryOverCells: [],
    constraintsJson: '{}',
    inputDigest: 'a',
    createdAt: '2026-10-03T10:00:00',
};
const operation: TConversationOperation = {
    operationId: 'operation:1',
    sequence: 1,
    operationType: 'GENERATE',
    fillPolicy: 'EMPTY_ONLY',
    sourceVersionId: source.versionId,
    resultVersionId: 'result:1',
    interpretationId: null,
    baseRevision: 0,
    executionStatus: 'SUCCEEDED',
    applyStatus: 'APPLIED',
    failureReason: null,
    result: null,
    createdAt: '2026-10-03T10:00:00',
};

let current: TConversationDetail;

const renderSidebar = () =>
    render(
        <AiConversationSidebar
            open
            onClose={vi.fn()}
            wardId={1}
            teamId={2}
            year={2026}
            month={11}
            shift={
                {
                    lastDays: [],
                    days: [{day: 1, dayType: 'workday'}],
                    wardShiftTypes: [
                        {wardShiftTypeId: 1, shortName: 'D', name: 'Day', color: '#44c4b0', isDefault: true, isOff: false, isCounted: true},
                        {wardShiftTypeId: 4, shortName: 'O', name: 'Off', color: '#455a7a', isDefault: true, isOff: true, isCounted: true},
                    ],
                    divisionShiftNurses: [
                        [
                            {
                                shiftNurse: {
                                    shiftNurseId: 1,
                                    name: '김 간호사',
                                    nurseId: 1,
                                    isWorker: true,
                                    divisionNum: 0,
                                    priority: 0,
                                    carried: 0,
                                },
                                lastWardShiftList: [],
                                lastWardReqShiftList: [],
                                wardShiftList: [4],
                                wardReqShiftList: [null],
                            },
                        ],
                    ],
                } as TShift
            }
            adjustEnabled
            generationRequest={0}
            rebuildRequest={0}
            onApplied={vi.fn()}
        />,
    );

beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    current = {
        contextHash: 'rules:1',
        activeConditionLabels: [],
        conversation: {
            conversationId: 1,
            year: 2026,
            month: 11,
            revision: 0,
            currentVersionId: source.versionId,
            latestInterpretationId: null,
            createdAt: source.createdAt,
        },
        draft: source,
        turns: [],
        operations: [operation],
    };
    useShiftEditorStore.getState().reset();
    useShiftEditorStore.getState().setDoc({
        columns: ['2026-11-01'],
        rows: [{workerId: '1', cells: ['O']}],
        workerMeta: {'1': {name: '김 간호사', nurseId: 1}},
        fixedCells: {},
        requestCells: {},
    });
    mocks.list.mockResolvedValue([current.conversation]);
    mocks.detail.mockImplementation(async () => current);
    mocks.preferences.mockResolvedValue([]);
    mocks.version.mockResolvedValue({...source, versionId: 'result:1', cells: [{...cell, wardShiftTypeId: 1, shiftCode: 'D'}]});
    mocks.execute.mockResolvedValue({...operation, executionStatus: 'FAILED', resultVersionId: null});
});
afterEach(() => {
    vi.clearAllTimers();
});

describe('persistent schedule sidebar', () => {
    it('loads records without re-executing and previews a result without mutating the editor', async () => {
        renderSidebar();
        await userEvent.click(await screen.findByRole('button', {name: /그때 표 보기|View this result/}));
        await screen.findByRole('dialog');
        expect(document.querySelector('.make-shift-calendar')).toBeInTheDocument();
        expect(useShiftEditorStore.getState().doc.rows[0]?.cells).toEqual(['O']);
        expect(mocks.applyAdjustedDoc).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(mocks.create).not.toHaveBeenCalled();
    });
    it('interprets a message without executing the solver before confirmation', async () => {
        mocks.interpret.mockImplementation(async () => {
            const turn = {
                eventId: 2,
                sequence: 2,
                actor: 'ASSISTANT',
                type: 'INTERPRETATION',
                text: null,
                interpretationId: 'i:1',
                baseRevision: 0,
                contextHash: 'rules:1',
                interpretation: {items: [], llmPrompt: '연속 근무를 줄여줘', strength: 'NORMAL' as const, unmapped: []},
                createdAt: source.createdAt,
            };

            current = {...current, turns: [turn], conversation: {...current.conversation, latestInterpretationId: 'i:1'}};

            return turn;
        });
        renderSidebar();
        await waitFor(() => expect(mocks.preferences).toHaveBeenCalled());
        await userEvent.type(screen.getByRole('textbox'), '연속 근무를 줄여줘');
        await userEvent.click(screen.getByRole('button', {name: /이해 확인|Review interpretation/}));
        await screen.findByText(/이렇게 이해했어요|Here is how I understood it/);
        expect(mocks.interpret).toHaveBeenCalledOnce();
        expect(mocks.execute).not.toHaveBeenCalled();
    });
    it('saved request suggestions only fill the composer', async () => {
        mocks.preferences.mockResolvedValue([
            {id: 1, category: 'REQUEST_TEXT', value: '휴무 균형을 맞춰줘', provenance: 'USER', confirmedAt: source.createdAt},
        ]);
        renderSidebar();
        await userEvent.click(await screen.findByText('휴무 균형을 맞춰줘'));
        expect(screen.getByRole('textbox')).toHaveValue('휴무 균형을 맞춰줘');
        expect(mocks.interpret).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
    });
    it('requires an explicit confirmation before rebuilding unlocked assignments', async () => {
        renderSidebar();
        await waitFor(() => expect(mocks.preferences).toHaveBeenCalled());
        await userEvent.click(screen.getByRole('button', {name: /배치를 다시 만들어 보기|Rebuild unlocked assignments/}));
        expect(mocks.execute).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', {name: /확인하고 다시 만들기|Confirm and rebuild/}));
        await waitFor(() => expect(mocks.execute).toHaveBeenCalledOnce());
        expect(mocks.execute.mock.calls[0]?.[1]).toMatchObject({
            operationType: 'GENERATE',
            fillPolicy: 'REBUILD_UNLOCKED',
            rebuildConfirmed: true,
        });
    });
});
