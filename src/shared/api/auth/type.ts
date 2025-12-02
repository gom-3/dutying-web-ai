import {type Account} from '@/shared/types/account';
import {type Ward} from '@/shared/types/ward';

export interface IAuthAPI {
    // GET
    getAccountMe: () => Promise<Account>;
    // POST
    demoStart: () => Promise<{wardResDto: Ward; accountResDto: Account; accessToken: string}>;
    logout: (accessToken: string | null) => Promise<void>;
}
