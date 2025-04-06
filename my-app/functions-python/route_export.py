import functions_framework
from flask import request, jsonify
import csv
import smtplib

@functions_framework.http
def create_and_send_csv(request):
    # Parse request data
    request_json = request.get_json()
    driver_email = request_json.get('email')
    date = request_json.get('date')

    # Generate CSV (example data)
    csv_data = [["Route", "Time"], ["Stop 1", "10:00 AM"], ["Stop 2", "11:00 AM"]]
    csv_file = "/tmp/route.csv"
    with open(csv_file, mode="w", newline="") as file:
        writer = csv.writer(file)
        writer.writerows(csv_data)

    # Send email (example using smtplib)
    try:
        with smtplib.SMTP("smtp.example.com", 587) as server:
            server.starttls()
            server.login("your_email@example.com", "your_password")
            message = f"Subject: Your Route for {date}\n\nPlease find your route attached."
            server.sendmail("your_email@example.com", driver_email, message)
        return jsonify({"success": True, "message": "Email sent successfully!"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})