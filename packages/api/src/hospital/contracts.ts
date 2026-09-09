export type THospitalResponse = {
    hospitalId: number;
    name: string;
    /** 종별명 (상급종합, 종합병원, 병원, 요양병원 등). */
    categoryName?: string | null;
    /** 시도 + 시군구. 같은 이름의 다른 병원을 구분하는 데 쓴다. */
    region?: string | null;
};

export type TSearchHospitalsParams = {
    keyword: string;
    /** 1~50. 서버 기본값은 20. */
    size?: number;
};

export interface IHospitalAPI {
    /** 검색어가 비면 서버가 빈 목록을 준다. 호출 전에 걸러도 되고 그대로 보내도 된다. */
    searchHospitals: (params: TSearchHospitalsParams) => Promise<THospitalResponse[]>;
}
