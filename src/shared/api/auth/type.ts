import {type TAccount} from '@/entities/account';
import {type TWard} from '@/entities/ward';

export interface IAuthAPI {
    // POST
    demoStart: () => Promise<{wardResDto: TWard; accountResDto: TAccount; accessToken: string}>;
    logout: (accessToken: string | null) => Promise<void>;
}
