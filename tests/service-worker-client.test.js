const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(
  path.resolve(__dirname, '..', 'service-worker-client.js'),
  'utf8'
);

async function loadClient({waiting = null, controller = null} = {}){
  const serviceWorkerListeners = {};
  const registrationListeners = {};
  const buttonListeners = {};
  const notice = {hidden:true};
  const reloadButton = {
    disabled:false,
    textContent:'Nach Kampfende neu laden',
    addEventListener: (type, listener) => { buttonListeners[type] = listener; }
  };
  let reloadCalls = 0;
  let loadListener;
  const registration = {
    waiting,
    installing:null,
    addEventListener: (type, listener) => { registrationListeners[type] = listener; }
  };
  const context = {
    navigator: {
      serviceWorker: {
        controller,
        register: () => Promise.resolve(registration),
        addEventListener: (type, listener) => { serviceWorkerListeners[type] = listener; }
      }
    },
    window: {
      addEventListener: (type, listener) => { loadListener = listener; },
      location: {reload:() => { reloadCalls++; }}
    },
    document: {
      getElementById: id => id === 'updateNotice' ? notice : reloadButton
    },
    console: {error() {}}
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  loadListener();
  await new Promise(resolve => setImmediate(resolve));

  return {
    notice,
    reloadButton,
    registration,
    registrationListeners,
    serviceWorkerListeners,
    clickReload: () => buttonListeners.click(),
    get reloadCalls(){ return reloadCalls; }
  };
}

test('shows a waiting update and reloads only after the user requests it', async () => {
  const client = await loadClient({waiting:{}, controller:{}});

  assert.equal(client.notice.hidden, false);
  assert.equal(client.reloadCalls, 0);

  client.clickReload();
  assert.equal(client.reloadCalls, 1);

  client.serviceWorkerListeners.controllerchange();
  assert.equal(client.reloadCalls, 1);
});

test('an update activated in another tab offers a manual reload without reloading automatically', async () => {
  const client = await loadClient({controller:{}});

  client.serviceWorkerListeners.controllerchange();
  assert.equal(client.notice.hidden, false);
  assert.equal(client.reloadCalls, 0);

  client.clickReload();
  assert.equal(client.reloadCalls, 1);
});

test('does not show an update notice for the first service worker installation', async () => {
  const client = await loadClient();

  client.serviceWorkerListeners.controllerchange();
  assert.equal(client.notice.hidden, true);
  assert.equal(client.reloadCalls, 0);
});
