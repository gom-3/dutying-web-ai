import ReactPixel from 'react-facebook-pixel';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import initializeApp from '../initializeApp';

vi.mock('@sentry/react', () => ({init: vi.fn()}));
vi.mock('immer', () => ({enableMapSet: vi.fn()}));
vi.mock('react-facebook-pixel', () => ({default: {init: vi.fn(), pageView: vi.fn()}}));
vi.mock('react-ga4', () => ({default: {initialize: vi.fn()}}));
vi.mock('@/shared/util/abto', () => ({initializeAbto: vi.fn()}));
vi.mock('@/shared/config/feature-flags', () => ({isNonProductionAppDomain: () => false}));

beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_AI_META_PIXEL_ID', '');
    vi.stubEnv('VITE_PIXEL_ID', '225085720489207');
});
afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
});

it('initializes the company-owned pixel and disables automatic metadata collection', () => {
    vi.stubGlobal('window', {location: new URL('https://www.dutying.ai/')});
    initializeApp();
    expect(ReactPixel.init).toHaveBeenCalledExactlyOnceWith('1138075548924419', undefined, {autoConfig: false, debug: false});
    expect(ReactPixel.pageView).toHaveBeenCalledOnce();
});

it('does not load the Pixel SDK on a credential-bearing OAuth callback', () => {
    vi.stubGlobal('window', {location: new URL('https://app.dutying.ai/oauth2/redirect?accessToken=private')});
    initializeApp();
    expect(ReactPixel.init).not.toHaveBeenCalled();
    expect(ReactPixel.pageView).not.toHaveBeenCalled();
});

it('does not load the Pixel SDK for development deployments', () => {
    vi.stubGlobal('window', {location: new URL('https://dev.dutying.ai/')});
    initializeApp();
    expect(ReactPixel.init).not.toHaveBeenCalled();
    expect(ReactPixel.pageView).not.toHaveBeenCalled();
});
