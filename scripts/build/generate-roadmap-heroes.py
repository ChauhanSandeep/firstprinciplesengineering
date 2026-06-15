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
)

VAULT_EX_DIR = Path("/Users/sandeep/Idea/ObisdianNotes/Excalidraw")
TEMPLATE = SKILL_DIR / "render_template.html"


# ---------------------------------------------------------------------------
# Hero diagram builders
# ---------------------------------------------------------------------------

def _title_band(title: str, subtitle: str, *, width: int = 1600) -> list:
    """Top band shared across all heroes — bold title + dim subtitle."""
    return [
        text(60, 30, title, size=44, color=PALETTE["title"], align="left", width=width - 120),
        text(60, 90, subtitle, size=18, color=PALETTE["dim"], align="left", width=width - 120),
    ]


def _pillar(x, y, w, h, role, title, items, *, item_color=None) -> list:
    """A column pillar with role-tinted header band and a bulleted list."""
    items_color = item_color or PALETTE["body"]
    header_h = 56
    r, t = role_rect(x, y, w, header_h, role, title, label_size=22)
    body = rect(x, y + header_h, w, h - header_h,
                fill="transparent", stroke=PALETTE["section_stroke"], stroke_width=1)
    elements = [r, t, body]
    pad_x = 22
    line_y = y + header_h + 20
    for it in items:
        elements.append(text(x + pad_x, line_y, it, size=17,
                              color=items_color, align="left", width=w - pad_x * 2))
        line_y += 36
    return elements


def _flow_node(x, y, w, h, role, label, *, label_size=20) -> tuple:
    """A flow-chart node + its visible rect, returns (rect, text, x_center, y_center)."""
    r, t = role_rect(x, y, w, h, role, label, label_size=label_size)
    return r, t, x + w / 2, y + h / 2


def build_distributed_systems_hero() -> list:
    """3-pillar journey: Foundations → Coordination → Production reality."""
    elements: list = []
    elements += _title_band(
        "Distributed Systems Roadmap",
        "Time and identity → consensus and locks → partitioning, gossip, microservices",
        width=1600,
    )

    pillar_y = 160
    pillar_h = 460
    pillar_w = 460
    gap = 60
    x0 = 60

    elements += _pillar(
        x0, pillar_y, pillar_w, pillar_h, "replica",
        "1. Foundations",
        [
            "• Distributed Systems Primitives",
            "• Logical Clocks (Lamport, vector, HLC)",
            "• CAP and PACELC",
            "",
            "Why \"now\" is the hardest word",
            "in the language.",
        ],
    )

    elements += _pillar(
        x0 + (pillar_w + gap), pillar_y, pillar_w, pillar_h, "primary",
        "2. Coordination",
        [
            "• Consensus (Paxos, Raft)",
            "• Distributed Locks + fencing",
            "• MVCC and snapshot isolation",
            "• Distributed Transactions (2PC, Saga)",
            "",
            "What agreement costs you,",
            "and when to refuse to pay it.",
        ],
    )

    elements += _pillar(
        x0 + 2 * (pillar_w + gap), pillar_y, pillar_w, pillar_h, "infra",
        "3. Production",
        [
            "• Consistent Hashing + virtual nodes",
            "• Gossip Protocol (SWIM, anti-entropy)",
            "• Microservices, honestly",
            "",
            "The bill that comes due once you",
            "stop pretending the network is reliable.",
        ],
    )

    # Subtle arrows between pillars to imply the journey.
    arrow_y = pillar_y + 24
    for i in range(2):
        sx = x0 + (i + 1) * pillar_w + i * gap - 6
        ex = x0 + (i + 1) * (pillar_w + gap) + 6
        elements.append(arrow(sx, arrow_y, ex, arrow_y,
                              color=PALETTE["arr_neutral"], stroke_width=2))

    return elements


def build_system_design_hero() -> list:
    """5-stage horizontal pipeline: Wire → Storage → Caching → APIs → Architecture."""
    elements: list = []
    elements += _title_band(
        "System Design Roadmap",
        "Transport up to architecture — every component in the order that makes the why obvious",
        width=1700,
    )

    stages = [
        ("replica",   "Layer 0\nWire",        ["TCP / UDP / QUIC", "DNS, TLS"]),
        ("client",    "Layer 1\nStorage",     ["RDBMS, KV, Wide-column", "Indexes, MVCC"]),
        ("highlight", "Layer 2\nCaching",     ["LRU, write-back", "Redis patterns"]),
        ("primary",   "Layer 3\nAPIs",        ["REST / gRPC", "GraphQL, BFF"]),
        ("infra",     "Layer 4\nArchitecture", ["Microservices", "Event-driven", "Multi-tenancy"]),
    ]

    box_w = 280
    box_h = 220
    gap = 40
    y = 200
    x = 60
    centers = []

    for role, head, bullets in stages:
        # Header rect
        head_h = 70
        r_head, t_head = role_rect(x, y, box_w, head_h, role, head, label_size=20)
        elements.append(r_head)
        elements.append(t_head)
        # Body rect
        body = rect(x, y + head_h, box_w, box_h - head_h,
                    fill="transparent", stroke=PALETTE["section_stroke"], stroke_width=1)
        elements.append(body)
        # Bullets
        bx = x + 18
        by = y + head_h + 18
        for b in bullets:
            elements.append(text(bx, by, "• " + b, size=17,
                                  color=PALETTE["body"], align="left", width=box_w - 36))
            by += 30
        centers.append((x + box_w, y + box_h / 2))
        x += box_w + gap

    # Connect with neutral arrows
    for i in range(len(stages) - 1):
        sx, sy = centers[i]
        ex = sx + gap
        elements.append(arrow(sx + 4, sy, ex - 4, sy,
                              color=PALETTE["arr_neutral"], stroke_width=2))

    # Below the row, a small footer of three principles.
    footer_y = y + box_h + 40
    principles = [
        ("Capacity",   "Back-of-envelope math first."),
        ("Trade-offs", "Latency vs consistency vs cost."),
        ("Operability", "How does this fail at 3am?"),
    ]
    pw = 480
    pgap = 30
    px = 60
    for head, body in principles:
        elements.append(text(px, footer_y, head, size=20, color=PALETTE["hero"],
                              align="left", width=pw))
        elements.append(text(px, footer_y + 30, body, size=16, color=PALETTE["body"],
                              align="left", width=pw))
        px += pw + pgap

    return elements


def build_ai_systems_hero() -> list:
    """Pipeline: Data → Embed → Index → Retrieve → Generate, with eval and serving below."""
    elements: list = []
    elements += _title_band(
        "AI Systems Roadmap",
        "The 80% around the model: data, embeddings, retrieval, generation, evaluation",
        width=1600,
    )

    stages = [
        ("client",    "Data",     "Chunking,\nmetadata"),
        ("replica",   "Embed",    "Sentence,\nimage, code"),
        ("primary",   "Index",    "HNSW, IVF,\nVector DB"),
        ("highlight", "Retrieve", "ANN search,\nrerank"),
        ("infra",     "Generate", "Prompt assembly,\nLLM serving"),
    ]

    box_w = 260
    box_h = 180
    gap = 50
    y = 200
    x = 60
    centers = []

    for role, head, body in stages:
        head_h = 60
        r_head, t_head = role_rect(x, y, box_w, head_h, role, head, label_size=22)
        elements.append(r_head)
        elements.append(t_head)
        r_body = rect(x, y + head_h, box_w, box_h - head_h,
                      fill="transparent", stroke=PALETTE["section_stroke"], stroke_width=1)
        elements.append(r_body)
        elements.append(text(x + 18, y + head_h + 22, body, size=17,
                              color=PALETTE["body"], align="left", width=box_w - 36))
        centers.append((x + box_w / 2, y + box_h))
        x += box_w + gap

    # Arrows between top boxes
    for i in range(len(stages) - 1):
        sx = 60 + (i + 1) * box_w + i * gap - 6
        ex = 60 + (i + 1) * (box_w + gap) + 6
        elements.append(arrow(sx, y + 90, ex, y + 90,
                              color=PALETTE["arr_neutral"], stroke_width=2))

    # Bottom row — cross-cutting concerns under the pipeline.
    bot_y = y + box_h + 70
    bot_h = 110
    cross = [
        ("warning",  "Evaluation",   "Offline benchmarks,\nA/B, hallucination rate"),
        ("infra",    "Serving",      "GPU autoscaling,\nbatching, KV cache"),
        ("neutral",  "Observability", "Cost per request,\nlatency p95, eval drift"),
    ]
    cw = 480
    cgap = 30
    cx = 60
    for role, head, body in cross:
        head_h = 44
        r_head, t_head = role_rect(cx, bot_y, cw, head_h, role, head, label_size=20)
        elements.append(r_head)
        elements.append(t_head)
        body_r = rect(cx, bot_y + head_h, cw, bot_h - head_h,
                      fill="transparent", stroke=PALETTE["section_stroke"], stroke_width=1)
        elements.append(body_r)
        elements.append(text(cx + 18, bot_y + head_h + 14, body, size=16,
                              color=PALETTE["body"], align="left", width=cw - 36))
        cx += cw + cgap

    return elements


def build_staff_engineer_hero() -> list:
    """Breadth map: 4 quadrants of staff scope around a center label."""
    elements: list = []
    elements += _title_band(
        "Staff Engineer Roadmap",
        "Breadth, not depth — the trade-offs a staff engineer pulls from cold",
        width=1600,
    )

    # Center "you" node
    cx = 760
    cy = 410
    cw = 200
    ch = 90
    r_center, t_center = role_rect(cx, cy, cw, ch, "highlight", "Staff Engineer", label_size=22)
    elements.append(r_center)
    elements.append(t_center)

    # 4 quadrants
    quads = [
        # (role,    title,             items,                                                   pos)
        ("replica",
         "Systems & Storage",
         ["Replication, sharding, consensus",
          "Storage engines (LSM, B-tree, MVCC)",
          "Caching at every layer"],
         (60, 170)),
        ("primary",
         "APIs & Messaging",
         ["REST, gRPC, GraphQL, BFF",
          "Kafka, queues, streaming",
          "Idempotency, ordering, retries"],
         (1080, 170)),
        ("infra",
         "Architecture & Ops",
         ["Microservices vs modular monolith",
          "Multi-tenancy, multi-region",
          "Observability, SLOs, on-call"],
         (60, 580)),
        ("warning",
         "Security & Trust",
         ["AuthN/Z, JWT, OAuth, mTLS",
          "Crypto primitives in plain English",
          "Threat modeling, audit logs"],
         (1080, 580)),
    ]

    box_w = 620
    box_h = 220
    for role, title, items, (x, y) in quads:
        head_h = 56
        r_head, t_head = role_rect(x, y, box_w, head_h, role, title, label_size=22)
        elements.append(r_head)
        elements.append(t_head)
        body = rect(x, y + head_h, box_w, box_h - head_h,
                    fill="transparent", stroke=PALETTE["section_stroke"], stroke_width=1)
        elements.append(body)
        ly = y + head_h + 18
        for it in items:
            elements.append(text(x + 22, ly, "• " + it, size=17,
                                  color=PALETTE["body"], align="left", width=box_w - 44))
            ly += 36

        # Dim line connecting quadrant header to center
        # We approximate the center entry point per quadrant
        if y < cy:  # top quadrants -> arrow down to top of center
            sx = x + box_w / 2
            sy = y + box_h
            ex = cx + cw / 2
            ey = cy
        else:  # bottom quadrants -> arrow up to bottom of center
            sx = x + box_w / 2
            sy = y
            ex = cx + cw / 2
            ey = cy + ch
        elements.append(line(sx, sy, ex, ey,
                              color=PALETTE["section_stroke"], stroke_width=1,
                              stroke_style="dashed"))

    # Footer hint
    elements.append(text(60, 830,
                          "Pick depth in 2–3 areas; have a one-paragraph mental model for the rest.",
                          size=18, color=PALETTE["dim"], align="left", width=1500))

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
    ("Roadmap-Distributed-Systems-Hero",  build_distributed_systems_hero,  1600, 700),
    ("Roadmap-System-Design-Hero",        build_system_design_hero,        1700, 700),
    ("Roadmap-AI-Systems-Hero",           build_ai_systems_hero,           1600, 700),
    ("Roadmap-Staff-Engineer-Hero",       build_staff_engineer_hero,       1700, 870),
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
