#!/usr/bin/env python
# -*- coding: utf-8 -*-

import mysql.connector
import json
from datetime import datetime
from config import DB_CONFIG, PROCESS_CONFIG

class ParkingDatabase:
    def __init__(self):
        self.connection = None
        self.cursor = None
        self.parking_layer = PROCESS_CONFIG['parking_layer']
        self.connect()
        self.create_tables_if_not_exist()
    
    def connect(self):
        """连接到MySQL数据库"""
        try:
            self.connection = mysql.connector.connect(**DB_CONFIG)
            self.cursor = self.connection.cursor()
            print("数据库连接成功")
            print("-"*50)  # 添加分隔线
        except mysql.connector.Error as err:
            print(f"数据库连接失败: {err}")
            raise
    
    def create_tables_if_not_exist(self):
        """创建必要的数据表（如果不存在）"""
        try:
            # 创建不同层的停车记录表
            table_name = f"parking_status_{self.parking_layer}"
            
            # 首先检查表是否存在
            self.cursor.execute(f"""
                SELECT COUNT(*)
                FROM information_schema.tables
                WHERE table_schema = '{DB_CONFIG['database']}'
                AND table_name = '{table_name}'
            """)
            table_exists = self.cursor.fetchone()[0] > 0
            
            if table_exists:
                # 检查是否有parking_rows和parking_columns列
                self.cursor.execute(f"""
                    SELECT COUNT(*)
                    FROM information_schema.columns
                    WHERE table_schema = '{DB_CONFIG['database']}'
                    AND table_name = '{table_name}'
                    AND column_name = 'parking_rows'
                """)
                has_parking_rows = self.cursor.fetchone()[0] > 0
                
                # 检查是否有reservation列
                self.cursor.execute(f"""
                    SELECT COUNT(*)
                    FROM information_schema.columns
                    WHERE table_schema = '{DB_CONFIG['database']}'
                    AND table_name = '{table_name}'
                    AND column_name = 'reservation'
                """)
                has_reservation = self.cursor.fetchone()[0] > 0
                
                if not has_parking_rows:
                    # 添加缺少的列
                    print(f"正在更新表 {table_name} 的结构...")
                    self.cursor.execute(f"""
                        ALTER TABLE {table_name}
                        ADD COLUMN parking_rows INT NULL,
                        ADD COLUMN parking_columns INT NULL
                    """)
                
                if not has_reservation:
                    # 添加reservation列
                    print(f"正在为表 {table_name} 添加reservation字段...")
                    self.cursor.execute(f"""
                        ALTER TABLE {table_name}
                        ADD COLUMN reservation JSON NULL
                    """)
            else:
                # 创建新表
                self.cursor.execute(f"""
                    CREATE TABLE IF NOT EXISTS {table_name} (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        timestamp DATETIME NOT NULL,
                        total_slots INT NOT NULL,
                        free_slots INT NOT NULL,
                        free_positions JSON,
                        parking_rows INT,
                        parking_columns INT,
                        reservation JSON NULL,
                        source_type ENUM('image', 'video', 'camera') NOT NULL
                    )
                """)
            
            self.connection.commit()
            print(f"数据表检查/创建/更新完成，当前使用停车场层数: {self.parking_layer}, 表名: {table_name}")
            print("-"*50)  # 添加分隔线
        except mysql.connector.Error as err:
            print(f"创建/更新数据表失败: {err}")
            raise
    
    def upload_result(self, timestamp, total_slots, free_slots, free_positions, source_type, parking_rows=None, parking_columns=None):
        """
        上传停车场分析结果到数据库
        
        Args:
            timestamp: 时间戳
            total_slots: 总车位数
            free_slots: 空闲车位数
            free_positions: 空闲车位位置列表
            source_type: 数据来源类型 ('image', 'video', 'camera')
            parking_rows: 停车场行数
            parking_columns: 停车场列数
        
        Returns:
            record_id: 插入记录的ID
        """
        try:
            # 如果传入的是时间戳而不是datetime对象，转换为datetime
            if isinstance(timestamp, (int, float)):
                dt = datetime.fromtimestamp(timestamp)
            else:
                dt = timestamp
            
            # 将列表转换为JSON字符串
            positions_json = json.dumps(free_positions)
            
            # 使用对应层数的表
            table_name = f"parking_status_{self.parking_layer}"
            
            # 插入记录到对应层的表
            query = f"""
                INSERT INTO {table_name} 
                (timestamp, total_slots, free_slots, free_positions, source_type, parking_rows, parking_columns)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            values = (dt, total_slots, free_slots, positions_json, source_type, parking_rows, parking_columns)
            
            self.cursor.execute(query, values)
            
            # 获取插入的ID
            record_id = self.cursor.lastrowid
            
            self.connection.commit()
            
            print(f"记录已上传到数据库表 {table_name}，ID: {record_id}")
            
            return record_id
        
        except mysql.connector.Error as err:
            print(f"上传记录失败: {err}")
            self.connection.rollback()
            raise
    
    def close(self):
        """关闭数据库连接"""
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()
            print("数据库连接已关闭")
    
    def __enter__(self):
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


# 保持独立执行时的简单测试
if __name__ == "__main__":
    # 测试数据库连接
    with ParkingDatabase() as db:
        print("数据库测试完成")
