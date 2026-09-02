import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

type TQueuedChannelIO = {q: [string, unknown, (error?: unknown) => void][]};

const channelWindow = window as Window & {ChannelIO?: TQueuedChannelIO | ReturnType<typeof vi.fn>};
const getSdkScript = () => document.querySelector<HTMLScriptElement>('script[src="https://cdn.channel.io/plugin/ch-plugin-web.js"]')!;

async function finishSdkLoad() {
    getSdkScript().dispatchEvent(new Event('load'));
    // Resolve the loader's catch handler and the awaiting boot operation.
    await Promise.resolve();
    await Promise.resolve();

    const queued = channelWindow.ChannelIO as TQueuedChannelIO;
    const boot = queued.q[0]!;
    const liveSdk = vi.fn((command: string, _options?: unknown, callback?: (error?: unknown) => void) => {
        if (command === 'updateUser') callback?.();
    });

    // Channel Talk replaces its queue function when the iframe SDK starts.
    channelWindow.ChannelIO = liveSdk;

    return {boot, liveSdk};
}

describe('Channel Talk integration', () => {
    beforeEach(() => {
        vi.resetModules();
        delete channelWindow.ChannelIO;
    });

    afterEach(() => {
        getSdkScript()?.remove();
        delete channelWindow.ChannelIO;
        vi.useRealTimers();
    });

    it('loads on demand, opens through the live SDK, and updates all website languages without rebooting', async () => {
        const chat = await import('../channel-talk');

        await chat.setChannelTalkLanguage('ja-JP');
        expect(getSdkScript()).toBeNull();

        const opening = chat.openChannelTalk('ja-JP');
        const {boot, liveSdk} = await finishSdkLoad();

        expect(boot[0]).toBe('boot');
        expect(boot[1]).toMatchObject({language: 'ja', hideChannelButtonOnBoot: true});
        boot[2]();
        await opening;
        expect(liveSdk).toHaveBeenLastCalledWith('showMessenger');

        for (const language of ['ko', 'en', 'ja', 'zh', 'th', 'vi']) {
            await chat.setChannelTalkLanguage(language);
            expect(liveSdk).toHaveBeenLastCalledWith('updateUser', {language}, expect.any(Function));
        }

        liveSdk.mockClear();
        await chat.openChannelTalk('vi');
        expect(liveSdk.mock.calls).toEqual([['showMessenger']]);
        expect(document.querySelectorAll('script[src="https://cdn.channel.io/plugin/ch-plugin-web.js"]')).toHaveLength(1);
    });

    it('uses the latest selection when the language changes during boot', async () => {
        const chat = await import('../channel-talk');
        const opening = chat.openChannelTalk('ko');
        const {boot, liveSdk} = await finishSdkLoad();
        const changing = chat.setChannelTalkLanguage('vi-VN');

        boot[2]();
        await Promise.all([opening, changing]);

        expect(liveSdk.mock.calls.map(([command, options]) => [command, options])).toEqual([
            ['updateUser', {language: 'vi'}],
            ['showMessenger', undefined],
        ]);
    });

    it('cleans up a stalled download and allows a subsequent attempt', async () => {
        vi.useFakeTimers();

        const chat = await import('../channel-talk');
        const failure = expect(chat.openChannelTalk('en')).rejects.toThrow('could not be loaded');

        await vi.advanceTimersByTimeAsync(15_000);
        await failure;
        expect(getSdkScript()).toBeNull();
        expect(channelWindow.ChannelIO).toBeUndefined();

        const retry = chat.openChannelTalk('zh-CN');
        const {boot, liveSdk} = await finishSdkLoad();

        expect(boot[1]).toMatchObject({language: 'zh'});
        boot[2]();
        await retry;
        expect(liveSdk).toHaveBeenLastCalledWith('showMessenger');
    });
});
