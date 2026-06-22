# EPQ Camp Companion

面向 AQA EPQ 营地助教的个人工作台：记录学生每日成果，结合最近历史，
通过 DeepSeek 生成中文、英文或双语反馈，并在归档前执行质量检查。

## 运行要求

- Node.js 20.9 或更高版本
- npm
- Supabase 项目
- DeepSeek API Key

```bash
npm install
cp .env.example .env.local
npm run dev
```

## 环境变量

| 变量 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 浏览器可用的 publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | 仅服务端执行原子反馈 RPC；不得暴露给浏览器 |
| `DEEPSEEK_API_KEY` | 仅服务端调用 DeepSeek |
| `DEEPSEEK_MODEL` | 默认 `deepseek-chat` |
| `NEXT_PUBLIC_SITE_URL` | 本地为 `http://localhost:3000`，部署后改为正式域名 |
| `E2E_EMAIL` / `E2E_PASSWORD` | 可选的匿名 E2E 测试账号 |
| `E2E_USE_SYSTEM_CHROME` | 本机已有 Chrome 时可设为 `1`；CI 保持为空并安装 Playwright Chromium |

真实密钥只写入 `.env.local` 或 Vercel 环境变量，不提交到 Git。

## Supabase 初始化

在 SQL Editor 中按顺序执行：

1. `supabase/migrations/202606200001_initial_schema.sql`
2. `supabase/migrations/202606210001_feedback_versions.sql`
3. `supabase/migrations/202606210002_feedback_write_permissions.sql`
4. `supabase/migrations/202606210003_daily_record_revisions.sql`
5. `supabase/migrations/202606220001_auth_profiles.sql`

最后一项迁移会为新注册的 Auth 用户自动创建 `profiles` 记录，并回填已经
存在但缺少资料记录的账号。网站允许助教使用邮箱注册；必须完成邮箱确认后
再返回登录页登录。

如需测试数据，阅读 `supabase/seed.sql`，把占位用户 UUID 替换为匿名测试
账号 UUID 后再取消注释。不要使用学生真实姓名、联系方式或其他个人信息。

### 数据库上线核验

在测试 Supabase 项目中确认：

- 所有业务表已启用 Row Level Security；
- 普通 authenticated 用户只能读取自己的 feedback，不能直接写 feedback、
  feedback messages 或 context relations；
- 原子 RPC 只授予 `service_role`，且 `p_owner_id` 不能跨用户访问；
- 两个并发 revision 使用相同 revision 时只有一个成功；
- RPC 中任一步失败时，feedback、context 和 messages 一起回滚；
- 删除学生前，界面明确提示每日记录、反馈及对话会级联删除。

仓库中的 SQL 测试用于检查迁移结构，不能替代真实 Postgres 集成验证。

## Supabase URL 配置

在 Authentication → URL Configuration 中设置：

- Site URL：本地 `http://localhost:3000`，生产环境为 Vercel 域名；
- Redirect URL：加入 `http://localhost:3000/auth/callback`；
- 生产环境加入 `https://你的域名/auth/callback`。

在 Authentication → Providers → Email 中保持“邮箱确认”开启。用户注册后
会收到验证邮件，验证链接经 `/auth/callback` 返回登录页；验证过程不会让
用户直接进入工作台。

## 验证

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

无需云端凭据的浏览器 smoke：

```bash
npx playwright install chromium
npm run test:e2e:smoke
```

如果本机已经安装 Google Chrome，也可使用：

```bash
E2E_USE_SYSTEM_CHROME=1 npm run test:e2e:smoke
```

完整 E2E 会在配置 Supabase URL、publishable key、service role key、
DeepSeek key、`E2E_EMAIL` 和 `E2E_PASSWORD` 后执行登录、记录、生成、
归档和历史查看；未配置时该用例会明确跳过：

```bash
npm run test:e2e
```

测试和种子数据必须全部匿名。不要把真实学生资料用于本地、CI 或截图。

## 部署到 Vercel

1. 把仓库导入 Vercel。
2. 添加 `.env.example` 中列出的生产环境变量。
3. 将 `NEXT_PUBLIC_SITE_URL` 设置为正式 HTTPS 域名。
4. 在 Supabase 添加正式 Site URL 与 callback URL。
5. 部署后先用非测试邮箱验证注册、邮箱确认、重新登录和创建学生，再用匿名
   测试数据验证每日记录、三种语言、revision 冲突和归档。
6. 在浏览器开发者工具中确认响应和源码不包含 service role 或 DeepSeek Key。

## 隐私说明

建议始终使用“林同学”一类称呼，只保存生成反馈所需的信息。系统不会自动
向家长发送内容；最终反馈必须由助教检查并手动归档。未成功同步的每日草稿
会暂存在当前浏览器的 localStorage 中，正常退出登录时会清理该账号的草稿；
共享设备使用后请务必退出登录。
