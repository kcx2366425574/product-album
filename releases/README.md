# 更新包目录

APK 与 `latest.json` 和代码放在同一个仓库，App 通过 GitHub raw 地址读取并下载。

## 目录

发布后：

```
releases/
├── latest.json                      # App 读取的更新信息
├── product-album-1.3.0.apk          # 安装包
└── README.md
```

## 发布步骤

1. 在 HBuilderX 中云打包 Android APK（版本号以 `src/manifest.json` 为准）。
2. 运行发布脚本：

   ```bash
   node scripts/release.mjs path/to/product-album.apk --notes "修复问题并优化体验"
   ```

   脚本会：
   - 校验 `manifest.json`、`package.json`、`src/utils/appInfo.js` 三处版本号一致；
   - 把 APK 复制为 `releases/product-album-<versionName>.apk`；
   - 计算大小和 SHA-256；
   - 生成 `releases/latest.json`。

3. 提交并推送：

   ```bash
   git add releases
   git commit -m "release: 1.3.0"
   git push
   ```

App 默认从下面的地址检查更新：

```
https://raw.githubusercontent.com/kcx2366425574/product-album/master/releases/latest.json
```

如果换成其他仓库、分支或镜像，可在设置页「应用更新 → 更新地址」里修改，也可以改 `src/utils/appInfo.js` 里的 `DEFAULT_UPDATE_FEED_URL`。

## latest.json 格式

```json
{
  "versionName": "1.3.0",
  "versionCode": 130,
  "apk": "product-album-1.3.0.apk",
  "size": 12345678,
  "sha256": "…",
  "notes": "更新说明",
  "publishedAt": 1760000000000
}
```

- `apk` 可以是相对路径（相对 `latest.json` 所在目录），也可以是完整的 http(s) 地址。
- `versionCode` 可作为同名版本号的兜底比较依据。
- `sha256` 用于核对发布物，当前 App 只展示下载信息，不做自动校验。

## 注意事项

- 仓库必须是公开的，App 才能直接读取 raw 地址；私有仓库需要带 token，不建议把 token 写进安装包。
- GitHub 单文件建议不超过 100MB，超出请改用 Git LFS 或外部 CDN（`apk` 填完整地址即可）。
- 覆盖安装要求新旧 APK 使用同一签名证书，否则 Android 会拒绝安装。
- Android 8+ 需要允许「安装未知应用」，App 在安装失败时会引导跳转授权页。
- 国内网络访问 GitHub raw 可能不稳定，可以在设置页换成 Gitee / CDN 镜像地址。
