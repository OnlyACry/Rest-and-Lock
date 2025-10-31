async function getStorage(keys) { return new Promise(res => chrome.storage.local.get(keys, res)); }
async function setStorage(obj) { return new Promise(res => chrome.storage.local.set(obj, res)); }

function formatTime(ts) { return new Date(ts).toLocaleTimeString(); }

async function refresh() {
  const s = await getStorage(['breakIntervalMin','breakDurationMin','enabled','nextBreak','lockActive','lockEnd']);
  document.getElementById('interval').value = s.breakIntervalMin || 50;
  document.getElementById('duration').value = s.breakDurationMin || 10;
  const toggle = document.getElementById('toggle');
  toggle.textContent = s.enabled ? '暂停' : '开始';

  const status = document.getElementById('status');
  if (s.lockActive) {
    status.textContent = '当前：休息中';
  } else {
    status.textContent = s.enabled ? '当前：运行中' : '当前：已暂停';
  }

  const next = document.getElementById('next');
  if (s.nextBreak && !s.lockActive) {
    next.textContent = '下次休息：' + formatTime(s.nextBreak);
  } else if (s.lockActive) {
    next.textContent = '解锁时间：' + formatTime(s.lockEnd);
  } else {
    next.textContent = '';
  }
}

document.getElementById('save').addEventListener('click', async () => {
  const interval = Number(document.getElementById('interval').value) || 50;
  const duration = Number(document.getElementById('duration').value) || 10;
  await setStorage({ breakIntervalMin: interval, breakDurationMin: duration });
  // ask background to reschedule and wait for response
  chrome.runtime.sendMessage({ action: 'reschedule' }, async () => {
    await new Promise(r => setTimeout(r, 100)); // give background a moment to update
    refresh();
  });
});

document.getElementById('toggle').addEventListener('click', async () => {
  const s = await getStorage(['enabled']);
  if (s.enabled) {
    chrome.runtime.sendMessage({ action: 'stop' }, () => refresh());
  } else {
    chrome.runtime.sendMessage({ action: 'start' }, () => refresh());
  }
});

refresh();
