# 把 NavSite 发布到 Docker Hub(第一次用也能照做)

目标:把项目打包成一个镜像推到 Docker Hub,之后**任何人只要一条命令 `docker pull 你的用户名/navsite` 就能拿到你的项目**,配合 `docker-compose.prod.yml` 一把启动。

> 全程在**装了 Docker 的机器**上操作(你的服务器即可)。开始前确认:
> - 已注册 Docker Hub 账号(假设用户名是 `myname`,下面命令里都换成你自己的)
> - `docker -v` 能打印版本

---

## 一、整体流程一句话

```
你:  源码 --docker build--> 镜像 --docker push--> Docker Hub
别人:Docker Hub --docker pull--> 镜像 --compose up--> 跑起来
```

镜像的「名字」就是 `你的用户名/仓库名`,比如 `myname/navsite`。推上去之后,这个名字全世界可见、可拉取。

---

## 二、第 1 步:登录 Docker Hub

```bash
docker login
```

按提示输入 Docker Hub 的用户名和密码(或 Access Token)。看到 `Login Succeeded` 即成功。

> 建议用 Access Token 而非密码:Docker Hub 网站 → Account Settings → Security → New Access Token,把生成的串当密码用。

---

## 三、第 2 步:构建镜像

在项目根目录(有 `Dockerfile` 的那层)执行。**把 `myname` 换成你的用户名**,同时打两个标签:一个带版本号、一个 `latest`:

```bash
docker build -t myname/navsite:0.1.0 -t myname/navsite:latest .
```

第一次构建会拉基础镜像、装依赖、跑 `pnpm build`,**需要几分钟且需要联网**。结尾出现 `naming to docker.io/myname/navsite` 之类即成功。

> 国内网络慢的话,给 Docker 配国内镜像加速器(Docker Desktop → Settings → Docker Engine,或 `/etc/docker/daemon.json` 的 `registry-mirrors`),再重试。

验证镜像已生成:

```bash
docker images | grep navsite
```

---

## 四、第 3 步:本地先跑一遍(强烈建议,推之前先验)

用自带的生产编排本地起一套(它会同时拉起 MySQL):

```bash
# 1) 先生成两个密钥,记下来
openssl rand -base64 48    # 这个填 AUTH_SECRET
openssl rand -base64 16    # 这个填 ANALYTICS_SALT

# 2) 编辑 docker-compose.prod.yml:
#    - image 改成 myname/navsite:latest
#    - AUTH_SECRET / ANALYTICS_SALT 换成上面生成的值
#    - 两处密码 change-me-* 改成你自己的

# 3) 启动
docker compose -f docker-compose.prod.yml up -d

# 4) 看日志,确认迁移跑过、服务起来了
docker compose -f docker-compose.prod.yml logs -f app
```

日志里出现 `[entrypoint] migrations applied.` 和 Next.js 的 `Ready` 后,浏览器打开 `http://服务器IP:3000` —— 会进入安装向导。因为 compose 已经把数据库配好了,**向导第 2 步会自动通过,你只需走第 3 步建管理员、第 4 步选导入示例**,完成即可用。

确认没问题后停掉本地测试:

```bash
docker compose -f docker-compose.prod.yml down
```

---

## 五、第 4 步:推送到 Docker Hub

```bash
docker push myname/navsite:0.1.0
docker push myname/navsite:latest
```

推完后,登录 Docker Hub 网站能在 `Repositories` 里看到 `myname/navsite`。**到这里,别人就能拉取你的项目了。**

---

## 六、别人怎么用你的镜像

### 方式 A:用编排(推荐,连数据库一起)

把仓库里的 `docker-compose.prod.yml` 发给对方(或让他从你的 GitHub 拿),改好里面的 `image: myname/navsite:latest` 和两个密钥,然后:

```bash
docker compose -f docker-compose.prod.yml up -d
```

### 方式 B:只拉镜像(自带数据库时)

```bash
docker pull myname/navsite:latest

docker run -d --name navsite -p 3000:3000 \
  -e DATABASE_URL="mysql://用户:密码@数据库主机:3306/navsite?connection_limit=10&pool_timeout=20" \
  -e AUTH_SECRET="$(openssl rand -base64 48)" \
  -e ANALYTICS_SALT="$(openssl rand -base64 16)" \
  -v navsite-uploads:/app/public/uploads \
  -v navsite-backups:/app/data/backups \
  myname/navsite:latest
```

> 注意:`docker run` 单独跑时,数据库要你自己提供,且 `DATABASE_URL` 里的主机名要能从容器内访问到(用 `host.docker.internal` 指向宿主机,或让 MySQL 也在同一 Docker 网络里)。所以**更推荐方式 A**,省心。

---

## 七、多架构镜像(重要:ARM 服务器构建、别人用 x86 会跑不起来)

镜像是**分架构的**。如果你在 ARM 服务器(如部分云主机)上 `docker build`,产出的就是 arm64 镜像;别人在 x86(amd64)机器上拉取会报 `exec format error`。

要让镜像**同时支持 amd64 和 arm64**,用 `buildx` 一次构建多架构并直接推送:

```bash
# 首次:创建并启用一个 buildx 构建器
docker buildx create --name multi --use
docker buildx inspect --bootstrap

# 一次性构建两种架构并推送(注意结尾的 --push)
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t myname/navsite:0.1.0 -t myname/navsite:latest \
  --push .
```

> buildx 多架构构建会同时编译两份,时间更久、更吃内存。只在自己一台机器上部署、不分发给别人时,普通 `docker build` 就够了。

---

## 八、以后更新版本

改了代码后,重新构建并推一个新版本号,同时更新 `latest`:

```bash
docker build -t myname/navsite:0.2.0 -t myname/navsite:latest .
docker push myname/navsite:0.2.0
docker push myname/navsite:latest
```

用户侧更新:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

数据库数据在 `db-data` 卷里,更新镜像不会丢数据;应用启动时会自动跑新迁移。

---

## 九、常见问题

| 现象 | 处理 |
|---|---|
| `docker build` 卡在装依赖 | 给 Docker 配国内镜像加速器;或确认构建机能联网 |
| `denied: requested access to the resource is denied` | 没 `docker login`,或镜像名的用户名和你登录的账号不一致 |
| 别人拉取报 `exec format error` | 架构不匹配,改用第七节的 `buildx` 多架构构建 |
| 容器起来但访问 502/连不上库 | 看 `docker compose logs app`;确认 `DATABASE_URL` 的主机名在容器网络里可达、密码与 MySQL 一致 |
| 想改端口 | compose 里 `ports: - "8080:3000"`,外部就用 8080 |
| 上传的图片/备份重建后没了 | 确认挂了 `uploads` / `backups` 数据卷(compose 里已配好) |

---

## 十、和「源码一键安装」的区别

| 方式 | 适合 | 命令 |
|---|---|---|
| **源码一键安装**(`install.sh`) | 想改代码、在服务器上从源码跑 | `git clone … && ./install.sh` |
| **Docker 镜像** | 只想跑起来、或分发给别人 | `docker compose -f docker-compose.prod.yml up -d` |

两条路都行,互不冲突。
