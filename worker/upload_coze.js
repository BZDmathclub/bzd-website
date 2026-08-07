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

const filePath = path.join(__dirname, '..', '卡密8.7.txt');
const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim());

const list = lines.map(line => {
  const match = line.match(/卡密[【\[]([^\]】]+)[】\]]/);
  return match ? match[1] : null;
}).filter(Boolean);

console.log(`解析到 ${list.length} 个卡密`);

async function upload() {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/coze_list`,
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
    console.log(`✓ 上传成功！共 ${list.length} 个卡密`);
  } else {
    console.error('上传失败:', data.errors);
  }
}

upload();
