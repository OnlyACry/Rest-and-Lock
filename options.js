async function getStorage(keys) { return new Promise(res => chrome.storage.local.get(keys, res)); }
async function setStorage(obj) { return new Promise(res => chrome.storage.local.set(obj, res)); }

async function init() {
  const s = await getStorage(['breakIntervalMin','breakDurationMin']);
  document.getElementById('interval').value = s.breakIntervalMin || 50;
  document.getElementById('duration').value = s.breakDurationMin || 10;
}

document.getElementById('save').addEventListener('click', async () => {
  const interval = Number(document.getElementById('interval').value) || 50;
  const duration = Number(document.getElementById('duration').value) || 10;
  await setStorage({ breakIntervalMin: interval, breakDurationMin: duration });
  // ask background to reschedule and wait for response
  chrome.runtime.sendMessage({ action: 'reschedule' }, async () => {
    await new Promise(r => setTimeout(r, 100)); // give background a moment to update
  });
  const msg = document.getElementById('msg');
  msg.textContent = '已保存并重置计时';
  setTimeout(() => msg.textContent = '', 3000);
});

init();
