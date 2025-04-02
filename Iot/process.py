#!/usr/bin/env python
# -*- coding: utf-8 -*-

import cv2
import numpy as np
import os
import time
from datetime import datetime
from config import OUTPUT_DIRS

# 确保输出目录存在
for dir_path in OUTPUT_DIRS.values():
    os.makedirs(dir_path, exist_ok=True)

def detect_parking_slots(image):
    """
    检测图像中的停车位
    
    Args:
        image: 输入图像
    
    Returns:
        sorted_slots: 检测到的停车位列表，每个元素为(x, y, w, h)
        rows_count: 停车场行数
        columns_count: 每行的最大列数
    """
    # 转换为灰度图
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    
    # 边缘检测
    edges = cv2.Canny(gray, 50, 150)
    
    # 查找轮廓
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    # 过滤并提取矩形区域
    slots = []
    for contour in contours:
        # 计算轮廓面积
        area = cv2.contourArea(contour)
        
        # 过滤掉太小的区域
        if area < 1000:
            continue
        
        # 获取最小外接矩形
        x, y, w, h = cv2.boundingRect(contour)
        
        # 保存停车位信息 (x, y, w, h)
        slots.append((x, y, w, h))
    
    # 对停车位进行排序：先按y坐标（行）排序，y相近的按x坐标（列）排序
    # 定义行分组的阈值（同一行的y坐标差异不超过这个值）
    row_threshold = 30
    
    # 按y坐标对车位进行粗略分组
    slots_by_row = {}
    for slot in slots:
        x, y, w, h = slot
        # 查找最近的行
        found_row = False
        for row_y in slots_by_row.keys():
            if abs(y - row_y) < row_threshold:
                slots_by_row[row_y].append(slot)
                found_row = True
                break
        
        # 如果没有找到合适的行，创建新行
        if not found_row:
            slots_by_row[y] = [slot]
    
    # 对每一行内的车位按x坐标排序，并将所有车位重新组织成有序列表
    sorted_slots = []
    
    # 计算行数和最大列数
    rows_count = len(slots_by_row)
    columns_count = 0
    
    # 按照行的y坐标排序（从上到下）
    for row_y in sorted(slots_by_row.keys()):
        # 在行内按x坐标排序（从左到右）
        row_slots = sorted(slots_by_row[row_y], key=lambda slot: slot[0])
        sorted_slots.extend(row_slots)
        
        # 更新最大列数
        columns_count = max(columns_count, len(row_slots))
    
    return sorted_slots, rows_count, columns_count

def check_slot_status(image, slot):
    """
    检查停车位状态（空闲/占用）
    
    Args:
        image: 输入图像
        slot: 停车位区域 (x, y, w, h)
    
    Returns:
        is_free: 是否空闲
        confidence: 置信度
    """
    x, y, w, h = slot
    roi = image[y:y+h, x:x+w]
    
    # 转换到HSV颜色空间以便检测绿色
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
    
    # 绿色范围
    lower_green = np.array([40, 50, 50])
    upper_green = np.array([80, 255, 255])
    
    # 红色范围 (注意红色在HSV中有两个范围)
    lower_red1 = np.array([0, 50, 50])
    upper_red1 = np.array([10, 255, 255])
    lower_red2 = np.array([170, 50, 50])
    upper_red2 = np.array([180, 255, 255])
    
    # 创建掩码
    green_mask = cv2.inRange(hsv, lower_green, upper_green)
    red_mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
    red_mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
    red_mask = red_mask1 + red_mask2
    
    # 计算绿色和红色像素数量
    green_pixels = cv2.countNonZero(green_mask)
    red_pixels = cv2.countNonZero(red_mask)
    
    # 如果绿色像素多于红色像素，则认为车位空闲
    is_free = green_pixels > red_pixels
    
    # 计算置信度
    total = max(1, green_pixels + red_pixels)  # 避免除以零
    confidence = max(green_pixels, red_pixels) / total
    
    return is_free, confidence

def process_image(image_path):
    """
    处理单张图片
    
    Args:
        image_path: 图片路径
    
    Returns:
        result_image: 处理后的图片
        free_count: 空闲车位数量
        free_slots: 空闲车位位置列表
        total_slots: 总车位数
        rows_count: 停车场行数
        columns_count: 每行的最大列数
    """
    # 读取图片
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError(f"无法读取图片: {image_path}")
    
    # 创建结果图像副本
    result_image = image.copy()
    
    # 检测停车位
    slots, rows_count, columns_count = detect_parking_slots(image)
    
    # 分析每个停车位状态
    free_slots = []
    free_count = 0
    total_slots = len(slots)  # 总车位数就是检测到的所有车位数量
    
    for i, slot in enumerate(slots):
        x, y, w, h = slot
        is_free, confidence = check_slot_status(image, slot)
        
        # 绘制矩形框
        color = (0, 255, 0) if is_free else (0, 0, 255)  # 绿色表示空闲，红色表示占用
        cv2.rectangle(result_image, (x, y), (x+w, y+h), color, 2)
        
        # 添加编号标签（从1开始）
        slot_id = i + 1
        
        # 添加英文文本标签
        label = f"FREE #{slot_id}" if is_free else f"OCCUPIED #{slot_id}"
        
        # 设置字体
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.7
        thickness = 2
        text_size = cv2.getTextSize(label, font, font_scale, thickness)[0]
        
        # 添加背景矩形
        cv2.rectangle(result_image, (x, y-30), (x+text_size[0]+10, y), color, -1)
        
        # 添加文字
        cv2.putText(result_image, label, (x+5, y-8), font, font_scale, (255, 255, 255), thickness)
        
        # 更新统计信息
        if is_free:
            free_count += 1
            free_slots.append(slot_id)  # 车位编号从1开始
    
    return result_image, free_count, free_slots, total_slots, rows_count, columns_count

def save_result_image(image, mode, timestamp=None, original_path=None, frame_time=None):
    """
    保存处理结果图像
    
    Args:
        image: 处理后的图像
        mode: 模式 ('image', 'video', 'camera')
        timestamp: 时间戳，默认为当前时间
        original_path: 原始图像路径，用于提取文件名
        frame_time: 视频中的帧时间（秒），用于视频模式
    
    Returns:
        saved_path: 保存的文件路径
    """
    output_dir = OUTPUT_DIRS[f'{mode}_output']
    
    if mode == 'image' and original_path:
        # 提取原始文件名（不含扩展名）
        original_filename = os.path.splitext(os.path.basename(original_path))[0]
        output_file = os.path.join(output_dir, f'{original_filename}_processed.png')
    elif mode == 'video' and original_path and frame_time is not None:
        # 提取视频文件名（不含扩展名）
        video_filename = os.path.splitext(os.path.basename(original_path))[0]
        # 将帧时间转换为整数秒
        seconds = int(frame_time)
        output_file = os.path.join(output_dir, f'{video_filename}_{seconds}s.png')
    else:
        # 对于摄像头帧和其他情况，继续使用时间戳
        if timestamp is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_file = os.path.join(output_dir, f'parking_{timestamp}.png')
    
    cv2.imwrite(output_file, image)
    return output_file

def process_video(video_path):
    """
    处理视频文件
    
    Args:
        video_path: 视频文件路径
    
    Yields:
        timestamp: 时间戳
        result_image: 处理后的图片
        free_count: 空闲车位数量
        free_slots: 空闲车位位置列表
        frame_time: 当前帧在视频中的时间（秒）
        total_slots: 总车位数
        rows_count: 停车场行数
        columns_count: 每行的最大列数
    """
    cap = cv2.VideoCapture(video_path)
    
    if not cap.isOpened():
        raise ValueError(f"无法打开视频: {video_path}")
    
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_interval = int(fps * 10)  # 每10秒处理一帧
    frame_count = 0
    
    while cap.isOpened():
        ret, frame = cap.read()
        
        if not ret:
            break
        
        frame_count += 1
        
        # 计算当前帧在视频中的时间（秒）
        frame_time = frame_count / fps
        
        # 处理第一帧或每隔指定帧数处理一次
        if frame_count == 1 or frame_count % frame_interval == 0:
            # 保存当前帧为临时文件
            temp_file = 'temp_frame.jpg'
            cv2.imwrite(temp_file, frame)
            
            try:
                # 处理帧
                result_image, free_count, free_slots, total_slots, rows_count, columns_count = process_image(temp_file)
                timestamp = time.time()
                
                yield timestamp, result_image, free_count, free_slots, frame_time, total_slots, rows_count, columns_count
            finally:
                # 清理临时文件
                if os.path.exists(temp_file):
                    os.remove(temp_file)
    
    cap.release()

def process_camera():
    """
    处理摄像头输入
    
    Yields:
        timestamp: 时间戳
        result_image: 处理后的图片
        free_count: 空闲车位数量
        free_slots: 空闲车位位置列表
        total_slots: 总车位数
        rows_count: 停车场行数
        columns_count: 每行的最大列数
    """
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        raise ValueError("无法打开摄像头")
    
    last_process_time = 0
    
    while cap.isOpened():
        ret, frame = cap.read()
        
        if not ret:
            break
        
        current_time = time.time()
        
        # 每10秒处理一次
        if current_time - last_process_time >= 10:
            last_process_time = current_time
            
            # 保存当前帧为临时文件
            temp_file = 'temp_frame.jpg'
            cv2.imwrite(temp_file, frame)
            
            try:
                # 处理帧
                result_image, free_count, free_slots, total_slots, rows_count, columns_count = process_image(temp_file)
                
                yield current_time, result_image, free_count, free_slots, total_slots, rows_count, columns_count
            finally:
                # 清理临时文件
                if os.path.exists(temp_file):
                    os.remove(temp_file)
    
    cap.release()
