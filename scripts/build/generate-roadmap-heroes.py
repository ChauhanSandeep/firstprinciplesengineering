"""Generate Excalidraw hero diagrams for each roadmap.

Produces 4 GitHub-dark-themed Excalidraw hero diagrams:
  - Distributed Systems Roadmap
  - System Design Roadmap
  - AI Systems Roadmap
  - Staff Engineer Roadmap

For each roadmap it writes a `.excalidraw.md` source file and a rendered
`.excalidraw.dark.svg` companion in the vault's `Excalidraw/` folder.
The site-side fix-excalidraw-paths step will then surface the dark SVG
in both light and dark site themes (until a light companion is added).

Usage:
    /Users/sandeep/.local/bin/uv run --no-sync --project \
      /Users/sandeep/Idea/ObisdianNotes/.claude/skills/excalidraw-note-diagram/references \
      python scripts/build/generate-roadmap-heroes.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Wire in note_diagram_lib + the Playwright SVG renderer template.
SKILL_DIR = Path(
    "/Users/sandeep/Idea/ObisdianNotes/.claude/skills/excalidraw-note-diagram/references"
)
sys.path.insert(0, str(SKILL_DIR))

from note_diagram_lib import (  # noqa: E402
    PALETTE, rect, text, line, arrow, bound_text, role_rect, write_diagram,
    ellipse, diamond,
)

VAULT_EX_DIR = Path("/Users/sandeep/Idea/ObisdianNotes/Excalidraw")
TEMPLATE = SKILL_DIR / "render_template.html"


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


# ---------- Distributed Systems: a mesh of nodes across an unreliable network ----------

def build_distributed_systems_hero() -> list:
    """Abstract: many nodes coordinating across a network, with one broken link."""
    elements: list = []
    elements += _title_block(
        "Distributed Systems",
        [
            "Coordination, consistency, and the cost of `now`",
            "across machines that fail independently.",
        ],
    )

    # Right-side mesh: ~6 nodes arranged loosely; connected by arrows, one dashed.
    cx0 = 1100  # right region origin
    cy0 = 80
    region_w = 440
    region_h = 380

    # Node positions (relative to region origin), as a loose constellation.
    positions = [
        (90,  60),   # 0 top-left
        (300, 30),   # 1 top-right
        (60,  220),  # 2 mid-left
        (220, 170),  # 3 center
        (380, 200),  # 4 mid-right
        (160, 340),  # 5 bottom-left
        (340, 340),  # 6 bottom-right
    ]
    roles = ["replica", "primary", "replica", "primary",
             "replica", "infra", "infra"]
    nodes = []
    node_d = 64
    for (px, py), role in zip(positions, roles):
        fill = PALETTE[f"{role}_fill"]
        stroke = PALETTE[f"{role}_stroke"]
        nodes.append((cx0 + px, cy0 + py))
        elements.append(ellipse(cx0 + px - node_d / 2, cy0 + py - node_d / 2,
                                 node_d, node_d, fill=fill, stroke=stroke))

    # Connections: form a connected mesh. One link is dashed (network partition).
    links = [
        (0, 1, "solid"),
        (0, 3, "solid"),
        (1, 3, "solid"),
        (1, 4, "solid"),
        (2, 3, "solid"),
        (3, 4, "dashed"),  # partition
        (2, 5, "solid"),
        (3, 5, "solid"),
        (3, 6, "solid"),
        (4, 6, "solid"),
        (5, 6, "solid"),
    ]
    for a, b, style in links:
        x1, y1 = nodes[a]
        x2, y2 = nodes[b]
        color = PALETTE["arr_warn"] if style == "dashed" else PALETTE["arr_neutral"]
        elements.append(line(x1, y1, x2, y2,
                              color=color, stroke_width=2, stroke_style=style))

    return elements


# ---------- System Design: an iceberg / layered stack with growth arrow ----------

def build_system_design_hero() -> list:
    """Abstract: layered system stack with an upward growth/scale arrow."""
    elements: list = []
    elements += _title_block(
        "System Design",
        [
            "From first principles to billions of requests.",
            "Every component, in the order that makes the why obvious.",
        ],
    )

    # Right-side: a stack of 5 nested rectangles getting progressively wider,
    # implying layers of abstraction. Above the top layer, a growth arrow.
    base_cx = 1320
    base_y = 460
    layer_h = 40
    gap = 4
    widths = [560, 480, 400, 320, 240]
    role_keys = ["infra", "primary", "highlight", "replica", "client"]
    y = base_y
    for w, role in zip(widths, role_keys):
        fill = PALETTE[f"{role}_fill"]
        stroke = PALETTE[f"{role}_stroke"]
        elements.append(rect(base_cx - w / 2, y - layer_h, w, layer_h,
                              fill=fill, stroke=stroke, stroke_width=2))
        y -= layer_h + gap

    # Upward growth arrow on the right side of the stack
    arr_x = base_cx + 320
    elements.append(arrow(arr_x, base_y, arr_x, base_y - (layer_h + gap) * 5 - 30,
                           color=PALETTE["title"], stroke_width=3))
    elements.append(text(arr_x + 16, base_y - (layer_h + gap) * 5 - 10,
                         "scale", size=20, color=PALETTE["title"],
                         align="left", width=120))

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


# ---------- Staff Engineer: a balance scale (trade-offs) on a horizon ----------

def build_staff_engineer_hero() -> list:
    """Abstract: a balance/scale icon — trade-offs are the staff role's daily work."""
    elements: list = []
    elements += _title_block(
        "Staff Engineer",
        [
            "Trade-offs, leverage, and the long view.",
            "Breadth across systems, depth where it matters.",
        ],
    )

    # Right region: a stylized balance scale.
    cx = 1320         # fulcrum x
    fulcrum_y = 280
    beam_half = 200
    arm_tilt = 20     # left tray higher, right tray lower (or vice versa)

    # Base pedestal
    elements.append(rect(cx - 80, fulcrum_y + 140, 160, 24,
                          fill=PALETTE["neutral_fill"],
                          stroke=PALETTE["neutral_stroke"], stroke_width=2))
    # Pillar
    elements.append(rect(cx - 8, fulcrum_y, 16, 140,
                          fill=PALETTE["neutral_fill"],
                          stroke=PALETTE["neutral_stroke"], stroke_width=2))
    # Fulcrum (small triangle approximated as diamond)
    elements.append(diamond(cx - 20, fulcrum_y - 20, 40, 40,
                              fill=PALETTE["title"],
                              stroke=PALETTE["title"]))

    # Beam — slightly tilted
    left_x = cx - beam_half
    right_x = cx + beam_half
    left_y = fulcrum_y - arm_tilt
    right_y = fulcrum_y + arm_tilt
    elements.append(line(left_x, left_y, right_x, right_y,
                          color=PALETTE["neutral_stroke"], stroke_width=4))

    # Suspending lines + trays
    tray_w = 110
    tray_h = 14
    tray_drop = 70
    # Left tray (higher)
    elements.append(line(left_x, left_y, left_x, left_y + tray_drop,
                          color=PALETTE["neutral_stroke"], stroke_width=2))
    elements.append(rect(left_x - tray_w / 2, left_y + tray_drop, tray_w, tray_h,
                          fill=PALETTE["replica_fill"],
                          stroke=PALETTE["replica_stroke"], stroke_width=2))
    # Right tray (lower)
    elements.append(line(right_x, right_y, right_x, right_y + tray_drop,
                          color=PALETTE["neutral_stroke"], stroke_width=2))
    elements.append(rect(right_x - tray_w / 2, right_y + tray_drop, tray_w, tray_h,
                          fill=PALETTE["infra_fill"],
                          stroke=PALETTE["infra_stroke"], stroke_width=2))

    # A small "weight" (cube) on each tray to imply trade-offs
    elements.append(rect(left_x - 22, left_y + tray_drop - 36, 44, 36,
                          fill=PALETTE["replica_fill"],
                          stroke=PALETTE["replica_stroke"], stroke_width=2))
    elements.append(rect(right_x - 28, right_y + tray_drop - 44, 56, 44,
                          fill=PALETTE["infra_fill"],
                          stroke=PALETTE["infra_stroke"], stroke_width=2))

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

def render_to_svg(excalidraw_md: Path, svg_out: Path) -> None:
    """Render a .excalidraw.md to a .svg file via the bundled render template.

    Mirrors render_excalidraw.py's render() except we capture the SVG's
    outerHTML and write it to disk (instead of element.screenshot to PNG).
    """
    from playwright.sync_api import sync_playwright
    from render_excalidraw import (
        extract_json_from_excalidraw_md, validate_excalidraw, compute_bounding_box,
    )

    data = extract_json_from_excalidraw_md(excalidraw_md)
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

    # Drop xmlns:xlink etc. unchanged; just ensure we have an <?xml ...?> header.
    if not svg_html.lstrip().startswith("<?xml"):
        svg_html = '<?xml version="1.0" encoding="UTF-8"?>\n' + svg_html
    svg_out.write_text(svg_html, encoding="utf-8")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

HEROES = [
    ("Roadmap-Distributed-Systems-Hero",  build_distributed_systems_hero,  CANVAS_W, CANVAS_H),
    ("Roadmap-System-Design-Hero",        build_system_design_hero,        CANVAS_W, CANVAS_H),
    ("Roadmap-AI-Systems-Hero",           build_ai_systems_hero,           CANVAS_W, CANVAS_H),
    ("Roadmap-Staff-Engineer-Hero",       build_staff_engineer_hero,       CANVAS_W, CANVAS_H),
]


def main() -> None:
    VAULT_EX_DIR.mkdir(parents=True, exist_ok=True)
    for stem, builder, w, h in HEROES:
        print(f"--- {stem} ---")
        elements = builder()
        md_path = VAULT_EX_DIR / f"{stem}.excalidraw.md"
        write_excalidraw_md(md_path, elements, width=w, height=h)
        print(f"wrote {md_path}")
        svg_path = VAULT_EX_DIR / f"{stem}.excalidraw.dark.svg"
        render_to_svg(md_path, svg_path)
        size = svg_path.stat().st_size
        print(f"wrote {svg_path} ({size} bytes)")


if __name__ == "__main__":
    main()
