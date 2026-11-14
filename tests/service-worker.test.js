const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.resolve(__dirname, '..', 'sw.js'), 'utf8');

function loadServiceWorker({match = async () => null, fetchRequest = async () => { throw new Error('offline'); }} = {}){
  const listeners = {};
  let skipWaitingCalls = 0;
  const self = {
    location: {origin:'https://turnier.test'},
    addEventListener: (type, listener) => { listeners[type] = listener; },
    skipWaiting: () => { skipWaitingCalls++; },
    clients: {claim() {}}
  };
  const context = {
    self,
    caches: {
      match,
      open: async () => ({addAll:async () => {}})
    },
    fetch: fetchRequest,
    URL,
    Response
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return {context, listeners, self, get skipWaitingCalls(){ return skipWaitingCalls; }};
}

test('pre-caches every required app asset', () => {
  const {context} = loadServiceWorker();
  const assets = vm.runInContext('ASSETS_TO_CACHE', context);

  for(const asset of [
    './index.html', './live.html', './manifest.json', './ui.js', './live.js', './matches.js',
    './ranking.js', './print.js', './backup.js', './service-worker-client.js',
    './icon-192.png', './icon-512.png'
  ]){
    assert.ok(assets.includes(asset), `${asset} should be cached for offline use`);
  }
});

test('activates the new worker without requiring or triggering a page reload', async () => {
  const worker = loadServiceWorker();
  let installPromise;
  worker.listeners.install({waitUntil:promise => { installPromise = promise; }});
  await installPromise;
  assert.equal(worker.skipWaitingCalls, 1);
});

test('serves the cached app page for offline navigation', async () => {
  const cachedPage = {fromCache:true};
  const {listeners} = loadServiceWorker({
    match: async request => request === './index.html' ? cachedPage : null
  });
  let responsePromise;

  listeners.fetch({
    request: {method:'GET', url:'https://turnier.test/tournament/', mode:'navigate'},
    respondWith: promise => { responsePromise = promise; }
  });

  assert.equal(await responsePromise, cachedPage);
});

test('serves a cached live view for offline navigation with a view query', async () => {
  const cachedPage = {fromCache:true};
  const {listeners} = loadServiceWorker({
    match: async request => request === 'https://turnier.test/live.html' ? cachedPage : null
  });
  let responsePromise;

  listeners.fetch({
    request: {method:'GET', url:'https://turnier.test/live.html?view=matches', mode:'navigate'},
    respondWith: promise => { responsePromise = promise; }
  });

  assert.equal(await responsePromise, cachedPage);
});

test('returns an explicit 503 for other uncached offline resources', async () => {
  const {listeners} = loadServiceWorker();
  let responsePromise;

  listeners.fetch({
    request: {method:'GET', url:'https://turnier.test/missing.js', mode:'cors'},
    respondWith: promise => { responsePromise = promise; }
  });

  const response = await responsePromise;
  assert.equal(response.status, 503);
  assert.match(await response.text(), /offline/i);
});

test('does not intercept non-GET or cross-origin requests', () => {
  const {listeners} = loadServiceWorker();

  for(const request of [
    {method:'POST', url:'https://turnier.test/save', mode:'cors'},
    {method:'GET', url:'https://cdn.test/library.js', mode:'cors'}
  ]){
    let intercepted = false;
    listeners.fetch({
      request,
      respondWith: () => { intercepted = true; }
    });
    assert.equal(intercepted, false);
  }
});
