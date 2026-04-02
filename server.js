const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log(`接続: ${socket.id}`);

  socket.on('emoji', (data) => {
    // 簡易バリデーション: サーバー側でも1文字チェック
    const emoji = String(data.emoji ?? '');
    const lat = parseFloat(data.lat);
    const lng = parseFloat(data.lng);

    if (!emoji || [...emoji].length !== 1) return;
    if (isNaN(lat) || isNaN(lng)) return;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return;

    // 全クライアントにブロードキャスト
    io.emit('emoji', {
      emoji,
      lat,
      lng,
      id: socket.id,
      ts: Date.now(),
    });
  });

  socket.on('disconnect', () => {
    console.log(`切断: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`サーバー起動中: http://localhost:${PORT}`);
});
