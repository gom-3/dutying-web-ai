import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import CreateShiftModal from './index';

describe('CreateShiftModal', () => {
    beforeEach(() => {
        const modalRoot = document.createElement('div');

        modalRoot.id = 'modal-root';
        document.body.appendChild(modalRoot);
    });

    afterEach(() => {
        document.querySelector('#modal-root')?.remove();
    });

    it('shows inline validation instead of alert when required fields are missing', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn();

        render(<CreateShiftModal open shiftType={null} close={vi.fn()} onSubmit={onSubmit} onDelete={vi.fn()} />);

        await user.click(screen.getByRole('button', {name: '저장'}));

        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent('근무 이름을 입력해주세요.');
    });
});
