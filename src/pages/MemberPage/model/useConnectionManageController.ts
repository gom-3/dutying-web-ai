import {useCallback, useEffect, useMemo, useState} from 'react';
import type {TWaitingNurse} from '@/entities/nurse';
import type {TConnectionManageStep, TConnectMode} from './connectionManage';

interface IUseConnectionManageControllerParams {
    open: boolean;
    approveWaitingNurses: (waitingNurseId: number, shiftTeamId: number) => void;
    connectWaitingNurses: (waitingNurseId: number, nurseId: number) => void;
}

function useConnectionManageController({open, approveWaitingNurses, connectWaitingNurses}: IUseConnectionManageControllerParams) {
    const [step, setStep] = useState<TConnectionManageStep>(0);
    const [currentWaitingNurse, setCurrentWaitingNurse] = useState<TWaitingNurse | null>(null);
    const [connectMode, setConnectMode] = useState<TConnectMode>('link');
    const [toLinkNurseId, setToLinkNurseId] = useState<number | null>(null);
    const [toAddShiftTeamId, setToAddShiftTeamId] = useState<number | null>(null);
    const initialize = useCallback(() => {
        setStep(0);
        setCurrentWaitingNurse(null);
        setConnectMode('link');
        setToLinkNurseId(null);
        setToAddShiftTeamId(null);
    }, []);
    const goToWaitingList = () => {
        initialize();
    };
    const goToMethodSelection = () => {
        setToLinkNurseId(null);
        setToAddShiftTeamId(null);
        setStep(1);
    };
    const goToTargetSelection = () => setStep(2);
    const handleSelectWaitingNurse = (waitingNurse: TWaitingNurse) => {
        setConnectMode('link');
        setToLinkNurseId(null);
        setToAddShiftTeamId(null);
        setCurrentWaitingNurse(waitingNurse);
        setStep(1);
    };
    const handleCompleteSelection = () => {
        if (!currentWaitingNurse) return;

        if (connectMode === 'link') {
            if (!toLinkNurseId) return;

            connectWaitingNurses(currentWaitingNurse.waitingNurseId, toLinkNurseId);
        } else {
            if (!toAddShiftTeamId) return;

            approveWaitingNurses(currentWaitingNurse.waitingNurseId, toAddShiftTeamId);
        }

        setStep(3);
    };
    const isNextDisabled = useMemo(() => {
        if (!currentWaitingNurse) return true;

        return connectMode === 'link' ? !toLinkNurseId : !toAddShiftTeamId;
    }, [connectMode, currentWaitingNurse, toAddShiftTeamId, toLinkNurseId]);

    useEffect(() => {
        if (!open) {
            initialize();
        }
    }, [initialize, open]);

    return {
        state: {
            step,
            currentWaitingNurse,
            connectMode,
            toLinkNurseId,
            toAddShiftTeamId,
            isNextDisabled,
        },
        actions: {
            setConnectMode,
            setToLinkNurseId,
            setToAddShiftTeamId,
            initialize,
            goToWaitingList,
            goToMethodSelection,
            goToTargetSelection,
            handleSelectWaitingNurse,
            handleCompleteSelection,
        },
    };
}

export default useConnectionManageController;
