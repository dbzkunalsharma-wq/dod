import re

_INDIA = re.compile(
    r"\b("
    r"india|bengaluru|bangalore|mumbai|new delhi|delhi|gurgaon|gurugram|"
    r"hyderabad|pune|chennai|noida|kolkata|ahmedabad|jaipur|kochi|cochin|"
    r"indore|chandigarh|thiruvananthapuram|trivandrum|coimbatore|nagpur|"
    r"surat|vadodara|bhubaneswar|mysuru|mysore"
    r")\b",
    re.IGNORECASE,
)


def is_india(location) -> bool:
    """True if the location text references India or a major Indian city."""
    if not location:
        return False
    return bool(_INDIA.search(str(location)))


_REMOTE = re.compile(r"\b(remote|anywhere|distributed|work from home|wfh)\b", re.IGNORECASE)

# A remote role is assumed open to India UNLESS it names a specific non-India region.
_NON_INDIA_REGION = re.compile(
    r"(united states|\bu\.?s\.?a\b|\busa\b|\bus\b|us[- ]only|us[- ]based|americas|"
    r"\bemea\b|europe|united kingdom|\buk\b|canada|latam|brazil|mexico|germany|"
    r"australia|new york|san francisco|\blondon\b|berlin|toronto|sydney)",
    re.IGNORECASE,
)


def accepts_india(location) -> bool:
    """True if an Indian applicant could take the role: India-located, or remote
    that isn't pinned to a specific non-India region."""
    if not location:
        return False
    if is_india(location):
        return True
    text = str(location)
    if not _REMOTE.search(text):
        return False
    return not _NON_INDIA_REGION.search(text)
