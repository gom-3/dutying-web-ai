import {createRef} from 'react';
import {describe, expect, it, vi} from 'vitest';
import {render, screen, userEvent} from '@/shared/util/test-utils';
import {TutorialInfoBox} from '../TutorialInfoBox';

describe('TutorialInfoBox', () => {
    it('supports a wider information box for longer tutorial copy', () => {
        render(
            <TutorialInfoBox
                currentStep={{highlightIds: ['target'], title: '안내', info: 'AI가 그룹 안의 순서를 참고해 근무조 숙련도 균형을 맞춰요.'}}
                infoBoxElement={createRef<HTMLDivElement>()}
                infoBoxWidth={480}
                onNext={vi.fn()}
                onPrevious={vi.fn()}
                stepIndex={0}
                totalSteps={1}
            />,
        );

        expect(screen.getByText('안내').closest('#InfoBox')).toHaveStyle({width: '480px'});
    });

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
