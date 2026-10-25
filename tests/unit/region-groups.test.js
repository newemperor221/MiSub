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

    it('should use a leading exit flag instead of a relay annotation', () => {
        const groups = groupNodeLinesByRegion([
            {
                name: '🇸🇬 新加坡 - 野草云香港中转',
                tag: '🇸🇬 新加坡 - 野草云香港中转',
                metadata: { region: '香港' },
            },
            {
                name: '🇳🇬 尼日利亚 - 野草云香港中转',
                tag: '🇳🇬 尼日利亚 - 野草云香港中转',
                metadata: { region: '香港' },
            },
        ]);

        expect(groups.find((group) => group.name === '🇸🇬 狮城节点')?.tags).toHaveLength(1);
        expect(groups.find((group) => group.name === '🇳🇬 尼日利亚节点')?.tags).toHaveLength(1);
        expect(groups.find((group) => group.name === '🇭🇰 香港节点')).toBeUndefined();
    });

    it('should let every configured leading flag outrank conflicting metadata', () => {
        const cases = [
            ['🇭🇰', '🇭🇰 香港节点'],
            ['🇹🇼', '🇹🇼 台湾节点'],
            ['🇯🇵', '🇯🇵 日本节点'],
            ['🇸🇬', '🇸🇬 狮城节点'],
            ['🇺🇸', '🇺🇸 美国节点'],
            ['🇰🇷', '🇰🇷 韩国节点'],
            ['🇬🇧', '🇬🇧 英国节点'],
            ['🇩🇪', '🇩🇪 德国节点'],
            ['🇫🇷', '🇫🇷 法国节点'],
            ['🇨🇦', '🇨🇦 加拿大节点'],
            ['🇦🇺', '🇦🇺 澳洲节点'],
            ['🇧🇷', '🇧🇷 巴西节点'],
            ['🇪🇸', '🇪🇸 西班牙节点'],
            ['🇳🇱', '🇳🇱 荷兰节点'],
            ['🇷🇺', '🇷🇺 俄国节点'],
            ['🇮🇳', '🇮🇳 印度节点'],
            ['🇹🇷', '🇹🇷 土耳其节点'],
            ['🇳🇬', '🇳🇬 尼日利亚节点'],
        ];

        for (const [flag, expectedGroup] of cases) {
            const tag = `${flag} 出口 - 香港中转`;
            const groups = groupNodeLinesByRegion([
                { name: tag, tag, metadata: { region: '香港' } },
            ]);
            expect(groups.map((group) => group.name)).toEqual([expectedGroup]);
        }
    });
});
