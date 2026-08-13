const urlParams = new URLSearchParams(window.location.search);
const roomPin = urlParams.get('room');
const teamsCount = parseInt(urlParams.get('teams') || 4);

const socket = typeof io !== 'undefined' ? io() : null;
if(socket && roomPin) {
    socket.emit('join_room', roomPin);
}

const stages = [
    {
        title: "Trạm 1: Bức Tường Số",
        desc: "Hệ thống bị khóa. Hãy tìm quy luật của dãy số sau để mở cửa:<br><br><strong>2,  6,  12,  20,  30,  ?</strong>",
        answer: ["42"],
        fragment: "4"
    },
    {
        title: "Trạm 2: Cuốn Sách Cổ",
        desc: "Dữ liệu lịch sử bị hỏng. Hãy điền từ còn thiếu:<br><br><em>'Tên gọi của thủ đô Hà Nội thời nhà Lý là gì?'</em>",
        answer: ["thăng long", "thang long"],
        fragment: "2"
    },
    {
        title: "Trạm 3: Mạch Điện Lõi",
        desc: "Cảnh báo nhiệt độ! Để khởi động lại hệ thống, hãy cho biết:<br><br><strong>Nước chuyển từ thể lỏng sang thể khí ở bao nhiêu độ C?</strong><br>(Chỉ nhập số)",
        answer: ["100"],
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
    teamsDashboard.innerHTML = '';
    teams.forEach(t => {
        let heartsHTML = '';
        for(let i = 0; i < 3; i++) {
            heartsHTML += `<span class="heart ${i >= t.hp ? 'lost' : ''}">❤️</span>`;
        }
        teamsDashboard.innerHTML += `
            <div class="team-card ${t.hp <= 0 ? 'dead' : ''}" id="card-team-${t.id}">
                <h3>${t.name}</h3>
                <div class="team-score" id="score-${t.id}">${t.score}</div>
                <div class="hearts">
                    ${heartsHTML}
                </div>
            </div>
        `;
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
    // Hiển thị giao diện dành cho máy chiếu (không cần input box, mọi thứ qua điện thoại)
    puzzleContainer.innerHTML = `
        <h2 class="station-title">${stage.title}</h2>
        <p class="puzzle-desc">${stage.desc}</p>
        
        <div style="font-size: 3rem; text-align: center; margin-top: 30px; color: #ffca28;" id="projector-status">
            Đang đợi Giáo viên điều khiển...
        </div>
        <div class="input-group hidden" id="anim-box">
            <input type="text" id="answer-input" class="answer-input" autocomplete="off" disabled>
        </div>
    `;
}

function selectTeam(id) {
    const team = teams.find(t => t.id === id);
    if(team.hp <= 0) return;
    currentActiveTeam = id;
    
    document.querySelectorAll('.team-card').forEach(c => c.style.borderColor = '#fff');
    document.getElementById(`card-team-${id}`).style.borderColor = '#00ffcc';
    
    document.getElementById('projector-status').innerHTML = `Đội ${id} đang trả lời...`;
}

function checkAnswer(userAnswer) {
    if (!currentActiveTeam) return;

    const animBox = document.getElementById('anim-box');
    const inputEl = document.getElementById('answer-input');
    animBox.classList.remove('hidden');
    inputEl.value = userAnswer; // Hiển thị trên máy chiếu cho học sinh thấy
    
    userAnswer = userAnswer.trim().toLowerCase();
    const stage = stages[currentStage];
    const teamIndex = teams.findIndex(t => t.id === currentActiveTeam);
    const team = teams[teamIndex];

    if (stage.answer.includes(userAnswer)) {
        playSound('correct');
        
        team.score += 100;
        renderTeams();

        const slot = document.getElementById(`slot-${currentStage + 1}`);
        slot.innerText = stage.fragment;
        slot.classList.add('filled');

        document.getElementById('projector-status').innerHTML = ``;
        modalTitle.innerText = "THÀNH CÔNG!";
        modalTitle.style.color = "#00e676";
        modalText.innerText = `[${team.name}] trả lời đúng!\nĐã thu thập mảnh ghép: ${stage.fragment}`;
        modal.classList.remove('hidden');
    } else {
        playSound('wrong');
        
        team.hp--;
        timeRemaining -= 30; 
        if (timeRemaining < 0) timeRemaining = 0;
        
        renderTeams();

        document.body.classList.remove('flash-red');
        void document.body.offsetWidth;
        document.body.classList.add('flash-red');

        inputEl.classList.remove('shake');
        void inputEl.offsetWidth; 
        inputEl.classList.add('shake');
        
        document.getElementById('projector-status').innerHTML = `Sai rồi! Lượt của Đội khác...`;
        
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
            gameOver();
        }
    }, 1000);
}

// Socket LISTENERS
if(socket) {
    socket.on('game_action', (data) => {
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

window.onload = initGame;
