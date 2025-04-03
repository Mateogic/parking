# 零点跃迁停车场管理系统

## 系统概述

零点跃迁停车场管理系统是一套综合性的停车场解决方案，包含两个主要组件：
1. IoT组件(部署于边缘设备)：自动识别停车场图像中的空闲和占用车位
2. 前端界面和后端API(部署于云端服务器)：提供用户交互、车位查询和预约等功能

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
3. 注册/登录用户账号
4. 预约空闲车位或取消已预约车位