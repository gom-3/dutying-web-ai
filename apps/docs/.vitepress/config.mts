import {defineConfig} from 'vitepress';
import {docsSiteLinks} from './site.mts';

const webGuideSidebar = [
    {
        text: '개요',
        items: [{text: '웹 사용자 가이드', link: '/web-guide/'}],
    },
    {
        text: '계정 시작',
        items: [
            {text: '로그인', link: '/web-guide/login'},
            {text: '회원가입', link: '/web-guide/register'},
        ],
    },
    {
        text: '병동 시작',
        items: [{text: '병동 생성/입장', link: '/web-guide/wards'}],
    },
    {
        text: '근무표 운영',
        items: [
            {text: '근무표 만들기', link: '/web-guide/schedule'},
            {text: '신청근무 관리', link: '/web-guide/requests'},
            {text: '간호사 관리', link: '/web-guide/nurses'},
        ],
    },
];

export default defineConfig({
    lang: 'ko-KR',
    title: 'Dutying Docs',
    description: '듀팅 웹과 모바일 사용자 가이드를 함께 담기 위한 통합 문서 사이트',
    cleanUrls: true,
    lastUpdated: true,
    srcExclude: ['README.md'],
    themeConfig: {
        logo: '/logo.svg',
        siteTitle: 'Dutying Docs',
        nav: [
            {text: '시작하기', link: '/getting-started/'},
            {text: '웹 사용자 가이드', link: '/web-guide/'},
            {text: '모바일 가이드', link: '/mobile-guide/'},
            {text: 'FAQ', link: '/troubleshooting/faq'},
            {text: '앱 열기', link: docsSiteLinks.app},
            {text: '랜딩 보기', link: docsSiteLinks.marketing},
        ],
        sidebar: {
            '/getting-started/': [
                {
                    text: '시작하기',
                    items: [{text: '문서 사이트 개요', link: '/getting-started/'}],
                },
            ],
            '/web-guide/': webGuideSidebar,
            '/mobile-guide/': [
                {
                    text: '모바일 가이드',
                    items: [{text: '준비 중인 구조', link: '/mobile-guide/'}],
                },
            ],
            '/troubleshooting/': [
                {
                    text: '문제 해결',
                    items: [{text: 'FAQ', link: '/troubleshooting/faq'}],
                },
            ],
        },
        search: {
            provider: 'local',
        },
        socialLinks: [{icon: 'github', link: 'https://github.com/gom-3/dutying-web'}],
        outline: {
            label: '이 페이지에서',
        },
        docFooter: {
            prev: '이전 문서',
            next: '다음 문서',
        },
        footer: {
            message: 'Dutying 사용자 가이드 초안',
            copyright: 'Copyright © Dutying',
        },
    },
});
