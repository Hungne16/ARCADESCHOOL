const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Phục vụ các file tĩnh trong thư mục hiện tại
app.use(express.static(__dirname));

// Lưu trữ trạng thái các phòng
const rooms = {};

function generatePIN() {
    let pin;
    do {
        pin = Math.floor(1000 + Math.random() * 9000).toString();
    } while (rooms[pin]);
    return pin;
}

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // ADMIN TẠO PHÒNG
    socket.on('create_room', (data) => {
        const pin = generatePIN();
        rooms[pin] = {
            adminId: socket.id,
            gameId: data.gameId,
            teamsCount: data.teamsCount
        };
        socket.join(pin);
        socket.emit('room_created', { pin: pin, ...rooms[pin] });
        console.log(`Phòng [${pin}] được tạo cho Game ${data.gameId} với ${data.teamsCount} đội.`);
    });

    // PLAYER VÀO PHÒNG
    socket.on('join_room', (pin) => {
        if (rooms[pin]) {
            socket.join(pin);
            socket.emit('room_joined', rooms[pin]);
            io.to(rooms[pin].adminId).emit('player_joined', socket.id);
            console.log(`Player ${socket.id} đã vào phòng [${pin}]`);
        } else {
            socket.emit('join_error', 'Mã phòng không tồn tại!');
        }
    });

    // ADMIN GỬI LỆNH ĐIỀU KHIỂN (Game Action)
    socket.on('admin_action', (data) => {
        const { pin, action, payload } = data;
        console.log(`Admin [${pin}] gửi lệnh: ${action}`, payload);
        // socket.to() sẽ gửi cho tất cả client trong phòng TRỪ người gửi (Admin)
        socket.to(pin).emit('game_action', { action, payload });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        // Tùy chọn: Xóa phòng nếu Admin thoát
        for (const pin in rooms) {
            if (rooms[pin].adminId === socket.id) {
                delete rooms[pin];
                console.log(`Đã xóa phòng [${pin}] vì Admin thoát.`);
                break;
            }
        }
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server đang chạy tại cổng ${PORT}`);
});
