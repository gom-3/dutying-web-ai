import {type Account} from '@/shared/types/account';
import {type TWard} from '@/shared/types/ward';

export interface IAuthAPI {
    // POST
    demoStart: () => Promise<{wardResDto: TWard; accountResDto: Account; accessToken: string}>;
    logout: (accessToken: string | null) => Promise<void>;
}
