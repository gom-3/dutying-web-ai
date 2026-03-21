import {type DropResult} from '@hello-pangea/dnd';
import {useCallback, useEffect, useState} from 'react';
import useOnclickOutside from 'react-cool-onclickoutside';
import {events, sendEvent} from '@/analytics';
import type {TNurse} from '@/entities/nurse';
import type {TShiftTeam} from '@/entities/ward';
import {type TUpdateShiftTeamDTO} from '@/shared/api/ward/type';
import {DateUtil} from '@/shared/util/date';
import {createMoveNurseOrderPayload, type TEditShiftTeamState, getNextSelectedNurseId} from './shiftTeamList';

interface IUseShiftTeamListControllerParams {
    shiftTeams: TShiftTeam[] | undefined;
    selectedNurse: TNurse | undefined;
    selectNurse: (nurseId: number | null) => void;
    moveNurseOrder: (
        nurseId: number,
        shiftTeamId: number,
        nextShiftTeamId: number,
        divisionNum: number,
        prevPriority: number,
        nextPriority: number,
        patchYearMonth: string,
    ) => void;
    updateShiftTeam: (shiftTeamId: number, updateShiftTeamDTO: TUpdateShiftTeamDTO) => void;
}

function useShiftTeamListController({
    shiftTeams,
    selectedNurse,
    selectNurse,
    moveNurseOrder,
    updateShiftTeam,
}: IUseShiftTeamListControllerParams) {
    const [openMenuShiftTeamId, setOpenMenuShiftTeamId] = useState<number | null>(null);
    const [editShiftTeam, setEditShiftTeam] = useState<TEditShiftTeamState>(null);
    const clickAwayListRef = useOnclickOutside(() => selectNurse(null));
    const clickAwayMenuRef = useOnclickOutside(() => setOpenMenuShiftTeamId(null));
    const handleUpdateShiftTeam = useCallback(() => {
        if (!editShiftTeam) return;

        setEditShiftTeam(null);
        updateShiftTeam(editShiftTeam.shiftTeamId, editShiftTeam.updateShiftTeamDTO);
    }, [editShiftTeam, updateShiftTeam]);
    const clickAwayShiftTeamNameRef = useOnclickOutside(() => {
        handleUpdateShiftTeam();
    });
    const startEditingShiftTeam = useCallback((shiftTeamId: number, name: string) => {
        setEditShiftTeam({
            shiftTeamId,
            updateShiftTeamDTO: {name},
        });
    }, []);
    const changeEditShiftTeamName = useCallback((name: string) => {
        setEditShiftTeam((prevEditShiftTeam) =>
            prevEditShiftTeam
                ? {
                      ...prevEditShiftTeam,
                      updateShiftTeamDTO: {name},
                  }
                : prevEditShiftTeam,
        );
    }, []);
    const handleListKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (!shiftTeams || !selectedNurse || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;

            const nextSelectedNurseId = getNextSelectedNurseId(shiftTeams, selectedNurse, event.key);

            if (!nextSelectedNurseId) return;

            selectNurse(nextSelectedNurseId);
            sendEvent(events.memberPage.moveNurseFocus);
        },
        [selectedNurse, selectNurse, shiftTeams],
    );
    const handleDragEnd = useCallback(
        ({source, destination, draggableId}: DropResult) => {
            if (!destination || !shiftTeams) return null;

            const moveNurseOrderPayload = createMoveNurseOrderPayload({
                shiftTeams,
                sourceDroppableId: source.droppableId,
                destinationDroppableId: destination.droppableId,
                destinationIndex: destination.index,
                sourceIndex: source.index,
                draggableId,
            });

            if (!moveNurseOrderPayload) return null;

            moveNurseOrder(
                moveNurseOrderPayload.nurseId,
                moveNurseOrderPayload.sourceShiftTeamId,
                moveNurseOrderPayload.destinationShiftTeamId,
                moveNurseOrderPayload.divisionNum,
                moveNurseOrderPayload.prevPriority,
                moveNurseOrderPayload.nextPriority,
                DateUtil.getDateString(new Date(), 'yyyy-MM'),
            );

            sendEvent(events.memberPage.moveNurse);
        },
        [moveNurseOrder, shiftTeams],
    );

    useEffect(() => {
        document.addEventListener('keydown', handleListKeyDown);

        return () => document.removeEventListener('keydown', handleListKeyDown);
    }, [handleListKeyDown]);

    return {
        state: {
            openMenuShiftTeamId,
            editShiftTeam,
        },
        refs: {
            clickAwayListRef,
            clickAwayMenuRef,
            clickAwayShiftTeamNameRef,
        },
        actions: {
            setOpenMenuShiftTeamId,
            handleUpdateShiftTeam,
            startEditingShiftTeam,
            changeEditShiftTeamName,
            handleDragEnd,
        },
    };
}

export default useShiftTeamListController;
