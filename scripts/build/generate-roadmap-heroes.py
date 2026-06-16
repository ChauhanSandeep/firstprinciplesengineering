"""Generate Excalidraw hero diagrams for each roadmap.

Produces 3 Excalidraw hero diagrams:
  - Foundations Roadmap
  - System Design Interviews Roadmap
  - AI Systems Roadmap

For each roadmap it writes a `.excalidraw.md` source file plus rendered
`.excalidraw.dark.svg` and `.excalidraw.light.svg` companions in the vault's
`Excalidraw/` folder. The site-side fix-excalidraw-paths step then emits the
matching `<img class="excalidraw-light">` / `<img class="excalidraw-dark">`
pair so the website switches variants with the Quartz theme.

Usage:
    /Users/sandeep/.local/bin/uv run --no-sync --project \
      /Users/sandeep/Idea/ObisdianNotes/.claude/skills/excalidraw-note-diagram/references \
      python scripts/build/generate-roadmap-heroes.py
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

# Wire in note_diagram_lib + the Playwright SVG renderer template.
SKILL_DIR = Path(
    "/Users/sandeep/Idea/ObisdianNotes/.claude/skills/excalidraw-note-diagram/references"
)
sys.path.insert(0, str(SKILL_DIR))

from note_diagram_lib import (  # noqa: E402
    PALETTE, rect, text, line, arrow, write_diagram, ellipse,
)

VAULT_EX_DIR = Path(
    os.environ.get("ROADMAP_HERO_VAULT_EX_DIR", "/Users/sandeep/Idea/ObisdianNotes/Excalidraw")
)
TEMPLATE = SKILL_DIR / "render_template.html"

LIGHT_COLOR_MAP = {
    # canvas / cards / strokes
    "#0d1117": "#ffffff",
    "#161b22": "#f6f8fa",
    "#30363d": "#d0d7de",
    # text
    "#ff8c42": "#bc4c00",
    "#e6edf3": "#24292f",
    "#c9d1d9": "#3b434b",
    "#8b949e": "#57606a",
    "#f0b070": "#9a6700",
    "#ffffff": "#24292f",
    # role fills/strokes
    "#1f4d2b": "#dafbe1",
    "#3fb950": "#1a7f37",
    "#3a1d6e": "#fbefff",
    "#a371f7": "#8250df",
    "#0d2c5a": "#ddf4ff",
    "#58a6ff": "#0969da",
    "#5c3a10": "#fff8c5",
    "#f0883e": "#9a6700",
    "#4a1219": "#ffebe9",
    "#f85149": "#cf222e",
    "#3a5d1d": "#eaf8d7",
    "#6dbf3a": "#2da44e",
    "#21262d": "#f6f8fa",
}


# ---------------------------------------------------------------------------
# Hero diagram builders
#
# Design principle: each hero is a wide banner. Left half = bold orange
# title + dim subtitle/tagline (says WHAT the roadmap is about). Right half
# = a small abstract illustration evocative of the topic — NEVER an
# enumerated list of stages or chapters, because that content will evolve.
# The illustrations are made from unlabeled shapes only.
# ---------------------------------------------------------------------------

CANVAS_W = 1600
CANVAS_H = 520


def _title_block(title: str, taglines: list) -> list:
    """Bold orange title + 1-3 dim tagline lines on the left half of the banner."""
    out = [
        text(80, 140, title, size=72, color=PALETTE["title"], align="left", width=900),
    ]
    y = 260
    for line_text in taglines:
        out.append(text(80, y, line_text, size=26, color=PALETTE["body"],
                        align="left", width=900))
        y += 46
    return out


# ---------- Foundations: stack + network mesh ----------

def build_foundations_hero() -> list:
    """Abstract: foundational layers supporting a small distributed mesh."""
    elements: list = []
    elements += _title_block(
        "Foundations",
        [
            "The fundamentals that keep showing up:",
            "networking, data, caching, failure, operations.",
        ],
    )

    # Right-side foundation blocks.
    base_cx = 1320
    base_y = 440
    widths = [520, 430, 340]
    roles = ["infra", "replica", "client"]
    for i, (w, role) in enumerate(zip(widths, roles)):
        y = base_y - i * 54
        elements.append(rect(base_cx - w / 2, y, w, 42,
                             fill=PALETTE[f"{role}_fill"],
                             stroke=PALETTE[f"{role}_stroke"],
                             stroke_width=2))

    # A small mesh sits above the foundation to show the blocks support systems.
    cx0 = 1130
    cy0 = 100
    positions = [
        (80, 60),
        (250, 30),
        (50, 190),
        (210, 180),
        (360, 150),
    ]
    mesh_roles = ["replica", "primary", "client", "highlight", "infra"]
    nodes = []
    node_d = 64
    for (px, py), role in zip(positions, mesh_roles):
        fill = PALETTE[f"{role}_fill"]
        stroke = PALETTE[f"{role}_stroke"]
        nodes.append((cx0 + px, cy0 + py))
        elements.append(ellipse(cx0 + px - node_d / 2, cy0 + py - node_d / 2,
                                 node_d, node_d, fill=fill, stroke=stroke))

    links = [
        (0, 1, "solid"),
        (0, 3, "solid"),
        (1, 4, "solid"),
        (2, 3, "solid"),
        (3, 4, "dashed"),
    ]
    for a, b, style in links:
        x1, y1 = nodes[a]
        x2, y2 = nodes[b]
        color = PALETTE["arr_warn"] if style == "dashed" else PALETTE["arr_neutral"]
        elements.append(line(x1, y1, x2, y2,
                              color=color, stroke_width=2, stroke_style=style))

    return elements


# ---------- System Design Interviews: whiteboard system sketch + scale arrow ----------

def build_system_design_interviews_hero() -> list:
    """Abstract: interview whiteboard sketch with a scale arrow."""
    elements: list = []
    elements += _title_block(
        "System Design Interviews",
        [
            "Turn ambiguous requirements into a clear design:",
            "API, data, scale, failure, trade-offs.",
        ],
    )

    # Whiteboard card.
    board_x = 1060
    board_y = 110
    board_w = 470
    board_h = 310
    elements.append(rect(board_x, board_y, board_w, board_h,
                         fill=PALETTE["section_bg"],
                         stroke=PALETTE["section_stroke"],
                         stroke_width=2))

    # Abstract boxes and arrows: intentionally unlabeled so the cover doesn't
    # pin specific problems or components.
    boxes = [
        (board_x + 50, board_y + 70, 90, 60, "client"),
        (board_x + 195, board_y + 55, 95, 70, "primary"),
        (board_x + 340, board_y + 75, 85, 55, "replica"),
        (board_x + 175, board_y + 190, 130, 70, "infra"),
    ]
    centers = []
    for x, y, w, h, role in boxes:
        elements.append(rect(x, y, w, h,
                             fill=PALETTE[f"{role}_fill"],
                             stroke=PALETTE[f"{role}_stroke"],
                             stroke_width=2))
        centers.append((x + w / 2, y + h / 2))
    elements.append(arrow(centers[0][0] + 45, centers[0][1], centers[1][0] - 48, centers[1][1],
                          color=PALETTE["arr_neutral"], stroke_width=2))
    elements.append(arrow(centers[1][0] + 48, centers[1][1], centers[2][0] - 42, centers[2][1],
                          color=PALETTE["arr_neutral"], stroke_width=2))
    elements.append(arrow(centers[1][0], centers[1][1] + 38, centers[3][0], centers[3][1] - 40,
                          color=PALETTE["title"], stroke_width=2))

    # Small check marks on the board edge: requirements clarified.
    for i, role in enumerate(["highlight", "replica", "infra"]):
        y = board_y + 230 + i * 28
        elements.append(ellipse(board_x + 36, y, 16, 16,
                                fill=PALETTE[f"{role}_fill"],
                                stroke=PALETTE[f"{role}_stroke"]))

    return elements


# ---------- AI Systems: model at the center, infrastructure orbiting ----------

def build_ai_systems_hero() -> list:
    """Abstract: a central model node with infrastructure satellites around it."""
    elements: list = []
    elements += _title_block(
        "AI Systems",
        [
            "Engineering the 80% around the model:",
            "data, retrieval, serving, evaluation, observability.",
        ],
    )

    # Right region — hub and spoke
    cx = 1320
    cy = 270
    hub_d = 110
    # Central hub (the "model")
    elements.append(ellipse(cx - hub_d / 2, cy - hub_d / 2, hub_d, hub_d,
                             fill=PALETTE["primary_fill"],
                             stroke=PALETTE["primary_stroke"]))
    elements.append(text(cx - 70, cy - 16, "model", size=22,
                         color=PALETTE["node_text"], align="center", width=140))

    # 6 satellites in a ring around the hub
    import math
    radius = 200
    sat_d = 56
    sat_roles = ["replica", "client", "infra", "warning", "highlight", "neutral"]
    for i, role in enumerate(sat_roles):
        angle = -math.pi / 2 + i * (2 * math.pi / len(sat_roles))
        sx = cx + radius * math.cos(angle)
        sy = cy + radius * math.sin(angle)
        # spoke to hub
        edge_x = cx + (hub_d / 2 + 2) * math.cos(angle)
        edge_y = cy + (hub_d / 2 + 2) * math.sin(angle)
        sat_edge_x = sx - (sat_d / 2 + 2) * math.cos(angle)
        sat_edge_y = sy - (sat_d / 2 + 2) * math.sin(angle)
        elements.append(line(edge_x, edge_y, sat_edge_x, sat_edge_y,
                              color=PALETTE["section_stroke"],
                              stroke_width=2, stroke_style="solid"))
        # satellite circle
        elements.append(ellipse(sx - sat_d / 2, sy - sat_d / 2, sat_d, sat_d,
                                 fill=PALETTE[f"{role}_fill"],
                                 stroke=PALETTE[f"{role}_stroke"]))

    return elements


# ---------------------------------------------------------------------------
# .excalidraw.md writer — overrides theme=light per stored-memory convention
# ---------------------------------------------------------------------------

def write_excalidraw_md(path: Path, elements: list, *, width: int, height: int) -> None:
    """Wrap the elements in the .excalidraw.md envelope using note_diagram_lib's
    writer, then patch appState.theme to 'light' so Obsidian renders in dark
    AS-STORED (per stored memory about GitHub-dark palette behavior)."""
    write_diagram(path, elements, width=width, height=height)
    # Read back, patch theme=light inside the JSON block (memories say
    # theme=light + dark fills renders correctly in Obsidian dark mode).
    raw = path.read_text(encoding="utf-8")
    raw = raw.replace('"theme": "dark"', '"theme": "light"', 1)
    path.write_text(raw, encoding="utf-8")


# ---------------------------------------------------------------------------
# Playwright -> SVG renderer (saves SVG outerHTML, not PNG)
# ---------------------------------------------------------------------------

def _map_color(value: str) -> str:
    if not isinstance(value, str):
        return value
    return LIGHT_COLOR_MAP.get(value.lower(), value)


def light_variant(data: dict) -> dict:
    """Return a light-theme copy of a GitHub-dark Excalidraw scene."""
    out = json.loads(json.dumps(data))
    app = out.setdefault("appState", {})
    app["viewBackgroundColor"] = _map_color(app.get("viewBackgroundColor", PALETTE["bg"]))
    app["theme"] = "light"

    for element in out.get("elements", []):
        for key in ("strokeColor", "backgroundColor"):
            if key in element:
                element[key] = _map_color(element[key])
    return out


def render_data_to_svg(data: dict, svg_out: Path) -> None:
    """Render Excalidraw JSON data to a .svg file via the bundled render template."""
    from playwright.sync_api import sync_playwright
    from render_excalidraw import validate_excalidraw, compute_bounding_box

    errs = validate_excalidraw(data)
    if errs:
        raise RuntimeError(f"Invalid excalidraw: {errs}")

    elements = [e for e in data["elements"] if not e.get("isDeleted")]
    min_x, min_y, max_x, max_y = compute_bounding_box(elements)
    pad = 80
    vw = min(int(max_x - min_x + pad * 2), 2400)
    vh = min(max(int(max_y - min_y + pad * 2), 600), 8000)

    template_url = TEMPLATE.as_uri()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": vw, "height": vh}, device_scale_factor=1)
        page.on("pageerror", lambda err: print(f"[browser pageerror] {err}", file=sys.stderr))
        page.on("console",
                lambda m: print(f"[browser {m.type}] {m.text}", file=sys.stderr)
                if m.type in ("error", "warning") else None)
        page.goto(template_url)
        page.wait_for_function("window.__moduleReady === true", timeout=120000)
        result = page.evaluate(f"window.renderDiagram({json.dumps(data)})")
        if not result or not result.get("success"):
            raise RuntimeError(f"renderDiagram failed: {result}")
        page.wait_for_function("window.__renderComplete === true", timeout=15000)
        svg_html = page.evaluate(
            "document.querySelector('#root svg') && document.querySelector('#root svg').outerHTML"
        )
        if not svg_html:
            raise RuntimeError("No SVG in #root after render")
        browser.close()

    if not svg_html.lstrip().startswith("<?xml"):
        svg_html = '<?xml version="1.0" encoding="UTF-8"?>\n' + svg_html
    svg_out.write_text(svg_html, encoding="utf-8")


def render_to_svg(excalidraw_md: Path, svg_out: Path, *, variant: str = "dark") -> None:
    """Render a .excalidraw.md to a dark or light .svg file.

    Mirrors render_excalidraw.py's render() except we capture the SVG's
    outerHTML and write it to disk (instead of element.screenshot to PNG).
    """
    from render_excalidraw import extract_json_from_excalidraw_md

    data = extract_json_from_excalidraw_md(excalidraw_md)
    if variant == "light":
        data = light_variant(data)
    elif variant != "dark":
        raise ValueError(f"unknown variant: {variant}")
    render_data_to_svg(data, svg_out)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

HEROES = [
    ("Roadmap-Foundations-Hero",                 build_foundations_hero,                 CANVAS_W, CANVAS_H),
    ("Roadmap-System-Design-Interviews-Hero",    build_system_design_interviews_hero,    CANVAS_W, CANVAS_H),
    ("Roadmap-AI-Systems-Hero",                  build_ai_systems_hero,                  CANVAS_W, CANVAS_H),
]


def main() -> None:
    VAULT_EX_DIR.mkdir(parents=True, exist_ok=True)
    for stem, builder, w, h in HEROES:
        print(f"--- {stem} ---")
        elements = builder()
        md_path = VAULT_EX_DIR / f"{stem}.excalidraw.md"
        write_excalidraw_md(md_path, elements, width=w, height=h)
        print(f"wrote {md_path}")
        for variant in ("dark", "light"):
            svg_path = VAULT_EX_DIR / f"{stem}.excalidraw.{variant}.svg"
            render_to_svg(md_path, svg_path, variant=variant)
            size = svg_path.stat().st_size
            print(f"wrote {svg_path} ({size} bytes)")


if __name__ == "__main__":
    main()
