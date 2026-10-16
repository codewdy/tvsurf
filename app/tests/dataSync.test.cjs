const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Run the real TypeScript modules with an in-memory AsyncStorage and HTTP boundary.
function app(storage = new Map()) {
    const modules = new Map();
    let online = true;
    let status = 200;
    let tvs = [{ id: 1, cover_url: '/cover.jpg', user_data: { tag: 'watching', watch_progress: { episode_id: 1, time: 0 } } }];
    const calls = [];
    const intervals = new Set();
    let onAppState;
    const handlers = {
        '/api/get_tv_infos': () => ({ tvs: structuredClone(tvs) }),
        '/api/get_tv_details': () => ({ tv: { id: 1, track: { tracking: false } }, info: structuredClone(tvs[0]), episodes: ['/video.mp4'] }),
        '/api/get_series': () => ({ series: [] }),
        '/api/add_series': () => ({ id: 42 }),
        '/api/whoami': () => ({ single_user_mode: true, user: null }),
    };
    const asyncStorage = {
        getItem: async key => storage.get(key) ?? null,
        setItem: async (key, value) => { storage.set(key, value); },
        removeItem: async key => { storage.delete(key); },
    };
    function load(file) {
        file = path.resolve(__dirname, '..', file);
        if (!file.endsWith('.ts')) file += '.ts';
        if (modules.has(file)) return modules.get(file).exports;
        const module = { exports: {} };
        modules.set(file, module);
        const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
        }).outputText;
        const context = {
            module, exports: module.exports, console, setTimeout, clearTimeout, AbortController,
            setInterval: callback => { intervals.add(callback); return callback; },
            clearInterval: callback => intervals.delete(callback),
            require: name => {
                if (name === '@react-native-async-storage/async-storage') return asyncStorage;
                if (name === 'react-native') return { AppState: { currentState: 'active', addEventListener: (_, callback) => { onAppState = callback; return { remove() { onAppState = undefined; } }; } } };
                return load(path.resolve(path.dirname(file), name));
            },
            fetch: async (url, options) => {
                const endpoint = new URL(url).pathname;
                calls.push({ endpoint, request: JSON.parse(options.body), token: options.headers.Authorization });
                if (!online) throw new TypeError('Network request failed');
                return { ok: status === 200, status, statusText: String(status), text: async () => 'error',
                    json: async () => (handlers[endpoint]?.() ?? {}) };
            },
        };
        vm.runInNewContext(js, context, { filename: file });
        return module.exports;
    }
    return {
        proxy: load('api/client-proxy'), sync: load('utils/dataSync').dataSync,
        cache: load('utils/offlineDataCache').offlineDataCache, storage, calls,
        tick: () => { for (const callback of intervals) callback(); },
        foreground: () => onAppState?.('active'),
        offline: () => { online = false; }, online: () => { online = true; },
        status: value => { status = value; }, tvs: value => { tvs = value; },
    };
}
async function setup(a) {
    await a.proxy.setApiBaseUrl('http://server');
    await a.proxy.setApiToken('account-a');
}

test('persists fetched data across restarts and restores URL prefixes offline', async () => {
    const a = app(); await setup(a);
    await a.proxy.getTVInfos(); await a.proxy.getTVDetails({ id: 1 }); await a.proxy.whoami();
    const b = app(a.storage); b.offline();
    assert.equal((await b.proxy.getTVInfos()).tvs[0].cover_url, 'http://server/cover.jpg');
    const details = await b.proxy.getTVDetails({ id: 1 });
    assert.equal(details.episodes[0], 'http://server/video.mp4');
    assert.equal(details.info.cover_url, 'http://server/cover.jpg');
    assert.equal((await b.proxy.whoami()).single_user_mode, true);
    assert.equal(b.calls.length, 1, 'backoff avoids repeated failing network calls');
});

test('queues latest progress durably and uploads automatically on retry without clearing cache', async () => {
    const a = app(); await setup(a); await a.proxy.getTVInfos(); a.offline();
    await a.proxy.setWatchProgress({ tv_id: 1, episode_id: 2, time: 10 });
    await a.proxy.setWatchProgress({ tv_id: 1, episode_id: 2, time: 50 });
    assert.equal((await a.cache.getTVInfos(null))[0].user_data.watch_progress.time, 50);
    const b = app(a.storage);
    await b.sync.retry();
    const uploaded = b.calls.filter(c => c.endpoint === '/api/set_watch_progress');
    assert.equal(uploaded.length, 1); assert.equal(uploaded[0].request.time, 50);
    assert.equal((await b.cache.getPendingChangesCount()).total, 0);
    assert.equal((await b.cache.getTVInfos(null)).length, 1);
});

test('serializes simultaneous edits without dropping the newest operation', async () => {
    const a = app(); await setup(a); a.offline();
    await Promise.all([10, 20, 30].map(time => a.proxy.setWatchProgress({ tv_id: 1, episode_id: 1, time })));
    a.online(); await a.sync.retry();
    assert.equal(a.calls.at(-1).request.time, 30);
    assert.equal((await a.cache.getPendingChangesCount()).total, 0);
});

test('reconciles temporary playlist IDs and preserves dependency order after restart', async () => {
    const a = app(); await setup(a); a.offline();
    const { id } = await a.proxy.addSeries({ name: 'later' });
    assert.ok(id < 0);
    await a.proxy.updateSeriesTVs({ id, tvs: [1] });
    const b = app(a.storage); await b.sync.retry();
    assert.equal(b.calls[0].endpoint, '/api/add_series');
    assert.equal(b.calls[1].endpoint, '/api/update_series_tvs');
    assert.equal(b.calls[1].request.id, 42);
    assert.equal((await b.cache.getSeries(null))[0].id, 42);
    await b.proxy.removeSeries({ id });
    assert.equal(b.calls.at(-1).request.id, 42);
});

test('isolates caches and pending uploads across accounts and servers', async () => {
    const a = app(); await setup(a); await a.proxy.getTVInfos(); a.offline();
    await a.proxy.setTVTag({ tv_id: 1, tag: 'watched' });
    await a.proxy.setApiToken('account-b');
    await assert.rejects(a.proxy.getTVInfos());
    assert.equal((await a.cache.getPendingChangesCount()).total, 0);
    a.online(); await a.sync.retry();
    assert.equal(a.calls.filter(c => c.endpoint === '/api/set_tv_tag' && c.token === 'Bearer account-b').length, 0);
    await a.proxy.setApiToken('account-a'); await a.sync.retry();
    assert.equal(a.calls.at(-1).token, 'Bearer account-a');
    await a.proxy.setApiBaseUrl('http://different'); a.offline();
    await assert.rejects(a.proxy.getTVInfos());
});

test('does not mask permission errors or leave rejected edits queued for retry', async () => {
    const a = app(); await setup(a); await a.proxy.getTVInfos(); a.status(401);
    await assert.rejects(a.proxy.getTVInfos(), e => e.status === 401);
    await assert.rejects(a.proxy.setTVTag({ tv_id: 1, tag: 'watched' }), e => e.status === 401);
    assert.equal((await a.cache.getPendingChangesCount()).total, 0);
    assert.equal((await a.cache.getTVInfos(null))[0].user_data.tag, 'watching');
});

test('retries missing reads and distinguishes an empty saved list from no cache', async () => {
    const a = app(); await setup(a); a.offline();
    await assert.rejects(a.proxy.getTVInfos());
    a.online(); a.tvs([]); await a.sync.retry(); a.offline();
    assert.equal((await a.proxy.getTVInfos()).tvs.length, 0);
    const b = app(a.storage); b.offline();
    assert.equal((await b.proxy.getTVInfos()).tvs.length, 0);
});

test('replaces complete snapshots so removed items do not reappear offline', async () => {
    const a = app(); await setup(a); await a.proxy.getTVInfos();
    a.tvs([]); await a.proxy.getTVInfos(); a.offline();
    assert.equal((await a.proxy.getTVInfos()).tvs.length, 0);
});


test('startup, foreground, and periodic checks upload deferred writes', async () => {
    const a = app(); await setup(a); a.offline();
    await a.proxy.setWatchProgress({ tv_id: 1, episode_id: 1, time: 1 });
    a.online();
    const stop = a.sync.start();
    await a.sync.configure(async () => {}); // Wait for the startup job to finish.
    assert.equal((await a.cache.getPendingChangesCount()).total, 0);
    for (const trigger of [a.tick, a.foreground]) {
        a.offline(); await a.proxy.setWatchProgress({ tv_id: 1, episode_id: 1, time: 2 });
        a.online(); trigger(); await a.sync.configure(async () => {});
        assert.equal((await a.cache.getPendingChangesCount()).total, 0);
    }
    stop();
});

test('server failures use cache, and missing details still report unavailable data', async () => {
    const a = app(); await setup(a); await a.proxy.getTVInfos(); a.status(503);
    assert.equal((await a.proxy.getTVInfos()).tvs.length, 1);
    await assert.rejects(a.proxy.getTVDetails({ id: 99 }), e => e.unavailable === true);
    await a.proxy.setTVTracking({ tv_id: 1, tracking: true });
    assert.equal((await a.cache.getPendingChangesCount()).total, 1);
    a.status(200); await a.sync.retry();
    assert.equal((await a.cache.getPendingChangesCount()).total, 0);
});

test('online-only reads report failures even after a successful fetch and during sync backoff', async () => {
    const a = app(); await setup(a);
    const reads = [
        () => a.proxy.searchTV({ keyword: 'test' }),
        () => a.proxy.getDownloadProgress(),
        () => a.proxy.getMonitor(),
        () => a.proxy.getErrors(),
        () => a.proxy.getConfig(),
        () => a.proxy.getUsers(),
    ];
    for (const read of reads) await read();
    await a.proxy.getTVInfos();
    a.offline();
    await a.proxy.getTVInfos(); // Enter the automatic sync backoff with cached TV data.
    for (const read of reads) {
        const count = a.calls.length;
        await assert.rejects(read(), e => e.unavailable === true);
        assert.equal(a.calls.length, count + 1, 'must contact the API despite sync backoff');
    }
    a.online(); a.status(503);
    for (const read of reads) {
        await assert.rejects(read(), e => e.status === 503);
    }
    assert.equal((await a.cache.getPendingChangesCount()).total, 0);
    a.status(200);
    const count = a.calls.length;
    await a.sync.retry();
    assert.equal(a.calls.length, count + 1, 'only the cached TV request should be retried');
    assert.equal(a.calls.at(-1).endpoint, '/api/get_tv_infos');
});
