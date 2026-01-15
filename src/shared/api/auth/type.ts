import {type Account} from '@/entities/account';
import {type Ward} from '@/entities/ward';

export interface IAuthAPI {
    // POST
    demoStart: () => Promise<{wardResDto: Ward; accountResDto: Account; accessToken: string}>;
    logout: (accessToken: string | null) => Promise<void>;
}
