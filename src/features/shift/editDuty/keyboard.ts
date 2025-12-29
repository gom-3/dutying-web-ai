import {koToEn} from '@/shared/util/koToEn';

export function keydownEventMapper(e: KeyboardEvent, ...op: {keys: string[]; callback: () => void}[]) {
    op.forEach(({keys, callback}) => {
        if (keys.map((key) => key.toUpperCase()).indexOf(koToEn(e.key).toUpperCase()) !== -1) {
            callback();
        }
    });
}
