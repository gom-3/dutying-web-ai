import {describe, expect, it, vi} from 'vitest';
import {render, screen} from '@/shared/util/test-utils';
import RequestDutyRequestPanel from './RequestDutyRequestPanel';

vi.mock('@/entities/shift/ui/shift-badge', () => ({
    default: () => <div>shift-badge</div>,
}));

describe('RequestDutyRequestPanel', () => {
    it('신청 내역이 없으면 빈 상태를 일관된 PageState로 보여준다', () => {
        render(
            <RequestDutyRequestPanel
                month={6}
                dutyRequestList={[]}
                dutyRequestStatus="success"
                wardShiftTypeMap={new Map()}
                unresolvedRequestCount={0}
                readonly={true}
                updatingRequestId={null}
                shiftNurseIdByNurseId={new Map()}
                changeFocus={vi.fn()}
                acceptRequest={vi.fn().mockResolvedValue(undefined)}
                acceptRequests={vi.fn().mockResolvedValue(undefined)}
                retry={vi.fn()}
                onAcceptAnalytics={vi.fn()}
            />,
        );

        expect(screen.getByText('아직 반영된 신청 근무가 없어요')).toBeInTheDocument();
        expect(screen.getByText('수락된 신청이 생기면 이 패널에서 바로 확인할 수 있어요.')).toBeInTheDocument();
    });
});
