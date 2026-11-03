import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {legacyRosterApi} from '../api';
import type * as RosterApiModule from '../api';
import {LegacyRosterImport} from '../LegacyRosterImport';

vi.mock('../api', async (load) => ({
    ...(await load<typeof RosterApiModule>()),
    legacyRosterApi: {
        source: vi.fn(),
        previewSource: vi.fn(),
        commitSource: vi.fn(),
        previewFile: vi.fn(),
        commitFile: vi.fn(),
    },
}));

const api = vi.mocked(legacyRosterApi);
const result = {importedShifts: 2, skippedShifts: 1, createdShiftTypes: 2, reusedShiftTypes: 0, alreadyImported: false};
const hash = 'a'.repeat(64);

beforeEach(() => {
    vi.resetAllMocks();
    api.source.mockResolvedValue({available: true, years: [2024, 2023], message: null});
    api.previewSource.mockResolvedValue({sourceHash: hash, result});
    api.commitSource.mockResolvedValue(result);
});

async function preview() {
    fireEvent.click(screen.getByRole('button', {name: '기존 계정의 근무표 찾기'}));
    await screen.findByRole('combobox');
    fireEvent.click(screen.getByRole('button', {name: '이전 내용 미리보기'}));
    await screen.findByRole('button', {name: '확인한 근무표 가져오기'});
}

describe('previous roster import', () => {
    it('previews and explicitly commits the selected year with source hash', async () => {
        const imported = vi.fn();

        render(<LegacyRosterImport accountId={7} linked={false} onImported={imported} />);
        await preview();
        expect(api.commitSource).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', {name: '확인한 근무표 가져오기'}));
        await screen.findByText(/가져오기를 완료/);
        expect(api.commitSource).toHaveBeenCalledExactlyOnceWith(7, 2024, hash);
        expect(imported).toHaveBeenCalledOnce();
    });
    it('clears stale preview when the year changes', async () => {
        render(<LegacyRosterImport accountId={7} linked={false} />);
        await preview();
        fireEvent.change(screen.getByRole('combobox'), {target: {value: '2023'}});
        expect(screen.queryByRole('button', {name: '확인한 근무표 가져오기'})).toBeNull();
    });
    it('discards pending responses when the account changes', async () => {
        let resolve!: (data: Awaited<ReturnType<typeof legacyRosterApi.previewSource>>) => void;

        api.previewSource.mockImplementation(
            () =>
                new Promise((done) => {
                    resolve = done;
                }),
        );

        const view = render(<LegacyRosterImport accountId={7} linked={false} />);

        fireEvent.click(screen.getByRole('button', {name: '기존 계정의 근무표 찾기'}));
        await screen.findByRole('combobox');
        fireEvent.click(screen.getByRole('button', {name: '이전 내용 미리보기'}));
        view.rerender(<LegacyRosterImport accountId={8} linked={false} />);
        resolve({sourceHash: hash, result});
        await waitFor(() => expect(screen.queryByRole('button', {name: '확인한 근무표 가져오기'})).toBeNull());
        expect(api.commitSource).not.toHaveBeenCalled();
    });
    it('blocks repeated commit taps and permits an idempotent retry after failure', async () => {
        let reject!: (reason: Error) => void;

        api.commitSource.mockImplementationOnce(
            () =>
                new Promise((_, fail) => {
                    reject = fail;
                }),
        );
        render(<LegacyRosterImport accountId={7} linked={false} />);
        await preview();

        const button = screen.getByRole('button', {name: '확인한 근무표 가져오기'});

        fireEvent.click(button);
        fireEvent.click(button);
        expect(api.commitSource).toHaveBeenCalledOnce();
        reject(new Error('network failure'));
        await screen.findByRole('alert');
        fireEvent.click(button);
        await screen.findByText(/가져오기를 완료/);
        expect(api.commitSource).toHaveBeenCalledTimes(2);
    });
    it('reports unavailable source and rejects linked accounts', async () => {
        api.source.mockResolvedValue({available: false, years: [], message: 'unavailable'});

        const view = render(<LegacyRosterImport accountId={7} linked={false} />);

        fireEvent.click(screen.getByRole('button', {name: '기존 계정의 근무표 찾기'}));
        await screen.findByText(/연결을 준비 중/);
        expect(screen.queryByRole('combobox')).toBeNull();
        view.rerender(<LegacyRosterImport accountId={7} linked />);
        expect(screen.queryByRole('button', {name: '기존 계정의 근무표 찾기'})).toBeNull();
    });
    it('imports a saved file only after preview and explicit confirmation', async () => {
        api.previewFile.mockResolvedValue(result);
        api.commitFile.mockResolvedValue(result);

        const payload = {
            format: 'dutying-legacy-roster',
            version: 1,
            startDate: '2024-01-01',
            endDate: '2024-12-31',
            shiftTypes: [{id: 101}],
            shifts: [{date: '2024-02-29', shiftTypeId: 101}],
        };
        const file = new File([JSON.stringify(payload)], 'roster.json', {type: 'application/json'});

        Object.defineProperty(file, 'text', {value: async () => JSON.stringify(payload)});
        render(<LegacyRosterImport accountId={7} linked={false} />);
        fireEvent.change(screen.getByLabelText(/보관한 근무표 파일/), {target: {files: [file]}});
        await screen.findByRole('button', {name: '확인한 근무표 가져오기'});
        expect(api.commitFile).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', {name: '확인한 근무표 가져오기'}));
        await screen.findByText(/가져오기를 완료/);
        expect(api.commitFile).toHaveBeenCalledOnce();
        expect(api.commitSource).not.toHaveBeenCalled();
    });
});
