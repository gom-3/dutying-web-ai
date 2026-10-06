import {afterEach, describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent, within, fireEvent} from '../../src/shared/util/test-utils';
import {useShiftEditorStore} from '../../src/features/shift-editor';
import {Review} from './ai-ux-review';
import {reviewConditions} from './ai-ux-review-request';

afterEach(() => vi.unstubAllGlobals());

describe('local UI review', () => {
    it('keeps the schedule visible through regenerate, new chat, adjustment, close and reopen', async () => {
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
        render(<Review />);
        expect(screen.queryByRole('navigation', {name: '검토 화면 선택'})).not.toBeInTheDocument();
        expect(screen.queryByRole('link', {name: '시작'})).not.toBeInTheDocument();
        const regenerate = await screen.findByRole('button', {name: '그대로 한 번 더 돌려볼래요'});

        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '서버 작업표 불러오기'})).not.toBeInTheDocument();
        expect(screen.queryByRole('button', {name: '요청 저장'})).not.toBeInTheDocument();
        expect(screen.queryByText(/대상·기간·조건을 모두 포함/)).not.toBeInTheDocument();
        await userEvent.click(regenerate);
        expect(screen.getByRole('heading', {name: '2026년 11월 근무표'})).toBeVisible();
        await userEvent.click(screen.getByRole('button', {name: '다시 자동채우기'}));
        expect(await screen.findByText(/근무표를 채웠어요!/)).toBeInTheDocument();
        expect(screen.getByRole('heading', {name: '2026년 11월 근무표'})).toBeVisible();
        await userEvent.click(screen.getByRole('button', {name: '새 채팅'}));
        await userEvent.click(await screen.findByRole('button', {name: '수정하고 싶은 부분이 있어요'}));
        expect(screen.getByText('어떤 점을 바꾸고 싶나요?')).toBeVisible();
        expect(screen.getByRole('textbox', {name: '바꾸고 싶은 내용'})).toHaveFocus();
        expect(screen.queryByRole('button', {name: '요청 저장'})).not.toBeInTheDocument();
        const examples = screen.getByRole('region', {name: '이렇게 요청해 보세요'});

        expect(within(examples).getAllByRole('button')).toHaveLength(3);
        await userEvent.click(within(examples).getByRole('button', {name: '간호사 1 1~5일 N 근무 없게 해줘'}));
        expect(screen.getByRole('textbox', {name: '바꾸고 싶은 내용'})).toHaveValue('간호사 1 1~5일 N 근무 없게 해줘');
        expect(screen.queryByRole('region', {name: '요청 조건 확인'})).not.toBeInTheDocument();
        await userEvent.clear(screen.getByRole('textbox', {name: '바꾸고 싶은 내용'}));
        fireEvent.change(screen.getByRole('textbox', {name: '바꾸고 싶은 내용'}), {
            target: {value: '신규 간호사 2는 11월 1~5일 N 근무 없이 배정하고, 간호사 3은 12일 O로 배정해줘.'},
        });
        await userEvent.click(screen.getByRole('button', {name: '요청 보내기'}));
        await userEvent.click(await screen.findByRole('button', {name: '이 조건으로 조절'}));
        expect(await screen.findByText('이 조건으로 근무표를 조절했어요.')).toBeInTheDocument();
        expect(screen.getByText('더 바꾸고 싶은 점이 있나요?')).toBeVisible();
        await userEvent.click(screen.getByRole('button', {name: '닫기'}));
        expect(screen.getByRole('heading', {name: '2026년 11월 근무표'})).toBeVisible();
        expect(screen.queryByRole('complementary', {name: 'AI 자동채우기'})).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: 'AI 자동채우기'}));
        expect(screen.getByRole('complementary', {name: 'AI 자동채우기'})).toBeVisible();
        await userEvent.click(screen.getByRole('button', {name: '새 채팅'}));
        await userEvent.click(await screen.findByRole('button', {name: '수정하고 싶은 부분이 있어요'}));
        const before = structuredClone(useShiftEditorStore.getState().doc);

        fireEvent.change(screen.getByRole('textbox', {name: '바꾸고 싶은 내용'}), {target: {value: '간호사 1 5일까지 N 없게 해줘.'}});
        await userEvent.click(screen.getByRole('button', {name: '요청 보내기'}));
        const review = await screen.findByRole('region', {name: '요청 조건 확인'});

        expect(within(review).getByText('간호사 1')).toBeVisible();
        expect(within(review).getByText('11월 1~5일')).toBeVisible();
        expect(within(review).queryByText('신규 간호사 2')).not.toBeInTheDocument();
        expect(within(review).queryByText('간호사 3')).not.toBeInTheDocument();
        expect(within(review).getAllByRole('listitem')).toHaveLength(1);
        await userEvent.click(within(review).getByRole('button', {name: '이 조건으로 조절'}));
        expect(await screen.findByText('이 조건으로 근무표를 조절했어요.')).toBeVisible();
        const after = useShiftEditorStore.getState().doc;

        expect(before.rows[0].cells.slice(0, 5)).toContain('N');
        expect(after.rows[0].cells.slice(0, 5)).not.toContain('N');
        expect(after.rows[0].cells.slice(5)).toEqual(before.rows[0].cells.slice(5));
        expect(after.rows.slice(1)).toEqual(before.rows.slice(1));
        await userEvent.click(screen.getByRole('button', {name: '새 채팅'}));
        await userEvent.click(await screen.findByRole('button', {name: '수정하고 싶은 부분이 있어요'}));
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
        fireEvent.change(screen.getByRole('textbox'), {target: {value: ambiguous}});
        await userEvent.click(screen.getByRole('button', {name: '요청 보내기'}));
        expect(await screen.findByText(question)).toBeVisible();
        expect(llm).toHaveBeenCalledOnce();
        expect(screen.queryByRole('button', {name: '이 조건으로 조절'})).not.toBeInTheDocument();
        fireEvent.change(screen.getByRole('textbox'), {target: {value: 'O로 배정해줘.'}});
        await userEvent.click(screen.getByRole('button', {name: '요청 보내기'}));
        expect(await screen.findByRole('button', {name: '이 조건으로 조절'})).toBeEnabled();
        expect(llm).toHaveBeenCalledTimes(2);
        expect(JSON.parse(llm.mock.calls[1][1].body as string).text).toBe(`${ambiguous}\n추가 답변: O로 배정해줘.`);
        expect(screen.getByText('O로 배정해줘.')).toBeVisible();
        expect(screen.queryByText(`${ambiguous}\n추가 답변: O로 배정해줘.`)).not.toBeInTheDocument();
    }, 60000);
});
