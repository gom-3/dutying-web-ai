import {container, type InjectionToken} from 'tsyringe';

export function useInjection<T>(token: InjectionToken<T>): T {
    return container.resolve(token);
}
