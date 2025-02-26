import json
import cv2
import fitz 
from pyzbar.pyzbar import decode
import numpy as np

def extract_images_from_pdf(pdf_path):
    doc = fitz.open(pdf_path)
    print(f"Pages in PDF: {len(doc)}")
    images = []
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=300)  # Increase DPI for better quality
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.h, pix.w, pix.n)
        images.append(img)
        cv2.imwrite(f"debug_page_{i}.png", img)  # Save extracted image for debugging
    return images

def enhance_qr_image(image):
    """Improve small QR code detection by increasing contrast and resizing."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)  # Convert to grayscale
    resized = cv2.resize(gray, (gray.shape[1] * 4, gray.shape[0] * 4), interpolation=cv2.INTER_CUBIC)  # Enlarge image
    sharpen_kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])  # Sharpen image
    sharpened = cv2.filter2D(resized, -1, sharpen_kernel)
    _, thresh = cv2.threshold(sharpened, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)  # Improve contrast
    return thresh

def extract_qr_from_image(image):
    """Extract QR codes only, ignoring other barcode types."""
    try:
        enhanced = enhance_qr_image(image)  # Preprocess image
        qr_codes = [qr for qr in decode(enhanced) if qr.type == "QRCODE"]  # Filter only QR codes
        return [qr.data.decode('utf-8') for qr in qr_codes]
    except Exception as e:
        print(f"QR decoding error: {e}")
        return []
    
def process_pdf(pdf_path):
    images = extract_images_from_pdf(pdf_path)
    qr_data = []
    for img in images:
        qr_data.extend(extract_qr_from_image(img))
    return qr_data

qr_info = process_pdf("soham.pdf")
if qr_info:
    try:
        qr_data_json = json.loads(qr_info[0])  # Convert to JSON
        print("Extracted JSON Data:", json.dumps(qr_data_json, indent=4))  # Pretty print
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
else:
    print("No QR code detected.")

with open("soham_exc.json", "w") as json_file:
    json.dump(qr_data_json, json_file, indent=4)
