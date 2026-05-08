"""
Build the "Using Marvex Studio" welcome PDF that ships with every waitlist
confirmation email. Idempotent — re-running this script just overwrites the
output. Output: /app/backend/assets/using-marvex.pdf

Run:  python /app/backend/scripts/build_welcome_pdf.py
"""

from pathlib import Path

from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, ListFlowable, ListItem,
)


OUT = Path("/app/backend/assets/using-marvex.pdf")
OUT.parent.mkdir(parents=True, exist_ok=True)


# Cosmic-bg palette — same accents as the web product so the PDF feels
# like a genuine extension of the site, not a generic onboarding doc.
NAVY = colors.HexColor("#03060f")
INK  = colors.HexColor("#0a0f24")
CYAN = colors.HexColor("#00f0ff")
VIOLET = colors.HexColor("#8a5bff")
TEXT = colors.HexColor("#e6edf7")
MUTED = colors.HexColor("#9aaad0")
DIM = colors.HexColor("#566187")


styles = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=styles["Heading1"],
                   fontName="Helvetica-Bold", fontSize=28, leading=32,
                   textColor=TEXT, spaceAfter=14, alignment=TA_LEFT)
H2 = ParagraphStyle("H2", parent=styles["Heading2"],
                   fontName="Helvetica-Bold", fontSize=18, leading=22,
                   textColor=CYAN, spaceBefore=18, spaceAfter=10)
H3 = ParagraphStyle("H3", parent=styles["Heading3"],
                   fontName="Helvetica-Bold", fontSize=13, leading=17,
                   textColor=TEXT, spaceBefore=10, spaceAfter=4)
BODY = ParagraphStyle("Body", parent=styles["BodyText"],
                     fontName="Helvetica", fontSize=11, leading=16,
                     textColor=TEXT, spaceAfter=8)
MUTED_S = ParagraphStyle("Muted", parent=BODY, textColor=MUTED, fontSize=10, leading=14)
EYEBROW = ParagraphStyle("Eyebrow", parent=BODY,
                         fontName="Helvetica-Bold", fontSize=9, leading=12,
                         textColor=CYAN, spaceAfter=4)
COVER_TITLE = ParagraphStyle("CoverTitle", parent=H1,
                             fontSize=44, leading=48, textColor=TEXT,
                             alignment=TA_LEFT, spaceAfter=8)
COVER_SUB = ParagraphStyle("CoverSub", parent=BODY,
                           fontSize=14, leading=20, textColor=MUTED,
                           spaceAfter=24)


def cosmic_bg(canvas, _doc):
    """Paint every page with the cosmic dark background + a subtle gradient
    bar down the left edge so it visually echoes the web product."""
    width, height = LETTER
    # Solid dark-navy fill
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    # Left accent bar
    canvas.setFillColor(CYAN)
    canvas.rect(0, 0, 6, height, fill=1, stroke=0)
    canvas.setFillColor(VIOLET)
    canvas.rect(6, 0, 4, height, fill=1, stroke=0)
    # Footer brand
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(DIM)
    canvas.drawString(0.6 * inch, 0.45 * inch, "marvex.app  ·  The Ultimate Research Lab")
    canvas.drawRightString(width - 0.6 * inch, 0.45 * inch, f"Page {canvas.getPageNumber()}")
    canvas.restoreState()


def kv_card(label, body):
    """A two-column 'callout' row used inside section pages."""
    t = Table(
        [[Paragraph(f"<b>{label}</b>", H3), Paragraph(body, BODY)]],
        colWidths=[1.6 * inch, 4.6 * inch],
        hAlign="LEFT",
    )
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (-1, -1), INK),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#1c2440")),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 12),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    return t


def bullets(items):
    return ListFlowable(
        [ListItem(Paragraph(x, BODY), bulletColor=CYAN, value="•") for x in items],
        bulletType="bullet",
        leftIndent=14,
        spaceAfter=8,
    )


def build():
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=LETTER,
        leftMargin=0.85 * inch,
        rightMargin=0.6 * inch,
        topMargin=0.7 * inch,
        bottomMargin=0.7 * inch,
        title="Using Marvex Studio",
        author="marvex.app",
    )

    flow = []

    # ---------------- Cover ----------------
    flow.append(Spacer(1, 1.6 * inch))
    flow.append(Paragraph("THE STARTER GUIDE  ·  v1", EYEBROW))
    flow.append(Paragraph("Using Marvex Studio", COVER_TITLE))
    flow.append(Paragraph(
        "A founders'-edition pocket manual for turning every PDF, every paper, "
        "and every loose idea into a beautiful, interactive map.",
        COVER_SUB,
    ))
    flow.append(Spacer(1, 0.4 * inch))
    flow.append(kv_card("What is this?",
        "Eight short chapters covering the moves that make Marvex Studio feel "
        "like magic. Skim it once before your first session — every shortcut "
        "and right-click pattern is in here."))
    flow.append(Spacer(1, 0.25 * inch))
    flow.append(kv_card("How long?",
        "About 12 minutes of reading. Each chapter is one page so you can "
        "jump to whatever you need, when you need it."))
    flow.append(Spacer(1, 0.6 * inch))
    flow.append(Paragraph("marvex.app  ·  The Ultimate Research Lab", MUTED_S))
    flow.append(PageBreak())

    # ---------------- Chapter 1 ----------------
    flow.append(Paragraph("01  ·  THE 60-SECOND PROMISE", EYEBROW))
    flow.append(Paragraph("Drop a paper. Get a map.", H1))
    flow.append(Paragraph(
        "Marvex Studio's flagship trick is this: you drop any PDF up to 25 MB "
        "onto the canvas, and in under 60 seconds the AI of your choice "
        "(Claude, GPT, or Gemini) extracts every concept, every relationship, "
        "every hierarchy, then draws them as nodes you can drag, edit, and "
        "explore.", BODY))
    flow.append(Paragraph("Your first run", H3))
    flow.append(bullets([
        "Open the Studio and click <b>Drop a PDF</b>.",
        "Pick any research paper, textbook chapter, or even a long article.",
        "Wait while the AI works — usually 30–60 seconds for a 20-page paper.",
        "When the map appears, click any node to expand its branch, or "
        "right-click for the full action menu.",
    ]))
    flow.append(Paragraph("Why it matters", H3))
    flow.append(Paragraph(
        "Marvex Studio is not a summary tool. The AI preserves the document's "
        "<b>structure</b> — every section, every sub-claim, every supporting "
        "reference is on the canvas in the same shape the author intended. "
        "You're not reading a précis; you're navigating the original argument.",
        BODY))
    flow.append(PageBreak())

    # ---------------- Chapter 2 ----------------
    flow.append(Paragraph("02  ·  THE STUDIO", EYEBROW))
    flow.append(Paragraph("Right-click is your best friend.", H1))
    flow.append(Paragraph(
        "Almost every action in the Studio lives behind a right-click. "
        "Master these and you'll never reach for a menu bar again.", BODY))
    flow.append(Paragraph("On a node", H3))
    flow.append(bullets([
        "<b>Add child / Add sibling</b> with a 1× to 10× multiplier.",
        "<b>Edit link</b> to attach a file, URL, or one of your existing PDFs.",
        "<b>Pick icon</b> to drop any of 1,200+ icons inside the node.",
        "<b>WordArt properties</b> for textbox annotations — bold gradients, "
        "outlines, glow.",
        "<b>AI expand</b> to ask the AI for the next layer of detail.",
    ]))
    flow.append(Paragraph("On the canvas (empty space)", H3))
    flow.append(bullets([
        "<b>Insert shape / sticky / clipart / image</b>.",
        "<b>Connect mode</b> — click two nodes to draw a connector "
        "with a label between them.",
        "<b>Background picker</b> — choose any of the cosmic presets or upload "
        "your own.",
    ]))
    flow.append(Paragraph("On a connector", H3))
    flow.append(bullets([
        "<b>Edit colour, width, dash, arrow</b> — all per-edge.",
        "<b>Add label</b> — describe the relationship between the two nodes.",
    ]))
    flow.append(PageBreak())

    # ---------------- Chapter 3 ----------------
    flow.append(Paragraph("03  ·  BRING YOUR OWN KEY", EYEBROW))
    flow.append(Paragraph("Your AI key. Your bill. Your data.", H1))
    flow.append(Paragraph(
        "Marvex Studio never marks up inference. There's no \"AI credit\" system, "
        "no per-map fee, no surprise bill at the end of the month — because "
        "the AI calls go directly from your machine to the provider you "
        "choose, paid for by your key.", BODY))
    flow.append(Paragraph("Where to get a key (free tiers exist)", H3))
    flow.append(bullets([
        "<b>Anthropic / Claude</b> — console.anthropic.com → API Keys",
        "<b>OpenAI / GPT</b> — platform.openai.com/api-keys",
        "<b>Google / Gemini</b> — aistudio.google.com/apikey",
    ]))
    flow.append(Paragraph("Setting it up", H3))
    flow.append(Paragraph(
        "In the Studio, click <b>Settings</b> → <b>API Keys</b> → paste your "
        "key. Your key never leaves your browser; we don't have a backend "
        "endpoint that touches it. The exact same key works for "
        "PDF→Map, Map→Document, AI Expand, and global search.", BODY))
    flow.append(PageBreak())

    # ---------------- Chapter 4 ----------------
    flow.append(Paragraph("04  ·  EVERY MAP, ONE SEARCH", EYEBROW))
    flow.append(Paragraph("Your second brain — finally searchable.", H1))
    flow.append(Paragraph(
        "Six months from now you'll vaguely remember mapping a paper about "
        "<i>X</i>, but you'll have no idea which map. The global search bar "
        "(top-left of the Library) queries every node title, every annotation, "
        "every sticky, across every map you've ever made. Hit Enter and the "
        "matching node lights up on the right map automatically.", BODY))
    flow.append(Paragraph("Pro moves", H3))
    flow.append(bullets([
        "Search is keyword-based by default. Quote phrases for exact matches.",
        "Results group by map, so you can see at a glance which document "
        "the idea originated from.",
        "Click a result to open the map and frame the matching node.",
    ]))
    flow.append(PageBreak())

    # ---------------- Chapter 5 ----------------
    flow.append(Paragraph("05  ·  OPEN ANYTHING", EYEBROW))
    flow.append(Paragraph("Every node, a launchpad.", H1))
    flow.append(Paragraph(
        "A Marvex Studio node isn't just a box with text. Right-click → "
        "<b>Edit link</b> on any node and you can attach:", BODY))
    flow.append(bullets([
        "A PDF (URL or upload) — opens in our built-in Reader where you can "
        "highlight, ink, and send selections back to the map.",
        "An audio file — opens in your default music app.",
        "A video — opens in your default video player.",
        "A website — opens in your default browser.",
        "Anything else — opens with whatever your OS associates with that "
        "extension.",
    ]))
    flow.append(Paragraph(
        "We never reinvent the wheel: PDFs are the only file type we open "
        "ourselves. Everything else hands off to the app you already use and "
        "love.", BODY))
    flow.append(PageBreak())

    # ---------------- Chapter 6 ----------------
    flow.append(Paragraph("06  ·  CALENDAR & REMINDERS", EYEBROW))
    flow.append(Paragraph("Deadlines find you. Not the other way around.", H1))
    flow.append(Paragraph(
        "Tag any node with a date (right-click → <b>Set reminder</b>) and it "
        "appears on the Calendar page — every map's reminders, talks, and "
        "follow-ups in one place. No Google account, no third-party sync. "
        "Local, private, and yours.", BODY))
    flow.append(Paragraph("Common workflows", H3))
    flow.append(bullets([
        "<b>Submission deadlines</b> — tag the root node of each paper map "
        "with the conference date.",
        "<b>Reading schedule</b> — split a long textbook map into chapters "
        "and date-tag each one.",
        "<b>Follow-up actions</b> — tag the conclusion node with a "
        "two-week-out reminder to revisit.",
    ]))
    flow.append(PageBreak())

    # ---------------- Chapter 7 ----------------
    flow.append(Paragraph("07  ·  CLOUD WHEN YOU CHOOSE", EYEBROW))
    flow.append(Paragraph("Local-first. Cloud-friendly. Your call.", H1))
    flow.append(Paragraph(
        "Maps live in your browser by default — no account required. When "
        "you want a backup or a collaborator, click <b>Cloud Save</b> and "
        "mirror the map to:", BODY))
    flow.append(bullets([
        "<b>Google Drive</b> — as PDF, PNG, SVG, Markdown, or a binary "
        "snapshot you can re-open later.",
        "<b>Dropbox</b> — same exports, your folder structure.",
        "<b>Zotero</b> — attach the map directly to the source paper as a "
        "child item, so it shows up next time you open the reference.",
    ]))
    flow.append(Paragraph(
        "Nothing is uploaded automatically. Every cloud action is one "
        "explicit click. Stop syncing and your maps live happily on local "
        "storage forever.", BODY))
    flow.append(PageBreak())

    # ---------------- Chapter 8 ----------------
    flow.append(Paragraph("08  ·  KEYBOARD SHORTCUTS", EYEBROW))
    flow.append(Paragraph("The cheat sheet.", H1))
    rows = [
        ["Action", "Shortcut"],
        ["Add child node", "Tab (with parent selected)"],
        ["Add sibling node", "Enter (with sibling selected)"],
        ["Edit node text", "F2 or double-click"],
        ["Delete node", "Delete / Backspace"],
        ["Move selected node(s)", "Arrow keys (Shift = larger steps)"],
        ["Multi-select rectangle", "Ctrl/Cmd + drag on empty canvas"],
        ["Pan canvas", "Hold space + drag, or middle-click drag"],
        ["Zoom", "Ctrl/Cmd + scroll, or pinch"],
        ["Fit to screen", "F or 0"],
        ["Undo / Redo", "Ctrl/Cmd + Z  /  Ctrl/Cmd + Shift + Z"],
        ["Toggle Film Mode", "Shift + F"],
        ["Open Command Palette", "Ctrl/Cmd + K"],
    ]
    table = Table(rows, colWidths=[3.6 * inch, 2.6 * inch], hAlign="LEFT")
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), CYAN),
        ("TEXTCOLOR", (0, 0), (-1, 0), NAVY),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("FONTNAME", (0, 1), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 1), (-1, -1), 10),
        ("TEXTCOLOR", (0, 1), (-1, -1), TEXT),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [INK, NAVY]),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    flow.append(table)
    flow.append(Spacer(1, 0.3 * inch))
    flow.append(Paragraph("That's it. Go map something.", H2))
    flow.append(Paragraph(
        "Reply to any of our emails with feedback, bugs, or feature wishes — "
        "every message lands in our inbox and gets read the same day. "
        "Welcome to the founders' round.", BODY))
    flow.append(Paragraph("— The Marvex Studio team", MUTED_S))

    doc.build(flow, onFirstPage=cosmic_bg, onLaterPages=cosmic_bg)
    print(f"✓ wrote {OUT} ({OUT.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    build()
