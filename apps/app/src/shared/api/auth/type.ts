import type {TAccountResponse} from '../account/type';
import type {TWardResponse} from '../ward/type';

export type TDemoStartResponse = {
    wardResDto: TWardResponse;
    accountResDto: TAccountResponse;
    accessToken: string;
};

export interface IAuthAPI {
    // POST
    demoStart: () => Promise<TDemoStartResponse>;
    logout: (accessToken: string | null) => Promise<void>;
}
