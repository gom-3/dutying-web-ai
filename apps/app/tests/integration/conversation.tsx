import {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import type {TShift} from '@/entities/shift';
import {snapshotDetailToDoc, useShiftEditorStore} from '@/features/shift-editor';
import useAuthStore from '@/features/auth/model/store';
import client from '@/shared/api/client';
import '@/i18n';
import '@/index.css';
import AiConversationSidebar from '@/pages/make-shift/ui/steps/ai-auto-fill/ai-conversation-sidebar';
function Harness() {
    const [shift, setShift] = useState<TShift>();
    const [scope, setScope] = useState<{wardId: number; teamId: number; year: number; month: number}>();
    const [status, setStatus] = useState('합성 계정으로 로그인 중');
    const [generation, setGeneration] = useState(0);
    const doc = useShiftEditorStore((s) => s.doc);
    useEffect(() => {
        void (async () => {
            const setup = (await client.get('/__conversation-test/setup')).data;
            const login = (await client.post('/auth/admin/password/login', {email: setup.email, password: setup.password})).data;
            useAuthStore.getState().beginLogin(login.accessToken);
            useAuthStore.setState({accountId: login.account.adminAccountId, wardId: setup.wardId});
            const base = `/wards/${setup.wardId}/shift-teams/${setup.teamId}`;
            const data = (await client.get<TShift>(`${base}/duty?year=${setup.year}&month=${setup.month}`)).data;
            const workspace = (await client.get(`${base}/schedule/workspace?year=${setup.year}&month=${setup.month}`)).data;
            useShiftEditorStore
                .getState()
                .setDoc(snapshotDetailToDoc(workspace, data, setup.year, setup.month, {fixedCells: {}, requestCells: {}}));
            useShiftEditorStore.getState().setRulesHash(workspace.rulesHash);
            useShiftEditorStore.getState().setAutofillAdjustEnabled(true);
            setScope(setup);
            setShift(data);
            setStatus('실제 Spring·FastAPI 연결됨');
        })().catch((e) => setStatus(`초기화 실패: ${e.message}`));
    }, []);
    return (
        <main style={{padding: 20, marginRight: 430}}>
            <h1>합성 근무표 통합 검증</h1>
            <p role="status">{status}</p>
            <button onClick={() => setGeneration((n) => n + 1)}>현재 표 자동완성</button>
            <button
                onClick={() => {
                    const current = useShiftEditorStore.getState().doc;
                    const fixedCells: typeof current.fixedCells = {};
                    current.rows.forEach((row) =>
                        current.columns.slice(0, -1).forEach((date) => {
                            fixedCells[`${row.workerId}|${date}`] = true;
                        }),
                    );
                    useShiftEditorStore.getState().setDoc({...current, fixedCells});
                    setStatus('마지막 하루를 제외한 합성 표를 고정했어요');
                }}
            >
                마지막 하루만 조절 가능하게
            </button>
            <p>각 셀에서 근무를 직접 바꿀 수 있습니다. 실데이터는 사용하지 않습니다.</p>
            <table>
                <thead>
                    <tr>
                        <th>간호사</th>
                        {doc.columns.map((d) => (
                            <th key={d}>{d.slice(-2)}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {doc.rows.map((row, ri) => (
                        <tr key={row.workerId}>
                            <th>{doc.workerMeta[row.workerId]?.name}</th>
                            {row.cells.map((value, ci) => (
                                <td key={ci}>
                                    <select
                                        aria-label={`${doc.workerMeta[row.workerId]?.name} ${doc.columns[ci]}`}
                                        value={value ?? ''}
                                        onChange={(e) => {
                                            const current = useShiftEditorStore.getState().doc;
                                            useShiftEditorStore
                                                .getState()
                                                .setDoc({
                                                    ...current,
                                                    rows: current.rows.map((r, index) =>
                                                        index === ri
                                                            ? {
                                                                  ...r,
                                                                  cells: r.cells.map((c, index2) =>
                                                                      index2 === ci ? e.target.value || null : c,
                                                                  ),
                                                              }
                                                            : r,
                                                    ),
                                                });
                                        }}
                                    >
                                        <option value="">빈칸</option>
                                        {shift?.wardShiftTypes.map((t) => (
                                            <option key={t.wardShiftTypeId} value={t.shortName}>
                                                {t.shortName}
                                            </option>
                                        ))}
                                    </select>
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {shift && scope && (
                <AiConversationSidebar
                    open
                    onClose={() => {}}
                    {...scope}
                    shift={shift}
                    adjustEnabled
                    generationRequest={generation}
                    rebuildRequest={0}
                    onApplied={() => setStatus('실행 결과를 현재 표에 반영했어요')}
                />
            )}
        </main>
    );
}
createRoot(document.getElementById('root')!).render(<Harness />);
