import {ANDROID_PLAY_STORE_URL, IOS_APP_STORE_URL} from './invite';
import {siteConfig} from './site';

export const createHomeStructuredData = (description: string) => ({
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'Organization',
            '@id': `${siteConfig.marketingOrigin}/#organization`,
            name: siteConfig.productName,
            url: `${siteConfig.marketingOrigin}/`,
            logo: new URL('/logo-wordmark-purple.png', `${siteConfig.marketingOrigin}/`).toString(),
        },
        {
            '@type': 'WebSite',
            '@id': `${siteConfig.marketingOrigin}/#website`,
            name: siteConfig.productName,
            url: `${siteConfig.marketingOrigin}/`,
            inLanguage: 'ko-KR',
            publisher: {'@id': `${siteConfig.marketingOrigin}/#organization`},
        },
        {
            '@type': 'SoftwareApplication',
            '@id': `${siteConfig.marketingOrigin}/#software-application`,
            name: siteConfig.productName,
            description,
            url: siteConfig.appLinks.home,
            applicationCategory: 'BusinessApplication',
            applicationSubCategory: 'WorkforceManagementApplication',
            operatingSystem: 'Web, iOS, Android',
            inLanguage: 'ko-KR',
            sameAs: [IOS_APP_STORE_URL, ANDROID_PLAY_STORE_URL],
            publisher: {'@id': `${siteConfig.marketingOrigin}/#organization`},
        },
    ],
});
