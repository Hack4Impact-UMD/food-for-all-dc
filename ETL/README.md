# ETL (Extract, Transform, Load) Scripts

This folder contains scripts and files for data migration and transformation operations for the Food for All DC project.

## Files

### Scripts

#### `firebase_migration.py`
- **Purpose**: Main migration script for importing client data into Firestore
- **Features**:
  - Imports client data from JSON files
  - Geocoding using Google Maps API
  - Ward lookup via DC API
  - Dietary restrictions parsing
  - Frequency mapping for delivery schedules
  - Case worker tracking
  - Batch processing with threading support
- **Dependencies**: firebase-admin, python-dateutil, requests
- **Usage**: Configure the constants in the `main()` function and run the script

#### `address_fixer.py`
- **Purpose**: Address validation and geocoding for existing Firestore records
- **Features**:
  - Geocodes addresses using Google Maps API
  - Updates client records with coordinates and ward information
  - Batch processing for multiple client IDs
  - Results reporting and logging
- **Dependencies**: firebase-admin, requests
- **Usage**: Configure the constants in the `main()` function and run the script

#### `find_orphaned_case_workers.py`
- **Purpose**: Analysis script to find case workers not referenced by any clients
- **Features**:
  - Compares all IDs in the referral collection with referralEntity.id values in client-profile2
  - Identifies orphaned case workers (in referral but not referenced by clients)
  - Generates comma-delimited list of orphaned IDs
  - Creates detailed reports in CSV and JSON formats
  - Comprehensive logging and error handling
- **Dependencies**: firebase-admin
- **Usage**: Configure the constants in the `main()` function and run the script
- **Output Files**:
  - `orphaned_case_worker_ids_[timestamp].txt` - Comma-delimited list of IDs
  - `orphaned_case_workers_details_[timestamp].csv` - Detailed CSV report
  - `orphaned_case_workers_details_[timestamp].json` - Detailed JSON report
  - `orphaned_case_workers.log` - Analysis log file

### Configuration Files

#### `food-for-all-dc-caf23-firebase-adminsdk-fbsvc-f5a3e31a09.json`
- **Purpose**: Firebase service account credentials
- **Security**: This file contains sensitive credentials and should not be committed to version control
- **Usage**: Required by both migration scripts for Firestore authentication

### Data Files

#### `IDs_deleted.txt`
- **Purpose**: Contains client IDs that have been processed or should be included in migration
- **Format**: One ID per line
- **Usage**: Referenced by `firebase_migration.py` to filter which records to process

#### `migration.log`
- **Purpose**: Log file generated during migration operations
- **Content**: Timestamps, progress updates, errors, and warnings from migration runs

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   pip install firebase-admin python-dateutil requests
   ```

2. **Configure API Keys**:
   - Ensure you have a valid Google Maps API key
   - Update the `GOOGLE_MAPS_API_KEY` constant in the scripts

3. **Prepare Data**:
   - Place your JSON data files in the ETL directory
   - Update the file paths in the script configurations

4. **Run Scripts**:
   - For migration: `python firebase_migration.py`
   - For address fixing: `python address_fixer.py`
   - For orphaned case worker analysis: `python find_orphaned_case_workers.py`

## Notes

- Both scripts include rate limiting to respect API quotas
- Logging is configured to write to both console and log files
- Scripts support batch processing to handle large datasets
- Error handling includes retry logic for network operations