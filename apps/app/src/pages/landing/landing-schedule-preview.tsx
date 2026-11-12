import type {TWebLanguage} from '@/shared/i18n/locale';
import {Check, Eraser, Eye, History, Pin, Redo2, Undo2} from 'lucide-react';
import {type CSSProperties, useEffect, useState} from 'react';
import aiAutofillSparkleIcon from '@/shared/assets/images/ai-autofill-sparkle.png';
import {type TI18nKey, useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {useLandingReducedMotion} from './use-landing-reduced-motion';
import './landing-schedule-preview.css';

// Fictional staff for the public product preview.
const namesByLanguage: Record<TWebLanguage, readonly string[]> = {
    ko: [
        '김서연',
        '이수진',
        '박민지',
        '최유나',
        '정하은',
        '강지현',
        '윤소영',
        '한예린',
        '오지우',
        '임다은',
        '서지민',
        '송유진',
        '문소희',
        '조은서',
    ],
    en: [
        'Emma Reed',
        'Ava Chen',
        'Mia Patel',
        'Nora Kim',
        'Leah Jones',
        'Zoe Martin',
        'Ivy Clark',
        'Ella Park',
        'Maya Shah',
        'Ruby Lee',
        'Isla Brown',
        'Lily Cruz',
        'Sara Ali',
        'Nina Scott',
    ],
    ja: [
        '佐藤 美咲',
        '鈴木 葵',
        '高橋 由衣',
        '田中 彩花',
        '伊藤 美穂',
        '渡辺 結衣',
        '中村 優奈',
        '小林 舞',
        '山本 遥',
        '加藤 凛',
        '吉田 結菜',
        '山田 真央',
        '佐々木 綾',
        '松本 明里',
    ],
    zh: [
        '陈雨桐',
        '李佳宁',
        '王思琪',
        '刘晓彤',
        '张雅婷',
        '杨静怡',
        '赵欣然',
        '黄若琳',
        '周雪晴',
        '吴诗涵',
        '徐梦瑶',
        '孙晓月',
        '马梓涵',
        '胡婉清',
    ],
    'zh-TW': [
        '陳怡君',
        '林雅婷',
        '黃佳穎',
        '張詩涵',
        '李佩珊',
        '王思妤',
        '吳欣怡',
        '劉宛庭',
        '蔡宜蓁',
        '楊佳蓉',
        '許婉婷',
        '鄭心怡',
        '謝雨彤',
        '郭子晴',
    ],
    th: [
        'ณิชา',
        'พิมพ์ชนก',
        'ศิริพร',
        'ปวีณา',
        'กัญญา',
        'สุภาวดี',
        'วราภรณ์',
        'นภัสสร',
        'ธัญชนก',
        'อรทัย',
        'อัญชลี',
        'สุชาดา',
        'ภัทรวดี',
        'กมลวรรณ',
    ],
    vi: [
        'Mai Anh',
        'Thu Hà',
        'Ngọc Linh',
        'Phương Thảo',
        'Khánh Vy',
        'Thanh Hương',
        'Bảo Trâm',
        'Minh Châu',
        'Thùy Dung',
        'Hoài An',
        'Yến Nhi',
        'Ngọc Mai',
        'Lan Anh',
        'Hà My',
    ],
};
const stepLabels = [
    'page.makeShift.steps.workers.label',
    'page.makeShift.steps.constraints.label',
    'page.makeShift.steps.requests.label',
    'page.makeShift.steps.fixedShifts.label',
    'page.makeShift.steps.aiAutofill.label',
] as const satisfies readonly TI18nKey[];
const shiftCodes = ['D', 'E', 'N', 'O'] as const;
const rotation = ['D', 'D', 'E', 'N', 'O', 'O', 'N', 'O'] as const;
const startingShifts = [0, 2, 4, 6, 1, 3, 5, 7, 0, 4, 1, 2, 5, 6];
const fixedCells = [
    [0, 8],
    [2, 0],
    [3, 9],
    [3, 12],
    [6, 2],
    [8, 20],
    [9, 23],
    [13, 14],
] as const;
const workViolation = {row: 4, startColumn: 15, actual: 5, expected: 4} as const;
const violationAnchorColumn = workViolation.startColumn + Math.floor(workViolation.actual / 2);
const waveColumnStagger = 34;
const waveRowStagger = 46;
const waveCellDuration = 500;
const waveSettleDuration = 50;
const dates = Array.from({length: 31}, (_, index) => {
    const day = index + 1;
    const weekday = new Date(Date.UTC(2026, 6, day)).getUTCDay();

    return {day, weekend: weekday === 0 ? 'sun' : weekday === 6 ? 'sat' : undefined};
});
const rows = startingShifts.map((offset, row) =>
    dates.map((_, column) => {
        const dayOfStreak = column - workViolation.startColumn;
        const violation = row === workViolation.row && dayOfStreak >= 0 && dayOfStreak < workViolation.actual;
        const shift = violation && dayOfStreak === workViolation.actual - 1 ? 'N' : rotation[(column + offset) % rotation.length];
        const fixed = fixedCells.some(([r, c]) => row === r && column === c);

        return {shift, fixed, violation, waveDelay: column * waveColumnStagger + row * waveRowStagger};
    }),
);
const waveDuration = (dates.length - 1) * waveColumnStagger + (rows.length - 1) * waveRowStagger + waveCellDuration;
const previewStages = [
    {stage: 'ready', duration: 850},
    {stage: 'pressing', duration: 250},
    {stage: 'filling', duration: waveDuration + waveSettleDuration},
    {stage: 'complete', duration: 500},
    {stage: 'violations', duration: 2700},
] as const;

export function LandingSchedulePreview({language}: {language: TWebLanguage}) {
    const {t} = useTypedTranslation();
    const [stageIndex, setStageIndex] = useState(0);
    const reducedMotion = useLandingReducedMotion();

    useEffect(() => {
        if (reducedMotion) return;

        const timeout = window.setTimeout(() => {
            setStageIndex((stageIndex + 1) % previewStages.length);
        }, previewStages[stageIndex].duration);

        return () => window.clearTimeout(timeout);
    }, [stageIndex, reducedMotion]);

    const stage = reducedMotion ? 'violations' : previewStages[stageIndex].stage;
    const names = namesByLanguage[language];
    const showViolation = stage === 'violations';
    const isFilled = stage === 'complete' || showViolation;
    const violationTitle = t('page.makeShift.calendar.violationDialogAria', {count: 1});
    const violationMessage = t('feature.shiftEditor.validation.maxConsecutiveWork', {
        nurseName: names[workViolation.row],
        actual: workViolation.actual,
        expected: workViolation.expected,
    });

    return (
        <div className="landing-schedule-preview">
            <div
                className="landing-schedule-preview__board"
                role="img"
                aria-label={`${t('page.landing.imageAlt.aiSchedule')}. ${violationTitle}. ${violationMessage}`}
                data-stage={stage}
                style={{'--roster-wave-cell-duration': `${waveCellDuration}ms`} as CSSProperties}
            >
                <div className="landing-schedule-preview__header" aria-hidden="true">
                    <ol className="landing-schedule-preview__steps" aria-hidden="true">
                        {stepLabels.map((key, index) => (
                            <li key={key} className="landing-schedule-preview__step">
                                <span>{index < stepLabels.length - 1 ? <Check /> : index + 1}</span>
                                {t(key)}
                            </li>
                        ))}
                    </ol>
                    <div className="landing-schedule-preview__toolbar" aria-hidden="true">
                        <div className="landing-schedule-preview__heading">
                            <p className="landing-schedule-preview__title">{t('page.makeShift.aiRefill.toolbarTitle')}</p>
                            <p>{t('page.makeShift.aiRefill.toolbarSubTitle')}</p>
                        </div>
                        <div className="landing-schedule-preview__actions">
                            <span className="landing-schedule-preview__tools">
                                <Pin />
                                <Eraser />
                                <Eye />
                                <Undo2 />
                                <Redo2 />
                                <History />
                            </span>
                            <span className="landing-schedule-preview__autofill" data-pressed={stage === 'pressing'}>
                                <span
                                    className="landing-schedule-preview__sparkle"
                                    style={{backgroundImage: `url("${aiAutofillSparkleIcon}")`}}
                                />
                                {t('page.makeShift.aiRefill.firstFill')}
                            </span>
                            <span className="landing-schedule-preview__confirm">
                                <Check />
                                {t('page.makeShift.aiRefill.confirm')}
                            </span>
                        </div>
                    </div>
                </div>
                <table className="landing-schedule-preview__grid" aria-hidden="true">
                    <colgroup>
                        <col className="landing-schedule-preview__name-column" />
                        <col span={dates.length} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th scope="col">{t('feature.shiftEditor.grid.nameHeader')}</th>
                            {dates.map(({day, weekend}) => (
                                <th key={day} scope="col" data-weekend={weekend}>
                                    {day}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((shifts, row) => (
                            <tr key={names[row]}>
                                <th scope="row" className="landing-schedule-preview__name">
                                    {names[row]}
                                </th>
                                {shifts.map(({shift, fixed, violation, waveDelay}, column) => (
                                    <td key={dates[column].day} data-weekend={dates[column].weekend}>
                                        <span
                                            className="landing-schedule-preview__shift"
                                            data-fixed={fixed}
                                            data-violation={(showViolation && violation) || undefined}
                                            style={{'--roster-wave-delay': `${waveDelay}ms`} as CSSProperties}
                                        >
                                            <span className="landing-schedule-preview__placeholder">–</span>
                                            <span className="landing-schedule-preview__assignment" data-shift={shift}>
                                                {shift}
                                            </span>
                                        </span>
                                        {showViolation && row === workViolation.row && column === violationAnchorColumn && (
                                            <div className="landing-schedule-preview__violation">
                                                <p className="landing-schedule-preview__violation-title">{violationTitle}</p>
                                                <p>
                                                    {t('page.landing.schedulePreview.workStreak', {
                                                        actual: workViolation.actual,
                                                        expected: workViolation.expected,
                                                    })}
                                                </p>
                                            </div>
                                        )}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        {shiftCodes.map((code) => (
                            <tr key={code}>
                                <th scope="row" data-shift-total={code}>
                                    {code}
                                </th>
                                {dates.map(({day, weekend}, column) => (
                                    <td key={day} data-weekend={weekend}>
                                        {isFilled ? rows.filter((shifts) => shifts[column].shift === code).length : '–'}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
