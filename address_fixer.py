import json
import os
import sys
from datetime import datetime
import time
from typing import Dict, List, Any, Optional
import logging
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
        logging.FileHandler('address_fixer.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class AddressFixer:
    def __init__(self, service_account_path: str, project_id: str, collection_name: str = "client-profile2", google_maps_api_key: str = None):
        """
        Initialize the address fixer client
        
        Args:
            service_account_path: Path to your Firebase service account JSON file
            project_id: Your Firebase project ID
            collection_name: Target Firestore collection name
            google_maps_api_key: Google Maps API key for geocoding
        """
        self.project_id = project_id
        self.collection_name = collection_name
        self.google_maps_api_key = google_maps_api_key or ""
        
        # Initialize Firebase Admin SDK
        if not firebase_admin._apps:
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred)
        
        self.db = firestore.client()
        logger.info(f"Initialized Firestore client for project: {project_id}")

    def get_google_autocomplete_suggestion(self, address: str) -> Optional[Dict[str, str]]:
        """
        Get address suggestion from Google Places Autocomplete API
        Returns dict with formatted address components or None if not found
        """
        if not self.google_maps_api_key or not address.strip():
            return None
            
        try:
            # Parse for cardinal directions and clean the address
            cleaned_address = self._clean_address_for_search(address)
            
            # Try with cleaned address
            suggestions = self._try_autocomplete(cleaned_address)
            if suggestions and suggestions.get('state') in ('DC', 'MD', 'VA'):
                # Get ward and coordinates for valid DC/MD/VA addresses
                ward_info = self._get_ward_and_coordinates_sync(suggestions['formatted_address'])
                if ward_info:
                    suggestions.update(ward_info)
                return suggestions
            
            # If no results, try word by word from the end (using cleaned address)
            words = cleaned_address.strip().split()
            for i in range(len(words) - 1, 0, -1):
                partial_address = " ".join(words[:i])
                suggestions = self._try_autocomplete(partial_address)
                if suggestions and suggestions.get('state') in ('DC', 'MD', 'VA'):
                    # Get ward and coordinates for valid DC/MD/VA addresses
                    ward_info = self._get_ward_and_coordinates_sync(suggestions['formatted_address'])
                    if ward_info:
                        suggestions.update(ward_info)
                    return suggestions
            
            # If still no results, try adding "Washington, DC" to cleaned address
            suggestions = self._try_autocomplete(f"{cleaned_address}, Washington, DC")
            if suggestions and suggestions.get('state') in ('DC', 'MD', 'VA'):
                # Get ward and coordinates for valid DC/MD/VA addresses
                ward_info = self._get_ward_and_coordinates_sync(suggestions['formatted_address'])
                if ward_info:
                    suggestions.update(ward_info)
                return suggestions
                
            # Try word by word with Washington, DC (using cleaned address)
            for i in range(len(words) - 1, 0, -1):
                partial_address = " ".join(words[:i])
                suggestions = self._try_autocomplete(f"{partial_address}, Washington, DC")
                if suggestions and suggestions.get('state') in ('DC', 'MD', 'VA'):
                    # Get ward and coordinates for valid DC/MD/VA addresses
                    ward_info = self._get_ward_and_coordinates_sync(suggestions['formatted_address'])
                    if ward_info:
                        suggestions.update(ward_info)
                    return suggestions
                    
            return None
                
        except Exception as e:
            logger.error(f"Error getting autocomplete for {address}: {str(e)}")
            return None

    def _try_autocomplete(self, search_address: str) -> Optional[Dict[str, str]]:
        """
        Try autocomplete for a specific address string
        """
        try:
            # Use Places Autocomplete API
            params = {
                'input': search_address,
                'types': 'address',
                'components': 'country:us',
                'key': self.google_maps_api_key
            }
            
            url = f"https://maps.googleapis.com/maps/api/place/autocomplete/json?{urlencode(params)}"
            response = requests.get(url, timeout=10)
            
            if response.status_code != 200:
                logger.warning(f"Autocomplete API error: {response.status_code}")
                return None
                
            data = response.json()
            
            if data['status'] == 'OK' and data['predictions']:
                # Get the first prediction and fetch its details
                place_id = data['predictions'][0]['place_id']
                return self._get_place_details(place_id)
            
            return None
                
        except Exception as e:
            logger.error(f"Error in autocomplete for {search_address}: {str(e)}")
            return None

    def _get_place_details(self, place_id: str) -> Optional[Dict[str, str]]:
        """
        Get detailed address components from Google Places Details API
        """
        try:
            params = {
                'place_id': place_id,
                'fields': 'address_components,formatted_address',
                'key': self.google_maps_api_key
            }
            
            url = f"https://maps.googleapis.com/maps/api/place/details/json?{urlencode(params)}"
            response = requests.get(url, timeout=10)
            
            if response.status_code != 200:
                logger.warning(f"Place details API error: {response.status_code}")
                return None
                
            data = response.json()
            
            if data['status'] == 'OK' and 'result' in data:
                result = data['result']
                
                # Parse address components
                street = ""
                city = ""
                state = ""
                zip_code = ""
                quadrant = ""
                
                if 'address_components' in result:
                    for comp in result['address_components']:
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
                
                # Extract quadrant from formatted address if not found in components
                formatted_address = result.get('formatted_address', '')
                if not quadrant and formatted_address:
                    import re
                    m = re.search(r'\b(NW|NE|SW|SE)\b', formatted_address, re.IGNORECASE)
                    if m: 
                        quadrant = m.group(0).upper()
                
                # Prefer DC/MD/VA results
                if state in ('DC', 'MD', 'VA'):
                    return {
                        "formatted_address": formatted_address,
                        "street": street.strip(),
                        "city": city,
                        "state": state,
                        "zip": zip_code,
                        "quadrant": quadrant
                    }
                else:
                    # Return anyway but note it's not in preferred states
                    return {
                        "formatted_address": formatted_address,
                        "street": street.strip(),
                        "city": city,
                        "state": state,
                        "zip": zip_code,
                        "quadrant": quadrant,
                        "note": f"Address is in {state}, not DC/MD/VA"
                    }
                    
            return None
                
        except Exception as e:
            logger.error(f"Error getting place details for {place_id}: {str(e)}")
            return None

    def get_client_document(self, client_id: str) -> Optional[Dict[str, Any]]:
        """
        Get client document from Firestore
        """
        try:
            doc_ref = self.db.collection(self.collection_name).document(client_id)
            doc_snap = doc_ref.get()
            
            if doc_snap.exists:
                return doc_snap.to_dict()
            else:
                logger.warning(f"No document found for client ID: {client_id}")
                return None
                
        except Exception as e:
            logger.error(f"Error fetching document for {client_id}: {str(e)}")
            return None

    def fix_addresses_for_ids(self, client_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """
        Fix addresses for a list of client IDs
        Returns dict with client ID as key and address info as value
        Also updates Firestore documents if a valid suggestion is found
        """
        results = {}
        update_stats = {
            "updated": 0,
            "not_updated": 0,
            "update_details": []
        }

        logger.info(f"Starting address fixing for {len(client_ids)} client IDs")

        for i, client_id in enumerate(client_ids, 1):
            logger.info(f"Processing {i}/{len(client_ids)}: {client_id}")

            # Get client document
            doc_data = self.get_client_document(client_id)
            if not doc_data:
                results[client_id] = {
                    "error": "Document not found in Firestore",
                    "original_address": None,
                    "google_suggestion": None
                }
                update_stats["not_updated"] += 1
                continue

            # Extract existing address info
            original_address_info = {
                "address": doc_data.get("address", ""),
                "address2": doc_data.get("address2", ""),
                "city": doc_data.get("city", ""),
                "state": doc_data.get("state", ""),
                "zipCode": doc_data.get("zipCode", ""),
                "quadrant": doc_data.get("quadrant", ""),
                "ward": doc_data.get("ward", "")
            }

            # Build search address from existing data
            search_parts = []
            if original_address_info["address"]:
                search_parts.append(original_address_info["address"])
            if original_address_info["address2"]:
                search_parts.append(original_address_info["address2"])

            search_address = " ".join(search_parts).strip()

            if not search_address:
                results[client_id] = {
                    "error": "No address found in document",
                    "original_address": original_address_info,
                    "google_suggestion": None
                }
                update_stats["not_updated"] += 1
                continue

            # Try to get Google autocomplete suggestion
            google_suggestion = self.get_google_autocomplete_suggestion(search_address)

            # --- Firestore update logic ---
            updated_fields = {}
            update_success = False
            if google_suggestion and google_suggestion.get("state") in ("DC", "MD", "VA"):
                # Prepare update fields
                if google_suggestion.get("quadrant"):
                    updated_fields["quadrant"] = google_suggestion["quadrant"]
                if google_suggestion.get("state"):
                    updated_fields["state"] = google_suggestion["state"]
                if google_suggestion.get("city"):
                    updated_fields["city"] = google_suggestion["city"]
                if google_suggestion.get("street"):
                    updated_fields["streetName"] = google_suggestion["street"]
                if google_suggestion.get("zip"):
                    updated_fields["zipCode"] = google_suggestion["zip"]
                # Coordinates and ward
                coords = google_suggestion.get("coordinates")
                if coords and isinstance(coords, list) and len(coords) == 2:
                    updated_fields["coordinates"] = coords
                if google_suggestion.get("ward"):
                    updated_fields["ward"] = google_suggestion["ward"]

                # Only update if at least one field is present
                if updated_fields:
                    try:
                        doc_ref = self.db.collection(self.collection_name).document(client_id)
                        doc_ref.update(updated_fields)
                        update_success = True
                        update_stats["updated"] += 1
                        update_stats["update_details"].append({
                            "client_id": client_id,
                            "updated_fields": list(updated_fields.keys())
                        })
                        logger.info(f"Updated Firestore doc for {client_id}: {updated_fields}")
                    except Exception as e:
                        logger.error(f"Failed to update Firestore doc for {client_id}: {str(e)}")
                        update_stats["not_updated"] += 1
                else:
                    update_stats["not_updated"] += 1
            else:
                update_stats["not_updated"] += 1

            results[client_id] = {
                "error": None,
                "original_address": original_address_info,
                "google_suggestion": google_suggestion,
                "search_address_used": search_address,
                "updated_firestore": update_success,
                "updated_fields": list(updated_fields.keys()) if updated_fields else []
            }

            # Add small delay to avoid rate limiting
            time.sleep(0.1)

        # Attach update_stats for later reporting
        results["_update_stats"] = update_stats
        return results

    def save_results_to_file(self, results: Dict[str, Dict[str, Any]], filename: str = "address_fix_results.json"):
        """
        Save results to a JSON file
        """
        try:
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False, default=str)
            logger.info(f"Results saved to {filename}")
        except Exception as e:
            logger.error(f"Error saving results to file: {str(e)}")

    def print_summary_report(self, results: Dict[str, Dict[str, Any]]):
        """
        Print a summary report of the address fixing results, including Firestore update stats
        """
        total_clients = len([k for k in results if not k.startswith("_")])
        found_suggestions = sum(1 for r in results.values() if isinstance(r, dict) and r.get("google_suggestion"))
        errors = sum(1 for r in results.values() if isinstance(r, dict) and r.get("error"))
        no_suggestions = total_clients - found_suggestions - errors

        logger.info("\n" + "="*50)
        logger.info("ADDRESS FIXING SUMMARY REPORT")
        logger.info("="*50)
        logger.info(f"Total clients processed: {total_clients}")
        logger.info(f"Google suggestions found: {found_suggestions}")
        logger.info(f"No suggestions found: {no_suggestions}")
        logger.info(f"Errors: {errors}")

        # Firestore update stats
        update_stats = results.get("_update_stats", {})
        logger.info("="*50)
        logger.info("FIRESTORE UPDATE SUMMARY")
        logger.info("="*50)
        logger.info(f"Documents updated: {update_stats.get('updated', 0)}")
        logger.info(f"Documents not updated: {update_stats.get('not_updated', 0)}")
        if update_stats.get("update_details"):
            logger.info("Updated documents and fields:")
            for detail in update_stats["update_details"]:
                logger.info(f"  Client ID: {detail['client_id']}, Fields: {detail['updated_fields']}")
        logger.info("="*50)

        # Print detailed results
        for client_id, result in results.items():
            if client_id.startswith("_"):
                continue
            logger.info(f"\nClient ID: {client_id}")

            if result.get("error"):
                logger.info(f"  ERROR: {result['error']}")
                continue

            original = result.get("original_address", {})
            suggestion = result.get("google_suggestion")

            logger.info(f"  Original address: {original.get('address', '')} {original.get('address2', '')}")
            logger.info(f"  Original city/state/zip: {original.get('city', '')}, {original.get('state', '')} {original.get('zipCode', '')}")

            if suggestion:
                logger.info(f"  Google suggestion: {suggestion.get('formatted_address', 'N/A')}")
                if suggestion.get('note'):
                    logger.info(f"  Note: {suggestion['note']}")
            else:
                logger.info("  Google suggestion: None found")

            if result.get("updated_firestore"):
                logger.info(f"  Firestore updated: Yes, fields: {result.get('updated_fields', [])}")
            else:
                logger.info("  Firestore updated: No")

    def _clean_address_for_search(self, address: str) -> str:
        """
        Clean address for better Google Places search by:
        1. Stopping after cardinal directions (NE, NW, SE, SW)
        2. Removing duplicate apartment numbers
        3. Keeping only the essential street address
        """
        import re
        
        # Split address into words
        words = address.strip().split()
        cleaned_words = []
        
        for i, word in enumerate(words):
            # Check for cardinal directions first - this is the primary stopping point
            if "SE" in word.upper() or "SW" in word.upper() or "NE" in word.upper() or "NW" in word.upper():
                cleaned_words.append(word.upper())
                # Stop processing immediately after cardinal direction
                break
            
            # Add regular words (street number, street name, etc.)
            cleaned_words.append(word)
        
        cleaned_address = ' '.join(cleaned_words)
        
        # Log the cleaning process for debugging
        if cleaned_address != address:
            logger.debug(f"Cleaned address: '{address}' -> '{cleaned_address}'")
        
        return cleaned_address

    def _get_ward_and_coordinates_sync(self, address: str) -> Optional[Dict[str, Any]]:
        """
        Synchronous wrapper for ward and coordinate lookup
        """
        import asyncio
        try:
            # Run the async function in a new event loop
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(self._get_ward_and_coordinates(address))
            loop.close()
            return result
        except Exception as e:
            logger.error(f"Error in sync ward lookup for {address}: {str(e)}")
            return None

    async def _get_coordinates(self, address: str) -> Optional[List[float]]:
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
            logger.info(f"Geocoding response for '{address}': {data}")
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

    async def _get_ward_and_coordinates(self, address: str) -> Optional[Dict[str, Any]]:
        """
        Get ward and coordinates for an address
        Returns dict with 'ward' and 'coordinates' keys
        """
        try:
            # Get coordinates first
            coordinates = await self._get_coordinates(address)
            
            if not coordinates or len(coordinates) != 2 or coordinates[0] == 0 or coordinates[1] == 0:
                logger.warning(f"Invalid coordinates for ward lookup: {address}")
                return {"ward": "No address", "coordinates": coordinates or []}
            
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
                return {"ward": "Error", "coordinates": coordinates}
            
            data = response.json()
            
            if data.get('features') and len(data['features']) > 0:
                ward_feature = data['features'][0]
                ward_name = ward_feature['attributes'].get('NAME') or f"Ward {ward_feature['attributes'].get('WARD', '')}"
                return {"ward": ward_name, "coordinates": coordinates}
            else:
                logger.warning(f"No ward found for coordinates: {coordinates}")
                return {"ward": "No ward", "coordinates": coordinates}
                
        except Exception as e:
            logger.error(f"Error getting ward information for {address}: {str(e)}")
            return {"ward": "Error", "coordinates": []}

def load_client_ids_from_file(filename: str) -> List[str]:
    """
    Load client IDs from a text file (one ID per line)
    """
    client_ids = []
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            for line in f:
                client_id = line.strip()
                if client_id:  # Skip empty lines
                    client_ids.append(client_id)
        logger.info(f"Loaded {len(client_ids)} client IDs from {filename}")
        return client_ids
    except FileNotFoundError:
        logger.error(f"File not found: {filename}")
        return []
    except Exception as e:
        logger.error(f"Error loading client IDs from file: {str(e)}")
        return []

def main():
    """
    Main function to fix addresses for client IDs from the ID file
    """
    # Configuration
    SERVICE_ACCOUNT_PATH = "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-f985f354df.json"
    PROJECT_ID = "food-for-all-dc-caf23"
    COLLECTION_NAME = "client-profile2"
    CLIENT_IDS_FILE = "IDs_deleted.txt"
    GOOGLE_MAPS_API_KEY = "" # Set this environment variable
    
    if not GOOGLE_MAPS_API_KEY:
        logger.error("Google Maps API key is required. Set GOOGLE_MAPS_API_KEY environment variable.")
        return
    
    # Load client IDs from file
    client_ids = load_client_ids_from_file(CLIENT_IDS_FILE)
    if not client_ids:
        logger.error("No client IDs loaded. Exiting.")
        return
    
    # Initialize address fixer
    address_fixer = AddressFixer(
        service_account_path=SERVICE_ACCOUNT_PATH,
        project_id=PROJECT_ID,
        collection_name=COLLECTION_NAME,
        google_maps_api_key=GOOGLE_MAPS_API_KEY
    )
    
    # Process addresses
    start_time = datetime.now()
    logger.info(f"Starting address fixing at {start_time}")
    
    results = address_fixer.fix_addresses_for_ids(client_ids)
    
    end_time = datetime.now()
    duration = end_time - start_time
    logger.info(f"Address fixing completed in {duration}")
    
    # Save results to file
    timestamp = start_time.strftime("%Y%m%d_%H%M%S")
    results_filename = f"address_fix_results_{timestamp}.json"
    address_fixer.save_results_to_file(results, results_filename)
    
    # Print summary report
    address_fixer.print_summary_report(results)
    
    logger.info(f"\nDetailed results saved to: {results_filename}")

if __name__ == "__main__":
    main()
