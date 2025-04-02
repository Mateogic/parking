/**
 * 零点跃迁停车场 - 用户认证与车位预约模块
 */

// 用户认证状态
let currentUser = null;
let currentReservation = null;
let reservationTimer = null;

// API路径
const API_BASE_URL = '/api';
const AUTH_API = `${API_BASE_URL}/auth`;
const RESERVATION_API = `${API_BASE_URL}/reservation`;

// 添加初始化函数
function initAuth() {
    console.log("初始化用户认证模块...");
    // 检查登录状态
    checkLoginStatus();
    
    // 绑定预约事件
    bindReservationEvents();
}

// 检查用户登录状态
function checkLoginStatus() {
    console.log("检查用户登录状态...");
    const storedUser = localStorage.getItem('parkingUser');
    const storedToken = localStorage.getItem('parkingToken');
    
    const notLoggedInEl = document.getElementById('not-logged-in');
    const loggedInEl = document.getElementById('logged-in');
    const usernameDisplayEl = document.getElementById('username-display');
    
    if (!notLoggedInEl || !loggedInEl) {
        console.log("页面上没有登录状态元素");
        return; // 页面上没有这些元素时直接返回
    }
    
    if (storedUser && storedToken) {
        // 用户已登录
        const user = JSON.parse(storedUser);
        console.log("用户已登录:", user.name);
        notLoggedInEl.style.display = 'none';
        loggedInEl.style.display = 'flex';
        usernameDisplayEl.textContent = user.name || '用户';
        
        // 恢复预约信息
        const storedReservation = localStorage.getItem('parkingReservation');
        if (storedReservation) {
            currentReservation = JSON.parse(storedReservation);
        }
    } else {
        // 用户未登录
        console.log("用户未登录");
        notLoggedInEl.style.display = 'block';
        loggedInEl.style.display = 'none';
    }
}

// 处理登录表单提交
function handleLogin(event) {
    event.preventDefault();
    
    const form = event.target;
    const phone = form.querySelector('input[name="phone"]').value;
    const password = form.querySelector('input[name="password"]').value;
    
    if (!phone || !password) {
        showError(form, '请填写手机号和密码');
        return;
    }
    
    // 模拟登录请求
    setTimeout(() => {
        // 从本地存储或注册信息中验证用户
        const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        const user = registeredUsers.find(u => u.phone === phone);
        
        if (user && user.password === password) {
            // 登录成功
            const token = generateToken();
            localStorage.setItem('parkingUser', JSON.stringify(user));
            localStorage.setItem('parkingToken', token);
            
            if (window.location.pathname.includes('login.html')) {
                window.location.href = 'index.html';
            } else {
                checkLoginStatus();
            }
        } else {
            showError(form, '手机号或密码错误');
        }
    }, 500);
}

// 处理注册表单提交
function handleRegister(event) {
    event.preventDefault();
    console.log("处理注册表单提交");
    
    const form = event.target;
    const name = form.querySelector('input[name="name"]').value;
    const phone = form.querySelector('input[name="phone"]').value;
    const password = form.querySelector('input[name="password"]').value;
    const confirmPassword = form.querySelector('input[name="confirm-password"]').value;
    
    console.log("注册信息:", name, phone, password.length);
    
    if (!name || !phone || !password) {
        showError(form, '请填写所有必填字段');
        return;
    }
    
    if (password !== confirmPassword) {
        showError(form, '两次输入的密码不一致');
        return;
    }
    
    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
        showError(form, '请输入有效的手机号码');
        return;
    }
    
    // 模拟注册请求
    setTimeout(() => {
        // 检查手机号是否已注册
        console.log("准备检查手机号是否已注册");
        const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        console.log("已注册用户数:", registeredUsers.length);
        
        if (registeredUsers.some(user => user.phone === phone)) {
            showError(form, '该手机号已被注册');
            return;
        }
        
        // 注册新用户
        const newUser = { name, phone, password, registerTime: new Date().toISOString() };
        registeredUsers.push(newUser);
        localStorage.setItem('registeredUsers', JSON.stringify(registeredUsers));
        console.log("用户注册成功:", newUser);
        
        // 自动登录新用户
        const token = generateToken();
        localStorage.setItem('parkingUser', JSON.stringify(newUser));
        localStorage.setItem('parkingToken', token);
        console.log("自动登录成功");
        
        if (window.location.pathname.includes('login.html')) {
            window.location.href = 'index.html';
        } else {
            checkLoginStatus();
        }
    }, 500);
}

// 处理退出登录
function handleLogout() {
    console.log("用户退出登录");
    localStorage.removeItem('parkingUser');
    localStorage.removeItem('parkingToken');
    localStorage.removeItem('parkingReservation');
    checkLoginStatus();
    
    // 如果在主页，刷新当前楼层以更新UI
    if (typeof fetchParkingData === 'function' && typeof currentFloor !== 'undefined') {
        fetchParkingData(currentFloor);
    } else {
        // 如果在其他页面，刷新页面
        window.location.reload();
    }
}

// 显示用户信息
function showUserInfo() {
    const notLoggedInSection = document.getElementById('not-logged-in');
    const loggedInSection = document.getElementById('logged-in');
    const usernameDisplay = document.getElementById('username-display');
    
    if (!notLoggedInSection || !loggedInSection || !usernameDisplay) return;
    
    notLoggedInSection.style.display = 'none';
    loggedInSection.style.display = 'block';
    usernameDisplay.textContent = currentUser?.name || '用户';
}

// 显示登录按钮
function showLoginButton() {
    const notLoggedInSection = document.getElementById('not-logged-in');
    const loggedInSection = document.getElementById('logged-in');
    
    if (!notLoggedInSection || !loggedInSection) return;
    
    notLoggedInSection.style.display = 'block';
    loggedInSection.style.display = 'none';
}

// 开始预约计时器
function startReservationTimer() {
    if (reservationTimer) {
        clearInterval(reservationTimer);
    }
    
    reservationTimer = setInterval(() => {
        if (!currentReservation) {
            clearInterval(reservationTimer);
            return;
        }
        
        updateTimeRemaining();
        
        // 检查预约是否过期
        const now = new Date();
        const reservationTime = new Date(currentReservation.timestamp);
        const timeElapsed = now - reservationTime;
        const timeLimit = 10 * 60 * 1000; // 10分钟，单位毫秒
        
        if (timeElapsed >= timeLimit) {
            clearInterval(reservationTimer);
            cancelReservation();
            alert('您的预约已过期');
        }
    }, 1000);
}

// 更新剩余时间显示
function updateTimeRemaining() {
    if (!currentReservation) return;
    
    const timeRemainingSpan = document.getElementById('time-remaining');
    if (!timeRemainingSpan) return;
    
    const now = new Date();
    const reservationTime = new Date(currentReservation.timestamp);
    const timeElapsed = now - reservationTime;
    const timeLimit = 10 * 60 * 1000; // 10分钟
    const timeRemaining = timeLimit - timeElapsed;
    
    if (timeRemaining <= 0) {
        timeRemainingSpan.textContent = '已过期';
        return;
    }
    
    const minutes = Math.floor(timeRemaining / 60000);
    const seconds = Math.floor((timeRemaining % 60000) / 1000);
    timeRemainingSpan.textContent = `${minutes}分${seconds}秒`;
}

// 取消预约
async function cancelReservation() {
    if (!currentReservation) return;
    
    try {
        // 直接从本地存储中删除预约
        localStorage.removeItem('parkingReservation');
        
        // 清除预约状态
        const oldFloor = currentReservation.floor;
        currentReservation = null;
        clearInterval(reservationTimer);
        
        // 更新UI
        // 如果当前显示的是相同楼层，刷新数据
        if (typeof currentFloor !== 'undefined' && currentFloor === oldFloor) {
            if (typeof fetchParkingData === 'function') {
                fetchParkingData(currentFloor);
            }
        }
    } catch (error) {
        console.error('取消预约失败:', error);
        alert('取消预约失败，请稍后再试');
    }
}

// 绑定预约事件
function bindReservationEvents() {
    const parkingGrid = document.getElementById('parking-grid');
    if (!parkingGrid) return;
    
    parkingGrid.addEventListener('click', function(event) {
        const slotElement = event.target.closest('.parking-slot');
        if (!slotElement) return;
        
        // 检查车位状态
        if (slotElement.classList.contains('free')) {
            tryReserveSlot(slotElement);
        } else if (slotElement.classList.contains('reserved')) {
            showReservationInfo(slotElement);
        }
    });
}

// 尝试预约车位
function tryReserveSlot(slotElement) {
    // 检查用户是否登录
    const storedUser = localStorage.getItem('parkingUser');
    const storedToken = localStorage.getItem('parkingToken');
    
    if (!storedUser || !storedToken) {
        alert('请先登录后再预约车位');
        return;
    }
    
    // 检查用户是否已有预约
    const existingReservation = localStorage.getItem('parkingReservation');
    if (existingReservation) {
        alert('您已经有一个预约，请先取消当前预约再预约新车位');
        return;
    }
    
    // 获取车位信息
    const floor = currentFloor; // 使用全局当前楼层
    const position = slotElement.textContent.trim();
    
    // 确认预约
    if (confirm(`确定要预约${floor}层 ${position}号车位吗？\n预约后请在10分钟内到达，否则预约将自动取消。`)) {
        // 创建预约
        const reservation = {
            floor,
            position,
            timestamp: new Date().toISOString(),
            userId: JSON.parse(storedUser).phone
        };
        
        // 保存预约
        localStorage.setItem('parkingReservation', JSON.stringify(reservation));
        
        // 更新UI显示
        slotElement.classList.remove('free');
        slotElement.classList.add('reserved');
        
        // 更新统计数据
        updateStats();
        
        alert('预约成功！请在10分钟内到达。');
    }
}

// 显示预约信息
function showReservationInfo(slotElement) {
    const storedReservation = localStorage.getItem('parkingReservation');
    if (!storedReservation) return;
    
    const reservation = JSON.parse(storedReservation);
    const reservationTime = new Date(reservation.timestamp);
    const now = new Date();
    const timeElapsed = Math.floor((now - reservationTime) / 1000 / 60); // 分钟
    const timeRemaining = 10 - timeElapsed;
    
    if (timeRemaining > 0) {
        alert(`该车位已被预约\n预约时间：${formatTime(reservationTime)}\n剩余时间：${timeRemaining}分钟`);
    } else {
        alert('该车位预约已过期，即将释放');
        cancelReservation();
    }
}

// 更新统计数据
function updateStats() {
    const freeEl = document.getElementById('free-slots');
    const occupiedEl = document.getElementById('occupied-slots');
    const reservedEl = document.getElementById('reserved-slots');
    
    if (!freeEl || !occupiedEl || !reservedEl) return;
    
    const freeSlots = document.querySelectorAll('.parking-slot.free').length;
    const occupiedSlots = document.querySelectorAll('.parking-slot.occupied').length;
    const reservedSlots = document.querySelectorAll('.parking-slot.reserved').length;
    
    freeEl.textContent = freeSlots;
    occupiedEl.textContent = occupiedSlots;
    reservedEl.textContent = reservedSlots;
}

// 生成随机token
function generateToken() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// 显示错误信息
function showError(form, message) {
    console.log("显示错误信息:", message);
    // 查找或创建消息元素
    let messageEl = form.querySelector('.error-message');
    if (!messageEl) {
        messageEl = document.createElement('div');
        messageEl.className = 'error-message';
        form.appendChild(messageEl);
    }
    
    // 设置消息内容和样式
    messageEl.textContent = message;
    messageEl.style.color = '#e74c3c';
    messageEl.style.marginTop = '10px';
    messageEl.style.fontSize = '14px';
    
    // 自动清除消息
    setTimeout(() => {
        messageEl.textContent = '';
    }, 5000);
}

// 格式化时间
function formatTime(date) {
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// 在页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM加载完成，初始化用户认证模块");
    // 初始化用户认证模块
    initAuth();
}); 