import {createRoot} from 'react-dom/client';
import i18n from '@/i18n';
import {NurseShiftTypesHelp} from '@/pages/member/ui/nurse-shift-types-help';
import {TooltipProvider} from '@/shared/ui/primitives/tooltip';
import '@/index.css';

// Synthetic UI fixture only. This preview never calls a nurse or schedule API.
const params = new URLSearchParams(location.search);
void i18n.changeLanguage(params.get('lang') ?? 'ko');
function Preview() {
    return (
        <TooltipProvider delayDuration={120}>
            <main className="mx-auto w-full max-w-[400px] px-5 py-8 text-sub-1">
                <p className="text-xs font-semibold text-sub-2">로컬 UI 미리보기 · 예시 데이터</p>
                <h1 className="mt-2 text-xl font-semibold">간호사 정보</h1>
                <div className="mt-5 flex items-center gap-1">
                    <p className="text-sm font-semibold">가능 근무</p>
                    <NurseShiftTypesHelp />
                </div>
            </main>
        </TooltipProvider>
    );
}

createRoot(document.getElementById('root')!).render(<Preview />);
