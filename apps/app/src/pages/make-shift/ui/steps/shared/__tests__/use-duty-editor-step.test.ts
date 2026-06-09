import {describe, expect, it, vi} from 'vitest';
import {focusEditorWithoutScrolling} from '../use-duty-editor-step';

describe('focusEditorWithoutScrolling', () => {
    it('focuses the editor without letting the browser adjust scroll position', () => {
        const editor = document.createElement('div');
        const focus = vi.spyOn(editor, 'focus').mockImplementation(() => undefined);

        focusEditorWithoutScrolling(editor);

        expect(focus).toHaveBeenCalledWith({preventScroll: true});
    });
});
