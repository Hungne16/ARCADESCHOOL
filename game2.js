
const questions = [
    {
        q: "Chiến thắng Điện Biên Phủ diễn ra vào năm nào?",
        opts: { A: "1945", B: "1954", C: "1975", D: "1930" },
        correct: "B"
    },
    {
        q: "Đỉnh núi nào được mệnh danh là 'Nóc nhà Đông Dương'?",
        opts: { A: "Fansipan", B: "Bạch Mã", C: "Langbiang", D: "Ngọc Linh" },
        correct: "A"
    },
    {
        q: "Căn bậc hai của 144 là bao nhiêu?",
        opts: { A: "10", B: "12", C: "14", D: "16" },
        correct: "B"
    },
    {
        q: "Khí nào chiếm tỉ lệ lớn nhất trong bầu khí quyển Trái Đất?",
        opts: { A: "Oxy (O2)", B: "Nitơ (N2)", C: "Cacbonic (CO2)", D: "Hydro (H2)" },
        correct: "B"
    },
    {
        q: "Tác giả của kiệt tác 'Truyện Kiều' là ai?",
        opts: { A: "Nguyễn Trãi", B: "Nguyễn Du", C: "Hồ Xuân Hương", D: "Nam Cao" },
        correct: "B"
    }
];

let currentQuestion = 0;
let teams = [];
for(let i=1; i<=teamsCount; i++) {
    teams.push({ id: i, name: `Đội ${i}`, hp: 3, score: 0 });
}

let teamAnswers = {};
teams.forEach(t => teamAnswers[t.id] = null);

// DOM Elements
const qText = document.getElementById('question-text');
const tAnsA = document.getElementById('text-a');
const tAnsB = document.getElementById('text-b');
const tAnsC = document.getElementById('text-c');
const tAnsD = document.getElementById('text-d');
const qCounter = document.getElementById('question-counter');
const teamsDashboard = document.getElementById('teams-dashboard');
const modal = document.getElementById('modal');

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
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
        osc.start(); osc.stop(audioCtx.currentTime + 0.5);
    } else if (type === 'correct') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(554.37, audioCtx.currentTime); 
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); 
        osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.3); 
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.6);
        osc.start(); osc.stop(audioCtx.currentTime + 0.6);
    } else if (type === 'lock') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(); osc.stop(audioCtx.currentTime + 0.1);
    }
}

function initGame() {
    renderTeams();
    loadQuestion();
}

function renderTeams() {
    const teamsLeft = document.getElementById('teams-left');
    const teamsRight = document.getElementById('teams-right');
    if(teamsLeft) teamsLeft.innerHTML = '';
    if(teamsRight) teamsRight.innerHTML = '';

    teams.forEach((t, index) => {
        let heartsHTML = '';
        for(let i = 0; i < 3; i++) {
            heartsHTML += `<span class="heart ${i >= t.hp ? 'lost' : ''}">❤️</span>`;
        }

        const cardHTML = `
            <div class="team-card ${t.hp <= 0 ? 'dead' : ''}" id="card-team-${t.id}">
                <h3>${t.name}</h3>
                <div class="team-score" id="score-${t.id}">${t.score}</div>
                <div class="hearts">
                    ${heartsHTML}
                </div>
            </div>
        `;
        
        if (index % 2 === 0) {
            if(teamsLeft) teamsLeft.innerHTML += cardHTML;
        } else {
            if(teamsRight) teamsRight.innerHTML += cardHTML;
        }
    });
}

function loadQuestion() {
    if (currentQuestion >= questions.length) {
        showVictory();
        return;
    }
    
    if (teams.every(t => t.hp <= 0)) {
        gameOver();
        return;
    }

    const q = questions[currentQuestion];
    qCounter.innerText = `Câu: ${currentQuestion + 1}/${questions.length}`;
    qText.innerText = q.q;
    tAnsA.innerText = q.opts.A;
    tAnsB.innerText = q.opts.B;
    tAnsC.innerText = q.opts.C;
    tAnsD.innerText = q.opts.D;

    // Reset UI
    document.querySelectorAll('.answer-card').forEach(c => {
        c.classList.remove('dimmed', 'correct');
    });
    
    teams.forEach(t => {
        teamAnswers[t.id] = t.hp <= 0 ? "DEAD" : null;
        const card = document.getElementById(`card-team-${t.id}`);
        if(card) {
            card.style.borderColor = '#fff';
            card.style.transform = 'scale(1)'; // reset scale
            const badge = document.getElementById(`badge-${t.id}`);
            if(badge) badge.remove();
        }
    });
}

function selectTeam(id) {
    teams.forEach(t => {
        const card = document.getElementById(`card-team-${t.id}`);
        if (card && t.hp > 0) {
            card.style.borderColor = '#fff';
            const badge = document.getElementById(`badge-${t.id}`);
            if(badge && badge.innerText === 'ĐANG CHỌN...') badge.remove();
        }
    });
    const activeCard = document.getElementById(`card-team-${id}`);
    if(activeCard) {
        activeCard.style.borderColor = '#ffca28'; // Màu vàng nổi bật
        // Thêm badge ĐANG CHỌN
        const existingBadge = document.getElementById(`badge-${id}`);
        if(!existingBadge) {
            activeCard.innerHTML += `<div id="badge-${id}" style="background: #ffca28; color:#000; padding: 5px 15px; border-radius: 5px; font-weight:bold; font-size: 2rem; margin-top: 10px; text-transform: uppercase; animation: blink 1s infinite;">ĐANG CHỌN...</div>`;
        }
    }
}

function setAnswer(teamId, letter) {
    playSound('lock');
    teamAnswers[teamId] = letter;
    
    const card = document.getElementById(`card-team-${teamId}`);
    if (card) {
        card.style.borderColor = '#00ffcc';
        card.style.transform = 'scale(0.95)'; // Indicate locked
        const badge = document.getElementById(`badge-${teamId}`);
        if(badge) {
            badge.innerText = `ĐÃ CHỐT: ${letter}`;
            badge.style.background = '#00ffcc';
            badge.style.animation = 'none';
        } else {
            card.innerHTML += `<div id="badge-${teamId}" style="background: #00ffcc; color:#000; padding: 5px 15px; border-radius: 5px; font-weight:bold; font-size: 2rem; margin-top: 10px; text-transform: uppercase;">ĐÃ CHỐT: ${letter}</div>`;
        }
    }
}

// CÔNG BỐ KẾT QUẢ
function revealAnswers() {
    const q = questions[currentQuestion];
    const correctAns = q.correct;

    // Làm mờ các ô sai, nhấp nháy ô đúng
    ['a', 'b', 'c', 'd'].forEach(letter => {
        const card = document.getElementById(`ans-${letter}`);
        if (letter.toUpperCase() === correctAns) {
            card.classList.add('correct');
        } else {
            card.classList.add('dimmed');
        }
    });

    let correctCount = 0;
    let wrongCount = 0;

    teams.forEach(t => {
        if (t.hp <= 0) return; 

        const ans = teamAnswers[t.id];
        const cardUI = document.getElementById(`card-team-${t.id}`);
        
        // Hiện đáp án đội chọn ngay trên card
        cardUI.innerHTML += `<div style="font-size: 3rem; color: #fff; margin-top: 10px; font-weight:bold;">Chốt: ${ans || '?'}</div>`;

        if (ans === correctAns) {
            t.score += 100;
            correctCount++;
            cardUI.classList.remove('spring-bounce');
            void cardUI.offsetWidth;
            cardUI.classList.add('spring-bounce');
        } else {
            t.hp--;
            wrongCount++;
            cardUI.classList.remove('shake');
            void cardUI.offsetWidth;
            cardUI.classList.add('shake');
        }
    });

    setTimeout(() => {
        renderTeams(); // Update UI scores and HP
    }, 1000);

    if (wrongCount > 0) {
        playSound('wrong');
        document.body.classList.remove('flash-red');
        void document.body.offsetWidth;
        document.body.classList.add('flash-red');
    } else {
        playSound('correct');
    }

    setTimeout(() => {
        if (teams.every(t => t.hp <= 0)) {
            gameOver();
        } else {
            showResultModal(correctCount, correctAns);
        }
    }, 3000);
}

function showResultModal(correctCount, correctAns) {
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');
    
    modalTitle.innerText = "KẾT QUẢ!";
    modalTitle.style.color = "#00e676";
    modalText.innerHTML = `Đáp án đúng là <strong>${correctAns}</strong>!<br>Có ${correctCount} đội trả lời đúng.`;
    
    modal.classList.remove('hidden');
}

function nextQuestion() {
    modal.classList.add('hidden');
    currentQuestion++;
    loadQuestion();
}

function gameOver() {
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');
    
    modalTitle.innerText = "THẢM HỌA!";
    modalTitle.style.color = "#ff5252";
    modalText.innerText = "Tất cả các đội đã Tử Trận!\nKhông ai sống sót qua Đấu Trường Sinh Tồn.";
    
    modal.classList.remove('hidden');
}

function showVictory() {
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');

    let aliveTeams = teams.filter(t => t.hp > 0);
    let mvp = [...aliveTeams].sort((a,b) => b.score - a.score)[0];

    modalTitle.innerText = "SINH TỒN THÀNH CÔNG!";
    modalTitle.style.color = "#ffd700";
    modalText.innerHTML = `Chúc mừng các đội sống sót!<br>🥇 MVP: <strong>${mvp.name}</strong> (${mvp.score} điểm)!`;
    
    modal.classList.remove('hidden');
}

// SOCKET LISTENERS
const urlParams = new URLSearchParams(window.location.search);
const roomPin = urlParams.get('room');
const teamsCount = parseInt(urlParams.get('teams') || 4);

if (!roomPin) {
    alert("CẢNH BÁO: Không tìm thấy Mã Phòng (PIN)! Vui lòng quay lại Trang Chủ để nhập mã phòng.");
}

if (roomPin) {
    let lastProcessedAction = null;
    
    // Hiển thị thông báo nhỏ báo đã kết nối trên màn hình
    let debugMsg = document.getElementById('debug-socket');
    if(!debugMsg) {
        debugMsg = document.createElement('div');
        debugMsg.id = 'debug-socket';
        debugMsg.style.cssText = 'position:fixed; top:10px; left:10px; background:green; color:white; padding:5px 10px; font-size:1.5rem; z-index:9999; border-radius:5px;';
        document.body.appendChild(debugMsg);
    }
    debugMsg.innerText = `Đã kết nối phòng: ${roomPin} (Firebase)`;

    db.ref('rooms/' + roomPin + '/actions').on('child_added', (snap) => {
        const data = snap.val();
        if (Date.now() - data.ts > 10000) return;
        if(data.ts === lastProcessedAction) return;
        lastProcessedAction = data.ts;
        
        const { action, payload } = data;
        console.log("Received action:", action, payload);
        
        if (action === 'select_team') {
            selectTeam(payload);
        } else if (action === 'set_answer') {
            setAnswer(payload.team, payload.answer);
        } else if (action === 'reveal') {
            revealAnswers();
        } else if (action === 'next_question') {
            nextQuestion();
        }
    });
}

window.onload = initGame;
