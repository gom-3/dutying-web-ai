import type {ReactNode} from 'react';
import {useTypedTranslation, type TI18nKey} from '@/shared/hook/use-typed-translation';
import BaseSectionHeader from '@/shared/ui/SectionHeader';
import type {TOnboardingStep} from '../model';

type TStepLabel = {
    titleKey: TI18nKey;
    descriptionKey?: TI18nKey;
    titleHighlightKeys?: readonly TI18nKey[];
};

const STEP_LABELS: Record<TOnboardingStep, TStepLabel> = {
    1: {
        titleKey: 'page.onboardingWardCreate.section.identity.title',
        descriptionKey: 'page.onboardingWardCreate.section.identity.description',
        titleHighlightKeys: [
            'page.onboardingWardCreate.section.identity.highlightHospitalName',
            'page.onboardingWardCreate.section.identity.highlightWardName',
        ],
    },
    2: {
        titleKey: 'page.onboardingWardCreate.section.rotation.title',
    },
    3: {
        titleKey: 'page.onboardingWardCreate.section.schedule.title',
        descriptionKey: 'page.onboardingWardCreate.section.schedule.description',
        titleHighlightKeys: ['page.onboardingWardCreate.section.schedule.highlight'],
    },
    4: {
        titleKey: 'page.onboardingWardCreate.section.shiftType.title',
        descriptionKey: 'page.onboardingWardCreate.section.shiftType.description',
        titleHighlightKeys: ['page.onboardingWardCreate.section.shiftType.highlight'],
    },
    5: {
        titleKey: 'page.onboardingWardCreate.section.nurse.title',
        descriptionKey: 'page.onboardingWardCreate.section.nurse.description',
        titleHighlightKeys: ['page.onboardingWardCreate.section.nurse.highlight'],
    },
};

interface ISectionHeaderProps {
    step: TOnboardingStep;
}

function escapeRegExp(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function HighlightedTitleText({children}: {children: ReactNode}) {
    return <span className="text-highlight-soft text-highlight-soft--subtle">{children}</span>;
}

function HighlightedText({text, highlights = []}: {text: string; highlights?: readonly string[]}) {
    const availableHighlights = highlights.filter(Boolean);

    if (availableHighlights.length === 0) {
        return text;
    }

    const highlightedTextPattern = new RegExp(`(${availableHighlights.map(escapeRegExp).join('|')})`, 'g');

    return text
        .split(highlightedTextPattern)
        .map((part, index) =>
            availableHighlights.includes(part) ? <HighlightedTitleText key={`${part}-${index}`}>{part}</HighlightedTitleText> : part,
        );
}

function TitleLines({children, highlights}: {children: string; highlights?: readonly string[]}) {
    const lines = children.split('\n');

    return (
        <>
            {lines.map((line, index) => (
                <span key={`${line}-${index}`} className="block break-keep">
                    <HighlightedText text={line} highlights={highlights} />
                </span>
            ))}
        </>
    );
}

function SectionHeader({step}: ISectionHeaderProps) {
    const {t} = useTypedTranslation();
    const label = STEP_LABELS[step];
    const isIdentityStep = step === 1;
    const title = t(label.titleKey);
    const titleHighlights = label.titleHighlightKeys?.map((key) => t(key));
    const description = label.descriptionKey ? t(label.descriptionKey) : undefined;
    const headerClassName =
        isIdentityStep || step === 2 ? 'mb-6 max-w-[480px] space-y-2' : step === 3 ? 'mb-10 max-w-[720px]' : 'mb-10 max-w-[541px]';
    const renderedTitle = (
        <>
            <span className="sr-only">{title}</span>
            <span aria-hidden="true">
                <TitleLines highlights={titleHighlights}>{title}</TitleLines>
            </span>
        </>
    );

    return (
        <BaseSectionHeader
            className={headerClassName}
            title={renderedTitle}
            description={description}
            descriptionClassName={isIdentityStep ? 'text-sm leading-5 whitespace-normal' : 'whitespace-normal sm:whitespace-nowrap'}
        />
    );
}

export default SectionHeader;
