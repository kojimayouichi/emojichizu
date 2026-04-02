// --- 地図初期化 ---
const map = L.map('map', {
  center: [30, 10],
  zoom: 3,
  zoomControl: true,
  attributionControl: false,
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
}).addTo(map);

// --- Socket.io ---
const socket = io();

// --- 位置情報 ---
let userLat = null;
let userLng = null;

const statusEl = document.getElementById('status');

function setStatus(msg) {
  statusEl.textContent = msg;
}

// 位置取得
function getLocation() {
  if (!navigator.geolocation) {
    setStatus('位置情報が使えない環境です');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLat = pos.coords.latitude;
      userLng = pos.coords.longitude;
      map.setView([userLat, userLng], 6);
      setStatus('');
    },
    () => {
      setStatus('位置情報を取得できませんでした（地図中央から送ります）');
    },
    { timeout: 8000 }
  );
}

getLocation();

// --- 絵文字の1文字バリデーション ---
// Unicodeのgrapheme clusterで1文字かどうか判定
function isOneEmoji(str) {
  if (!str) return false;
  // Intl.Segmenter が使えれば正確に判定
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const seg = new Intl.Segmenter();
    const graphemes = [...seg.segment(str)];
    return graphemes.length === 1;
  }
  // フォールバック: スプレッド展開で1文字
  return [...str].length === 1;
}

// --- 入力 ---
const input = document.getElementById('emoji-input');
const sendBtn = document.getElementById('send-btn');

// 入力時に余分な文字を削る（最後の1文字を残す）
input.addEventListener('input', () => {
  const val = input.value;
  if (!val) return;

  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const seg = new Intl.Segmenter();
    const graphemes = [...seg.segment(val)].map(s => s.segment);
    // 最後の1文字だけ残す
    if (graphemes.length > 1) {
      input.value = graphemes[graphemes.length - 1];
    }
  } else {
    const chars = [...val];
    if (chars.length > 1) {
      input.value = chars[chars.length - 1];
    }
  }
});

function send() {
  const emoji = input.value.trim();
  if (!isOneEmoji(emoji)) {
    setStatus('絵文字を1つだけ入力してください');
    return;
  }

  // 位置が未取得なら地図の現在中心を使う
  const center = map.getCenter();
  const lat = userLat ?? center.lat;
  const lng = userLng ?? center.lng;

  socket.emit('emoji', { emoji, lat, lng });
  input.value = '';
  setStatus('');
}

sendBtn.addEventListener('click', send);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') send();
});

// --- 絵文字を地図上に表示 ---
socket.on('emoji', (data) => {
  showEmoji(data.emoji, data.lat, data.lng);
});

function showEmoji(emoji, lat, lng) {
  // 少しランダムにずらして重なりを減らす
  const jitterLat = lat + (Math.random() - 0.5) * 0.05;
  const jitterLng = lng + (Math.random() - 0.5) * 0.05;

  const icon = L.divIcon({
    html: `<div class="emoji-marker">${escapeHtml(emoji)}</div>`,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });

  const marker = L.marker([jitterLat, jitterLng], { icon, interactive: false }).addTo(map);

  // アニメーション終了（8秒）後にマーカー削除
  setTimeout(() => {
    marker.remove();
  }, 8000);
}

function escapeHtml(str) {
  // 絵文字はHTMLエスケープ対象外だが念のため
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
