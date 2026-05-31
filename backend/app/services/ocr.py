import pytesseract
import numpy as np
import cv2
from PIL import Image
import io

def extract_text_from_bytes(image_bytes: bytes) -> str:
    try:
        # Convert bytes to PIL Image
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Run Tesseract OCR
        text = pytesseract.image_to_string(image)
        
        return text.strip() if text.strip() else "No text found in image"
    except Exception as e:
        return f"OCR failed: {str(e)}"