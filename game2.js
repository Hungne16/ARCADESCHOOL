// Cấu hình trò chơi
let questions = []; // Dữ liệu sẽ được nạp từ Firebase

let currentQuestion = 0;
let teams = [];

// Khởi tạo các đội
const urlParams = new URLSearchParams(window.location.search);
const teamsCount = parseInt(urlParams.get('teams') || 6);

for(let i=1; i<=teamsCount; i++) {
    teams.push({ id: i, name: `ĐỘI ${i}`, hp: 3, maxHp: 3, score: 0 });
}

let teamAnswers = {};
teams.forEach(t => teamAnswers[t.id] = null);

let timeLeft = 30;
let timerInterval = null;

// DOM Elements
const qText = document.getElementById('question-text');
const qCounter = document.getElementById('question-counter');
const modal = document.getElementById('modal');
const timerText = document.getElementById('timer-text');
const answerInput = document.getElementById('answer-input');
const btnSubmit = document.getElementById('btn-submit');

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

function startTimer() {
    clearInterval(timerInterval);
    timeLeft = 30;
    timerText.innerText = timeLeft;
    
    timerInterval = setInterval(() => {
        timeLeft--;
        timerText.innerText = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            // Hết giờ logic
            timerText.innerText = "0";
            timerText.classList.add('text-red-500');
        }
    }, 1000);
}

function renderTeams() {
    const teamsRight = document.getElementById('teams-right');
    if(teamsRight) teamsRight.innerHTML = '';

    teams.forEach((t, index) => {
        let heartsHTML = '';
        for(let i = 0; i < t.maxHp; i++) {
            heartsHTML += `<span class="heart ${i >= t.hp ? 'lost grayscale opacity-40' : ''}">❤️</span>`;
        }

        const colorClass = `bg-team-${t.id}`;
        
        const cardHTML = `
            <div class="team-card mini-card flex flex-col h-auto bg-white border-4 border-black rounded-xl overflow-hidden shadow-pixel mb-2" id="card-team-${t.id}">
                <div class="team-header ${colorClass} text-white text-center text-lg py-1 border-b-4 border-black font-bold text-shadow-pixel leading-none">${t.name}</div>
                <div class="team-body flex flex-row items-center p-1 justify-around relative">
                    <div class="relative">
                        <img class="h-10 object-contain drop-shadow-md transform origin-bottom" src="character/${t.id}.png" onerror="this.src='https://api.dicebear.com/7.x/pixel-art/svg?seed=${t.id}'" alt="Avatar">
                        <div class="absolute -top-4 left-1/2 transform -translate-x-1/2 text-2xl hidden z-50 drop-shadow-md" id="feedback-${t.id}"></div>
                    </div>
                    <div class="team-stats bg-blue-50 border-2 border-blue-200 rounded px-1 py-0.5 flex flex-col items-center">
                        <div class="hearts text-xs whitespace-nowrap" style="letter-spacing:-2px;">${heartsHTML}</div>
                        <div class="team-score text-sm font-bold mt-1">🪙 ${t.score}</div>
                    </div>
                </div>
            </div>
        `;
        
        if(teamsRight) teamsRight.innerHTML += cardHTML;
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
    if(qCounter) qCounter.innerText = `📋 Câu: ${currentQuestion + 1}/${questions.length}`;
    if(qText) {
        let imgHtml = q.image ? `<br><img src="${q.image}" class="puzzle-img mx-auto max-h-64 mt-4 border-4 border-white shadow-pixel rounded-lg">` : '';
        qText.innerHTML = q.q + imgHtml;
    }
    
    if(answerInput) {
        answerInput.value = '';
        answerInput.disabled = false;
        answerInput.focus();
    }
    if(btnSubmit) btnSubmit.disabled = false;
    
    timerText.classList.remove('text-red-500');
    startTimer();

    // Reset UI các đội
    teams.forEach(t => {
        teamAnswers[t.id] = t.hp <= 0 ? "DEAD" : null;
        const card = document.getElementById(`card-team-${t.id}`);
        if(card) {
            card.classList.remove('selected', 'spring-bounce', 'shake');
            const feedback = document.getElementById(`feedback-${t.id}`);
            if(feedback) feedback.classList.add('hidden');
        }
    });
}

// Giả lập chọn đội khi click vào input
if(btnSubmit && answerInput) {
    btnSubmit.addEventListener('click', () => {
        const val = answerInput.value.trim();
        if(val) {
            playSound('lock');
            answerInput.disabled = true;
            btnSubmit.disabled = true;
            
            // For standalone testing without firebase: Check answer immediately for Team 1
            setTimeout(() => {
                revealAnswers(val);
            }, 1000);
        }
    });
}

function selectTeam(id) {
    teams.forEach(t => {
        const card = document.getElementById(`card-team-${t.id}`);
        if (card && t.hp > 0) {
            card.classList.remove('selected');
        }
    });
    const activeCard = document.getElementById(`card-team-${id}`);
    if(activeCard) {
        activeCard.classList.add('selected');
    }
}

function setAnswer(teamId, answer) {
    playSound('lock');
    teamAnswers[teamId] = answer;
    // Giao diện có thể update để báo đội đã chốt
}

// CÔNG BỐ KẾT QUẢ
function revealAnswers(playerAnswerStr) {
    clearInterval(timerInterval);
    const q = questions[currentQuestion];
    const correctAns = q.correct.toString().toLowerCase();
    
    let wrongCount = 0;
    let correctCount = 0;

    // Standalone logic: check the typed answer for team 1 just for demo
    if(playerAnswerStr) {
        teamAnswers[1] = playerAnswerStr;
    }

    teams.forEach(t => {
        if (t.hp <= 0) return;
        if (!teamAnswers[t.id]) return; // Chưa trả lời
        
        const feedbackIcon = document.getElementById(`feedback-${t.id}`);
        const cardUI = document.getElementById(`card-team-${t.id}`);

        if (teamAnswers[t.id].toString().toLowerCase() === correctAns) {
            t.score += 100;
            correctCount++;
            if (cardUI) cardUI.classList.add('spring-bounce');
            if (feedbackIcon) {
                feedbackIcon.innerText = '✔️';
                feedbackIcon.classList.remove('hidden');
                feedbackIcon.classList.add('text-green-500', 'spring-bounce');
            }
        } else {
            t.hp--;
            wrongCount++;
            if (cardUI) {
                cardUI.classList.remove('shake');
                void cardUI.offsetWidth;
                cardUI.classList.add('shake');
            }
            if (feedbackIcon) {
                feedbackIcon.innerText = '❌';
                feedbackIcon.classList.remove('hidden');
                feedbackIcon.classList.add('text-red-500', 'spring-bounce');
            }
        }
    });

    setTimeout(() => {
        renderTeams();
    }, 1000);

    if (wrongCount > 0) {
        playSound('wrong');
        document.body.classList.remove('flash-red');
        void document.body.offsetWidth;
        document.body.classList.add('flash-red');
    } else if (correctCount > 0) {
        playSound('correct');
    }

    setTimeout(() => {
        if (teams.every(t => t.hp <= 0)) {
            gameOver();
        } else {
            showResultModal(correctCount, q.correct);
        }
    }, 2500);
}

function showResultModal(correctCount, correctAns) {
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');
    
    modalTitle.innerText = "KẾT QUẢ!";
    modalTitle.className = "text-6xl mb-4 text-green-600 font-bold";
    modalText.innerHTML = `Đáp án đúng là <strong class="text-blue-600">${correctAns}</strong>!<br>Có ${correctCount} đội trả lời đúng.`;
    
    modal.classList.remove('hidden');
}

function nextQuestion() {
    modal.classList.add('hidden');
    currentQuestion++;
    loadQuestion();
}

function transitionToRanking() {
    db.ref(`rooms/${roomPin}/rankings`).set(teams).then(() => {
        setTimeout(() => {
            window.location.href = 'ranking.html?room=' + roomPin;
        }, 5000);
    });
}

function gameOver() {
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');
    
    modalTitle.innerText = "THẢM HỌA!";
    modalTitle.className = "text-6xl mb-4 text-red-600 font-bold";
    modalText.innerText = "Tất cả các đội đã Tử Trận!\nKhông ai sống sót qua Đấu Trường Sinh Tồn.";
    
    modal.classList.remove('hidden');
    transitionToRanking();
}

function showVictory() {
    const modalTitle = document.getElementById('modal-title');
    const modalText = document.getElementById('modal-text');

    let aliveTeams = teams.filter(t => t.hp > 0);
    let mvp = [...aliveTeams].sort((a,b) => b.score - a.score)[0];

    modalTitle.innerText = "SINH TỒN THÀNH CÔNG!";
    modalTitle.className = "text-6xl mb-4 text-yellow-500 font-bold";
    modalText.innerHTML = `Chúc mừng các đội sống sót!<br>🥇 MVP: <strong>${mvp.name}</strong> (${mvp.score} điểm)!`;
    
    modal.classList.remove('hidden');
    transitionToRanking();
}

// SOCKET LISTENERS (Bảo lưu logic Firebase cũ nếu dùng Multiplayer)
const roomPin = urlParams.get('room');

if (roomPin && typeof db !== 'undefined') {
    let lastProcessedAction = null;
    
    let debugMsg = document.getElementById('debug-socket');
    if(!debugMsg) {
        debugMsg = document.createElement('div');
        debugMsg.id = 'debug-socket';
        debugMsg.style.cssText = 'position:fixed; top:60px; left:10px; background:green; color:white; padding:5px 10px; font-size:1.5rem; z-index:9999; border-radius:5px; font-family:"VT323"';
        document.body.appendChild(debugMsg);
    }
    debugMsg.innerText = `Phòng: ${roomPin} (Connected)`;

    db.ref('rooms/' + roomPin + '/actions').on('child_added', (snap) => {
        const data = snap.val();
        if (Date.now() - data.ts > 10000) return;
        if(data.ts === lastProcessedAction) return;
        lastProcessedAction = data.ts;
        
        const { action, payload } = data;
        
        if (action === 'select_team') {
            selectTeam(payload);
        } else if (action === 'set_answer') {
            setAnswer(payload.team, payload.answer);
        } else if (action === 'reveal') {
            // Teacher calls reveal
            revealAnswers();
        } else if (action === 'next_question') {
            nextQuestion();
        }
    });
}

window.onload = () => {
    if (roomPin) {
        document.getElementById('question-text').innerHTML = '<h2 class="text-white text-center">ĐANG TẢI DỮ LIỆU CÂU HỎI...</h2>';
        db.ref(`rooms/${roomPin}/questions`).once('value').then(snap => {
            const data = snap.val();
            if (data && data.length > 0) {
                questions = data.map(q => {
                    let optsHtml = '<div class="grid grid-cols-2 gap-4 mt-6 text-2xl text-left">';
                    ['A','B','C','D','E','F'].forEach(k => {
                        if (q.opts && q.opts[k]) {
                            optsHtml += `<div class="bg-blue-100 p-2 rounded border-2 border-blue-400 text-black shadow"><strong>${k}.</strong> ${q.opts[k]}</div>`;
                        }
                    });
                    optsHtml += '</div>';

                    return {
                        q: `<span class="text-3xl font-bold">${q.q}</span>` + optsHtml,
                        correct: (q.correct || "").toLowerCase()
                    };
                });
                initGame();
            } else {
                alert("Phòng này không có dữ liệu câu hỏi!");
            }
        });
    } else {
        alert("Vui lòng tham gia qua mã PIN (VD: ?room=1234)");
    }
};
