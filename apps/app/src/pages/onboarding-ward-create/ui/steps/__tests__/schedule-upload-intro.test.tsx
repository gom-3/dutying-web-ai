import {act, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {ComponentProps} from 'react';
import {describe, expect, it, vi} from 'vitest';
import i18n from '@/i18n';
import ScheduleUploadIntro from '../schedule-upload-intro';

type TProps = ComponentProps<typeof ScheduleUploadIntro>;

const renderIntro = (overrides: Partial<TProps> = {}) => {
    const props: TProps = {
        targetYear: 2026,
        targetMonth: 11,
        uploadStatus: 'idle',
        uploadError: null,
        onManualEntry: vi.fn(),
        onUpload: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };

    return {...render(<ScheduleUploadIntro {...props} />), props};
};
const getChooseFileButton = () => screen.getByRole('button', {name: i18n.t('page.onboardingWardCreate.scheduleEntry.chooseFile')});
const getManualButton = () => screen.getByRole('button', {name: i18n.t('page.onboardingWardCreate.scheduleEntry.manualAction')});
const getMonthPickerButton = () => screen.getByRole('button', {name: /근무표 기준 월/});
const getUploadInput = () => screen.getByTestId('schedule-entry-upload-input');

describe('ScheduleUploadIntro', () => {
    it('uploads the selected file for the month the user chose', async () => {
        const user = userEvent.setup();
        const {props} = renderIntro();
        const file = new File(['schedule image'], '2026-09-roster.png', {type: 'image/png'});

        await user.click(getMonthPickerButton());
        await user.click(screen.getByRole('button', {name: '9월'}));
        await user.upload(getUploadInput(), file);

        expect(props.onUpload).toHaveBeenCalledExactlyOnceWith(file, {targetYear: 2026, targetMonth: 9});
        expect(props.onManualEntry).not.toHaveBeenCalled();
    });

    it('cancels browsing another year, then commits December of the previous year from January', async () => {
        const user = userEvent.setup();
        const {props} = renderIntro({targetMonth: 1});
        const trigger = getMonthPickerButton();
        const previousYear = i18n.t('page.onboardingWardCreate.scheduleEntry.previousYear');

        await user.click(trigger);

        const january = screen.getByRole('button', {name: '1월', pressed: true});

        expect(january).toHaveFocus();
        await user.click(screen.getByRole('button', {name: previousYear}));
        await user.keyboard('{Escape}');
        expect(trigger).toHaveFocus();
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(trigger).toHaveAccessibleName(/2026.*1월/);

        await user.click(trigger);
        expect(screen.getByRole('button', {name: '1월', pressed: true})).toHaveFocus();
        await user.click(screen.getByRole('button', {name: previousYear}));
        await user.click(screen.getByRole('button', {name: '12월'}));
        expect(trigger).toHaveAccessibleName(/2025.*12월/);
        expect(trigger).toHaveFocus();
        expect(trigger).toHaveAttribute('aria-expanded', 'false');

        const file = new File(['roster'], 'december.png', {type: 'image/png'});

        await user.upload(getUploadInput(), file);
        expect(props.onUpload).toHaveBeenCalledExactlyOnceWith(file, {targetYear: 2025, targetMonth: 12});
    });

    it('accepts a dropped Excel file and prevents duplicate imports while that upload is pending', async () => {
        let finishUpload = () => {};

        const onUpload = vi.fn(
            () =>
                new Promise<void>((resolve) => {
                    finishUpload = resolve;
                }),
        );
        const file = new File(['schedule workbook'], 'roster.xlsx', {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        renderIntro({onUpload});

        const dropZone = getChooseFileButton().parentElement!;

        fireEvent.drop(dropZone, {dataTransfer: {files: [file], types: ['Files']}});
        fireEvent.drop(dropZone, {dataTransfer: {files: [file], types: ['Files']}});

        expect(onUpload).toHaveBeenCalledExactlyOnceWith(file, {targetYear: 2026, targetMonth: 11});

        await act(async () => finishUpload());
    });

    it('blocks uploads, month changes and manual entry while an import is running', async () => {
        const user = userEvent.setup();
        const {props} = renderIntro({uploadStatus: 'uploading'});
        const file = new File(['schedule image'], 'roster.jpg', {type: 'image/jpeg'});

        expect(getChooseFileButton()).toBeDisabled();
        expect(getUploadInput()).toBeDisabled();
        expect(getMonthPickerButton()).toBeDisabled();
        expect(getManualButton()).toBeDisabled();
        expect(screen.getByRole('status')).toHaveTextContent(i18n.t('page.onboardingWardCreate.scheduleEntry.processingTitle'));

        await user.click(getManualButton());
        fireEvent.drop(getChooseFileButton().parentElement!, {dataTransfer: {files: [file], types: ['Files']}});

        expect(props.onManualEntry).not.toHaveBeenCalled();
        expect(props.onUpload).not.toHaveBeenCalled();
    });

    it('allows retrying the same file after an upload error', async () => {
        const user = userEvent.setup();
        const {props, rerender} = renderIntro();
        const file = new File(['schedule image'], 'roster.png', {type: 'image/png'});

        await user.upload(getUploadInput(), file);
        rerender(<ScheduleUploadIntro {...props} uploadStatus="error" uploadError="다시 시도해 주세요." />);

        expect(screen.getByRole('alert')).toHaveTextContent('다시 시도해 주세요.');
        expect(getChooseFileButton()).toBeEnabled();

        await user.upload(getUploadInput(), file);

        expect(props.onUpload).toHaveBeenCalledTimes(2);
        expect(props.onUpload).toHaveBeenLastCalledWith(file, {targetYear: 2026, targetMonth: 11});
    });

    it('starts manual setup only when the user explicitly chooses it', async () => {
        const user = userEvent.setup();
        const {props} = renderIntro();

        expect(props.onManualEntry).not.toHaveBeenCalled();

        await user.click(getManualButton());

        expect(props.onManualEntry).toHaveBeenCalledOnce();
        expect(props.onUpload).not.toHaveBeenCalled();
    });

    it('disables both paths while the parent is saving a transition', async () => {
        const user = userEvent.setup();
        const {props} = renderIntro({disabled: true});

        expect(getChooseFileButton()).toBeDisabled();
        expect(getUploadInput()).toBeDisabled();
        expect(getManualButton()).toBeDisabled();

        await user.click(getManualButton());

        expect(props.onManualEntry).not.toHaveBeenCalled();
        expect(props.onUpload).not.toHaveBeenCalled();
    });
});
