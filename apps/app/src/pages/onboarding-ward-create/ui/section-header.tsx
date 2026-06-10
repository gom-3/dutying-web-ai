import type {ReactNode} from 'react';
import {useTypedTranslation, type TI18nKey} from '@/shared/hook/use-typed-translation';
import BaseSectionHeader from '@/shared/ui/SectionHeader';
import type {TOnboardingStep} from '../model';

const STEP_LABELS: Record<TOnboardingStep, {titleKey: TI18nKey; descriptionKey: TI18nKey}> = {
    1: {
        titleKey: 'page.onboardingWardCreate.section.identity.title',
        descriptionKey: 'page.onboardingWardCreate.section.identity.description',
    },
    2: {
        titleKey: 'page.onboardingWardCreate.section.schedule.title',
        descriptionKey: 'page.onboardingWardCreate.section.schedule.description',
    },
    3: {
        titleKey: 'page.onboardingWardCreate.section.shiftType.title',
        descriptionKey: 'page.onboardingWardCreate.section.shiftType.description',
    },
    4: {
        titleKey: 'page.onboardingWardCreate.section.nurse.title',
        descriptionKey: 'page.onboardingWardCreate.section.nurse.description',
    },
};

interface ISectionHeaderProps {
    step: TOnboardingStep;
    aside?: ReactNode;
}

function SectionHeader({step, aside}: ISectionHeaderProps) {
    const {t} = useTypedTranslation();
    const label = STEP_LABELS[step];
    const isIdentityStep = step === 1;
    const description = t(label.descriptionKey);

    if (!aside) {
        return (
            <BaseSectionHeader
                className={isIdentityStep ? 'mb-6 max-w-[480px] space-y-2' : 'mb-10 max-w-[541px]'}
                title={t(label.titleKey)}
                description={description}
                descriptionClassName={isIdentityStep ? 'text-sm leading-5 whitespace-normal' : 'whitespace-normal sm:whitespace-nowrap'}
            />
        );
    }

    return (
        <div className="mb-10 flex items-start justify-between gap-8">
            <BaseSectionHeader
                className="max-w-[541px]"
                title={t(label.titleKey)}
                description={description}
                descriptionClassName="whitespace-normal sm:whitespace-nowrap"
            />
            <div className="shrink-0">{aside}</div>
        </div>
    );
}

export default SectionHeader;
