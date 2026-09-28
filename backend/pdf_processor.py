import io
from typing import List, Tuple
try:
    import pymupdf as fitz
except ImportError:
    import fitz

from schemas import PageContent

class PDFProcessor:
    """
    Extracts text page-by-page from PDF documents using PyMuPDF (fitz).
    Handles empty/scanned pages with descriptive warnings.
    """

    @staticmethod
    def extract_from_bytes(file_bytes: bytes) -> Tuple[List[PageContent], List[str]]:
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        return PDFProcessor._process_document(doc)

    @staticmethod
    def extract_from_path(file_path: str) -> Tuple[List[PageContent], List[str]]:
        doc = fitz.open(file_path)
        return PDFProcessor._process_document(doc)

    @staticmethod
    def _process_document(doc) -> Tuple[List[PageContent], List[str]]:
        pages: List[PageContent] = []
        warnings: List[str] = []

        try:
            for page_index in range(len(doc)):
                page_num = page_index + 1
                page = doc[page_index]
                text = page.get_text("text") or ""
                stripped = text.strip()
                char_count = len(stripped)
                words = stripped.split()
                word_count = len(words)

                has_text = word_count >= 5
                page_warning = None
                if not has_text:
                    page_warning = f"Page {page_num} has no extractable text (may be scanned or an image)."
                    warnings.append(page_warning)

                pages.append(
                    PageContent(
                        page_number=page_num,
                        text=stripped,
                        char_count=char_count,
                        word_count=word_count,
                        has_text=has_text,
                        warning=page_warning,
                    )
                )
        finally:
            doc.close()

        return pages, warnings
