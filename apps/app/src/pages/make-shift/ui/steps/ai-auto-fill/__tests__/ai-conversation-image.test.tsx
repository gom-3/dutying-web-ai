import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import {AiConversationImage} from '../ai-conversation-image';
import type {TResultVersion} from '../../../../model/schedule-conversation-api';
const mocks = vi.hoisted(() => ({capture: vi.fn()}));
vi.mock('html-to-image', () => ({toBlob: mocks.capture}));
vi.mock('../../shared/make-shift-calendar', () => ({MakeShiftCalendar: () => <div data-testid="capture-calendar">stored schedule</div>}));
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
    mocks.capture.mockResolvedValue(new Blob(['png']));
});
afterEach(() => vi.restoreAllMocks());
describe('result image', () => {
    it('captures stored version once, releases the calendar and reuses the image for zoom', async () => {
        const load = vi.fn().mockResolvedValue(version);
        const {unmount} = render(<AiConversationImage cacheKey="test-one" versionId={version.versionId} loadVersion={load} />);
        await screen.findByRole('button', {name: '근무표 이미지 크게 보기'});
        expect(load).toHaveBeenCalledWith('image-test');
        expect(screen.queryByTestId('capture-calendar')).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: '근무표 이미지 크게 보기'}));
        await userEvent.click(screen.getByRole('button', {name: '확대하기'}));
        expect(screen.getByRole('button', {name: '화면에 맞추기'})).toBeInTheDocument();
        expect(mocks.capture).toHaveBeenCalledTimes(1);
        unmount();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:preview');
        render(<AiConversationImage cacheKey="test-one" versionId={version.versionId} loadVersion={load} />);
        await screen.findByRole('button', {name: '근무표 이미지 크게 보기'});
        expect(load).toHaveBeenCalledTimes(1);
    });
    it('recovers from a version load failure without running generation', async () => {
        const load = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(version);
        render(<AiConversationImage cacheKey="test-retry" versionId={version.versionId} loadVersion={load} />);
        await userEvent.click(await screen.findByRole('button', {name: '이미지 다시 불러오기'}));
        await waitFor(() => expect(screen.getByRole('button', {name: '근무표 이미지 크게 보기'})).toBeInTheDocument());
        expect(load).toHaveBeenCalledTimes(2);
    });
});
