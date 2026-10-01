/** Prepare a separate, full-name calendar without changing the on-screen schedule. */
export function createShiftImageCapture(element: HTMLElement) {
    const originalNames = Array.from(element.querySelectorAll<HTMLElement>('.make-shift-calendar__row-name[title]'));

    if (originalNames.length === 0) return {element, dispose: () => {}};

    const originalWidth = Math.max(element.scrollWidth, element.clientWidth);
    const originalNameWidth = Math.max(...originalNames.map((name) => name.getBoundingClientRect().width));
    const capture = element.cloneNode(true) as HTMLElement;

    capture.setAttribute('aria-hidden', 'true');
    capture.style.position = 'fixed';
    capture.style.left = '-100000px';
    capture.style.top = '0';
    capture.style.width = `${originalWidth}px`;
    capture.style.maxWidth = 'none';
    capture.style.pointerEvents = 'none';
    (element.parentElement ?? document.body).appendChild(capture);

    try {
        let nameWidth = originalNameWidth;

        capture.querySelectorAll<HTMLElement>('.make-shift-calendar__row-name[title]').forEach((name) => {
            const label = document.createElement('span');

            label.textContent = name.title;
            label.style.flexShrink = '0';
            label.style.whiteSpace = 'pre';
            name.replaceChildren(label);
            name.style.overflow = 'visible';
            name.style.textOverflow = 'clip';
            // Freeze the font before expanding the container: calendar fonts use cqw.
            name.style.fontSize = window.getComputedStyle(name).fontSize;
            nameWidth = Math.max(nameWidth, label.getBoundingClientRect().width + 16);
        });

        nameWidth = Math.ceil(nameWidth);
        capture.style.setProperty('--make-shift-name-column-width', `${nameWidth}px`);
        // Keep the day columns available when a long name needs more room.
        capture.style.width = `${Math.ceil(originalWidth + nameWidth - originalNameWidth)}px`;
        capture.querySelectorAll<HTMLElement>('[data-sticky-header="true"]').forEach((header) => {
            header.style.position = 'static';
        });

        return {element: capture, dispose: () => capture.remove()};
    } catch (error) {
        capture.remove();
        throw error;
    }
}
