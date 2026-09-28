import re
from typing import List, Optional
from schemas import PageContent, Chunk

HEADING_PATTERNS = [
    re.compile(r"^(?:SECTION|CLAUSE|ARTICLE|SCHEDULE|PART)\s+[0-9A-Za-z\.\:\-]+.*", re.IGNORECASE),
    re.compile(r"^[0-9]+(?:\.[0-9]+)+\s+[A-Za-z].*"),
    re.compile(r"^[0-9]+\.\s+[A-Z][A-Za-z\s]{3,}.*"),
]

def is_all_caps_heading(line: str) -> bool:
    line_clean = line.strip()
    if 4 <= len(line_clean) <= 70:
        letters = [c for c in line_clean if c.isalpha()]
        if len(letters) >= 4 and all(c.isupper() for c in letters):
            return True
    return False

def detect_heading(line: str) -> Optional[str]:
    line_strip = line.strip()
    if not line_strip:
        return None
    for pattern in HEADING_PATTERNS:
        if pattern.match(line_strip):
            return line_strip
    if is_all_caps_heading(line_strip):
        return line_strip
    return None

class PageAwareChunker:
    """
    Chunks document page-by-page (~150-250 words) with heading tracking.
    Never merges across pages without preserving origin page.
    """

    def __init__(self, target_words: int = 180, overlap_words: int = 35):
        self.target_words = target_words
        self.overlap_words = overlap_words

    def chunk_pages(self, pages: List[PageContent]) -> List[Chunk]:
        chunks: List[Chunk] = []
        current_section = "General Information"

        for page in pages:
            if not page.has_text or not page.text:
                continue

            lines = page.text.split("\n")
            # First pass: parse lines, update headings, collect segments
            # We can also detect headings while tracking text
            page_blocks: List[dict] = []
            block_text: List[str] = []
            block_section = current_section

            for line in lines:
                h = detect_heading(line)
                if h:
                    if block_text:
                        page_blocks.append({"section": block_section, "text": "\n".join(block_text)})
                        block_text = []
                    current_section = h
                    block_section = h
                    block_text.append(line)
                else:
                    block_text.append(line)

            if block_text:
                page_blocks.append({"section": block_section, "text": "\n".join(block_text)})

            # Now generate chunks within this page
            page_chunk_idx = 0
            for block in page_blocks:
                sec = block["section"]
                words = block["text"].split()
                if not words:
                    continue

                if len(words) <= self.target_words + 40:
                    page_chunk_idx += 1
                    chunks.append(
                        Chunk(
                            chunk_id=f"p{page.page_number}_c{page_chunk_idx}",
                            text=" ".join(words),
                            page=page.page_number,
                            section=sec,
                        )
                    )
                else:
                    start = 0
                    while start < len(words):
                        end = min(start + self.target_words, len(words))
                        chunk_words = words[start:end]
                        if chunk_words:
                            page_chunk_idx += 1
                            chunks.append(
                                Chunk(
                                    chunk_id=f"p{page.page_number}_c{page_chunk_idx}",
                                    text=" ".join(chunk_words),
                                    page=page.page_number,
                                    section=sec,
                                )
                            )
                        if end >= len(words):
                            break
                        start += max(1, self.target_words - self.overlap_words)

        return chunks
