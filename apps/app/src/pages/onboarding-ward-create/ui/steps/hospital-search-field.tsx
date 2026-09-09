import type {THospitalResponse} from '@dutying/api/hospital';
import {useEffect, useRef, useState} from 'react';
import {useTypedTranslation} from '@/shared/hook/use-typed-translation';
import {useHospitalSearch} from '../../model/use-hospital-search';

export type THospitalSelection = {
    hospitalId?: number;
    hospitalName: string;
};

interface IHospitalSearchFieldProps {
    hospitalName: string;
    hospitalId?: number;
    hasError?: boolean;
    fieldClassName: string;
    onChange: (selection: THospitalSelection) => void;
}

const NAME_FIELD_MAX_LENGTH = 50;

/**
 * 병원을 카탈로그에서 고르게 한다. 자유 입력이던 시절에는 같은 병원이 여러 표기로 들어와
 * 동일 병원 판별이 불가능했다.
 *
 * <p>목록에 없는 병원은 입력한 그대로 쓸 수 있게 남겨둔다. 신규 개원이나 표기 누락으로
 * 온보딩이 막히면 안 된다.
 */
function HospitalSearchField({hospitalName, hospitalId, hasError = false, fieldClassName, onChange}: IHospitalSearchFieldProps) {
    const {t} = useTypedTranslation();
    // 고른 병원이 있으면 검색창을 접는다. 다시 고치려면 '다시 검색'을 누른다.
    const [isSearching, setIsSearching] = useState(typeof hospitalId !== 'number');
    const [keyword, setKeyword] = useState(hospitalName);
    // 이어하기 초안은 서버에서 늦게 도착한다. 그때 밖에서 들어온 값으로 입력칸을 맞춘다.
    // 사용자가 친 글자를 덮지 않도록, 밖의 값이 실제로 바뀐 순간에만 따라간다.
    const lastExternalHospitalName = useRef(hospitalName);

    useEffect(() => {
        if (lastExternalHospitalName.current === hospitalName) return;

        lastExternalHospitalName.current = hospitalName;
        setKeyword(hospitalName);
        setIsSearching(typeof hospitalId !== 'number');
    }, [hospitalName, hospitalId]);

    const {results, isLoading, hasError: hasSearchError} = useHospitalSearch(isSearching ? keyword : '');
    const trimmedKeyword = keyword.trim();
    const selectHospital = (hospital: THospitalResponse) => {
        setKeyword(hospital.name);
        lastExternalHospitalName.current = hospital.name;
        setIsSearching(false);
        onChange({hospitalId: hospital.hospitalId, hospitalName: hospital.name});
    };
    const useTypedName = () => {
        lastExternalHospitalName.current = trimmedKeyword;
        setIsSearching(false);
        onChange({hospitalId: undefined, hospitalName: trimmedKeyword});
    };
    const startSearching = () => {
        setIsSearching(true);
        setKeyword(hospitalName);
    };

    if (!isSearching) {
        return (
            <div className={`${fieldClassName} flex items-center justify-between gap-3`}>
                <span className="truncate">{hospitalName}</span>
                <button
                    type="button"
                    className="shrink-0 text-[13px] font-semibold text-main-1 underline underline-offset-2"
                    onClick={startSearching}
                >
                    {t('page.onboardingWardCreate.identity.hospitalChange')}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <input
                id="onboarding-hospital-name"
                type="search"
                role="combobox"
                aria-expanded={trimmedKeyword.length > 0}
                aria-label={t('page.onboardingWardCreate.identity.hospitalName')}
                aria-invalid={hasError}
                autoComplete="off"
                value={keyword}
                placeholder={t('page.onboardingWardCreate.identity.hospitalSearchPlaceholder')}
                maxLength={NAME_FIELD_MAX_LENGTH}
                className={fieldClassName}
                onChange={(event) => {
                    setKeyword(event.target.value);
                    lastExternalHospitalName.current = event.target.value;
                    // 고른 병원을 지우고 다시 타이핑하면 선택은 풀린다.
                    onChange({hospitalId: undefined, hospitalName: event.target.value});
                }}
            />
            {trimmedKeyword.length > 0 && (
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
                    {!isLoading && !hasSearchError && results.length === 0 && (
                        <li className="px-4 py-3 text-[13px] text-gray-3">{t('page.onboardingWardCreate.identity.hospitalSearchEmpty')}</li>
                    )}
                    <li>
                        <button
                            type="button"
                            className="w-full px-4 py-3 text-left text-[13px] font-semibold text-main-1"
                            onClick={useTypedName}
                        >
                            {t('page.onboardingWardCreate.identity.hospitalUseTypedName', {keyword: trimmedKeyword})}
                        </button>
                    </li>
                </ul>
            )}
        </div>
    );
}

export default HospitalSearchField;
