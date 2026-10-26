import {useCallback, useEffect, useState, type SetStateAction} from 'react';
import {readScheduleChat, writeScheduleChat} from './schedule-chat-cache';

type TComposer = {text: string; entryChoice: 'modify' | 'regenerate' | null};

function readComposer(key: string | null): TComposer {
    return (
        readScheduleChat<TComposer>(key, (value): value is TComposer => {
            const composer = value as TComposer | null;

            return Boolean(composer && typeof composer.text === 'string' && [null, 'modify', 'regenerate'].includes(composer.entryChoice));
        }) ?? {text: '', entryChoice: null}
    );
}

/** Draft text belongs to the conversation, including when its sidebar is remounted. */
export function useScheduleChatComposer(key: string | null) {
    const [state, setState] = useState(() => ({key, ...readComposer(key)}));
    const [saveFailed, setSaveFailed] = useState(false);
    const current = state.key === key ? state : {key, ...readComposer(key)};

    useEffect(() => {
        if (state.key !== key) {
            setState({key, ...readComposer(key)});

            return;
        }

        setSaveFailed(!writeScheduleChat(key, state.text || state.entryChoice ? {text: state.text, entryChoice: state.entryChoice} : null));
    }, [key, state]);

    const setText = useCallback(
        (update: SetStateAction<string>) => {
            setState((previous) => {
                const base = previous.key === key ? previous : {key, ...readComposer(key)};

                return {...base, text: typeof update === 'function' ? update(base.text) : update};
            });
        },
        [key],
    );
    const setEntryChoice = useCallback(
        (update: SetStateAction<TComposer['entryChoice']>) => {
            setState((previous) => {
                const base = previous.key === key ? previous : {key, ...readComposer(key)};

                return {...base, entryChoice: typeof update === 'function' ? update(base.entryChoice) : update};
            });
        },
        [key],
    );

    return {text: current.text, entryChoice: current.entryChoice, setText, setEntryChoice, saveFailed};
}
