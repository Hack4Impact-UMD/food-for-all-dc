import json
import os
import sys
from datetime import datetime
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
        self.google_maps_api_key = google_maps_api_key or ""
        self.stats = MigrationStats()
        self.processed_names = set()  # Track processed names for duplicate checking
        self.case_workers = {}  # Track case workers by name (case-insensitive)
        self.failed_geocoding_clients: List[str] = []  # Track clients with no coords

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
                # prefer DC/MD/VA result
                for res in data['results']:
                    for comp in res['address_components']:
                        if 'administrative_area_level_1' in comp['types'] and comp.get('short_name') in ('DC','MD','VA'):
                            loc = res['geometry']['location']
                            return [loc['lat'], loc['lng']]
                # fallback to first result
                loc = data['results'][0]['geometry']['location']
                return [loc['lat'], loc['lng']]
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
            lng, lat = coordinates[1], coordinates[0]
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
            if data.get('features'):
                feat = data['features'][0]['attributes']
                result["ward"] = feat.get('NAME') or f"Ward {feat.get('WARD','')}"
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
            params = {'address': address, 'key': self.google_maps_api_key}
            url = f"https://maps.googleapis.com/maps/api/geocode/json?{urlencode(params)}"
            response = requests.get(url, timeout=10)
            if response.status_code != 200:
                return {"street": address, "city": "", "state": "", "zip": "", "quadrant": ""}
            data = response.json()
            
            if data.get('status') != 'OK' or not data.get('results'):
                return {"street": address, "city": "", "state": "", "zip": "", "quadrant": ""}
            
            # prefer DC/MD/VA result
            for res in data['results']:
                state = next((c['short_name'] 
                              for c in res['address_components'] 
                              if 'administrative_area_level_1' in c['types']), None)
                if state in ('DC','MD','VA'):
                    components = res['address_components']
                    formatted = res['formatted_address']
                    break
            else:
                # no preferred state found
                components = data['results'][0]['address_components']
                formatted = data['results'][0]['formatted_address']
            
            street = city = state = zip_code = quadrant = ""
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
                elif 'neighborhood' in types and any(q in comp['long_name'].upper() for q in ['NW','NE','SW','SE']):
                    quadrant = comp['long_name']
            if not quadrant and formatted:
                import re
                m = re.search(r'\b(NW|NE|SW|SE)\b', formatted, re.IGNORECASE)
                if m: quadrant = m.group(0).upper()
            return {"street": street.strip(), "city": city, "state": state, "zip": zip_code, "quadrant": quadrant}
        except Exception as e:
            logger.error(f"Error parsing address {address}: {str(e)}")
            return {"street": address, "city": "", "state": "", "zip": "", "quadrant": ""}

    def check_recent_deliveries(self, row: Dict[str, Any]) -> bool:
        """
        Check if client has had any deliveries in the last 6 months
        Returns True if any delivery field has a value
        """
        delivery_fields = [
            "Delivery_1_31_2025", "Delivery_2_7_2025", "Delivery_2_14_2025", 
            "Delivery_2_21_2025", "Delivery_2_28_2025", "Delivery_3_7_2025",
            "Delivery_3_14_2025", "Delivery_3_21_2025", "Delivery_3_28_2025",
            "Delivery_4_4_2025", "Delivery_4_11_2025", "Delivery_4_18_2025",
            "Delivery_4_25_2025", "Delivery_5_2_2025", "Delivery_5_9_2025",
            "Delivery_5_16_2025", "Delivery_5_23_2025", "Delivery_5_30_2025",
            "Delivery_6_6_2025", "Delivery_6_13_2025", "Delivery_6_20_2025",
            "Delivery_6_27_2025", "Delivery_7_4_2025", "Delivery_7_11_2025",
            "Delivery_7_18_2025"
        ]
        
        for field in delivery_fields:
            value = row.get(field, "")
            if value and str(value).strip() and str(value).strip().lower() not in ['', 'false', 'no', '0']:
                return True
        
        return False

    def parse_frequency(self, frequency_str: str) -> str:
        """
        Parse frequency string to match predefined categories
        Returns one of: "None", "Weekly", "2x-Monthly", "Monthly", "Emergency", "Periodic"
        """
        if not frequency_str or not str(frequency_str).strip():
            return "None"
        
        freq = str(frequency_str).strip().lower()
        
        # Check for emergency/one-time deliveries first
        emergency_keywords = ["emergency", "only", "two time only", "one time only", "emerg"]
        if any(keyword in freq for keyword in emergency_keywords):
            return "Emergency"
        
        # Check for periodic
        if "periodic" or "PERIODIC" or "Periodic"  or "perodic" in freq:
            return "Periodic"
        
        # Define mapping patterns for regular frequencies
        if freq in ["none", "n/a", "na", ""]:
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

    def parse_physical_ailments(self, main_vulnerability: str, eligibility_database: str, unnamed_29: str, further_information: str = "") -> Dict[str, Any]:
        """
        Parse physical ailments from various fields
        """
        ailments = {
            "diabetes": False,
            "hypertension": False,
            "heartDisease": False,
            "kidneyDisease": False,
            "cancer": False,
            "otherText": "",
            "other": False
        }
        
        # Combine all relevant fields including further_information
        all_text = []
        for field in [main_vulnerability, eligibility_database, unnamed_29, further_information]:
            if field and str(field).strip():
                all_text.append(str(field).lower())
        
        combined_text = ' '.join(all_text)
        
        if 'diabetes' in combined_text or 'diabetic' in combined_text:
            ailments["diabetes"] = True
        if 'hypertension' in combined_text or 'high blood pressure' in combined_text or 'blood pressure' in combined_text:
            ailments["hypertension"] = True
        if 'heart' in combined_text or 'cardiac' in combined_text or 'cardiovascular' in combined_text:
            ailments["heartDisease"] = True
        if 'kidney' in combined_text or 'renal' in combined_text:
            ailments["kidneyDisease"] = True
        if 'cancer' in combined_text or 'tumor' in combined_text or 'oncology' in combined_text:
            ailments["cancer"] = True
        
        # Check for other medical conditions
        medical_keywords = ['medical', 'illness', 'disease', 'condition', 'health', 'medication', 'treatment']
        has_medical = any(keyword in combined_text for keyword in medical_keywords)
        
        if has_medical and not any([ailments["diabetes"], ailments["hypertension"], ailments["heartDisease"], ailments["kidneyDisease"], ailments["cancer"]]):
            ailments["other"] = True
            ailments["otherText"] = combined_text[:200]  # Limit text length
        
        return ailments

    def parse_physical_disability(self, main_vulnerability: str, eligibility_database: str, unnamed_29: str, further_information: str = "") -> Dict[str, Any]:
        """
        Parse physical disability information
        """
        disability = {
            "otherText": "",
            "other": False
        }
        
        # Combine all relevant fields including further_information
        all_text = []
        for field in [main_vulnerability, eligibility_database, unnamed_29, further_information]:
            if field and str(field).strip():
                all_text.append(str(field).lower())
        
        combined_text = ' '.join(all_text)
        
        disability_keywords = ['disability', 'disabled', 'wheelchair', 'mobility', 'impaired', 'handicap', 'physical limitation']
        
        if any(keyword in combined_text for keyword in disability_keywords):
            disability["other"] = True
            disability["otherText"] = combined_text[:200]  # Limit text length
        
        return disability

    def parse_mental_health_conditions(self, main_vulnerability: str, eligibility_database: str, unnamed_29: str, further_information: str = "") -> Dict[str, Any]:
        """
        Parse mental health conditions
        """
        mental_health = {
            "otherText": "",
            "other": False
        }
        
        # Combine all relevant fields including further_information
        all_text = []
        for field in [main_vulnerability, eligibility_database, unnamed_29, further_information]:
            if field and str(field).strip():
                all_text.append(str(field).lower())
        
        combined_text = ' '.join(all_text)
        
        mental_health_keywords = ['mental', 'depression', 'anxiety', 'ptsd', 'bipolar', 'schizophrenia', 'psychiatric', 'psychological', 'therapy', 'counseling']
        
        if any(keyword in combined_text for keyword in mental_health_keywords):
            mental_health["other"] = True
            mental_health["otherText"] = combined_text[:200]  # Limit text length
        
        return mental_health

    def parse_life_challenges(self, main_vulnerability: str, eligibility_database: str, unnamed_29: str, further_information: str = "") -> str:
        """
        Parse life challenges from vulnerability fields, excluding medical/disability content
        """
        all_text = []
        for field in [main_vulnerability, eligibility_database, unnamed_29, further_information]:
            if field and str(field).strip():
                all_text.append(str(field))
        
        combined_text = ' '.join(all_text)
        
        # Filter out medical/disability keywords to focus on other life challenges
        exclude_keywords = ['diabetes', 'hypertension', 'heart', 'kidney', 'cancer', 'disability', 'wheelchair', 'mental', 'depression', 'anxiety']
        
        # Simple filtering - if text contains mainly medical terms, return empty
        lower_text = combined_text.lower()
        medical_count = sum(1 for keyword in exclude_keywords if keyword in lower_text)
        
        if medical_count > 2:  # If heavy medical content, return filtered version
            words = combined_text.split()
            filtered_words = [word for word in words if not any(keyword in word.lower() for keyword in exclude_keywords)]
            return ' '.join(filtered_words)[:200]
        
        return combined_text[:200]  # Limit text length

    def parse_referral_entity(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse referral entity information from various fields
        """
        # Check for explicit fields first
        case_manager_name = row.get("Name_case_manager", "").strip()
        agency_name = row.get("Agency_name", "").strip()
        case_manager_phone = row.get("Phone_contact_case_manager", "").strip()
        case_manager_email = row.get("EmailAddress", "").strip()
        
        # If we have explicit case manager info, use it
        if case_manager_name or agency_name:
            return {
                "id": "",
                "name": case_manager_name,
                "organization": agency_name,
                "phone": case_manager_phone,
                "email": case_manager_email
            }
        
        # Otherwise, try to parse from REFERRAL_ENTITY field
        referral_entity = row.get("REFERRAL_ENTITY", "").strip()
        if referral_entity:
            import re
            
            # Initialize result
            result = {
                "id": "",
                "name": "",
                "organization": "",
                "phone": "",
                "email": ""
            }
            
            # Extract phone number (various formats)
            phone_patterns = [
                r'\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}',  # (202) 715-6064, 202-821-1118, etc.
                r'\d{3}[-.\s]\d{3}[-.\s]\d{4}',
                r'\d{10}'
            ]
            
            phone_match = None
            for pattern in phone_patterns:
                phone_match = re.search(pattern, referral_entity)
                if phone_match:
                    result["phone"] = phone_match.group(0).strip()
                    # Remove phone from string for further parsing
                    referral_entity = referral_entity.replace(phone_match.group(0), '').strip()
                    break
            
            # Extract email
            email_match = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', referral_entity)
            if email_match:
                result["email"] = email_match.group(0).strip()
                # Remove email from string for further parsing
                referral_entity = referral_entity.replace(email_match.group(0), '').strip()
            
            # Clean up remaining text (remove extra commas, spaces)
            referral_entity = re.sub(r'[,\s]+$', '', referral_entity)  # Remove trailing commas/spaces
            referral_entity = re.sub(r'^[,\s]+', '', referral_entity)  # Remove leading commas/spaces
            referral_entity = re.sub(r'\s*,\s*$', '', referral_entity)  # Remove trailing comma
            
            # Now parse name and organization from remaining text
            if referral_entity:
                # Try different parsing strategies based on common patterns
                
                # Strategy 1: "Name, Organization" format
                if ',' in referral_entity:
                    parts = [part.strip() for part in referral_entity.split(',')]
                    if len(parts) >= 2:
                        # First part is likely name, rest is organization
                        potential_name = parts[0]
                        potential_org = ', '.join(parts[1:])
                        
                        # Check if first part looks like a person's name (has space and proper case)
                        if ' ' in potential_name and any(word[0].isupper() for word in potential_name.split()):
                            result["name"] = potential_name
                            result["organization"] = potential_org
                        else:
                            # First part might be organization
                            result["organization"] = potential_name
                            if len(parts) > 1:
                                result["name"] = potential_org
                
                # Strategy 2: Look for patterns like "Name - Organization" or "Name: Organization"
                elif any(sep in referral_entity for sep in [' - ', ': ', ' : ']):
                    for sep in [' - ', ': ', ' : ']:
                        if sep in referral_entity:
                            parts = referral_entity.split(sep, 1)
                            if len(parts) == 2:
                                left, right = parts[0].strip(), parts[1].strip()
                                # Check which part looks more like a name
                                if ' ' in left and any(word[0].isupper() for word in left.split()):
                                    result["name"] = left
                                    result["organization"] = right
                                else:
                                    result["organization"] = left
                                    result["name"] = right
                            break
                
                # Strategy 3: Look for organization indicators and split accordingly
                elif any(org_word in referral_entity.lower() for org_word in ['hospital', 'clinic', 'center', 'university', 'health', 'medical', 'plan', 'services', 'organization']):
                    # Try to split at organization indicators
                    org_indicators = ['hospital', 'clinic', 'center', 'university', 'health', 'medical', 'plan', 'services', 'organization']
                    
                    for indicator in org_indicators:
                        if indicator in referral_entity.lower():
                            # Find the position of the indicator
                            idx = referral_entity.lower().find(indicator)
                            # Look for word boundaries
                            words = referral_entity.split()
                            
                            for i, word in enumerate(words):
                                if indicator in word.lower():
                                    # Everything from this word onwards is likely organization
                                    if i > 0:
                                        result["name"] = ' '.join(words[:i]).strip()
                                        result["organization"] = ' '.join(words[i:]).strip()
                                    else:
                                        result["organization"] = referral_entity
                                    break
                            break
                
                # Strategy 4: If no clear pattern, check if it looks like a person's name
                else:
                    words = referral_entity.split()
                    # If 2-3 words with proper capitalization, likely a name
                    if 2 <= len(words) <= 3 and all(word[0].isupper() for word in words if word):
                        result["name"] = referral_entity
                    else:
                        # Otherwise, treat as organization
                        result["organization"] = referral_entity
            
            # Clean up results
            for key in ["name", "organization"]:
                if result[key]:
                    # Remove extra whitespace and clean up
                    result[key] = ' '.join(result[key].split())
                    # Remove trailing commas
                    result[key] = result[key].rstrip(',').strip()
            
            return result
        
        return None

    def is_duplicate(self, first_name: str, last_name: str) -> bool:
        """
        Check if a client with the same name (case-insensitive) has already been processed
        """
        if not first_name or not last_name:
            return False
            
        full_name = f"{first_name.strip().lower()} {last_name.strip().lower()}"
        
        if full_name in self.processed_names:
            return True
        
        self.processed_names.add(full_name)
        return False

    def add_or_update_case_worker(self, referral_entity: Dict[str, Any]) -> None:
        """
        Add or update a case worker in the collection, avoiding duplicates and merging data
        """
        if not referral_entity:
            return
        
        name = referral_entity.get("name", "").strip()
        organization = referral_entity.get("organization", "").strip()
        phone = referral_entity.get("phone", "").strip()
        email = referral_entity.get("email", "").strip()
        
        # Skip if no meaningful data
        if not name and not organization:
            return
        
        # Use name as the primary key, fallback to organization if no name
        key = name.lower() if name else organization.lower()
        
        if key in self.case_workers:
            # Merge with existing data - fill in missing fields
            existing = self.case_workers[key]
            
            # Update fields if they're empty in existing but have value in new
            if not existing["name"] and name:
                existing["name"] = name
            if not existing["organization"] and organization:
                existing["organization"] = organization
            if not existing["phone"] and phone:
                existing["phone"] = phone
            if not existing["email"] and email:
                existing["email"] = email
                
            logger.debug(f"Updated case worker: {key}")
        else:
            # Add new case worker
            self.case_workers[key] = {
                "name": name,
                "organization": organization,
                "phone": phone,
                "email": email
            }
            logger.debug(f"Added new case worker: {key}")

    def save_case_workers_to_firestore(self) -> None:
        """
        Save all collected case workers to the new_case_workers collection
        """
        if not self.case_workers:
            logger.info("No case workers to save")
            return
        
        collection_name = "new_case_workers"
        successful = 0
        failed = 0
        
        try:
            for key, case_worker in self.case_workers.items():
                try:
                    # Create document reference with unique ID
                    doc_ref = self.db.collection(collection_name).document()
                    
                    # Add case worker data
                    doc_ref.set(case_worker)
                    
                    successful += 1
                    logger.debug(f"Saved case worker: {key} -> {doc_ref.id}")
                    
                except Exception as e:
                    logger.error(f"Failed to save case worker {key}: {e}")
                    failed += 1
            
            logger.info(f"Case workers saved: {successful} successful, {failed} failed")
            
        except Exception as e:
            logger.error(f"Error accessing Firestore collection {collection_name}: {e}")

    def parse_age_group(self, age_group_str: str, adults_count: int) -> Dict[str, Any]:
        """
        Parse age group to determine if household head is senior or adult
        Returns dict with 'adults', 'seniors', 'headOfHousehold' keys
        """
        result = {
            "adults": adults_count,
            "seniors": 0,
            "headOfHousehold": "Adult"
        }
        
        if not age_group_str or not str(age_group_str).strip():
            return result
        
        age_group = str(age_group_str).strip().lower()
        
        # Check for senior indicators (65+)
        senior_patterns = [
            "65+", "65 +", "65 plus", "65 - 74", "75+", "75 +", "80+", "80 +",
            "65 + years", "65+ years", "senior", "elderly"
        ]
        
        # Check for explicit age ranges starting at 65 or higher
        import re
        age_range_match = re.search(r'(\d+)\s*[-–—]\s*(\d+)', age_group)
        if age_range_match:
            start_age = int(age_range_match.group(1))
            if start_age >= 65:
                # This person is a senior, not an adult
                result["adults"] = max(0, adults_count - 1)  # Remove one from adults
                result["seniors"] = 1
                result["headOfHousehold"] = "Senior"
                return result
        
        # Check for single age mentions of 65+
        single_age_match = re.search(r'(\d+)\s*\+', age_group)
        if single_age_match:
            age = int(single_age_match.group(1))
            if age >= 65:
                result["adults"] = max(0, adults_count - 1)
                result["seniors"] = 1
                result["headOfHousehold"] = "Senior"
                return result
        
        # Check for senior keyword patterns
        if any(pattern in age_group for pattern in senior_patterns):
            result["adults"] = max(0, adults_count - 1)
            result["seniors"] = 1
            result["headOfHousehold"] = "Senior"
            return result
        
        # Default to adult if no senior indicators found
        return result

    def transform_record(self, row: Dict[str, Any]) -> Dict[str, Any]:
        """
        Python port of the JavaScript transform function with Google Maps integration
        """
        # Check for duplicates first
        first_name = row.get("FIRST", "")
        last_name = row.get("LAST", "")
        
        if self.is_duplicate(first_name, last_name):
            logger.warning(f"Skipping duplicate: {first_name} {last_name}")
            return None

        # Handle phone/email logic
        phone = ""
        email = ""
        if row.get("Phone"):
            phone_str = str(row["Phone"])
            if '@' in phone_str:
                email = phone_str
            else:
                phone = phone_str

        # Parse dietary restrictions / preferences
        restrictions = self.parse_dietary_restrictions(
            row.get("Diettype"),
            row.get("DietaryRestrictions")
            or row.get("Dietary Restrictions")
            or row.get("Dietary Preferences")
        )

        # Parse health-related fields including further_information
        main_vulnerability = row.get("MainVulnerability", "")
        eligibility_database = row.get("Eligibility_database", "")
        unnamed_29 = row.get("Unnamed: 29", "")
        further_information = row.get("further_information", "")

        physical_ailments = self.parse_physical_ailments(main_vulnerability, eligibility_database, unnamed_29, further_information)
        physical_disability = self.parse_physical_disability(main_vulnerability, eligibility_database, unnamed_29, further_information)
        mental_health_conditions = self.parse_mental_health_conditions(main_vulnerability, eligibility_database, unnamed_29, further_information)
        life_challenges = self.parse_life_challenges(main_vulnerability, eligibility_database, unnamed_29, further_information)

        # Parse referral entity
        referral_entity = self.parse_referral_entity(row)
        
        # Add case worker to collection if valid
        if referral_entity:
            self.add_or_update_case_worker(referral_entity)
        
        # Handle fallback phone logic if client has no phone
        notes = row.get("Notes", "")
        if not phone and referral_entity and referral_entity.get("phone"):
            phone = referral_entity["phone"]
            # Add note about using referral entity's phone
            if notes:
                notes += " | Phone number is from Referral Entity."
            else:
                notes = "Phone number is from Referral Entity."

        # Check active status and recent deliveries
        active_status = row.get("Active", "")
        has_recent_deliveries = self.check_recent_deliveries(row)
        
        # If marked as inactive but has recent deliveries, override to active
        if has_recent_deliveries and str(active_status).lower() in ['no', 'false', '0', 'inactive']:
            active_status = "Yes"
            # Add note about status change
            if notes:
                notes += " | Status changed to Active due to recent deliveries."
            else:
                notes = "Status changed to Active due to recent deliveries."

        # Create tags
        tags = []
        if row.get("TEFAP_FY25") and str(row["TEFAP_FY25"]).lower() != 'false':
            tags.append("TEFAPOnFile")
        
        # Add active status to tags if applicable
        if str(active_status).lower() in ['yes', 'true', '1', 'active']:
            tags.append("Active")

        # Parse frequency with new emergency and periodic handling
        delivery_freq = self.parse_frequency(row.get("Frequency", ""))

        # Parse age group to determine senior vs adult classification
        adults_count = int(row.get("Adults_database", 0)) if row.get("Adults_database") else 0
        children_count = int(row.get("kids", 0)) if row.get("kids") else 0

        # Check vulnerability fields for explicit "senior"
        vuln_fields = [
            row.get("MainVulnerability", ""),
            row.get("Eligibility_database", ""),
            row.get("Notes", ""),
            row.get("Eligibility_referral", ""),
            row.get("further_information", ""),
            row.get("STATUS_WITH_DATE", "")
        ]
        if any("senior" in str(val).lower() for val in vuln_fields) and adults_count > 0:
            # shift one adult to senior
            age_group_data = {
                "adults": max(0, adults_count - 1),
                "seniors": 1,
                "headOfHousehold": "Senior"
            }
        else:
            age_group_data = self.parse_age_group(row.get("age_group", ""), adults_count)

        # Calculate total household size
        total_household = age_group_data["adults"] + age_group_data["seniors"] + children_count

        # Process address with Google Maps if API key is available
        address_components = {"street": "", "city": "", "state": "", "zip": "", "quadrant": ""}
        ward = ""
        coordinates = []

        if self.google_maps_api_key and row.get("ADDRESS"):
            full_address = row.get("ADDRESS", "")
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

        # record failures
        if not coordinates:
            self.failed_geocoding_clients.append(str(row.get("ID", "")))

        # Build the client profile with updated model
        client_profile = {
            "uid": row.get("ID", ""),
            "firstName": first_name,
            "lastName": last_name,
            "streetName": address_components["street"] or row.get("ADDRESS", ""),
            "address":    address_components["street"] or row.get("ADDRESS", ""),
            "address2": row.get("APT", ""),
            "zipCode":    address_components["zip"]    or str(row.get("ZIP", "")),
            "city":       address_components["city"],
            "state":      address_components["state"],
            "quadrant":   address_components["quadrant"] or row.get("Quadrant", ""),
            "dob": "",
            "deliveryFreq": delivery_freq,
            "phone": phone,
            "email": email,
            "alternativePhone": "",
            "adults": age_group_data["adults"],
            "children": children_count,
            "total": total_household,
            "gender": "Other",
            "ethnicity": str(
                row.get("Ethnicity")
                or row.get("Race/Ethnicity")
                or row.get("Race")
                or ""
            ),
            "deliveryDetails": {
                "deliveryInstructions": row.get("Delivery Instructions", ""),
                "dietaryRestrictions": restrictions
            },
            "lifeChallenges": life_challenges,
            "physicalAilments": physical_ailments,
            "physicalDisability": physical_disability,
            "mentalHealthConditions": mental_health_conditions,
            "notes": notes,
            "language": row.get("Language", ""),
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow(),
            "tags": tags,
            "ward": ward or str(row.get("Ward", "")),
            "coordinates":coordinates,
            "seniors": age_group_data["seniors"],
            "headOfHousehold": age_group_data["headOfHousehold"],
            "startDate": row.get("StartDate", ""),
            "endDate": row.get("EndDate", ""),
            "recurrence": "",
            "tefapCert": row.get("TEFAP_FY25", ""),
            "notesTimestamp": None,
            "deliveryInstructionsTimestamp": None,
            "lifeChallengesTimestamp": None,
            "lifestyleGoalsTimestamp": None,
            "lifestyleGoals": "",
            "activeStatus": str(active_status).lower() in ['yes', 'true', '1', 'active']  # Add boolean active status
        }

        # Handle referral entity - only include if we have meaningful data
        if referral_entity and (referral_entity.get("name") or referral_entity.get("organization")):
            # Remove phone and email from referral entity before storing (they're not in the target schema)
            client_profile["referralEntity"] = {
                "id": referral_entity.get("id", ""),
                "name": referral_entity.get("name", ""),
                "organization": referral_entity.get("organization", "")
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
            
            # Skip if duplicate
            if transformed is None:
                self.stats.skipped_records += 1
                return True  # Not a failure, just skipped
            
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
        skipped = 0
        
        try:
            for row in records:
                try:
                    # Transform the record
                    transformed = self.transform_record(row)
                    
                    # Skip if duplicate
                    if transformed is None:
                        skipped += 1
                        continue
                    
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
            
            # Update stats
            self.stats.skipped_records += skipped
            
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
                    file_path: str = None, 
                    batch_size: int = 500, 
                    max_workers: int = 4,
                    use_threading: bool = True,
                    limit: Optional[int] = None,
                    records_override: list = None) -> MigrationStats:
        """
        Main migration function
        
        Args:
            file_path: Path to the JSON file containing records
            batch_size: Number of records per batch (max 500 for Firestore)
            max_workers: Number of parallel threads
            use_threading: Whether to use threading for parallel processing
            limit: Maximum number of records to process (None for all records)
            records_override: List of records to process directly (bypasses file loading)
        """
        # Reset processed names and case workers for each migration run
        self.processed_names = set()
        self.case_workers = {}
        
        self.stats = MigrationStats()
        self.stats.start_time = datetime.utcnow()
        
        logger.info(f"Starting migration from {file_path}")
        logger.info(f"Batch size: {batch_size}, Max workers: {max_workers}")
        if limit:
            logger.info(f"Limiting to first {limit} records")
        
        # Load all records
        if records_override is not None:
            records = records_override
        else:
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
        logger.info(f"Skipped (duplicates): {self.stats.skipped_records}")
        logger.info(f"Success rate: {(self.stats.successful_imports/self.stats.total_records)*100:.2f}%")
        
        # Save case workers to Firestore
        logger.info(f"Saving {len(self.case_workers)} unique case workers...")
        self.save_case_workers_to_firestore()

        # Log clients without coordinates
        if self.failed_geocoding_clients:
            logger.info("Clients missing coordinates:")
            for cid in self.failed_geocoding_clients:
                logger.info(f"  - {cid}")

        return self.stats

def load_allowed_ids(ids_file_path: str) -> set:
    allowed_ids = set()
    with open(ids_file_path, "r", encoding="utf-8") as f:
        for line in f:
            id_val = line.strip()
            if id_val:
                allowed_ids.add(id_val)
    return allowed_ids

def main():
    """
    Example usage
    """
    # Configuration
    SERVICE_ACCOUNT_PATH = "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-f985f354df.json"
    PROJECT_ID = "food-for-all-dc-caf23"
    COLLECTION_NAME = "client-profile2"
    JSON_FILE_PATH = "csv-one-line-client-database_w_referral.json"
    IDS_FILE_PATH = "IDs_deleted.txt"
    GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")  # Set this environment variable

    # Load allowed IDs
    allowed_ids = load_allowed_ids(IDS_FILE_PATH)

    # Initialize migration with Google Maps API key
    migration = FirestoreMigration(
        service_account_path=SERVICE_ACCOUNT_PATH,
        project_id=PROJECT_ID,
        collection_name=COLLECTION_NAME,
        google_maps_api_key=GOOGLE_MAPS_API_KEY
    )

    # Load all records from JSON file and filter by allowed IDs
    all_records = migration.load_json_file(JSON_FILE_PATH)
    filtered_records = [
        rec for rec in all_records
        if str(rec.get("ID", "")).strip() in allowed_ids
    ]

    # Run migration with limit (change this number as needed)
    stats = migration.migrate_data(
        file_path=None,
        batch_size=5,  # Small batch size for API rate limiting with 4000 records
        max_workers=1,   # Single worker to avoid API rate limits
        use_threading=False,  # Disable threading for async operations
        limit=None,  # Process all 4000 records
        records_override=filtered_records  # Add this argument to support direct record passing
    )
    
    print(f"Migration completed: {stats.successful_imports}/{stats.total_records} successful")
    print(f"Case workers collected: {len(migration.case_workers)}")
    
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