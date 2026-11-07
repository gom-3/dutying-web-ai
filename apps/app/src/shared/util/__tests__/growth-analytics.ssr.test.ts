// @vitest-environment node
import {expect, it} from 'vitest';
import {trackProductOutcome} from '../growth-analytics';

it('loads shared outcome tracking during landing server rendering without a browser SDK', () => {
    expect(typeof window).toBe('undefined');
    expect(() => trackProductOutcome('sign_up', 'password')).not.toThrow();
});
