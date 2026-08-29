import {describe, expect, it} from 'vitest';
import {createHomeStructuredData} from '../structured-data';

describe('createHomeStructuredData', () => {
    it('describes the homepage, company, and product app as one linked graph', () => {
        const structuredData = createHomeStructuredData('간호사 근무표 서비스');
        const graph = structuredData['@graph'];

        expect(graph.map((entry) => entry['@type'])).toEqual(['Organization', 'WebSite', 'SoftwareApplication']);
        expect(graph[1]).toMatchObject({
            url: 'https://www.dutying.ai/',
            publisher: {'@id': 'https://www.dutying.ai/#organization'},
        });
        expect(graph[2]).toMatchObject({
            url: 'https://app.dutying.ai',
            description: '간호사 근무표 서비스',
            operatingSystem: 'Web, iOS, Android',
            publisher: {'@id': 'https://www.dutying.ai/#organization'},
        });
    });
});
