const urlParams = new URLSearchParams(window.location.search);
const roomPin = urlParams.get('room');
const teamsCount = parseInt(urlParams.get('teams') || 4);

let stages = [];
let currentStage = 0;
let teams = [];
const MAX_STEPS = 5; // Độ dài đường đua mặc định

for(let i=1; i<=teamsCount; i++) {
    teams.push({ id: i, name: `Đội ${i}`, score: 0 });
}

// DOM Elements
const puzzleContainer = document.getElementById('puzzle-container');
const tracksContainer = document.getElementById('tracks-container');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const modalText = document.getElementById('modal-text');

// Audio (8-bit sounds)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (type === 'correct') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.setValueAtTime(600, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.3);
    } else if (type === 'win') {
        osc.type = 'square';
        [300, 400, 500, 600, 800].forEach((freq, idx) => {
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime + idx*0.1);
        });
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.8);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.8);
    }
}

if(roomPin) {
    let lastProcessedAction = null;
    db.ref('rooms/' + roomPin + '/actions').on('child_added', (snap) => {
        const data = snap.val();
        if (Date.now() - data.ts > 10000) return;
        if(data.ts === lastProcessedAction) return;
        lastProcessedAction = data.ts;
        
        const { action, payload } = data;
        if (action === 'g3_score') {
            updateScore(payload.teamId, payload.amount);
        } else if (action === 'g3_next') {
            nextStage();
        }
    });

    db.ref('rooms/' + roomPin).once('value').then(snap => {
        const roomData = snap.val();
        if(roomData && roomData.host && roomData.setId) {
            db.ref(`users/${roomData.host}/sets/${roomData.setId}/questions`).once('value').then(qSnap => {
                stages = qSnap.val() || [];
                if(stages.length === 0) {
                    alert("Bộ câu hỏi trống!");
                }
                renderStage();
                renderTracks();
            });
        }
    });
}

function updateScore(teamId, amount) {
    const t = teams.find(x => x.id === teamId);
    if(t) {
        t.score += amount;
        if(t.score < 0) t.score = 0;
        
        if (amount > 0) playSound('correct');
        else playSound('wrong');
        
        renderTracks();
        
        // Hiệu ứng nhấp nháy cho đường đua
        const trackEl = document.getElementById(`track-${teamId}`);
        if(trackEl) {
            trackEl.style.borderColor = amount > 0 ? '#00e676' : '#e53935';
            setTimeout(() => {
                if(trackEl) trackEl.style.borderColor = '#666';
            }, 500);
        }

        if(t.score >= MAX_STEPS) {
            playSound('win');
            modalTitle.innerText = "CHIẾN THẮNG!";
            modalTitle.style.color = "#00e676";
            modalText.innerText = `Chúc mừng ${t.name} đã về đích đầu tiên!`;
            modal.classList.remove('hidden');
        }
    }
}

function renderTracks() {
    if(!tracksContainer) return;
    let html = '';
    
    // Icon xe đua
    const icons = ['🚗', '🚀', '🚁', '🚤', '🛸', '🚂'];
    
    teams.forEach(t => {
        const icon = icons[(t.id - 1) % icons.length];
        const progressPercent = Math.min((t.score / MAX_STEPS) * 100, 100);
        
        html += `
        <div class="track" id="track-${t.id}">
            <span class="team-name">${t.name}</span>
            <div class="progress-bar">
                <div class="racer" id="racer-${t.id}" style="left: ${progressPercent}%; transform: translateX(-${progressPercent}%); display:flex; align-items:center; justify-content:center; font-size: 2.5rem; filter: drop-shadow(2px 2px 0px #000);">
                    ${icon}
                </div>
            </div>
            <span class="score">${t.score}/${MAX_STEPS}</span>
        </div>
        `;
    });
    tracksContainer.innerHTML = html;
}

function renderStage() {
    if (currentStage >= stages.length) {
        modalTitle.innerText = "HOÀN THÀNH!";
        modalTitle.style.color = "#ffca28";
        modalText.innerText = "Đã hết bộ câu hỏi!";
        modal.classList.remove('hidden');
        playSound('win');
        return;
    }

    const stage = stages[currentStage];
    let imgHtml = stage.image ? `<img src="${stage.image}" style="max-height: 100%; max-width: 100%; object-fit: contain; border: 4px solid #fff; border-radius: 8px; box-shadow: 4px 4px 0px rgba(0,0,0,0.1);">` : '';

    puzzleContainer.innerHTML = `
        <div style="display: flex; flex-direction: column; width: 100%; height: 100%; gap: 10px;">
            ${stage.image ? `<div style="flex: 1; min-height: 0; display: flex; justify-content: center; align-items: center; overflow: hidden; padding-top: 5px;">${imgHtml}</div>` : ''}
            
            <div style="flex-shrink: 0; background-color: #f5f5f5; padding: 10px 15px; border-radius: 10px; border: 3px dashed #ccc; display: flex; flex-direction: column; align-items: center; justify-content: center; width: 95%; margin: 0 auto;">
                <div style="display: flex; align-items: baseline; justify-content: center; gap: 10px; margin-bottom: 5px; flex-wrap: wrap;">
                    <h2 style="margin: 0; font-size: 2.5rem; color: #ff5252; text-shadow: 1px 1px 0px rgba(0,0,0,0.1); font-weight: bold;">Câu ${currentStage + 1}: ${stage.title ? stage.title : ''}</h2>
                    <span style="font-size: 2rem; color: #222; margin: 0; line-height: 1.3;">${stage.desc}</span>
                </div>
            </div>
        </div>
    `;
    
    // Reset answers UI
    ['a', 'b', 'c', 'd', 'e', 'f'].forEach(l => {
        const textEl = document.getElementById(`text-${l}`);
        const cardEl = document.getElementById(`ans-${l}`);
        if(textEl && stage.options && stage.options[l]) {
            textEl.innerText = stage.options[l];
            if(cardEl) {
                cardEl.style.display = 'flex';
                cardEl.className = 'answer-card';
            }
        } else if (cardEl) {
            cardEl.style.display = 'none';
        }
    });
}

function nextStage() {
    currentStage++;
    renderStage();
}
