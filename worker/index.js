// BZD 数模社 — 四种账号发放系统 Cloudflare Worker
// 支持四种权益：AI天卡、扣子卡密、AI额度、MMA兑换码

const PENDING_PREFIX = 'pending:';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (path === '/api/apply' && method === 'POST') {
        return await handleApply(request, env, corsHeaders);
      }
      if (path === '/api/review' && (method === 'GET' || method === 'POST')) {
        return await handleReview(request, env, corsHeaders);
      }
      if (path === '/api/pending' && method === 'GET') {
        return await handlePending(request, env, corsHeaders);
      }
      return new Response('Not Found', { status: 404 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }
};

// ============================================================
// ① 处理用户申请
// ============================================================
async function handleApply(request, env, corsHeaders) {
  const formData = await request.formData();
  const userEmail = (formData.get('email') || '').trim();
  const orderNote = (formData.get('order_note') || '').trim();
  const imageFile = formData.get('screenshot');

  if (!userEmail || !imageFile) {
    return json({ error: '请填写邮箱并上传截图' }, 400, corsHeaders);
  }

  const applyId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const imageBytes = await imageFile.arrayBuffer();
  const imageUint8 = new Uint8Array(imageBytes);
  let imageBinary = '';
  for (let i = 0; i < imageUint8.length; i++) {
    imageBinary += String.fromCharCode(imageUint8[i]);
  }
  const imageBase64 = btoa(imageBinary);
  const imageType = imageFile.type || 'image/png';

  // 四种权益选择
  const wantTianka = formData.get('want_tianka') === '1';
  const wantCoze   = formData.get('want_coze') === '1';
  const wantQuota  = formData.get('want_quota') === '1';
  const wantMma    = formData.get('want_mma') === '1';

  const record = {
    applyId,
    userEmail,
    orderNote,
    imageBase64,
    imageType,
    wantTianka,
    wantCoze,
    wantQuota,
    wantMma,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  await env.BZD_KV.put(
    `${PENDING_PREFIX}${applyId}`,
    JSON.stringify(record),
    { expirationTtl: 60 * 60 * 72 }
  );

  const emailHtml = `
<div style="font-family:'Microsoft YaHei',sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#0a2d6e;color:white;padding:20px;border-radius:8px 8px 0 0;">
    <h2 style="margin:0">📋 BZD数模社 · 新的卡密申请</h2>
  </div>
  <div style="background:#f0f6ff;padding:20px;border:1px solid #c0d4ef;">
    <p><strong>申请ID：</strong>${applyId}</p>
    <p><strong>用户邮箱：</strong>${userEmail}</p>
    <p><strong>订单备注：</strong>${orderNote || '（未填写）'}</p>
    <p><strong>申请时间：</strong>${record.createdAt}</p>
    <p><strong>选择权益：</strong></p>
    <ul style="margin:6px 0;">
      <li>${wantTianka ? '✅' : '⭕'} AI账号天卡</li>
      <li>${wantCoze ? '✅' : '⭕'} 扣子平台卡密</li>
      <li>${wantQuota ? '✅' : '⭕'} AI额度</li>
      <li>${wantMma ? '✅' : '⭕'} MMA兑换码</li>
    </ul>
    <p><strong>支付截图：</strong></p>
    <img src="data:${imageType};base64,${imageBase64}"
         style="max-width:100%;border:1px solid #ccc;border-radius:4px;" />
  </div>
  <div style="padding:20px;text-align:center;background:white;border:1px solid #c0d4ef;border-top:none;border-radius:0 0 8px 8px;">
    <p style="color:#666;font-size:13px;">请核实截图后点击按钮：</p>
    <a href="https://api.bzdshumo.com/api/review?id=${applyId}&action=approve&secret=${env.ADMIN_SECRET}"
       style="display:inline-block;background:#1a8a50;color:white;padding:12px 36px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;margin-right:16px;">
      ✅ 通过 · 发权益
    </a>
    <a href="https://api.bzdshumo.com/api/review?id=${applyId}&action=reject&secret=${env.ADMIN_SECRET}"
       style="display:inline-block;background:#c55a11;color:white;padding:12px 36px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">
      ❌ 拒绝
    </a>
  </div>
</div>`;

  await sendEmail(env, {
    to: env.ADMIN_EMAIL,
    subject: `【BZD四种权益申请】${userEmail} · ${new Date().toLocaleString('zh-CN')}`,
    html: emailHtml,
  });

  return json({ success: true, message: '申请已提交，请等待审核' }, 200, corsHeaders);
}

// ============================================================
// ② 管理员审核 - 发放四种权益
// ============================================================
async function handleReview(request, env, corsHeaders) {
  const url = new URL(request.url);
  const applyId = url.searchParams.get('id');
  const action  = url.searchParams.get('action');
  const secret  = url.searchParams.get('secret');

  if (secret !== env.ADMIN_SECRET) {
    return new Response('Forbidden', { status: 403 });
  }
  if (!applyId || !action) {
    return new Response('Missing params', { status: 400 });
  }

  const raw = await env.BZD_KV.get(`${PENDING_PREFIX}${applyId}`);
  if (!raw) {
    return htmlPage('❌ 申请不存在或已过期');
  }
  const record = JSON.parse(raw);

  // 已审核通过的申请 — 无论 view 还是重复点 approve，都直接展示已发放的权益
  if (record.status === 'approved') {
    return viewBenefitsPage(record);
  }
  if (record.status === 'rejected') {
    return htmlPage('ℹ️ 该申请已被拒绝');
  }
  // 此处 status 必为 pending
  if (action === 'view') {
    return htmlPage('ℹ️ 申请审核中，请等待管理员处理');
  }

  if (action === 'reject') {
    record.status = 'rejected';
    await env.BZD_KV.put(`${PENDING_PREFIX}${applyId}`, JSON.stringify(record), { expirationTtl: 3600 });
    await sendEmail(env, {
      to: record.userEmail,
      subject: '【BZD数模社】您的资料申请结果',
      html: rejectEmailHtml(record.userEmail),
    });
    return htmlPage('✅ 已拒绝，通知邮件已发送给用户');
  }

  // 批准 - 获取四种权益
  const tianka = record.wantTianka ? await getNextItem(env, 'TIANKA_LIST') : null;
  const cozeMi = record.wantCoze   ? await getNextItem(env, 'COZE_LIST')   : null;
  const quota  = record.wantQuota  ? await getNextItem(env, 'QUOTA_LIST')  : null;
  const mma    = record.wantMma    ? await getNextItem(env, 'MMA_LIST')    : null;

  record.status = 'approved';
  record.tianka = tianka;
  record.cozeMi = cozeMi;
  record.quota = quota;
  record.mma = mma;
  await env.BZD_KV.put(`${PENDING_PREFIX}${applyId}`, JSON.stringify(record), { expirationTtl: 3600 });

  // 发四种权益邮件
  console.log(`发送邮件 - tianka: ${!!tianka}, cozeMi: ${!!cozeMi}, quota: ${!!quota}, mma: ${!!mma}`);
  await sendEmail(env, {
    to: record.userEmail,
    subject: '【BZD数模社】✅ 您的完整版权益已发放',
    html: approveEmailHtml(record.userEmail, tianka, cozeMi, quota, mma),
  });

  return htmlPage(`
    ✅ 审核通过！已发送以下内容至 ${record.userEmail}<br><br>
    ${tianka ? `<strong>天卡兑换码：</strong>${tianka}<br>` : ''}
    ${cozeMi ? `<strong>扣子卡密：</strong>${cozeMi}<br>` : ''}
    ${quota ? `<strong>AI额度：</strong>${quota}<br>` : `<strong style="color:red;">AI额度：未获取</strong><br>`}
    ${mma ? `<strong>MMA兑换码：</strong>${mma}<br>` : `<strong style="color:red;">MMA兑换码：未获取</strong><br>`}
    ${!tianka && !cozeMi && !quota && !mma ? '（用户未勾选任何权益）' : ''}
  `);
}

// ============================================================
// 获取下一个账号/权益 - 从 KV 按顺序分配
// ============================================================
async function getNextItem(env, varName) {
  try {
    // 从 KV 读取列表
    const listStr = await env.BZD_KV.get(varName);
    if (!listStr) {
      return `权益列表(${varName})未配置，请联系客服 bzdsxjm521`;
    }

    const list = listStr.split('\n').map(x => x.trim()).filter(x => x);
    if (list.length === 0) {
      return '权益列表为空，请联系客服 bzdsxjm521';
    }

    // 获取当前索引（从 KV 读取）
    const indexKey = `${varName}_INDEX`;
    let idx = parseInt(await env.BZD_KV.get(indexKey) || '0');

    // 如果索引超出范围，回到开始
    if (idx >= list.length) {
      idx = 0;
    }

    const item = list[idx];
    // 使用后自动更新索引
    await env.BZD_KV.put(indexKey, String(idx + 1));

    return item;
  } catch (e) {
    return `获取失败(${e.message})，请联系客服 bzdsxjm521`;
  }
}

// ============================================================
// 邮件模板 - 四种权益
// ============================================================
function approveEmailHtml(email, tianka, cozeMi, quota, mma) {
  return `
<div style="font-family:'Microsoft YaHei',sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:linear-gradient(135deg,#0a2d6e,#1a4fa8);color:white;padding:28px;border-radius:10px 10px 0 0;text-align:center;">
    <h1 style="margin:0;font-size:24px;letter-spacing:3px;">BZD 数模社</h1>
    <p style="margin:8px 0 0;color:#cfe0ff;font-size:14px;">完整版资料权益已发放</p>
  </div>
  <div style="background:#f0f6ff;padding:24px;border:1px solid #c0d4ef;">
    <p style="color:#0a2d6e;font-size:15px;">亲爱的同学，您好！</p>
    <p style="color:#3a5080;">您购买的 <strong>完整版资料</strong> 审核已通过，以下是您的专属权益：</p>

    ${tianka ? `
    <div style="background:white;border:1.5px solid #c0d4ef;border-radius:8px;padding:20px;margin:16px 0;">
      <h3 style="color:#0a2d6e;margin:0 0 12px;border-bottom:2px solid #3b7dd8;padding-bottom:8px;">
        🤖 AI账号【GPT】（24小时有效）
      </h3>
      <p style="margin:6px 0;"><strong>登录网址：</strong><a href="https://claude.aiforman.vip/user-new#/register?i=7TUZG" style="color:#1a4fa8;">https://claude.aiforman.vip</a></p>
      <p style="margin:6px 0;"><strong>兑换码：</strong><code style="background:#f0f6ff;padding:4px 12px;border-radius:4px;font-size:15px;color:#c55a11;font-weight:bold;">${tianka}</code></p>
      <p style="margin:10px 0 0;font-size:12px;color:#6080a8;">注册后填写兑换码登录，24小时使用权限。如时间不够可自行在网站补充。</p>
    </div>` : ''}

    ${cozeMi ? `
    <div style="background:white;border:1.5px solid #c0d4ef;border-radius:8px;padding:20px;margin:16px 0;">
      <h3 style="color:#0a2d6e;margin:0 0 12px;border-bottom:2px solid #3b7dd8;padding-bottom:8px;">
        📝 扣子平台卡密（论文直出 & 论文点评）
      </h3>
      <p style="margin:6px 0;"><strong>智能体地址：</strong><a href="https://www.coze.cn/store/project/7548130644564688906" style="color:#1a4fa8;">数学建模Agent</a></p>
      <p style="margin:6px 0;"><strong>卡密：</strong><code style="background:#f0f6ff;padding:4px 12px;border-radius:4px;font-size:16px;color:#1a8a50;font-weight:bold;">${cozeMi}</code></p>
      <p style="margin:6px 0;"><strong>教程文档：</strong><a href="https://www.kdocs.cn/l/crMxja9CnmTw" style="color:#1a4fa8;">点击查看</a></p>
      <p style="margin:6px 0;"><strong>论文点评Agent：</strong><a href="https://kk6mg46g36.coze.site/" style="color:#1a4fa8;">点击打开</a></p>
      <p style="margin:10px 0 0;font-size:12px;color:#6080a8;">使用前请先阅读教程。卡密不足可加微信 bzdsxjm521 购买（5元/次）</p>
    </div>` : ''}

    ${quota ? `
    <div style="background:white;border:1.5px solid #c0d4ef;border-radius:8px;padding:20px;margin:16px 0;">
      <h3 style="color:#0a2d6e;margin:0 0 12px;border-bottom:2px solid #3b7dd8;padding-bottom:8px;">
        💳 AI额度【美元】（包含 GPT、Claude、Gemini、Grok 等）
      </h3>
      <p style="margin:6px 0;"><strong>兑换链接：</strong><a href="https://kapibala.asia/sign-up?aff=bzdsxjm" style="color:#1a4fa8;">https://kapibala.asia/sign-up?aff=bzdsxjm</a></p>
      <p style="margin:6px 0;"><strong>兑换码：</strong><code style="background:#f0f6ff;padding:4px 12px;border-radius:4px;font-size:15px;color:#c55a11;font-weight:bold;">${quota}</code></p>
      <p style="margin:10px 0 0;font-size:12px;color:#6080a8;">注册后填写兑换码，即可获得美元额度。</p>
    </div>` : ''}

    ${mma ? `
    <div style="background:white;border:1.5px solid #c0d4ef;border-radius:8px;padding:20px;margin:16px 0;">
      <h3 style="color:#0a2d6e;margin:0 0 12px;border-bottom:2px solid #3b7dd8;padding-bottom:8px;">
        🚀 MMA智能体（10000积分）
      </h3>
      <p style="margin:6px 0;"><strong>官网注册：</strong><a href="https://mathmodel.top/signup?ref=358JL76N" style="color:#1a4fa8;">https://mathmodel.top/signup?ref=358JL76N</a></p>
      <p style="margin:6px 0;"><strong>兑换码：</strong><code style="background:#f0f6ff;padding:4px 12px;border-radius:4px;font-size:15px;color:#c55a11;font-weight:bold;">${mma}</code></p>
      <p style="margin:10px 0 0;font-size:12px;color:#6080a8;">GitHub最多Star项目，自动化全流程1-3h生成PDF论文。注册后使用兑换码免费领取一万积分。</p>
    </div>` : ''}

    <div style="background:#fff8e8;border-left:4px solid #f5a623;padding:12px 16px;border-radius:0 6px 6px 0;margin:16px 0;">
      <p style="margin:0;font-size:13px;color:#5a4000;">
        💡 <strong>温馨提示：</strong>AI账号为共享账号请勿修改密码，卡密和兑换码仅供本人使用，请勿转发他人。如遇问题请加答疑群 <strong>1059114495</strong>
      </p>
    </div>
  </div>
  <div style="background:#0a2d6e;color:#90b8f0;padding:16px;text-align:center;border-radius:0 0 10px 10px;font-size:12px;">
    BZD 数模社 · 一次建模 终生受益 · bzdshumo.com
  </div>
</div>`;
}

function rejectEmailHtml(email) {
  return `
<div style="font-family:'Microsoft YaHei',sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:#0a2d6e;color:white;padding:24px;border-radius:10px 10px 0 0;text-align:center;">
    <h2 style="margin:0;">BZD 数模社</h2>
  </div>
  <div style="padding:24px;background:#fff;">
    <p>同学您好，您提交的申请未能通过审核。</p>
    <p>可能原因：截图不清晰 / 未购买完整版 / 订单金额不符。</p>
    <p>如有疑问请加微信 <strong>bzdsxjm521</strong> 联系客服。</p>
  </div>
  <div style="background:#0a2d6e;color:#90b8f0;padding:14px;text-align:center;border-radius:0 0 10px 10px;font-size:12px;">
    BZD 数模社 · bzdshumo.com
  </div>
</div>`;
}

function viewBenefitsPage(record) {
  const benefits = [];
  if (record.tianka) benefits.push(`🤖 <strong>AI天卡兑换码：</strong> <code style="background:#f0f6ff;padding:4px 12px;border-radius:4px;color:#c55a11;font-weight:bold;">${record.tianka}</code>`);
  if (record.cozeMi) benefits.push(`📝 <strong>扣子卡密：</strong> <code style="background:#f0f6ff;padding:4px 12px;border-radius:4px;color:#1a8a50;font-weight:bold;">${record.cozeMi}</code>`);
  if (record.quota) benefits.push(`💳 <strong>AI额度兑换码：</strong> <code style="background:#f0f6ff;padding:4px 12px;border-radius:4px;color:#c55a11;font-weight:bold;">${record.quota}</code>`);
  if (record.mma) benefits.push(`🚀 <strong>MMA兑换码：</strong> <code style="background:#f0f6ff;padding:4px 12px;border-radius:4px;color:#c55a11;font-weight:bold;">${record.mma}</code>`);

  return new Response(`
<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>权益发放确认</title>
<style>
body{font-family:'Microsoft YaHei',sans-serif;background:#eef4fc;display:flex;
  align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;}
.box{background:white;border-radius:12px;padding:40px;max-width:600px;
  box-shadow:0 8px 24px rgba(10,45,110,.12);text-align:center;}
h2{margin-top:0;color:#0a2d6e;font-size:24px;}
.success{color:#16a34a;font-size:18px;margin:20px 0;}
.benefit-item{margin:16px 0;padding:12px;background:#f9fafb;border-left:3px solid #2c5aa0;
  border-radius:4px;text-align:left;font-size:14px;}
code{display:block;margin-top:4px;word-break:break-all;}
.tips{color:#666;font-size:12px;margin-top:20px;padding:12px;background:#fff8e8;
  border-radius:6px;border-left:3px solid #f5a623;}
</style></head><body>
<div class="box">
<h2>✅ 权益已发放</h2>
<div class="success">感谢您的购买！以下是您的专属权益</div>
${benefits.map(b => `<div class="benefit-item">${b}</div>`).join('')}
<div class="tips">
💡 <strong>温馨提示：</strong><br>
• AI账号为共享账号，请勿修改密码<br>
• 卡密和兑换码仅供本人使用，请勿转发<br>
• 如遇问题请加微信 <strong>bzdsxjm521</strong> 或加群 <strong>1059114495</strong>
</div>
</div>
</body></html>`, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}

async function sendEmail(env, { to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'BZD数模社 <noreply@bzdshumo.com>',
      to: [to],
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend 发送失败: ${err}`);
  }
  return res.json();
}

async function handlePending(request, env, corsHeaders) {
  const url = new URL(request.url);
  if (url.searchParams.get('secret') !== env.ADMIN_SECRET) {
    return new Response('Forbidden', { status: 403 });
  }
  const list = await env.BZD_KV.list({ prefix: PENDING_PREFIX });
  const items = [];
  for (const key of list.keys) {
    const raw = await env.BZD_KV.get(key.name);
    if (raw) {
      const r = JSON.parse(raw);
      items.push({ applyId: r.applyId, userEmail: r.userEmail, status: r.status, createdAt: r.createdAt });
    }
  }
  return json(items, 200, corsHeaders);
}

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

function htmlPage(content) {
  return new Response(`
<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>BZD审核系统</title>
<style>
body{font-family:'Microsoft YaHei',sans-serif;background:#f0f6ff;display:flex;
  align-items:center;justify-content:center;min-height:100vh;margin:0;}
.box{background:white;border-radius:10px;padding:40px;max-width:500px;
  box-shadow:0 8px 24px rgba(10,45,110,.12);text-align:center;color:#0a2d6e;}
h2{margin-top:0;}
</style></head><body>
<div class="box"><h2>BZD 数模社 · 审核系统</h2><p>${content}</p></div>
</body></html>`, {
    headers: { 'Content-Type': 'text/html;charset=UTF-8' },
  });
}
