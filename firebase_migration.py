import json
import os
import sys
from datetime import datetime
import time
from typing import Dict, List, Any, Optional
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
import requests
from urllib.parse import urlencode

# Install these dependencies:
# pip install firebase-admin python-dateutil requests

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1.base_query import FieldFilter

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('migration.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

@dataclass
class MigrationStats:
    total_records: int = 0
    successful_imports: int = 0
    failed_imports: int = 0
    skipped_records: int = 0
    start_time: datetime = None
    end_time: datetime = None
    unmapped_frequencies: Dict[str, int] = None  # Track frequency values that don't map
    
    def __post_init__(self):
        if self.unmapped_frequencies is None:
            self.unmapped_frequencies = {}

class FirestoreMigration:
    def __init__(self, service_account_path: str, project_id: str, collection_name: str = "clients", google_maps_api_key: str = None):
        """
        Initialize the Firestore migration client
        
        Args:
            service_account_path: Path to your Firebase service account JSON file
            project_id: Your Firebase project ID
            collection_name: Target Firestore collection name
            google_maps_api_key: Google Maps API key for geocoding
        """
        self.project_id = project_id
        self.collection_name = collection_name
        self.google_maps_api_key = ""
        self.stats = MigrationStats()
        
        # Initialize Firebase Admin SDK
        if not firebase_admin._apps:
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred)
        
        self.db = firestore.client()
        logger.info(f"Initialized Firestore client for project: {project_id}")

    def parse_dietary_restrictions(self, diet_type_str: str, restrictions_str: str) -> Dict[str, Any]:
        """
        Python port of the JavaScript parseDietaryRestrictions function
        """
        restrictions = {
            "lowSugar": False,
            "kidneyFriendly": False,
            "vegan": False,
            "vegetarian": False,
            "halal": False,
            "microwaveOnly": False,
            "softFood": False,
            "lowSodium": False,
            "noCookingEquipment": False,
            "heartFriendly": False,
            "foodAllergens": [],
            "otherText": "",
            "other": False,
        }

        # Filter out None, empty strings, and convert to strings
        all_restrictions = []
        for item in [diet_type_str, restrictions_str]:
            if item is not None and str(item).strip():
                all_restrictions.append(str(item))

        if not all_restrictions:
            return restrictions

        # Join all restrictions and split by comma
        combined_string = ','.join(all_restrictions)
        parts = [s.strip().lower() for s in combined_string.split(',') if s.strip()]

        for part in parts:
            if 'sugar' in part:
                restrictions["lowSugar"] = True
            elif 'kidney' in part:
                restrictions["kidneyFriendly"] = True
            elif 'vegan' in part:
                restrictions["vegan"] = True
            elif 'vegetarian' in part:
                restrictions["vegetarian"] = True
            elif 'halal' in part:
                restrictions["halal"] = True
            elif 'microwave' in part:
                restrictions["microwaveOnly"] = True
            elif 'soft' in part:
                restrictions["softFood"] = True
            elif 'sodium' in part:
                restrictions["lowSodium"] = True
            elif 'no cooking' in part:
                restrictions["noCookingEquipment"] = True
            elif 'heart' in part:
                restrictions["heartFriendly"] = True
            else:
                if part not in restrictions["foodAllergens"]:
                    restrictions["foodAllergens"].append(part)

        if restrictions["foodAllergens"]:
            restrictions["other"] = True
            restrictions["otherText"] = ', '.join(restrictions["foodAllergens"])

        return restrictions

    async def get_coordinates(self, address: str) -> Optional[List[float]]:
        """
        Get coordinates for an address using Google Maps Geocoding API
        Returns [lat, lng] or None if not found
        """
        if not self.google_maps_api_key or not address.strip():
            return None
            
        try:
            params = {
                'address': address,
                'key': self.google_maps_api_key
            }
            
            url = f"https://maps.googleapis.com/maps/api/geocode/json?{urlencode(params)}"
            response = requests.get(url, timeout=10)
            
            if response.status_code != 200:
                logger.error(f"Geocoding API error: {response.status_code}")
                return None
                
            data = response.json()
            
            if data['status'] == 'OK' and data['results']:
                location = data['results'][0]['geometry']['location']
                return [location['lat'], location['lng']]
            else:
                logger.warning(f"No coordinates found for address: {address}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting coordinates for {address}: {str(e)}")
            return None

    async def get_ward_and_coordinates(self, address: str) -> Dict[str, Any]:
        """
        Get ward and coordinates for an address
        Returns dict with 'ward' and 'coordinates' keys
        """
        result = {"ward": "", "coordinates": []}
        
        try:
            # Get coordinates first
            coordinates = await self.get_coordinates(address)
            
            if not coordinates or len(coordinates) != 2 or coordinates[0] == 0 or coordinates[1] == 0:
                logger.warning(f"Invalid coordinates for ward lookup: {address}")
                result["ward"] = "No address"
                result["coordinates"] = coordinates or []
                return result
            
            result["coordinates"] = coordinates
            
            # Use DC Government ArcGIS REST service to find ward by coordinates
            lng, lat = coordinates[1], coordinates[0]  # ArcGIS expects lng, lat
            
            ward_service_url = "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Administrative_Other_Boundaries_WebMercator/MapServer/53/query"
            params = {
                'f': 'json',
                'geometry': f'{lng},{lat}',
                'geometryType': 'esriGeometryPoint',
                'inSR': '4326',
                'spatialRel': 'esriSpatialRelIntersects',
                'outFields': 'NAME,WARD',
                'returnGeometry': 'false'
            }
            
            response = requests.get(ward_service_url, params=params, timeout=10)
            
            if response.status_code != 200:
                logger.error(f"Ward lookup API error: {response.status_code}")
                result["ward"] = "Error"
                return result
            
            data = response.json()
            
            if data.get('features') and len(data['features']) > 0:
                ward_feature = data['features'][0]
                ward_name = ward_feature['attributes'].get('NAME') or f"Ward {ward_feature['attributes'].get('WARD', '')}"
                result["ward"] = ward_name
            else:
                logger.warning(f"No ward found for coordinates: {coordinates}")
                result["ward"] = "No ward"
                
        except Exception as e:
            logger.error(f"Error getting ward information for {address}: {str(e)}")
            result["ward"] = "Error"
            
        return result

    def parse_google_address(self, address: str) -> Dict[str, str]:
        """
        Parse a full address string to extract components using Google Geocoding API
        """
        if not self.google_maps_api_key or not address.strip():
            return {"street": address, "city": "", "state": "", "zip": "", "quadrant": ""}
            
        try:
            params = {
                'address': address,
                'key': self.google_maps_api_key
            }
            
            url = f"https://maps.googleapis.com/maps/api/geocode/json?{urlencode(params)}"
            response = requests.get(url, timeout=10)
            
            if response.status_code != 200:
                return {"street": address, "city": "", "state": "", "zip": "", "quadrant": ""}
                
            data = response.json()
            
            if data['status'] != 'OK' or not data['results']:
                return {"street": address, "city": "", "state": "", "zip": "", "quadrant": ""}
                
            # Parse address components similar to the JavaScript code
            components = data['results'][0]['address_components']
            formatted_address = data['results'][0]['formatted_address']
            
            street = ""
            city = ""
            state = ""
            zip_code = ""
            quadrant = ""
            
            for comp in components:
                types = comp['types']
                
                if 'street_number' in types:
                    street = comp['long_name'] + " " + street
                elif 'route' in types:
                    street += comp['long_name']
                elif 'locality' in types:
                    city = comp['long_name']
                elif 'administrative_area_level_1' in types:
                    state = comp['short_name']
                elif 'postal_code' in types:
                    zip_code = comp['long_name']
                elif 'subpremise' in types:
                    street += " " + comp['long_name']
                elif 'neighborhood' in types:
                    # Check if neighborhood contains DC quadrant
                    if any(q in comp['long_name'].upper() for q in ['NW', 'NE', 'SW', 'SE']):
                        quadrant = comp['long_name']
            
            # Extract quadrant from formatted address if not found in components
            if not quadrant and formatted_address:
                import re
                match = re.search(r'\b(NW|NE|SW|SE)\b', formatted_address, re.IGNORECASE)
                if match:
                    quadrant = match.group(0).upper()
            
            return {
                "street": street.strip(),
                "city": city,
                "state": state,
                "zip": zip_code,
                "quadrant": quadrant
            }
            
        except Exception as e:
            logger.error(f"Error parsing address {address}: {str(e)}")
            return {"street": address, "city": "", "state": "", "zip": "", "quadrant": ""}

    def parse_frequency(self, frequency_str: str) -> str:
        """
        Parse frequency string to match predefined categories
        Returns one of: "None", "Weekly", "2x-Monthly", "Monthly"
        """
        if not frequency_str or not str(frequency_str).strip():
            return "None"
        
        freq = str(frequency_str).strip().lower()
        
        # Define mapping patterns
        if freq in ["periodic", "none", "n/a", "na", ""]:
            return "None"
        elif "weekly" in freq or "week" in freq or freq in ["1x/week", "once/week", "every week"]:
            return "Weekly"
        elif any(pattern in freq for pattern in ["2x", "twice", "two", "bi-monthly", "bimonthly", "2/month", "2x/month", "twice/month"]):
            return "2x-Monthly"
        elif any(pattern in freq for pattern in ["monthly", "month", "1x/month", "once/month", "every month", "one/month"]):
            return "Monthly"
        else:
            # Track unmapped frequency for review
            if freq not in self.stats.unmapped_frequencies:
                self.stats.unmapped_frequencies[freq] = 0
            self.stats.unmapped_frequencies[freq] += 1
            
            # Try to make a best guess based on keywords
            if "week" in freq:
                return "Weekly"
            elif "month" in freq:
                return "Monthly"
            else:
                return "None"  # Default fallback

    def transform_record(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """
        Python port of the JavaScript transform function with Google Maps integration
        """
        # Handle phone/email logic
        phone = ""
        email = ""
        if row.get("Phone"):
            phone_str = str(row["Phone"])
            if '@' in phone_str:
                email = phone_str
            else:
                phone = phone_str

        # Parse dietary restrictions
        restrictions = self.parse_dietary_restrictions(
            row.get("Diettype"), 
            row.get("DietaryRestrictions")
        )

        # Create tags
        tags = []
        if row.get("TEFAP_FY25") and str(row["TEFAP_FY25"]).lower() != 'false':
            tags.append("TEFAPOnFile")

        # Parse frequency
        delivery_freq = self.parse_frequency(row.get("Frequency", ""))

        # Process address with Google Maps if API key is available
        address_components = {"street": "", "city": "", "state": "", "zip": "", "quadrant": ""}
        ward = ""
        coordinates = []
        
        if self.google_maps_api_key and row.get("ADDRESS"):
            # Build full address for geocoding
            full_address = row.get("ADDRESS", "")
            if row.get("APT"):
                full_address += f" {row['APT']}"
            if row.get("ZIP"):
                full_address += f", {row['ZIP']}"
            
            # Parse address components
            address_components = self.parse_google_address(full_address)
            
            # Get ward and coordinates
            try:
                import asyncio
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                ward_data = loop.run_until_complete(self.get_ward_and_coordinates(full_address))
                ward = ward_data.get("ward", "")
                coordinates = ward_data.get("coordinates", [])
                loop.close()
            except Exception as e:
                logger.error(f"Error getting ward/coordinates for {full_address}: {str(e)}")
                ward = ""
                coordinates = []
        else:
            # Fallback to original address fields if no API key
            address_components["street"] = row.get("ADDRESS", "")
            address_components["zip"] = str(row.get("ZIP", ""))
            ward = str(row.get("Ward", ""))

        # Build the client profile
        client_profile = {
            "firstName": row.get("FIRST", ""),
            "lastName": row.get("LAST", ""),
            "address": address_components["street"] or row.get("ADDRESS", ""),
            "address2": row.get("APT", ""),
            "zipCode": address_components["zip"] or str(row.get("ZIP", "")),
            "city": address_components["city"],
            "state": address_components["state"],
            "quadrant": address_components["quadrant"] or row.get("Quadrant", ""),
            "dob": "",
            "deliveryFreq": delivery_freq,
            "phone": phone,
            "email": email,
            "alternativePhone": "",
            "adults": int(row.get("Adultnum", 0)) if row.get("Adultnum") else 0,
            "children": int(row.get("kidsnum", 0)) if row.get("kidsnum") else 0,
            "total": int(row.get("HHSize", 0)) if row.get("HHSize") else 0,
            "gender": "Other",
            "ethnicity": "",
            "deliveryDetails": {
                "deliveryInstructions": row.get("DeliveryInstructions", ""),
                "dietaryRestrictions": restrictions
            },
            "lifeChallenges": row.get("VulnerabilityClassification", ""),
            "notes": row.get("Notes", ""),
            "language": row.get("Language", ""),
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
            "tags": tags,
            "ward": ward or str(row.get("Ward", "")),
            "coordinates": coordinates,
            "seniors": 0,
            "headOfHousehold": "Adult",
            "startDate": row.get("StartDate", ""),
            "endDate": row.get("EndDate", ""),
            "recurrence": "",
            "tefapCert": row.get("TEFAP_FY25", ""),
            "notesTimestamp": None,
            "deliveryInstructionsTimestamp": None,
            "lifeChallengesTimestamp": None,
            "lifestyleGoalsTimestamp": None,
            "lifestyleGoals": ""
        }

        # Handle referral entity
        if row.get("REFERRAL_ENTITY"):
            client_profile["referralEntity"] = {
                "id": "",
                "name": row["REFERRAL_ENTITY"],
                "organization": ""
            }
        else:
            client_profile["referralEntity"] = None

        return client_profile

    def import_single_record(self, row: Dict[str, Any]) -> bool:
        """
        Import a single record to Firestore
        """
        try:
            # Transform the record
            transformed = self.transform_record(row)
            
            # Use the ID field as the document ID, or generate one
            doc_id = row.get("ID", "").strip()
            if not doc_id:
                logger.warning(f"No ID found for record: {row.get('FIRST', '')} {row.get('LAST', '')}")
                return False

            # Add to Firestore
            doc_ref = self.db.collection(self.collection_name).document(doc_id)
            doc_ref.set(transformed)
            
            logger.debug(f"Successfully imported record: {doc_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to import record {row.get('ID', 'Unknown')}: {str(e)}")
            return False

    def import_batch(self, records: List[Dict[str, Any]]) -> tuple:
        """
        Import a batch of records using Firestore batch operations
        """
        batch = self.db.batch()
        successful = 0
        failed = 0
        
        try:
            for row in records:
                try:
                    # Transform the record
                    transformed = self.transform_record(row)
                    
                    # Use the ID field as the document ID
                    doc_id = row.get("ID", "").strip()
                    if not doc_id:
                        logger.warning(f"No ID found for record: {row.get('FIRST', '')} {row.get('LAST', '')}")
                        failed += 1
                        continue

                    # Add to batch
                    doc_ref = self.db.collection(self.collection_name).document(doc_id)
                    batch.set(doc_ref, transformed)
                    successful += 1
                    
                except Exception as e:
                    logger.error(f"Failed to prepare record {row.get('ID', 'Unknown')}: {str(e)}")
                    failed += 1

            # Commit the batch
            if successful > 0:
                batch.commit()
                logger.info(f"Successfully committed batch with {successful} records")
            
        except Exception as e:
            logger.error(f"Batch commit failed: {str(e)}")
            failed += successful
            successful = 0

        return successful, failed

    def load_json_file(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Load records from a JSON file (expects one JSON object per line)
        """
        records = []
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                for line_num, line in enumerate(file, 1):
                    line = line.strip()
                    if line:
                        try:
                            record = json.loads(line)
                            records.append(record)
                        except json.JSONDecodeError as e:
                            logger.error(f"JSON decode error on line {line_num}: {str(e)}")
            
            logger.info(f"Loaded {len(records)} records from {file_path}")
            return records
            
        except FileNotFoundError:
            logger.error(f"File not found: {file_path}")
            return []
        except Exception as e:
            logger.error(f"Error loading file {file_path}: {str(e)}")
            return []

    def migrate_data(self, 
                    file_path: str, 
                    batch_size: int = 500, 
                    max_workers: int = 4,
                    use_threading: bool = True,
                    limit: Optional[int] = None) -> MigrationStats:
        """
        Main migration function
        
        Args:
            file_path: Path to the JSON file containing records
            batch_size: Number of records per batch (max 500 for Firestore)
            max_workers: Number of parallel threads
            use_threading: Whether to use threading for parallel processing
            limit: Maximum number of records to process (None for all records)
        """
        self.stats = MigrationStats()
        self.stats.start_time = datetime.utcnow()
        
        logger.info(f"Starting migration from {file_path}")
        logger.info(f"Batch size: {batch_size}, Max workers: {max_workers}")
        if limit:
            logger.info(f"Limiting to first {limit} records")
        
        # Load all records
        records = self.load_json_file(file_path)
        if not records:
            logger.error("No records to migrate")
            return self.stats
        
        # Apply limit if specified
        if limit and limit > 0:
            records = records[:limit]
            logger.info(f"Limited to {len(records)} records")
        
        self.stats.total_records = len(records)
        
        # Split into batches
        batches = [records[i:i + batch_size] for i in range(0, len(records), batch_size)]
        logger.info(f"Split {len(records)} records into {len(batches)} batches")
        
        if use_threading and max_workers > 1:
            # Parallel processing
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = {executor.submit(self.import_batch, batch): i for i, batch in enumerate(batches)}
                
                for future in as_completed(futures):
                    batch_num = futures[future]
                    try:
                        successful, failed = future.result()
                        self.stats.successful_imports += successful
                        self.stats.failed_imports += failed
                        
                        logger.info(f"Batch {batch_num + 1}/{len(batches)} completed: "
                                  f"{successful} successful, {failed} failed")
                        
                    except Exception as e:
                        logger.error(f"Batch {batch_num} failed: {str(e)}")
                        self.stats.failed_imports += len(batches[batch_num])
        else:
            # Sequential processing
            for i, batch in enumerate(batches):
                try:
                    successful, failed = self.import_batch(batch)
                    self.stats.successful_imports += successful
                    self.stats.failed_imports += failed
                    
                    logger.info(f"Batch {i + 1}/{len(batches)} completed: "
                              f"{successful} successful, {failed} failed")
                    
                    # Add a small delay to avoid rate limiting
                    time.sleep(0.1)
                    
                except Exception as e:
                    logger.error(f"Batch {i} failed: {str(e)}")
                    self.stats.failed_imports += len(batch)
        
        self.stats.end_time = datetime.utcnow()
        duration = self.stats.end_time - self.stats.start_time
        
        logger.info("Migration completed!")
        logger.info(f"Total time: {duration}")
        logger.info(f"Total records: {self.stats.total_records}")
        logger.info(f"Successful: {self.stats.successful_imports}")
        logger.info(f"Failed: {self.stats.failed_imports}")
        logger.info(f"Success rate: {(self.stats.successful_imports/self.stats.total_records)*100:.2f}%")
        
        return self.stats

def main():
    """
    Example usage
    """
    # Configuration
    SERVICE_ACCOUNT_PATH = "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-f985f354df.json"
    PROJECT_ID = "food-for-all-dc-caf23"
    COLLECTION_NAME = "client-profile1"
    JSON_FILE_PATH = "csv-one-line-client-database.json"
    GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")  # Set this environment variable
    
    # Initialize migration with Google Maps API key
    migration = FirestoreMigration(
        service_account_path=SERVICE_ACCOUNT_PATH,
        project_id=PROJECT_ID,
        collection_name=COLLECTION_NAME,
        google_maps_api_key=GOOGLE_MAPS_API_KEY
    )
    
    # Run migration with limit (change this number as needed)
    stats = migration.migrate_data(
        file_path=JSON_FILE_PATH,
        batch_size=5,  # Small batch size for API rate limiting with 4000 records
        max_workers=1,   # Single worker to avoid API rate limits
        use_threading=False,  # Disable threading for async operations
        limit=None  # Process all 4000 records
    )
    
    print(f"Migration completed: {stats.successful_imports}/{stats.total_records} successful")
    
    # Report unmapped frequencies
    if stats.unmapped_frequencies:
        print("\n⚠️  Unmapped frequency values found:")
        for freq, count in sorted(stats.unmapped_frequencies.items(), key=lambda x: x[1], reverse=True):
            print(f"  '{freq}': {count} occurrences")
        print("\nPlease review these values and update the frequency parser if needed.")
    else:
        print("✅ All frequency values were successfully mapped.")

if __name__ == "__main__":
    main()