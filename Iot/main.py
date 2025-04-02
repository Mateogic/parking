#!/usr/bin/env python
# -*- coding: utf-8 -*-

import os
import sys
import argparse
import time
from datetime import datetime
import cv2
import numpy as np

import process
from upload import ParkingDatabase
from config import OUTPUT_DIRS, PROCESS_CONFIG

def main():
    """主函数，解析命令行参数并调用相应的处理函数"""
    # 创建命令行参数解析器
    parser = argparse.ArgumentParser(description="停车场车位识别系统")
    
    # 添加子命令
    subparsers = parser.add_subparsers(dest="mode", help="运行模式")
    
    # 图片模式
    image_parser = subparsers.add_parser("image", help="处理单张图片")
    image_parser.add_argument("image_path", help="图片文件路径")
    
    # 视频模式
    video_parser = subparsers.add_parser("video", help="处理视频文件")
    video_parser.add_argument("video_path", help="视频文件路径")
    
    # 摄像头模式
    camera_parser = subparsers.add_parser("camera", help="处理摄像头输入")
    
    # 解析命令行参数
    args = parser.parse_args()
    
    # 确保输出目录存在
    for dir_path in OUTPUT_DIRS.values():
        os.makedirs(dir_path, exist_ok=True)
    
    # 根据运行模式调用相应的处理函数
    try:
        if args.mode == "image":
            # 先处理图片和上传数据
            result_data = process_and_upload_image(args.image_path)
            # 再显示UI
            display_image_result(result_data)
        elif args.mode == "video":
            # 先处理视频和上传数据
            processed_frames = process_and_upload_video(args.video_path)
            # 再显示UI
            display_video_results(processed_frames)
        elif args.mode == "camera":
            # 摄像头模式需要实时处理和显示
            process_camera_with_display()
        else:
            parser.print_help()
            sys.exit(1)
    except Exception as e:
        print(f"错误: {e}")
        sys.exit(1)

def process_and_upload_image(image_path):
    """处理图片并上传到数据库，返回显示所需的数据"""
    print(f"处理图片: {image_path}")
    print(f"当前停车场层数: {PROCESS_CONFIG['parking_layer']}")
    print("-"*50)  # 添加分隔线
    
    # 处理图片
    result_image, free_count, free_slots, total_slots, rows_count, columns_count = process.process_image(image_path)
    
    # 创建信息文本
    info_text = f"File: {os.path.basename(image_path)} | Layer: {PROCESS_CONFIG['parking_layer']} | Free: {free_count} | Grid: {rows_count}x{columns_count}"
    
    # 获取原始图像尺寸
    img_h, img_w = result_image.shape[:2]
    
    # 创建一个带有信息栏的扩展图像，底部添加50像素高的信息栏
    info_bar_height = 50
    extended_image = np.zeros((img_h + info_bar_height, img_w, 3), dtype=np.uint8)
    
    # 填充信息栏部分为深蓝色背景
    extended_image[img_h:img_h+info_bar_height, 0:img_w] = (100, 50, 0)  # BGR格式，加深颜色
    
    # 将原始图像放在信息栏上方
    extended_image[0:img_h, 0:img_w] = result_image
    
    # 在信息栏上添加文本，增加字体大小和粗细
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 1.2  # 增大字体比例
    thickness = 3     # 增加字体粗细
    
    # 计算文本位置，使其在信息栏中居中
    text_size = cv2.getTextSize(info_text, font, font_scale, thickness)[0]
    text_x = (img_w - text_size[0]) // 2  # 水平居中
    text_y = img_h + (info_bar_height + text_size[1]) // 2  # 垂直居中
    
    # 添加文本（带黑色描边使其在任何背景下都清晰可见）
    # 先绘制黑色描边
    cv2.putText(extended_image, info_text, (text_x, text_y), font, font_scale, (0, 0, 0), thickness+2)
    # 再绘制白色文字
    cv2.putText(extended_image, info_text, (text_x, text_y), font, font_scale, (255, 255, 255), thickness)
    
    # 保存结果图片
    timestamp = datetime.now()
    saved_path = process.save_result_image(extended_image, 'image', timestamp.strftime("%Y%m%d_%H%M%S"), image_path)
    
    # 计算被占用车位数
    occupied_slots = total_slots - free_count
    
    # 上传结果到数据库
    with ParkingDatabase() as db:
        db.upload_result(
            timestamp=timestamp,
            total_slots=total_slots,
            free_slots=free_count,
            free_positions=free_slots,
            source_type='image',
            parking_rows=rows_count,
            parking_columns=columns_count
        )
    
    # 打印结果
    print(f"停车场分析结果:")
    print(f"停车场层数: {PROCESS_CONFIG['parking_layer']}")
    print(f"停车场网格: {rows_count}行 x {columns_count}列")
    print(f"总车位数: {total_slots}")
    print(f"空闲车位数: {free_count}")
    print(f"被占用车位数: {occupied_slots}")
    print(f"空闲车位位置: {free_slots}")
    print(f"结果图片已保存至: {saved_path}")
    print("="*50)  # 添加分隔线
    
    # 返回显示所需的数据
    return {
        'image': extended_image,
        'saved_path': saved_path,
        'free_count': free_count,
        'free_slots': free_slots,
        'total_slots': total_slots,
        'occupied_slots': occupied_slots,
        'rows_count': rows_count,
        'columns_count': columns_count
    }

def display_image_result(result_data):
    """显示图片处理结果"""
    # 获取处理后的图像
    extended_image = result_data['image']
    
    # 调整图像大小以适应屏幕
    h, w = extended_image.shape[:2]
    max_height = 800  # 最大显示高度
    max_width = 1200  # 最大显示宽度
    
    # 如果图像太大，按比例缩小
    if h > max_height or w > max_width:
        scale = min(max_height / h, max_width / w)
        display_image = cv2.resize(extended_image, (int(w * scale), int(h * scale)))
    else:
        display_image = extended_image
    
    # 显示结果图片
    cv2.namedWindow("停车场分析结果", cv2.WINDOW_NORMAL)
    cv2.imshow("停车场分析结果", display_image)
    cv2.waitKey(0)
    cv2.destroyAllWindows()

def process_and_upload_video(video_path):
    """处理视频并上传到数据库，返回所有处理后的帧"""
    print(f"处理视频: {video_path}")
    print(f"当前停车场层数: {PROCESS_CONFIG['parking_layer']}")
    print("-"*50)  # 添加分隔线
    
    # 保存所有处理过的帧，用于后续显示
    processed_frames = []
    
    with ParkingDatabase() as db:
        for timestamp, result_image, free_count, free_slots, frame_time, total_slots, rows_count, columns_count in process.process_video(video_path):
            # 创建信息文本
            info_text = f"Frame: {len(processed_frames)+1} | Time: {int(frame_time)}s | Layer: {PROCESS_CONFIG['parking_layer']} | Free: {free_count} | Grid: {rows_count}x{columns_count}"
            
            # 获取原始图像尺寸
            img_h, img_w = result_image.shape[:2]
            
            # 创建一个带有信息栏的扩展图像，底部添加50像素高的信息栏
            info_bar_height = 50
            extended_image = np.zeros((img_h + info_bar_height, img_w, 3), dtype=np.uint8)
            
            # 填充信息栏部分为深蓝色背景
            extended_image[img_h:img_h+info_bar_height, 0:img_w] = (100, 50, 0)  # BGR格式，加深颜色
            
            # 将原始图像放在信息栏上方
            extended_image[0:img_h, 0:img_w] = result_image
            
            # 在信息栏上添加文本，增加字体大小和粗细
            font = cv2.FONT_HERSHEY_SIMPLEX
            font_scale = 1.2  # 增大字体比例
            thickness = 3     # 增加字体粗细
            
            # 计算文本位置，使其在信息栏中居中
            text_size = cv2.getTextSize(info_text, font, font_scale, thickness)[0]
            text_x = (img_w - text_size[0]) // 2  # 水平居中
            text_y = img_h + (info_bar_height + text_size[1]) // 2  # 垂直居中
            
            # 添加文本（带黑色描边使其在任何背景下都清晰可见）
            # 先绘制黑色描边
            cv2.putText(extended_image, info_text, (text_x, text_y), font, font_scale, (0, 0, 0), thickness+2)
            # 再绘制白色文字
            cv2.putText(extended_image, info_text, (text_x, text_y), font, font_scale, (255, 255, 255), thickness)
            
            # 保存结果图片，传递视频路径和帧时间
            saved_path = process.save_result_image(
                extended_image,  # 保存带信息栏的图像
                'video', 
                timestamp=datetime.fromtimestamp(timestamp).strftime("%Y%m%d_%H%M%S"),
                original_path=video_path,
                frame_time=frame_time
            )
            
            # 计算被占用车位数
            occupied_slots = total_slots - free_count  # 被占用的车位数
            
            # 上传结果到数据库
            db.upload_result(
                timestamp=timestamp,
                total_slots=total_slots,
                free_slots=free_count,
                free_positions=free_slots,
                source_type='video',
                parking_rows=rows_count,
                parking_columns=columns_count
            )
            
            # 打印结果
            print(f"时间: {datetime.fromtimestamp(timestamp)}")
            print(f"视频时间: {int(frame_time)}秒")
            print(f"停车场层数: {PROCESS_CONFIG['parking_layer']}")
            print(f"停车场网格: {rows_count}行 x {columns_count}列")
            print(f"总车位数: {total_slots}")
            print(f"空闲车位数: {free_count}")
            print(f"被占用车位数: {occupied_slots}")
            print(f"空闲车位位置: {free_slots}")
            print(f"结果图片已保存至: {saved_path}")
            print("="*50)  # 添加分隔线
            
            # 保存当前帧和信息，以便后续显示
            processed_frames.append((extended_image, frame_time, free_count, free_slots, total_slots, occupied_slots, rows_count, columns_count))
    
    # 数据库连接已关闭，返回处理后的帧
    return processed_frames

def display_video_results(processed_frames):
    """显示视频处理结果"""
    if not processed_frames:
        print("没有处理的帧可显示")
        return
    
    # 创建一个窗口
    cv2.namedWindow("停车场分析结果", cv2.WINDOW_NORMAL)
    
    # 首先显示所有帧的处理过程
    for i, (frame_img, frame_time, free_count, _, total_slots, occupied_slots, rows_count, columns_count) in enumerate(processed_frames):
        # 显示当前处理进度
        print(f"\r正在显示处理过程: {i+1}/{len(processed_frames)}", end="")
        
        # 调整图像大小以适应屏幕
        h, w = frame_img.shape[:2]
        max_height = 800
        max_width = 1200
        
        if h > max_height or w > max_width:
            scale = min(max_height / h, max_width / w)
            display_image = cv2.resize(frame_img, (int(w * scale), int(h * scale)))
        else:
            display_image = frame_img
        
        # 显示结果图片
        cv2.imshow("停车场分析结果", display_image)
        
        # 每帧显示100毫秒
        key = cv2.waitKey(100) & 0xFF
        if key == ord('q'):
            break
    
    print("\n视频处理显示完成，请按任意键浏览各帧，或按ESC关闭窗口")
    
    # 循环显示所有处理过的帧，直到用户按ESC退出
    current_frame = 0
    while True:
        # 获取当前帧信息
        frame_img, frame_time, frame_free_count, frame_free_slots, total_slots, occupied_slots, rows_count, columns_count = processed_frames[current_frame]
        
        # 调整图像大小以适应屏幕
        h, w = frame_img.shape[:2]
        max_height = 800  # 最大显示高度
        max_width = 1200  # 最大显示宽度
        
        # 如果图像太大，按比例缩小
        if h > max_height or w > max_width:
            scale = min(max_height / h, max_width / w)
            display_image = cv2.resize(frame_img, (int(w * scale), int(h * scale)))
        else:
            display_image = frame_img
            
        # 显示图像
        cv2.imshow("停车场分析结果", display_image)
        
        # 等待用户按键
        key = cv2.waitKey(0) & 0xFF
        
        # 如果按ESC，退出循环
        if key == 27:  # ESC键
            break
        # 如果按右箭头，显示下一帧
        elif key == 83 or key == ord('d'):  # 右箭头或d键
            current_frame = (current_frame + 1) % len(processed_frames)
        # 如果按左箭头，显示上一帧
        elif key == 81 or key == ord('a'):  # 左箭头或a键
            current_frame = (current_frame - 1) % len(processed_frames)
    
    cv2.destroyAllWindows()
    print("视频浏览结束")

def process_camera_with_display():
    """处理摄像头输入，结合数据处理和UI显示"""
    print("启动摄像头模式...")
    print(f"当前停车场层数: {PROCESS_CONFIG['parking_layer']}")
    print("-"*50)  # 添加分隔线
    
    # 创建一个窗口
    cv2.namedWindow("停车场分析结果", cv2.WINDOW_NORMAL)
    
    # 帧计数器
    frame_count = 0
    
    try:
        # 摄像头模式需要实时处理，所以数据库连接需要在整个过程中保持
        with ParkingDatabase() as db:
            for timestamp, result_image, free_count, free_slots, total_slots, rows_count, columns_count in process.process_camera():
                frame_count += 1
                
                # 创建信息文本
                info_text = f"Camera Frame: {frame_count} | Time: {datetime.fromtimestamp(timestamp).strftime('%H:%M:%S')} | Layer: {PROCESS_CONFIG['parking_layer']} | Free: {free_count} | Grid: {rows_count}x{columns_count}"
                
                # 获取原始图像尺寸
                img_h, img_w = result_image.shape[:2]
                
                # 创建一个带有信息栏的扩展图像，底部添加50像素高的信息栏
                info_bar_height = 50
                extended_image = np.zeros((img_h + info_bar_height, img_w, 3), dtype=np.uint8)
                
                # 填充信息栏部分为深蓝色背景
                extended_image[img_h:img_h+info_bar_height, 0:img_w] = (100, 50, 0)  # BGR格式，加深颜色
                
                # 将原始图像放在信息栏上方
                extended_image[0:img_h, 0:img_w] = result_image
                
                # 在信息栏上添加文本，增加字体大小和粗细
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 1.2  # 增大字体比例
                thickness = 3     # 增加字体粗细
                
                # 计算文本位置，使其在信息栏中居中
                text_size = cv2.getTextSize(info_text, font, font_scale, thickness)[0]
                text_x = (img_w - text_size[0]) // 2  # 水平居中
                text_y = img_h + (info_bar_height + text_size[1]) // 2  # 垂直居中
                
                # 添加文本（带黑色描边使其在任何背景下都清晰可见）
                # 先绘制黑色描边
                cv2.putText(extended_image, info_text, (text_x, text_y), font, font_scale, (0, 0, 0), thickness+2)
                # 再绘制白色文字
                cv2.putText(extended_image, info_text, (text_x, text_y), font, font_scale, (255, 255, 255), thickness)
                
                # 保存结果图片
                saved_path = process.save_result_image(
                    extended_image, 
                    'camera', 
                    datetime.fromtimestamp(timestamp).strftime("%Y%m%d_%H%M%S")
                )
                
                # 计算被占用车位数
                occupied_slots = total_slots - free_count  # 被占用的车位数
                
                # 上传结果到数据库
                db.upload_result(
                    timestamp=timestamp,
                    total_slots=total_slots,
                    free_slots=free_count,
                    free_positions=free_slots,
                    source_type='camera',
                    parking_rows=rows_count,
                    parking_columns=columns_count
                )
                
                # 打印结果
                print(f"时间: {datetime.fromtimestamp(timestamp)}")
                print(f"停车场层数: {PROCESS_CONFIG['parking_layer']}")
                print(f"停车场网格: {rows_count}行 x {columns_count}列")
                print(f"总车位数: {total_slots}")
                print(f"空闲车位数: {free_count}")
                print(f"被占用车位数: {occupied_slots}")
                print(f"空闲车位位置: {free_slots}")
                print(f"结果图片已保存至: {saved_path}")
                print("="*50)  # 添加分隔线
                
                # 调整图像大小以适应屏幕
                h, w = extended_image.shape[:2]
                max_height = 800  # 最大显示高度
                max_width = 1200  # 最大显示宽度
                
                # 如果图像太大，按比例缩小
                if h > max_height or w > max_width:
                    scale = min(max_height / h, max_width / w)
                    display_image = cv2.resize(extended_image, (int(w * scale), int(h * scale)))
                else:
                    display_image = extended_image
                
                # 显示结果图片
                cv2.imshow("停车场分析结果", display_image)
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    break
    
    except KeyboardInterrupt:
        print("用户中断，停止摄像头模式")
    finally:
        cv2.destroyAllWindows()
        print("摄像头模式已结束")

if __name__ == "__main__":
    main()
