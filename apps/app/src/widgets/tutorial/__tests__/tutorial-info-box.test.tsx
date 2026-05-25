import {createRef} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import {TutorialInfoBox} from '../TutorialInfoBox';

describe('TutorialInfoBox', () => {
    it('uses complete as the last-step primary action', async () => {
        const user = userEvent.setup();
        const onNext = vi.fn();

        render(
            <TutorialInfoBox
                currentStep={{highlightIds: ['target'], title: '마지막 단계', info: '튜토리얼을 마무리해요.'}}
                infoBoxElement={createRef<HTMLDivElement>()}
                onNext={onNext}
                onPrevious={vi.fn()}
                stepIndex={1}
                totalSteps={2}
            />,
        );

        await user.click(screen.getByRole('button', {name: '완료'}));

        expect(onNext).toHaveBeenCalledTimes(1);
    });
});
