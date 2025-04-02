<?php
// 设置响应类型为JSON
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// 处理预检请求
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 确保请求方法为POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => '不支持的请求方法']);
    exit;
}

// 获取POST数据
$data = json_decode(file_get_contents('php://input'), true);

// 验证请求数据
if (!isset($data['name']) || !isset($data['phone']) || !isset($data['password'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => '缺少必要参数']);
    exit;
}

// 验证电话号码格式（中国手机号）
if (!preg_match('/^1[3-9]\d{9}$/', $data['phone'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => '无效的手机号码']);
    exit;
}

// 验证密码长度
if (strlen($data['password']) < 6) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => '密码长度不能少于6位']);
    exit;
}

// 加载数据库配置
require_once 'includes/config.php';

try {
    // 连接数据库
    $dsn = "mysql:host={$config['db_host']};dbname={$config['db_name']};port={$config['db_port']}";
    $db = new PDO($dsn, $config['db_user'], $config['db_pass']);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // 检查表是否存在，如果不存在则创建
    $db->exec("CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        phone VARCHAR(20) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");
    
    // 检查电话号码是否已存在
    $stmt = $db->prepare("SELECT id FROM users WHERE phone = ?");
    $stmt->execute([$data['phone']]);
    if ($stmt->rowCount() > 0) {
        echo json_encode(['success' => false, 'error' => '该手机号已注册']);
        exit;
    }
    
    // 对密码进行哈希处理
    $hashedPassword = password_hash($data['password'], PASSWORD_DEFAULT);
    
    // 插入新用户数据
    $stmt = $db->prepare("INSERT INTO users (name, phone, password) VALUES (?, ?, ?)");
    $result = $stmt->execute([$data['name'], $data['phone'], $hashedPassword]);
    
    if ($result) {
        // 注册成功
        echo json_encode([
            'success' => true,
            'message' => '注册成功',
            'user' => [
                'id' => $db->lastInsertId(),
                'name' => $data['name'],
                'phone' => $data['phone']
            ]
        ]);
    } else {
        // 注册失败
        echo json_encode(['success' => false, 'error' => '注册失败，请稍后再试']);
    }
    
} catch (PDOException $e) {
    // 数据库错误
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => '服务器错误: ' . $e->getMessage()]);
}
?> 