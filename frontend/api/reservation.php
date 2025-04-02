<?php
// 设置响应类型为JSON
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *'); // 允许跨域请求，生产环境中应限制来源
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
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

// 获取请求方法
$method = $_SERVER['REQUEST_METHOD'];

// 从请求中解析JSON数据
$data = json_decode(file_get_contents('php://input'), true);

// 验证用户身份
function validateUser($phone, $db) {
    $stmt = $db->prepare("SELECT * FROM users WHERE phone = :phone");
    $stmt->execute([
        'phone' => $phone
    ]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

try {
    // 使用数组变量形式连接数据库
    $dsn = "mysql:host={$config['db_host']};dbname={$config['db_name']};port={$config['db_port']}";
    $pdo = new PDO($dsn, $config['db_user'], $config['db_pass']);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // 根据请求方法执行相应的操作
    switch ($method) {
        case 'POST': // 预约车位
            // 验证必要参数
            if (empty($data['floor']) || empty($data['slotNumber']) || empty($data['phone'])) {
                throw new Exception('缺少必要参数：楼层、车位号或手机号');
            }
            
            $floor = $data['floor'];
            $slotNumber = $data['slotNumber'];
            $phone = $data['phone'];
            
            // 验证手机号格式
            if (!preg_match('/^1[3-9]\d{9}$/', $phone)) {
                throw new Exception('手机号格式不正确');
            }
            
            // 检查用户是否已有预约 - 先检查所有楼层
            for ($i = 1; $i <= 3; $i++) {
                $checkTableName = "parking_status_b{$i}";
                
                // 检查表是否存在
                $stmt = $pdo->query("SHOW TABLES LIKE '$checkTableName'");
                if ($stmt->rowCount() == 0) {
                    continue; // 跳过不存在的表
                }
                
                // 获取最新的停车状态记录
                $stmt = $pdo->prepare("SELECT * FROM $checkTableName ORDER BY id DESC LIMIT 1");
                $stmt->execute();
                $checkStatus = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$checkStatus || empty($checkStatus['reservation']) || $checkStatus['reservation'] === 'NULL') {
                    continue; // 跳过没有预约的楼层
                }
                
                // 检查此用户是否已有预约
                $reservations = json_decode($checkStatus['reservation'], true) ?: [];
                foreach ($reservations as $position => $info) {
                    if (isset($info['phone']) && $info['phone'] === $phone) {
                        throw new Exception("您已在B{$i}层 {$position}号车位有一个预约");
                    }
                }
            }
            
            // 获取对应楼层的表名
            $floorNum = substr($floor, 1, 1); // 从B1/B2/B3提取数字部分
            $tableName = "parking_status_b{$floorNum}";
            
            // 检查表是否存在
            $stmt = $pdo->query("SHOW TABLES LIKE '$tableName'");
            if ($stmt->rowCount() == 0) {
                throw new Exception("无效的楼层: $floor, 表 $tableName 不存在");
            }
            
            // 获取最新的停车状态记录
            $stmt = $pdo->prepare("SELECT * FROM $tableName ORDER BY id DESC LIMIT 1");
            $stmt->execute();
            $parkingStatus = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$parkingStatus) {
                throw new Exception("未找到停车数据, 表: $tableName");
            }
            
            // 解析free_positions字段 - 存储空闲车位编号
            $freePositions = json_decode($parkingStatus['free_positions'], true) ?: [];
            
            // 日志记录
            logError("当前楼层 $floor 的空闲车位: " . json_encode($freePositions));
            logError("用户请求预约车位: $slotNumber");
            
            // 检查车位是否存在于free_positions中
            $positionIndex = array_search($slotNumber, $freePositions);
            if ($positionIndex === false) {
                // 尝试字符串形式查找
                $positionIndex = array_search((string)$slotNumber, $freePositions);
                
                if ($positionIndex === false) {
                    throw new Exception("车位 $slotNumber 不在可用车位列表中");
                }
            }
            
            // 初始化预约数据
            $reservations = [];
            if (!empty($parkingStatus['reservation']) && $parkingStatus['reservation'] !== 'NULL') {
                $reservations = json_decode($parkingStatus['reservation'], true) ?: [];
            }
            
            // 检查该车位是否已被预约
            if (isset($reservations[$slotNumber])) {
                throw new Exception("车位 $slotNumber 已被预约");
            }
            
            // 添加新预约 - 使用数字索引
            $reservations[$slotNumber] = [
                'phone' => $phone,
                'timestamp' => date('Y-m-d H:i:s'),
                'duration' => 30, // 默认30分钟
                'floor' => $floor  // 存储楼层信息便于跨楼层查询
            ];
            
            // 从free_positions中移除已预约的车位
            array_splice($freePositions, $positionIndex, 1);
            
            // 开始事务处理，确保所有操作要么全部成功，要么全部失败
            try {
                $pdo->beginTransaction();
                
                // 创建新记录而不是更新现有记录
                $stmt = $pdo->prepare("INSERT INTO $tableName (
                    timestamp,
                    total_slots,
                    free_slots,
                    free_positions,
                    parking_rows,
                    parking_columns,
                    reservation,
                    source_type
                ) VALUES (
                    NOW(),
                    :total_slots,
                    :free_slots,
                    :free_positions,
                    :parking_rows,
                    :parking_columns,
                    :reservation,
                    :source_type
                )");
                    
                $stmt->execute([
                    ':total_slots' => $parkingStatus['total_slots'],
                    ':free_slots' => count($freePositions),
                    ':free_positions' => json_encode($freePositions),
                    ':parking_rows' => $parkingStatus['parking_rows'],
                    ':parking_columns' => $parkingStatus['parking_columns'],
                    ':reservation' => json_encode($reservations),
                    ':source_type' => $parkingStatus['source_type']
                ]);
                
                // 检查reservation_history表是否存在，如果不存在则创建
                $stmt = $pdo->query("SHOW TABLES LIKE 'reservation_history'");
                if ($stmt->rowCount() == 0) {
                    $pdo->exec("CREATE TABLE IF NOT EXISTS reservation_history (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        table_name VARCHAR(20) NOT NULL, 
                        slot_number VARCHAR(10) NOT NULL, 
                        phone VARCHAR(20) NOT NULL,
                        action ENUM('reserve', 'cancel') NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
                }
                
                // 记录预约历史
                $stmt = $pdo->prepare("INSERT INTO reservation_history (table_name, slot_number, phone, action) 
                    VALUES (:table_name, :slot_number, :phone, 'reserve')");
                $stmt->execute([
                    ':table_name' => $tableName,
                    ':slot_number' => $slotNumber,
                    ':phone' => $phone
                ]);
                
                // 提交事务
                $pdo->commit();
                
                // 返回成功响应
                echo json_encode([
                    'success' => true,
                    'message' => '预约成功',
                    'reservation' => [
                        'floor' => $floor,
                        'slotNumber' => $slotNumber,
                        'timestamp' => date('Y-m-d H:i:s'),
                        'tableName' => $tableName
                    ]
                ]);
            } catch (Exception $e) {
                // 回滚事务
                $pdo->rollBack();
                throw new Exception('预约处理失败: ' . $e->getMessage());
            }
            break;
            
        case 'DELETE': // 取消预约
            // 验证必要参数
            if (empty($data['floor']) || empty($data['phone'])) {
                throw new Exception('缺少必要参数：楼层或手机号');
            }
            
            $floor = $data['floor'];
            $phone = $data['phone'];
            
            // 获取对应楼层的表名
            $floorNum = substr($floor, 1, 1); // 从B1/B2/B3提取数字部分
            $tableName = "parking_status_b{$floorNum}";
            
            // 检查表是否存在
            $stmt = $pdo->query("SHOW TABLES LIKE '$tableName'");
            if ($stmt->rowCount() == 0) {
                throw new Exception("无效的楼层: $floor");
            }
            
            // 获取最新的停车状态记录
            $stmt = $pdo->prepare("SELECT * FROM $tableName ORDER BY id DESC LIMIT 1");
            $stmt->execute();
            $parkingStatus = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$parkingStatus) {
                throw new Exception('未找到停车数据');
            }
            
            // 解析reservation字段
            $reservations = [];
            if (!empty($parkingStatus['reservation']) && $parkingStatus['reservation'] !== 'NULL') {
                $reservations = json_decode($parkingStatus['reservation'], true) ?: [];
            }
            
            // 解析free_positions字段
            $freePositions = json_decode($parkingStatus['free_positions'], true) ?: [];
            
            // 查找用户的预约
            $userSlotNumber = null;
            
            foreach ($reservations as $position => $info) {
                if (isset($info['phone']) && $info['phone'] === $phone) {
                    $userSlotNumber = $position;
                    break;
                }
            }
            
            if ($userSlotNumber === null) {
                throw new Exception('未找到您的预约');
            }
            
            // 移除预约
            unset($reservations[$userSlotNumber]);
            
            // 将车位添加回free_positions
            $freePositions[] = $userSlotNumber;
            sort($freePositions); // 保持数组有序
            
            // 使用事务处理取消预约
            try {
                $pdo->beginTransaction();
                
                // 创建新记录而不是更新现有记录
                $stmt = $pdo->prepare("INSERT INTO $tableName (
                    timestamp,
                    total_slots,
                    free_slots,
                    free_positions,
                    parking_rows,
                    parking_columns,
                    reservation,
                    source_type
                ) VALUES (
                    NOW(),
                    :total_slots,
                    :free_slots,
                    :free_positions,
                    :parking_rows,
                    :parking_columns,
                    :reservation,
                    :source_type
                )");
                    
                $stmt->execute([
                    ':total_slots' => $parkingStatus['total_slots'],
                    ':free_slots' => count($freePositions),
                    ':free_positions' => json_encode($freePositions),
                    ':parking_rows' => $parkingStatus['parking_rows'],
                    ':parking_columns' => $parkingStatus['parking_columns'],
                    ':reservation' => json_encode($reservations),
                    ':source_type' => $parkingStatus['source_type']
                ]);
                
                // 记录取消预约历史
                $stmt = $pdo->prepare("INSERT INTO reservation_history (table_name, slot_number, phone, action) 
                    VALUES (:table_name, :slot_number, :phone, 'cancel')");
                $stmt->execute([
                    ':table_name' => $tableName,
                    ':slot_number' => $userSlotNumber,
                    ':phone' => $phone
                ]);
                
                // 提交事务
                $pdo->commit();
                
                // 返回成功响应
                echo json_encode([
                    'success' => true,
                    'message' => '预约已取消'
                ]);
            } catch (Exception $e) {
                // 回滚事务
                $pdo->rollBack();
                throw new Exception('取消预约失败: ' . $e->getMessage());
            }
            break;
            
        case 'GET': // 获取用户的预约信息
            // 检查是否提供了手机号参数
            $phone = isset($_GET['phone']) ? $_GET['phone'] : '';
            
            if (empty($phone)) {
                throw new Exception('缺少必要参数：手机号');
            }
            
            // 查询所有楼层的预约信息
            $allReservations = [];
            
            for ($i = 1; $i <= 3; $i++) {
                $tableName = "parking_status_b{$i}";
                
                // 检查表是否存在
                $stmt = $pdo->query("SHOW TABLES LIKE '$tableName'");
                if ($stmt->rowCount() == 0) {
                    continue; // 跳过不存在的表
                }
                
                // 获取最新的停车状态记录
                $stmt = $pdo->prepare("SELECT * FROM $tableName ORDER BY id DESC LIMIT 1");
                $stmt->execute();
                $parkingStatus = $stmt->fetch(PDO::FETCH_ASSOC);
                
                if (!$parkingStatus || empty($parkingStatus['reservation']) || $parkingStatus['reservation'] === 'NULL') {
                    continue; // 跳过没有预约的楼层
                }
                
                // 解析reservation字段
                $reservations = json_decode($parkingStatus['reservation'], true) ?: [];
                
                // 查找用户的预约
                foreach ($reservations as $position => $info) {
                    if (isset($info['phone']) && $info['phone'] === $phone) {
                        $allReservations[] = [
                            'floor' => "B{$i}",
                            'slotNumber' => $position,
                            'timestamp' => $info['timestamp'],
                            'duration' => isset($info['duration']) ? $info['duration'] : 30,
                            'tableName' => $tableName
                        ];
                    }
                }
            }
            
            // 返回用户的预约信息
            echo json_encode([
                'success' => true,
                'reservations' => $allReservations
            ]);
            break;
            
        default:
            throw new Exception("不支持的请求方法: {$method}");
    }
} catch (Exception $e) {
    // 记录错误
    logError("预约处理错误: " . $e->getMessage() . "\n" . $e->getTraceAsString());
    
    // 返回错误响应
    http_response_code(200); // 使用200而非500，以便前端能处理
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
        'debug' => [
            'file' => $e->getFile(),
            'line' => $e->getLine()
        ]
    ]);
}
?> 