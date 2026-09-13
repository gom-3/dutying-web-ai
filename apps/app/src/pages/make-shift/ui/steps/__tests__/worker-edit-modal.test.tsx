import {screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {render} from '@/shared/util/test-utils';
import {WorkerEditModal} from '../worker-edit-modal';

const editState = vi.hoisted(() => ({
    selectedNurse: {nurseId: 1, name: '김듀티'},
    isNurseDraftDirty: false,
}));
const saveDraftMock = vi.hoisted(() => vi.fn(async () => true));
const discardDraftMock = vi.hoisted(() => vi.fn());

vi.mock('@/features/edit-shift-team', () => ({
    default: () => ({state: editState}),
}));

vi.mock('@/pages/member/ui/nurse-detail-panel', () => ({
    default: ({
        onRequestClose,
        onSaveSuccess,
        onRegisterDraftActions,
    }: {
        onRequestClose: (hasUnsavedChanges: boolean) => void;
        onSaveSuccess: () => void;
        onRegisterDraftActions: (actions: {save: () => Promise<boolean>; discard: () => void; hasChanges: () => boolean}) => void;
    }) => {
        onRegisterDraftActions({save: saveDraftMock, discard: discardDraftMock, hasChanges: () => editState.isNurseDraftDirty});

        return (
            <>
                <button type="button" onClick={() => onRequestClose(editState.isNurseDraftDirty)}>
                    close editor
                </button>
                <button type="button" onClick={onSaveSuccess}>
                    save editor
                </button>
            </>
        );
    },
}));

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({t: (key: string) => key}),
}));

describe('WorkerEditModal', () => {
    beforeEach(() => {
        editState.isNurseDraftDirty = false;
        saveDraftMock.mockClear();
        discardDraftMock.mockClear();
    });

    it('closes immediately when there are no unsaved changes', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();

        render(
            <WorkerEditModal
                open
                onClose={onClose}
                onOpenWardCodeGuide={vi.fn()}
                shiftTeams={[]}
                onMoveShiftTeam={vi.fn(async () => true)}
                wardShiftTypes={[]}
            />,
        );

        await user.click(screen.getByRole('button', {name: 'close editor'}));

        expect(onClose).toHaveBeenCalledOnce();
    });

    it('closes when the backdrop is selected and there are no unsaved changes', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();

        render(
            <WorkerEditModal
                open
                onClose={onClose}
                onOpenWardCodeGuide={vi.fn()}
                shiftTeams={[]}
                onMoveShiftTeam={vi.fn(async () => true)}
                wardShiftTypes={[]}
            />,
        );

        const backdrop = document.querySelector<HTMLElement>('[data-worker-edit-backdrop]');

        expect(backdrop).not.toBeNull();
        await user.click(backdrop!);

        expect(onClose).toHaveBeenCalledOnce();
    });

    it('closes after the editor reports a successful save', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();

        render(
            <WorkerEditModal
                open
                onClose={onClose}
                onOpenWardCodeGuide={vi.fn()}
                shiftTeams={[]}
                onMoveShiftTeam={vi.fn(async () => true)}
                wardShiftTypes={[]}
            />,
        );

        await user.click(screen.getByRole('button', {name: 'save editor'}));

        expect(onClose).toHaveBeenCalledOnce();
    });

    it('offers only continue editing or leave without saving when the draft is dirty', async () => {
        editState.isNurseDraftDirty = true;

        const user = userEvent.setup();
        const onClose = vi.fn();

        render(
            <WorkerEditModal
                open
                onClose={onClose}
                onOpenWardCodeGuide={vi.fn()}
                shiftTeams={[]}
                onMoveShiftTeam={vi.fn(async () => true)}
                wardShiftTypes={[]}
            />,
        );

        const backdrop = document.querySelector<HTMLElement>('[data-worker-edit-backdrop]');

        expect(backdrop).not.toBeNull();
        await user.click(backdrop!);

        const closeGuard = screen.getByRole('dialog', {name: 'page.makeShift.workers.editExit.title'});

        expect(within(closeGuard).getAllByRole('button')).toHaveLength(2);
        expect(onClose).not.toHaveBeenCalled();

        await user.click(within(closeGuard).getByRole('button', {name: 'page.makeShift.workers.editExit.continueEditing'}));

        expect(screen.queryByRole('dialog', {name: 'page.makeShift.workers.editExit.title'})).not.toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();

        await user.click(backdrop!);
        await user.click(screen.getByRole('button', {name: 'page.makeShift.workers.editExit.discardAndClose'}));

        expect(discardDraftMock).toHaveBeenCalledOnce();
        expect(onClose).toHaveBeenCalledOnce();
    });
});
