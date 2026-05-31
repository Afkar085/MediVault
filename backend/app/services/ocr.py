import easyocr
import httpx

reader = None

def get_reader():
    global reader
    if reader is None:
        reader = easyocr.Reader(['en'], gpu=False)
    return reader

def extract_text_from_url(file_url: str) -> str:
    try:
        # Download file from Supabase Storage
        response = httpx.get(file_url)
        image_bytes = response.content

        # Run OCR
        r = get_reader()
        results = r.readtext(image_bytes, detail=0)

        # Join all text
        full_text = "\n".join(results)
        return full_text
    except Exception as e:
        return f"OCR failed: {str(e)}"