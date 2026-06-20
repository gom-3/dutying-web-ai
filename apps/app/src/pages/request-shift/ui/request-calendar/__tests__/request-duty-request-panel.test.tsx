import {useState} from 'react';
import toast from 'react-hot-toast';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {type TDutyRequest} from '@/entities/shift';
import {act, fireEvent, render, screen, userEvent, waitFor, within} from '@/shared/util/test-utils';
import RequestDutyRequestPanel from '../request-duty-request-panel';

const translations: Record<string, string> = {
    'page.request.panel.readonlyTitle': '반영된 신청 근무',
    'page.request.panel.sortOrder': '신청순',
    'page.request.panel.emptyTitleReadonly': '아직 반영된 신청 근무가 없어요',
    'page.request.panel.emptyDescriptionReadonly': '반영된 신청이 생기면 이 패널에서 바로 확인할 수 있어요.',
    'page.request.panel.editTitle': 'Review requests',
    'page.request.panel.emptyTitleEdit': '간호사가 보낸\n신청근무 요청이 없어요',
    'page.request.panel.sortByDate': 'Date',
    'page.request.panel.sortByNurse': 'Nurse',
    'page.request.panel.sortByRequestOrder': 'Order',
    'page.request.panel.sortByPending': 'Pending',
    'page.request.panel.viewModeLabel': 'Request review sorting',
    'page.request.panel.dateLabel': '{{month}}/{{date}}',
    'page.request.panel.viewOnCalendar': 'View on schedule',
    'page.request.panel.accept': 'Accept',
    'page.request.panel.reject': 'Reject',
    'page.request.panel.acceptedState': 'Accepted',
    'page.request.panel.rejectedState': 'Rejected',
    'page.request.panel.acceptedToast': "{{nurseName}}'s {{shiftType}} request accepted.",
    'page.request.panel.rejectedToast': "{{nurseName}}'s {{shiftType}} request rejected.",
};

vi.mock('@/entities/shift/ui/shift-badge', () => ({
    default: () => <div>shift-badge</div>,
}));

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string, values?: Record<string, string | number>) =>
            (translations[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(values?.[token] ?? '')),
    }),
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
    },
}));

const createDutyRequest = (overrides: Partial<TDutyRequest> = {}): TDutyRequest => ({
    wardReqShiftId: 1,
    nurseId: 10,
    nurseName: 'Kim',
    date: 1,
    requestDate: '2026-06-01',
    wardShiftTypeId: 100,
    wardShiftTypeShortName: 'D',
    wardShiftTypeColor: '#7457FF',
    isRead: true,
    isAccepted: null,
    ...overrides,
});

describe('RequestDutyRequestPanel', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.clearAllMocks();
    });

    it('신청 내역이 없으면 빈 상태를 일관된 PageState로 보여준다', () => {
        render(
            <RequestDutyRequestPanel
                year={2026}
                month={6}
                days={[]}
                dutyRequestList={[]}
                dutyRequestStatus="success"
                wardShiftTypeMap={new Map()}
                canEdit={false}
                updatingRequestId={null}
                shiftNurseIdByNurseId={new Map()}
                changeFocus={vi.fn()}
                acceptRequest={vi.fn().mockResolvedValue(true)}
                acceptRequests={vi.fn().mockResolvedValue(true)}
                retry={vi.fn()}
                onAcceptAnalytics={vi.fn()}
            />,
        );

        expect(screen.getByText('아직 반영된 신청 근무가 없어요')).toBeInTheDocument();
        expect(screen.getByText('반영된 신청이 생기면 이 패널에서 바로 확인할 수 있어요.')).toBeInTheDocument();
    });

    it('edit mode empty title keeps the requested line break', () => {
        render(
            <RequestDutyRequestPanel
                year={2026}
                month={6}
                days={[]}
                dutyRequestList={[]}
                dutyRequestStatus="success"
                wardShiftTypeMap={new Map()}
                canEdit
                updatingRequestId={null}
                shiftNurseIdByNurseId={new Map()}
                changeFocus={vi.fn()}
                acceptRequest={vi.fn().mockResolvedValue(true)}
                acceptRequests={vi.fn().mockResolvedValue(true)}
                retry={vi.fn()}
                onAcceptAnalytics={vi.fn()}
            />,
        );

        const heading = screen.getByRole('heading', {name: /간호사가 보낸\s+신청근무 요청이 없어요/});

        expect(heading).toHaveTextContent('간호사가 보낸\n신청근무 요청이 없어요', {normalizeWhitespace: false});
    });

    it('shows a toast after accepting or rejecting a request', async () => {
        const user = userEvent.setup();
        const acceptRequest = vi.fn().mockResolvedValue(true);

        render(
            <RequestDutyRequestPanel
                year={2026}
                month={6}
                days={[{day: 1, dayType: 'workday'}]}
                dutyRequestList={[createDutyRequest()]}
                dutyRequestStatus="success"
                wardShiftTypeMap={new Map()}
                canEdit
                updatingRequestId={null}
                shiftNurseIdByNurseId={new Map([[10, 20]])}
                changeFocus={vi.fn()}
                acceptRequest={acceptRequest}
                acceptRequests={vi.fn().mockResolvedValue(true)}
                retry={vi.fn()}
                onAcceptAnalytics={vi.fn()}
            />,
        );

        await user.click(screen.getByRole('button', {name: 'Accept'}));

        await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Kim's D request accepted."));

        await user.click(screen.getByRole('button', {name: 'Reject'}));

        await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Kim's D request rejected."));
    });

    it('does not send a request when clicking the already selected decision', async () => {
        const user = userEvent.setup();
        const acceptRequest = vi.fn().mockResolvedValue(true);

        render(
            <RequestDutyRequestPanel
                year={2026}
                month={6}
                days={[{day: 1, dayType: 'workday'}]}
                dutyRequestList={[createDutyRequest({isAccepted: true})]}
                dutyRequestStatus="success"
                wardShiftTypeMap={new Map()}
                canEdit
                updatingRequestId={null}
                shiftNurseIdByNurseId={new Map([[10, 20]])}
                changeFocus={vi.fn()}
                acceptRequest={acceptRequest}
                acceptRequests={vi.fn().mockResolvedValue(true)}
                retry={vi.fn()}
                onAcceptAnalytics={vi.fn()}
            />,
        );

        await user.click(screen.getByRole('button', {name: 'Accept'}));

        expect(acceptRequest).not.toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', {name: 'Reject'}));

        expect(acceptRequest).toHaveBeenCalledWith(1, false);
    });

    it('keeps the pending badge from being clipped by the review toggle', () => {
        render(
            <RequestDutyRequestPanel
                year={2026}
                month={6}
                days={[{day: 1, dayType: 'workday'}]}
                dutyRequestList={[createDutyRequest()]}
                dutyRequestStatus="success"
                wardShiftTypeMap={new Map()}
                canEdit
                updatingRequestId={null}
                shiftNurseIdByNurseId={new Map([[10, 20]])}
                changeFocus={vi.fn()}
                acceptRequest={vi.fn().mockResolvedValue(true)}
                acceptRequests={vi.fn().mockResolvedValue(true)}
                retry={vi.fn()}
                onAcceptAnalytics={vi.fn()}
            />,
        );

        const pendingToggle = screen.getByText('Pending').closest('button');

        if (!pendingToggle) throw new Error('Pending toggle not found');

        expect(pendingToggle).toHaveClass('overflow-visible');
        expect(pendingToggle).not.toHaveClass('truncate');
        expect(within(pendingToggle).getByText('1')).toHaveClass('-top-1.5');
    });

    it('keeps a decided pending request visible for 0.5 seconds before removing it', async () => {
        vi.useFakeTimers();

        function PendingRequestPanelHarness() {
            const [dutyRequestList, setDutyRequestList] = useState<TDutyRequest[]>([createDutyRequest()]);

            return (
                <RequestDutyRequestPanel
                    year={2026}
                    month={6}
                    days={[{day: 1, dayType: 'workday'}]}
                    dutyRequestList={dutyRequestList}
                    dutyRequestStatus="success"
                    wardShiftTypeMap={new Map()}
                    canEdit
                    updatingRequestId={null}
                    shiftNurseIdByNurseId={new Map([[10, 20]])}
                    changeFocus={vi.fn()}
                    acceptRequest={vi.fn().mockImplementation(async (reqShiftId: number, isAccepted: boolean) => {
                        setDutyRequestList((current) =>
                            current.map((request) => (request.wardReqShiftId === reqShiftId ? {...request, isAccepted} : request)),
                        );

                        return true;
                    })}
                    acceptRequests={vi.fn().mockResolvedValue(true)}
                    retry={vi.fn()}
                    onAcceptAnalytics={vi.fn()}
                    defaultReviewMode="pending"
                />
            );
        }

        render(<PendingRequestPanelHarness />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Accept'}));
            await Promise.resolve();
        });

        expect(screen.getByText('Kim')).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(499);
        });

        expect(screen.getByText('Kim')).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(1);
        });

        expect(screen.queryByText('Kim')).not.toBeInTheDocument();
    });
});
