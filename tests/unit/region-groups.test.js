import { describe, expect, it } from 'vitest';
import { groupNodeLinesByRegion } from '../../functions/modules/subscription/region-groups.js';

describe('region group overrides', () => {
    it('should allow user-defined regex rules to override the built-in region guess', () => {
        const groups = groupNodeLinesByRegion(
            [
                { name: '机场A 新加坡 原生', tag: '机场A 新加坡 原生' },
                { name: '机场A US-West', tag: '机场A US-West' },
            ],
            {
                regionOverrides: [{ pattern: '新加坡 原生', region: '美国' }],
            }
        );

        const usGroup = groups.find((group) => group.name === '🇺🇸 美国节点');
        const sgGroup = groups.find((group) => group.name === '🇸🇬 狮城节点');

        expect(usGroup?.tags).toContain('机场A 新加坡 原生');
        expect(usGroup?.tags).toContain('机场A US-West');
        expect(sgGroup).toBeUndefined();
    });

    it('should keep Nigeria out of the Japan group despite the shared Chinese character', () => {
        const groups = groupNodeLinesByRegion([
            { name: '🌍 尼日利亚', tag: '🌍 尼日利亚' },
            { name: '🇯🇵 大阪', tag: '🇯🇵 大阪' },
        ]);

        const nigeriaGroup = groups.find((group) => group.name === '🇳🇬 尼日利亚节点');
        const japanGroup = groups.find((group) => group.name === '🇯🇵 日本节点');

        expect(nigeriaGroup?.tags).toEqual(['🌍 尼日利亚']);
        expect(japanGroup?.tags).toEqual(['🇯🇵 大阪']);
        expect(japanGroup?.tags).not.toContain('🌍 尼日利亚');
    });
});
