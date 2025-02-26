import qrcode
import json

# Land document details in JSON format
land_data = {
    "government": "MAHARASTRA GOVERNMENT",
    "document_no": "12345XYZ",
    "date_of_issue": "15-Feb-2025",
    "owner": {
        "name": "Sam",
        "address": "123 Main Street, City, Country"
    },
    "property_details": {
        "location": "Mira bhyandar",
        "land_area": "500 sq. meters",
        "survey_no": "789XYZ",
        "type_of_land": "Residential"
    },
    "encumbrances": "No outstanding loans or legal claims.",
    "transaction_history": {
        "previous_owner": "Jane Smith",
        "date_of_transfer": "10-Jan-2024"
    }
}

# Convert dictionary to JSON string
json_data = json.dumps(land_data, indent=4)

# Generate QR code
qr = qrcode.QRCode(
    version=5,  # Adjust size based on data
    error_correction=qrcode.constants.ERROR_CORRECT_L,
    box_size=10,
    border=4,
)
qr.add_data(json_data)
qr.make(fit=True)

# Create and save the QR code image
img = qr.make_image(fill="black", back_color="white")
img.save("land doc_sammet.png")

print("QR Code saved as land_document_qr_json.png")
