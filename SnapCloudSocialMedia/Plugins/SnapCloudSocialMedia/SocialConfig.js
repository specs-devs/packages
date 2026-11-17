export const PROVIDERS = [
    { id: 'snapchat', name: 'Snapchat', formats: ['story', 'spotlight'] },
    { id: 'x', name: 'X', formats: ['video', 'photo'] },
    { id: 'youtube', name: 'YouTube', formats: ['video', 'short'] },
    { id: 'linkedin', name: 'LinkedIn', formats: ['video', 'photo'] },
    { id: 'instagram', name: 'Instagram', formats: ['reel', 'story', 'photo'] },
    { id: 'threads', name: 'Threads', formats: ['video', 'photo'] },
    { id: 'tiktok', name: 'TikTok', formats: ['video'] }
];
export function parseConfig(text) {
    const config = JSON.parse(text);
    if (config.schemaVersion !== 1 || typeof config.demoMode !== 'boolean')
        throw new Error('Unsupported social config schema');
    // Public Lens assets must never contain private provider credentials.
    const inspect = (value) => {
        if (!value || typeof value !== 'object')
            return;
        for (const [key, item] of Object.entries(value)) {
            if (/secret|access.?token|refresh.?token|service.?role|password|api.?key/i.test(key))
                throw new Error('Keep private credentials in proxy.config.json on the server');
            inspect(item);
        }
    };
    inspect(config);
    if (!config.cloud || !config.capture || !config.composer || !config.destinations)
        throw new Error('Incomplete configuration');
    if (!config.demoMode && (!/^https:\/\//.test(config.proxyUrl) || !/^https:\/\//.test(config.cloud.url) || !config.cloud.publishableKey))
        throw new Error('Configure HTTPS proxy, Snap Cloud URL and publishable key');
    if (!['portrait', 'landscape', 'square'].includes(config.capture.aspect) || !Number.isFinite(config.capture.fps) || config.capture.fps < 1 || config.capture.fps > 12 || !Number.isFinite(config.capture.maxSeconds) || config.capture.maxSeconds < 1 || config.capture.maxSeconds > 15)
        throw new Error('Capture limits: 1–12 FPS and 1–15 seconds');
    if (config.capture.includeAudio !== undefined && typeof config.capture.includeAudio !== 'boolean')
        throw new Error('Include microphone must be a boolean');
    if (typeof config.composer.caption !== 'string' || typeof config.composer.title !== 'string')
        throw new Error('Composer caption and title must be strings');
    for (const p of PROVIDERS) {
        const d = config.destinations[p.id];
        if (!d || typeof d.enabled !== 'boolean' || !p.formats.includes(d.format) || typeof d.caption !== 'string')
            throw new Error('Invalid destination: ' + p.name);
    }
    return config;
}
