<?php
// 引入配置文件
require_once 'config.php';

/**
 * 获取数据库连接
 */
function getDBConnection() {
    global $config;
    
    try {
        $dsn = "mysql:host={$config['db_host']};dbname={$config['db_name']};port={$config['db_port']};charset=utf8mb4";
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        
        $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], $options);
        return $pdo;
    } catch (PDOException $e) {
        // 记录错误日志
        error_log("数据库连接失败: " . $e->getMessage(), 3, "../logs/db_error.log");
        return null;
    }
}

/**
 * 执行SQL查询并返回结果
 */
function executeQuery($sql, $params = []) {
    $pdo = getDBConnection();
    
    if (!$pdo) {
        return ['success' => false, 'message' => '数据库连接失败'];
    }
    
    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return ['success' => true, 'data' => $stmt];
    } catch (PDOException $e) {
        error_log("SQL执行失败: " . $e->getMessage(), 3, "../logs/db_error.log");
        return ['success' => false, 'message' => 'SQL执行失败: ' . $e->getMessage()];
    }
}
?> 