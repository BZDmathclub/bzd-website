// BZD 数模社 — 卡密审核系统 Cloudflare Worker
// 环境变量（在 Cloudflare 后台配置）：
//   RESEND_API_KEY   — Resend API Key
//   ADMIN_EMAIL      — 管理员接收审核邮件的地址 bzdsxjm@163.com
//   ADMIN_SECRET     — 管理员一键审核的私密token（自定义一串字符）
//   COZE_TOKEN       — 扣子平台 API Token
//   COZE_BOT_ID      — 扣子机器人 ID

const COZE_API = 'https://api.coze.cn/v3/chat';
const CHATSHARE_URL = 'https://chatshare.biz/';
const AI_PURCHASE_URL = 'https://aiforman.vip/register.php?ref=sxjm12';
const COZE_TRIGGER = 'nhasmj_6ddj6123ioergweffnf23sadg6wsdsggqw，8';

// KV 存储 key 前缀
const PENDING_PREFIX = 'pending:';
const TIANKA_KEY = 'tianka_index'; // 当前天卡发放到第几个

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // ① 用户提交申请（含截图）
      if (path === '/api/apply' && method === 'POST') {
        return await handleApply(request, env, corsHeaders);
      }
      // ② 管理员审核（一键通过/拒绝）
      if (path === '/api/review' && (method === 'GET' || method === 'POST')) {
        return await handleReview(request, env, corsHeaders);
      }
      // ③ 管理员查看待审核列表
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

  // 生成唯一申请 ID
  const applyId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // 把图片转为 base64 存入 KV
  const imageBytes = await imageFile.arrayBuffer();
  const imageUint8 = new Uint8Array(imageBytes);
  let imageBinary = '';
  for (let i = 0; i < imageUint8.length; i++) {
    imageBinary += String.fromCharCode(imageUint8[i]);
  }
  const imageBase64 = btoa(imageBinary);
  const imageType = imageFile.type || 'image/png';

  const wantTianka = formData.get('want_tianka') === '1';
  const wantCoze   = formData.get('want_coze')   === '1';

  const record = {
    applyId,
    userEmail,
    orderNote,
    imageBase64,
    imageType,
    wantTianka,
    wantCoze,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  await env.BZD_KV.put(
    `${PENDING_PREFIX}${applyId}`,
    JSON.stringify(record),
    { expirationTtl: 60 * 60 * 72 } // 72小时过期
  );

  // 发审核邮件给管理员
  const reviewUrl = `https://bzd-admin.pages.dev/review?id=${applyId}&secret=${env.ADMIN_SECRET}`;
  const approveUrl = `https://api.bzdshumo.com/api/review?id=${applyId}&action=approve&secret=${env.ADMIN_SECRET}`;
  const rejectUrl  = `https://api.bzdshumo.com/api/review?id=${applyId}&action=reject&secret=${env.ADMIN_SECRET}`;

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
    <p><strong>支付截图：</strong></p>
    <img src="data:${imageType};base64,${imageBase64}"
         style="max-width:100%;border:1px solid #ccc;border-radius:4px;" />
  </div>
  <div style="padding:20px;text-align:center;background:white;border:1px solid #c0d4ef;border-top:none;border-radius:0 0 8px 8px;">
    <p style="color:#666;font-size:13px;">请核实截图后点击按钮：</p>
    <a href="${approveUrl}"
       style="display:inline-block;background:#1a8a50;color:white;padding:12px 36px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;margin-right:16px;">
      ✅ 通过 · 发卡密
    </a>
    <a href="${rejectUrl}"
       style="display:inline-block;background:#c55a11;color:white;padding:12px 36px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">
      ❌ 拒绝
    </a>
  </div>
</div>`;

  await sendEmail(env, {
    to: env.ADMIN_EMAIL,
    subject: `【BZD卡密申请】${userEmail} · ${new Date().toLocaleString('zh-CN')}`,
    html: emailHtml,
  });

  return json({ success: true, message: '申请已提交，请等待审核，通常在30分钟内处理' }, 200, corsHeaders);
}

// ============================================================
// ② 管理员审核
// ============================================================
async function handleReview(request, env, corsHeaders) {
  // 支持 GET 参数（邮件中的链接）
  const url = new URL(request.url);
  const applyId = url.searchParams.get('id');
  const action  = url.searchParams.get('action'); // approve | reject
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
  if (record.status !== 'pending') {
    return htmlPage(`ℹ️ 该申请已处理（状态：${record.status}）`);
  }

  if (action === 'reject') {
    record.status = 'rejected';
    await env.BZD_KV.put(`${PENDING_PREFIX}${applyId}`, JSON.stringify(record), { expirationTtl: 3600 });
    // 发拒绝邮件
    await sendEmail(env, {
      to: record.userEmail,
      subject: '【BZD数模社】您的资料申请结果',
      html: rejectEmailHtml(record.userEmail),
    });
    return htmlPage('✅ 已拒绝，通知邮件已发送给用户');
  }

  // 审核通过 — 按需获取天卡账号 + 扣子卡密
  const tianka = record.wantTianka ? await getNextTianka(env) : null;
  const cozeMi = record.wantCoze   ? await getCozeKami(env)   : null;

  // 更新状态
  record.status = 'approved';
  record.tianka = tianka;
  record.cozeMi = cozeMi;
  await env.BZD_KV.put(`${PENDING_PREFIX}${applyId}`, JSON.stringify(record), { expirationTtl: 3600 });

  // 发通过邮件给用户
  await sendEmail(env, {
    to: record.userEmail,
    subject: '【BZD数模社】✅ 您的完整版权益已发放',
    html: approveEmailHtml(record.userEmail, tianka, cozeMi),
  });

  return htmlPage(`
    ✅ 审核通过！已发送以下内容至 ${record.userEmail}<br><br>
    ${tianka ? `<strong>天卡账号：</strong>${tianka.account}<br><strong>天卡密码：</strong>${tianka.password}<br>` : ''}
    ${cozeMi ? `<strong>智能体卡密：</strong>${cozeMi}` : ''}
    ${!tianka && !cozeMi ? '（用户未勾选任何权益）' : ''}
  `);
}

// ============================================================
// ③ 获取下一个天卡账号（轮流发放）
// ============================================================
async function getNextTianka(env) {
  // 从 KV 读取天卡列表（首次需要初始化）
  const listRaw = await env.BZD_KV.get('tianka_list');
  if (!listRaw) throw new Error('天卡列表未初始化，请联系开发者');
  const list = JSON.parse(listRaw);

  let idx = parseInt(await env.BZD_KV.get(TIANKA_KEY) || '0');
  if (idx >= list.length) idx = 0; // 循环使用

  const item = list[idx];
  await env.BZD_KV.put(TIANKA_KEY, String(idx + 1));
  return item; // { account, password }
}

// ============================================================
// ④ 从 KV 顺序取扣子卡密
// ============================================================
async function getCozeKami(env) {
  try {
    const listRaw = await env.BZD_KV.get('coze_list');
    if (!listRaw) return '卡密列表未初始化，请联系客服 bzdsxjm521';
    const list = JSON.parse(listRaw);

    let idx = parseInt(await env.BZD_KV.get('coze_index') || '0');
    if (idx >= list.length) idx = 0;

    const kami = list[idx];
    await env.BZD_KV.put('coze_index', String(idx + 1));
    return kami;
  } catch (e) {
    return `获取失败(${e.message})，请联系客服 bzdsxjm521`;
  }
}

// ============================================================
// 邮件模板
// ============================================================
function approveEmailHtml(email, tianka, cozeMi) {
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
        🤖 AI 账号（24小时有效）
      </h3>
      <p style="margin:6px 0;"><strong>登录网址：</strong><a href="https://chatshare.biz/" style="color:#1a4fa8;">https://chatshare.biz/</a></p>
      <p style="margin:6px 0;"><strong>账号：</strong><code style="background:#f0f6ff;padding:2px 8px;border-radius:4px;font-size:15px;color:#c55a11;">${tianka.account}</code></p>
      <p style="margin:6px 0;"><strong>密码：</strong><code style="background:#f0f6ff;padding:2px 8px;border-radius:4px;font-size:15px;color:#c55a11;">${tianka.password}</code></p>
      <p style="margin:10px 0 0;font-size:12px;color:#6080a8;">账号仅限当天使用，续购请访问：<a href="https://aiforman.vip/register.php?ref=sxjm12" style="color:#1a4fa8;">aiforman.vip</a></p>
    </div>` : ''}

    ${cozeMi ? `
    <div style="background:white;border:1.5px solid #c0d4ef;border-radius:8px;padding:20px;margin:16px 0;">
      <h3 style="color:#0a2d6e;margin:0 0 12px;border-bottom:2px solid #3b7dd8;padding-bottom:8px;">
        📝 数模智能体卡密（8次使用）
      </h3>
      <p style="margin:6px 0;"><strong>智能体地址：</strong><a href="https://www.coze.cn/s/5bybFsAocZo/" style="color:#1a4fa8;">点击访问</a></p>
      <p style="margin:6px 0;"><strong>卡密：</strong><code style="background:#f0f6ff;padding:4px 12px;border-radius:4px;font-size:16px;color:#1a8a50;font-weight:bold;">${cozeMi}</code></p>
      <p style="margin:6px 0;"><strong>使用教程：</strong><a href="https://www.kdocs.cn/l/crMxja9CnmTw" style="color:#1a4fa8;">点击查看</a></p>
      <p style="margin:10px 0 0;font-size:12px;color:#6080a8;">使用前请先阅读教程，导入题目后需购买资源点才可调用。卡密不足可加微信 bzdsxjm521 购买（3元/次）</p>
    </div>` : ''}

    <div style="background:#fff8e8;border-left:4px solid #f5a623;padding:12px 16px;border-radius:0 6px 6px 0;margin:16px 0;">
      <p style="margin:0;font-size:13px;color:#5a4000;">
        💡 <strong>温馨提示：</strong>AI账号为共享账号请勿修改密码，智能体卡密仅供本人使用，请勿转发他人。如遇问题请加答疑群 <strong>1059114495</strong>
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

// ============================================================
// 工具函数
// ============================================================
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

async function handlePending(request, env, corsHeaders) {
  const url = new URL(request.url);
  if (url.searchParams.get('secret') !== env.ADMIN_SECRET) {
    return new Response('Forbidden', { status: 403 });
  }
  // 列出所有 pending 记录（简化版）
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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
