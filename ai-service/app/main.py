from __future__ import annotations

import hashlib
import io
import os
import re
from typing import Literal

import httpx
from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from pydantic import BaseModel, Field
from pypdf import PdfReader
from supabase import Client, create_client

APP_NAME = "CAMPUS360 RAG Service"
app = FastAPI(title=APP_NAME, version="0.1.0")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
AI_GATEWAY_SECRET = os.environ["AI_GATEWAY_SECRET"]
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_CHAT_MODEL = os.getenv("OLLAMA_CHAT_MODEL", "llama3.2")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_CHAT_MODEL = os.getenv("OPENAI_CHAT_MODEL", "gpt-4o-mini")
OPENAI_EMBED_MODEL = os.getenv("OPENAI_EMBED_MODEL", "text-embedding-3-small")
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "900"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "140"))
TOP_K = int(os.getenv("TOP_K", "5"))
EMBEDDING_DIMENSIONS = 768

Role = Literal["student", "staff", "admin"]


class ChatRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    conversation_id: str | None = None


class Source(BaseModel):
    document_id: str
    title: str
    page: int | None = None
    chunk_index: int
    excerpt: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[Source]
    conversation_id: str | None = None
    grounded: bool


def trusted_identity(secret: str | None, user_id: str | None, role: str | None) -> tuple[str, Role]:
    # This endpoint must only be called by the authenticated CAMPUS360 Edge Function.
    if not secret or not hashlib.sha256(secret.encode()).digest() == hashlib.sha256(AI_GATEWAY_SECRET.encode()).digest():
        raise HTTPException(status_code=403, detail="Forbidden")
    if not user_id or role not in ("student", "staff", "admin"):
        raise HTTPException(status_code=401, detail="Authenticated portal identity required")
    return user_id, role  # type: ignore[return-value]


def extract_text(filename: str, raw: bytes) -> list[tuple[int | None, str]]:
    suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if suffix == "pdf":
        reader = PdfReader(io.BytesIO(raw))
        return [(i + 1, page.extract_text() or "") for i, page in enumerate(reader.pages)]
    if suffix in {"txt", "md"}:
        return [(None, raw.decode("utf-8-sig", errors="replace"))]
    raise HTTPException(status_code=415, detail="Upload PDF, TXT or Markdown files only")


def chunk_text(text: str) -> list[str]:
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    chunks, start = [], 0
    while start < len(text):
        end = min(len(text), start + CHUNK_SIZE)
        if end < len(text):
            boundary = text.rfind(" ", start + CHUNK_SIZE // 2, end)
            if boundary > start:
                end = boundary
        piece = text[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= len(text):
            break
        start = max(end - CHUNK_OVERLAP, start + 1)
    return chunks


async def embed(texts: list[str]) -> list[list[float]]:
    if LLM_PROVIDER == "ollama":
        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.post(
                f"{OLLAMA_URL}/api/embed",
                json={"model": OLLAMA_EMBED_MODEL, "input": texts},
            )
            response.raise_for_status()
            vectors = response.json()["embeddings"]
    else:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)
        result = await client.embeddings.create(
            model=OPENAI_EMBED_MODEL, input=texts, dimensions=EMBEDDING_DIMENSIONS
        )
        vectors = [item.embedding for item in result.data]
    if any(len(vector) != EMBEDDING_DIMENSIONS for vector in vectors):
        raise HTTPException(status_code=500, detail=f"Embedding dimension must be {EMBEDDING_DIMENSIONS}")
    return vectors


async def generate_answer(question: str, role: Role, passages: list[dict]) -> str:
    context = "\n\n".join(
        f"[Source {i + 1}: {p['title']}, page {p.get('page_number') or 'n/a'}]\n{p['content']}"
        for i, p in enumerate(passages)
    )
    system = (
        "You are CAMPUS360, a college information assistant. Answer only from the supplied "
        "approved campus context. If it does not contain the answer, say you cannot verify it "
        "and suggest contacting the college office. Never invent policies, deadlines, contacts, "
        "or facts. Do not reveal private student/staff information. Never claim to change, close, "
        "or resolve a complaint. Cite supporting sources as [Source 1], [Source 2]. "
        f"The authenticated user role is {role}."
    )
    prompt = f"APPROVED CONTEXT:\n{context or '[No relevant sources found]'}\n\nQUESTION:\n{question}"
    if LLM_PROVIDER == "ollama":
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json={"model": OLLAMA_CHAT_MODEL, "stream": False,
                      "messages": [{"role": "system", "content": system},
                                   {"role": "user", "content": prompt}]},
            )
            response.raise_for_status()
            return response.json()["message"]["content"].strip()
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)
    result = await client.chat.completions.create(
        model=OPENAI_CHAT_MODEL,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": prompt}],
        temperature=0.1,
    )
    return (result.choices[0].message.content or "").strip()


@app.get("/health")
async def health():
    return {"ok": True, "service": APP_NAME, "provider": LLM_PROVIDER}


@app.post("/ingest")
async def ingest(
    file: UploadFile = File(...),
    title: str = Header(..., alias="x-document-title"),
    visibility: Literal["public", "staff", "admin"] = Header("public", alias="x-document-visibility"),
    department: str = Header("general", alias="x-document-department"),
    x_campus_ai_gateway: str | None = Header(None),
    x_campus_user_id: str | None = Header(None),
    x_campus_role: str | None = Header(None),
):
    _, role = trusted_identity(x_campus_ai_gateway, x_campus_user_id, x_campus_role)
    if role != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can add knowledge documents")
    raw = await file.read()
    if not raw or len(raw) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File must be between 1 byte and 15 MB")
    pages = extract_text(file.filename or "upload.txt", raw)
    pieces: list[tuple[int | None, str]] = []
    for page, text in pages:
        pieces.extend((page, chunk) for chunk in chunk_text(text))
    if not pieces:
        raise HTTPException(status_code=422, detail="No readable text found in this document")
    vectors = await embed([chunk for _, chunk in pieces])
    digest = hashlib.sha256(raw).hexdigest()
    doc = supabase.table("c360_knowledge_documents").insert({
        "title": title[:200], "filename": (file.filename or "upload")[:255],
        "visibility": visibility, "department": department[:100],
        "sha256": digest, "uploaded_by": x_campus_user_id,
    }).execute()
    document_id = doc.data[0]["id"]
    rows = [{
        "document_id": document_id, "chunk_index": i, "page_number": page,
        "content": chunk, "embedding": vector,
        "visibility": visibility, "department": department[:100],
    } for i, ((page, chunk), vector) in enumerate(zip(pieces, vectors))]
    try:
        for offset in range(0, len(rows), 100):
            supabase.table("c360_knowledge_chunks").insert(rows[offset:offset + 100]).execute()
    except Exception:
        supabase.table("c360_knowledge_documents").delete().eq("id", document_id).execute()
        raise
    return {"ok": True, "document_id": document_id, "chunks_created": len(rows)}


@app.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    x_campus_ai_gateway: str | None = Header(None),
    x_campus_user_id: str | None = Header(None),
    x_campus_role: str | None = Header(None),
):
    user_id, role = trusted_identity(x_campus_ai_gateway, x_campus_user_id, x_campus_role)
    query_vector = (await embed([body.question]))[0]
    result = supabase.rpc("c360_match_knowledge_chunks", {
        "query_embedding": query_vector,
        "match_count": TOP_K,
        "request_role": role,
    }).execute()
    passages = result.data or []
    answer = await generate_answer(body.question, role, passages)
    sources = [
        Source(document_id=str(p["document_id"]), title=p["title"],
               page=p.get("page_number"), chunk_index=p["chunk_index"],
               excerpt=p["content"][:360])
        for p in passages
    ]
    # User ID is used only for audit attribution; it is never used as a retrieval filter.
    supabase.table("c360_ai_audit").insert({
        "user_id": user_id, "role": role, "question": body.question[:2000],
        "source_document_ids": list(dict.fromkeys(s.document_id for s in sources)),
        "provider": LLM_PROVIDER,
    }).execute()
    return ChatResponse(answer=answer, sources=sources, conversation_id=body.conversation_id,
                        grounded=bool(sources))
