import easyocr
import numpy as np
import cv2

reader = None

def get_reader():
    global reader
    if reader is None:
        reader = easyocr.Reader(['en'], gpu=False)
    return reader

def extract_text_from_bytes(image_bytes: bytes) -> str:
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return "OCR failed: Could not decode image"

        r = get_reader()
        results = r.readtext(img, detail=0)

        full_text = "\n".join(results)
        return full_text if full_text else "No text found in image"
    except Exception as e:
        return f"OCR failed: {str(e)}"