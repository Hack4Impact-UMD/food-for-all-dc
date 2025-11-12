import json
import os
import sys
from datetime import datetime
import logging
from typing import Set, List
import csv

# Install these dependencies:
# pip install firebase-admin

import firebase_admin
from firebase_admin import credentials, firestore

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('orphaned_case_workers.log'),
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

class CaseWorkerAnalyzer:
    def __init__(self, service_account_path: str, project_id: str):
        """
        Initialize the Case Worker Analyzer
        
        Args:
            service_account_path: Path to your Firebase service account JSON file
            project_id: Your Firebase project ID
        """
        self.project_id = project_id
        
        # Initialize Firebase Admin SDK
        if not firebase_admin._apps:
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred)
        
        self.db = firestore.client()
        logger.info(f"Initialized Firestore client for project: {project_id}")

    def get_all_referral_ids(self) -> Set[str]:
        """
        Get all document IDs from the referral collection
        
        Returns:
            Set of referral document IDs
        """
        try:
            logger.info("Fetching all referral collection IDs...")
            referral_collection = self.db.collection("referral")
            docs = referral_collection.stream()
            
            referral_ids = set()
            for doc in docs:
                referral_ids.add(doc.id)
            
            logger.info(f"Found {len(referral_ids)} documents in referral collection")
            return referral_ids
            
        except Exception as e:
            logger.error(f"Error fetching referral IDs: {e}")
            return set()

    def get_referenced_referral_ids(self) -> Set[str]:
        """
        Get all referralEntity.id values from the client-profile2 collection
        
        Returns:
            Set of referenced referral IDs
        """
        try:
            logger.info("Fetching referenced referral IDs from client-profile2...")
            clients_collection = self.db.collection("client-profile2")
            docs = clients_collection.stream()
            
            referenced_ids = set()
            total_clients = 0
            clients_with_referral = 0
            
            for doc in docs:
                total_clients += 1
                data = doc.to_dict()
                
                # Check if referralEntity exists and has an id
                if data and 'referralEntity' in data:
                    referral_entity = data['referralEntity']
                    if isinstance(referral_entity, dict) and 'id' in referral_entity:
                        referral_id = referral_entity['id']
                        if referral_id:  # Only add non-empty IDs
                            referenced_ids.add(referral_id)
                            clients_with_referral += 1
            
            logger.info(f"Found {len(referenced_ids)} unique referral IDs referenced by {clients_with_referral} out of {total_clients} clients")
            return referenced_ids
            
        except Exception as e:
            logger.error(f"Error fetching referenced referral IDs: {e}")
            return set()

    def find_orphaned_case_workers(self) -> List[str]:
        """
        Find case workers in referral collection that are not referenced by any client
        
        Returns:
            List of orphaned case worker IDs
        """
        logger.info("Starting orphaned case worker analysis...")
        
        # Get all referral IDs
        all_referral_ids = self.get_all_referral_ids()
        
        # Get all referenced referral IDs
        referenced_referral_ids = self.get_referenced_referral_ids()
        
        # Find orphaned IDs (in referral but not referenced)
        orphaned_ids = all_referral_ids - referenced_referral_ids
        
        logger.info(f"Analysis complete:")
        logger.info(f"  Total case workers in referral collection: {len(all_referral_ids)}")
        logger.info(f"  Case workers referenced by clients: {len(referenced_referral_ids)}")
        logger.info(f"  Orphaned case workers (not referenced): {len(orphaned_ids)}")
        
        return sorted(list(orphaned_ids))

    def get_case_worker_details(self, case_worker_ids: List[str]) -> List[dict]:
        """
        Get detailed information about specific case workers
        
        Args:
            case_worker_ids: List of case worker IDs to get details for
            
        Returns:
            List of dictionaries containing case worker details
        """
        case_worker_details = []
        
        for cw_id in case_worker_ids:
            try:
                doc = self.db.collection("referral").document(cw_id).get()
                if doc.exists:
                    data = doc.to_dict()
                    case_worker_info = {
                        'id': cw_id,
                        'name': data.get('name', 'N/A'),
                        'organization': data.get('organization', 'N/A'),
                        'email': data.get('email', 'N/A'),
                        'phone': data.get('phone', 'N/A')
                    }
                    case_worker_details.append(case_worker_info)
                else:
                    logger.warning(f"Case worker document {cw_id} not found")
            except Exception as e:
                logger.error(f"Error fetching details for case worker {cw_id}: {e}")
        
        return case_worker_details

    def save_results(self, orphaned_ids: List[str], timestamp: str):
        """
        Save analysis results to files
        
        Args:
            orphaned_ids: List of orphaned case worker IDs
            timestamp: Timestamp string for file naming
        """
        # Save comma-delimited list of IDs
        ids_filename = f"orphaned_case_worker_ids_{timestamp}.txt"
        with open(ids_filename, 'w') as f:
            f.write(','.join(orphaned_ids))
        logger.info(f"Comma-delimited ID list saved to: {ids_filename}")
        
        # Save detailed report with case worker information
        if orphaned_ids:
            details = self.get_case_worker_details(orphaned_ids)
            
            # Save as CSV
            csv_filename = f"orphaned_case_workers_details_{timestamp}.csv"
            with open(csv_filename, 'w', newline='', encoding='utf-8') as csvfile:
                fieldnames = ['id', 'name', 'organization', 'email', 'phone']
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(details)
            logger.info(f"Detailed report saved to: {csv_filename}")
            
            # Save as JSON
            json_filename = f"orphaned_case_workers_details_{timestamp}.json"
            with open(json_filename, 'w', encoding='utf-8') as jsonfile:
                json.dump(details, jsonfile, indent=2, ensure_ascii=False)
            logger.info(f"JSON report saved to: {json_filename}")

def main():
    """
    Main function to run the orphaned case worker analysis
    """
    # Configuration
    SERVICE_ACCOUNT_PATH = "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-f5a3e31a09.json"
    PROJECT_ID = "food-for-all-dc-caf23"
    
    # Check if service account file exists
    if not os.path.exists(SERVICE_ACCOUNT_PATH):
        logger.error(f"Service account file not found: {SERVICE_ACCOUNT_PATH}")
        logger.error("Please ensure the Firebase service account JSON file is in the same directory")
        return
    
    # Initialize analyzer
    analyzer = CaseWorkerAnalyzer(
        service_account_path=SERVICE_ACCOUNT_PATH,
        project_id=PROJECT_ID
    )
    
    # Run analysis
    start_time = datetime.now()
    logger.info(f"Starting analysis at {start_time}")
    
    orphaned_ids = analyzer.find_orphaned_case_workers()
    
    end_time = datetime.now()
    duration = end_time - start_time
    logger.info(f"Analysis completed in {duration}")
    
    # Save results
    timestamp = start_time.strftime("%Y%m%d_%H%M%S")
    analyzer.save_results(orphaned_ids, timestamp)
    
    # Print summary
    print("\n" + "="*60)
    print("ORPHANED CASE WORKER ANALYSIS SUMMARY")
    print("="*60)
    print(f"Analysis completed at: {end_time}")
    print(f"Duration: {duration}")
    print(f"Orphaned case workers found: {len(orphaned_ids)}")
    
    if orphaned_ids:
        print(f"\nOrphaned case worker IDs:")
        print(f"Comma-delimited: {','.join(orphaned_ids)}")
        print(f"\nDetailed reports generated:")
        print(f"  - orphaned_case_worker_ids_{timestamp}.txt")
        print(f"  - orphaned_case_workers_details_{timestamp}.csv")
        print(f"  - orphaned_case_workers_details_{timestamp}.json")
    else:
        print("\nNo orphaned case workers found. All case workers are referenced by at least one client.")
    
    print("\nLog file: orphaned_case_workers.log")
    print("="*60)

if __name__ == "__main__":
    main()