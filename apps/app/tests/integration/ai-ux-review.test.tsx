import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent, within, fireEvent} from '../../src/shared/util/test-utils';
import {useShiftEditorStore} from '../../src/features/shift-editor';
import {Review, resetReviewFixture, restoreReviewFixture, saveReviewFixture} from './ai-ux-review';
import {reviewConditions} from './ai-ux-review-request';

afterEach(() => vi.unstubAllGlobals());

beforeEach(() => {
    resetReviewFixture();
    // Rendering/interaction tests mock the model; the visible review calls the native dev endpoint.
    vi.stubGlobal(
        'fetch',
        vi.fn(async (_url: string, options: RequestInit) => {
            const request = JSON.parse(options.body as string);
            const conditions = reviewConditions(
                request.text,
                request.context.nurses.map((nurse: {name: string}) => nurse.name),
                2026,
                11,
            );
            if (!conditions) throw new Error('Unexpected synthetic request');
            return new Response(
                JSON.stringify({
                    status: 'PREVIEW_READY',
                    summary: '요청 조건을 확인했어요.',
                    resolvedIntents: conditions,
                    verificationReport: {
                        reasonCodes: [],
                        groundingStatus: 'CHECKED',
                        coverageStatus: 'CHECKED',
                        compileEquivalenceStatus: 'VERIFIED',
                    },
                }),
                {status: 200, headers: {'Content-Type': 'application/json'}},
            );
        }),
    );
});

describe('local UI review', () => {
    it(
        'restores an earlier autofill and its before/after tables after a page reload',
        async () => {
            const page = render(<Review />);
            const chat = () => within(screen.getByLabelText('AI 자동채우기'));
            const originalCells = structuredClone(useShiftEditorStore.getState().doc.rows.map((row) => row.cells));
            await userEvent.click(await chat().findByRole('button', {name: '그대로 한 번 더 돌려볼래요'}));
            await userEvent.click(chat().getByRole('button', {name: '다시 자동채우기'}));
            expect(await chat().findByText(/근무표를 채웠어요!/)).toBeVisible();
            const generatedCells = structuredClone(useShiftEditorStore.getState().doc.rows.map((row) => row.cells));
            expect(generatedCells).not.toEqual(originalCells);
            saveReviewFixture();
            page.unmount();
            useShiftEditorStore.getState().reset();

            expect(restoreReviewFixture()).toBe(true);
            render(<Review />);
            expect(await chat().findByText(/^자동완성 1회차 · 완료$/)).toBeVisible();
            expect(useShiftEditorStore.getState().doc.rows.map((row) => row.cells)).toEqual(generatedCells);
            await userEvent.click(chat().getByRole('button', {name: '전후 비교'}));
            const comparison = within(await screen.findByRole('dialog'));
            await userEvent.click(comparison.getByRole('button', {name: '실행 전', exact: true}));
            expect(comparison.getByRole('button', {name: '실행 전', exact: true})).toHaveAttribute('aria-pressed', 'true');
            await userEvent.click(comparison.getByRole('button', {name: '실행 결과', exact: true}));
            expect(comparison.getByRole('button', {name: '실행 결과', exact: true})).toHaveAttribute('aria-pressed', 'true');
            await userEvent.click(comparison.getByRole('button', {name: '미리보기 닫기'}));
            expect(useShiftEditorStore.getState().doc.rows.map((row) => row.cells)).toEqual(generatedCells);
            expect(chat().getByText(/^자동완성 1회차 · 완료$/)).toBeVisible();
        },
        Number(process.env.DUTYING_UI_REVIEW_TIMEOUT_MS ?? 30000),
    );
    it('keeps the schedule visible through regenerate, new chat, adjustment, close and reopen', async () => {
        render(<Review />);
        // Query the chat only: role/name scans across the 240 calendar cells dominate JSDOM time.
        const chat = () => within(screen.getByLabelText('AI 자동채우기'));
        expect(screen.queryByRole('navigation', {name: '검토 화면 선택'})).not.toBeInTheDocument();
        expect(screen.queryByRole('link', {name: '시작'})).not.toBeInTheDocument();
        const regenerate = await chat().findByRole('button', {name: '그대로 한 번 더 돌려볼래요'});

        expect(chat().queryByRole('textbox')).not.toBeInTheDocument();
        expect(chat().queryByRole('button', {name: '서버 작업표 불러오기'})).not.toBeInTheDocument();
        expect(chat().queryByRole('button', {name: '요청 저장'})).not.toBeInTheDocument();
        expect(chat().queryByText(/대상·기간·조건을 모두 포함/)).not.toBeInTheDocument();
        await userEvent.click(regenerate);
        expect(screen.getByText('2026년 11월 근무표')).toBeVisible();
        await userEvent.click(chat().getByRole('button', {name: '다시 자동채우기'}));
        expect(await chat().findByText(/근무표를 채웠어요!/)).toBeInTheDocument();
        expect(screen.getByText('2026년 11월 근무표')).toBeVisible();
        await userEvent.click(chat().getByRole('button', {name: '새 요청'}));
        expect(chat().getByText(/^자동완성 1회차 · 완료$/)).toBeVisible();
        expect(chat().getAllByText('여기서부터 새 요청 · 현재 표 기준').at(-1)).toBeVisible();
        await userEvent.click(await chat().findByRole('button', {name: '수정하고 싶은 부분이 있어요'}));
        expect(chat().getByText('어떤 점을 바꾸고 싶나요?')).toBeVisible();
        expect(chat().getByRole('textbox', {name: '바꾸고 싶은 내용'})).toHaveFocus();
        expect(chat().queryByRole('button', {name: '요청 저장'})).not.toBeInTheDocument();
        const examples = chat().getByRole('region', {name: '이렇게 요청해 보세요'});

        expect(within(examples).getAllByRole('button')).toHaveLength(3);
        await userEvent.click(within(examples).getByRole('button', {name: '간호사 1 1~5일 N 근무 없게 해줘'}));
        expect(chat().getByRole('textbox', {name: '바꾸고 싶은 내용'})).toHaveValue('간호사 1 1~5일 N 근무 없게 해줘');
        expect(chat().queryByRole('region', {name: '요청 조건 확인'})).not.toBeInTheDocument();
        await userEvent.clear(chat().getByRole('textbox', {name: '바꾸고 싶은 내용'}));
        fireEvent.change(chat().getByRole('textbox', {name: '바꾸고 싶은 내용'}), {
            target: {value: '신규 간호사 2는 11월 1~5일 N 근무 없이 배정하고, 간호사 3은 12일 O로 배정해줘.'},
        });
        await userEvent.click(chat().getByRole('button', {name: '요청 보내기'}));
        await userEvent.click((await chat().findAllByRole('button', {name: '이 조건으로 조절'})).at(-1)!);
        expect((await chat().findAllByText('이 조건으로 근무표를 조절했어요.')).at(-1)).toBeInTheDocument();
        expect(chat().getByText('더 바꾸고 싶은 점이 있나요?')).toBeVisible();
        await userEvent.click(chat().getByRole('button', {name: '닫기'}));
        expect(screen.getByText('2026년 11월 근무표')).toBeVisible();
        expect(screen.queryByRole('complementary', {name: 'AI 자동채우기'})).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: 'AI 자동채우기'}));
        expect(screen.getByRole('complementary', {name: 'AI 자동채우기'})).toBeVisible();
        expect(chat().getByText(/^자동완성 1회차 · 완료$/)).toBeVisible();
        expect(chat().getByText(/^조절 1회차 · 완료$/)).toBeVisible();
        expect(chat().getAllByRole('button', {name: '전후 비교'})).toHaveLength(2);
    }, Number(process.env.DUTYING_UI_REVIEW_TIMEOUT_MS ?? 30000));
    it('interprets nurse 1 and an inclusive period without leaking other requests', async () => {
        render(<Review />);
        const chat = () => within(screen.getByLabelText('AI 자동채우기'));
        await userEvent.click(await chat().findByRole('button', {name: '수정하고 싶은 부분이 있어요'}));
        const before = structuredClone(useShiftEditorStore.getState().doc);

        fireEvent.change(chat().getByRole('textbox', {name: '바꾸고 싶은 내용'}), {target: {value: '간호사 1 5일까지 N 없게 해줘.'}});
        await userEvent.click(chat().getByRole('button', {name: '요청 보내기'}));
        const review = (await chat().findAllByRole('region', {name: '요청 조건 확인'})).at(-1)!;

        expect(within(review).getByText('간호사 1')).toBeVisible();
        expect(within(review).getByText('11월 1~5일')).toBeVisible();
        expect(within(review).queryByText('신규 간호사 2')).not.toBeInTheDocument();
        expect(within(review).queryByText('간호사 3')).not.toBeInTheDocument();
        expect(within(review).getAllByRole('listitem')).toHaveLength(1);
        await userEvent.click(within(review).getByRole('button', {name: '이 조건으로 조절'}));
        expect((await chat().findAllByText('이 조건으로 근무표를 조절했어요.')).at(-1)).toBeVisible();
        const after = useShiftEditorStore.getState().doc;

        expect(before.rows[0].cells.slice(0, 5)).toContain('N');
        expect(after.rows[0].cells.slice(0, 5)).not.toContain('N');
        expect(after.rows[0].cells.slice(5)).toEqual(before.rows[0].cells.slice(5));
        expect(after.rows.slice(1).map((row) => ({workerId: row.workerId, cells: row.cells}))).toEqual(
            before.rows.slice(1).map((row) => ({workerId: row.workerId, cells: row.cells})),
        );
        expect(after.rows.every((row) => (row.lastCells ?? []).every((cell) => cell === null))).toBe(true);
    }, Number(process.env.DUTYING_UI_REVIEW_TIMEOUT_MS ?? 30000));
    it('uses a specific model clarification and retains the original request when answered', async () => {
        render(<Review />);
        const chat = () => within(screen.getByLabelText('AI 자동채우기'));
        await userEvent.click(await chat().findByRole('button', {name: '수정하고 싶은 부분이 있어요'}));
        const ambiguous = '간호사 1에 1~5일 근무를 없애줘.';
        const question = '간호사 1의 1~5일을 빈칸으로 지울까요, O 근무를 배정할까요?';
        const llm = vi.fn(async (_url: string, options: RequestInit) => {
            const request = JSON.parse(options.body as string);
            const answered = request.text.includes('추가 답변:');
            return new Response(
                JSON.stringify({
                    status: answered ? 'PREVIEW_READY' : 'NEEDS_CLARIFICATION',
                    summary: answered ? '요청 조건을 확인했어요.' : question,
                    resolvedIntents: answered
                        ? [
                              {
                                  intentId: 'live-intent',
                                  action: 'ASSIGN',
                                  nurseIds: [1],
                                  dates: ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'],
                                  shiftCodes: ['O'],
                                  quantifier: 'EACH',
                                  modality: 'HARD',
                                  operator: null,
                                  count: null,
                                  sourceSpan: {quote: request.text},
                              },
                          ]
                        : [],
                    verificationReport: {
                        reasonCodes: [],
                        groundingStatus: 'CHECKED',
                        coverageStatus: 'CHECKED',
                        compileEquivalenceStatus: 'VERIFIED',
                    },
                }),
                {status: 200, headers: {'Content-Type': 'application/json'}},
            );
        });
        vi.stubGlobal('fetch', llm);
        fireEvent.change(chat().getByRole('textbox'), {target: {value: ambiguous}});
        await userEvent.click(chat().getByRole('button', {name: '요청 보내기'}));
        expect(await chat().findByText(question)).toBeVisible();
        expect(llm).toHaveBeenCalledOnce();
        expect(chat().queryByRole('button', {name: '이 조건으로 조절'})).not.toBeInTheDocument();
        fireEvent.change(chat().getByRole('textbox'), {target: {value: 'O로 배정해줘.'}});
        await userEvent.click(chat().getByRole('button', {name: '요청 보내기'}));
        expect(await chat().findByRole('button', {name: '이 조건으로 조절'})).toBeEnabled();
        expect(llm).toHaveBeenCalledTimes(2);
        expect(JSON.parse(llm.mock.calls[1][1].body as string).text).toBe(`${ambiguous}\n추가 답변: O로 배정해줘.`);
        expect(chat().getByText('O로 배정해줘.')).toBeVisible();
        expect(chat().queryByText(`${ambiguous}\n추가 답변: O로 배정해줘.`)).not.toBeInTheDocument();
    }, Number(process.env.DUTYING_UI_REVIEW_TIMEOUT_MS ?? 30000));
});
