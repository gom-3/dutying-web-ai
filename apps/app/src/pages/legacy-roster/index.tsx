import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {legacyRosterCopy} from '@/features/legacy-roster/copy';
import {LegacyRosterImport} from '@/features/legacy-roster/LegacyRosterImport';
import {loadPersonalRosterSession, personalRosterLoginUrl, type TPersonalRosterSession} from '@/features/legacy-roster/session';

export default function LegacyRosterPage() {
    const {i18n} = useTranslation();
    const c = legacyRosterCopy(i18n.resolvedLanguage ?? i18n.language ?? 'ko');
    const [session, setSession] = useState<TPersonalRosterSession>();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        void loadPersonalRosterSession()
            .then((data) => {
                if (active) setSession(data);
            })
            .catch(() => {})
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    const ko = (i18n.resolvedLanguage ?? 'ko').startsWith('ko');
    const ja = i18n.resolvedLanguage?.startsWith('ja');

    return (
        <main className="mx-auto max-w-xl space-y-5 p-6">
            <h1 className="text-xl font-semibold">{c.title}</h1>
            <p className="text-sm text-sub-2">
                {ko
                    ? '기존 앱에서 사용한 개인 소셜 계정으로 로그인해 주세요. 병동 관리자 로그인과는 별도예요.'
                    : ja
                      ? '以前のアプリの個人ソーシャルアカウントでログインしてください。病棟管理者ログインとは別です。'
                      : 'Sign in with the personal social account used in the original app. This is separate from ward administrator sign-in.'}
            </p>
            {loading ? (
                <p role="status">{c.busy}</p>
            ) : session ? (
                <LegacyRosterImport
                    key={session.account.accountId}
                    accountId={session.account.accountId}
                    linked={session.account.status === 'LINKED'}
                    api={session.api}
                />
            ) : (
                <p role="status">{c.signIn}</p>
            )}
            <nav aria-label={c.signIn} className="flex flex-wrap gap-3">
                <a className="flex min-h-11 items-center rounded-xl border border-gray-6 px-4" href={personalRosterLoginUrl('kakao')}>
                    {ko ? '카카오 개인 계정으로 로그인' : ja ? 'Kakao個人アカウントでログイン' : 'Sign in with personal Kakao'}
                </a>
                <a className="flex min-h-11 items-center rounded-xl border border-gray-6 px-4" href={personalRosterLoginUrl('apple')}>
                    {ko ? 'Apple 개인 계정으로 로그인' : ja ? 'Apple個人アカウントでログイン' : 'Sign in with personal Apple'}
                </a>
            </nav>
        </main>
    );
}
