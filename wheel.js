const canvas = document.getElementById('wheel-canvas');
const ctx = canvas.getContext('2d');

let currentMode = 'student';
let items = [];
let colors = ['#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'];

let currentAngle = 0;
let isSpinning = false;
let spinTimeout = null;
let winningIndex = -1;

// Audio context
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (type === 'tick') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.1);
    } else if (type === 'win') {
        osc.type = 'square';
        [400, 500, 600, 800].forEach((freq, idx) => {
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime + idx*0.1);
        });
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.5);
    }
}

// Khởi tạo
function init() {
    // Sửa lỗi mờ nét trên màn hình retina
    const size = 500;
    canvas.width = size * 2;
    canvas.height = size * 2;
    ctx.scale(2, 2);

    loadData();
    drawWheel();
}

function setMode(mode) {
    currentMode = mode;
    document.getElementById('mode-student').className = mode === 'student' ? 'mode-btn active-mode px-4 py-2 rounded border-2 border-pink-500 text-pink-400' : 'mode-btn px-4 py-2 rounded border-2 border-transparent text-gray-400 hover:text-white';
    document.getElementById('mode-question').className = mode === 'question' ? 'mode-btn active-mode px-4 py-2 rounded border-2 border-pink-500 text-pink-400' : 'mode-btn px-4 py-2 rounded border-2 border-transparent text-gray-400 hover:text-white';
    
    document.getElementById('input-label').innerText = mode === 'student' ? 'Nhập danh sách học sinh (mỗi dòng 1 tên):' : 'Nhập danh sách câu hỏi (mỗi dòng 1 câu):';
    
    loadData();
    drawWheel();
}

function loadData() {
    const savedData = localStorage.getItem(`wheel_${currentMode}`);
    if (savedData) {
        document.getElementById('item-input').value = savedData;
        items = savedData.split('\n').filter(x => x.trim().length > 0);
    } else {
        document.getElementById('item-input').value = '';
        items = [];
    }
}

function updateWheel() {
    const text = document.getElementById('item-input').value;
    localStorage.setItem(`wheel_${currentMode}`, text);
    items = text.split('\n').filter(x => x.trim().length > 0);
    currentAngle = 0;
    drawWheel();
}

function clearList() {
    if(confirm('Bạn có chắc chắn muốn xóa toàn bộ danh sách?')) {
        document.getElementById('item-input').value = '';
        updateWheel();
    }
}

function drawWheel() {
    const size = 500;
    const center = size / 2;
    const radius = center - 10;
    
    ctx.clearRect(0, 0, size, size);

    if (items.length === 0) {
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '24px Montserrat';
        ctx.textAlign = 'center';
        ctx.fillText('CHƯA CÓ DỮ LIỆU', center, center);
        return;
    }

    const arc = 2 * Math.PI / items.length;

    for (let i = 0; i < items.length; i++) {
        const angle = currentAngle + i * arc;
        
        ctx.beginPath();
        ctx.fillStyle = colors[i % colors.length];
        ctx.moveTo(center, center);
        ctx.arc(center, center, radius, angle, angle + arc);
        ctx.lineTo(center, center);
        ctx.fill();
        ctx.save();

        // Stroke
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Text
        ctx.translate(center, center);
        ctx.rotate(angle + arc / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px Montserrat';
        
        // Cắt bớt chữ nếu quá dài
        let text = items[i];
        if (text.length > 20) text = text.substring(0, 17) + '...';
        
        ctx.fillText(text, radius - 30, 8);
        ctx.restore();
    }
}

let spinSpeed = 0;
let lastTickAngle = 0;

function spinWheel() {
    if (isSpinning || items.length === 0) return;
    
    isSpinning = true;
    const minSpins = 5;
    const maxSpins = 10;
    const spins = Math.floor(Math.random() * (maxSpins - minSpins + 1)) + minSpins;
    
    // Randomize the final angle slightly to land in the middle of a segment
    const targetAngle = currentAngle + (spins * 2 * Math.PI) + (Math.random() * 2 * Math.PI);
    spinSpeed = 0.5; // Tốc độ khởi đầu
    
    const arc = 2 * Math.PI / items.length;
    lastTickAngle = currentAngle;

    function animate() {
        if (spinSpeed > 0.002) {
            currentAngle += spinSpeed;
            spinSpeed *= 0.985; // Giảm tốc từ từ
            
            // Tính toán để phát tiếng tick mỗi khi đi qua 1 vạch
            if (currentAngle - lastTickAngle >= arc) {
                playSound('tick');
                lastTickAngle += arc;
            }
            
            drawWheel();
            requestAnimationFrame(animate);
        } else {
            // Dừng hẳn
            isSpinning = false;
            
            // Tính toán index trúng thưởng
            // Mũi tên nằm ở góc 270 độ (hay -PI/2)
            const arrowAngle = 3 * Math.PI / 2;
            let normalizedAngle = currentAngle % (2 * Math.PI);
            
            // Góc xoay của mỗi cung so với mũi tên
            let winningAngle = arrowAngle - normalizedAngle;
            if (winningAngle < 0) winningAngle += 2 * Math.PI;
            
            winningIndex = Math.floor(winningAngle / arc);
            
            // Đảm bảo index hợp lệ
            if (winningIndex >= items.length) winningIndex = 0;
            
            showResult(items[winningIndex]);
        }
    }
    
    animate();
}

function showResult(winner) {
    playSound('win');
    document.getElementById('result-text').innerText = winner;
    const modal = document.getElementById('result-modal');
    modal.classList.remove('hidden');
    
    setTimeout(() => {
        document.getElementById('result-box').classList.remove('scale-0');
        document.getElementById('result-box').classList.add('scale-100');
        
        // Pháo hoa
        var myCanvas = document.getElementById('confetti-canvas');
        var myConfetti = confetti.create(myCanvas, { resize: true, useWorker: true });
        myConfetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    }, 50);
}

function closeModal() {
    document.getElementById('result-box').classList.remove('scale-100');
    document.getElementById('result-box').classList.add('scale-0');
    setTimeout(() => {
        document.getElementById('result-modal').classList.add('hidden');
    }, 300);
}

function removeWinner() {
    if (winningIndex >= 0 && winningIndex < items.length) {
        items.splice(winningIndex, 1);
        document.getElementById('item-input').value = items.join('\n');
        localStorage.setItem(`wheel_${currentMode}`, document.getElementById('item-input').value);
        drawWheel();
    }
    closeModal();
}

// Khởi chạy
init();
