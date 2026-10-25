import { describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import { generateBuiltinClashConfig } from '../../functions/modules/subscription/builtin-clash-generator.js';
import { generateBuiltinLoonConfig } from '../../functions/modules/subscription/builtin-loon-generator.js';
import { generateBuiltinSurgeConfig } from '../../functions/modules/subscription/builtin-surge-generator.js';
import { generateBuiltinQuanxConfig } from '../../functions/modules/subscription/builtin-quanx-generator.js';
import { generateBuiltinSingboxConfig } from '../../functions/modules/subscription/builtin-singbox-generator.js';

const nodes = [
    'trojan://password@sg.example.com:443#🇸🇬 新加坡',
    'trojan://password@paypal.example.com:443#💳 PayPal',
    'trojan://password@us.example.com:443#🇺🇸 洛杉矶',
].join('\n');
const options = { ruleLevel: 'full', addFlagEmoji: false };

function section(text, name, nextName) {
    const start = text.indexOf(`[${name}]`);
    const end = nextName ? text.indexOf(`[${nextName}]`, start + 1) : text.length;
    return text.slice(start, end < 0 ? text.length : end);
}

function assertCollisionNames(proxyNames, groupNames) {
    expect(proxyNames).toContain('🇸🇬 新加坡 线路');
    expect(proxyNames).toContain('💳 PayPal 线路');
    expect(groupNames).toContain('🇸🇬 新加坡');
    expect(groupNames).toContain('💳 PayPal');
    expect(proxyNames.filter((name) => groupNames.includes(name))).toEqual([]);
}

describe('FULL policy namespace collision handling', () => {
    it('keeps Clash proxy and group namespaces disjoint', () => {
        const config = yaml.load(generateBuiltinClashConfig(nodes, options));
        assertCollisionNames(
            config.proxies.map((proxy) => proxy.name),
            config['proxy-groups'].map((group) => group.name)
        );
    });

    it('keeps sing-box outbound and selector namespaces disjoint', () => {
        const config = JSON.parse(generateBuiltinSingboxConfig(nodes, options));
        const selectors = config.outbounds.filter((item) => item.type === 'selector' || item.type === 'urltest');
        const selectorNames = selectors.map((item) => item.tag);
        const proxyNames = config.outbounds
            .filter((item) => !['selector', 'urltest', 'direct', 'block'].includes(item.type))
            .map((item) => item.tag);
        assertCollisionNames(proxyNames, selectorNames);
    });

    it('serializes renamed Loon proxies before policy groups', () => {
        const text = generateBuiltinLoonConfig(nodes, options);
        const proxyNames = section(text, 'Proxy', 'Proxy Group')
            .split('\n')
            .filter((line) => line.includes(' = ') && !line.startsWith('DIRECT ='))
            .map((line) => line.split(' = ', 1)[0]);
        const groupNames = section(text, 'Proxy Group', 'Rule')
            .split('\n')
            .filter((line) => line.includes(' = '))
            .map((line) => line.split(' = ', 1)[0]);
        assertCollisionNames(proxyNames, groupNames);
    });

    it('serializes renamed Surge proxies before policy groups', () => {
        const text = generateBuiltinSurgeConfig(nodes, options);
        const proxyNames = section(text, 'Proxy', 'Proxy Group')
            .split('\n')
            .filter((line) => line.includes(' = ') && !line.startsWith('DIRECT ='))
            .map((line) => line.split(' = ', 1)[0]);
        const groupNames = section(text, 'Proxy Group', 'Rule')
            .split('\n')
            .filter((line) => line.includes(' = '))
            .map((line) => line.split(' = ', 1)[0]);
        assertCollisionNames(proxyNames, groupNames);
    });

    it('serializes renamed Quantumult X proxies before policies', () => {
        const text = generateBuiltinQuanxConfig(nodes, options);
        const proxyNames = section(text, 'server_local', 'policy')
            .split('\n')
            .filter((line) => line.includes('tag='))
            .map((line) => decodeURIComponent(line.match(/tag=([^,]+)/)?.[1] || '').trim());
        const groupNames = section(text, 'policy', 'filter_remote')
            .split('\n')
            .filter((line) => line.includes('='))
            .map((line) => line.split('=', 2)[1]?.split(',', 1)[0]?.trim())
            .filter(Boolean);
        assertCollisionNames(proxyNames, groupNames);
    });

    it('stabilizes names when exact region overrides stop matching after a rename', () => {
        const overrideNodes = [
            'trojan://password@paypal.example.com:443#💳 PayPal',
            'trojan://password@other.example.com:443#🌍 其他',
        ].join('\n');
        const overrideOptions = {
            ruleLevel: 'full',
            addFlagEmoji: false,
            regionOverrides: [
                { pattern: '^💳 PayPal$', region: '欧洲' },
                { pattern: '^🌍 其他$', region: '亚洲' },
            ],
        };

        const clash = yaml.load(generateBuiltinClashConfig(overrideNodes, overrideOptions));
        expect(
            clash.proxies
                .map((proxy) => proxy.name)
                .filter((name) => clash['proxy-groups'].some((group) => group.name === name))
        ).toEqual([]);

        const singbox = JSON.parse(generateBuiltinSingboxConfig(overrideNodes, overrideOptions));
        const singboxGroups = singbox.outbounds
            .filter((item) => item.type === 'selector' || item.type === 'urltest')
            .map((item) => item.tag);
        const singboxProxies = singbox.outbounds
            .filter((item) => !['selector', 'urltest', 'direct', 'block'].includes(item.type))
            .map((item) => item.tag);
        expect(singboxProxies.filter((name) => singboxGroups.includes(name))).toEqual([]);

        for (const text of [
            generateBuiltinLoonConfig(overrideNodes, overrideOptions),
            generateBuiltinSurgeConfig(overrideNodes, overrideOptions),
        ]) {
            const proxyNames = section(text, 'Proxy', 'Proxy Group')
                .split('\n')
                .filter((line) => line.includes(' = ') && !line.startsWith('DIRECT ='))
                .map((line) => line.split(' = ', 1)[0]);
            const groupNames = section(text, 'Proxy Group', 'Rule')
                .split('\n')
                .filter((line) => line.includes(' = '))
                .map((line) => line.split(' = ', 1)[0]);
            expect(proxyNames.filter((name) => groupNames.includes(name))).toEqual([]);
        }

        const quanx = generateBuiltinQuanxConfig(overrideNodes, overrideOptions);
        const quanxProxies = section(quanx, 'server_local', 'policy')
            .split('\n')
            .filter((line) => line.includes('tag='))
            .map((line) => decodeURIComponent(line.match(/tag=([^,]+)/)?.[1] || '').trim());
        const quanxGroups = section(quanx, 'policy', 'filter_remote')
            .split('\n')
            .filter((line) => line.includes('='))
            .map((line) => line.split('=', 2)[1]?.split(',', 1)[0]?.trim())
            .filter(Boolean);
        expect(quanxProxies.filter((name) => quanxGroups.includes(name))).toEqual([]);
    });
});
