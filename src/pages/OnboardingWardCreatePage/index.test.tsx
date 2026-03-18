import {screen, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {render, userEvent} from '@/shared/util/test-utils';
import OnboardingWardCreatePage from './index';

const toastSuccess = vi.fn();

vi.mock('react-hot-toast', () => ({
    default: {
        success: (...args: unknown[]) => toastSuccess(...args),
    },
}));

describe('OnboardingWardCreatePage', () => {
    it('uploads a mock file and moves through onboarding steps', async () => {
        const user = userEvent.setup();
        const {container} = render(<OnboardingWardCreatePage />);
        const uploadInput = container.querySelector('input[type="file"]') as HTMLInputElement;

        await user.upload(uploadInput, new File(['mock'], 'march-duty.xlsx', {type: 'application/vnd.ms-excel'}));

        expect(screen.getByText('업로드됨: march-duty.xlsx')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '다음'}));

        expect(screen.getByText('근무 유형')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: '다음'}));

        expect(screen.getAllByText('간호사 추가하기')[0]).toBeInTheDocument();
    });

    it('updates skill level config and creates a mock payload on completion', async () => {
        const user = userEvent.setup();

        render(<OnboardingWardCreatePage />);

        await user.click(screen.getByRole('button', {name: '건너뛰기'}));
        await user.click(screen.getByRole('button', {name: '다음'}));
        await user.click(screen.getByRole('button', {name: '다음'}));
        await user.click(screen.getByRole('button', {name: '숙련도 설정'}));

        expect(screen.getByRole('dialog')).toBeInTheDocument();

        await user.selectOptions(screen.getByDisplayValue('5단계'), '3');
        await user.click(within(screen.getByRole('dialog')).getByRole('button', {name: '완료'}));

        expect(screen.getAllByText('LV. 3').length).toBeGreaterThan(0);

        await user.click(screen.getByRole('button', {name: '완료'}));

        expect(screen.getByTestId('mock-create-ward-payload')).toBeInTheDocument();
        expect(screen.getByText('Mock CreateWard Payload')).toBeInTheDocument();
        expect(toastSuccess).toHaveBeenCalled();
    });
});
