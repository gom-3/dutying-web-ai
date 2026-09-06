import type {TPreferredLanguage} from '@dutying/domain';
import {DEFAULT_PREFERRED_LANGUAGE, normalizePreferredLanguage} from '@/shared/i18n/locale';

export const CHANNEL_TALK_URL = 'https://ye620.channel.io';

// Public installation key from the existing ye620.channel.io channel.
const pluginKey = 'fd7be446-81e4-49df-a8c7-92737ede0f50';
const sdkUrl = 'https://cdn.channel.io/plugin/ch-plugin-web.js';
const timeoutMs = 15_000;

type TChannelCallback = (error?: unknown) => void;
type TChannelIO = {
    (
        command: 'boot',
        options: {
            pluginKey: string;
            language: TPreferredLanguage;
            hideChannelButtonOnBoot: boolean;
            hidePopup: boolean;
            trackDefaultEvent: boolean;
        },
        callback: TChannelCallback,
    ): void;
    (command: 'updateUser', options: {language: TPreferredLanguage}, callback: TChannelCallback): void;
    (command: 'showMessenger'): void;
    q?: unknown[][];
    c?: (args: unknown[]) => void;
};

const getChannelWindow = () => window as Window & {ChannelIO?: TChannelIO};

let sdkPromise: Promise<void> | undefined;
let syncPromise: Promise<TChannelIO> | undefined;
let isBooted = false;
let desiredLanguage: TPreferredLanguage = DEFAULT_PREFERRED_LANGUAGE;
let appliedLanguage: TPreferredLanguage | undefined;

function loadSdk(): Promise<void> {
    if (sdkPromise) return sdkPromise;

    const channelWindow = getChannelWindow();

    if (channelWindow.ChannelIO) return Promise.resolve();

    const queuedChannelIO = ((...args: unknown[]) => queuedChannelIO.c?.(args)) as TChannelIO;

    queuedChannelIO.q = [];
    queuedChannelIO.c = (args) => queuedChannelIO.q?.push(args);
    channelWindow.ChannelIO = queuedChannelIO;

    sdkPromise = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        const cleanup = () => {
            window.clearTimeout(timeout);
            script.onload = null;
            script.onerror = null;
        };
        const fail = () => {
            cleanup();
            script.remove();

            if (channelWindow.ChannelIO === queuedChannelIO) delete channelWindow.ChannelIO;

            reject(new Error('Channel Talk SDK could not be loaded.'));
        };
        const timeout = window.setTimeout(fail, timeoutMs);

        script.src = sdkUrl;
        script.async = true;
        script.onload = () => {
            cleanup();
            resolve();
        };
        script.onerror = fail;
        document.head.appendChild(script);
    }).catch((error: unknown) => {
        sdkPromise = undefined;
        throw error;
    });

    return sdkPromise;
}

function waitForCallback(invoke: (callback: TChannelCallback) => void): Promise<void> {
    return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('Channel Talk request timed out.')), timeoutMs);
        const callback: TChannelCallback = (error) => {
            window.clearTimeout(timeout);

            if (error) reject(error);
            else resolve();
        };

        try {
            invoke(callback);
        } catch (error) {
            callback(error);
        }
    });
}

function syncLanguage(): Promise<TChannelIO> {
    if (syncPromise) return syncPromise;

    syncPromise = (async () => {
        await loadSdk();

        if (!isBooted) {
            await waitForCallback((callback) => {
                const channelIO = getChannelWindow().ChannelIO;

                if (!channelIO) throw new Error('Channel Talk SDK is unavailable.');

                channelIO(
                    'boot',
                    {
                        pluginKey,
                        language: desiredLanguage,
                        hideChannelButtonOnBoot: true,
                        hidePopup: true,
                        trackDefaultEvent: false,
                    },
                    callback,
                );
            });
            isBooted = true;
        }

        // Boot can restore a visitor's saved language. Explicitly update it before opening.
        // Keep the latest selection if the visitor switches languages during loading.
        while (appliedLanguage !== desiredLanguage) {
            const language = desiredLanguage;

            await waitForCallback((callback) => {
                // The SDK replaces the initial queue function after its iframe loads.
                const channelIO = getChannelWindow().ChannelIO;

                if (!channelIO) throw new Error('Channel Talk SDK is unavailable.');

                channelIO('updateUser', {language}, callback);
            });
            appliedLanguage = language;
        }

        const channelIO = getChannelWindow().ChannelIO;

        if (!channelIO) throw new Error('Channel Talk SDK is unavailable.');

        return channelIO;
    })().finally(() => {
        syncPromise = undefined;
    });

    return syncPromise;
}

export async function setChannelTalkLanguage(language?: string | null): Promise<void> {
    desiredLanguage = normalizePreferredLanguage(language) ?? DEFAULT_PREFERRED_LANGUAGE;

    // Merely visiting the landing page should not load or boot the chat SDK.
    if (isBooted || syncPromise) await syncLanguage();
}

export async function openChannelTalk(language?: string | null): Promise<void> {
    desiredLanguage = normalizePreferredLanguage(language) ?? DEFAULT_PREFERRED_LANGUAGE;

    const channelIO = await syncLanguage();

    channelIO('showMessenger');
}
