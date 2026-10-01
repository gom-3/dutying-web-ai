import {describe, expect, it, vi} from 'vitest';
import {act, render, screen, userEvent} from '@/shared/util/test-utils';
import {ScheduleDownloadMenu} from '../schedule-download-menu';

describe('ScheduleDownloadMenu', () => {
    it('supports keyboard selection, escape and outside dismissal without starting a download', async () => {
        const image = vi.fn();
        const excel = vi.fn();

        render(
            <ScheduleDownloadMenu label="다운로드" disabled={false} isExporting={false} onDownloadImage={image} onDownloadExcel={excel} />,
        );

        const trigger = screen.getByRole('button', {name: '다운로드'});

        act(() => trigger.focus());
        await userEvent.keyboard('{ArrowDown}');
        expect(screen.getByRole('menuitem', {name: '이미지 다운로드'})).toHaveFocus();
        await userEvent.keyboard('{ArrowDown}');
        expect(screen.getByRole('menuitem', {name: '엑셀 다운로드'})).toHaveFocus();
        await userEvent.keyboard('{Escape}');
        expect(trigger).toHaveFocus();
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();

        await userEvent.click(trigger);
        await userEvent.click(document.body);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(image).not.toHaveBeenCalled();
        expect(excel).not.toHaveBeenCalled();

        act(() => trigger.focus());
        await userEvent.keyboard('{ArrowDown}{End}{Enter}');
        expect(excel).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('prevents opening the menu while a download is running', async () => {
        render(<ScheduleDownloadMenu label="다운로드" disabled isExporting onDownloadImage={vi.fn()} onDownloadExcel={vi.fn()} />);

        const trigger = screen.getByRole('button', {name: '다운로드'});

        expect(trigger).toBeDisabled();
        expect(trigger).toHaveAttribute('aria-busy', 'true');
        await userEvent.click(trigger);
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
});
