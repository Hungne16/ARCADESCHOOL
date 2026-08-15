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

let stages = []; // Dữ liệu sẽ được nạp từ Firebase

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
    const teamsRight = document.getElementById('teams-right');
    if(teamsRight) teamsRight.innerHTML = '';
    
    teams.forEach((t, index) => {
        let heartsHTML = '';
        for(let i = 0; i < 3; i++) {
            heartsHTML += `<span class="heart ${i >= t.hp ? 'lost' : ''}">❤️</span>`;
        }
        
        // Cấu trúc card mới với ảnh nhân vật được thu nhỏ (mini-card)
        const cardHTML = `
            <div class="team-card mini-card ${t.hp <= 0 ? 'dead' : ''}" id="card-team-${t.id}">
                <div class="team-header team-color-${t.id}" style="font-size: 1.5rem; padding: 2px;">${t.name}</div>
                <div class="team-body" style="flex-direction: row; align-items: center; justify-content: space-around; padding: 5px;">
                    <div class="avatar-wrapper" id="avatar-wrapper-${t.id}" style="margin:0;">
                        <img class="team-avatar" src="character/${t.id}.png" alt="Avatar" style="height: 50px;">
                        <div class="feedback-icon" id="feedback-${t.id}" style="font-size: 2.5rem; top: -15px;"></div>
                    </div>
                    <div class="team-info" style="width: auto; margin: 0; padding: 2px 5px; background: transparent; border: none; box-shadow: none;">
                        <div class="hearts" style="font-size: 0.8rem; gap: 1px;">
                            ${heartsHTML}
                        </div>
                        <div class="team-score" id="score-${t.id}" style="font-size: 1.2rem;">🪙 ${t.score}</div>
                    </div>
                </div>
            </div>
        `;
        
        if(teamsRight) teamsRight.innerHTML += cardHTML;
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
    
    let imgHtml = stage.image ? `<img src="${stage.image}" style="max-height: 100%; max-width: 100%; object-fit: contain; border: 4px solid #fff; border-radius: 8px; box-shadow: 4px 4px 0px rgba(0,0,0,0.1);">` : '';

    // Hiển thị giao diện dành cho máy chiếu
    puzzleContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; width: 100%; height: 100%; gap: 10px;">
            ${stage.image ? `<div style="flex: 1; min-height: 0; display: flex; justify-content: center; align-items: center; overflow: hidden; padding-top: 5px;">${imgHtml}</div>` : ''}
            
            <div style="flex-shrink: 0; background-color: #f5f5f5; padding: 10px 15px; border-radius: 10px; border: 3px dashed #ccc; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 95%; margin: 0 auto;">
                <div style="display: flex; align-items: baseline; justify-content: center; gap: 10px; margin-bottom: 5px; flex-wrap: wrap;">
                    <h2 style="margin: 0; font-size: 2rem; color: #ff5252; text-shadow: 1px 1px 0px rgba(0,0,0,0.1); font-weight: bold;">${stage.title}:</h2>
                    <span style="font-size: 1.8rem; color: #222; margin: 0; line-height: 1.3;">${stage.desc}</span>
                </div>
                <div style="font-size: 1.5rem; text-align: center; color: #ffca28; background: #222; padding: 2px 15px; border-radius: 6px; border: 2px solid #000;" id="projector-status">
                    Đang đợi Giáo viên điều khiển...
                </div>
            </div>
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
    
    // Tính toán mã bí mật từ các mảnh ghép
    let secretCode = stages.map(s => s.fragment).join("");
    
    modalTitle.innerText = "MỞ KHÓA THÀNH CÔNG!";
    modalTitle.style.color = "#ffd700";
    modalText.innerHTML = `Mã số bí mật là: <strong style="color:#00ffcc; font-size:3.5rem;">${secretCode}</strong><br>Đội vô địch: <strong>${mvp.name}</strong> (${mvp.score} điểm)!`;
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

window.onload = () => {
    if (roomPin) {
        document.getElementById('puzzle-container').innerHTML = '<h2 style="color:#fff; text-align:center;">ĐANG TẢI DỮ LIỆU CÂU HỎI...</h2>';
        db.ref(`rooms/${roomPin}/questions`).once('value').then(snap => {
            const data = snap.val();
            if (data && data.length > 0) {
                stages = data.map((q, idx) => ({
                    title: `Trạm ${idx + 1}`,
                    desc: q.q,
                    options: { 
                        a: q.opts.A, b: q.opts.B, c: q.opts.C, 
                        d: q.opts.D, e: q.opts.E, f: q.opts.F 
                    },
                    correct: q.correct.toLowerCase(),
                    fragment: q.fragment || "?",
                    image: q.image
                }));
                
                // Khôi phục HTML gốc của puzzle-container
                document.getElementById('puzzle-container').innerHTML = `
                    <h2 class="stage-title" id="stage-title">Trạm ?</h2>
                    <p class="question-desc" id="question-desc">...</p>
                    <div class="answers-grid" id="answers-grid">
                        <div class="answer-card" id="ans-a"><span class="letter">A</span> <span class="text" id="text-a">...</span></div>
                        <div class="answer-card" id="ans-b"><span class="letter">B</span> <span class="text" id="text-b">...</span></div>
                        <div class="answer-card" id="ans-c"><span class="letter">C</span> <span class="text" id="text-c">...</span></div>
                        <div class="answer-card" id="ans-d"><span class="letter">D</span> <span class="text" id="text-d">...</span></div>
                        <div class="answer-card" id="ans-e"><span class="letter" style="background:#8e44ad;">E</span> <span class="text" id="text-e">...</span></div>
                        <div class="answer-card" id="ans-f"><span class="letter" style="background:#e84118;">F</span> <span class="text" id="text-f">...</span></div>
                    </div>
                `;
                initGame();
            } else {
                alert("Phòng này không có dữ liệu câu hỏi!");
            }
        });
    } else {
        alert("Vui lòng tham gia qua mã PIN (VD: ?room=1234)");
    }
};
