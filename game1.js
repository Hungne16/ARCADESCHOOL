const urlParams = new URLSearchParams(window.location.search);
const roomPin = urlParams.get('room');
const teamsCount = parseInt(urlParams.get('teams') || 4);

if(roomPin) {
    let lastProcessedAction = null;
    db.ref('rooms/' + roomPin + '/actions').on('child_added', (snap) => {
        const data = snap.val();
        // Bỏ qua các sự kiện quá cũ (đề phòng firebase load lại lịch sử)
        if (Date.now() - data.ts > 10000) return;
        if(data.ts === lastProcessedAction) return;
        lastProcessedAction = data.ts;
        
        const { action, payload } = data;
        if (action === 'select_team') {
            selectTeam(payload);
        } else if (action === 'check_answer') {
            checkAnswer(payload);
        } else if (action === 'next_stage') {
            nextStage();
        }
    });
}

const stages = [
    {
        title: "Trạm 1: Bức Tường Số",
        desc: "Hệ thống bị khóa. Hãy tìm quy luật của dãy số sau để mở cửa:<br><br><strong>2,  6,  12,  20,  30,  ?</strong>",
        options: { a: "40", b: "42", c: "45", d: "48", e: "50", f: "55" },
        correct: "b",
        fragment: "4"
    },
    {
        title: "Trạm 2: Cuốn Sách Cổ",
        desc: "Dữ liệu lịch sử bị hỏng. Hãy điền từ còn thiếu:<br><br><em>'Tên gọi của thủ đô Hà Nội thời nhà Lý là gì?'</em>",
        options: { a: "Hoa Lư", b: "Cổ Loa", c: "Thăng Long", d: "Đông Đô", e: "Phú Xuân", f: "Gia Định" },
        correct: "c",
        fragment: "2"
    },
    {
        title: "Trạm 3: Mạch Điện Lõi",
        desc: "Cảnh báo nhiệt độ! Để khởi động lại hệ thống, hãy cho biết:<br><br><strong>Nước chuyển từ thể lỏng sang thể khí ở bao nhiêu độ C?</strong><br>(Chỉ nhập số)",
        options: { a: "50", b: "75", c: "90", d: "100", e: "120", f: "150" },
        correct: "d",
        fragment: "0"
    }
];

let currentStage = 0;
let timeRemaining = 600; // 10 minutes in seconds
let timerInterval;

// Tạo mảng teams động
let teams = [];
for(let i=1; i<=teamsCount; i++) {
    teams.push({ id: i, name: `Đội ${i}`, hp: 3, score: 0 });
}

let currentActiveTeam = null;

// DOM Elements
const puzzleContainer = document.getElementById('puzzle-container');
const timerDisplay = document.getElementById('timer');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalText = document.getElementById('modal-text');
const teamsDashboard = document.getElementById('teams-dashboard');

// Audio (8-bit sounds)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'correct') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.setValueAtTime(554.37, audioCtx.currentTime + 0.1); 
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.2); 
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.4);
        osc.start(); osc.stop(audioCtx.currentTime + 0.4);
    }
}

// Khởi tạo trò chơi
function initGame() {
    renderTeams();
    renderStage();
    startTimer();
}

function renderTeams() {
    const teamsLeft = document.getElementById('teams-left');
    const teamsRight = document.getElementById('teams-right');
    if(teamsLeft) teamsLeft.innerHTML = '';
    if(teamsRight) teamsRight.innerHTML = '';
    
    const half = Math.ceil(teams.length / 2);

    teams.forEach((t, index) => {
        let heartsHTML = '';
        for(let i = 0; i < 3; i++) {
            heartsHTML += `<span class="heart ${i >= t.hp ? 'lost' : ''}">❤️</span>`;
        }
        
        // Cấu trúc card mới với ảnh nhân vật
        const cardHTML = `
            <div class="team-card ${t.hp <= 0 ? 'dead' : ''}" id="card-team-${t.id}">
                <div class="team-header team-color-${t.id}">${t.name}</div>
                <div class="team-body" style="flex-direction: column; justify-content: flex-start; align-items: center; padding: 10px;">
                    <div class="team-info" style="margin-bottom: 5px; width: 100%;">
                        <div class="hearts" style="font-size: 1.5rem;">
                            ${heartsHTML}
                        </div>
                        <div class="team-score" id="score-${t.id}" style="font-size: 1.5rem; margin-top: 5px;">🪙 ${t.score}</div>
                    </div>
                    <div class="avatar-wrapper" id="avatar-wrapper-${t.id}" style="margin: auto 0 0 0;">
                        <img class="team-avatar" src="character/${t.id}.png" alt="Avatar" style="height: 110px; margin: 0; object-fit: contain;">
                        <div class="feedback-icon" id="feedback-${t.id}"></div>
                    </div>
                </div>
            </div>
        `;
        
        if (index < half) {
            if(teamsLeft) teamsLeft.innerHTML += cardHTML;
        } else {
            if(teamsRight) teamsRight.innerHTML += cardHTML;
        }
    });
}

function renderStage() {
    if (currentStage >= stages.length) {
        showVictory();
        return;
    }

    currentActiveTeam = null;

    if(teams.every(t => t.hp <= 0)) {
        gameOver();
        return;
    }

    const stage = stages[currentStage];
    // Hiển thị giao diện dành cho máy chiếu
    puzzleContainer.innerHTML = `
        <h2 class="station-title">${stage.title}</h2>
        <p class="puzzle-desc">${stage.desc}</p>
        
        <div style="font-size: 2rem; text-align: center; margin-top: 15px; color: #ffca28;" id="projector-status">
            Đang đợi Giáo viên điều khiển...
        </div>
    `;
    
    // Reset đáp án UI
    ['a', 'b', 'c', 'd', 'e', 'f'].forEach(l => {
        const textEl = document.getElementById(`text-${l}`);
        const cardEl = document.getElementById(`ans-${l}`);
        if(textEl && stage.options[l]) {
            textEl.innerText = stage.options[l];
            cardEl.style.display = 'flex';
            cardEl.className = 'answer-card'; // reset classes
        } else if (cardEl) {
            cardEl.style.display = 'none';
        }
    });
}

function selectTeam(id) {
    const team = teams.find(t => t.id === id);
    if(team.hp <= 0) return;
    currentActiveTeam = id;
    
    document.querySelectorAll('.team-card').forEach(c => c.style.borderColor = '#fff');
    document.getElementById(`card-team-${id}`).style.borderColor = '#00ffcc';
    
    document.getElementById('projector-status').innerHTML = `Đội ${id} đang trả lời...`;
}

function checkAnswer(userLetter) {
    if (!currentActiveTeam) return;

    userLetter = userLetter.trim().toLowerCase();
    const stage = stages[currentStage];
    const teamIndex = teams.findIndex(t => t.id === currentActiveTeam);
    const team = teams[teamIndex];
    
    // Highlight thẻ đội vừa chọn đáp án
    const cardEl = document.getElementById(`ans-${userLetter}`);
    if(cardEl) {
        cardEl.classList.add('selected');
    }
    
    const avatarWrapper = document.getElementById(`avatar-wrapper-${currentActiveTeam}`);
    const feedbackIcon = document.getElementById(`feedback-${currentActiveTeam}`);

    if (userLetter === stage.correct) {
        playSound('correct');
        if(cardEl) cardEl.classList.add('correct');
        
        if (avatarWrapper && feedbackIcon) {
            feedbackIcon.innerText = '✔️';
            avatarWrapper.classList.add('pop-up', 'correct');
            setTimeout(() => {
                avatarWrapper.classList.remove('pop-up', 'correct');
            }, 2000);
        }
        
        team.score += 100;
        renderTeams();

        const slot = document.getElementById(`slot-${currentStage + 1}`);
        slot.innerText = stage.fragment;
        slot.classList.add('filled');

        document.getElementById('projector-status').innerHTML = ``;
        modalTitle.innerText = "THÀNH CÔNG!";
        modalTitle.style.color = "#00e676";
        modalText.innerText = `[${team.name}] chọn ${userLetter.toUpperCase()} chính xác!\nĐã thu thập mảnh ghép: ${stage.fragment}`;
        modal.classList.remove('hidden');
    } else {
        playSound('wrong');
        if(cardEl) cardEl.classList.add('wrong');
        
        if (avatarWrapper && feedbackIcon) {
            feedbackIcon.innerText = '❌';
            avatarWrapper.classList.add('pop-up', 'wrong');
            setTimeout(() => {
                avatarWrapper.classList.remove('pop-up', 'wrong');
            }, 2000);
        }
        
        team.hp--;
        timeRemaining -= 30; 
        if (timeRemaining < 0) timeRemaining = 0;
        
        renderTeams();

        document.body.classList.remove('flash-red');
        void document.body.offsetWidth;
        document.body.classList.add('flash-red');

        if(cardEl) {
            cardEl.classList.remove('shake');
            void cardEl.offsetWidth; 
            cardEl.classList.add('shake');
        }
        
        document.getElementById('projector-status').innerHTML = `Đội ${team.name} chọn sai! Mất 1 mạng và 30s. Lượt của đội khác...`;
        
        document.getElementById(`card-team-${currentActiveTeam}`).style.borderColor = '#fff';
        currentActiveTeam = null;
        
        if (teams.every(t => t.hp <= 0)) {
            setTimeout(() => gameOver(), 1500);
        }
    }
}

function nextStage() {
    modal.classList.add('hidden');
    currentStage++;
    renderStage();
}

function gameOver() {
    clearInterval(timerInterval);
    timerDisplay.innerText = "00:00";
    modalTitle.innerText = "THẤT BẠI!";
    modalTitle.style.color = "#ff5252";
    modalText.innerText = "Cả lớp đã hết Mạng hoặc Hết thời gian!\nHệ thống bị khóa vĩnh viễn.";
    modal.classList.remove('hidden');
}

function showVictory() {
    clearInterval(timerInterval);
    let mvp = [...teams].sort((a,b) => b.score - a.score)[0];
    modalTitle.innerText = "MỞ KHÓA THÀNH CÔNG!";
    modalTitle.style.color = "#ffd700";
    modalText.innerHTML = `Mã số bí mật là: <strong>420</strong><br>Đội vô địch: <strong>${mvp.name}</strong> (${mvp.score} điểm)!`;
    modal.classList.remove('hidden');
}

function startTimer() {
    timerInterval = setInterval(() => {
        timeRemaining--;
        let m = Math.floor(timeRemaining / 60);
        let s = timeRemaining % 60;
        timerDisplay.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        
        if (timeRemaining <= 60) {
            timerDisplay.classList.add('danger');
        }

        if (timeRemaining <= 0) {
            updateStatusText("SẴN SÀNG GIẢI MÃ!");
        }
    }, 1000);
}

window.onload = initGame;
