// background service worker for Rest & Lock
// responsibilities:
// - schedule next break using chrome.alarms
// - on break: record current tabs' URLs, set lock flag, redirect tabs to locked page
// - on unlock: restore saved URLs (best-effort) and schedule next break

const DEFAULTS = {
  breakIntervalMin: 50, // 每轮工作时长（分钟）
  breakDurationMin: 10, // 休息时长（分钟）
  enabled: true
};

async function getStorage(keys) {
  return new Promise((res) => chrome.storage.local.get(keys, res));
}

async function setStorage(obj) {
  return new Promise((res) => chrome.storage.local.set(obj, res));
}

// compute and schedule next break alarm
async function scheduleNextBreak() {
  const s = await getStorage(Object.keys(DEFAULTS).concat(['nextBreak']));
  const cfg = { ...DEFAULTS, ...s };
  if (!cfg.enabled) return;

  const now = Date.now();
  // if nextBreak exists and is in the future, keep it; otherwise schedule from now
  let next = cfg.nextBreak;
  if (!next || next <= now) {
    next = now + cfg.breakIntervalMin * 60 * 1000;
  }

  await setStorage({ nextBreak: next });
  chrome.alarms.create('break', { when: next });
  console.log('[background] scheduled next break at', new Date(next).toString());
}

async function startLock() {
  const s = await getStorage(Object.keys(DEFAULTS));
  const cfg = { ...DEFAULTS, ...s };
  const now = Date.now();
  const end = now + cfg.breakDurationMin * 60 * 1000;

  // save lock state
  await setStorage({ lockActive: true, lockEnd: end });

  // collect current tab urls to restore later
  const tabs = await new Promise((res) => chrome.tabs.query({}, res));
  const map = {};
  for (const t of tabs) {
    // skip chrome-extension:// or extension pages
    if (!t.id) continue;
    if (t.url && t.url.startsWith(chrome.runtime.getURL('locked.html'))) continue;
    map[t.id] = t.url || '';
  }
  await setStorage({ lockedTabs: map });

  // redirect all tabs to locked page
  lockAllTabs();

  // schedule unlock
  chrome.alarms.create('unlock', { when: end });
  console.log('[background] lock started until', new Date(end).toString());
}

async function lockAllTabs() {
  const url = chrome.runtime.getURL('locked.html');
  const tabs = await new Promise((res) => chrome.tabs.query({}, res));
  for (const t of tabs) {
    try {
      // only update non-extension pages (best-effort)
      await new Promise((res) => chrome.tabs.update(t.id, { url }, res));
    } catch (e) {
      console.warn('[background] failed to update tab', t.id, e);
    }
  }
}

async function unlock() {
  const s = await getStorage(['lockedTabs']);
  const map = s.lockedTabs || {};

  // try to restore each saved tab by id
  for (const [tabIdStr, url] of Object.entries(map)) {
    const tabId = Number(tabIdStr);
    try {
      const tab = await new Promise((res) => chrome.tabs.get(tabId, res));
      if (tab && tab.id) {
        // only restore if the tab currently points to locked page
        if (tab.url && tab.url.startsWith(chrome.runtime.getURL('locked.html')) && url) {
          await new Promise((res) => chrome.tabs.update(tab.id, { url }, res));
        }
      }
    } catch (e) {
      // tab may have been closed; ignore
    }
  }

  await setStorage({ lockActive: false, lockEnd: 0, lockedTabs: {} });
  // schedule next round
  scheduleNextBreak();
  console.log('[background] unlocked and scheduled next round');
}

// listen alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'break') {
    startLock();
  } else if (alarm.name === 'unlock') {
    unlock();
  }
});

// if service worker restarts, ensure schedule exists
chrome.runtime.onStartup.addListener(() => {
  scheduleNextBreak();
});

chrome.runtime.onInstalled.addListener(async (details) => {
  const s = await getStorage(Object.keys(DEFAULTS));
  const needInit = Object.keys(s).length === 0;
  if (needInit) {
    await setStorage(DEFAULTS);
  }
  scheduleNextBreak();
});

// on message from popup/options to change settings
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || !msg.action) return;
  if (msg.action === 'reschedule') {
    // clear old break alarm and reschedule from now with new settings
    chrome.alarms.clear('break', () => {
      setStorage({ nextBreak: 0 }).then(scheduleNextBreak);
      sendResponse({ ok: true });
    });
    return true;
  } else if (msg.action === 'start') {
    setStorage({ enabled: true }).then(scheduleNextBreak);
    sendResponse({ ok: true });
  } else if (msg.action === 'stop') {
    setStorage({ enabled: false }).then(() => chrome.alarms.clearAll());
    sendResponse({ ok: true });
  }
  return true;
});

// intercept tab creation/updates during lock to enforce locked page
chrome.tabs.onCreated.addListener(async (tab) => {
  const s = await getStorage(['lockActive']);
  if (s.lockActive) {
    try { chrome.tabs.update(tab.id, { url: chrome.runtime.getURL('locked.html') }); } catch (e) {}
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.status === 'complete') {
    const s = await getStorage(['lockActive']);
    if (s.lockActive) {
      if (tab.url && !tab.url.startsWith(chrome.runtime.getURL('locked.html'))) {
        try { chrome.tabs.update(tabId, { url: chrome.runtime.getURL('locked.html') }); } catch (e) {}
      }
    }
  }
});
