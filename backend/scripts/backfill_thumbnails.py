"""Make the small copies for documents uploaded before thumbnails existed.

Record lists show each page at about forty pixels across. Until thumbnails
were added they did that by downloading the stored original, which for a
phone photo is several megabytes a row. New uploads get a small copy at
upload time; this gives one to everything already stored.

Reads and writes only the storage bucket. It never touches a record, and it
never modifies an original: it downloads each page, writes a separate small
JPEG beside it, and skips any page that already has one.

    cd backend
    python scripts/backfill_thumbnails.py --dry-run     # count the work
    python scripts/backfill_thumbnails.py               # do it

Safe to stop and re-run: it picks up where it left off.
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import supabase  # noqa: E402
from app.services.document_files import (  # noqa: E402
    THUMBNAIL_SUFFIX, make_thumbnail, content_type_for_path, thumbnail_path,
)
from app.services.storage import BUCKET  # noqa: E402


def stored_paths() -> list:
    """Every page path the records point at, originals only."""
    paths = []
    for table, column in (("record_files", "file_path"), ("records", "file_path")):
        rows = supabase.table(table).select(column).execute().data or []
        paths += [r[column] for r in rows if r.get(column)]
    return [p for p in dict.fromkeys(paths) if not p.endswith(THUMBNAIL_SUFFIX)]


def already_has_thumbnail(path: str) -> bool:
    try:
        supabase.storage.from_(BUCKET).download(thumbnail_path(path))
        return True
    except Exception:
        return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="count the work, change nothing")
    parser.add_argument("--limit", type=int, default=0, help="stop after this many pages")
    args = parser.parse_args()

    paths = stored_paths()
    print(f"{len(paths)} stored page(s) referenced by records")

    made = skipped = failed = 0
    saved_bytes = 0
    for index, path in enumerate(paths, 1):
        if args.limit and made + skipped + failed >= args.limit:
            break
        if already_has_thumbnail(path):
            skipped += 1
            continue
        if args.dry_run:
            made += 1
            print(f"  [{index}/{len(paths)}] would make a thumbnail for {path}")
            continue
        try:
            original = supabase.storage.from_(BUCKET).download(path)
        except Exception as e:
            failed += 1
            print(f"  [{index}/{len(paths)}] could not download {path}: {type(e).__name__}")
            continue

        small = make_thumbnail(original, content_type_for_path(path))
        if not small:
            skipped += 1  # a PDF, or something Pillow cannot read
            continue
        try:
            supabase.storage.from_(BUCKET).upload(
                path=thumbnail_path(path),
                file=small,
                file_options={"content-type": "image/jpeg", "upsert": "true"},
            )
        except Exception as e:
            failed += 1
            print(f"  [{index}/{len(paths)}] could not store the thumbnail: {type(e).__name__}")
            continue

        made += 1
        saved_bytes += max(len(original) - len(small), 0)
        print(f"  [{index}/{len(paths)}] {len(original) // 1024} KB -> {len(small) // 1024} KB  {path}")

    print(f"\nmade {made}, skipped {skipped}, failed {failed}")
    if saved_bytes:
        print(f"a record list now moves about {saved_bytes // 1024} KB less per full pass over these pages")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
