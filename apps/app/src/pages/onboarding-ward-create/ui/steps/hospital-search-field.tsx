import type {THospitalResponse} from '@dutying/api/hospital';
import type {TServiceRegion} from '@dutying/domain';
import {Check} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {useHospitalSearch} from '../../model/use-hospital-search';

export type THospitalSelection = {
    hospitalId?: number;
    hospitalName: string;
};

interface IHospitalSearchFieldProps {
    serviceRegion: TServiceRegion;
    hospitalName: string;
    hospitalId?: number;
    hasError?: boolean;
    fieldClassName: string;
    onChange: (selection: THospitalSelection) => void;
}

const NAME_FIELD_MAX_LENGTH = 50;
/** 한 글자로는 후보가 너무 많아 목록이 화면을 덮는다. 두 글자부터 연다. */
const MIN_KEYWORD_LENGTH = 2;

/**
 * 한국에서는 카탈로그를 추천하되 선택은 강제하지 않는다. 해외에서는 직접 입력만 받는다.
 *
 * <p>신규 개원이나 카탈로그 표기 누락으로 온보딩이 막히면 안 된다. 고른 병원은 ID를 함께
 * 보관하지만, 추천을 무시하고 다음으로 넘어가면 입력한 이름 자체가 값이다.
 */
function HospitalSearchField({
    serviceRegion,
    hospitalName,
    hospitalId,
    hasError = false,
    fieldClassName,
    onChange,
}: IHospitalSearchFieldProps) {
    const {t} = useTypedTranslation();
    const isKoreanRegion = serviceRegion === 'KR';
    const [keyword, setKeyword] = useState(hospitalName);
    // 목록은 타이핑하는 동안에만 뜬다. 고르거나 Esc·바깥 클릭이면 닫는다.
    const [isListOpen, setIsListOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    // 이어하기 초안은 서버에서 늦게 도착한다. 그때 밖에서 들어온 값으로 입력칸을 맞춘다.
    // 사용자가 친 글자를 덮지 않도록, 밖의 값이 실제로 바뀐 순간에만 따라간다.
    const lastExternalHospitalName = useRef(hospitalName);

    useEffect(() => {
        if (lastExternalHospitalName.current === hospitalName) return;

        lastExternalHospitalName.current = hospitalName;
        setKeyword(hospitalName);
        setIsListOpen(false);
    }, [hospitalName]);

    useEffect(() => {
        if (isKoreanRegion) return;

        // 지역이 바뀐 초안에 한국 병원 카탈로그 ID가 남지 않게 한다.
        if (typeof hospitalId === 'number') {
            onChange({hospitalId: undefined, hospitalName});
        }
    }, [isKoreanRegion, hospitalId, hospitalName, onChange]);

    useEffect(() => {
        if (!isListOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (rootRef.current?.contains(event.target as Node)) return;

            setIsListOpen(false);
        };

        document.addEventListener('pointerdown', handlePointerDown);

        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [isListOpen]);

    const trimmedKeyword = keyword.trim();
    const canSearch = trimmedKeyword.length >= MIN_KEYWORD_LENGTH;
    const {results, isLoading, hasError: hasSearchError} = useHospitalSearch(isKoreanRegion && isListOpen && canSearch ? keyword : '');
    // 결과가 없다고 목록을 열어 "없어요"를 보여주면 잘못 입력했다는 인상을 준다. 자유 입력은 그대로 둔다.
    const isListVisible = isKoreanRegion && isListOpen && canSearch && (isLoading || hasSearchError || results.length > 0);
    const isMatched = isKoreanRegion && typeof hospitalId === 'number';
    const selectHospital = (hospital: THospitalResponse) => {
        setKeyword(hospital.name);
        lastExternalHospitalName.current = hospital.name;
        setIsListOpen(false);
        onChange({hospitalId: hospital.hospitalId, hospitalName: hospital.name});
    };

    return (
        <div ref={rootRef} className="space-y-2">
            <div className="relative">
                <input
                    id="onboarding-hospital-name"
                    type="text"
                    role={isKoreanRegion ? 'combobox' : undefined}
                    aria-expanded={isKoreanRegion ? isListVisible : undefined}
                    aria-label={t('page.onboardingWardCreate.identity.hospitalName')}
                    aria-invalid={hasError}
                    autoComplete="off"
                    value={keyword}
                    placeholder={t('page.onboardingWardCreate.identity.hospitalNamePlaceholder')}
                    maxLength={NAME_FIELD_MAX_LENGTH}
                    className={`${fieldClassName} ${isMatched ? 'pr-11' : ''}`}
                    onChange={(event) => {
                        setKeyword(event.target.value);
                        lastExternalHospitalName.current = event.target.value;
                        setIsListOpen(isKoreanRegion);
                        // 고른 병원을 지우고 다시 타이핑하면 선택은 풀린다.
                        onChange({hospitalId: undefined, hospitalName: event.target.value});
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Escape') setIsListOpen(false);
                    }}
                />
                {isMatched && (
                    <Check
                        role="img"
                        aria-label={t('page.onboardingWardCreate.identity.hospitalMatched')}
                        className="pointer-events-none absolute top-1/2 right-4 size-[18px] -translate-y-1/2 text-main-1"
                    />
                )}
            </div>
            {isListVisible && (
                <ul className="max-h-64 overflow-y-auto rounded-[14px] bg-gray-7" role="listbox">
                    {results.map((hospital) => {
                        // 같은 이름의 다른 병원을 구분하려면 종별과 지역이 함께 보여야 한다.
                        const detail = [hospital.categoryName, hospital.region].filter(Boolean).join(' · ');

                        return (
                            <li key={hospital.hospitalId}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={hospital.hospitalId === hospitalId}
                                    className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-left hover:bg-gray-6/50"
                                    onClick={() => selectHospital(hospital)}
                                >
                                    <span className="text-[15px] font-medium text-sub-1">{hospital.name}</span>
                                    {detail.length > 0 && <span className="text-[13px] text-gray-3">{detail}</span>}
                                </button>
                            </li>
                        );
                    })}
                    {isLoading && results.length === 0 && (
                        <li className="px-4 py-3 text-[13px] text-gray-3">
                            {t('page.onboardingWardCreate.identity.hospitalSearchLoading')}
                        </li>
                    )}
                    {!isLoading && hasSearchError && (
                        <li className="px-4 py-3 text-[13px] text-gray-3">{t('page.onboardingWardCreate.identity.hospitalSearchError')}</li>
                    )}
                </ul>
            )}
            {isKoreanRegion && (
                <p className="px-1 text-[13px] text-gray-3">{t('page.onboardingWardCreate.identity.hospitalFreeTextHint')}</p>
            )}
        </div>
    );
}

export default HospitalSearchField;
