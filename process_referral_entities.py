import json
import logging
from typing import Dict, Any, Optional, List
import google.generativeai as genai
from firebase_admin import firestore
import firebase_admin
from firebase_admin import credentials
import hashlib
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ReferralEntityProcessor:
    def __init__(self, gemini_api_key: str, firebase_credentials_path: str):
        """
        Initialize the processor with Gemini AI and Firebase credentials
        """
        # Initialize Gemini AI
        genai.configure(api_key=gemini_api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Initialize Firebase
        if not firebase_admin._apps:
            cred = credentials.Certificate(firebase_credentials_path)
            firebase_admin.initialize_app(cred)
        
        self.db = firestore.client()
        self.existing_referrals = {}
        self._load_existing_referrals()
    
    def _load_existing_referrals(self) -> None:
        """Load existing referral entities from Firestore to avoid duplicates"""
        try:
            referral_docs = self.db.collection("referral").stream()
            for doc in referral_docs:
                data = doc.to_dict()
                # Create a key based on name, email, and organization for comparison
                key = self._create_referral_key(
                    data.get("name", ""),
                    data.get("email", ""),
                    data.get("organization", "")
                )
                self.existing_referrals[key] = {
                    "id": doc.id,
                    "data": data
                }
            logger.info(f"Loaded {len(self.existing_referrals)} existing referral entities")
        except Exception as e:
            logger.error(f"Error loading existing referrals: {e}")
    
    def _create_referral_key(self, name: str, email: str, organization: str) -> str:
        """Create a unique key for referral entity comparison"""
        # Normalize and combine key fields
        normalized = f"{name.lower().strip()}|{email.lower().strip()}|{organization.lower().strip()}"
        return hashlib.md5(normalized.encode()).hexdigest()
    
    def _parse_referral_with_gemini(self, referral_fields: Dict[str, str]) -> Dict[str, str]:
        """Use Gemini AI to parse and structure referral entity information"""
        prompt = f"""
        Parse the following referral entity information and extract structured data.
        Only use the information provided, do not make assumptions or add information not present.
        
        Input data:
        - EmailAddress: {referral_fields.get('EmailAddress', '')}
        - Name_case_manager: {referral_fields.get('Name_case_manager', '')}
        - Agency_name: {referral_fields.get('Agency_name', '')}
        - Phone_contact_case_manager: {referral_fields.get('Phone_contact_case_manager', '')}
        - REFERRAL_ENTITY: {referral_fields.get('REFERRAL_ENTITY', '')}
        
        Please extract and return a JSON object with these exact fields:
        {{
            "name": "",
            "organization": "",
            "phone": "",
            "email": ""
        }}
        
        Rules:
        - Use Name_case_manager for the name field if available
        - Use Agency_name for the organization field if available
        - Use Phone_contact_case_manager for the phone field if available
        - Use EmailAddress for the email field if available
        - If REFERRAL_ENTITY contains additional information, parse it to fill missing fields
        - Return empty strings for fields that cannot be determined from the data
        - Return only valid JSON, no other text
        """
        
        try:
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()
            
            # Extract JSON from response (in case there's extra text)
            json_match = re.search(r'\{.*\}', result_text, re.DOTALL)
            if json_match:
                result_text = json_match.group()
            
            parsed_result = json.loads(result_text)
            
            # Validate the structure
            required_fields = ["name", "organization", "phone", "email"]
            for field in required_fields:
                if field not in parsed_result:
                    parsed_result[field] = ""
            
            return parsed_result
            
        except Exception as e:
            logger.error(f"Error parsing with Gemini: {e}")
            # Fallback to manual parsing
            return self._manual_parse_referral(referral_fields)
    
    def _manual_parse_referral(self, referral_fields: Dict[str, str]) -> Dict[str, str]:
        """Fallback manual parsing if Gemini fails"""
        return {
            "name": referral_fields.get('Name_case_manager', '').strip(),
            "organization": referral_fields.get('Agency_name', '').strip(),
            "phone": referral_fields.get('Phone_contact_case_manager', '').strip(),
            "email": referral_fields.get('EmailAddress', '').strip()
        }
    
    def _find_or_create_referral(self, referral_entity: Dict[str, str]) -> str:
        """Find existing referral entity or create new one, return document ID"""
        # Create key for comparison
        key = self._create_referral_key(
            referral_entity.get("name", ""),
            referral_entity.get("email", ""),
            referral_entity.get("organization", "")
        )
        
        # Check if referral already exists
        if key in self.existing_referrals:
            logger.debug(f"Found existing referral entity: {self.existing_referrals[key]['id']}")
            return self.existing_referrals[key]['id']
        
        # Create new referral entity
        try:
            doc_ref = self.db.collection("referral").document()
            doc_ref.set({
                "name": referral_entity.get("name", ""),
                "organization": referral_entity.get("organization", ""),
                "phone": referral_entity.get("phone", ""),
                "email": referral_entity.get("email", "")
            })
            
            # Add to existing referrals cache
            self.existing_referrals[key] = {
                "id": doc_ref.id,
                "data": referral_entity
            }
            
            logger.info(f"Created new referral entity: {doc_ref.id}")
            return doc_ref.id
            
        except Exception as e:
            logger.error(f"Error creating referral entity: {e}")
            return ""
    
    def _update_client_referral(self, client_id: str, referral_id: str, referral_entity: Dict[str, str]) -> bool:
        """Update client document with referral entity information"""
        try:
            client_ref = self.db.collection("client-profile2").document(client_id)
            client_doc = client_ref.get()
            
            if not client_doc.exists:
                logger.warning(f"Client document {client_id} does not exist")
                return False
            
            # Update client with referral entity
            client_ref.update({
                "referralEntity": {
                    "id": referral_id,
                    "name": referral_entity.get("name", ""),
                    "organization": referral_entity.get("organization", "")
                }
            })
            
            logger.info(f"Updated client {client_id} with referral entity {referral_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating client {client_id}: {e}")
            return False
    
    def process_json_file(self, json_file_path: str) -> Dict[str, int]:
        """Process the JSON file and update Firestore collections"""
        stats = {
            "processed": 0,
            "updated_clients": 0,
            "created_referrals": 0,
            "errors": 0
        }
        
        # Temporary limit for testing
        successfully_processed = 0
        
        try:
            with open(json_file_path, 'r', encoding='utf-8') as file:
                for line_num, line in enumerate(file, 1):
                   
                    try:
                        # Parse each line as a JSON object
                        client_data = json.loads(line.strip())
                        client_id = client_data.get('ID', '').strip()
                        
                        if not client_id:
                            logger.warning(f"Line {line_num}: No ID found")
                            continue
                        
                        # Check if client exists in Firestore
                        client_ref = self.db.collection("client-profile2").document(client_id)
                        if not client_ref.get().exists:
                            logger.debug(f"Client {client_id} does not exist in Firestore")
                            continue
                        
                        # Increment counter only for clients that exist in Firestore
                        successfully_processed += 1
                        
                        # Extract referral fields
                        referral_fields = {
                            'EmailAddress': client_data.get('EmailAddress', ''),
                            'Name_case_manager': client_data.get('Name_case_manager', ''),
                            'Agency_name': client_data.get('Agency_name', ''),
                            'Phone_contact_case_manager': client_data.get('Phone_contact_case_manager', ''),
                            'REFERRAL_ENTITY': client_data.get('REFERRAL_ENTITY', '')
                        }
                        
                        # Skip if no referral information
                        if not any(referral_fields.values()):
                            logger.debug(f"No referral information for client {client_id}")
                            continue
                        
                        # Parse referral entity using Gemini
                        referral_entity = self._parse_referral_with_gemini(referral_fields)
                        
                        # Skip if no meaningful data extracted
                        if not any([referral_entity.get("name"), referral_entity.get("email"), referral_entity.get("organization")]):
                            logger.debug(f"No meaningful referral data extracted for client {client_id}")
                            continue
                        
                        # Find or create referral entity
                        referral_id = self._find_or_create_referral(referral_entity)
                        if not referral_id:
                            stats["errors"] += 1
                            continue
                        
                        # Check if this is a new referral
                        if referral_id not in [ref["id"] for ref in self.existing_referrals.values()]:
                            stats["created_referrals"] += 1
                        
                        # Update client with referral entity
                        if self._update_client_referral(client_id, referral_id, referral_entity):
                            stats["updated_clients"] += 1
                        
                        stats["processed"] += 1
                        
                        if stats["processed"] % 50 == 0:
                            logger.info(f"Processed {stats['processed']} records...")
                            
                    except json.JSONDecodeError as e:
                        logger.error(f"Line {line_num}: Invalid JSON - {e}")
                        stats["errors"] += 1
                    except Exception as e:
                        logger.error(f"Line {line_num}: Error processing record - {e}")
                        stats["errors"] += 1
        
        except Exception as e:
            logger.error(f"Error reading file {json_file_path}: {e}")
            stats["errors"] += 1
        
        return stats

def main():
    """Main function to run the referral entity processor"""
    # Configuration - replace with your actual values
    GEMINI_API_KEY = ""  # Replace with your Gemini API key
    FIREBASE_CREDENTIALS_PATH = "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-f985f354df.json"  # Replace with your Firebase credentials path
    JSON_FILE_PATH = "/Users/suvrathc/Documents/food-for-all-dc/csv-one-line-client-database_w_referral.json"
    
    try:
        processor = ReferralEntityProcessor(GEMINI_API_KEY, FIREBASE_CREDENTIALS_PATH)
        
        logger.info("Starting referral entity processing...")
        stats = processor.process_json_file(JSON_FILE_PATH)
        
        logger.info("Processing completed!")
        logger.info(f"Statistics:")
        logger.info(f"  - Records processed: {stats['processed']}")
        logger.info(f"  - Clients updated: {stats['updated_clients']}")
        logger.info(f"  - New referrals created: {stats['created_referrals']}")
        logger.info(f"  - Errors: {stats['errors']}")
        
    except Exception as e:
        logger.error(f"Error in main execution: {e}")

if __name__ == "__main__":
    main()
