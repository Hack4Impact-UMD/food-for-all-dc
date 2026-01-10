# ETL Folder

## Overview
This folder contains scripts and resources for running the full ETL (Extract, Transform, Load) process for Food For All DC. The ETL process loads and normalizes client and referral/case worker data from spreadsheets into Firebase Firestore.

## Required Excel Files
- `FFA_CLIENT_DATABASE.xlsx`: The main client database exported from Google Sheets as an Excel file.
- `Client Referral Form v.3_20_24 (Responses).xlsx`: Referral/case worker form responses exported from Google Sheets as an Excel file.

**Note:** You must download/export the Google Sheets as `.xlsx` files and place them in this folder before running the ETL.

## How to Run
1. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```
2. Run the main ETL script:
   ```sh
   python firebase_migration_v2.py
   ```

## Data Mapping
Below is a mapping of the key fields from the Excel files to Firestore document stores and fields:

### FFA_CLIENT_DATABASE.xlsx → Firestore
| Excel Column                | Firestore Collection   | Firestore Field           |
|-----------------------------|-----------------------|---------------------------|
| ID                          | client-profile2       | uid                       |
| First Name                  | client-profile2       | firstName                 |
| Last Name                   | client-profile2       | lastName                  |
| Address                     | client-profile2       | address                   |
| Address 2                   | client-profile2       | address2                  |
| Zip Code                    | client-profile2       | zipCode                   |
| City                        | client-profile2       | city                      |
| State                       | client-profile2       | state                     |
| Quadrant                    | client-profile2       | quadrant                  |
| DOB                         | client-profile2       | dob                       |
| Phone                       | client-profile2       | phone                     |
| Email                       | client-profile2       | email                     |
| Alternative Phone           | client-profile2       | alternativePhone          |
| Adults                      | client-profile2       | adults                    |
| Children                    | client-profile2       | children                  |
| Total                       | client-profile2       | total                     |
| Gender                      | client-profile2       | gender                    |
| Ethnicity                   | client-profile2       | ethnicity                 |
| Delivery Frequency          | client-profile2       | deliveryFreq              |
| Delivery Instructions       | client-profile2       | deliveryDetails.deliveryInstructions |
| Dietary Restrictions        | client-profile2       | deliveryDetails.dietaryRestrictions  |
| Life Challenges             | client-profile2       | lifeChallenges            |
| Physical Ailments           | client-profile2       | physicalAilments          |
| Physical Disability         | client-profile2       | physicalDisability        |
| Referral/Case Worker        | referral              | name, organization, email, phone     |

### Client Referral Form v.3_20_24 (Responses).xlsx → Firestore
| Excel Column                | Firestore Collection   | Firestore Field           |
|-----------------------------|-----------------------|---------------------------|
| Name                        | referral              | name                      |
| Organization                | referral              | organization               |
| Email                       | referral              | email                     |
| Phone                       | referral              | phone                     |

## Business Logic & Data Cleaning
- **Referral Deduplication:**
  - Referrals are deduplicated by email, or by name + organization.
  - The script also checks for swapped or ambiguous name/organization fields and uses heuristics to match existing referrals.
  - Multi-value and ambiguous fields are split and normalized.
- **Data Normalization:**
  - All string fields are stripped and type-checked to avoid errors.
  - Organization/person keywords are used to help assign ambiguous referral fields.
- **Error Logging:**
  - Failed inserts are logged to text files with a date-stamped filename for auditability.
- **Geocoding:**
  - Addresses are geocoded where possible; failures are logged but do not halt the ETL.

## Notes
- This folder is for local, one-off, or audit ETL jobs. For production/automated ETL, see the `cloudrun-etl` folder.
- Always verify the mapping and normalization logic if the spreadsheet format changes.
