// Firebase 初期化
const firebaseConfig = {
  apiKey: "AIzaSyD-EgEDWLpetczbN018O0cg4AmBz5fdexs",
  authDomain: "emojichizu.firebaseapp.com",
  databaseURL: "https://emojichizu-default-rtdb.firebaseio.com",
  projectId: "emojichizu",
  storageBucket: "emojichizu.firebasestorage.app",
  messagingSenderId: "787820578774",
  appId: "1:787820578774:web:6ab98cbe9574d352d4c677",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const emojisRef = db.ref('emojis');

const DISPLAY_MS = 8000;
const MAX_AGE_MS = 10000;

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

// --- 位置情報 ---
let userLat = null;
let userLng = null;

const statusEl = document.getElementById('status');

navigator.geolocation?.getCurrentPosition(
  (pos) => {
    userLat = pos.coords.latitude;
    userLng = pos.coords.longitude;
    map.setView([userLat, userLng], 6);
    statusEl.textContent = '';
  },
  () => {
    statusEl.textContent = '位置情報を取得できませんでした（地図中央から送ります）';
  },
  { timeout: 8000 }
);

// ページ読み込み時に古いエントリを削除（ブラウザを閉じた後の残留データ対策）
emojisRef.once('value', (snapshot) => {
  const now = Date.now();
  snapshot.forEach((child) => {
    const ts = child.val()?.ts ?? 0;
    if (now - ts > 30000) child.ref.remove();
  });
});

// --- 絵文字1文字バリデーション ---
function isOneEmoji(str) {
  if (!str) return false;
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return [...new Intl.Segmenter().segment(str)].length === 1;
  }
  return [...str].length === 1;
}

// --- 入力: 常に最後の1文字だけ残す ---
const input = document.getElementById('emoji-input');
const sendBtn = document.getElementById('send-btn');

input.addEventListener('input', () => {
  const val = input.value;
  if (!val) return;
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const graphemes = [...new Intl.Segmenter().segment(val)].map((s) => s.segment);
    if (graphemes.length > 1) input.value = graphemes[graphemes.length - 1];
  } else {
    const chars = [...val];
    if (chars.length > 1) input.value = chars[chars.length - 1];
  }
});

function send() {
  const emoji = input.value.trim();
  if (!isOneEmoji(emoji)) {
    statusEl.textContent = '絵文字を1つだけ入力してください';
    return;
  }

  const center = map.getCenter();
  const lat = userLat ?? center.lat;
  const lng = userLng ?? center.lng;

  const newRef = emojisRef.push({
    emoji,
    lat,
    lng,
    ts: firebase.database.ServerValue.TIMESTAMP,
  });

  // 送信者が一定時間後に削除
  setTimeout(() => newRef.remove(), DISPLAY_MS + 500);

  input.value = '';
  statusEl.textContent = '';
}

sendBtn.addEventListener('click', send);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') send();
});

// --- Firebase リアルタイム受信 ---
emojisRef.on('child_added', (snapshot) => {
  const data = snapshot.val();
  if (!data) return;

  // 古いエントリはスキップ
  if (Date.now() - (data.ts ?? 0) > MAX_AGE_MS) return;

  showEmoji(data.emoji, data.lat, data.lng);
});

// --- 絵文字を地図上に表示 ---
function showEmoji(emoji, lat, lng) {
  const jLat = lat + (Math.random() - 0.5) * 0.05;
  const jLng = lng + (Math.random() - 0.5) * 0.05;

  const icon = L.divIcon({
    html: `<div class="emoji-marker">${escapeHtml(emoji)}</div>`,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });

  const marker = L.marker([jLat, jLng], { icon, interactive: false }).addTo(map);
  setTimeout(() => marker.remove(), DISPLAY_MS);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
