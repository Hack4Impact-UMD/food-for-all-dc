from flask import Flask
import update_active_status

app = Flask(__name__)

@app.route("/", methods=["GET"])
def run_etl():
    update_active_status.update_active_status()
    return "ETL job completed!", 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)