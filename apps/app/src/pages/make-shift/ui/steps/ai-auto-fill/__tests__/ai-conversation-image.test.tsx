import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {TShift} from '@/entities/shift';
import type {TDutyDoc} from '@/features/shift-editor/model/types';
import i18n from '@/i18n';
import {act, render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import {saveConversationImage} from '../../../../model/conversation-image-cache';
import type {TResultVersion} from '../../../../model/schedule-conversation-api';
import {AiConversationImage} from '../ai-conversation-image';

const mocks = vi.hoisted(() => ({capture: vi.fn()}));

vi.mock('html-to-image', () => ({toBlob: mocks.capture}));
vi.mock('../../shared/make-shift-calendar', () => ({
    MakeShiftCalendar: ({doc, shift, readonly}: {doc: TDutyDoc; shift: TShift; readonly: boolean}) => (
        <div data-testid="capture-calendar" data-readonly={readonly}>
            {doc.rows.length
                ? `${shift.divisionShiftNurses.flat()[0]?.shiftNurse.name}: ${doc.rows[0].cells.join(',')}`
                : 'stored schedule'}
        </div>
    ),
}));

const version: TResultVersion = {
    versionId: 'image-test',
    parentVersionId: null,
    year: 2026,
    month: 10,
    cells: [],
    rowOrder: [],
    carryOverCells: [],
    constraintsJson: '{}',
    inputDigest: 'i',
    createdAt: '',
};

beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', undefined);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    mocks.capture.mockReset().mockResolvedValue(new Blob(['png']));
});
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});
describe('schedule exploration preview', () => {
    it('captures a supplied immutable calendar snapshot without fetching a result version', async () => {
        const onOpen = vi.fn();
        const snapshot = {
            doc: {
                columns: ['2026-10-01'],
                rows: [{workerId: '1', cells: ['D']}],
                workerMeta: {'1': {name: '기존 간호사'}},
                fixedCells: {},
                requestCells: {},
            },
            shift: {
                days: [{day: 1, dayType: 'workday'}],
                lastDays: [],
                wardShiftTypes: [],
                divisionShiftNurses: [
                    [
                        {
                            shiftNurse: {
                                shiftNurseId: 1,
                                nurseId: 1,
                                name: '기존 간호사',
                                isWorker: true,
                                divisionNum: 0,
                                priority: 0,
                                carried: 0,
                            },
                            wardShiftList: [1],
                            wardReqShiftList: [null],
                            lastWardShiftList: [],
                            lastWardReqShiftList: [],
                        },
                    ],
                ],
            } as TShift,
        };

        render(<AiConversationImage cacheKey="test-direct-snapshot" versionId="local:1" snapshot={snapshot} onOpen={onOpen} />);
        await screen.findByRole('img', {name: '근무표 결과 이미지'});

        const capture = mocks.capture.mock.calls[0][0] as HTMLElement;

        expect(capture).toHaveTextContent('기존 간호사: D');
        expect(capture.querySelector('[data-testid="capture-calendar"]')).toHaveAttribute('data-readonly', 'true');
        expect(mocks.capture).toHaveBeenCalledOnce();
        await userEvent.click(screen.getByRole('button', {name: '근무표 살펴보기'}));
        expect(onOpen).toHaveBeenCalledWith(screen.getByRole('button', {name: '근무표 살펴보기'}));
    });
    it('retries a direct snapshot capture without requiring a server version loader', async () => {
        mocks.capture.mockRejectedValueOnce(new Error('capture failed'));

        const onOpen = vi.fn();
        const snapshot = {
            doc: {columns: [], rows: [], workerMeta: {}, fixedCells: {}, requestCells: {}},
            shift: {days: [], lastDays: [], wardShiftTypes: [], divisionShiftNurses: []} as TShift,
        };

        render(<AiConversationImage cacheKey="test-direct-retry" versionId="local:2" snapshot={snapshot} onOpen={onOpen} />);

        const retry = await screen.findByRole('button', {name: '미리보기 다시 불러오기'});

        await userEvent.click(screen.getByRole('button', {name: '근무표 살펴보기'}));
        expect(onOpen).toHaveBeenCalledOnce();
        await userEvent.click(retry);
        await screen.findByRole('img', {name: '근무표 결과 이미지'});
        expect(mocks.capture).toHaveBeenCalledTimes(2);
        expect(screen.queryByRole('button', {name: '미리보기 다시 불러오기'})).not.toBeInTheDocument();
    });
    it('replaces a captured image when the same tile receives a different result source', async () => {
        const snapshot = {
            doc: {
                columns: ['2026-10-01'],
                rows: [{workerId: '1', cells: ['D']}],
                workerMeta: {'1': {name: '간호사'}},
                fixedCells: {},
                requestCells: {},
            },
            shift: {days: [], lastDays: [], wardShiftTypes: [], divisionShiftNurses: []} as TShift,
        };
        const onOpen = vi.fn();
        const view = render(
            <AiConversationImage cacheKey="test-source-change" versionId="local:before" snapshot={snapshot} onOpen={onOpen} />,
        );

        await screen.findByRole('img', {name: '근무표 결과 이미지'});
        expect(mocks.capture.mock.calls[0][0]).toHaveTextContent(': D');
        view.rerender(
            <AiConversationImage
                cacheKey="test-source-change"
                versionId="local:after"
                snapshot={{...snapshot, doc: {...snapshot.doc, rows: [{workerId: '1', cells: ['N']}]}}}
                onOpen={onOpen}
            />,
        );
        await waitFor(() => expect(mocks.capture).toHaveBeenCalledTimes(2));
        await screen.findByRole('img', {name: '근무표 결과 이미지'});
        expect(mocks.capture.mock.calls[1][0]).toHaveTextContent(': N');
        expect(mocks.capture.mock.calls[1][0]).not.toHaveTextContent(': D');
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
        await userEvent.click(screen.getByRole('button', {name: '근무표 살펴보기'}));
        expect(onOpen).toHaveBeenCalledOnce();
    });
    it('defers the full local calendar until its tile is visible and releases it after capture', async () => {
        let reveal!: () => void;

        vi.stubGlobal(
            'IntersectionObserver',
            class {
                constructor(callback: (entries: {isIntersecting: boolean}[]) => void) {
                    reveal = () => callback([{isIntersecting: true}]);
                }
                observe = vi.fn();
                disconnect = vi.fn();
            },
        );

        const snapshot = {
            doc: {columns: [], rows: [], workerMeta: {}, fixedCells: {}, requestCells: {}},
            shift: {days: [], lastDays: [], wardShiftTypes: [], divisionShiftNurses: []} as TShift,
        };

        render(<AiConversationImage cacheKey="test-direct-deferred" versionId="local:3" snapshot={snapshot} onOpen={vi.fn()} />);
        expect(screen.queryByTestId('capture-calendar')).not.toBeInTheDocument();
        expect(mocks.capture).not.toHaveBeenCalled();
        await act(async () => reveal());
        await screen.findByRole('img', {name: '근무표 결과 이미지'});
        expect(mocks.capture).toHaveBeenCalledOnce();
        expect(screen.queryByTestId('capture-calendar')).not.toBeInTheDocument();
    });
    it('opens the parent viewer by keyboard from one labeled tile without opening an image dialog', async () => {
        const load = vi.fn().mockResolvedValue(version);
        const onOpen = vi.fn();

        render(<AiConversationImage cacheKey="test-keyboard" versionId={version.versionId} loadVersion={load} onOpen={onOpen} />);
        await screen.findByRole('img', {name: '근무표 결과 이미지'});

        const preview = screen.getByRole('button', {name: '근무표 살펴보기'});

        expect(screen.queryByText('근무표 살펴보기')).not.toBeInTheDocument();
        expect(screen.queryByText('전체 보기 · 변경 전후 비교')).not.toBeInTheDocument();
        expect(screen.queryByText('눌러서 크게 보기')).not.toBeInTheDocument();
        expect(screen.getAllByRole('button')).toHaveLength(1);
        expect(load).toHaveBeenCalledWith('image-test');
        expect(screen.queryByTestId('capture-calendar')).not.toBeInTheDocument();
        await userEvent.tab();
        expect(preview).toHaveFocus();
        await userEvent.keyboard('{Enter}');
        expect(onOpen).toHaveBeenLastCalledWith(preview);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await userEvent.keyboard(' ');
        expect(onOpen).toHaveBeenCalledTimes(2);
        expect(mocks.capture).toHaveBeenCalledTimes(1);
    });
    it('opens the stored schedule immediately while its thumbnail is still loading', async () => {
        let resolveVersion!: (value: TResultVersion) => void;

        const load = vi.fn(() => new Promise<TResultVersion>((resolve) => (resolveVersion = resolve)));
        const onOpen = vi.fn();

        render(<AiConversationImage cacheKey="test-pending" versionId={version.versionId} loadVersion={load} onOpen={onOpen} />);

        const preview = screen.getByRole('button', {name: '근무표 살펴보기'});

        expect(screen.getByRole('status')).toHaveTextContent('미리보기 준비 중');
        expect(preview).toBeEnabled();
        await userEvent.click(preview);
        expect(onOpen).toHaveBeenCalledWith(preview);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        resolveVersion(version);
        await screen.findByRole('img', {name: '근무표 결과 이미지'});
    });
    it('uses a cached thumbnail without fetching or capturing and releases its object URL', async () => {
        const cached = new Blob(['cached image']);
        const load = vi.fn().mockResolvedValue(version);
        const onOpen = vi.fn();

        saveConversationImage(`test-cached:${version.versionId}:${i18n.language}`, cached);

        const {unmount} = render(
            <AiConversationImage cacheKey="test-cached" versionId={version.versionId} loadVersion={load} onOpen={onOpen} />,
        );
        const image = await screen.findByRole('img', {name: '근무표 결과 이미지'});

        expect(image).toHaveAttribute('src', 'blob:preview');
        expect(URL.createObjectURL).toHaveBeenCalledWith(cached);
        expect(load).not.toHaveBeenCalled();
        expect(mocks.capture).not.toHaveBeenCalled();
        expect(screen.queryByText('전체 근무표 확인')).not.toBeInTheDocument();
        await userEvent.click(image);
        expect(onOpen).toHaveBeenCalledWith(screen.getByRole('button', {name: '근무표 살펴보기'}));
        unmount();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
    });
    it('keeps the schedule accessible after a load failure and offers a separate preview retry', async () => {
        const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(version);
        const onOpen = vi.fn();

        render(<AiConversationImage cacheKey="test-load-retry" versionId={version.versionId} loadVersion={load} onOpen={onOpen} />);

        const retry = await screen.findByRole('button', {name: '미리보기 다시 불러오기'});
        const preview = screen.getByRole('button', {name: '근무표 살펴보기'});

        expect(preview).toBeEnabled();
        expect(preview).not.toContainElement(retry);
        expect(screen.getByRole('status')).toHaveTextContent('미리보기 없이도 근무표를 살펴볼 수 있어요.');
        await userEvent.click(preview);
        expect(onOpen).toHaveBeenCalledWith(preview);
        await userEvent.click(retry);
        await screen.findByRole('img', {name: '근무표 결과 이미지'});
        expect(load).toHaveBeenCalledTimes(2);
        expect(mocks.capture).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('button', {name: '미리보기 다시 불러오기'})).not.toBeInTheDocument();
    });
    it('keeps the schedule accessible after capture fails and can regenerate only the thumbnail', async () => {
        mocks.capture.mockRejectedValueOnce(new Error('capture failed'));

        const load = vi.fn().mockResolvedValue(version);
        const onOpen = vi.fn();

        render(<AiConversationImage cacheKey="test-capture-retry" versionId={version.versionId} loadVersion={load} onOpen={onOpen} />);

        const retry = await screen.findByRole('button', {name: '미리보기 다시 불러오기'});
        const preview = screen.getByRole('button', {name: '근무표 살펴보기'});

        await userEvent.click(preview);
        expect(onOpen).toHaveBeenCalledWith(preview);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        await userEvent.click(retry);
        await screen.findByRole('img', {name: '근무표 결과 이미지'});
        expect(load).toHaveBeenCalledTimes(2);
        expect(mocks.capture).toHaveBeenCalledTimes(2);
    });
    it('reuses a captured thumbnail after remount and revokes each local object URL', async () => {
        const load = vi.fn().mockResolvedValue(version);
        const onOpen = vi.fn();
        const {unmount} = render(
            <AiConversationImage cacheKey="test-remount" versionId={version.versionId} loadVersion={load} onOpen={onOpen} />,
        );

        await screen.findByRole('img', {name: '근무표 결과 이미지'});
        unmount();
        expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);

        const next = render(
            <AiConversationImage cacheKey="test-remount" versionId={version.versionId} loadVersion={load} onOpen={onOpen} />,
        );

        await screen.findByRole('img', {name: '근무표 결과 이미지'});
        expect(load).toHaveBeenCalledTimes(1);
        expect(mocks.capture).toHaveBeenCalledTimes(1);
        next.unmount();
        expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
    });
    it('leaves an offscreen tile actionable while deferring expensive thumbnail capture', async () => {
        const observe = vi.fn();
        const disconnect = vi.fn();

        vi.stubGlobal(
            'IntersectionObserver',
            class {
                observe = observe;
                disconnect = disconnect;
            },
        );

        const load = vi.fn().mockResolvedValue(version);
        const onOpen = vi.fn();
        const {unmount} = render(
            <AiConversationImage cacheKey="test-offscreen" versionId={version.versionId} loadVersion={load} onOpen={onOpen} />,
        );

        await userEvent.click(screen.getByRole('button', {name: '근무표 살펴보기'}));
        expect(onOpen).toHaveBeenCalledWith(screen.getByRole('button', {name: '근무표 살펴보기'}));
        expect(observe).toHaveBeenCalledOnce();
        expect(load).not.toHaveBeenCalled();
        expect(mocks.capture).not.toHaveBeenCalled();
        unmount();
        expect(disconnect).toHaveBeenCalledOnce();
    });
    it('prevents duplicate viewer requests when disabled by its parent', async () => {
        const load = vi.fn().mockResolvedValue(version);
        const onOpen = vi.fn();

        render(<AiConversationImage cacheKey="test-disabled" versionId={version.versionId} loadVersion={load} onOpen={onOpen} disabled />);
        await screen.findByRole('img', {name: '근무표 결과 이미지'});
        await userEvent.click(screen.getByRole('button', {name: '근무표 살펴보기'}));
        await waitFor(() => expect(onOpen).not.toHaveBeenCalled());
        expect(screen.getByRole('button', {name: '근무표 살펴보기'})).toBeDisabled();
    });
});
