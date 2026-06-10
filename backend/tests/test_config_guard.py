import pytest
from app.config import Settings, validate_prod_settings


def _s(**kw) -> Settings:
    # _env_file=None keeps the test hermetic (no .env); explicit kwargs win
    # over container env vars.
    return Settings(_env_file=None, **kw)


def test_prod_refuses_placeholder_or_weak_jwt_secret():
    for bad in (
        "change-me-in-production",
        "CHANGE-ME-regenerate-do-not-leave-default",
        "",
        "short",
    ):
        with pytest.raises(RuntimeError):
            validate_prod_settings(_s(app_debug=False, jwt_secret=bad))


def test_debug_mode_and_strong_secret_pass():
    # dev mode is exempt; a strong secret boots fine in prod mode
    validate_prod_settings(_s(app_debug=True, jwt_secret="change-me-in-production"))
    validate_prod_settings(_s(app_debug=False, jwt_secret="x" * 48))
