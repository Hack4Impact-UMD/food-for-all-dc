# cloudrun-etl

## Purpose
This folder contains scripts and configuration for running the nightly update of the `activeStatus` field for all clients in the `client-profile2` Firestore collection. It is not a full ETL solution. Instead, it is dedicated solely to keeping the `activeStatus` field up to date based on each client's `startDate` and `endDate` fields.

### Nightly Active/Inactive Status Update
The main script (`update_active_status.py`) checks each client's `startDate` and `endDate`:

- If today's date is between `startDate` and `endDate` (inclusive), the client is marked as **active**.
- Otherwise, the client is marked as **inactive**.

This update is intended to run nightly (e.g., as a scheduled Cloud Run job or cron job) to ensure the `activeStatus` field is always current.

## How to Run

1. **Set up your environment:**
   - Ensure you have Python 3.9+ and `pip` installed.
   - Install dependencies:
     ```sh
     pip install -r requirements.txt
     ```
   - Make sure you have the required Firebase service account key JSON file in this folder.


2. **Run ETL scripts locally:**
   - To run the main ETL process:
     ```sh
     python main.py
     ```
   - To update client active/inactive status based on date ranges:
     ```sh
     python update_active_status.py
     ```
   - Make sure your terminal's working directory is this folder and the service account key is present.


3. **Deploy to Cloud Run:**
   - Build and deploy using Docker:
     ```sh
     docker build -t gcr.io/[PROJECT-ID]/cloudrun-etl .
     docker push gcr.io/[PROJECT-ID]/cloudrun-etl
     gcloud run deploy cloudrun-etl --image gcr.io/[PROJECT-ID]/cloudrun-etl --platform managed
     ```
   - Replace `[PROJECT-ID]` with your GCP project ID.
   - To schedule the active status update, configure a Cloud Scheduler job or similar to invoke the service nightly.

## Folder Contents
- `main.py`: Main ETL entry point for Cloud Run.
- `update_active_status.py`: Script to update client active/inactive status nightly based on date ranges.
- `requirements.txt`: Python dependencies.
- `food-for-all-dc-caf23-firebase-adminsdk-*.json`: Firebase service account key.
- `Dockerfile`: Container build instructions for Cloud Run.

## Notes
- This folder is for automated, production-scale ETL jobs. For local, one-off, or audit ETL, see the `ETL` folder.
- The `update_active_status.py` script is designed to be run nightly and will keep the `activeStatus` field up to date for all clients.
- Make sure to keep secrets (service account keys) secure and do not commit them to public repositories.
