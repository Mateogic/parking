# 停车场车位识别系统

这个系统能够自动识别停车场图像中的空闲和占用车位，并将结果上传到MySQL数据库。

## 功能特点

- 支持三种输入模式：
  - 单张图片分析
  - 视频文件分析（处理第一帧，然后每10秒处理一帧）
  - 摄像头实时分析（每10秒处理一帧）
- 自动识别停车位区域
- 分析每个停车位的状态（空闲/占用）
- 车位索引排序：从上到下递增行索引，从左到右递增列索引
- 将结果上传到MySQL数据库
- 生成带标记的结果图像，并保存到指定目录
- 视频处理完成后提供帧浏览功能

## 安装依赖

```bash
pip install -r requirements.txt
```

或手动安装：

```bash
pip install opencv-python numpy mysql-connector-python
```

## 字体配置

系统使用黑体(SimHei)字体显示中文。如果您的系统中没有该字体，请替换`process.py`文件中的字体路径：

```python
# 大约在第35行
fontStyle = ImageFont.truetype("simhei.ttf", textSize, encoding="utf-8")
# 可替换为您系统中可用的其他中文字体
```

## 数据库配置

在运行系统前，请确保已经安装并启动MySQL服务。修改`config.py`文件中的数据库连接参数：

```python
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': '你的密码',
    'database': 'parking_system',
    'port': 3306
}
```

## 使用方法

### 1. 处理单张图片

```bash
python main.py image 图片路径
```

例如：

```bash
python main.py image origin/images/layerb1_1.png
```

### 2. 处理视频文件

```bash
python main.py video 视频路径
```

例如：

```bash
python main.py video origin/videos/video1.mp4
```

系统会立即处理视频的第一帧，然后每隔10秒（基于视频的帧率）处理一帧。视频处理完成后，系统不会自动关闭窗口，而是进入帧浏览模式：

- 使用左右箭头键（或A/D键）浏览不同的处理帧
- 按ESC键关闭窗口并退出

### 3. 使用摄像头实时分析

```bash
python main.py camera
```

## 输出说明

- 处理后的图像将保存在`results/`目录下对应的子文件夹中：
  - 图片模式：`results/images/` 保存为 `原文件名_processed.png`
  - 视频模式：`results/videos/` 保存为 `视频文件名_秒数s.png`（例如：`parking_video_15s.png`）
  - 摄像头模式：`results/camera/` 保存为 `parking_时间戳.png`

- 系统会在控制台中打印分析结果，包括：
  - 总车位数
  - 空闲车位数
  - 空闲车位位置
  - 结果图片保存路径

- 显示的图像会自动调整大小以适应屏幕，确保完整显示所有内容

## 车位索引排序

系统使用以下方法为停车位分配索引编号：
1. 首先按照垂直位置（y坐标）将车位分组到不同行
2. 对每一行内的车位按水平位置（x坐标）从左到右排序
3. 从上到下逐行扫描，确保车位索引符合直观的阅读顺序
4. 最终车位编号反映其在停车场中的实际位置关系

## 数据库结构

系统会自动创建一个名为`parking_records`的表，包含以下字段：

- `id`：记录ID（自增主键）
- `timestamp`：时间戳
- `total_slots`：总车位数
- `free_slots`：空闲车位数
- `free_positions`：空闲车位位置（JSON格式）
- `source_type`：数据来源类型（'image', 'video', 'camera'）

## 实现原理

1. 图像处理：
   - 使用OpenCV检测停车位区域
   - 按照位置对检测到的车位进行排序（从上到下，从左到右）
   - 分析每个停车位内的颜色特征（绿色圆圈表示空闲，红色叉号表示占用）
   - 在结果图像上标记每个车位的状态，使用英文标签（FREE/OCCUPIED）

2. 数据管理：
   - 将分析结果存储到MySQL数据库
   - 保存带标记的结果图像到指定目录

## 注意事项

- 本系统针对具有特定标记的停车场图像设计（绿色圆圈表示空闲，红色叉号表示占用）
- 系统性能受图像质量和标记清晰度影响
- 对于视频和摄像头模式，按键"q"可退出程序
- 如果中文显示不正常，请检查系统字体配置 