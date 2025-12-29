import type {Selection} from '../../editor-core/selection';
import {normalizeRange} from '../../editor-core/selection';

export function getSelectionRect(selection: Selection | null) {
    if (!selection) return null;

    return normalizeRange(selection);
}
