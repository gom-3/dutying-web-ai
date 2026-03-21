import {createPortal} from 'react-dom';
import {match} from 'ts-pattern';
import useEditShiftTeam from '@/features/ward/useEditShiftTeam';
import useEditWard from '@/features/ward/useEditWard';
import {getConnectionManageTargetLabel} from '../model/connectionManage';
import useConnectionManageController from '../model/useConnectionManageController';
import ConnectionManageCompleteStep from './connection-manage/ConnectionManageCompleteStep';
import ConnectionManageMethodStep from './connection-manage/ConnectionManageMethodStep';
import ConnectionManageTargetStep from './connection-manage/ConnectionManageTargetStep';
import ConnectionManageWaitingStep from './connection-manage/ConnectionManageWaitingStep';

interface IConnectionManageProps {
    open: boolean;
    setOpen: (open: boolean) => void;
}

function ConnectionManage({open, setOpen}: IConnectionManageProps) {
    const {
        state: {watingNurses},
        actions: {cancelWaiting, approveWatingNurses, connectWatingNurses},
    } = useEditWard();
    const {
        state: {shiftTeams},
    } = useEditShiftTeam();
    const {
        state: {step, currentWaitingNurse, connectMode, toLinkNurseId, toAddShiftTeamId, isNextDisabled, submitStatus},
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
            retryCompleteSelection,
        },
    } = useConnectionManageController({
        open,
        approveWaitingNurses: approveWatingNurses,
        connectWaitingNurses: connectWatingNurses,
    });
    const handleClose = () => setOpen(false);
    const targetLabel = getConnectionManageTargetLabel({
        connectMode,
        shiftTeams,
        toLinkNurseId,
        toAddShiftTeamId,
    });

    return open
        ? createPortal(
              <div
                  className="fixed top-0 left-0 z-1001 flex h-screen w-screen items-center justify-center bg-[#00000099] backdrop-blur-[.125rem]"
                  onClick={handleClose}
              >
                  {match(step)
                      .with(0, () => (
                          <ConnectionManageWaitingStep
                              waitingNurses={watingNurses}
                              onClose={handleClose}
                              onAccept={handleSelectWaitingNurse}
                              onReject={cancelWaiting}
                          />
                      ))
                      .with(1, () => (
                          <ConnectionManageMethodStep
                              currentWaitingNurse={currentWaitingNurse}
                              connectMode={connectMode}
                              onBack={goToWaitingList}
                              onNext={goToTargetSelection}
                              onChangeConnectMode={setConnectMode}
                          />
                      ))
                      .with(2, () => (
                          <ConnectionManageTargetStep
                              currentWaitingNurse={currentWaitingNurse}
                              shiftTeams={shiftTeams}
                              connectMode={connectMode}
                              toLinkNurseId={toLinkNurseId}
                              toAddShiftTeamId={toAddShiftTeamId}
                              isNextDisabled={isNextDisabled}
                              onBack={goToMethodSelection}
                              onNext={handleCompleteSelection}
                              onSelectLinkNurse={setToLinkNurseId}
                              onSelectShiftTeam={setToAddShiftTeamId}
                          />
                      ))
                      .with(3, () => (
                          <ConnectionManageCompleteStep
                              submitStatus={submitStatus}
                              connectMode={connectMode}
                              waitingNurseName={currentWaitingNurse?.name}
                              targetLabel={targetLabel}
                              onRestart={initialize}
                              onBack={goToMethodSelection}
                              onRetry={retryCompleteSelection}
                              onClose={handleClose}
                          />
                      ))
                      .otherwise(() => null)}
              </div>,
              document.getElementById('modal-root')!,
          )
        : null;
}

export default ConnectionManage;
