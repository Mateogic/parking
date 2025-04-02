# 停车场系统

## 配置说明

项目包含敏感配置信息，这些信息不应该上传到公共仓库。请按照以下步骤进行配置：

1. 复制配置模板文件：
   - 将 `frontend/api/includes/config.php.example`复制为 `frontend/api/includes/config.php`
   - 将 `Iot/config.py.example` 复制为 `Iot/config.py`

2. 编辑这些文件，将占位符（***）替换为实际的数据库连接信息

3. 确保这些包含敏感信息的文件不会被提交到Git仓库（已在.gitignore中配置）
