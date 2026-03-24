import {koToEn} from '@dutying/utils/ko-to-en';
import {useCallback, useMemo} from 'react';
import {useShiftEditorStore} from './store';
import type {TClipboardPayload, TWorkKeyMap} from './types';
import {useShiftEditorCommands} from './use-shift-editor-commands';

export type TShiftEditorKeyBindingsOptions = {
    /**
     * 사용자별 근무 키 매핑 주입.
     * 예) { d: "D", e: "E", n: "N", o: "O" }
     */
    workKeyMap?: TWorkKeyMap;
    /**
     * ctrl/cmd 없이도 x/c/v로 잘라내기/복사/붙여넣기 허용 여부.
     * 기본은 false (근무키 입력과 충돌 방지).
     */
    allowUnmodifiedClipboardShortcuts?: boolean;
    /**
     * 기본 바인딩보다 먼저 실행되는 커스텀 핸들러.
     * true를 리턴하면 이벤트를 소비(handled)한 것으로 간주.
     */
    beforeHandlers?: Array<(e: KeyboardEvent) => boolean>;
};

function isMetaOrCtrl(e: KeyboardEvent): boolean {
    return e.metaKey || e.ctrlKey;
}

function normalizeKey(key: string): string {
    // 한글 IME 입력도 영문 키로 normalize (예: 'ㅇ' -> 'd')
    const normalized = key.length === 1 ? koToEn(key) : key;

    return normalized.length === 1 ? normalized.toLowerCase() : normalized;
}

function toDirection(key: string): 'left' | 'right' | 'up' | 'down' | null {
    switch (key) {
        case 'ArrowLeft':
            return 'left';
        case 'ArrowRight':
            return 'right';
        case 'ArrowUp':
            return 'up';
        case 'ArrowDown':
            return 'down';
        default:
            return null;
    }
}

function payloadToTSV(payload: TClipboardPayload): string {
    return payload.cells.map((row) => row.map((v) => v ?? '').join('\t')).join('\n');
}

function tsvToPayload(text: string): TClipboardPayload {
    const rows = text
        .replace(/\r/g, '')
        .split('\n')
        .filter((x) => x.length > 0)
        .map((x) => x.split('\t'));
    const height = rows.length;
    const width = Math.max(0, ...rows.map((r) => r.length));
    const cells = rows.map((r) => {
        const row: (string | null)[] = [];

        for (let i = 0; i < width; i++) row.push(r[i] ? r[i]! : null);

        return row;
    });

    return {width, height, cells};
}

export function useShiftEditorKeyBindings(opts: TShiftEditorKeyBindingsOptions = {}) {
    const commands = useShiftEditorCommands();
    const doc = useShiftEditorStore((s) => s.doc);
    const workKeyMap = useMemo(() => {
        const map: TWorkKeyMap = opts.workKeyMap ?? {d: 'D', e: 'E', n: 'N', o: 'O'};
        // normalize keys once
        const normalized: TWorkKeyMap = {};

        for (const [k, v] of Object.entries(map)) normalized[k.toLowerCase()] = v;

        return normalized;
    }, [opts.workKeyMap]);
    const allowUnmodifiedClipboardShortcuts = opts.allowUnmodifiedClipboardShortcuts ?? false;
    const beforeHandlers = opts.beforeHandlers ?? [];
    const onKeyDown = useCallback(
        async (e: React.KeyboardEvent) => {
            // react 이벤트 -> native로 변환해서 공통 로직 사용
            const native = e.nativeEvent as KeyboardEvent;

            for (const handler of beforeHandlers) {
                if (handler(native)) {
                    e.preventDefault();

                    return;
                }
            }

            const key = normalizeKey(native.key);
            const dir = toDirection(native.key);
            const mod = isMetaOrCtrl(native);

            // 방향키 이동 / Shift+방향키 범위 / Ctrl(Cmd)+방향키 끝까지
            if (dir) {
                e.preventDefault();
                commands.moveSelection(dir, native.shiftKey, mod);

                return;
            }

            // 전체 선택
            if (mod && key === 'a') {
                e.preventDefault();
                commands.selectAll();

                return;
            }

            // undo / redo
            if (mod && key === 'z') {
                e.preventDefault();

                if (native.shiftKey) commands.redo();
                else commands.undo();

                return;
            }

            if (mod && key === 'y') {
                e.preventDefault();
                commands.redo();

                return;
            }

            // delete/backspace -> 선택 지우기
            if (key === 'Backspace' || key === 'Delete') {
                e.preventDefault();
                commands.clearSelectionCells();

                return;
            }

            // clipboard (기본: Ctrl/Cmd + X/C/V)
            const isClipboardKey = key === 'c' || key === 'x' || key === 'v';
            const allowPlain = allowUnmodifiedClipboardShortcuts && !native.altKey && !native.shiftKey && !mod;

            if ((mod && isClipboardKey) || allowPlain) {
                if (key === 'c') {
                    e.preventDefault();

                    const payload = commands.copy();

                    if (!payload) return;

                    const text = payloadToTSV(payload);

                    try {
                        await navigator.clipboard.writeText(text);
                    } catch {
                        // 권한/HTTPS 이슈 시 무시 (onCopy 이벤트 기반으로 개선 가능)
                    }

                    return;
                }

                if (key === 'x') {
                    e.preventDefault();

                    const payload = commands.copy();

                    if (!payload) return;

                    const text = payloadToTSV(payload);

                    try {
                        await navigator.clipboard.writeText(text);
                    } catch {
                        // ignore
                    }

                    commands.clearSelectionCells();

                    return;
                }

                if (key === 'v') {
                    e.preventDefault();

                    try {
                        const text = await navigator.clipboard.readText();
                        const payload = tsvToPayload(text);

                        commands.paste(payload);
                    } catch {
                        // ignore
                    }

                    return;
                }
            }

            // 사용자 근무 키 입력 (modifier 없이)
            if (!mod && !native.altKey && !native.shiftKey && key.length === 1) {
                const value = workKeyMap[key];

                if (value !== undefined) {
                    e.preventDefault();
                    commands.setSelectionValue(value);
                }
            }

            // eslint용: doc 참조 (keybinding은 bounds가 필요할 때 확장 대비)
            void doc;
        },
        [allowUnmodifiedClipboardShortcuts, beforeHandlers, commands, doc, workKeyMap],
    );
    const onPaste = useCallback(
        (e: React.ClipboardEvent) => {
            const text = e.clipboardData.getData('text');

            if (!text) return;

            e.preventDefault();
            commands.paste(tsvToPayload(text));
        },
        [commands],
    );

    return {onKeyDown, onPaste};
}
