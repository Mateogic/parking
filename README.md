# 零点跃迁停车场管理系统

## 系统概述

零点跃迁停车场管理系统是一套综合性的停车场解决方案，采用云边协同架构设计，主要包含以下三个层次：

1. 云计算层：
   - 采用前后端分离架构，前端使用Nginx服务器
   - 后端采用PHP实现业务逻辑
   - 数据持久层使用Redis和MySQL的混合存储方案
   - 整体系统通过Docker和docker-compose进行容器化部署
   - 部署在阿里云平台，确保系统的可扩展性和高可用性

2. 边缘计算层：
   - 部署各类智能硬件设备
   - 支持图像、视频和摄像头实时模式
   - 实现车位识别和状态检测
   - 通过边缘计算降低数据传输压力

3. 用户接入层：
   - 支持多种终端设备接入（手机、平板、电脑等）
   - 通过5G网络基站实现高速连接
   - 提供实时车位查询、预约等功能

系统特点：
- 采用网络ACL进行访问控制，确保系统安全
- 实现负载均衡和动态扩缩容
- 支持数据安全管理
- 通过光纤宽带实现高速网络连接

![系统架构](https://github.com/Mateogic/parking/blob/main/assets/architecture.png?raw=true)

## 配置说明

项目包含敏感配置信息，这些信息不应该上传到公共仓库。请按照以下步骤进行配置：

1. 复制配置模板文件：
   - 将 `frontend/api/includes/config.php.example`复制为 `frontend/api/includes/config.php`
   - 将 `Iot/config.py.example` 复制为 `Iot/config.py`

2. 编辑这些文件，将占位符（***）替换为实际的数据库连接信息

3. 确保这些包含敏感信息的文件不会被提交到Git仓库（已在.gitignore中配置）

## 功能特点

### IoT组件功能
- 支持三种输入模式：
  - 单张图片分析
  - 视频文件分析（处理第一帧，然后每10秒处理一帧）
  - 摄像头实时分析（每10秒处理一帧）
- 自动识别停车位区域
- 分析每个停车位的状态（空闲/占用）
- 车位索引排序：从上到下递增行索引，从左到右递增列索引
- 将结果上传到MySQL数据库
- 生成带标记的结果图像，并保存到指定目录

### 前后端系统功能
- 多楼层(B1-B3)停车位状态查询与显示
- 行-列格式车位标识系统 (如3-2表示第3行第2列)
- 自适应不同楼层的车位布局配置(每层停车场的车位布局可能不同)
- 实时车位状态显示 (空闲-绿色、占用-红色、已预约-蓝色)
- 用户信息注册、登录状态维护与车位预约管理
- 响应式界面设计

## 文件目录

```
/
├── Iot/                  # IoT组件目录
│   ├── config.py         # 数据库配置文件
│   ├── main.py           # 主程序
│   ├── process.py        # 图像处理模块
│   ├── upload.py         # 数据上传模块
│   ├── requirements.txt  # 依赖项
│   ├── origin/           # 原始图像/视频存储
│   └── results/          # 处理结果存储
│
└── frontend/             # 前后端系统目录
    ├── api/              # 后端API接口
    │   ├── includes/     # 数据库连接和配置
    │   ├── parking_status.php 
    │   ├── reservation.php
    │   ├── login.php    
    │   └── register.php  
    ├── js/               # JavaScript文件
    ├── css/              # 样式文件
    ├── index.html        # 主页面
    ├── login.html        # 登录页面
    ├── register.html     # 注册页面
    └── user.html         # 用户中心
```

## 安装部署

### IoT组件安装

1. 安装Python依赖：
   ```bash
   cd Iot
   pip install -r requirements.txt
   ```

2. 配置数据库连接：
   修改`Iot/config.py`文件中的数据库连接参数：
   ```python
   DB_CONFIG = {
       'host': 'localhost',
       'user': 'root',
       'password': '你的密码',
       'database': 'parking_system',
       'port': 3306
   }
   ```

### 前后端系统部署

#### 服务器环境要求
- Nginx 1.14+
- PHP 7.0+ (8.1推荐)，配置PHP-FPM
- MySQL 5.7+

#### 部署步骤

1. **安装必要环境**
   ```bash
   # 安装Nginx、PHP和MySQL
   sudo apt update
   sudo apt install nginx php-fpm php-mysql mysql-server
   
   # 启动服务
   sudo systemctl start nginx
   sudo systemctl enable nginx
   sudo systemctl start php8.1-fpm  # 版本号可能不同
   sudo systemctl enable php8.1-fpm
   sudo systemctl start mysql
   sudo systemctl enable mysql
   ```

2. **配置数据库连接**
   - 编辑`frontend/api/includes/config.php`文件：
     ```php
     $config = [
         'db_host' => '数据库主机',
         'db_name' => '数据库名',
         'db_user' => '用户名',
         'db_pass' => '密码',
         'db_port' => 3306
     ];
     ```
   - 初始化数据库表：
     ```bash
     mysql -u 用户名 -p 数据库名 < frontend/api/create_tables.sql
     ```

3. **配置Web服务器**
   - 创建Nginx配置文件 `/etc/nginx/sites-available/parking-system.conf`：
     ```nginx
     server {
         listen 80;
         server_name 你的域名或IP;
         root /var/www/html/parking-system;
         
         index index.html index.php;
         
         location / {
             try_files $uri $uri/ =404;
         }
         
         location ~ \.php$ {
             include snippets/fastcgi-php.conf;
             fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;  # 版本号可能不同
         }
         
         location ~ /\.ht {
             deny all;
         }
     }
     ```
   - 启用站点配置：
     ```bash
     sudo ln -s /etc/nginx/sites-available/parking-system.conf /etc/nginx/sites-enabled/
     sudo nginx -t  # 测试配置
     sudo systemctl reload nginx  # 重新加载配置
     ```

4. **部署前端文件**
   ```bash
   # 复制项目文件到Web根目录
   sudo cp -r frontend/ /var/www/html/parking/
   
   # 设置适当的权限
   sudo chown -R www-data:www-data /var/www/html/parking/
   sudo chmod -R 755 /var/www/html/parking/
   ```

## 使用方法

### IoT组件使用

1. **处理单张图片**
   ```bash
   python Iot/main.py image 图片路径
   ```

2. **处理视频文件**
   ```bash
   python Iot/main.py video 视频路径
   ```

3. **使用摄像头实时分析**
   ```bash
   python Iot/main.py camera
   ```

### 前端界面使用

1. 访问主页`http://服务器地址/frontend/`
2. 查看当前各楼层停车位状态
![停车场状态](https://raw.githubusercontent.com/Mateogic/parking/refs/heads/main/assets/img1.png)
3. 注册/登录用户账号
- 注册
![注册](https://raw.githubusercontent.com/Mateogic/parking/refs/heads/main/assets/img2.png)
- 登录
![登录](https://raw.githubusercontent.com/Mateogic/parking/refs/heads/main/assets/img3.png)

4. 预约空闲车位或取消已预约车位
- 预约
![预约](https://raw.githubusercontent.com/Mateogic/parking/refs/heads/main/assets/img4.png)
- 取消预约
![取消预约](https://raw.githubusercontent.com/Mateogic/parking/refs/heads/main/assets/img5.png)

## 数据表结构

系统使用MySQL数据库，包含以下几个主要数据表：

### 1. 用户表 (users)

**建表语句：**
```sql
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `phone` varchar(20) NOT NULL,
  `password` varchar(255) NOT NULL,
  `token` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**表结构：**

| 字段名 | 数据类型 | 约束 | 说明 |
|:------:|:--------:|:----:|:-----|
| **id** | int(11) | PRIMARY KEY, AUTO_INCREMENT | 用户ID，自增主键 |
| **name** | varchar(50) | NOT NULL | 用户姓名 |
| **phone** | varchar(20) | NOT NULL, UNIQUE | 手机号码，唯一键 |
| **password** | varchar(255) | NOT NULL | 加密后的密码 |
| **token** | varchar(255) | DEFAULT NULL | 用户令牌 |
| **created_at** | timestamp | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |

---

### 2. 会话表 (sessions)

**建表语句：**
```sql
CREATE TABLE IF NOT EXISTS sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  session_id VARCHAR(32) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

**表结构：**

| 字段名 | 数据类型 | 约束 | 说明 |
|:------:|:--------:|:----:|:-----|
| **id** | INT | PRIMARY KEY, AUTO_INCREMENT | 会话ID，自增主键 |
| **user_id** | INT | NOT NULL, FOREIGN KEY | 关联用户ID |
| **session_id** | VARCHAR(32) | NOT NULL | 会话唯一标识符 |
| **created_at** | DATETIME | DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| **expires_at** | DATETIME | - | 过期时间 |

---

### 3. 预约历史表 (reservation_history)

**建表语句：**
```sql
CREATE TABLE IF NOT EXISTS `reservation_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `slot_id` int(11) NOT NULL,
  `reservation_time` datetime NOT NULL,
  `reserved_until` datetime NOT NULL,
  `cancel_time` datetime DEFAULT NULL,
  `status` enum('active','completed','cancelled') NOT NULL DEFAULT 'active',
  `extended_times` int(11) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**表结构：**

| 字段名 | 数据类型 | 约束 | 说明 |
|:------:|:--------:|:----:|:-----|
| **id** | int(11) | PRIMARY KEY, AUTO_INCREMENT | 预约记录ID |
| **user_id** | int(11) | NOT NULL | 用户ID |
| **slot_id** | int(11) | NOT NULL | 车位ID |
| **reservation_time** | datetime | NOT NULL | 预约时间 |
| **reserved_until** | datetime | NOT NULL | 预约截止时间 |
| **cancel_time** | datetime | DEFAULT NULL | 取消时间 |
| **status** | enum | NOT NULL, DEFAULT 'active' | 状态：活跃/完成/取消 |
| **extended_times** | int(11) | NOT NULL, DEFAULT '0' | 延长次数 |
| **created_at** | timestamp | NOT NULL, DEFAULT CURRENT_TIMESTAMP | 创建时间 |

---

### 4. 停车场状态表 (parking_status_${层数})

**建表语句：**
```sql
CREATE TABLE IF NOT EXISTS parking_status_${层数} (
  id INT AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME NOT NULL,
  total_slots INT NOT NULL,
  free_slots INT NOT NULL,
  free_positions JSON,
  parking_rows INT,
  parking_columns INT,
  reservation JSON NULL,
  source_type ENUM('image', 'video', 'camera') NOT NULL
);
```

**表结构：**

| 字段名 | 数据类型 | 约束 | 说明 |
|:------:|:--------:|:----:|:-----|
| **id** | INT | PRIMARY KEY, AUTO_INCREMENT | 记录ID |
| **timestamp** | DATETIME | NOT NULL | 时间戳 |
| **total_slots** | INT | NOT NULL | 总车位数 |
| **free_slots** | INT | NOT NULL | 空闲车位数 |
| **free_positions** | JSON | - | 空闲车位位置信息 |
| **parking_rows** | INT | - | 停车场行数 |
| **parking_columns** | INT | - | 停车场列数 |
| **reservation** | JSON | NULL | 预约信息 |
| **source_type** | ENUM | NOT NULL | 数据来源类型 |

**注意事项：**
- 停车场状态表根据不同层数动态创建，例如`parking_status_B1`，`parking_status_B2`等
- `free_positions`字段存储JSON格式的空闲车位位置信息
- `reservation`字段存储JSON格式的预约信息
- `source_type`的枚举值包括：'image'(图片)、'video'(视频)、'camera'(摄像头)
