const urlParams = new URLSearchParams(window.location.search);
const roomPin = urlParams.get('room');

if (!roomPin) {
    alert("Không tìm thấy mã phòng!");
    window.location.href = 'index.html';
}

const db = firebase.database();
let teamsData = [];

// Khởi tạo pháo hoa
var myCanvas = document.getElementById('confetti-canvas');
var myConfetti = confetti.create(myCanvas, {
    resize: true,
    useWorker: true
});

function fireConfetti() {
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

function renderRanking() {
    const podiumArea = document.getElementById('podium-area');
    const otherList = document.getElementById('other-teams-list');
    
    podiumArea.innerHTML = '';
    otherList.innerHTML = '';

    if (teamsData.length === 0) {
        podiumArea.innerHTML = '<h2 style="color:white; font-size:2rem;">Chưa có dữ liệu xếp hạng</h2>';
        return;
    }

    // Sắp xếp giảm dần theo điểm
    const sortedTeams = [...teamsData].sort((a, b) => b.score - a.score);

    // Top 3 (Podium)
    // Để hiển thị đúng thứ tự trực quan 2 - 1 - 3, ta lấy ra và render theo class
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
                <div class="podium-team-name">${team.name}</div>
                <div class="podium-team-score">${team.score}</div>
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
            <div class="list-name">${team.name}</div>
            <div class="list-score">${team.score}</div>
        `;
        otherList.appendChild(item);
    });

    // Bắn pháo hoa ăn mừng
    fireConfetti();
}

// Lắng nghe dữ liệu xếp hạng từ Firebase
db.ref(`rooms/${roomPin}/rankings`).once('value', snapshot => {
    if (snapshot.exists()) {
        teamsData = snapshot.val();
        renderRanking();
    } else {
        alert("Chưa có dữ liệu xếp hạng cho phòng này!");
    }
});

// Lắng nghe sự thay đổi room (để phòng trường hợp admin đổi sang game khác từ trang admin)
db.ref(`rooms/${roomPin}/currentAction`).on('value', snapshot => {
    const val = snapshot.val();
    if(val) {
        // Nếu admin ấn chuyển game mới (khác "ranking.html")
        if(val.action === 'change_game' && val.game && val.game !== 'ranking.html') {
            window.location.href = val.game + '?room=' + roomPin;
        }
    }
});
