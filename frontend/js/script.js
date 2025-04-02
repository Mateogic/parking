// 变量定义
let currentFloor = 'B1'; // 当前显示的楼层
const API_BASE_URL = '/frontend/api'; // 使用正确的API路径
window.API_BASE_URL = API_BASE_URL;
window.currentFloor = currentFloor;

// 存储每层楼的行列数信息
const floorConfig = {
    b1: { rows: 0, columns: 0 },
    b2: { rows: 0, columns: 0 },
    b3: { rows: 0, columns: 0 }
};

// 将数字ID转换为行列格式
function convertToRowCol(slotNumber, floor) {
    // 确保floorKey是小写，而不改变原始floor参数
    const floorKey = floor.toLowerCase();
    
    // 获取当前楼层的列数
    let columns = floorConfig[floorKey] ? floorConfig[floorKey].columns : 0;
    
    // 如果没有配置信息，尝试从localStorage获取
    if (!columns || columns <= 0) {
        const savedConfig = localStorage.getItem('parkingFloorConfig');
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                if (config[floorKey] && config[floorKey].columns > 0) {
                    columns = config[floorKey].columns;
                }
            } catch (e) {
                console.error('解析楼层配置失败:', e);
            }
        }
    }
    
    // 如果仍然没有列数信息，使用默认值5
    if (!columns || columns <= 0) {
        columns = 5;
        console.warn(`找不到${floor}层的列数配置，使用默认值5`);
    }
    
    // 计算行列
    const slotNum = parseInt(slotNumber);
    const row = Math.ceil(slotNum / columns);
    const col = slotNum % columns || columns;
    
    return `${row}-${col}`;
}

// 只保留缓存检测功能
(function() {
    // 尝试从localStorage获取版本号
    const storedVersion = localStorage.getItem('appVersion');
    const currentVersion = '1.0.3'; // 每次更新代码时增加此版本号
    
    // 如果版本不同，清除缓存并刷新
    if (storedVersion !== currentVersion) {
        // 存储新版本号
        localStorage.setItem('appVersion', currentVersion);
        
        // 清除缓存
        if ('caches' in window) {
            caches.keys().then(function(names) {
                names.forEach(function(name) {
                    caches.delete(name);
                });
            });
        }
        
        // 如果不是首次加载，则刷新页面
        if (storedVersion) {
            window.location.reload(true);
        }
    }
    
    console.log('应用版本:', currentVersion);
})();

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM加载完成，开始初始化页面...');
    
    // 检查用户登录状态
    checkLoginStatus();
    
    // 加载初始楼层数据
    console.log(`加载初始楼层数据: ${currentFloor}`);
    fetchParkingData(currentFloor);
    
    // 设置楼层切换事件 - 修复按钮选择器，同时支持两种可能的类名
    let floorButtons = document.querySelectorAll('.floor-button');
    if (floorButtons.length === 0) {
        // 如果没有找到floor-button类的元素，尝试找floor-btn类的元素
        floorButtons = document.querySelectorAll('.floor-btn');
    }
    
    console.log(`找到楼层按钮数量: ${floorButtons.length}`);
    
    if (floorButtons.length === 0) {
        // 如果仍然找不到按钮，尝试创建按钮
        console.log('未找到楼层按钮元素，尝试基于图片检查HTML结构');
        
        // 尝试基于图片中看到的元素结构直接查找按钮
        const buttonsInImage = document.querySelectorAll('button[data-floor]');
        console.log(`找到具有data-floor属性的按钮数量: ${buttonsInImage.length}`);
        
        if (buttonsInImage.length > 0) {
            floorButtons = buttonsInImage;
        }
    }
    
    // 确保每个按钮都绑定事件
    floorButtons.forEach((button, index) => {
        console.log(`按钮 ${index+1} 楼层: ${button.dataset.floor}, 类名: ${button.className}`);
        
        // 移除先前可能绑定的事件，确保不会重复绑定
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);
        
        // 为新按钮添加点击事件
        newButton.addEventListener('click', function(event) {
            event.preventDefault(); // 阻止默认行为
            event.stopPropagation(); // 停止事件冒泡
            
            console.log(`楼层按钮被点击: ${this.dataset.floor}`);
            const floor = this.dataset.floor;
            
            // 可视化反馈 - 短暂改变按钮颜色
            this.style.transition = 'background-color 0.3s';
            const originalColor = this.style.backgroundColor;
            this.style.backgroundColor = '#27ae60';
            
            setTimeout(() => {
                this.style.backgroundColor = originalColor;
            }, 300);
            
            currentFloor = floor;
            
            // 更新按钮状态
            floorButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // 获取并显示选中楼层的数据
            console.log(`开始请求楼层 ${floor} 数据...`);
            fetchParkingData(floor);
            
            return false; // 阻止默认行为和冒泡
        });
    });
    
    // 设置定时刷新 (每60秒)
    setInterval(() => {
        console.log(`定时刷新: 获取楼层 ${currentFloor} 数据`);
        fetchParkingData(currentFloor);
    }, 60000);
});

// 获取停车场数据
async function fetchParkingData(floor = 'B1') {
    try {
        // 使用全局API基础URL或默认值
        const baseUrl = window.API_BASE_URL || '/frontend/api';
        
        // 构建API URL
        const apiUrl = `${baseUrl}/parking_status.php?floor=${floor}`;
        
        // 添加时间戳防止缓存
        const timestamp = new Date().getTime();
        const noCacheUrl = `${apiUrl}&nocache=${timestamp}`;
        
        const response = await fetch(noCacheUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP 错误! 状态: ${response.status}`);
        }
        
        // 解析JSON响应
        const data = await response.json();
        
        // 保存楼层配置信息
        if (data.rows && data.columns) {
            const floorKey = data.floor.toLowerCase();
            floorConfig[floorKey] = {
                rows: data.rows,
                columns: data.columns
            };
            
            // 同时保存到localStorage中以便在不同页面间共享
            const savedConfig = localStorage.getItem('parkingFloorConfig');
            let config = {};
            try {
                config = savedConfig ? JSON.parse(savedConfig) : {};
            } catch(e) {
                console.error('解析已保存的楼层配置失败:', e);
                config = {};
            }
            
            config[floorKey] = {
                rows: data.rows,
                columns: data.columns
            };
            
            localStorage.setItem('parkingFloorConfig', JSON.stringify(config));
        }
        
        if (!data.success) {
            throw new Error(data.error || '获取数据失败');
        }
        
        // 更新界面
        updateParkingInfo(data);
        renderParkingGrid(data);
        
        // 添加多次额外检查，确保预约车位显示正确
        // 立即检查一次
        ensureReservedSlotsStyle();
        
        // 100ms后再次检查
        setTimeout(() => {
            ensureReservedSlotsStyle();
        }, 100);
        
        // 500ms后最后检查一次
        setTimeout(() => {
            ensureReservedSlotsStyle();
        }, 500);
        
    } catch (error) {
        console.error(`API请求失败:`, error);
        
        // 显示错误提示
        const errorNotice = document.createElement('div');
        errorNotice.className = 'error-notice';
        errorNotice.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>无法连接到服务器: ${error.message}</span>
            <button onclick="location.reload()" class="refresh-btn">刷新</button>
        `;
        
        // 添加到页面顶部
        const container = document.querySelector('.container');
        if (container) {
            // 移除已存在的提示（如果有）
            const existingNotice = container.querySelector('.error-notice');
            if (existingNotice) existingNotice.remove();
            
            // 添加新提示
            container.insertBefore(errorNotice, container.firstChild);
        }
        
        // 显示错误消息
        showError('无法加载停车场数据', '服务器连接失败，请稍后再试。');
    }
}

// 更新停车场信息面板
function updateParkingInfo(data) {
    if (!data) return;
    
    // 获取或创建停车场统计信息元素
    let statsContainer = document.getElementById('parking-stats');
    if (!statsContainer) {
        console.warn('找不到parking-stats元素，将创建新的容器');
        
        const mainContent = document.querySelector('main');
        statsContainer = document.createElement('div');
        statsContainer.id = 'parking-stats';
        statsContainer.className = 'parking-stats';
        
        if (mainContent) {
            mainContent.appendChild(statsContainer);
        } else {
            document.body.appendChild(statsContainer);
        }
    }
    
    // 构建统计信息HTML
    const timestamp = new Date(data.timestamp).toLocaleString('zh-CN');
    
    // 修正占用车位计算: 总车位 - 空闲车位 - 预约车位
    const occupiedSlotsFixed = data.totalSlots - data.freeSlots - data.reservedSlots;
    
    statsContainer.innerHTML = `
        <div class="stats-row">
            <div class="stat-item color-red">
                <i class="fas fa-map-marker-alt" style="color: #e74c3c;"></i>
                <span class="stat-label">当前楼层</span>
                <span class="stat-value">${data.floor.toUpperCase()}</span>
            </div>
            <div class="stat-item color-blue">
                <i class="fas fa-th" style="color: #3498db;"></i>
                <span class="stat-label">全部车位</span>
                <span class="stat-value">${data.totalSlots}</span>
            </div>
            <div class="stat-item color-green">
                <i class="fas fa-parking" style="color: #2ecc71;"></i>
                <span class="stat-label">空闲车位</span>
                <span class="stat-value">${data.freeSlots}</span>
            </div>
        </div>
        <div class="stats-row">
            <div class="stat-item color-red">
                <i class="fas fa-car" style="color: #e74c3c;"></i>
                <span class="stat-label">占用车位</span>
                <span class="stat-value">${occupiedSlotsFixed}</span>
            </div>
            <div class="stat-item color-blue">
                <i class="fas fa-clock" style="color: #3498db;"></i>
                <span class="stat-label">预约车位</span>
                <span class="stat-value">${data.reservedSlots}</span>
            </div>
            <div class="stat-item color-green">
                <i class="fas fa-sync-alt" style="color: #2ecc71;"></i>
                <span class="stat-label">更新时间</span>
                <span class="stat-value">${timestamp}</span>
            </div>
        </div>
    `;
}

// 渲染停车场网格 - 直接使用API返回的数据
function renderParkingGrid(data) {
    // 获取停车场容器
    let parkingContainer = document.getElementById('parking-container');
    if (!parkingContainer) {
        parkingContainer = document.createElement('div');
        parkingContainer.id = 'parking-container';
        parkingContainer.className = 'parking-container';
        document.querySelector('main').appendChild(parkingContainer);
    }
    
    // 清空容器
    parkingContainer.innerHTML = '';
    
    // 创建停车场网格
    const parkingGrid = document.createElement('div');
    parkingGrid.id = 'parking-grid';
    parkingGrid.className = 'parking-grid';
    
    // 使用API返回的rows和columns
    const rows = data.rows || 2;
    const columns = data.columns || 5;
    
    // 直接使用API返回的slots数据
    const slots = data.slots || [];
    
    // 检查当前用户是否有预约
    const userReservation = localStorage.getItem('parkingReservation');
    let userReservedSlot = null;
    
    if (userReservation) {
        const reservation = JSON.parse(userReservation);
        if (reservation.floor === data.floor) {
            userReservedSlot = reservation.slotNumber;
        }
    }
    
    // 创建车位布局网格
    for (let r = 1; r <= rows; r++) {
        const rowElement = document.createElement('div');
        rowElement.className = 'parking-row';
        // 设置精确的列宽和列数
        rowElement.style.gridTemplateColumns = `repeat(${columns}, 80px)`;
        rowElement.style.width = `${columns * 80 + (columns-1) * 10}px`; // 列宽*列数 + 间隙*(列数-1)
        
        for (let c = 1; c <= columns; c++) {
            // 计算当前位置对应的slotId (线性位置)
            const currentSlotId = (r - 1) * columns + c;
            
            // 在slots数组中查找匹配的车位 - 使用slotId
            const slot = slots.find(s => s.slotId === currentSlotId);
            
            if (slot) {
                // 创建车位元素
                const slotElement = document.createElement('div');
                
                // 设置基本类名 - 强制优先处理预约状态
                let statusClass = '';
                let iconClass = '';
                let slotTitle = '';
                
                // 强制先检查预约状态，确保优先级最高
                if (slot.status === 'reserved') {
                    statusClass = 'reserved';
                    
                    // 设置用户自己的预约特殊样式
                    if (userReservedSlot === slot.slotNumber) {
                        statusClass += ' user-reservation';
                        iconClass = 'fas fa-user-clock reserved-icon';
                        slotTitle = '我的预约 - 点击管理';
                    } else {
                        iconClass = 'fas fa-clock reserved-icon';
                        slotTitle = '已被预约';
                    }
                    
                    // 直接应用内联样式确保预约样式正确 - 使用蓝色并确保高优先级
                    slotElement.style.cssText = `
                        background-color: #3498db !important;
                        color: white !important;
                        border-color: #2980b9 !important;
                        box-shadow: 0 0 8px rgba(52, 152, 219, 0.6) !important;
                        z-index: 5 !important;
                    `;
                } 
                // 移除对B2/B3层10号车位的特殊处理，直接检查其他状态
                // 其次检查空闲状态
                else if (slot.status === 'free') {
                    statusClass = 'free';
                    iconClass = 'fas fa-parking';
                    slotTitle = '空闲车位 - 点击预约';
                } 
                // 最后检查占用状态
                else if (slot.status === 'occupied') {
                    statusClass = 'occupied';
                    iconClass = 'fas fa-car';
                    slotTitle = '已占用车位';
                }
                
                slotElement.className = `parking-slot ${statusClass}`;
                slotElement.dataset.slotNumber = slot.slotNumber;
                slotElement.dataset.status = slot.status; // 存储状态
                slotElement.title = slotTitle;
                
                // 添加车位号码 - 显示为行列格式，但存储为数字ID
                const slotNumberText = document.createElement('span');
                slotNumberText.className = 'slot-number';
                slotNumberText.textContent = `${slot.row}-${slot.col}`; // 显示为行列格式
                slotElement.appendChild(slotNumberText);
                
                // 根据状态添加图标
                const icon = document.createElement('i');
                icon.className = iconClass;
                slotElement.appendChild(icon);
                
                // 根据状态添加点击事件
                if (slot.status === 'free') {
                    // 为空闲车位添加点击事件
                    slotElement.addEventListener('click', function() {
                        handleReservation(this);
                    });
                } else if (slot.status === 'reserved' && userReservedSlot === slot.slotNumber) {
                    // 为用户自己的预约添加点击事件
                    slotElement.addEventListener('click', function() {
                        showMyReservation();
                    });
                }
                
                // 添加到行
                rowElement.appendChild(slotElement);
            } else {
                // 创建空车位（占位符）
                const emptySlot = document.createElement('div');
                emptySlot.className = 'parking-slot empty';
                emptySlot.dataset.position = currentSlotId;
                rowElement.appendChild(emptySlot);
            }
        }
        
        // 添加行到网格
        parkingGrid.appendChild(rowElement);
    }
    
    // 添加到容器
    parkingContainer.appendChild(parkingGrid);
    
    // 额外检查确保预约车位样式正确 - 最后确认一次
    document.querySelectorAll('.parking-slot[data-status="reserved"]').forEach(slot => {
        const slotNumber = slot.dataset.slotNumber;
        
        // 确保样式正确
        if (!slot.classList.contains('reserved')) {
            slot.classList.add('reserved');
        }
        
        // 确保没有错误的类名
        if (slot.classList.contains('occupied') || slot.classList.contains('free')) {
            slot.classList.remove('occupied', 'free');
        }
        
        // 使用cssText和!important强制应用样式，确保最高优先级
        slot.style.cssText = `
            background-color: #3498db !important;
            color: white !important;
            border-color: #2980b9 !important;
            box-shadow: 0 0 8px rgba(52, 152, 219, 0.6) !important;
            z-index: 10 !important;
        `;
    });
}

// 检查用户登录状态
function checkLoginStatus() {
    const userJson = localStorage.getItem('parkingUser');
    const userStatusContainer = document.getElementById('user-status');
    
    if (userJson) {
        try {
            // 用户已登录，显示用户信息和操作按钮
            const user = JSON.parse(userJson);
            userStatusContainer.innerHTML = `
                <span id="username-display">用户: ${user.name || user.phone}</span>
                <button id="my-reservation-button" onclick="showMyReservation()">我的预约</button>
                <button id="logout-button" onclick="logout()">退出登录</button>
            `;
            
            // 检查用户是否有预约，并更新界面
            checkUserReservation(user.phone);
            
            console.log('用户已登录:', user.phone);
        } catch (error) {
            console.error('解析用户信息失败:', error);
            localStorage.removeItem('parkingUser'); // 清除可能损坏的数据
            showLoginButton(userStatusContainer);
        }
    } else {
        // 用户未登录，显示登录按钮
        showLoginButton(userStatusContainer);
    }
}

// 单独提取显示登录按钮的函数，方便复用
function showLoginButton(container) {
    if(!container) return;
    
    // 直接使用onclick属性，而不是事件监听器
    container.innerHTML = `
        <button class="login-btn" onclick="window.location.href='login.html'">登录/注册</button>
    `;
    
    console.log('已设置登录按钮，使用内联onclick属性');
}

// 检查用户的预约状态
async function checkUserReservation(phone) {
    try {
        const apiUrl = `${API_BASE_URL}/reservation.php?phone=${phone}`;
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });
        
        const result = await response.json();
        
        if (result.success && result.reservations && result.reservations.length > 0) {
            // 用户有预约，保存到本地
            const slotNumber = result.reservations[0].slotNumber;
            
            // 确保车位位置是行-列格式
            let positionDisplay;
            if (result.reservations[0].position && typeof result.reservations[0].position === 'string' && result.reservations[0].position.includes('-')) {
                // 已经是行-列格式
                positionDisplay = result.reservations[0].position;
            } else {
                // 将数字转换为行-列格式
                const slotNum = slotNumber;
                positionDisplay = convertToRowCol(slotNum, result.reservations[0].floor);
            }
            
            localStorage.setItem('parkingReservation', JSON.stringify({
                floor: result.reservations[0].floor,
                slotNumber: slotNumber,
                timestamp: new Date().toISOString(), // 使用本地时间代替服务器时间
                position: positionDisplay
            }));
            
            // 如果当前显示的是预约车位所在的楼层，刷新显示
            if (currentFloor === result.reservations[0].floor) {
                fetchParkingData(currentFloor);
            }
        } else {
            // 用户没有预约
            localStorage.removeItem('parkingReservation');
        }
    } catch (error) {
        console.error('检查预约状态失败:', error);
    }
}

// 显示我的预约信息 - 弹出预约管理面板而不是跳转
function showMyReservation() {
    const userJson = localStorage.getItem('parkingUser');
    
    if (!userJson) {
        alert('请先登录');
        window.location.href = 'login.html';
        return;
    }
    
    const user = JSON.parse(userJson);
    const reservationData = localStorage.getItem('parkingReservation');
    
    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'reservation-modal';
    modal.style.display = 'block';
    
    let modalContent = '';
    
    if (reservationData) {
        // 用户有预约
        const reservation = JSON.parse(reservationData);
        const reservationTime = reservation.timestamp ? 
            new Date(reservation.timestamp).toLocaleString('zh-CN') : 
            new Date().toLocaleString('zh-CN');
        
        // 确保车位位置一定以行-列格式显示
        let positionDisplay;
        if (typeof reservation.position === 'string' && reservation.position.includes('-')) {
            // 已经是行-列格式
            positionDisplay = reservation.position;
        } else {
            // 将数字转换为行-列格式
            const slotNum = parseInt(reservation.position || reservation.slotNumber);
            positionDisplay = convertToRowCol(slotNum, reservation.floor);
        }
        
        modalContent = `
            <div class="modal-content">
                <span class="close-modal" onclick="document.getElementById('reservation-modal').remove()">&times;</span>
                <h2>我的预约</h2>
                <div class="reservation-details">
                    <p><strong>楼层:</strong> ${reservation.floor}</p>
                    <p><strong>预约位置:</strong> ${positionDisplay}</p>
                    <p><strong>预约时间:</strong> ${reservationTime}</p>
                    <p><strong>状态:</strong> 已预约</p>
                </div>
                <div class="reservation-actions">
                    <button class="action-btn cancel-btn" onclick="cancelCurrentReservation()">取消预约</button>
                </div>
            </div>
        `;
    } else {
        // 用户没有预约，重新检查
        checkUserReservation(user.phone);
        
        modalContent = `
            <div class="modal-content">
                <span class="close-modal" onclick="document.getElementById('reservation-modal').remove()">&times;</span>
                <h2>我的预约</h2>
                <div class="no-data">
                    <p>您当前没有预约</p>
                    <p>请在车位图上点击空闲车位进行预约</p>
                </div>
            </div>
        `;
    }
    
    modal.innerHTML = modalContent;
    document.body.appendChild(modal);
    
    // 点击模态框外部关闭
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.remove();
        }
    };
}

// 取消当前预约
function cancelCurrentReservation() {
    const userJson = localStorage.getItem('parkingUser');
    const reservationData = localStorage.getItem('parkingReservation');
    
    if (!userJson || !reservationData) {
        alert('找不到有效的预约信息');
        return;
    }
    
    const user = JSON.parse(userJson);
    const reservation = JSON.parse(reservationData);
    
    // 确保车位位置一定以行-列格式显示
    let positionDisplay;
    if (typeof reservation.position === 'string' && reservation.position.includes('-')) {
        // 已经是行-列格式
        positionDisplay = reservation.position;
    } else {
        // 将数字转换为行-列格式
        const slotNum = parseInt(reservation.position || reservation.slotNumber);
        positionDisplay = convertToRowCol(slotNum, reservation.floor);
    }
    
    if (confirm(`确定要取消在${reservation.floor}层 ${positionDisplay}位置的预约吗？`)) {
        cancelReservation(reservation.floor, user.phone);
    }
}

// 处理车位预约
function handleReservation(slotElement) {
    // 检查用户是否已登录
    const userJson = localStorage.getItem('parkingUser');
    
    if (!userJson) {
        alert('请先登录后再预约车位');
        window.location.href = 'login.html';
        return;
    }
    
    const user = JSON.parse(userJson);
    const phone = user.phone || user.id; // 使用手机号或用户ID
    const slotNumber = slotElement.dataset.slotNumber;
    
    // 获取车位的行列显示格式
    const slotDisplay = slotElement.querySelector('.slot-number').textContent;
    
    // 检查用户是否已有预约
    const existingReservation = localStorage.getItem('parkingReservation');
    if (existingReservation) {
        alert('您已经有一个预约，请先取消当前预约再预约新车位');
        return;
    }
    
    // 确认预约
    if (confirm(`确定要预约${currentFloor}层 ${slotDisplay}位置吗？`)) {
        // 发送预约请求
        reserveSlot(currentFloor, slotNumber, phone, slotDisplay);
    }
}

// API: 预约车位
async function reserveSlot(floor, slotNumber, phone, slotDisplay) {
    try {
        const apiUrl = API_BASE_URL + '/reservation.php';
        
        // 显示加载状态
        const loadingMessage = document.createElement('div');
        loadingMessage.className = 'loading-message';
        loadingMessage.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在处理预约请求...';
        document.body.appendChild(loadingMessage);
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                floor: floor,
                slotNumber: slotNumber,
                phone: phone
            })
        });
        
        // 移除加载状态
        loadingMessage.remove();
        
        const result = await response.json();
        
        if (!result.success) {
            let errorMsg = result.error || '预约失败';
            // 根据错误类型提供更友好的错误信息
            if (errorMsg.includes('不在可用车位列表中')) {
                errorMsg = '该车位已不可用，请选择其他车位。';
            } else if (errorMsg.includes('预约处理失败')) {
                errorMsg = '预约处理过程中出现错误，请稍后重试。';
            }
            throw new Error(errorMsg);
        }
        
        // 保存预约信息到本地
        localStorage.setItem('parkingReservation', JSON.stringify({
            floor: floor,
            slotNumber: slotNumber,
            timestamp: new Date().toISOString(), // 使用本地时间代替服务器时间
            position: slotDisplay || result.reservation.position || convertToRowCol(slotNumber, floor)
        }));
        
        alert(`预约成功！您已成功预约${floor}层${slotDisplay}位置的车位，请尽快到达停车场。`);
        
        // 刷新车位显示
        fetchParkingData(currentFloor);
        
    } catch (error) {
        console.error('预约失败:', error);
        alert('预约失败: ' + error.message);
        
        // 刷新车位状态，确保显示最新状态
        fetchParkingData(currentFloor);
    }
}

// API: 取消预约
async function cancelReservation(floor, phone) {
    try {
        const apiUrl = API_BASE_URL + '/reservation.php';
        
        // 显示加载状态
        const loadingMessage = document.createElement('div');
        loadingMessage.className = 'loading-message';
        loadingMessage.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 正在处理取消请求...';
        document.body.appendChild(loadingMessage);
        
        const response = await fetch(apiUrl, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                floor: floor,
                phone: phone
            })
        });
        
        // 移除加载状态
        loadingMessage.remove();
        
        const result = await response.json();
        
        if (!result.success) {
            let errorMsg = result.error || '取消预约失败';
            // 根据错误类型提供更友好的错误信息
            if (errorMsg.includes('未找到您的预约')) {
                errorMsg = '找不到您的预约信息，可能已被取消或已过期。';
            } else if (errorMsg.includes('取消预约失败')) {
                errorMsg = '取消预约过程中出现错误，请稍后重试。';
            }
            throw new Error(errorMsg);
        }
        
        // 清除本地预约信息
        localStorage.removeItem('parkingReservation');
        
        alert('预约已成功取消');
        
        // 刷新车位显示
        fetchParkingData(currentFloor);
        
    } catch (error) {
        console.error('取消预约失败:', error);
        alert('取消预约失败: ' + error.message);
        
        // 刷新车位状态，确保显示最新状态
        fetchParkingData(currentFloor);
    }
}

// 轮询更新
setInterval(function() {
    const activeFloor = document.querySelector('.floor-btn.active');
    if (activeFloor) {
        const floor = activeFloor.getAttribute('data-floor');
        fetchParkingData(floor);
    }
}, 60000); // 每分钟刷新一次 

// 显示错误信息
function showError(message, details = null) {
    const grid = document.getElementById('parking-grid');
    
    let errorHtml = `
        <div class="loading error">
            <svg class="icon-times" viewBox="0 0 512 512" width="24" height="24">
                <path fill="#e74c3c" d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM175 175c9.4-9.4 24.6-9.4 33.9 0l47 47 47-47c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9l-47 47 47 47c9.4 9.4 9.4 24.6 0 33.9s-24.6 9.4-33.9 0l-47-47-47 47c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l47-47-47-47c-9.4-9.4-9.4-24.6 0-33.9z"/>
            </svg>
            <span>${message}</span>
        </div>
    `;
    
    if (details) {
        errorHtml += `<div class="error-details">${details}</div>`;
    }
    
    grid.innerHTML = errorHtml;
}

// 注销功能
function logout() {
    if (confirm('确定要退出登录吗？')) {
        // 清除用户数据
        localStorage.removeItem('parkingUser');
        localStorage.removeItem('parkingReservation');
        
        // 刷新页面
        window.location.reload();
    }
}

// 将关键函数暴露到全局作用域
window.fetchParkingData = fetchParkingData;
window.showMyReservation = showMyReservation;
window.cancelCurrentReservation = cancelCurrentReservation;
window.logout = logout;
window.switchFloor = switchFloor;

// 简单的楼层切换函数，确保使用正确的API路径
function switchFloor(floor) {
    // 更新按钮样式
    document.querySelectorAll('.floor-button').forEach(btn => {
        if (btn.dataset.floor === floor) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // 设置当前楼层变量
    window.currentFloor = floor;
    
    // 调用数据加载函数
    if (typeof window.fetchParkingData === 'function') {
        window.fetchParkingData(floor);
    } else {
        console.error('未找到fetchParkingData函数，可能是脚本未正确加载');
        alert('系统正在初始化，请稍后再试...');
    }
}

// 添加确保预约车位样式的函数
function ensureReservedSlotsStyle() {
    // 获取所有预约状态的车位
    const reservedSlots = document.querySelectorAll('.parking-slot[data-status="reserved"]');
    
    if (reservedSlots.length === 0) {
        return;
    }
    
    // 获取用户预约
    const userReservation = localStorage.getItem('parkingReservation');
    let userReservedSlot = null;
    
    if (userReservation) {
        try {
            const reservation = JSON.parse(userReservation);
            if (reservation.floor === currentFloor) {
                userReservedSlot = reservation.slotNumber;
            }
        } catch (e) {
            console.error('解析用户预约信息失败:', e);
        }
    }
    
    // 为所有预约车位应用样式
    reservedSlots.forEach(slot => {
        const slotNumber = slot.dataset.slotNumber;
        
        // 确保所有必要的类名正确
        slot.classList.remove('occupied', 'free');
        slot.classList.add('reserved');
        
        // 应用预约样式 (蓝色)
        slot.style.cssText = `
            background-color: #3498db !important;
            color: white !important;
            border-color: #2980b9 !important;
            box-shadow: 0 0 8px rgba(52, 152, 219, 0.6) !important;
        `;
        
        // 检查是否是用户的预约
        if (userReservedSlot === slotNumber) {
            // 为用户的预约添加额外样式 (绿色边框)
            slot.classList.add('user-reservation');
            slot.style.borderColor = '#2ecc71 !important';
            
            // 更新图标
            const icon = slot.querySelector('i');
            if (icon) {
                icon.className = 'fas fa-user-clock reserved-icon';
            }
            
            // 添加标题提示
            slot.title = '我的预约 - 点击管理';
            
            // 添加点击事件
            slot.onclick = () => showMyReservation();
        } else {
            // 其他人的预约
            // 更新图标
            const icon = slot.querySelector('i');
            if (icon) {
                icon.className = 'fas fa-clock reserved-icon';
            }
            
            // 添加标题提示
            slot.title = '已被预约的车位';
            
            // 移除可能的点击事件
            slot.onclick = null;
        }
    });
} 