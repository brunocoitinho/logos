from app.core.security import hash_password, verify_password


def test_password_hash_is_verifiable_and_not_plain_text():
    password_hash = hash_password("logos2026")

    assert password_hash != "logos2026"
    assert verify_password("logos2026", password_hash)
    assert not verify_password("senha-errada", password_hash)


def test_same_password_generates_different_hashes():
    """O salt aleatório impede descobrir senhas iguais comparando os hashes."""
    assert hash_password("logos2026") != hash_password("logos2026")
