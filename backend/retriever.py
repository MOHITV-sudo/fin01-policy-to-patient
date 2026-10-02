import os
import logging
from typing import List, Tuple, Optional, Dict
import numpy as np
from schemas import Chunk

logger = logging.getLogger(__name__)

class PolicyIndex:
    """
    In-memory semantic retrieval index for a single policy document.
    Uses sentence-transformers (all-MiniLM-L6-v2) by default,
    with automatic graceful fallback to TF-IDF (scikit-learn) if model loading fails.
    """

    def __init__(self, chunks: List[Chunk]):
        self.chunks = chunks
        self.texts = [f"Section: {c.section}\n{c.text}" for c in chunks]
        self.model_type = "sentence_transformer"
        self.embeddings: Optional[np.ndarray] = None
        self.tfidf_vectorizer = None
        self.tfidf_matrix = None

        self._build_index()

    def _build_index(self):
        if not self.chunks:
            return
        self._build_tfidf()
        # Attempt SentenceTransformer
        try:
            from sentence_transformers import SentenceTransformer
            # Cache or load
            model = SentenceTransformer("all-MiniLM-L6-v2")
            embs = model.encode(self.texts, convert_to_numpy=True, normalize_embeddings=True)
            self.embeddings = embs
            self.encoder_model = model
            self.model_type = "sentence_transformer"
            return
        except Exception as e:
            logger.warning(f"SentenceTransformer unavailable or failed ({e}). Falling back to TF-IDF vectorizer.")

        # Fallback: TF-IDF
        self._build_tfidf()

    def _build_tfidf(self):
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            self.model_type = "tfidf"
            self.tfidf_vectorizer = TfidfVectorizer(stop_words="english")
            self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(self.texts)
        except Exception as err:
            logger.error(f"TF-IDF initialization failed: {err}")
            self.model_type = "keyword"

    def search(self, query: str, top_k: int = 5) -> List[Tuple[Chunk, float]]:
        if not self.chunks:
            return []

        top_k = min(top_k, len(self.chunks))

        if self.model_type == "sentence_transformer" and self.embeddings is not None:
            try:
                q_emb = self.encoder_model.encode([query], convert_to_numpy=True, normalize_embeddings=True)
                # Cosine similarity is dot product of normalized vectors
                scores = np.dot(self.embeddings, q_emb.T).flatten()
                top_indices = np.argsort(scores)[::-1][:top_k]
                return [(self.chunks[i], float(scores[i])) for i in top_indices]
            except Exception as e:
                logger.warning(f"Embedding search failed ({e}), falling back to TF-IDF.")
                if self.tfidf_vectorizer is None:
                    self._build_tfidf()

        if self.model_type == "tfidf" and self.tfidf_matrix is not None:
            try:
                from sklearn.metrics.pairwise import cosine_similarity
                q_vec = self.tfidf_vectorizer.transform([query])
                scores = cosine_similarity(self.tfidf_matrix, q_vec).flatten()
                top_indices = np.argsort(scores)[::-1][:top_k]
                return [(self.chunks[i], float(scores[i])) for i in top_indices]
            except Exception as e:
                logger.error(f"TF-IDF search failed: {e}")

        # Fallback: Simple keyword overlap
        q_words = set(query.lower().split())
        scored = []
        for c in self.chunks:
            c_words = set(c.text.lower().split())
            overlap = len(q_words.intersection(c_words))
            scored.append((c, float(overlap)))
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored[:top_k]


class PolicySession:
    def __init__(self, policy_id: str, filename: str, pages: list, chunks: list):
        self.policy_id = policy_id
        self.filename = filename
        self.pages = pages
        self.chunks = chunks
        self.index = PolicyIndex(chunks)
        self.rules: Optional[dict] = None
        self.chat_history: List[dict] = []

class SessionStore:
    def __init__(self):
        self._sessions: Dict[str, PolicySession] = {}

    def save(self, session: PolicySession):
        self._sessions[session.policy_id] = session

    def get(self, policy_id: str) -> Optional[PolicySession]:
        return self._sessions.get(policy_id)

    def list_all(self) -> List[str]:
        return list(self._sessions.keys())

# Global in-memory session store
session_store = SessionStore()
