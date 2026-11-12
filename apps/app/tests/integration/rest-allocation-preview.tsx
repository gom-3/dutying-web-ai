import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import i18n from '@/i18n';
import type {TNurseShiftTypeOption} from '@/pages/member/model/nurse-shift-types';
import {RestAllocationSettings} from '@/pages/member/ui/rest-allocation-settings';
import '@/index.css';

// Synthetic UI fixture only. This preview never calls a nurse or schedule API.
const params = new URLSearchParams(location.search);
void i18n.changeLanguage(params.get('lang') ?? 'ko');
const initialOptions: TNurseShiftTypeOption[] = [
    {name: '일반 OFF', classification: 'OFF', isPossible: true},
    {name: '연차', classification: 'ANNUAL_LEAVE', isPossible: false},
    {
        name: params.has('long') ? '교육 및 장기 근속 특별 휴가 (병동 사용자 지정 휴무)' : '기타 휴무',
        classification: 'OTHER_LEAVE',
        isPossible: false,
    },
].map((type, index) => ({
    ...type,
    classification: type.classification as TNurseShiftTypeOption['classification'],
    apiShiftTypeId: index + 101,
    nurseShiftTypeId: index + 101,
    wardShiftTypeId: index + 1,
    isPreferred: false,
}));

function Preview() {
    const [saved, setSaved] = useState(initialOptions);
    const [draft, setDraft] = useState(initialOptions);
    const [message, setMessage] = useState('예시 데이터로 표시합니다. 실제 간호사 정보는 변경하지 않아요.');
    const dirty = draft.some((type, index) => type.isPossible !== saved[index]?.isPossible);

    return (
        <main className="mx-auto w-full max-w-[400px] px-5 py-8 text-sub-1">
            <p className="text-xs font-semibold text-sub-2">로컬 UI 미리보기</p>
            <h1 className="mt-2 text-xl font-semibold">간호사 정보</h1>
            <p className="mt-5 font-semibold">김듀티</p>
            <p className="mt-1 text-sm text-sub-2">A병동 · 예시 간호사</p>
            <RestAllocationSettings
                options={draft}
                disabled={false}
                onChange={(id, isPossible) => {
                    setDraft((previous) => previous.map((type) => (type.apiShiftTypeId === id ? {...type, isPossible} : type)));
                    setMessage('아직 저장하지 않은 변경이 있어요.');
                }}
            />
            <div className="mt-6 flex flex-wrap gap-2">
                <button
                    type="button"
                    className="min-h-11 flex-1 basis-32 rounded-lg bg-gray-7 px-4 text-sm font-semibold focus-visible:bg-main-4 focus-visible:underline disabled:opacity-50"
                    disabled={!dirty}
                    onClick={() => {
                        setDraft(saved);
                        setMessage('변경을 취소했어요.');
                    }}
                >
                    변경 취소
                </button>
                <button
                    type="button"
                    className="min-h-11 flex-1 basis-32 rounded-lg bg-main-1 px-4 text-sm font-semibold text-white focus-visible:bg-main-1-hover focus-visible:underline disabled:bg-gray-7 disabled:text-sub-2"
                    disabled={!dirty}
                    onClick={() => {
                        setSaved(draft);
                        setMessage('미리보기에만 저장했어요. 실제 정보는 바뀌지 않아요.');
                    }}
                >
                    저장하기
                </button>
            </div>
            <p role="status" className="mt-4 text-xs leading-relaxed text-sub-2">
                {message}
            </p>
        </main>
    );
}

createRoot(document.getElementById('root')!).render(<Preview />);
