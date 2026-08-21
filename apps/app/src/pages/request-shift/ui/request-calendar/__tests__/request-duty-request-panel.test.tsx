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
    'page.request.panel.acceptAllAction': 'Accept all',
    'page.request.panel.pendingLabel': 'Pending',
    'page.request.panel.pendingRequestCount': '{{count}} pending requests',
    'page.request.panel.processedLabel': 'Processed',
    'page.request.panel.processedEmptyTitle': 'No processed requests',
    'page.request.panel.groupRequestCaseCount': '{{count}} requests',
    'page.request.panel.requestDateTimeLabel': 'Requested {{date}}',
    'page.request.panel.summaryLabel': 'Request processing status',
    'page.request.panel.viewModeLabel': 'Request review sorting',
    'page.request.panel.acceptAll': 'Accept {{count}} pending',
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
        const pendingRender = render(
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

        pendingRender.unmount();

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
                defaultReviewMode="processed"
            />,
        );

        await user.click(screen.getByRole('button', {name: 'Reject'}));

        await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Kim's D request rejected."));
    });

    it('accepts every pending request from the panel header', async () => {
        const user = userEvent.setup();
        const acceptRequests = vi.fn().mockResolvedValue(true);
        const onAcceptAnalytics = vi.fn();

        render(
            <RequestDutyRequestPanel
                year={2026}
                month={6}
                days={[{day: 1, dayType: 'workday'}]}
                dutyRequestList={[
                    createDutyRequest(),
                    createDutyRequest({wardReqShiftId: 2, nurseId: 11, nurseName: 'Lee', date: 2}),
                    createDutyRequest({wardReqShiftId: 3, nurseId: 12, nurseName: 'Park', isAccepted: true}),
                ]}
                dutyRequestStatus="success"
                wardShiftTypeMap={new Map()}
                canEdit
                updatingRequestId={null}
                shiftNurseIdByNurseId={new Map()}
                changeFocus={vi.fn()}
                acceptRequest={vi.fn().mockResolvedValue(true)}
                acceptRequests={acceptRequests}
                retry={vi.fn()}
                onAcceptAnalytics={onAcceptAnalytics}
            />,
        );

        await user.click(screen.getByRole('button', {name: 'Accept all'}));

        await waitFor(() => expect(acceptRequests).toHaveBeenCalledWith([1, 2], true));
        expect(onAcceptAnalytics).toHaveBeenCalledWith(true);
        expect(toast.success).toHaveBeenCalledWith('Accept 2 pending');
    });

    it('renders the accept-all action as icon text without the previous purple box', () => {
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
                shiftNurseIdByNurseId={new Map()}
                changeFocus={vi.fn()}
                acceptRequest={vi.fn().mockResolvedValue(true)}
                acceptRequests={vi.fn().mockResolvedValue(true)}
                retry={vi.fn()}
                onAcceptAnalytics={vi.fn()}
            />,
        );

        const acceptAllButton = screen.getByRole('button', {name: 'Accept all'});

        expect(acceptAllButton).toHaveClass('inline-flex');
        expect(acceptAllButton).toHaveClass('bg-transparent');
        expect(acceptAllButton).not.toHaveClass('bg-main-light');
        expect(acceptAllButton.querySelector('svg')).toBeInTheDocument();
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
                defaultReviewMode="processed"
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

    it('separates pending and processed requests into two status tabs', async () => {
        const user = userEvent.setup();

        render(
            <RequestDutyRequestPanel
                year={2026}
                month={6}
                days={[
                    {day: 1, dayType: 'workday'},
                    {day: 2, dayType: 'workday'},
                ]}
                dutyRequestList={[
                    createDutyRequest({wardReqShiftId: 1, nurseName: 'Pending nurse', date: 1}),
                    createDutyRequest({wardReqShiftId: 2, nurseName: 'Accepted nurse', date: 2, isAccepted: true}),
                    createDutyRequest({wardReqShiftId: 3, nurseName: 'Rejected nurse', date: 2, isAccepted: false}),
                ]}
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

        expect(screen.getByText('Pending nurse')).toBeInTheDocument();
        expect(screen.queryByText('Accepted nurse')).not.toBeInTheDocument();
        expect(screen.queryByText('Rejected nurse')).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: /Processed/})).not.toHaveTextContent('2');
        expect(screen.getByRole('button', {name: 'Accept all'})).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: /Processed/}));

        expect(screen.queryByText('Pending nurse')).not.toBeInTheDocument();
        expect(screen.getByText('Accepted nurse')).toBeInTheDocument();
        expect(screen.getByText('Rejected nurse')).toBeInTheDocument();
        expect(screen.queryByRole('button', {name: 'Accept all'})).not.toBeInTheDocument();
    });

    it('sorts requests within the selected status tab', async () => {
        const user = userEvent.setup();

        render(
            <RequestDutyRequestPanel
                year={2026}
                month={6}
                days={[{day: 1, dayType: 'workday'}]}
                dutyRequestList={[
                    createDutyRequest({wardReqShiftId: 1, nurseId: 12, nurseName: 'Zoe'}),
                    createDutyRequest({wardReqShiftId: 2, nurseId: 10, nurseName: 'Kim'}),
                    createDutyRequest({wardReqShiftId: 3, nurseId: 11, nurseName: 'Lee'}),
                    createDutyRequest({wardReqShiftId: 4, nurseId: 10, nurseName: 'Kim', date: 2}),
                ]}
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

        const sortSelect = screen.getByRole('combobox', {name: 'Request review sorting'});

        await user.selectOptions(sortSelect, 'nurse');

        expect(screen.getAllByText(/^(Kim|Lee|Zoe)$/).map((element) => element.textContent)).toEqual(['Kim', 'Lee', 'Zoe']);
        expect(screen.getByText('2 requests')).toBeInTheDocument();

        await user.selectOptions(sortSelect, 'request');

        expect(screen.getAllByText(/^Requested /)).toHaveLength(4);
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

    it('keeps the pending row stable while the decision response is still in flight', async () => {
        vi.useFakeTimers();

        let resolveRequest!: (accepted: boolean) => void;

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
                    acceptRequest={vi.fn().mockImplementation(
                        async (reqShiftId: number, isAccepted: boolean) =>
                            new Promise<boolean>((resolve) => {
                                setDutyRequestList((current) =>
                                    current.map((request) => (request.wardReqShiftId === reqShiftId ? {...request, isAccepted} : request)),
                                );
                                resolveRequest = resolve;
                            }),
                    )}
                    acceptRequests={vi.fn().mockResolvedValue(true)}
                    retry={vi.fn()}
                    onAcceptAnalytics={vi.fn()}
                />
            );
        }

        render(<PendingRequestPanelHarness />);

        await act(async () => {
            fireEvent.click(screen.getByRole('button', {name: 'Accept'}));
            await Promise.resolve();
        });

        expect(screen.getByText('Kim')).toBeInTheDocument();

        await act(async () => {
            resolveRequest(true);
            await Promise.resolve();
        });

        expect(screen.getByText('Kim')).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(500);
        });

        expect(screen.queryByText('Kim')).not.toBeInTheDocument();
    });
});
