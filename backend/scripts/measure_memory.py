"""How much memory this actually needs, under the worst case it allows.

"At rest" is the easy number and the misleading one. The peak is driven by what
the upload path holds at once: this app permits 10MB per file and now reads four
pages concurrently, and the vision API needs each page base64-encoded, which is
about 4/3 the size of the original. That is the figure that decides whether a
512MB tier is enough.

    python scripts/measure_memory.py
"""
import base64
import gc
import os
import sys
import threading
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

for name, value in {
    "SUPABASE_URL": "https://measurement.supabase.co",
    "SUPABASE_KEY": "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.measurement-only",
    "JWT_SECRET": "measurement-only-secret-at-least-32-characters",
    "GROQ_API_KEY": "measurement-only",
}.items():
    os.environ.setdefault(name, value)

import psutil  # noqa: E402

process = psutil.Process()


def mb():
    return process.memory_info().rss / 1024 / 1024


def step(label, before):
    now = mb()
    print(f"  {label:<44} {now:7.1f} MB   ({now - before:+6.1f})")
    return now


def main():
    print("\nMediVault memory, measured\n" + "-" * 62)
    start = mb()
    print(f"  {'bare interpreter':<44} {start:7.1f} MB")

    from app.main import app  # noqa: F401
    at_rest = step("+ whole app (API, RAG, agent, tools)", start)

    from app.services.agent_tools import TOOL_SCHEMAS
    from app.services.chunking import chunk_document
    after_import = step(f"+ agent tool schemas ({len(TOOL_SCHEMAS)} tools)", at_rest)

    # A long document being split and held for retrieval.
    document = ("Dr Kumar, orthopaedics. Haemoglobin 11.4 g/dL. "
                "Paracetamol 650mg twice daily. " * 2000)
    passages = chunk_document(document)
    step(f"+ chunking a {len(document)//1024}KB document -> {len(passages)} passages",
                       after_import)
    del document, passages
    gc.collect()

    # The upload path is the real peak: MAX_SIZE per file, read concurrently,
    # each one base64-encoded for the vision API.
    from app.api.v1.endpoints.upload import MAX_CONCURRENT_PAGES, MAX_SIZE
    print(f"\n  worst case the API permits: {MAX_CONCURRENT_PAGES} pages x "
          f"{MAX_SIZE // 1024 // 1024}MB, each base64-encoded")

    # All pages must be in memory simultaneously for the sample to mean
    # anything: a barrier holds every thread until the last one has its data.
    gate = threading.Barrier(MAX_CONCURRENT_PAGES + 1)
    held = []

    def hold_one_page(_):
        raw = os.urandom(MAX_SIZE)          # a full-size upload
        encoded = base64.b64encode(raw)     # what the vision call sends
        held.append((raw, encoded))
        gate.wait()                         # keep it alive while we sample
        gate.wait()

    baseline = mb()
    with ThreadPoolExecutor(max_workers=MAX_CONCURRENT_PAGES) as pool:
        for i in range(MAX_CONCURRENT_PAGES):
            pool.submit(hold_one_page, i)
        gate.wait()                         # every page is now resident
        peak = step("+ all pages held at once (the real peak)", baseline)
        gate.wait()                         # release them
    held.clear()
    gc.collect()

    print("\n" + "-" * 62)
    print(f"  at rest, everything loaded              {at_rest:7.1f} MB")
    print(f"  peak during a worst-case upload         {peak:7.1f} MB")
    print(f"  + fastembed & model, if enabled         {peak + 155:7.1f} MB   (155MB measured separately)")
    print("\n  Render free tier                          512.0 MB")
    print(f"  headroom at peak, without embeddings    {512 - peak:7.1f} MB")
    print(f"  headroom at peak, with embeddings       {512 - peak - 155:7.1f} MB")
    print("\n  Note: one uvicorn worker. Each additional worker is a separate")
    print("  process and multiplies all of this.\n")


if __name__ == "__main__":
    main()
