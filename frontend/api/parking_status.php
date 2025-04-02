<?php
// 设置允许跨域访问
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Accept");
header('Content-Type: application/json');

// 如果是OPTIONS请求，直接返回200
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// 错误日志函数 - 仅记录关键错误
function logError($message) {
    $logFile = __DIR__ . '/error.log';
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] $message\n", FILE_APPEND);
}

// 获取请求的楼层
$floorCode = isset($_GET['floor']) ? strtoupper($_GET['floor']) : 'B1';

// 验证楼层格式（忽略大小写）
if (!preg_match('/^B[1-3]$/i', $floorCode)) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => '无效的楼层参数，有效值为B1、B2或B3',
        'code' => 'INVALID_FLOOR'
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

// 确保楼层代码是大写
$floorCode = strtoupper($floorCode);

try {
    // 引入数据库连接
    require_once 'includes/db.php';
    
    // 根据楼层选择对应的表
    $tableName = 'parking_status_' . strtolower($floorCode);
    
    // 查询楼层数据
    $query = "SELECT * FROM $tableName ORDER BY timestamp DESC LIMIT 1";
    $result = executeQuery($query);
    
    if (!$result['success']) {
        throw new Exception("获取车位数据失败: " . $result['message']);
    }
    
    $parkingData = $result['data']->fetch();
    
    if (!$parkingData) {
        throw new Exception("找不到车位数据");
    }
    
    // 获取行列数
    $rows = intval($parkingData['parking_rows']);
    $columns = intval($parkingData['parking_columns']);
    $totalSlots = intval($parkingData['total_slots']);
    $freeSlots = intval($parkingData['free_slots']);
    $occupiedSlots = $totalSlots - $freeSlots;
    
    // 解析空闲位置JSON
    $freePositions = json_decode($parkingData['free_positions'], true);
    if (!is_array($freePositions)) {
        $freePositions = [];
    }
    
    // 解析预约信息JSON
    $reservations = json_decode($parkingData['reservation'], true);
    if (!is_array($reservations) && !is_object($reservations)) {
        $reservations = [];
    }
    
    // 计算预约数量
    $reservedSlots = 0;
    $reservedPositions = []; // 新增：记录所有预约车位的位置
    if (is_array($reservations)) {
        $reservedSlots = count($reservations);
        // 获取所有预约的车位号
        foreach ($reservations as $position => $resData) {
            $reservedPositions[] = $position;
        }
    } else if (is_object($reservations)) {
        $reservedSlots = count((array)$reservations);
        // 获取所有预约的车位号
        foreach ($reservations as $position => $resData) {
            $reservedPositions[] = $position;
        }
    }
    
    // 调试日志 - 记录找到的预约信息
    logError("Debug - 找到预约车位: " . json_encode($reservedPositions) . ", 预约JSON: " . $parkingData['reservation']);
    
    // 创建车位数组
    $slotsArray = [];
    $slotId = 1;
    
    // 生成所有车位的状态
    for ($r = 1; $r <= $rows; $r++) {
        for ($c = 1; $c <= $columns; $c++) {
            $position = $slotId;
            $positionStr = (string)$position;
            $status = 'occupied'; // 默认状态为已占用
            $reservedBy = null;
            $reservedUntil = null;
            
            // 先检查是否被预约 - 预约状态优先级最高
            $isReserved = false;
            
            // 修改后的预约检查逻辑 - 直接检查车位是否在预约列表中
            if (in_array($positionStr, $reservedPositions) || in_array($position, $reservedPositions)) {
                $status = 'reserved';
                $isReserved = true;
                
                // 获取预约信息
                if (isset($reservations[$positionStr])) {
                    $resData = $reservations[$positionStr];
                    $reservedBy = $resData['phone'] ?? null;
                    $reservedUntil = $resData['timestamp'] ?? null;
                } else if (isset($reservations[$position])) {
                    $resData = $reservations[$position];
                    $reservedBy = $resData['phone'] ?? null;
                    $reservedUntil = $resData['timestamp'] ?? null;
                }
            }
            
            // 如果没有预约，再检查是否在空闲位置列表中
            if (!$isReserved && (in_array($position, $freePositions) || in_array((string)$position, $freePositions))) {
                $status = 'free';
            }
            
            // 添加到车位数组
            $slotsArray[] = [
                'slotNumber' => $slotId,
                'slotId' => $slotId,
                'row' => $r,
                'col' => $c,
                'status' => $status,
                'reservedBy' => $reservedBy,
                'reservedUntil' => $reservedUntil
            ];
            
            $slotId++;
        }
    }
    
    // 构建响应
    $response = [
        'success' => true,
        'floor' => strtoupper($floorCode),
        'floorName' => $floorCode,
        'rows' => $rows,
        'columns' => $columns,
        'totalSlots' => $totalSlots,
        'freeSlots' => $freeSlots,
        'occupiedSlots' => $occupiedSlots,
        'reservedSlots' => $reservedSlots,
        'slots' => $slotsArray,
        'timestamp' => $parkingData['timestamp'],
        'source' => 'database'
    ];
    
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    // 记录错误
    logError("错误: " . $e->getMessage());
    
    // 返回错误响应
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => '获取数据失败: ' . $e->getMessage(),
        'code' => 'DATA_FETCH_ERROR'
    ], JSON_UNESCAPED_UNICODE);
}
?> 