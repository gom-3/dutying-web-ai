import ReactGA from 'react-ga4';
import type {UaEventOptions} from 'react-ga4/types/ga4';
import {isGoogleAnalyticsEnabled} from '@/shared/config/analytics';
/* eslint-disable @typescript-eslint/no-explicit-any */

export const wrapWithGAEvent =
    <T extends (...args: any[]) => unknown>(fn: T, eventInfo: UaEventOptions) =>
    (...args: any[]) => {
        if (isGoogleAnalyticsEnabled()) ReactGA.event(eventInfo);

        return fn(...args);
    };
