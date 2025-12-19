import {type ReactNode, Fragment} from 'react';

export function renderMultilineText(text: string): ReactNode {
    return text.split('\n').map((line, index) => (
        <Fragment key={index}>
            {line}
            {index < text.length - 1 && <br />}
        </Fragment>
    ));
}
