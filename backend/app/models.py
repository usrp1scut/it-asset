"""Aggregator: import every ORM model here so Alembic autogenerate sees all tables.

Add new modules' models to this list as they land in later sprints.
"""

from app.modules.users.models import Department, Role, User, UserStatus

__all__ = ["Department", "Role", "User", "UserStatus"]
