async function getStorage(keys) { return new Promise(res => chrome.storage.local.get(keys, res)); }

function pad(n){ return n<10? '0'+n : n; }

async function start() {
  const s = await getStorage(['lockEnd']);
  let end = s.lockEnd || 0;
  function tick() {
    const now = Date.now();
    const rem = Math.max(0, end - now);
    const m = Math.floor(rem / 60000);
    const sec = Math.floor((rem % 60000) / 1000);
    document.getElementById('count').textContent = pad(m) + ':' + pad(sec);
    if (rem <= 0) {
      document.getElementById('count').textContent = '已结束，正在解锁...';
      // allow the background to unlock and restore tabs shortly
      clearInterval(iv);
    }
  }
  const iv = setInterval(tick, 500);
  tick();

  // prevent most interactions on this page
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('keydown', (e) => {
    // prevent simple navigations like F5, Ctrl+R
    if (e.key === 'F5' || (e.ctrlKey && e.key.toLowerCase() === 'r')) {
      e.preventDefault();
    }
  });
}

start();
