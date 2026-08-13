function selectGame(gameId) {
    // Tạo âm thanh "beep" 8-bit đơn giản bằng Web Audio API
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    function playBeep() {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        // Sử dụng sóng vuông (square) để tạo âm thanh giống máy điện tử băng (NES)
        oscillator.type = 'square';
        
        if (gameId === 1) {
            oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); // Note A4
            oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
        } else {
            oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // Note C5
            oscillator.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.1);
        }
        
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
    }

    playBeep();

    // Lấy các phần tử của màn hình loading
    const loadingScreen = document.getElementById('loading-screen');
    const progressFill = document.querySelector('.progress-fill');
    const loadingText = document.getElementById('loading-text');
    
    // Hiển thị màn hình loading
    loadingScreen.classList.remove('hidden');
    loadingScreen.style.display = 'flex';
    // Đợi 1 chút để DOM cập nhật display flex trước khi đổi opacity mượt mà
    setTimeout(() => { loadingScreen.style.opacity = '1'; }, 10);
    
    if (gameId === 1) {
        loadingText.innerText = "ĐANG KHỞI TẠO MẬT MÃ HỌC ĐƯỜNG...";
    } else {
        loadingText.innerText = "ĐANG TẢI ĐẤU TRƯỜNG SINH TỒN...";
    }

    // Chạy thanh tiến trình giả lập
    let progress = 0;
    progressFill.style.width = '0%';
    
    const interval = setInterval(() => {
        // Tăng ngẫu nhiên từ 5% đến 20%
        progress += Math.floor(Math.random() * 15) + 5;
        
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            loadingText.innerText = "SẴN SÀNG!";
            
            // Đợi 1 giây sau khi load 100% rồi tắt (hoặc chuyển trang)
            setTimeout(() => {
                loadingScreen.style.opacity = '0';
                setTimeout(() => {
                    loadingScreen.style.display = 'none';
                    if (gameId === 1) {
                        window.location.href = "game1.html";
                    } else {
                        window.location.href = "game2.html";
                    }
                }, 500);
            }, 1000);
        }
        progressFill.style.width = progress + '%';
    }, 200);
}
