import type {THospitalResponse} from '@dutying/api/hospital';
import {useEffect, useRef, useState} from 'react';
import {HospitalAPI} from '@/shared/api';

/** 타이핑마다 부르지 않는다. 온보딩 첫 화면이라 입력이 빠르고 결과는 조금 늦어도 된다. */
const DEBOUNCE_MS = 250;
const MAX_RESULTS = 20;

export type THospitalSearchState = {
    results: THospitalResponse[];
    isLoading: boolean;
    hasError: boolean;
};

export const useHospitalSearch = (keyword: string): THospitalSearchState => {
    const [state, setState] = useState<THospitalSearchState>({results: [], isLoading: false, hasError: false});
    // 늦게 도착한 이전 응답이 최신 결과를 덮어쓰지 않게 요청 순번을 센다.
    const latestRequestId = useRef(0);

    useEffect(() => {
        const trimmedKeyword = keyword.trim();

        if (trimmedKeyword.length === 0) {
            latestRequestId.current += 1;
            setState({results: [], isLoading: false, hasError: false});

            return;
        }

        const requestId = latestRequestId.current + 1;

        latestRequestId.current = requestId;
        setState((prev) => ({...prev, isLoading: true, hasError: false}));

        const timer = setTimeout(() => {
            HospitalAPI.searchHospitals({keyword: trimmedKeyword, size: MAX_RESULTS})
                .then((results) => {
                    if (latestRequestId.current !== requestId) return;

                    setState({results, isLoading: false, hasError: false});
                })
                .catch(() => {
                    if (latestRequestId.current !== requestId) return;

                    // 검색 실패가 온보딩을 막지 않는다. 직접 입력으로 계속 갈 수 있다.
                    setState({results: [], isLoading: false, hasError: true});
                });
        }, DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [keyword]);

    return state;
};
