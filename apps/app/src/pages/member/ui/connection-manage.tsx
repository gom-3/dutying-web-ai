import {createPortal} from 'react-dom';
import {match} from 'ts-pattern';
import useEditShiftTeam from '@/features/edit-shift-team';
import useEditWard from '@/features/edit-ward';
import {getConnectionManageTargetLabel} from '../model/connection-manage';
import useConnectionManageController from '../model/use-connection-manage-controller';
import ConnectionManageCompleteStep from './connection-manage/complete-step';
import ConnectionManageMethodStep from './connection-manage/method-step';
import ConnectionManageTargetStep from './connection-manage/target-step';
import ConnectionManageWaitingStep from './connection-manage/waiting-step';

interface IConnectionManageProps {
    open: boolean;
    setOpen: (open: boolean) => void;
}

function ConnectionManage({open, setOpen}: IConnectionManageProps) {
    const {
        state: {watingNurses},
        actions: {cancelWaiting, approveWaitingNurses, connectWaitingNurses},
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
        approveWaitingNurses,
        connectWaitingNurses,
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
