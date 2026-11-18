"""Load the list of real medicine names into the database (migration 009).

    # from backend/, with the same .env the backend uses (SUPABASE_URL and the
    # service role SUPABASE_KEY). Safe to run again: rows are updated, not doubled.
    python scripts/load_medicines.py path/to/indian_medicine_data.csv

    # Brands and generics only by default (about 38 MB in Postgres): that is all
    # the matching needs. --with-products also loads every product with its
    # strength, maker and pack (about 81 MB more), for later features.
    python scripts/load_medicines.py path/to/indian_medicine_data.csv --with-products

    # or write the three tables as CSV files instead, to check them or load them
    # with psql \\copy (this is how the loader was tested):
    python scripts/load_medicines.py path/to/indian_medicine_data.csv --to-csv out/

Source supported today: the Indian Medicine Dataset
(github.com/junioralive/Indian-Medicine-Dataset, DATA/indian_medicine_data.csv,
MIT licence on the repository). Its columns: id, name, price(₹), Is_discontinued,
manufacturer_name, type, pack_size_label, short_composition1, short_composition2.

The government list (CDCI, from nrces.in) gets its own reader once its files are
in hand: their columns have not been seen yet.
"""
import argparse
import csv
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.services.medicine_names import brand_of, clean_name, generic_clean  # noqa: E402

SOURCE = "indian_medicine_dataset"
REQUIRED = {"id", "name", "Is_discontinued", "manufacturer_name",
            "pack_size_label", "short_composition1", "short_composition2"}
_WORDS = re.compile(r"[\s\-]+")
_PARENS = re.compile(r"\([^)]*\)")


def _brand_display(original: str, brand_clean: str) -> str:
    """'Pantocid DSR Capsule' with brand 'pantocid dsr' -> 'Pantocid DSR'."""
    words = [w for w in _WORDS.split(original.strip()) if w]
    k = len(brand_clean.split())
    return " ".join(words[:k]) or brand_clean.title()


def _generic_text(c1: str, c2: str) -> str:
    return " + ".join(re.sub(r"\s+", " ", c).strip() for c in (c1, c2) if c and c.strip())


def read_indian_medicine_dataset(path: Path):
    """Products, brands and generics from the dataset's CSV."""
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        missing = REQUIRED - set(reader.fieldnames or [])
        if missing:
            raise SystemExit(f"This file is missing columns: {', '.join(sorted(missing))}")

        products = []
        brand_products = defaultdict(list)
        generic_counts = Counter()
        generic_display = {}
        for row in reader:
            name = (row.get("name") or "").strip()
            name_clean = clean_name(name)
            if not name_clean:
                continue
            brand = brand_of(name_clean)
            generic = _generic_text(row.get("short_composition1"), row.get("short_composition2"))
            products.append({
                "source": SOURCE,
                "source_code": str(row["id"]).strip(),
                "name": name,
                "name_clean": name_clean,
                "brand_clean": brand,
                "generic": generic or None,
                "manufacturer": (row.get("manufacturer_name") or "").strip() or None,
                "pack": (row.get("pack_size_label") or "").strip() or None,
                "discontinued": (row.get("Is_discontinued") or "").strip().lower() == "true",
            })
            brand_products[brand].append((name, generic))
            for part in (row.get("short_composition1"), row.get("short_composition2")):
                if not part or not part.strip():
                    continue
                g = generic_clean(part)
                if g:
                    generic_counts[g] += 1
                    generic_display.setdefault(g, _PARENS.sub("", part).strip())

    brands = []
    for brand, items in brand_products.items():
        names = Counter(n for n, _ in items)
        generics = Counter(g for _, g in items if g)
        top_name = names.most_common(1)[0][0]
        brands.append({
            "brand_clean": brand,
            "first_token": brand.split()[0],
            "display": _brand_display(top_name, brand),
            "generic": generics.most_common(1)[0][0] if generics else None,
            "products": len(items),
        })

    generics = [{
        "name_clean": g,
        "first_token": g.split()[0],
        "display": generic_display[g],
        "products": n,
    } for g, n in generic_counts.items()]

    return products, brands, generics


def write_csv(out_dir: Path, tables: dict) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for table, rows in tables.items():
        if not rows:
            continue
        with (out_dir / f"{table}.csv").open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)


def upload(tables: dict, batch: int) -> None:
    from app.database import supabase

    conflict = {"medicine_products": "source,source_code",
                "medicine_brands": "brand_clean",
                "medicine_generics": "name_clean"}
    for table, rows in tables.items():
        for start in range(0, len(rows), batch):
            supabase.table(table).upsert(rows[start:start + batch], on_conflict=conflict[table]).execute()
            print(f"  {table}: {min(start + batch, len(rows)):,} of {len(rows):,}", end="\r", flush=True)
        print()


def main(argv=None) -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("csv_path", type=Path, help="indian_medicine_data.csv from the Indian Medicine Dataset")
    parser.add_argument("--to-csv", type=Path, help="write CSV files here instead of uploading")
    parser.add_argument("--with-products", action="store_true",
                        help="also load every product (about 81 MB more in Postgres)")
    parser.add_argument("--batch", type=int, default=1000)
    args = parser.parse_args(argv)

    products, brands, generics = read_indian_medicine_dataset(args.csv_path)
    tables = {"medicine_brands": brands, "medicine_generics": generics}
    if args.with_products:
        tables["medicine_products"] = products
    for table, rows in tables.items():
        print(f"{table}: {len(rows):,} rows")

    if args.to_csv:
        write_csv(args.to_csv, tables)
        print(f"Written to {args.to_csv}")
    else:
        upload(tables, args.batch)
        print("Loaded.")


if __name__ == "__main__":
    main()
