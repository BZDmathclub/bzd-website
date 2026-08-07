// 运行此脚本将天卡卡密上传到 Cloudflare KV
// 用法：node upload_tianka.js
// 需要先配置环境变量 CF_ACCOUNT_ID, CF_KV_NAMESPACE_ID, CF_API_TOKEN

const fs = require('fs');
const path = require('path');

// 从环境变量获取敏感信息（不直接存储在代码中）
const ACCOUNT_ID = process.env.CF_ACCOUNT_ID || 'f10a02c384aab1d3f88e1bb5fddcc569';
const KV_NAMESPACE_ID = process.env.CF_KV_NAMESPACE_ID || '175ab937c0fc4d8fb60a207aa49b831b';
const API_TOKEN = process.env.CF_API_TOKEN;

if (!API_TOKEN) {
  console.error('❌ 错误：缺少 CF_API_TOKEN 环境变量');
  console.error('请在运行前设置：export CF_API_TOKEN=<your-cloudflare-token>');
  process.exit(1);
}

const filePath = path.join(__dirname, '..', '天卡卡密5.23.txt');
const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim());

const list = lines.map(line => {
  const accMatch = line.match(/账号：(\S+)/);
  const pwdMatch = line.match(/密码：(\S+)/);
  if (accMatch && pwdMatch) {
    return { account: accMatch[1], password: pwdMatch[1] };
  }
  return null;
}).filter(Boolean);

console.log(`解析到 ${list.length} 个天卡账号`);

async function upload() {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/tianka_list`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(list),
    }
  );
  const data = await res.json();
  if (data.success) {
    console.log(`✓ 上传成功！共 ${list.length} 个账号`);
  } else {
    console.error('上传失败:', data.errors);
  }
}

upload();
