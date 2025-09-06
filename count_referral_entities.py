import json
from typing import Dict, Any, List, Tuple

def count_referral_entities(json_file_path: str) -> Tuple[int, List[str]]:
    """
    Count the number of objects with non-empty REFERRAL_ENTITY values
    and return their corresponding IDs.
    
    Args:
        json_file_path: Path to the JSON file containing client data
        
    Returns:
        Tuple of (count, list_of_ids)
    """
    count = 0
    ids_with_referral_entity = []
    
    try:
        with open(json_file_path, 'r', encoding='utf-8') as file:
            # Read file line by line since each line is a separate JSON object
            for line_num, line in enumerate(file, 1):
                line = line.strip()
                if not line:
                    continue
                    
                try:
                    # Parse each line as a JSON object
                    client_data = json.loads(line)
                    
                    # Check if REFERRAL_ENTITY exists and is not empty
                    referral_entity = client_data.get("REFERRAL_ENTITY", "")
                    if isinstance(referral_entity, str):
                        referral_entity = referral_entity.strip()
                    else:
                        referral_entity = str(referral_entity).strip() if referral_entity else ""
                    
                    # Handle ID which can be string or integer
                    client_id = client_data.get("ID", "")
                    if isinstance(client_id, str):
                        client_id = client_id.strip()
                    else:
                        client_id = str(client_id) if client_id else ""
                    
                    if referral_entity:  # Non-empty referral entity
                        count += 1
                        ids_with_referral_entity.append(client_id)
                        
                except json.JSONDecodeError as e:
                    print(f"Error parsing JSON on line {line_num}: {e}")
                    continue
                    
    except FileNotFoundError:
        print(f"Error: File '{json_file_path}' not found.")
        return 0, []
    except Exception as e:
        print(f"Error reading file: {e}")
        return 0, []
    
    return count, ids_with_referral_entity

def count_referral_entities_missing_case_manager(json_file_path: str) -> Tuple[int, List[str]]:
    """
    Count the number of objects with non-empty REFERRAL_ENTITY values
    but empty case manager fields (EmailAddress, Name_case_manager, Agency_name, Phone_contact_case_manager).
    
    Args:
        json_file_path: Path to the JSON file containing client data
        
    Returns:
        Tuple of (count, list_of_ids)
    """
    count = 0
    ids_with_missing_case_manager = []
    
    try:
        with open(json_file_path, 'r', encoding='utf-8') as file:
            for line_num, line in enumerate(file, 1):
                line = line.strip()
                if not line:
                    continue
                    
                try:
                    client_data = json.loads(line)
                    
                    # Check if REFERRAL_ENTITY exists and is not empty
                    referral_entity = client_data.get("REFERRAL_ENTITY", "")
                    if isinstance(referral_entity, str):
                        referral_entity = referral_entity.strip()
                    else:
                        referral_entity = str(referral_entity).strip() if referral_entity else ""
                    
                    if referral_entity:  # Has non-empty referral entity
                        # Check if case manager fields are empty
                        email = client_data.get("EmailAddress", "")
                        if isinstance(email, str):
                            email = email.strip()
                        else:
                            email = str(email).strip() if email else ""
                        
                        case_manager = client_data.get("Name_case_manager", "")
                        if isinstance(case_manager, str):
                            case_manager = case_manager.strip()
                        else:
                            case_manager = str(case_manager).strip() if case_manager else ""
                        
                        agency = client_data.get("Agency_name", "")
                        if isinstance(agency, str):
                            agency = agency.strip()
                        else:
                            agency = str(agency).strip() if agency else ""
                        
                        phone = client_data.get("Phone_contact_case_manager", "")
                        if isinstance(phone, str):
                            phone = phone.strip()
                        else:
                            phone = str(phone).strip() if phone else ""
                        
                        # Check if ALL case manager fields are empty
                        if not email and not case_manager and not agency and not phone:
                            count += 1
                            
                            # Handle ID which can be string or integer
                            client_id = client_data.get("ID", "")
                            if isinstance(client_id, str):
                                client_id = client_id.strip()
                            else:
                                client_id = str(client_id) if client_id else ""
                            
                            ids_with_missing_case_manager.append(client_id)
                        
                except json.JSONDecodeError as e:
                    print(f"Error parsing JSON on line {line_num}: {e}")
                    continue
                    
    except FileNotFoundError:
        print(f"Error: File '{json_file_path}' not found.")
        return 0, []
    except Exception as e:
        print(f"Error reading file: {e}")
        return 0, []
    
    return count, ids_with_missing_case_manager

def analyze_referral_entities(json_file_path: str) -> None:
    """
    Analyze and display referral entity statistics.
    """
    print("Analyzing referral entities in client database...")
    print("=" * 50)
    
    count, ids_with_referral_entity = count_referral_entities(json_file_path)
    
    print(f"Total clients with non-empty REFERRAL_ENTITY: {count}")
    print(f"Total IDs collected: {len(ids_with_referral_entity)}")
    print()
    
    if ids_with_referral_entity:
        print("Client IDs with referral entities:")
        print("-" * 30)
        
        # Filter out empty IDs and sort
        valid_ids = [id_val for id_val in ids_with_referral_entity if id_val]
        valid_ids.sort()
        
        if valid_ids:
            #for i, client_id in enumerate(valid_ids, 1):
                #print(f"{i:3d}. {client_id}")
            
            print(f"\nValid IDs (non-empty): {len(valid_ids)}")
            print(f"Empty/missing IDs: {count - len(valid_ids)}")
        else:
            print("No valid (non-empty) IDs found.")
    else:
        print("No clients found with referral entities.")

def analyze_missing_case_manager_info(json_file_path: str) -> None:
    """
    Analyze and display statistics for clients with referral entities but missing case manager info.
    """
    print("\n" + "=" * 60)
    print("CLIENTS WITH REFERRAL ENTITIES BUT MISSING CASE MANAGER INFO")
    print("=" * 60)
    
    count, ids_missing_info = count_referral_entities_missing_case_manager(json_file_path)
    
    print(f"Clients with REFERRAL_ENTITY but missing all case manager fields: {count}")
    print("(Missing: EmailAddress, Name_case_manager, Agency_name, Phone_contact_case_manager)")
    print()
    
    if ids_missing_info:
        print("Client IDs with missing case manager information:")
        print("-" * 45)
        
        # Filter out empty IDs and sort
        valid_ids = [id_val for id_val in ids_missing_info if id_val]
        valid_ids.sort()
        
        if valid_ids:
            for i, client_id in enumerate(valid_ids, 1):
                print(f"{i:3d}. {client_id}")
            
            print(f"\nValid IDs (non-empty): {len(valid_ids)}")
            print(f"Empty/missing IDs: {count - len(valid_ids)}")
        else:
            print("No valid (non-empty) IDs found.")
    else:
        print("All clients with referral entities have complete case manager information.")

def get_referral_entity_details(json_file_path: str, show_details: bool = False) -> None:
    """
    Get detailed information about referral entities.
    """
    if not show_details:
        return
        
    print("\n" + "=" * 50)
    print("DETAILED REFERRAL ENTITY INFORMATION")
    print("=" * 50)
    
    try:
        with open(json_file_path, 'r', encoding='utf-8') as file:
            for line_num, line in enumerate(file, 1):
                line = line.strip()
                if not line:
                    continue
                    
                try:
                    client_data = json.loads(line)
                    
                    # Handle REFERRAL_ENTITY
                    referral_entity = client_data.get("REFERRAL_ENTITY", "")
                    if isinstance(referral_entity, str):
                        referral_entity = referral_entity.strip()
                    else:
                        referral_entity = str(referral_entity).strip() if referral_entity else ""
                    
                    # Handle ID which can be string or integer
                    client_id = client_data.get("ID", "")
                    if isinstance(client_id, str):
                        client_id = client_id.strip()
                    else:
                        client_id = str(client_id) if client_id else ""
                    
                    # Handle client name
                    client_name = client_data.get("final_name", "Unknown")
                    if isinstance(client_name, str):
                        client_name = client_name.strip()
                    else:
                        client_name = str(client_name) if client_name else "Unknown"
                    
                    if referral_entity:
                        print(f"ID: {client_id or 'N/A'}")
                        print(f"Name: {client_name}")
                        print(f"Referral Entity: {referral_entity}")
                        print("-" * 40)
                        
                except json.JSONDecodeError:
                    continue
                    
    except Exception as e:
        print(f"Error reading file for details: {e}")

if __name__ == "__main__":
    # File path to the JSON data
    json_file_path = "/Users/suvrathc/Documents/food-for-all-dc/csv-one-line-client-database_w_referral.json"
    
    # Run the analysis
    analyze_referral_entities(json_file_path)
    
    # Run the missing case manager analysis
    analyze_missing_case_manager_info(json_file_path)
    
    # Uncomment the line below to see detailed information for each client with referral entity
    # get_referral_entity_details(json_file_path, show_details=True)
    
    print("\nAnalysis complete!")
