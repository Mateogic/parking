/**
 * 零点跃迁停车场 - 用户中心页面脚本
 */

document.addEventListener('DOMContentLoaded', function() {
    // 检查用户登录状态
    const storedUser = localStorage.getItem('parkingUser');
    const storedToken = localStorage.getItem('parkingToken');
    
    if (!storedUser || !storedToken) {
        // 未登录用户，重定向到登录页
        window.location.href = 'login.html';
        return;
    }
    
    // 获取DOM元素
    const profileNameEl = document.getElementById('profile-name');
    const profilePhoneEl = document.getElementById('profile-phone');
    const noReservationEl = document.getElementById('no-reservation');
    const activeReservationEl = document.getElementById('active-reservation');
    const reservedFloorEl = document.getElementById('reserved-floor');
    const reservedPositionEl = document.getElementById('reserved-position');
    const reservationTimeEl = document.getElementById('reservation-time');
    const timeRemainingEl = document.getElementById('time-remaining');
    const cancelReservationBtn = document.getElementById('cancel-reservation');
    const extendReservationBtn = document.getElementById('extend-reservation');
    
    // 显示用户信息
    const currentUser = JSON.parse(storedUser);
    profileNameEl.textContent = currentUser.name;
    profilePhoneEl.textContent = currentUser.phone;
    
    // 加载预约信息
    loadReservation();
    
    // 取消预约按钮事件
    cancelReservationBtn.addEventListener('click', function() {
        if (confirm('确定要取消当前预约吗？')) {
            cancelReservation();
        }
    });
    
    // 延长预约按钮事件
    extendReservationBtn.addEventListener('click', function() {
        extendReservation();
    });
    
    // 加载预约信息
    function loadReservation() {
        // 从本地存储获取预约信息
        const storedReservation = localStorage.getItem('parkingReservation');
        
        if (storedReservation) {
            // 有预约信息，显示预约详情
            const reservation = JSON.parse(storedReservation);
            showReservationDetails(reservation);
            
            // 启动倒计时
            startReservationTimer(reservation);
        } else {
            // 无预约信息，显示空状态
            noReservationEl.style.display = 'block';
            activeReservationEl.style.display = 'none';
        }
    }
    
    // 显示预约详情
    function showReservationDetails(reservation) {
        noReservationEl.style.display = 'none';
        activeReservationEl.style.display = 'block';
        
        // 显示楼层（将b改为大写B）
        const floorDisplay = reservation.floor.replace('b', 'B');
        reservedFloorEl.textContent = floorDisplay;
        
        // 显示车位号
        reservedPositionEl.textContent = reservation.position;
        
        // 显示预约时间
        const reservationTime = new Date(reservation.timestamp);
        reservationTimeEl.textContent = formatDateTime(reservationTime);
        
        // 更新剩余时间
        updateTimeRemaining(reservation);
    }
    
    // 启动预约倒计时
    let reservationTimerId = null;
    
    function startReservationTimer(reservation) {
        if (reservationTimerId) {
            clearInterval(reservationTimerId);
        }
        
        reservationTimerId = setInterval(() => {
            // 检查预约是否仍然有效
            const currentReservation = localStorage.getItem('parkingReservation');
            if (!currentReservation) {
                clearInterval(reservationTimerId);
                noReservationEl.style.display = 'block';
                activeReservationEl.style.display = 'none';
                return;
            }
            
            // 更新剩余时间
            updateTimeRemaining(JSON.parse(currentReservation));
        }, 1000);
    }
    
    // 更新剩余时间
    function updateTimeRemaining(reservation) {
        const now = new Date();
        const reservationTime = new Date(reservation.timestamp);
        const timeElapsed = now - reservationTime;
        const timeLimit = 10 * 60 * 1000; // 10分钟
        const timeRemaining = timeLimit - timeElapsed;
        
        if (timeRemaining <= 0) {
            // 预约已过期
            timeRemainingEl.textContent = '已过期';
            timeRemainingEl.className = 'countdown expired';
            
            // 自动取消预约
            setTimeout(() => {
                cancelReservation(true);
            }, 1000);
            return;
        }
        
        // 显示剩余时间
        const minutes = Math.floor(timeRemaining / 60000);
        const seconds = Math.floor((timeRemaining % 60000) / 1000);
        timeRemainingEl.textContent = `${minutes}分${seconds}秒`;
        
        // 更新样式
        if (timeRemaining < 60000) { // 小于1分钟
            timeRemainingEl.className = 'countdown critical';
        } else if (timeRemaining < 180000) { // 小于3分钟
            timeRemainingEl.className = 'countdown warning';
        } else {
            timeRemainingEl.className = 'countdown';
        }
    }
    
    // 取消预约
    function cancelReservation(isExpired = false) {
        // 获取当前预约
        const storedReservation = localStorage.getItem('parkingReservation');
        if (!storedReservation) return;
        
        const reservation = JSON.parse(storedReservation);
        
        // 清除预约
        localStorage.removeItem('parkingReservation');
        
        // 停止定时器
        if (reservationTimerId) {
            clearInterval(reservationTimerId);
            reservationTimerId = null;
        }
        
        // 更新UI
        noReservationEl.style.display = 'block';
        activeReservationEl.style.display = 'none';
        
        // 添加到历史记录（这里仅模拟）
        if (isExpired) {
            alert('您的预约已过期');
        } else {
            alert('预约已取消');
        }
    }
    
    // 延长预约时间
    function extendReservation() {
        // 获取当前预约
        const storedReservation = localStorage.getItem('parkingReservation');
        if (!storedReservation) return;
        
        const reservation = JSON.parse(storedReservation);
        
        // 将预约时间延长5分钟
        const currentTimestamp = new Date(reservation.timestamp);
        currentTimestamp.setMinutes(currentTimestamp.getMinutes() - 5); // 减少5分钟，相当于延长了剩余时间
        
        // 更新预约信息
        reservation.timestamp = currentTimestamp.toISOString();
        localStorage.setItem('parkingReservation', JSON.stringify(reservation));
        
        // 更新UI
        showReservationDetails(reservation);
        
        alert('预约已延长5分钟');
    }
    
    // 日期时间格式化
    function formatDateTime(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
}); 