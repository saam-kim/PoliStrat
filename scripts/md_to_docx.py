from __future__ import annotations

import html
import re
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
OUT = DOCS / "word"


FILES = [
    "01_student_rules.md",
    "02_group_activity_sheet.md",
    "03_teacher_manual.md",
    "04_student_strategy_guide.md",
]


def esc(value: str) -> str:
    return html.escape(value, quote=False)


def text_runs(text: str, bold: bool = False) -> str:
    text = text.replace("`", "")
    props = "<w:rPr><w:b/></w:rPr>" if bold else ""
    return f"<w:r>{props}<w:t xml:space=\"preserve\">{esc(text)}</w:t></w:r>"


def paragraph(text: str, style: str | None = None, bold: bool = False) -> str:
    style_xml = f"<w:pPr><w:pStyle w:val=\"{style}\"/></w:pPr>" if style else ""
    return f"<w:p>{style_xml}{text_runs(text, bold)}</w:p>"


def table(rows: list[list[str]]) -> str:
    if not rows:
        return ""
    col_count = max(len(row) for row in rows)
    grid = "".join("<w:gridCol w:w=\"2400\"/>" for _ in range(col_count))
    body = [f"<w:tbl><w:tblPr><w:tblStyle w:val=\"TableGrid\"/><w:tblW w:w=\"0\" w:type=\"auto\"/></w:tblPr><w:tblGrid>{grid}</w:tblGrid>"]
    for row_index, row in enumerate(rows):
        body.append("<w:tr>")
        for cell in row + [""] * (col_count - len(row)):
            shade = "<w:shd w:fill=\"D9EAF7\"/>" if row_index == 0 else ""
            body.append(
                "<w:tc><w:tcPr><w:tcW w:w=\"2400\" w:type=\"dxa\"/>"
                f"{shade}</w:tcPr>"
                f"{paragraph(cell, bold=row_index == 0)}</w:tc>"
            )
        body.append("</w:tr>")
    body.append("</w:tbl>")
    return "".join(body)


def split_table_row(line: str) -> list[str]:
    return [cell.strip() for cell in line.strip().strip("|").split("|")]


def is_table_separator(line: str) -> bool:
    clean = line.strip().strip("|").replace(" ", "")
    return bool(clean) and set(clean) <= {"-", ":"}


def parse_markdown(raw: str) -> str:
    lines = raw.splitlines()
    output: list[str] = []
    i = 0
    pending: list[str] = []

    def flush_pending() -> None:
        if pending:
            output.append(paragraph(" ".join(pending)))
            pending.clear()

    while i < len(lines):
        line = lines[i].rstrip()
        stripped = line.strip()

        if not stripped:
            flush_pending()
            i += 1
            continue

        if stripped.startswith("|"):
            flush_pending()
            rows: list[list[str]] = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                current = lines[i].strip()
                if not is_table_separator(current):
                    rows.append(split_table_row(current))
                i += 1
            output.append(table(rows))
            continue

        if stripped.startswith("# "):
            flush_pending()
            output.append(paragraph(stripped[2:].strip(), "Title"))
            i += 1
            continue

        if stripped.startswith("## "):
            flush_pending()
            output.append(paragraph(stripped[3:].strip(), "Heading1"))
            i += 1
            continue

        if stripped.startswith("### "):
            flush_pending()
            output.append(paragraph(stripped[4:].strip(), "Heading2"))
            i += 1
            continue

        if stripped.startswith("- "):
            flush_pending()
            output.append(paragraph("• " + stripped[2:].strip()))
            i += 1
            continue

        numbered = re.match(r"^(\d+)\.\s+(.*)$", stripped)
        if numbered:
            flush_pending()
            output.append(paragraph(f"{numbered.group(1)}. {numbered.group(2)}"))
            i += 1
            continue

        pending.append(stripped)
        i += 1

    flush_pending()
    return "".join(output)


def content_types() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>"""


def rels() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""


def word_rels() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""


def styles() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:sz w:val="20"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:rPr><w:b/><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:sz w:val="32"/><w:color w:val="0B4F82"/></w:rPr>
    <w:pPr><w:spacing w:after="180"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:rPr><w:b/><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:sz w:val="24"/><w:color w:val="0B4F82"/></w:rPr>
    <w:pPr><w:spacing w:before="180" w:after="80"/></w:pPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:rPr><w:b/><w:rFonts w:ascii="Malgun Gothic" w:hAnsi="Malgun Gothic" w:eastAsia="Malgun Gothic"/><w:sz w:val="21"/></w:rPr>
    <w:pPr><w:spacing w:before="120" w:after="60"/></w:pPr>
  </w:style>
  <w:style w:type="table" w:styleId="TableGrid">
    <w:name w:val="Table Grid"/>
    <w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:color="7F9DB9"/><w:left w:val="single" w:sz="4" w:color="7F9DB9"/><w:bottom w:val="single" w:sz="4" w:color="7F9DB9"/><w:right w:val="single" w:sz="4" w:color="7F9DB9"/><w:insideH w:val="single" w:sz="4" w:color="7F9DB9"/><w:insideV w:val="single" w:sz="4" w:color="7F9DB9"/></w:tblBorders></w:tblPr>
  </w:style>
</w:styles>"""


def document(body: str) -> str:
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    {body}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850" w:header="450" w:footer="450" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>"""


def create_docx(source: Path, target: Path) -> None:
    body = parse_markdown(source.read_text(encoding="utf-8"))
    with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_DEFLATED) as docx:
        docx.writestr("[Content_Types].xml", content_types())
        docx.writestr("_rels/.rels", rels())
        docx.writestr("word/_rels/document.xml.rels", word_rels())
        docx.writestr("word/styles.xml", styles())
        docx.writestr("word/document.xml", document(body))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        source = DOCS / name
        target = OUT / source.with_suffix(".docx").name
        create_docx(source, target)
        print(target)


if __name__ == "__main__":
    main()
