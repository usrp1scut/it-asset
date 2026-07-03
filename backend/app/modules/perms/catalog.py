"""功能模块目录 + 默认授权矩阵(= 迁移前写死规则的等价还原).

mode:
  config — 可在「角色权限」页勾选调整(查看/管理)。
  locked — 硬钉 it_admin,矩阵里只读(用户管理 / 角色权限,防自锁)。
  pinned — 流程角色写死在代码里(审批人/发放/报废复核),矩阵里只读展示。
"""
from app.modules.users.models import Role

CONFIG, LOCKED, PINNED = "config", "locked", "pinned"

M, IT, P, F, HR = Role.manager, Role.it_admin, Role.procurement, Role.finance, Role.hr

# 参与矩阵编辑的角色(employee 走 H5、sys_admin 保底,均不在编辑范围)。
EDITABLE_ROLES: list[Role] = [M, IT, P, F, HR]
# 表里也为 employee 存一份(默认全 false),这样矩阵/下发逻辑统一。
STORED_ROLES: list[Role] = [*EDITABLE_ROLES, Role.employee]

_VM = ["view", "manage"]
_V = ["view"]
# key, 中文名, 分组, 支持的动作, 模式
_ROWS = [
    ("dashboard", "工作台", "主要工作", _V, CONFIG),
    ("assets", "资产台账", "主要工作", _VM, CONFIG),
    ("asset_types", "资产类型", "主要工作", _VM, CONFIG),
    ("inventory", "库存耗材", "主要工作", _VM, CONFIG),
    ("approvals", "审批中心", "主要工作", _V, PINNED),
    ("inspections", "资产盘点", "流程管理", _VM, CONFIG),
    ("scrap", "资产报废", "流程管理", _V, PINNED),
    ("repair", "维修中心", "流程管理", _VM, CONFIG),
    ("offboarding", "离职归还", "流程管理", _VM, CONFIG),
    ("seatmap", "座位图", "流程管理", _VM, CONFIG),
    ("lottery", "抽奖", "工具与系统", _VM, CONFIG),
    ("users", "用户管理", "工具与系统", _VM, LOCKED),
    ("audit", "操作日志", "工具与系统", _V, CONFIG),
    ("perms", "角色权限", "工具与系统", _VM, LOCKED),
]
MODULES: list[dict] = [
    {"key": k, "label": lbl, "section": sec, "actions": acts, "mode": mode}
    for k, lbl, sec, acts, mode in _ROWS
]

MODULE_KEYS = {m["key"] for m in MODULES}
MODE = {m["key"]: m["mode"] for m in MODULES}
LOCKED_KEYS = {m["key"] for m in MODULES if m["mode"] == LOCKED}

# 默认矩阵:module -> (view_roles, manage_roles)。与迁移前 require_roles 一一对应。
DEFAULTS: dict[str, tuple[set[Role], set[Role]]] = {
    "dashboard": ({M, IT, P, F}, set()),
    "assets": ({M, IT, P, F}, {IT}),
    "asset_types": ({M, IT, P, F}, {IT}),
    "inventory": ({M, IT, P, F}, {IT, P}),
    "approvals": ({M, IT, P}, set()),          # pinned(展示用):审批中心可见者
    "inspections": ({IT}, {IT}),
    "scrap": ({IT, F, P}, set()),              # pinned(展示用)
    "repair": ({M, IT, P, F}, {IT}),
    "offboarding": ({M, IT, P, F, HR}, {IT}),
    "seatmap": ({M, IT, P, F, HR}, {IT}),
    "lottery": ({M, IT, P, F, HR}, {M, IT, P, F, HR}),
    "users": ({IT}, {IT}),                     # locked
    "audit": ({IT}, set()),
    "perms": ({IT}, {IT}),                     # locked
}
