from app.modules.assets.matching import UserIndex, name_key


class _U:
    def __init__(self, uid, name, email=None):
        self.id, self.name, self.email = uid, name, email


def test_name_key_normalizes_noise():
    assert name_key(" 张 伟 ") == name_key("张伟")
    assert name_key("张伟（研发部）") == "张伟"
    assert name_key("张伟 13800138000") == "张伟"
    assert name_key("张伟　") == "张伟"  # full-width space
    assert name_key(None) == "" and name_key("  ") == ""


def test_resolve_exact_and_whitespace():
    idx = UserIndex([_U(1, "张伟", "zhangwei@x.com"), _U(2, "李娜", "lina@x.com")])
    assert idx.resolve("张伟") == 1
    assert idx.resolve(" 张 伟 ") == 1
    assert idx.resolve("张伟(已离职?)") == 1
    assert idx.resolve("查无此人") is None
    assert idx.resolve("") is None


def test_resolve_pinyin_and_email_bridge_chinese():
    idx = UserIndex([_U(1, "张伟", "zhangwei@corp.com"), _U(2, "李娜", "lina@corp.com")])
    # spreadsheet has pinyin, directory has Chinese name
    assert idx.resolve("Zhang Wei") == 1
    assert idx.resolve("zhangwei") == 1
    assert idx.resolve("ZHANGWEI") == 1
    assert idx.resolve("lina") == 2


def test_ambiguous_never_guesses():
    idx = UserIndex([_U(1, "张伟", "zw1@x.com"), _U(2, "张伟", "zw2@x.com")])
    assert idx.resolve("张伟") is None  # two people, must stay needs_review
