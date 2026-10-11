"""Generate throwaway test documents for the local dev server.

Each "readable" PNG carries its text in a PNG text chunk named ``mvtext``, which
the fake OCR in scripts/dev_fakes.py returns verbatim. The "unreadable" one has
no such chunk, so it drives the OCR-failure path. All content is invented.

    python scripts/make_dev_documents.py <output-dir>
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, PngImagePlugin

DOCUMENTS = {
    "rx_readable.png": (
        "Dr. Meera Rao\nHospital: Lakeside Clinic\nDepartment: General Medicine\n"
        "Date: 2026-09-20\nDiagnosis: Acute pharyngitis\nAdvice: Warm fluids, review in 5 days\n"
        "Rx: AMOXICILLIN 500MG | 500mg | 1-0-1 | 5 days\n"
        "Rx: PARACETAMOL 650MG | 650mg | SOS | 3 days\n"
        "Rx: PARACETAMOL 650MG | 650mg | SOS | 3 days\n"  # the extractor repeating a line
    ),
    "rx_second_page.png": (
        "Dr. Meera Rao\nDate: 2026-09-20\nRx: CETIRIZINE 10MG | 10mg | 0-0-1 | 5 days\n"
    ),
    "lab_readable.png": (
        "LAB REPORT\nHospital: Lakeside Diagnostics\nDate: 2026-09-21\n"
        "Result: Haemoglobin 13.4 g/dL\nResult: WBC 11,200 /uL\n"
    ),
    "bill_readable.png": (
        "INVOICE\nHospital: Lakeside Pharmacy\nDate: 2026-09-20\nTotal: 840.00\n"
    ),
    "unreadable.png": None,
}


def make(path: Path, text):
    img = Image.new("RGB", (900, 1200), "white" if text else (40, 40, 40))
    draw = ImageDraw.Draw(img)
    info = PngImagePlugin.PngInfo()
    if text:
        for i, line in enumerate(text.splitlines()):
            draw.text((40, 40 + i * 28), line, fill="black")
        info.add_text("mvtext", text)
    else:
        # A dark, blurry-looking frame with no text: what a failed photo looks like.
        for i in range(0, 900, 60):
            draw.line((i, 0, 900 - i, 1200), fill=(70, 70, 70), width=18)
    img.save(path, pnginfo=info)


if __name__ == "__main__":
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "dev_documents")
    out.mkdir(parents=True, exist_ok=True)
    for name, text in DOCUMENTS.items():
        make(out / name, text)
        print("wrote", out / name)
