from flask import Flask, request, jsonify
import json
import cv2
import fitz 
from flask_cors import CORS
from pyzbar.pyzbar import decode
import numpy as np
import os

app = Flask(__name__)
CORS(app)

# Function to extract images from PDF
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

# Function to enhance QR code image
def enhance_qr_image(image):
    """Improve small QR code detection by increasing contrast and resizing."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)  # Convert to grayscale
    resized = cv2.resize(gray, (gray.shape[1] * 4, gray.shape[0] * 4), interpolation=cv2.INTER_CUBIC)  # Enlarge image
    sharpen_kernel = np.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]])  # Sharpen image
    sharpened = cv2.filter2D(resized, -1, sharpen_kernel)
    _, thresh = cv2.threshold(sharpened, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)  # Improve contrast
    return thresh

# Function to extract QR codes from an image
def extract_qr_from_image(image):
    """Extract QR codes only, ignoring other barcode types."""
    try:
        enhanced = enhance_qr_image(image)  # Preprocess image
        qr_codes = [qr for qr in decode(enhanced) if qr.type == "QRCODE"]  # Filter only QR codes
        return [qr.data.decode('utf-8') for qr in qr_codes]
    except Exception as e:
        print(f"QR decoding error: {e}")
        return []

# Function to process the PDF and extract QR codes
def process_pdf(pdf_path):
    images = extract_images_from_pdf(pdf_path)
    qr_data = []
    for img in images:
        qr_data.extend(extract_qr_from_image(img))
    return qr_data

# Flask route to handle PDF upload and QR code extraction
@app.route('/extract-qr', methods=['POST'])
def extract_qr():
    print("here0")
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    # Save the uploaded file temporarily
    temp_pdf_path = "temp_uploaded.pdf"
    file.save(temp_pdf_path)

    # Process the PDF and extract QR codes
    qr_info = process_pdf(temp_pdf_path)

    # Clean up the temporary file
    os.remove(temp_pdf_path)

    if qr_info:
        try:
            qr_data_json = json.loads(qr_info[0])  # Convert to JSON
            
            return jsonify({"data": qr_data_json}), 200
        except json.JSONDecodeError as e:
            return jsonify({"error": f"Error decoding JSON: {e}"}), 500
    else:
        return jsonify({"error": "No QR code detected"}), 404

# Run the Flask app
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)