import type {IApiClient} from '../client';
import type {IHospitalAPI, THospitalResponse, TSearchHospitalsParams} from './contracts';

const BASE_PATH = '/hospitals';

export const createHospitalApi = (client: IApiClient): IHospitalAPI => ({
    searchHospitals: async ({keyword, size}: TSearchHospitalsParams) => {
        const trimmedKeyword = keyword.trim();

        // 빈 검색어로 서버를 부를 이유가 없다. 타이핑 중 공백만 남는 순간이 잦다.
        if (trimmedKeyword.length === 0) return [];

        const params = new URLSearchParams();

        // 한글 검색어를 인코딩하지 않으면 Tomcat 이 Spring 에 닿기 전에 400 으로 끊는다.
        params.set('keyword', trimmedKeyword);
        if (typeof size === 'number') params.set('size', String(size));

        const {data} = await client.get<THospitalResponse[]>(`${BASE_PATH}?${params.toString()}`);

        return data;
    },
});
