# 零点跃迁停车场管理系统 - 前端界面

## 功能特点

- 多楼层(B1-B3)停车位状态查询与显示
- 行-列格式车位标识系统 (如3-2表示第3行第2列)
- 自适应不同楼层的车位布局配置
- 实时车位状态显示 (空闲、占用、已预约)
- 用户注册登录与车位预约管理
- 响应式界面设计

## 系统架构

### 完整目录结构
```
/var/www/html/
└── frontend/             # 主项目目录
    ├── api/              # 后端API接口
    │   ├── includes/     # 数据库连接和配置
    │   │   └── config.php # 数据库配置文件
    │   ├── parking_status.php 
    │   ├── reservation.php
    │   ├── login.php    
    │   ├── register.php  
    │   └── create_tables.sql
    ├── js/
    │   └── script.js     # 主要功能脚本
    ├── css/              # 样式文件
    ├── img/              # 图片资源
    ├── index.html        # 主页面
    ├── login.html        # 登录页面
    ├── register.html     # 注册页面
    └── user.html         # 用户中心
```

### 技术栈
- 前端：HTML5, CSS3, JavaScript (ES6+), Font Awesome
- 后端：PHP 7.0+, MySQL 5.7+
- 服务器：Nginx + PHP-FPM

## 部署说明

### 必要文件
打包时需包含以下内容：
1. 整个`frontend`目录（包含所有子目录和文件）

### 服务器环境要求
- Nginx 1.14+
- PHP 7.0+ (8.1推荐)，配置PHP-FPM
- MySQL 5.7+

### 环境配置步骤

#### 1. 基础环境安装（Ubuntu/Debian系统）

```bash
# 更新系统
sudo apt update
sudo apt upgrade -y

# 安装常用工具
sudo apt install -y wget curl vim git unzip
```

#### 2. 安装Nginx

```bash
# 安装Nginx
sudo apt install -y nginx

# 启动Nginx并设置开机自启
sudo systemctl start nginx
sudo systemctl enable nginx

# 检查Nginx状态
sudo systemctl status nginx
```

#### 3. 安装PHP和必要扩展

```bash
# 添加PHP仓库（可选，获取最新版本）
sudo add-apt-repository ppa:ondrej/php
sudo apt update

# 安装PHP 8.1及相关扩展
sudo apt install -y php8.1-fpm php8.1-cli php8.1-common php8.1-mysql \
    php8.1-zip php8.1-gd php8.1-mbstring php8.1-curl php8.1-xml php8.1-bcmath

# 启动PHP-FPM并设置开机自启
sudo systemctl start php8.1-fpm
sudo systemctl enable php8.1-fpm

# 检查PHP-FPM状态
sudo systemctl status php8.1-fpm
```

#### 4. 安装MySQL（如未安装）

```bash
# 安装MySQL
sudo apt install -y mysql-server

# 启动MySQL并设置开机自启
sudo systemctl start mysql
sudo systemctl enable mysql

# 初始化安全设置（按提示操作）
sudo mysql_secure_installation
```

#### 5. 配置PHP

```bash
# 编辑PHP配置文件
sudo vim /etc/php/8.1/fpm/php.ini
```

调整以下参数：
```ini
memory_limit = 128M
upload_max_filesize = 20M
post_max_size = 20M
max_execution_time = 300
date.timezone = Asia/Shanghai  # 设置为您的时区
```

```bash
# 重启PHP-FPM使配置生效
sudo systemctl restart php8.1-fpm
```

#### 6. 配置文件权限

```bash
# 设置网站目录所有权
sudo mkdir -p /var/www/html/frontend
sudo chown -R www-data:www-data /var/www/html
sudo chmod -R 755 /var/www/html
```

#### 7. 验证环境配置

```bash
# 检查Nginx版本
nginx -v

# 检查PHP版本及安装的扩展
php -v
php -m

# 检查MySQL版本
mysql --version
```

### Nginx部署步骤

1. **上传文件**
   - 将整个`frontend`目录上传到服务器网站根目录（通常为`/var/www/html/`）
   - 确保Web服务器用户（如www-data）对目录有读取权限

2. **创建数据库**
   - 创建MySQL数据库并导入初始化表结构：
     ```
     mysql -u username -p database_name < /var/www/html/frontend/api/create_tables.sql
     ```

3. **配置数据库连接**
   - 编辑`/var/www/html/frontend/api/includes/config.php`文件：
     ```php
     $config = [
         'db_host' => '数据库主机',
         'db_name' => '数据库名',
         'db_user' => '用户名',
         'db_pass' => '密码',
         'db_port' => 3306
     ];
     ```

4. **配置Nginx**
   - 创建Nginx配置文件`/etc/nginx/conf.d/frontend.conf`：
     ```nginx
     server {
         listen 80;
         server_name 你的域名或IP地址;
         
         # 网站根目录
         root /var/www/html;
         index index.php index.html index.htm;
         
         # 日志配置
         access_log /var/log/nginx/frontend_access.log;
         error_log /var/log/nginx/frontend_error.log;
         
         # 静态文件处理
         location ~* \.(js|css|png|jpg|jpeg|gif|ico)$ {
             expires 30d;
             access_log off;
         }
         
         # 处理/api路径下的PHP文件 - 优先级高
         location ~ ^/api/(.+\.php)$ {
             fastcgi_pass unix:/run/php/php8.1-fpm.sock;  # 调整为您的PHP-FPM版本
             fastcgi_index index.php;
             fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
             include fastcgi_params;
             fastcgi_read_timeout 300;
         }
         
         # 处理frontend/api目录下的PHP文件
         location ~ ^/frontend/api/(.+\.php)$ {
             fastcgi_pass unix:/run/php/php8.1-fpm.sock;  # 调整为您的PHP-FPM版本
             fastcgi_index index.php;
             fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
             include fastcgi_params;
             fastcgi_read_timeout 300;
         }
         
         # 处理frontend目录下的PHP文件
         location ~ ^/frontend/(.+\.php)$ {
             fastcgi_pass unix:/run/php/php8.1-fpm.sock;  # 调整为您的PHP-FPM版本
             fastcgi_index index.php;
             fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
             include fastcgi_params;
             fastcgi_read_timeout 300;
         }
         
         # 处理frontend目录
         location /frontend {
             try_files $uri $uri/ =404;
         }
         
         # 处理api目录
         location /api {
             try_files $uri $uri/ =404;
         }
         
         # 默认处理
         location / {
             try_files $uri $uri/ =404;
         }
         
         # 禁止访问隐藏文件
         location ~ /\. {
             deny all;
             access_log off;
             log_not_found off;
         }
     }
     ```

5. **验证并重启Nginx**
   - 检查配置文件语法：
     ```
     sudo nginx -t
     ```
   - 如果配置正确，重启Nginx：
     ```
     sudo systemctl restart nginx
     ```

### 验证安装
1. 访问`http://服务器地址/frontend/`
2. 确认能正常显示停车场界面并加载数据
3. 检查浏览器控制台是否有错误信息
4. 查看`/var/log/nginx/frontend_error.log`中是否有异常
5. PHP错误可查看`frontend/api/error.log`

### 配置说明

#### PHP-FPM配置
确保PHP-FPM已正确安装并运行：
```
sudo apt-get install php8.1-fpm php8.1-mysql
sudo systemctl start php8.1-fpm
sudo systemctl enable php8.1-fpm
```

#### 跨域配置
如需启用跨域支持，在Nginx配置中添加：
```nginx
# 在server块内添加
add_header Access-Control-Allow-Origin "*";
add_header Access-Control-Allow-Methods "GET, POST, OPTIONS, PUT, DELETE";
add_header Access-Control-Allow-Headers "Content-Type, Accept, Authorization";

# 处理预检请求
if ($request_method = 'OPTIONS') {
    add_header Access-Control-Allow-Origin "*";
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS, PUT, DELETE";
    add_header Access-Control-Allow-Headers "Content-Type, Accept, Authorization";
    add_header Content-Length 0;
    add_header Content-Type text/plain;
    return 200;
}
```

#### API路径调整
如需修改项目目录结构，需要更新以下内容：
1. 在`js/script.js`中修改API请求路径：
   ```javascript
   const API_BASE_URL = '/你的路径/api';
   ```
2. 同时更新Nginx配置中的location块，确保路径匹配。

## API接口

系统提供四个主要API接口：
- `/api/parking_status.php` - 查询车位状态
- `/api/reservation.php` - 预约和取消车位
- `/api/login.php` - 用户登录认证
- `/api/register.php` - 用户注册

## 核心功能

### 车位行列标识
系统使用直观的行-列标识方式（如3-2），便于用户快速定位车位。

### 车位计数逻辑
```javascript
// 正确的占用车位计算: 总车位 - 空闲车位 - 预约车位
const occupiedSlots = data.totalSlots - data.freeSlots - data.reservedSlots;
```

### 车位状态颜色系统
- 绿色：空闲车位 (可预约)
- 红色：已占用车位
- 蓝色：已预约车位

## 版本信息
当前版本：1.0.3
- 使用行-列格式显示车位
- 修正占用车位计算方式
- 优化预约状态显示
- 支持不同楼层的动态配置 