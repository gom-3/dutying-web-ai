import {useState} from 'react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {WardAPI} from '@/shared/api';
import {render, screen, userEvent, waitFor} from '@/shared/util/test-utils';
import RequestReceptionSettingsModal from '../request-reception-settings-modal';

const translations: Record<string, string> = {
    'page.wardSettings.tabs.requestReception': '신청근무 접수',
    'page.wardSettings.description.requestReception': '신청근무 접수 기간을 관리해요.',
    'page.wardSettings.requestReception.loading': '신청근무 접수 설정을 불러오는 중이에요',
    'page.wardSettings.requestReception.toggleTitle': '접수 기간 제한 사용',
    'page.wardSettings.requestReception.toggleDescription': '설정한 기간에만 앱에서 신청근무를 제출하거나 수정할 수 있어요.',
    'page.wardSettings.requestReception.save': '저장하기',
    'page.wardSettings.requestReception.toast.saveSuccess': '신청근무 접수 설정을 저장했어요.',
    'shared.confirmActionDialog.close': '닫기',
};

vi.mock('@/features/auth', () => ({
    default: () => ({
        state: {
            wardId: 273,
        },
    }),
}));

vi.mock('@/shared/api', () => ({
    WardAPI: {
        getReqShiftReceptionSettings: vi.fn(),
        updateReqShiftReceptionSettings: vi.fn(),
    },
}));

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string, params?: Record<string, string | number>) => {
            const template = translations[key] ?? key;

            return template.replace(/\{\{(\w+)\}\}/g, (_, token) => String(params?.[token] ?? ''));
        },
    }),
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
    },
}));

const settings = {
    enabled: false,
    startDay: 1,
    startTime: '00:00',
    endDay: 15,
    endTime: '23:59',
    notifyOnOpen: true,
    notifyBeforeDeadline: true,
    notifyBeforeDeadlineHours: 24,
};

function OpenModalHarness() {
    const [open, setOpen] = useState(true);

    return <RequestReceptionSettingsModal open={open} onOpenChange={setOpen} />;
}

describe('RequestReceptionSettingsModal', () => {
    beforeEach(() => {
        vi.mocked(WardAPI.getReqShiftReceptionSettings).mockReset();
        vi.mocked(WardAPI.updateReqShiftReceptionSettings).mockReset();
        vi.mocked(WardAPI.getReqShiftReceptionSettings).mockResolvedValue(settings);
        vi.mocked(WardAPI.updateReqShiftReceptionSettings).mockResolvedValue(settings);
    });

    it('저장에 성공하면 모달을 닫는다', async () => {
        const user = userEvent.setup();

        render(<OpenModalHarness />);

        expect(await screen.findByRole('dialog', {name: '신청근무 접수'})).toBeInTheDocument();

        await user.click(await screen.findByRole('button', {name: '저장하기'}));

        await waitFor(() => {
            expect(WardAPI.updateReqShiftReceptionSettings).toHaveBeenCalledWith(273, settings);
        });
        await waitFor(() => {
            expect(screen.queryByRole('dialog', {name: '신청근무 접수'})).not.toBeInTheDocument();
        });
    });
});
