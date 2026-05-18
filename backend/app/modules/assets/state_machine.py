"""Asset status state machine — PRD v0.2 §5.1 (4 states only).

Centralised so transition rules live in one place (DEVELOPMENT_PLAN §7.3):
never scatter status if/else across the codebase.
"""

from app.modules.assets.models import AssetClass, AssetStatus

# Allowed status transitions (personal assets — full lifecycle).
_ALLOWED: dict[AssetStatus, set[AssetStatus]] = {
    AssetStatus.idle: {AssetStatus.in_use, AssetStatus.maintenance, AssetStatus.scrapped},
    AssetStatus.in_use: {AssetStatus.idle, AssetStatus.maintenance, AssetStatus.scrapped},
    AssetStatus.maintenance: {AssetStatus.idle, AssetStatus.in_use, AssetStatus.scrapped},
    AssetStatus.scrapped: set(),  # terminal
}


class IllegalTransition(ValueError):
    pass


class InfrastructureNotAssignable(ValueError):
    pass


def assert_transition(current: AssetStatus, target: AssetStatus) -> None:
    if target not in _ALLOWED.get(current, set()):
        raise IllegalTransition(f"非法状态跳转:{current} → {target}")


def assert_assignable(asset_class: AssetClass) -> None:
    """infrastructure 资产不走分配/归还(PRD §3.1)。"""
    if asset_class == AssetClass.infrastructure:
        raise InfrastructureNotAssignable("基础设施资产不支持分配/归还,仅维护位置与状态")
