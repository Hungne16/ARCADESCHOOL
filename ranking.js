const urlParams = new URLSearchParams(window.location.search);
const roomPin = urlParams.get('room');

if (!roomPin) {
    alert("Không tìm thấy mã phòng!");
    window.location.href = 'index.html';
}

const db = firebase.database();
let teamsData = [];

// Khởi tạo pháo hoa (Thêm try-catch để phòng lỗi CDN mạng trường học chặn)
var myCanvas = document.getElementById('confetti-canvas');
var myConfetti = null;
try {
    if (typeof confetti !== 'undefined') {
        myConfetti = confetti.create(myCanvas, {
            resize: true,
            useWorker: true
        });
    }
} catch(e) {
    console.log("Confetti failed to load", e);
}

function fireConfetti() {
    if (!myConfetti) return;
    var duration = 15 * 1000;
    var animationEnd = Date.now() + duration;
    var defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min, max) {
        return Math.random() * (max - min) + min;
    }

    var interval = setInterval(function() {
        var timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
            return clearInterval(interval);
        }

        var particleCount = 50 * (timeLeft / duration);
        myConfetti(Object.assign({}, defaults, { particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
        }));
        myConfetti(Object.assign({}, defaults, { particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
        }));
    }, 250);
}

function showError(msg) {
    const podiumArea = document.getElementById('podium-area');
    if (podiumArea) {
        podiumArea.innerHTML = `<h2 style="color:#ff5252; font-size:2rem; background: rgba(0,0,0,0.8); padding: 20px; text-align:center;">LỖI: ${msg}</h2>`;
    }
}

function renderRanking() {
    try {
        const podiumArea = document.getElementById('podium-area');
        const otherList = document.getElementById('other-teams-list');
        
        podiumArea.innerHTML = '';
        otherList.innerHTML = '';

        if (!teamsData) {
            showError("Dữ liệu xếp hạng rỗng.");
            return;
        }

        // Đảm bảo teamsData luôn là một mảng
        const teamsArray = Array.isArray(teamsData) ? teamsData : Object.values(teamsData);

        if (teamsArray.length === 0) {
            showError("Danh sách đội trống.");
            return;
        }

        // Lọc các giá trị null/undefined và sắp xếp giảm dần
        const sortedTeams = teamsArray.filter(t => t != null && typeof t === 'object').sort((a, b) => (b.score || 0) - (a.score || 0));

        if (sortedTeams.length === 0) {
            showError("Không tìm thấy đội nào có điểm hợp lệ.");
            return;
        }

        // Top 3 (Podium)
        const top3 = sortedTeams.slice(0, 3);
        const icons = ['👑', '🥈', '🥉'];
        
        top3.forEach((team, index) => {
            const rank = index + 1;
            const spot = document.createElement('div');
            spot.className = `podium-spot rank-${rank}`;
            
            spot.innerHTML = `
                <div class="team-avatar">${icons[index]}</div>
                <div class="podium-box">
                    <div class="podium-rank-num">${rank}</div>
                    <div class="podium-team-name">${team.name || "Unknown"}</div>
                    <div class="podium-team-score">${team.score || 0}</div>
                </div>
            `;
            podiumArea.appendChild(spot);
        });

        // Các đội còn lại
        const others = sortedTeams.slice(3);
        others.forEach((team, index) => {
            const rank = index + 4;
            const item = document.createElement('div');
            item.className = 'list-item';
            item.innerHTML = `
                <div class="list-rank">#${rank}</div>
                <div class="list-name">${team.name || "Unknown"}</div>
                <div class="list-score">${team.score || 0}</div>
            `;
            otherList.appendChild(item);
        });

        // Bắn pháo hoa ăn mừng
        fireConfetti();
    } catch (e) {
        showError(e.message);
    }
}

// Lắng nghe dữ liệu xếp hạng từ Firebase
db.ref(`rooms/${roomPin}/rankings`).once('value', snapshot => {
    if (snapshot.exists()) {
        teamsData = snapshot.val();
        renderRanking();
    } else {
        showError("Chưa có dữ liệu xếp hạng cho phòng này trên hệ thống! Vui lòng hoàn thành một trò chơi.");
    }
}).catch(err => {
    showError("Lỗi kết nối Firebase: " + err.message);
});

// Lắng nghe sự thay đổi room (để phòng trường hợp admin đổi sang game khác từ trang admin)
db.ref(`rooms/${roomPin}/currentAction`).on('value', snapshot => {
    const val = snapshot.val();
    if(val) {
        if(val.action === 'change_game' && val.game && val.game !== 'ranking.html') {
            window.location.href = val.game + '?room=' + roomPin;
        }
    }
});
