DISCIPLINES = {
    "uiux": "UI/UX",
    "product": "Product",
    "communication": "Communication",
    "industrial": "Industrial",
}


def label(key: str) -> str:
    return DISCIPLINES.get(key, key)


def all_keys() -> list[str]:
    return list(DISCIPLINES.keys())
