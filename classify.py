"""Deterministic discipline classifier for incoming job postings.

classify(title, description) decides whether a posting is an in-scope design
role and, if so, which of the four disciplines in disciplines.py it belongs to.
Rules are keyword/taxonomy based on purpose: the same input must always yield
the same label, and the keyword sets below are meant to be edited directly.
"""

import re

# --- Disqualifiers ----------------------------------------------------------
# Non-design roles that frequently carry "design"/"designer" substrings or sit
# adjacent to design work. Matched against the TITLE first so they
# short-circuit to None before any discipline mapping runs.
NON_DESIGN = [
    # --- Management / generic non-design --------------------------------
    "product manager",
    "program manager",
    "project manager",
    "business analyst",
    "data analyst",
    "data scientist",
    "marketing manager",
    "sales",

    # --- Software / hardware ENGINEERING (incl. "...design" phrasings) ---
    # These read as "design" but are fundamentally engineering. Substrings
    # are chosen to catch board-style titles like "Engineer I - SW Design".
    "design engineer",          # mechanical/structural/HW, not a design role
    "design verification",      # VLSI/ASIC verification
    "verification engineer",
    "sw design",                # "Engineer I - SW Design" false positive
    "software design",
    "hardware design",
    "chip design",
    "asic design",
    "rtl design",
    "vlsi",
    "pcb design",
    "pcb layout",
    "embedded design",
    "circuit design",
    "analog design",
    "digital design engineer",
    "cad engineer",             # drafting/engineering, not industrial design
    "design for manufacturing engineer",
    "software engineer",
    "hardware engineer",
    "systems engineer",
    "firmware",
    "frontend engineer",
    "front-end engineer",
    "frontend developer",
    "front-end developer",
    "backend engineer",
    "back-end engineer",
    "full stack",
    "full-stack",
    "web developer",
    "software developer",

    # --- Recruiting / HR -------------------------------------------------
    "sourcer",                  # "Senior Design Sourcer" false positive
    "recruiter",
    "recruitment",
    "talent acquisition",
    "human resources",
    " hr ",                     # padded; see _has_any usage on " t "
    "hr ",
    " hr",

    # --- Out-of-scope "design" verticals --------------------------------
    "interior designer",
    "interior design",
    "architect",                # also covers "architecture"
    "architecture",
    "fashion design",
    "apparel design",
    "garment design",
    "textile design",
    "clothing design",
    "jewellery design",
    "jewelry design",
    "set design",
    "set designer",
    "instructional design",
    "game designer",            # game design out of scope for v1
    "game design",
    " game ",                   # any game-vertical title (UI/art/level/etc.)
    "level designer",
    "narrative designer",
    "ux writer",                # content discipline, out of scope for v1
    "content designer",         # out of scope for v1
    "content strategist",
]

# --- Physical-design signals ------------------------------------------------
# Presence of any of these flips an otherwise-digital "product designer" (and a
# bare "designer") toward industrial / hardware design.
PHYSICAL_SIGNALS = [
    "industrial design",
    "cmf",
    "cad",
    "solidworks",
    "rhino",
    "keyshot",
    "injection molding",
    "injection moulding",
    "hardware",
    "physical product",
    "clay model",
    "foam model",
    "prototyping models",
    "3d printing",
    "tooling",
    "ergonomic",
]

# --- Digital-design signals -------------------------------------------------
# Used to keep a bare "product designer" digital and to disambiguate
# "visual designer" toward UI/UX.
DIGITAL_SIGNALS = [
    "figma",
    "sketch",
    "prototyp",          # prototype / prototyping (digital tools context)
    "user flow",
    "design system",
    "wireframe",
    "app",
    "software",
    "saas",
    "web app",
    "mobile",
    "digital product",
]

# --- Brand / print signals --------------------------------------------------
# Pushes "visual designer" toward communication.
BRAND_SIGNALS = [
    "brand",
    "branding",
    "print",
    "identity",
    "packaging",
    "editorial",
    "typography",
    "layout",
]

# --- Discipline title keywords ----------------------------------------------
# Unambiguous title signals per discipline. Order of evaluation in classify()
# resolves the few overlaps (industrial before product, etc.).
INDUSTRIAL_TITLES = [
    "industrial designer",
    "industrial design",
    "cmf designer",
    "footwear designer",
    "furniture designer",
    "toy designer",
    "automotive designer",
]

UIUX_TITLES = [
    "ui/ux",
    "ux/ui",
    "ui designer",
    "ux designer",
    "ui designer",
    "interaction designer",
    "ux researcher",
    "user researcher",
    "web designer",
    "design technologist",
]

COMMUNICATION_TITLES = [
    "graphic designer",
    "communication design",
    "communications design",
    "brand designer",
    "motion designer",
    "motion graphics",
    "illustrator",
    "typographer",
    "editorial designer",
    "packaging designer",
    "layout designer",
    "art director",
]


def _norm(text: str) -> str:
    """Lowercase and collapse whitespace so multi-word keywords match cleanly."""
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def _has_any(haystack: str, needles) -> bool:
    return any(n in haystack for n in needles)


# Words that, when they head/anchor a title, mark it as an engineering or
# other non-design role no matter what "design" wording also appears. We match
# these only in the TITLE (padded) so descriptions mentioning "engineers" as
# collaborators don't disqualify a genuine design posting.
NON_DESIGN_TITLE_TOKENS = [
    "engineer",
    "developer",
    "programmer",
    "architect",      # software/solution/enterprise/interior architects
]

# Sales / marketing parentheticals that boards bolt onto a "design" title.
SALES_MARKETING_HINTS = [
    "design (sales",
    "design - sales",
    "design (marketing",
    "design - marketing",
    "design sales",
    "design marketing",
    "sales designer",
    "marketing designer",
]

# Engineering-flavoured description signals. For a THIN title (bare "designer"
# with no discipline keyword), these reveal that an apparent "digital" lean is
# really a software/hardware engineering posting, so it stays out of scope.
ENGINEERING_CONTEXT = [
    "software architecture",
    "react",
    "javascript",
    "typescript",
    "node.js",
    "nodejs",
    "python",
    "java ",
    "c++",
    "golang",
    "kubernetes",
    "rest api",
    "microservices",
    "rtos",
    "embedded software",
    "firmware",
    "verilog",
    "vhdl",
    "rtl",
    "code review",
    "writing code",
    "backend",
    "back-end",
]


def classify(title: str, description: str = "") -> str | None:
    t = _norm(title)
    d = _norm(description)
    both = t + " " + d
    # Padded title so word-boundary-style disqualifiers (e.g. " hr ") match
    # at the start/end of the title too.
    tp = " " + t + " "

    # Reject non-design roles up front, even if they mention "design".
    if _has_any(tp, NON_DESIGN):
        return None

    # Sales/marketing roles dressed up with "design".
    if _has_any(t, SALES_MARKETING_HINTS):
        return None

    # Any title that is fundamentally an engineer/developer/architect role is
    # out of scope, including phrasings we did not enumerate above
    # (e.g. "Engineer I - SW Design", "Staff Hardware Design Engineer").
    if _has_any(tp, [" " + tok for tok in NON_DESIGN_TITLE_TOKENS]):
        return None

    physical = _has_any(both, PHYSICAL_SIGNALS)
    digital = _has_any(both, DIGITAL_SIGNALS)
    brand = _has_any(both, BRAND_SIGNALS)

    # Explicit industrial titles win outright.
    if _has_any(t, INDUSTRIAL_TITLES):
        return "industrial"

    # "Visual designer" is genuinely cross-discipline: default to UI/UX in a
    # digital context, communication in a brand/print one. Decide it before the
    # generic UI/UX and communication title sweeps so the context wins.
    if "visual designer" in t:
        if brand and not digital:
            return "communication"
        return "uiux"

    # Interface/interaction specialists.
    if _has_any(t, UIUX_TITLES):
        return "uiux"

    # Graphic / brand / visual communication.
    if _has_any(t, COMMUNICATION_TITLES):
        return "communication"

    # "Product Designer" umbrella: industrial when physical signals appear,
    # otherwise the digital product discipline.
    if "product designer" in t or "product design" in t:
        return "industrial" if physical else "product"

    # Thin titles: a bare "designer" with no qualifier needs a discipline or
    # tool signal somewhere to be classifiable; otherwise it is too ambiguous.
    if "designer" in t or "design" in t:
        if physical:
            return "industrial"
        if brand and not digital:
            return "communication"
        if digital:
            # An apparent digital lean that is really an engineering brief
            # (e.g. a bare "Designer" whose description is React/software)
            # is out of scope rather than a product-design role.
            if _has_any(both, ENGINEERING_CONTEXT):
                return None
            # Tool/flow signals without a brand lean point to product work.
            return "product"

    return None


if __name__ == "__main__":
    # Positive: clear discipline titles.
    assert classify("Senior UI/UX Designer") == "uiux"
    assert classify("UX Researcher") == "uiux"
    assert classify("Interaction Designer") == "uiux"
    assert classify("Web Designer") == "uiux"
    assert classify("Design Technologist") == "uiux"
    assert classify("Graphic Designer") == "communication"
    assert classify("Motion Graphics Designer") == "communication"
    assert classify("Brand Designer") == "communication"
    assert classify("Illustrator") == "communication"
    assert classify("Communication Designer") == "communication"
    assert classify("Industrial Designer") == "industrial"
    assert classify("CMF Designer") == "industrial"
    assert classify("Footwear Designer") == "industrial"
    assert classify("Product Designer") == "product"

    # Disambiguation: Product Designer flips to industrial with physical signals.
    assert classify("Product Designer", "Expert in SolidWorks, CAD and injection molding") == "industrial"
    assert classify("Product Designer", "Figma, prototyping, design systems and user flows") == "product"

    # Disambiguation: Visual Designer by context.
    assert classify("Visual Designer", "Figma, app screens, design system") == "uiux"
    assert classify("Visual Designer", "brand identity, print and packaging") == "communication"

    # Disambiguation: thin "Designer" rescued by description signals.
    assert classify("Designer", "Rhino, Keyshot, clay model and foam model work") == "industrial"
    assert classify("Designer", "branding and print identity systems") == "communication"
    assert classify("Designer", "Figma prototyping and user flows for our app") == "product"

    # Negative: ambiguous bare designer with no signal.
    assert classify("Designer") is None
    assert classify("Designer", "join our fast-growing team") is None

    # Negative: management / generic non-design roles.
    assert classify("Product Manager") is None
    assert classify("Program Manager") is None
    assert classify("Project Manager") is None
    assert classify("Sales Executive") is None
    assert classify("Marketing Manager") is None
    assert classify("Data Analyst") is None
    assert classify("Data Scientist") is None
    assert classify("Business Analyst") is None

    # Negative: software / hardware ENGINEERING roles, including ones whose
    # titles literally contain "design".
    assert classify("Design Engineer") is None
    assert classify("Software Engineer") is None
    assert classify("Hardware Engineer") is None
    assert classify("Systems Engineer") is None
    assert classify("Frontend Engineer") is None
    assert classify("Frontend Developer") is None
    assert classify("Backend Engineer") is None
    assert classify("Full Stack Developer") is None
    assert classify("Web Developer") is None
    assert classify("Software Developer") is None
    # The real false positive: "Engineer I - SW Design" had been -> product.
    assert classify("Engineer I - SW Design", "C++, embedded software, RTOS") is None
    assert classify("SW Design Engineer") is None
    assert classify("Software Design Engineer") is None
    assert classify("Design Verification Engineer") is None
    assert classify("VLSI Design Engineer") is None
    assert classify("PCB Design Engineer") is None
    assert classify("Chip Design Lead") is None
    assert classify("Hardware Design Engineer") is None
    assert classify("CAD Engineer") is None
    assert classify("Firmware Engineer") is None
    # A bare "Designer" whose description is pure software must not leak through.
    assert classify("Designer", "Build our React app and design the software architecture") is None

    # Negative: recruiting / HR.
    assert classify("Senior Design Sourcer") is None
    assert classify("Design Sourcer") is None
    assert classify("Technical Recruiter") is None
    assert classify("Talent Acquisition Specialist") is None
    assert classify("HR Manager") is None
    assert classify("HR") is None

    # Negative: out-of-scope "design" verticals India boards drag in.
    assert classify("Interior Designer") is None
    assert classify("Interior Design Intern") is None
    assert classify("Architect") is None
    assert classify("Solution Architect") is None
    assert classify("Landscape Architecture Intern") is None
    assert classify("Fashion Designer") is None
    assert classify("Apparel Designer") is None
    assert classify("Garment Design Intern") is None
    assert classify("Textile Designer") is None
    assert classify("Clothing Designer") is None
    assert classify("Jewellery Designer") is None
    assert classify("Jewelry Designer") is None
    assert classify("Set Designer") is None
    assert classify("Instructional Designer") is None
    assert classify("Game Designer") is None
    assert classify("Game UI Designer") is None
    assert classify("Level Designer") is None
    assert classify("Narrative Designer") is None
    assert classify("UX Writer") is None
    assert classify("Content Designer") is None
    assert classify("Content Strategist") is None

    # Negative: "design" bolted onto a sales/marketing role.
    assert classify("Design (Sales)") is None
    assert classify("Design - Marketing") is None
    assert classify("Sales Designer") is None

    # Guard: genuine design titles are NOT caught by the new exclusions.
    assert classify("Design Technologist") == "uiux"
    assert classify("UX Designer", "collaborate with engineers and developers") == "uiux"
    assert classify("Graphic Designer", "work with the marketing team on campaigns") == "communication"
    assert classify("Industrial Designer", "automotive interior surfaces") == "industrial"

    print("classify tests OK")
