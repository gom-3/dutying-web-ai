import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {TShift} from '@/entities/shift';
import type {TResultVersion} from '@/pages/make-shift/model/schedule-conversation-api';
import AiConversationSnapshot from '@/pages/make-shift/ui/steps/ai-auto-fill/ai-conversation-snapshot';
import '@/i18n';
import '@/index.css';
const codes = ['D', 'E', 'N', '/'];
const shift: TShift = {
    lastDays: [],
    days: Array.from({length: 31}, (_, i) => ({
        day: i + 1,
        dayType: [3, 10, 17, 24, 31].includes(i + 1) ? 'saturday' : [4, 11, 18, 25].includes(i + 1) ? 'sunday' : 'workday',
    })),
    wardShiftTypes: codes.map((code, i) => ({
        wardShiftTypeId: i + 1,
        name: code,
        shortName: code,
        isDefault: true,
        isOff: i === 3,
        isCounted: true,
        color: ['#44c4b0', '#ff84a5', '#397dff', '#455a7a'][i]!,
        classification: i === 3 ? 'OFF' : i === 2 ? 'NIGHT' : i === 1 ? 'EVENING' : 'DAY',
    })),
    divisionShiftNurses: [
        Array.from({length: 25}, (_, i) => ({
            shiftNurse: {
                shiftNurseId: i + 1,
                nurseId: i + 1,
                name: `합성 ${String(i + 1).padStart(2, '0')}`,
                isWorker: true,
                carried: 0,
                divisionNum: 0,
                priority: i,
            },
            lastWardShiftList: [1, 1, 3, 4],
            lastWardReqShiftList: [],
            wardShiftList: [],
            wardReqShiftList: [],
        })),
    ],
};
const version: TResultVersion = {
    versionId: 'synthetic-result',
    parentVersionId: 'synthetic-before',
    year: 2026,
    month: 10,
    createdAt: '2026-10-03T19:00:00',
    constraintsJson: '{}',
    inputDigest: 'synthetic',
    rowOrder: shift.divisionShiftNurses[0]!.map((row, i) => ({shiftNurseId: row.shiftNurse.shiftNurseId, displayOrder: i})),
    carryOverCells: shift.divisionShiftNurses[0]!.flatMap((r) =>
        [27, 28, 29, 30].map((day, i) => ({
            shiftNurseId: r.shiftNurse.shiftNurseId,
            date: `2026-09-${day}`,
            wardShiftTypeId: [1, 1, 3, 4][i]!,
            shiftCode: codes[[0, 0, 2, 3][i]!]!,
            fixed: false,
        })),
    ),
    cells: shift.divisionShiftNurses[0]!.flatMap((r, i) =>
        Array.from({length: 31}, (_, d) => {
            const n = (Math.floor(d / 2) + i) % 4;
            return {
                shiftNurseId: r.shiftNurse.shiftNurseId,
                date: `2026-10-${String(d + 1).padStart(2, '0')}`,
                wardShiftTypeId: n + 1,
                shiftCode: codes[n]!,
                fixed: false,
            };
        }),
    ),
};
const before: TResultVersion = {
    ...version,
    versionId: 'synthetic-before',
    cells: version.cells.map((c, i) => (i % 17 === 0 ? {...c, wardShiftTypeId: 4, shiftCode: '/'} : c)),
};
function Preview() {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState('합성 데이터 · 실제 제품 렌더러');
    return (
        <main className="p-6">
            <p>{message}</p>
            <button className="rounded-lg border p-3" onClick={() => setOpen(true)}>
                그때 표 보기
            </button>
            {open && (
                <AiConversationSnapshot
                    shift={shift}
                    version={version}
                    before={before}
                    disabled={false}
                    onClose={() => setOpen(false)}
                    onContinue={(selected) => {
                        setMessage(`${selected === version ? '결과' : '실행 전'} 판본에서 이어서 작성 선택`);
                        setOpen(false);
                    }}
                />
            )}
        </main>
    );
}
createRoot(document.getElementById('root')!).render(<Preview />);
