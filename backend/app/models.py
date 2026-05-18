"""Aggregator: import every ORM model here so Alembic autogenerate sees all tables.

Add new modules' models to this list as they land in later sprints.
"""

from app.modules.assets.models import (
    Asset,
    AssetAccessory,
    AssetAssignment,
    AssetChangeLog,
    AssetClass,
    AssetCodeCounter,
    AssetStatus,
    AssetType,
    AuditLog,
)
from app.modules.inventory.models import (
    EmployeeItemIssue,
    InventoryLocation,
    InventoryOrder,
    InventoryOrderItem,
    InventoryStock,
    InventoryTransaction,
    IssueStatus,
    ItemCategory,
    ManagementMode,
    OrderType,
    Sku,
    TransactionType,
)
from app.modules.users.models import Department, Role, User, UserStatus

__all__ = [
    "Department",
    "Role",
    "User",
    "UserStatus",
    "Asset",
    "AssetAccessory",
    "AssetAssignment",
    "AssetChangeLog",
    "AssetClass",
    "AssetCodeCounter",
    "AssetStatus",
    "AssetType",
    "AuditLog",
    "EmployeeItemIssue",
    "InventoryLocation",
    "InventoryOrder",
    "InventoryOrderItem",
    "InventoryStock",
    "InventoryTransaction",
    "IssueStatus",
    "ItemCategory",
    "ManagementMode",
    "OrderType",
    "Sku",
    "TransactionType",
]
