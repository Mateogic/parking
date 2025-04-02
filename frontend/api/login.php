<?php
// 设置响应类型为JSON
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');

// 如果是预检请求，直接返回200
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 错误日志记录函数
function logError($message) {
    $logFile = __DIR__ . '/error.log';
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] $message\n", FILE_APPEND);
}

// 加载数据库配置
require_once __DIR__ . '/includes/config.php';

// 处理登录请求
try {
    // 解析JSON请求体
    $data = json_decode(file_get_contents('php://input'), true);
    
    // 验证请求数据
    if (!isset($data['phone']) || !isset($data['password'])) {
        throw new Exception('请提供手机号和密码');
    }
    
    $phone = $data['phone'];
    $password = $data['password'];
    
    // 手机号格式验证
    if (!preg_match('/^1[3-9]\d{9}$/', $phone)) {
        throw new Exception('手机号格式不正确');
    }
    
    // 连接数据库
    $dsn = "mysql:host={$config['db_host']};dbname={$config['db_name']};port={$config['db_port']}";
    $pdo = new PDO($dsn, $config['db_user'], $config['db_pass']);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // 检查users表是否存在
    $stmt = $pdo->query("SHOW TABLES LIKE 'users'");
    if ($stmt->rowCount() === 0) {
        // 创建users表
        $pdo->exec("CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(50),
            phone VARCHAR(20) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
        
        // 表刚创建，肯定没有该用户
        throw new Exception('账号或密码错误');
    }
    
    // 查询用户
    $stmt = $pdo->prepare("SELECT * FROM users WHERE phone = :phone LIMIT 1");
    $stmt->execute(['phone' => $phone]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // 验证密码
    if (!$user || !password_verify($password, $user['password'])) {
        throw new Exception('账号或密码错误');
    }
    
    // 生成会话令牌
    $sessionId = bin2hex(random_bytes(16));
    
    // 创建会话表(如果不存在)
    $pdo->exec("CREATE TABLE IF NOT EXISTS sessions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        session_id VARCHAR(32) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    
    // 保存会话信息
    $expiresAt = date('Y-m-d H:i:s', time() + 86400); // 24小时后过期
    $stmt = $pdo->prepare("INSERT INTO sessions (user_id, session_id, expires_at) VALUES (:userId, :sessionId, :expiresAt)");
    $stmt->execute([
        'userId' => $user['id'],
        'sessionId' => $sessionId,
        'expiresAt' => $expiresAt
    ]);
    
    // 返回成功信息和用户数据(不返回密码)
    unset($user['password']);
    echo json_encode([
        'success' => true,
        'message' => '登录成功',
        'user' => $user,
        'session' => [
            'id' => $sessionId,
            'expires_at' => $expiresAt
        ]
    ]);
    
} catch (Exception $e) {
    // 记录错误
    logError("登录错误: " . $e->getMessage());
    
    // 返回错误响应
    http_response_code(200); // 使用200而非401，更容易被前端处理
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}
?> 