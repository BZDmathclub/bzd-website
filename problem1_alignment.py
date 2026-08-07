"""
问题1：无噪声时间对齐 + 10Hz 轨迹生成
方法：三次样条插值 + 网格粗搜索 + Brent 法精细定位
"""

import numpy as np
import pandas as pd
from scipy.interpolate import CubicSpline
from scipy.optimize import minimize_scalar
import matplotlib.pyplot as plt
import matplotlib
matplotlib.rcParams['font.sans-serif'] = ['SimHei', 'Microsoft YaHei', 'DejaVu Sans']
matplotlib.rcParams['axes.unicode_minus'] = False

# ============================================================
# 1. 读取数据
# ============================================================
xl = pd.ExcelFile('附件1.xlsx')
print(f"附件1 工作表: {xl.sheet_names}")

df1 = pd.read_excel('附件1.xlsx', sheet_name=xl.sheet_names[0])
df2 = pd.read_excel('附件1.xlsx', sheet_name=xl.sheet_names[1])
print(f"方式1 列名: {df1.columns.tolist()}")
print(f"方式2 列名: {df2.columns.tolist()}")

def extract_txy(df):
    """按列名关键字自动提取 t/x/y 列"""
    cols = df.columns.tolist()
    t_col = next(c for c in cols if '时间' in str(c))
    x_col = next(c for c in cols if str(c).upper().startswith('X'))
    y_col = next(c for c in cols if str(c).upper().startswith('Y'))
    return df[t_col].values.astype(float), \
           df[x_col].values.astype(float), \
           df[y_col].values.astype(float)

t1, x1, y1 = extract_txy(df1)
t2, x2, y2 = extract_txy(df2)

print(f"\n方式1 (4Hz): {len(t1)} 点  时间 [{t1[0]:.3f}, {t1[-1]:.3f}] s")
print(f"方式2 (5Hz): {len(t2)} 点  时间 [{t2[0]:.3f}, {t2[-1]:.3f}] s")

# ============================================================
# 2. 构建方式2 的三次样条插值
# ============================================================
cs2_x = CubicSpline(t2, x2, extrapolate=False)
cs2_y = CubicSpline(t2, y2, extrapolate=False)

# ============================================================
# 3. 目标函数 J(tau)
#
#   J(tau) = (1/N) * sum_i [ (x1_i - x2_interp(t1_i+tau))^2
#                           + (y1_i - y2_interp(t1_i+tau))^2 ]
#
#   物理含义：当 J 最小时，方式1时刻 t1_i 与方式2时刻 t1_i+tau
#   对应同一真实时刻，两路轨迹吻合度最高。
# ============================================================
def objective(tau):
    t_query = t1 + tau
    mask = (t_query >= t2[0]) & (t_query <= t2[-1])
    n_valid = int(mask.sum())
    if n_valid < 20:           # 重叠点过少则返回大值
        return 1e10
    x2_q = cs2_x(t_query[mask])
    y2_q = cs2_y(t_query[mask])
    dx = x1[mask] - x2_q
    dy = y1[mask] - y2_q
    return float(np.mean(dx**2 + dy**2))   # 均值消除重叠长度影响

# ============================================================
# 4. 粗网格搜索
#   tau 的上下界：使 t1+tau 与 t2 有重叠
#   t1 ∈ [t1[0], t1[-1]],  t2 ∈ [t2[0], t2[-1]]
#   有效区间：tau ∈ [t2[0]-t1[-1]-margin, t2[-1]-t1[0]+margin]
# ============================================================
MARGIN      = 50.0   # s
COARSE_STEP = 0.05   # s

tau_lo = t2[0]  - t1[-1] - MARGIN
tau_hi = t2[-1] - t1[0]  + MARGIN
tau_grid = np.arange(tau_lo, tau_hi, COARSE_STEP)
J_grid   = np.array([objective(tau) for tau in tau_grid])

tau_coarse = tau_grid[np.argmin(J_grid)]
print(f"\n[粗搜索]  τ ≈ {tau_coarse:.2f} s    J = {J_grid.min():.6f}")

# ============================================================
# 5. Brent 法精细搜索（在粗估 ±2 s 窗口内）
# ============================================================
FINE_HALF = 2.0   # s

res = minimize_scalar(
    objective,
    bounds=(tau_coarse - FINE_HALF, tau_coarse + FINE_HALF),
    method='bounded',
    options={'xatol': 1e-9, 'maxiter': 500}
)
tau_opt = res.x
print(f"[精搜索]  τ* = {tau_opt:.9f} s    J = {res.fun:.9f}")
print(f"\n>>> 两种定位方式的时间偏差 τ = {tau_opt:.6f} s")
print(f"    （方式2 时间戳 = 方式1 时间戳 + {tau_opt:.6f} s）")

# ============================================================
# 6. 生成 10Hz 融合轨迹
# ============================================================
# 方式2 对齐后的时间轴
t2_aln = t2 - tau_opt

# 分别建立两路样条（方式2 使用对齐后时间）
cs1_x = CubicSpline(t1,    x1, extrapolate=False)
cs1_y = CubicSpline(t1,    y1, extrapolate=False)
cs2_x_aln = CubicSpline(t2_aln, x2, extrapolate=False)
cs2_y_aln = CubicSpline(t2_aln, y2, extrapolate=False)

# 两路数据的公共时间段
t_start = max(t1[0],    t2_aln[0])
t_end   = min(t1[-1],   t2_aln[-1])
print(f"\n公共时间段: [{t_start:.3f}, {t_end:.3f}] s  "
      f"（持续 {t_end-t_start:.1f} s）")

# 10Hz 等间隔时间轴
t_10hz = np.arange(t_start, t_end + 1e-9, 0.1)

x1_10 = cs1_x(t_10hz)
y1_10 = cs1_y(t_10hz)
x2_10 = cs2_x_aln(t_10hz)
y2_10 = cs2_y_aln(t_10hz)

# 等权均值融合（无噪声情形下两路可信度相同）
x_fused = 0.5 * x1_10 + 0.5 * x2_10
y_fused = 0.5 * y1_10 + 0.5 * y2_10

print(f"10Hz 轨迹点数: {len(t_10hz)}")

# ============================================================
# 7. 保存结果
# ============================================================
out_df = pd.DataFrame({
    '时间_10Hz(s)':     t_10hz,
    'X_方式1(m)':       x1_10,
    'Y_方式1(m)':       y1_10,
    'X_方式2_对齐(m)':  x2_10,
    'Y_方式2_对齐(m)':  y2_10,
    'X_融合(m)':        x_fused,
    'Y_融合(m)':        y_fused,
})
out_df.to_excel('问题1_10Hz轨迹.xlsx', index=False)
print("结果已保存 → 问题1_10Hz轨迹.xlsx")

# 时间偏差摘要
summary = pd.DataFrame({
    '参数': ['时间偏差 τ (s)', '公共时间段起点 (s)', '公共时间段终点 (s)', '10Hz 点数'],
    '数值': [f'{tau_opt:.6f}', f'{t_start:.3f}', f'{t_end:.3f}', len(t_10hz)]
})
summary.to_excel('问题1_时间偏差.xlsx', index=False)
print("时间偏差已保存 → 问题1_时间偏差.xlsx")

# ============================================================
# 8. 可视化
# ============================================================
fig, axes = plt.subplots(2, 2, figsize=(14, 10))
fig.suptitle(f'问题1 结果  |  时间偏差 τ* = {tau_opt:.4f} s', fontsize=13)

# (a) J(τ) 搜索曲线
ax = axes[0, 0]
ax.plot(tau_grid, J_grid, 'b-', lw=1, label='J(τ) 粗网格')
ax.axvline(tau_opt, color='r', lw=1.5, ls='--',
           label=f'τ* = {tau_opt:.4f} s')
ax.set_xlabel('τ (s)')
ax.set_ylabel('J(τ)  均方位置误差 (m²)')
ax.set_title('(a) 目标函数 J(τ)')
ax.legend()
ax.grid(True, alpha=0.3)

# (b) 对齐验证：对齐前后残差对比
t_check = t_10hz
dx_before = cs1_x(t_check) - cs2_x(t_check + tau_opt)   # 对齐后应≈0
dy_before = cs1_y(t_check) - cs2_y(t_check + tau_opt)
ax = axes[0, 1]
ax.plot(t_check, np.sqrt(dx_before**2 + dy_before**2), 'g-', lw=1)
ax.set_xlabel('时间 (s)')
ax.set_ylabel('位置残差 (m)')
ax.set_title(f'(b) 对齐后残差（均值={np.sqrt(dx_before**2+dy_before**2).mean():.4f} m）')
ax.grid(True, alpha=0.3)

# (c) XY 轨迹
ax = axes[1, 0]
ax.plot(x1, y1, 'b.', ms=2, alpha=0.4, label='方式1 (4Hz)')
ax.plot(x2, y2, 'r.', ms=2, alpha=0.4, label='方式2 (5Hz 原始)')
ax.plot(x_fused, y_fused, 'g-', lw=1.5, label='融合 (10Hz)')
ax.set_xlabel('X (m)')
ax.set_ylabel('Y (m)')
ax.set_title('(c) XY 轨迹')
ax.legend(markerscale=4)
ax.grid(True, alpha=0.3)

# (d) X、Y 时序（公共段）
ax = axes[1, 1]
ax.plot(t1,    y1, 'b.', ms=3, alpha=0.5, label='方式1 Y')
ax.plot(t2_aln, y2, 'r.', ms=3, alpha=0.5, label='方式2 Y（对齐后）')
ax.plot(t_10hz, y_fused, 'g-', lw=1.5, label='融合 Y')
ax.set_xlabel('时间 (s)')
ax.set_ylabel('Y (m)')
ax.set_title('(d) Y 坐标时序（含对齐效果）')
ax.legend(markerscale=3)
ax.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig('问题1_结果.png', dpi=150, bbox_inches='tight')
plt.show()
print("图像已保存 → 问题1_结果.png")
