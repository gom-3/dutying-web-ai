import {groupBy} from 'lodash-es';
import type {TNurse, TWaitingNurse} from '@/entities/nurse';
import type {TShiftTeam} from '@/entities/ward';
import type {TI18nKey} from '@/shared/hook/use-typed-translation';

export type TConnectionManageStep = 0 | 1 | 2 | 3;
export type TConnectMode = 'link' | 'add';
export type TConnectionManageSubmitStatus = 'idle' | 'loading' | 'success' | 'error';

export const getFormattedPhoneNumber = (phoneNumber: string) =>
    `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 7)}-${phoneNumber.slice(7, 11)}`;

export const getWaitingNurseSummary = (waitingNurse: TWaitingNurse) => ({
    ...waitingNurse,
    formattedPhoneNumber: getFormattedPhoneNumber(waitingNurse.phoneNum),
});

export const getGroupedDivisionNurses = (nurses: TNurse[]) =>
    Object.entries(groupBy(nurses, 'divisionNum')).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

interface IGetConnectionManageTargetLabelParams {
    connectMode: TConnectMode;
    shiftTeams: TShiftTeam[] | undefined;
    toLinkNurseId: number | null;
    toAddShiftTeamId: number | null;
}

export function getConnectionManageTargetLabel({
    connectMode,
    shiftTeams,
    toLinkNurseId,
    toAddShiftTeamId,
}: IGetConnectionManageTargetLabelParams) {
    if (!shiftTeams) return null;

    if (connectMode === 'link') {
        const targetShiftTeam = shiftTeams.find((shiftTeam) => shiftTeam.nurses.some((nurse) => nurse.nurseId === toLinkNurseId));
        const targetNurse = targetShiftTeam?.nurses.find((nurse) => nurse.nurseId === toLinkNurseId);

        if (!targetShiftTeam || !targetNurse) return null;

        return `${targetNurse.name} · ${targetShiftTeam.name}`;
    }

    return shiftTeams.find((shiftTeam) => shiftTeam.shiftTeamId === toAddShiftTeamId)?.name ?? null;
}

interface IGetConnectionManageResultCopyParams {
    submitStatus: Exclude<TConnectionManageSubmitStatus, 'idle'>;
    connectMode: TConnectMode;
    waitingNurseName?: string;
    targetLabel?: string | null;
    t: (key: TI18nKey, values?: Record<string, string | number>) => string;
}

function getObjectParticle(word: string) {
    const trimmed = word.trim();
    const lastChar = trimmed.charAt(trimmed.length - 1);

    if (!lastChar) return '\uC744';

    const code = lastChar.charCodeAt(0);
    const isHangulSyllable = code >= 0xac00 && code <= 0xd7a3;

    if (!isHangulSyllable) return '\uC744';

    const hasBatchim = (code - 0xac00) % 28 !== 0;

    return hasBatchim ? '\uC744' : '\uB97C';
}

function getLinkFailureDescription(targetLabel: string | null | undefined, t: IGetConnectionManageResultCopyParams['t']) {
    if (!targetLabel) {
        return t('page.member.connectionManage.result.failure.linkNoTargetDescription');
    }

    const [targetNurseName, targetTeamName] = targetLabel.split('·').map((text) => text.trim());

    if (targetNurseName && targetTeamName) {
        return t('page.member.connectionManage.result.failure.linkTeamDescription', {targetNurseName, targetTeamName});
    }

    return t('page.member.connectionManage.result.failure.linkDescription', {targetLabel});
}

export function getConnectionManageResultCopy({
    submitStatus,
    connectMode,
    waitingNurseName,
    targetLabel,
    t,
}: IGetConnectionManageResultCopyParams) {
    const safeWaitingNurseName = waitingNurseName ?? t('page.member.common.selectedNurse');
    const safeTargetLabel =
        targetLabel ?? (connectMode === 'link' ? t('page.member.common.selectedNurse') : t('page.member.common.selectedTeam'));

    if (submitStatus === 'loading') {
        return {
            title:
                connectMode === 'link'
                    ? t('page.member.connectionManage.result.loading.linkTitle')
                    : t('page.member.connectionManage.result.loading.addTitle'),
            description:
                connectMode === 'link'
                    ? t('page.member.connectionManage.result.loading.linkDescription', {
                          waitingNurseName: safeWaitingNurseName,
                          targetLabel: safeTargetLabel,
                      })
                    : t('page.member.connectionManage.result.loading.addDescription', {
                          waitingNurseName: safeWaitingNurseName,
                          targetLabel: safeTargetLabel,
                      }),
        };
    }

    if (submitStatus === 'success') {
        return {
            title:
                connectMode === 'link'
                    ? t('page.member.connectionManage.result.success.linkTitle')
                    : t('page.member.connectionManage.result.success.addTitle', {
                          waitingNurseName: safeWaitingNurseName,
                          targetLabel: safeTargetLabel,
                      }),
            description:
                connectMode === 'link'
                    ? t('page.member.connectionManage.result.success.linkDescription', {
                          waitingNurseName: safeWaitingNurseName,
                          targetLabel: safeTargetLabel,
                      })
                    : '',
        };
    }

    return {
        title:
            connectMode === 'link'
                ? t('page.member.connectionManage.result.failure.linkTitle')
                : t('page.member.connectionManage.result.failure.addTitle'),
        description:
            connectMode === 'link'
                ? getLinkFailureDescription(targetLabel, t)
                : t('page.member.connectionManage.result.failure.addDescription', {
                      waitingNurseName: safeWaitingNurseName,
                      targetLabel: safeTargetLabel,
                      objectParticle: getObjectParticle(safeWaitingNurseName),
                  }),
    };
}
