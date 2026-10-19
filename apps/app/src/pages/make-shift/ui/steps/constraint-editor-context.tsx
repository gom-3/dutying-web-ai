import {createContext, useContext} from 'react';

/** Keep editor popups inside their owning dialog's focus and pointer scope. */
export const ConstraintEditorContext = createContext<{dialog: boolean; portalContainer: HTMLElement | null}>({
    dialog: false,
    portalContainer: null,
});

export const useConstraintEditorContext = () => useContext(ConstraintEditorContext);
