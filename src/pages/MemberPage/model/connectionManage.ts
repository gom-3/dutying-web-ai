import {groupBy} from 'lodash-es';
import type {TNurse, TWaitingNurse} from '@/entities/nurse';

export type TConnectionManageStep = 0 | 1 | 2 | 3;

export type TConnectMode = 'link' | 'add';

export const getFormattedPhoneNumber = (phoneNumber: string) =>
    `${phoneNumber.slice(0, 3)}-${phoneNumber.slice(3, 7)}-${phoneNumber.slice(7, 11)}`;

export const getWaitingNurseSummary = (waitingNurse: TWaitingNurse) => ({
    ...waitingNurse,
    formattedPhoneNumber: getFormattedPhoneNumber(waitingNurse.phoneNum),
});

export const getGroupedDivisionNurses = (nurses: TNurse[]) =>
    Object.entries(groupBy(nurses, 'divisionNum')).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
