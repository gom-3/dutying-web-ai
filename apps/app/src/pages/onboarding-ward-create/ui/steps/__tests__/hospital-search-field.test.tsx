import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import HospitalSearchField from '../hospital-search-field';

const mockSearchHospitals = vi.fn();

vi.mock('@/shared/api', () => ({
    HospitalAPI: {
        searchHospitals: (...args: unknown[]) => mockSearchHospitals(...args),
    },
}));

vi.mock('@/shared/hook/use-typed-translation', () => ({
    useTypedTranslation: () => ({
        t: (key: string, values?: Record<string, unknown>) => (values ? `${key}:${Object.values(values).join(',')}` : key),
    }),
}));

const HOSPITAL = {hospitalId: 7, name: '세브란스병원', categoryName: '상급종합', region: '서울 서대문구'};
const renderField = (onChange = vi.fn(), props: Partial<Parameters<typeof HospitalSearchField>[0]> = {}) => {
    render(<HospitalSearchField fieldClassName="field" hospitalName="" onChange={onChange} {...props} />);

    return onChange;
};

describe('HospitalSearchField', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSearchHospitals.mockResolvedValue([HOSPITAL]);
    });

    it('검색 결과를 고르면 카탈로그 id 와 이름을 함께 올린다', async () => {
        const user = userEvent.setup();
        const onChange = renderField();

        await user.type(screen.getByRole('combobox'), '세브란스');

        const option = await screen.findByRole('option', {name: /세브란스병원/});

        await user.click(option);

        expect(onChange).toHaveBeenLastCalledWith({hospitalId: 7, hospitalName: '세브란스병원'});
    });

    it('지역과 종별을 함께 보여 같은 이름의 다른 병원을 구분하게 한다', async () => {
        const user = userEvent.setup();

        renderField();
        await user.type(screen.getByRole('combobox'), '세브란스');

        expect(await screen.findByText('상급종합 · 서울 서대문구')).toBeInTheDocument();
    });

    it('목록에 없으면 입력한 이름을 그대로 쓴다', async () => {
        const user = userEvent.setup();

        mockSearchHospitals.mockResolvedValue([]);

        const onChange = renderField();

        await user.type(screen.getByRole('combobox'), '새로연병원');

        // 신규 개원이나 표기 누락으로 온보딩이 막히면 안 된다.
        await user.click(await screen.findByRole('button', {name: /hospitalUseTypedName/}));

        expect(onChange).toHaveBeenLastCalledWith({hospitalId: undefined, hospitalName: '새로연병원'});
    });

    it('검색이 실패해도 직접 입력 길은 남는다', async () => {
        const user = userEvent.setup();

        mockSearchHospitals.mockRejectedValue(new Error('network'));

        const onChange = renderField();

        await user.type(screen.getByRole('combobox'), '세브란스');

        await waitFor(() => expect(screen.getByText('page.onboardingWardCreate.identity.hospitalSearchError')).toBeInTheDocument());

        await user.click(screen.getByRole('button', {name: /hospitalUseTypedName/}));

        expect(onChange).toHaveBeenLastCalledWith({hospitalId: undefined, hospitalName: '세브란스'});
    });

    it('빈 검색어로는 서버를 부르지 않는다', async () => {
        const user = userEvent.setup();

        renderField();
        await user.type(screen.getByRole('combobox'), '   ');

        await waitFor(() => expect(mockSearchHospitals).not.toHaveBeenCalled());
    });

    it('이어하기 초안이 늦게 도착해도 입력칸이 그 값으로 채워진다', async () => {
        // 서버 초안은 첫 렌더 뒤에 온다. 이걸 놓치면 이름이 있는데도 빈 검색창이 남는다.
        const {rerender} = render(<HospitalSearchField fieldClassName="field" hospitalName="" onChange={vi.fn()} />);

        expect(screen.getByRole('combobox')).toHaveValue('');

        rerender(<HospitalSearchField fieldClassName="field" hospitalName="듀팅병원" onChange={vi.fn()} />);

        await waitFor(() => expect(screen.getByRole('combobox')).toHaveValue('듀팅병원'));
    });

    it('카탈로그 없이 이름만 있던 예전 초안도 그대로 이어간다', async () => {
        // 카탈로그 도입 전에 만든 초안은 hospitalId 가 없다. 검색 모드로 열려야 한다.
        render(<HospitalSearchField fieldClassName="field" hospitalName="예전에직접입력한병원" onChange={vi.fn()} />);

        expect(screen.getByRole('combobox')).toHaveValue('예전에직접입력한병원');
    });

    it('이미 고른 병원이 있으면 검색창을 접고 다시 검색할 수 있게 한다', async () => {
        const user = userEvent.setup();

        renderField(vi.fn(), {hospitalId: 7, hospitalName: '세브란스병원'});

        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
        expect(screen.getByText('세브란스병원')).toBeInTheDocument();

        await user.click(screen.getByRole('button', {name: 'page.onboardingWardCreate.identity.hospitalChange'}));

        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });
});
