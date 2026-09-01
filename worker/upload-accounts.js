// 上传四种 AI 账号和额度到 Cloudflare KV
// 用法：node worker/upload-accounts.js
// 需要先配置环境变量 CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, CF_API_TOKEN

const fs = require('fs');
const path = require('path');

const ACCOUNT_ID = process.env.CF_ACCOUNT_ID || 'f10a02c384aab1d3f88e1bb5fddcc569';
const KV_NAMESPACE_ID = process.env.CF_KV_NAMESPACE_ID || '175ab937c0fc4d8fb60a207aa49b831b';
const API_TOKEN = process.env.CF_API_TOKEN;

if (!API_TOKEN) {
  console.error('❌ 错误：缺少 CF_API_TOKEN 环境变量');
  console.error('请在运行前设置：export CF_API_TOKEN=<your-cloudflare-token>');
  process.exit(1);
}

// 定义四种账号类型及其文件路径
const accountTypes = [
  {
    name: 'AI账号天卡',
    file: path.join(__dirname, '..', 'AI账号天卡.txt'),
    kvKey: 'ai_tianka_list',
    parser: (line) => line.trim()
  },
  {
    name: '扣子平台卡密',
    file: path.join(__dirname, '..', '卡密9.2.txt'),
    kvKey: 'coze_keys_list',
    parser: (line) => line.trim()
  },
  {
    name: 'AI额度兑换码',
    file: path.join(__dirname, '..', 'AI额度.txt'),
    kvKey: 'ai_quota_list',
    parser: (line) => line.trim()
  },
  {
    name: 'MMA智能体兑换码',
    file: path.join(__dirname, '..', 'mma兑换码.txt'),
    kvKey: 'mma_keys_list',
    parser: (line) => line.trim()
  }
];

async function uploadToKV() {
  console.log('开始上传四种账号到 Cloudflare KV...\n');

  for (const accountType of accountTypes) {
    try {
      const content = fs.readFileSync(accountType.file, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      console.log(`📤 ${accountType.name}: 解析 ${lines.length} 条`);

      const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${accountType.kvKey}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(lines),
        }
      );

      const data = await res.json();
      if (data.success) {
        console.log(`   ✅ 上传成功！共 ${lines.length} 条\n`);
      } else {
        console.error(`   ❌ 上传失败: ${JSON.stringify(data.errors)}\n`);
      }
    } catch (e) {
      console.error(`   ❌ 错误: ${e.message}\n`);
    }
  }

  console.log('✓ 所有账号上传完成！');
}

uploadToKV();
