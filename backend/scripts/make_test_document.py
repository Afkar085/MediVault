"""Render a synthetic prescription with known contents.

Used when there is no real document to hand. Because every value in it is known
up front, the integration run can assert that OCR read the right thing rather
than merely that it read *something* — which a real photo cannot do without
someone transcribing it first.

What this does NOT prove: that OCR copes with handwriting, stamps, skew, poor
lighting or a phone camera. That needs a real document, and the integration run
reports those aspects as YELLOW when this fixture is used.

    python scripts/make_test_document.py

Needs Pillow, which is a development dependency only (requirements-dev.txt).
"""
import os
import sys

OUT = os.path.join(os.path.dirname(__file__), "fixtures", "synthetic_prescription.png")

# Every fact the integration run asserts on. Keep these in step with the lines
# drawn below.
GROUND_TRUTH = {
    "doctor": "Sunil Kumar",
    "hospital": "MANIPAL CLINIC",
    "date": "14/06/2026",
    "specialty": "Orthopaedics",
    "diagnosis": "Osteoarthritis of the right knee",
    "medicines": ["Paracetamol", "Etoricoxib", "Omeprazole"],
    # These live only in the document text — no column holds them — so they are
    # what proves passage retrieval is doing real work.
    "lab_values": {"Haemoglobin": "11.4 g/dL", "ESR": "28 mm/hr", "Serum Uric Acid": "6.8 mg/dL"},
    "advice_phrase": "Physiotherapy three times a week",
}

LINES = [
    ("bold", 34, "MANIPAL CLINIC", 55),
    ("regular", 20, "Tiger Circle Road, Manipal, Karnataka 576104", 100),
    ("regular", 20, "Phone: 0820-2922000", 130),
    ("bold", 26, "Dr. Sunil Kumar, MS (Orthopaedics)", 195),
    ("regular", 20, "Reg. No. KMC-48219", 235),
    ("regular", 20, "Date: 14/06/2026", 285),
    ("regular", 20, "Patient: Integration Test", 320),
    ("regular", 20, "Age: 34 / Male", 355),
    ("bold", 22, "DIAGNOSIS", 420),
    ("regular", 20, "Osteoarthritis of the right knee, grade 2.", 455),
    ("bold", 22, "INVESTIGATIONS", 520),
    ("regular", 20, "Haemoglobin          11.4 g/dL      (13.0 - 17.0)", 555),
    ("regular", 20, "ESR                  28 mm/hr       (0 - 15)", 590),
    ("regular", 20, "Serum Uric Acid      6.8 mg/dL      (3.5 - 7.2)", 625),
    ("bold", 22, "Rx", 690),
    ("regular", 20, "1. Tab Paracetamol 650 mg - twice daily after food - 5 days", 730),
    ("regular", 20, "2. Tab Etoricoxib 90 mg - once daily after food - 7 days", 770),
    ("regular", 20, "3. Cap Omeprazole 20 mg - once daily before food - 7 days", 810),
    ("bold", 22, "ADVICE", 880),
    ("regular", 20, "Physiotherapy three times a week for four weeks.", 915),
    ("regular", 20, "Avoid squatting and stair climbing.", 950),
    ("regular", 20, "Review after one month with repeat ESR.", 985),
    ("italic", 20, "Signature: Dr. S. Kumar", 1090),
]

FONTS = {
    "regular": ["C:/Windows/Fonts/georgia.ttf", "/System/Library/Fonts/Georgia.ttf",
                "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"],
    "bold": ["C:/Windows/Fonts/georgiab.ttf", "/System/Library/Fonts/Georgia Bold.ttf",
             "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"],
    "italic": ["C:/Windows/Fonts/georgiai.ttf", "/System/Library/Fonts/Georgia Italic.ttf",
               "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf"],
}


def load(style, size):
    from PIL import ImageFont
    for path in FONTS[style]:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    for path in FONTS["regular"]:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def main():
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("Pillow is needed to render the fixture:  pip install Pillow")
        return 1

    width, height = 900, 1200
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)

    draw.rectangle([30, 30, width - 30, height - 30], outline="#666666", width=2)
    draw.line([60, 162, width - 60, 162], fill="#666666", width=2)
    for style, size, text, y in LINES:
        draw.text((60, y), text, font=load(style, size), fill="#111111")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    image.save(OUT, "PNG")
    print(f"Wrote {OUT} ({os.path.getsize(OUT) // 1024} KB)")
    print("Known contents the integration run will assert on:")
    for key, value in GROUND_TRUTH.items():
        print(f"  {key}: {value}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
