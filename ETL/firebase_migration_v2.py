CLIENT_COLLECTION_NAME = "temp-profile2"
REFERRAL_COLLECTION_NAME = "temp-referral"

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
import re
# For spreadsheet ZIP fallback
import pandas as pd

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

def geocode_address_openmap(address, city, state, zip_code):
	parts = [address, city, state, str(zip_code)]
	full_addr = ', '.join([str(p) for p in parts if p and str(p).strip() and str(p).lower() != 'nan'])
	url = f"https://nominatim.openstreetmap.org/search?format=json&q={requests.utils.quote(full_addr)}"
	max_retries = 3
	for attempt in range(1, max_retries + 1):
		try:
			resp = requests.get(url, headers={"User-Agent": "food-for-all-dc-etl-script"}, timeout=10)
			if resp.status_code == 200:
				data = resp.json()
				if data:
					loc = data[0]
					return [float(loc['lat']), float(loc['lon'])]
				else:
					logger.warning(f"[WARN] No coordinates found for address: {full_addr}")
					return None
			else:
				logger.warning(f"[WARN] Nominatim API error: {resp.status_code}")
		except Exception as e:
			logger.warning(f"[WARN] Nominatim geocoding failed for {full_addr} (attempt {attempt}): {e}")
			if attempt < max_retries:
				time.sleep(2 ** attempt)  # Exponential backoff
			else:
				logger.warning(f"[WARN] Max retries reached for geocoding address: {full_addr}")
	# After 3 failed attempts, just return None (ignore failure, do not block insert)
	return None

# --- Begin full code from firebase_migration.py ---
from urllib.parse import urlencode

@dataclass
class MigrationStats:
	total_records: int = 0
	successful_imports: int = 0
	failed_imports: int = 0
	skipped_records: int = 0
	skipped_inactive: int = 0
	skipped_duplicates: int = 0
	start_time: datetime = None
	end_time: datetime = None
	unmapped_frequencies: Dict[str, int] = None  # Track frequency values that don't map
	failed_active_records: list = None  # Track active records that failed to insert
	failed_geocoding_records: list = None  # Track records that failed geocoding
	def __post_init__(self):
		if self.unmapped_frequencies is None:
			self.unmapped_frequencies = {}
		if self.failed_active_records is None:
			self.failed_active_records = []
		if self.failed_geocoding_records is None:
			self.failed_geocoding_records = []


# --- Begin FirestoreMigration and helpers (adapted for OpenMap geocoding) ---
from urllib.parse import urlencode

class FirestoreMigration:
	def load_referral_form(self, form_path: str) -> list:
		import pandas as pd
		df = pd.read_excel(form_path, sheet_name='Form Responses 1', dtype=str)
		records = df.to_dict(orient='records')
		return records

	def __init__(self, service_account_path: str, project_id: str, collection_name: str = CLIENT_COLLECTION_NAME):
		# ...existing code...
		self.service_account_path = service_account_path
		self.project_id = project_id
		self.collection_name = collection_name
		# ...existing code for Firestore client...

		# Load spreadsheet ZIP mapping (ADDRESS -> ZIP)
		self.address_zip_map = {}
		try:
			excel_path = os.path.join("ETL", "FFA_CLIENT_DATABASE.xlsx")
			sheet_name = "Current Deliveries"
			df = pd.read_excel(excel_path, sheet_name=sheet_name, dtype=str)
			for idx, row in df.iterrows():
				addr = str(row.get('ADDRESS', '')).strip().lower()
				zip_val = str(row.get('ZIP', '')).strip()
				if addr and zip_val:
					self.address_zip_map[addr] = zip_val
		except Exception as e:
			logger.warning(f"Could not load spreadsheet ZIP mapping: {e}")

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
		if "periodic" in freq or "perodic" in freq:
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
			if not hasattr(self.stats, 'unmapped_frequencies'):
				self.stats.unmapped_frequencies = {}
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
			# Anything not mapped above is now 'Periodic'
			return "Periodic"
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
	def match_referral_form(self, first_name, last_name, address, referral_form_records):
		for rec in referral_form_records:
			if (str(rec.get('First Name', '')).strip().lower() == str(first_name).strip().lower() and
				str(rec.get('Last Name', '')).strip().lower() == str(last_name).strip().lower() and
				str(rec.get('Address', '')).strip().lower() == str(address).strip().lower()):
				return rec
		return None

	def parse_referral_entity(self, row: Dict[str, Any], referral_form_records=None) -> Dict[str, Any]:
		import re
		# Helper to normalize missing/NaN-like strings to empty
		def _clean(value: Any) -> str:
			if value is None:
				return ""
			text = str(value).strip()
			if not text or text.lower() == "nan":
				return ""
			return text
		ORG_KEYWORDS = [
			'inc', 'llc', 'community', 'center', 'clinic', 'hospital', 'foundation', 'services', 'university', 'school', 'church', 'ministry', 'group', 'association', 'org', 'organization', 'society', 'network', 'coalition', 'committee', 'trust', 'partners', 'partnership', 'agency', 'plan', 'health', 'medical', 'development', 'corporation', 'corp', 'company', 'council', 'board', 'office', 'program', 'initiative', 'project', 'team', 'club', 'district', 'authority', 'commission', 'federation', 'institute', 'alliance', 'enterprise', 'cooperative', 'co-op', 'gov', 'government', 'dc', 'department', 'division', 'unit', 'branch', 'chapter', 'league', 'union', 'coordinator', 'caseworker', 'case manager', 'social worker', 'advocate', 'counselor', 'therapist', 'volunteer', 'director', 'manager', 'lead', 'assistant', 'liaison', 'consultant', 'specialist', 'worker', 'coach', 'advisor', 'supervisor', 'psh', 'rapid re-housing', 'rrh', 'housing', 'food', 'bank', 'clinic', 'center', 'program', 'services', 'office', 'department', 'division', 'unit', 'team', 'project', 'initiative', 'agency', 'foundation', 'society', 'network', 'coalition', 'committee', 'trust', 'partners', 'partnership', 'association', 'enterprise', 'cooperative', 'co-op', 'gov', 'government', 'dc', 'school', 'church', 'ministry', 'club', 'district', 'authority', 'commission', 'federation', 'institute', 'alliance', 'company', 'corporation', 'corp', 'council', 'board', 'office', 'program', 'initiative', 'project', 'team', 'club', 'district', 'authority', 'commission', 'federation', 'institute', 'alliance', 'enterprise', 'cooperative', 'co-op', 'gov', 'government', 'dc', 'department', 'division', 'unit', 'branch', 'chapter', 'league', 'union'
		]
		PERSON_KEYWORDS = [
			'mr', 'ms', 'mrs', 'miss', 'dr', 'prof', 'caseworker', 'case manager', 'social worker', 'advocate', 'counselor', 'therapist', 'volunteer', 'director', 'manager', 'lead', 'assistant', 'liaison', 'consultant', 'specialist', 'worker', 'coach', 'advisor', 'supervisor', 'psh', 'rapid re-housing', 'rrh', 'housing', 'food', 'bank', 'clinic', 'center', 'program', 'services', 'office', 'department', 'division', 'unit', 'team', 'project', 'initiative', 'agency', 'foundation', 'society', 'network', 'coalition', 'committee', 'trust', 'partners', 'partnership', 'association', 'enterprise', 'cooperative', 'co-op', 'gov', 'government', 'dc', 'school', 'church', 'ministry', 'club', 'district', 'authority', 'commission', 'federation', 'institute', 'alliance', 'company', 'corporation', 'corp', 'council', 'board', 'office', 'program', 'initiative', 'project', 'team', 'club', 'district', 'authority', 'commission', 'federation', 'institute', 'alliance', 'enterprise', 'cooperative', 'co-op', 'gov', 'government', 'dc', 'department', 'division', 'unit', 'branch', 'chapter', 'league', 'union'
		]
		def looks_like_org(text):
			t = text.lower()
			return any(k in t for k in ORG_KEYWORDS)
		def looks_like_person(text):
			# Heuristic: 2-3 words, each capitalized, no org keywords, or starts with person keyword
			words = text.split()
			if any(text.lower().startswith(pk) for pk in PERSON_KEYWORDS):
				return True
			return 1 < len(words) <= 3 and all(w and w[0].isupper() for w in words) and not looks_like_org(text)
		def split_ambiguous(text):
			# Try to split by comma, dash, or ' at '
			for sep in [',', '-', ' at ', ' from ', ' of ', ' for ']:
				if sep in text:
					parts = [p.strip() for p in text.split(sep, 1)]
					if len(parts) == 2:
						return parts[0], parts[1]
			return text, ''
		# Try to match referral form first (support both JSON and Excel headers)
		first_name = _clean(row.get('FIRST_database') or row.get('FIRST', ''))
		last_name = _clean(row.get('LAST_database') or row.get('LAST', ''))
		address = _clean(row.get('ADDRESS', ''))
		matched = None
		if referral_form_records:
			matched = self.match_referral_form(first_name, last_name, address, referral_form_records)
		if matched:
			# Prefer the canonical referral-form headers from ETL/README.md,
			# but fall back to older names if present so we work with either export.
			name_val = (
				matched.get('Name (case manager)')
				or matched.get('Name')
				or ""
			)
			org_val = (
				matched.get('Agency name')
				or matched.get('Organization')
				or ""
			)
			phone_val = (
				matched.get('Phone contact')
				or matched.get('Phone')
				or ""
			)
			email_val = (
				matched.get('Email Address')
				or matched.get('Email')
				or ""
			)
			return {
				"id": "",  # Will be set after referral insert
				"name": str(name_val).strip(),
				"organization": str(org_val).strip(),
				"phone": str(phone_val).strip(),
				"email": str(email_val).strip(),
			}
		# ...existing code...
		# Normalize internet-based sources
		INTERNET_KEYWORDS = [
			'internet search', 'online search', 'facebook', 'website', 'web', 'google', 'internet', 'online', 'www', 'search'
		]
		# Check explicit fields first (clean NaN/missing values)
		case_manager_name = _clean(row.get("Name_case_manager", ""))
		agency_name = _clean(row.get("Agency_name", ""))
		case_manager_phone = _clean(row.get("Phone_contact_case_manager", ""))
		case_manager_email = _clean(row.get("EmailAddress", ""))
		# Heuristic correction for swapped/misplaced fields
		if case_manager_name and not agency_name:
			if looks_like_org(case_manager_name):
				agency_name, case_manager_name = case_manager_name, ""
			elif not looks_like_person(case_manager_name):
				# Try to split ambiguous value
				n, o = split_ambiguous(case_manager_name)
				if looks_like_org(o):
					case_manager_name, agency_name = n, o
		if agency_name and not case_manager_name:
			if looks_like_person(agency_name):
				case_manager_name, agency_name = agency_name, ""
			elif not looks_like_org(agency_name):
				n, o = split_ambiguous(agency_name)
				if looks_like_person(n):
					case_manager_name, agency_name = n, o
		# If both are filled but one is org and one is person, assign accordingly
		if case_manager_name and agency_name:
			if looks_like_org(case_manager_name) and looks_like_person(agency_name):
				case_manager_name, agency_name = agency_name, case_manager_name
		# If only one field is filled and it looks like org, treat as org
		if not case_manager_name and agency_name and looks_like_org(agency_name):
			case_manager_name = ""
		if not agency_name and case_manager_name and looks_like_org(case_manager_name):
			agency_name, case_manager_name = case_manager_name, ""
		# Fallback: if both are blank, assign ambiguous value to org
		if not case_manager_name and not agency_name:
			ambiguous = str(row.get("Name_case_manager", "")).strip() or str(row.get("Agency_name", "")).strip()
			if ambiguous:
				n, o = split_ambiguous(ambiguous)
				if looks_like_person(n):
					case_manager_name, agency_name = n, o
				else:
					case_manager_name, agency_name = "", ambiguous
		# Normalize if matches internet keywords
		combined = f"{case_manager_name} {agency_name}".lower()
		if any(k in combined for k in INTERNET_KEYWORDS):
			return {"id": "", "name": "", "organization": "Internet Search", "phone": "", "email": ""}
		if case_manager_name or agency_name:
			return {
				"id": "",
				"name": case_manager_name,
				"organization": agency_name,
				"phone": case_manager_phone,
				"email": case_manager_email
			}
		# Otherwise, try to parse from REFERRAL_ENTITY field (or Excel 'REFERRAL ENTITY')
		referral_entity = _clean(row.get("REFERRAL_ENTITY") or row.get("REFERRAL ENTITY", ""))
		if referral_entity:
			# Normalize if matches internet keywords
			if any(k in referral_entity.lower() for k in INTERNET_KEYWORDS):
				return {"id": "", "name": "", "organization": "Internet Search", "phone": "", "email": ""}
		# ...existing code...
		"""
		Parse referral entity information from various fields
		"""
		# Check for explicit fields first (clean NaN/missing values)
		case_manager_name = _clean(row.get("Name_case_manager", ""))
		agency_name = _clean(row.get("Agency_name", ""))
		case_manager_phone = _clean(row.get("Phone_contact_case_manager", ""))
		case_manager_email = _clean(row.get("EmailAddress", ""))
        
		# If we have explicit case manager info, use it
		if case_manager_name or agency_name:
			return {
				"id": "",
				"name": case_manager_name,
				"organization": agency_name,
				"phone": case_manager_phone,
				"email": case_manager_email
			}
        
		# Otherwise, try to parse from REFERRAL_ENTITY field (supports both JSON and Excel headers)
		referral_entity = _clean(row.get("REFERRAL_ENTITY") or row.get("REFERRAL ENTITY", ""))
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
					parts = [str(part).strip() for part in str(referral_entity).split(',')]
					if len(parts) >= 2:
						potential_name = parts[0]
						potential_org = ', '.join(parts[1:])
						# Heuristic: swap if needed
						if looks_like_org(potential_name) and looks_like_person(potential_org):
							potential_name, potential_org = potential_org, potential_name
						if looks_like_person(potential_name):
							result["name"] = potential_name
							result["organization"] = potential_org
						else:
							result["organization"] = potential_name
							if len(parts) > 1:
								result["name"] = potential_org
				# Strategy 2: Look for patterns like "Name - Organization" or "Name: Organization"
				elif any(sep in referral_entity for sep in [' - ', ': ', ' : ', ' at ', ' from ', ' of ', ' for ']):
					for sep in [' - ', ': ', ' : ', ' at ', ' from ', ' of ', ' for ']:
						if sep in referral_entity:
							parts = referral_entity.split(sep, 1)
							if len(parts) == 2:
								left, right = str(parts[0]).strip(), str(parts[1]).strip()
								# Heuristic: swap if needed
								if looks_like_org(left) and looks_like_person(right):
									left, right = right, left
								if looks_like_person(left):
									result["name"] = left
									result["organization"] = right
								else:
									result["organization"] = left
									result["name"] = right
							break
				# Strategy 3: Look for organization indicators and split accordingly
				elif any(org_word in referral_entity.lower() for org_word in ORG_KEYWORDS):
					org_indicators = ORG_KEYWORDS
					words = referral_entity.split()
					for i, word in enumerate(words):
						if any(ind in word.lower() for ind in org_indicators):
							if i > 0:
								result["name"] = ' '.join(words[:i]).strip()
								result["organization"] = ' '.join(words[i:]).strip()
							else:
								result["organization"] = referral_entity
							break
				# Strategy 4: If no clear pattern, check if it looks like a person's name
				else:
					words = referral_entity.split()
					if 2 <= len(words) <= 3 and all(word[0].isupper() for word in words if word):
						result["name"] = referral_entity
					else:
						result["organization"] = referral_entity
            
			# Clean up results
			for key in ["name", "organization"]:
				if result[key]:
					# Remove extra whitespace and clean up
					result[key] = ' '.join(result[key].split())
					# Remove trailing commas
					result[key] = str(result[key]).rstrip(',').strip()
            
			return result
        
		return None
	def import_batch(self, records: List[Dict[str, Any]], batch_num: int = None, total_batches: int = None) -> tuple:
		batch = self.db.batch()
		successful = 0
		failed = 0
		skipped = 0
		total_records = len(records)
		today_str = datetime.now().strftime("%Y%m%d")
		failed_inserts_path = os.path.join("ETL", "failed_inserts", "failed_inserts.json")
		failed_client_inserts_path = os.path.join("ETL", "failed_inserts", f"client-profile-failed-insert-{today_str}.txt")
		failed_referral_inserts_path = os.path.join("ETL", "failed_inserts", f"referral-fail-insert-{today_str}.txt")
		failed_inserts = []
		failed_client_inserts = []
		failed_referral_inserts = []
		# For deduplication of referrals in this batch: map dedup_key -> referral_doc_id
		referral_cache = {}
		# Debug: show how many records are in this batch
		print(f"[DEBUG] import_batch: received {total_records} records")
		# Load existing failed inserts if file exists
		if os.path.exists(failed_inserts_path):
			try:
				with open(failed_inserts_path, "r", encoding="utf-8") as f:
					failed_inserts = json.load(f)
			except Exception:
				failed_inserts = []
		skipped_inactive = 0
		skipped_duplicate = 0
		# Load referral form records once
		referral_form_records = self.load_referral_form('ETL/Client Referral Form v.3_20_24 (Responses).xlsx')
		for idx, row in enumerate(records, 1):
			try:
				# Only load active profiles
				active_status = row.get("Active", "")
				if str(active_status).lower() not in ['yes', 'true', '1', 'active']:
					first_name = row.get("FIRST_database") or row.get("FIRST", "")
					last_name = row.get("LAST_database") or row.get("LAST", "")
					skipped_inactive += 1
					print(f"[DEBUG] Skipped inactive: {first_name} {last_name}")
					skipped += 1
					continue
				# Debug: print record ID, type, and status
				doc_id_raw = row.get("ID", "")
				print(f"[DEBUG] Processing record {idx}/{total_records} ID={doc_id_raw} (type={type(doc_id_raw).__name__}) Active={row.get('Active', '')}")
				# Pass referral_form_records to transform_record
				transformed = self.transform_record(row, referral_form_records=referral_form_records)
				if transformed is None:
					first_name = row.get("FIRST_database") or row.get("FIRST", "")
					last_name = row.get("LAST_database") or row.get("LAST", "")
					if self.is_duplicate(first_name, last_name):
						skipped_duplicate += 1
						print(f"[DEBUG] Skipped duplicate: {first_name} {last_name}")
					else:
						print(f"[DEBUG] Skipped for other reason: {first_name} {last_name}")
					skipped += 1
					continue
				# Print the transformed record for the first 3 successful records
				if successful < 3:
					print(f"[DEBUG] Transformed record for ID={doc_id_raw}: {json.dumps(transformed, default=str)[:1000]}")
				# Allow ID to be string or integer, convert to string for Firestore
				if isinstance(doc_id_raw, int):
					doc_id = str(doc_id_raw)
				elif isinstance(doc_id_raw, float):
					if doc_id_raw.is_integer():
						doc_id = str(int(doc_id_raw))
					else:
						doc_id = str(doc_id_raw)
				elif doc_id_raw is None:
					doc_id = ""
				else:
					doc_id = str(doc_id_raw).strip()
				if not doc_id:
					logger.warning(f"No ID found for record: {row.get('FIRST', '')} {row.get('LAST', '')}")
					failed += 1
					failed_inserts.append(row)
					failed_client_inserts.append(row)
					continue
				# --- Insert referral/case worker into referral collection ---
				referral = None
				# Build a local referral dict from the client's referralEntity plus
				# the helper contact fields. This avoids storing phone/email on
				# client-profile2.referralEntity while still letting us populate
				# the referral collection with contact info.
				if "referralEntity" in transformed and transformed["referralEntity"]:
					base_ref = transformed["referralEntity"] or {}
					referral = {
						"name": str(base_ref.get("name", "")),
						"organization": str(base_ref.get("organization", "")),
						"email": str(transformed.get("_referralContactEmail", "")),
						"phone": str(transformed.get("_referralContactPhone", "")),
					}
				# Only insert if we have at least a name or organization
				if referral and (referral.get("name") or referral.get("organization")):
					# Normalize internet-based referrals for deduplication
					is_internet = str(referral.get("organization", "")).strip().lower() == "internet search"
					if is_internet:
						# Try to find existing 'Internet Search' referral
						existing = list(self.db.collection(REFERRAL_COLLECTION_NAME)
							.where("organization", "==", "Internet Search").limit(1).stream())
						if existing:
							referral_doc_id = existing[0].id
							logger.info(f"Reusing existing 'Internet Search' referral with id {referral_doc_id}")
							if "referralEntity" in transformed and transformed["referralEntity"] is not None:
								transformed["referralEntity"]["id"] = referral_doc_id
						else:
							# Insert new 'Internet Search' referral
							referral_doc = {
								"name": "",
								"organization": "Internet Search",
								"email": "",
								"phone": ""
							}
							try:
								ref_ref = self.db.collection(REFERRAL_COLLECTION_NAME).document()
								ref_ref.set(referral_doc)
								referral_doc_id = ref_ref.id
								logger.info(f"Inserted new 'Internet Search' referral with id {referral_doc_id}")
								if "referralEntity" in transformed and transformed["referralEntity"] is not None:
									transformed["referralEntity"]["id"] = referral_doc_id
							except Exception as e:
								logger.error(f"Failed to insert 'Internet Search' referral: {e}")
								failed_referral_inserts.append({"referral": referral_doc, "error": str(e)})
					else:
						# Deduplicate by email if present, else by name+organization, and also check for swapped/combined fields
						dedup_key = None
						if referral.get("email"):
							dedup_key = str(referral["email"]).strip().lower()
						else:
							name = str(referral.get("name", "")).strip().lower()
							org = str(referral.get("organization", "")).strip().lower()
							dedup_key = (name, org)
						# If we've already resolved this referral in this batch, just reuse the cached id
						if dedup_key and dedup_key in referral_cache:
							referral_doc_id = referral_cache[dedup_key]
							if "referralEntity" in transformed and transformed["referralEntity"] is not None:
								transformed["referralEntity"]["id"] = referral_doc_id
						else:
							# Check Firestore for existing referral with same or swapped fields
							found_existing = False
							if referral.get("email"):
								query = self.db.collection(REFERRAL_COLLECTION_NAME).where("email", "==", referral["email"])
								existing = list(query.limit(1).stream())
								if existing:
									referral_doc_id = existing[0].id
									logger.info(f"Reusing existing referral by email with id {referral_doc_id}")
									if "referralEntity" in transformed and transformed["referralEntity"] is not None:
										transformed["referralEntity"]["id"] = referral_doc_id
									referral_cache[dedup_key] = referral_doc_id
									found_existing = True
							if not found_existing:
								# Try name/org match, and swapped
								query = self.db.collection(REFERRAL_COLLECTION_NAME).where("name", "==", referral.get("name", "")).where("organization", "==", referral.get("organization", ""))
								existing = list(query.limit(1).stream())
								if not existing and referral.get("name") and referral.get("organization"):
									# Try swapped
									query_swapped = self.db.collection(REFERRAL_COLLECTION_NAME).where("name", "==", referral.get("organization", "")).where("organization", "==", referral.get("name", ""))
									existing = list(query_swapped.limit(1).stream())
								if not existing and referral.get("name") and not referral.get("organization"):
									# Try org in name field
									query_org = self.db.collection(REFERRAL_COLLECTION_NAME).where("organization", "==", referral.get("name", ""))
									existing = list(query_org.limit(1).stream())
								if existing:
									referral_doc_id = existing[0].id
									logger.info(f"Reusing existing referral by name/org with id {referral_doc_id}")
									if "referralEntity" in transformed and transformed["referralEntity"] is not None:
										transformed["referralEntity"]["id"] = referral_doc_id
									referral_cache[dedup_key] = referral_doc_id
									found_existing = True
							if not found_existing:
								# Build referral doc
								phone_from_referral = str(referral.get("phone", "") or "").strip()
								referral_doc = {
									"name": str(referral.get("name", "")),
									"organization": str(referral.get("organization", "")),
									"email": str(referral.get("email", "")),
									# Prefer phone from the matched referralEntity (client referral form),
									# but fall back to phone fields on the main client row if missing.
									"phone": phone_from_referral,
								}
								# If we still don't have a phone, try to get it from row if available
								phone_fields = [
									row.get("Phone_contact_case_manager", ""),
									row.get("Phone contact (case manager) - Please enter phone in (xxx) xxx-xxxx format", "")
								]
								for pf in phone_fields:
									if not referral_doc["phone"] and pf and str(pf).strip():
										referral_doc["phone"] = str(pf).strip()
										break
								# Insert into referral collection and get the doc ID
								try:
									ref_ref = self.db.collection(REFERRAL_COLLECTION_NAME).document()
									ref_ref.set(referral_doc)
									referral_doc_id = ref_ref.id
									logger.info(f"Inserted referral into {REFERRAL_COLLECTION_NAME}: {referral_doc} with id {referral_doc_id}")
									# Set the referralEntity.id in the client profile
									if "referralEntity" in transformed and transformed["referralEntity"] is not None:
										transformed["referralEntity"]["id"] = referral_doc_id
									referral_cache[dedup_key] = referral_doc_id
								except Exception as e:
									logger.error(f"Failed to insert referral into {REFERRAL_COLLECTION_NAME}: {e}")
									failed_referral_inserts.append({"referral": referral_doc, "error": str(e)})
				# Now insert the client profile, after referralEntity.id is set.
				# Drop helper contact fields so they are not stored on
				# client-profile2 documents.
				transformed.pop("_referralContactPhone", None)
				transformed.pop("_referralContactEmail", None)
				doc_ref = self.db.collection(self.collection_name).document(doc_id)
				batch.set(doc_ref, transformed)
				successful += 1
				# Progress log for each record
				if batch_num is not None and total_batches is not None:
					logger.info(f"[Batch {batch_num}/{total_batches}] Record {idx}/{total_records} processed (ID: {doc_id})")
				else:
					logger.info(f"[Batch] Record {idx}/{total_records} processed (ID: {doc_id})")
			except Exception as e:
				logger.error(f"Failed to prepare record {row.get('ID', 'Unknown')}: {str(e)}")
				failed += 1
				failed_inserts.append(row)
				failed_client_inserts.append({"client": row, "error": str(e)})
				# If record is active, add to failed_active_records
				active_status = row.get("Active", "")
				if str(active_status).lower() in ['yes', 'true', '1', 'active']:
					self.stats.failed_active_records.append(row)
		print(f"[DEBUG] Batch summary: {skipped_inactive} skipped as inactive, {skipped_duplicate} skipped as duplicate, {skipped} total skipped, {successful} to insert")
		try:
			if successful > 0:
				batch.commit()
				logger.info(f"Successfully committed batch with {successful} records")
			self.stats.skipped_records += skipped
			self.stats.skipped_inactive += skipped_inactive
			self.stats.skipped_duplicates += skipped_duplicate
		except Exception as e:
			logger.error(f"Batch commit failed: {str(e)}")
			failed += successful
			# Add all records in this batch to failed_inserts
			for row in records:
				failed_inserts.append(row)
			successful = 0
		# Write failed_inserts to file (overwrite with all failures so far)
		try:
			with open(failed_inserts_path, "w", encoding="utf-8") as f:
				json.dump(failed_inserts, f, ensure_ascii=False, indent=2)
		except Exception as e:
			logger.error(f"Failed to write failed_inserts.json: {e}")
		# Write failed client inserts to text file
		try:
			with open(failed_client_inserts_path, "w", encoding="utf-8") as f:
				for entry in failed_client_inserts:
					f.write(json.dumps(entry, ensure_ascii=False) + "\n")
		except Exception as e:
			logger.error(f"Failed to write client-profile-failed-insert.txt: {e}")
		# Write failed referral inserts to text file
		try:
			with open(failed_referral_inserts_path, "w", encoding="utf-8") as f:
				for entry in failed_referral_inserts:
					f.write(json.dumps(entry, ensure_ascii=False) + "\n")
		except Exception as e:
			logger.error(f"Failed to write referral-fail-insert.txt: {e}")
		return successful, failed

	def save_case_workers_to_firestore(self) -> None:
		if not self.case_workers:
			logger.info("No case workers to save")
			return
		collection_name = "new_case_workers"
		successful = 0
		failed = 0
		try:
			for key, case_worker in self.case_workers.items():
				try:
					doc_ref = self.db.collection(collection_name).document()
					doc_ref.set(case_worker)
					successful += 1
					logger.debug(f"Saved case worker: {key} -> {doc_ref.id}")
				except Exception as e:
					logger.error(f"Failed to save case worker {key}: {e}")
					failed += 1
			logger.info(f"Case workers saved: {successful} successful, {failed} failed")
		except Exception as e:
			logger.error(f"Error accessing Firestore collection {collection_name}: {e}")
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
		self.processed_names = set()
		self.case_workers = {}
		self.stats = MigrationStats()
		self.stats.start_time = datetime.utcnow()
		logger.info(f"Starting migration from {file_path}")
		logger.info(f"Batch size: {batch_size}, Max workers: {max_workers}")
		if limit:
			logger.info(f"Limiting to first {limit} records")
		if records_override is not None:
			records = records_override
		else:
			records = self.load_json_file(file_path)
		if not records:
			logger.error("No records to migrate")
			return self.stats
		if limit and limit > 0:
			records = records[:limit]
			logger.info(f"Limited to {len(records)} records")
		self.stats.total_records = len(records)
		batches = [records[i:i + batch_size] for i in range(0, len(records), batch_size)]
		logger.info(f"Split {len(records)} records into {len(batches)} batches")
		# Process all batches as originally designed
		if use_threading and max_workers > 1:
			with ThreadPoolExecutor(max_workers=max_workers) as executor:
				futures = {executor.submit(self.import_batch, batch, i + 1, len(batches)): i for i, batch in enumerate(batches)}
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
			for i, batch in enumerate(batches):
				try:
					successful, failed = self.import_batch(batch, i + 1, len(batches))
					self.stats.successful_imports += successful
					self.stats.failed_imports += failed
					logger.info(f"Batch {i + 1}/{len(batches)} completed: "
							  f"{successful} successful, {failed} failed")
					time.sleep(0.1)
				except Exception as e:
					logger.error(f"Batch {i} failed: {str(e)}")
					self.stats.failed_imports += len(batch)
		self.stats.end_time = datetime.utcnow()
		duration = self.stats.end_time - self.stats.start_time
		logger.info("Migration completed!")
		logger.info(f"Total time: {duration}")
		logger.info(f"Total records: {self.stats.total_records}")
		logger.info(f"Successful (inserted): {self.stats.successful_imports}")
		logger.info(f"Skipped inactive: {self.stats.skipped_inactive}")
		logger.info(f"Skipped duplicates: {self.stats.skipped_duplicates}")
		logger.info(f"Failed (errors): {self.stats.failed_imports}")
		# Compute success rate only over records we actually intended to insert
		effective_total = self.stats.total_records - self.stats.skipped_inactive - self.stats.skipped_duplicates
		if effective_total > 0:
			logger.info(f"Effective records (excluding inactive/duplicates): {effective_total}")
			logger.info(f"Success rate (of intended inserts): {(self.stats.successful_imports/effective_total)*100:.2f}%")
		else:
			logger.info("Effective records (excluding inactive/duplicates): 0")
			logger.info("Success rate (of intended inserts): N/A (no records to insert)")
		# logger.info(f"Saving {len(self.case_workers)} unique case workers...")
		# self.save_case_workers_to_firestore()
		if self.failed_geocoding_clients:
			logger.info("Clients missing coordinates:")
			for cid in self.failed_geocoding_clients:
				logger.info(f"  - {cid}")
		return self.stats
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
	def __init__(self, service_account_path: str, project_id: str, collection_name: str = "clients"):
		self.project_id = project_id
		self.collection_name = collection_name
		self.stats = MigrationStats()
		self.processed_names = set()
		self.case_workers = {}
		self.failed_geocoding_clients: List[str] = []
		# Initialize Firebase Admin SDK
		if not firebase_admin._apps:
			cred = credentials.Certificate(service_account_path)
			firebase_admin.initialize_app(cred)
		self.db = firestore.client()
		logger.info(f"Initialized Firestore client for project: {project_id}")

	# --- All helper methods from firebase_migration.py except geocoding and address parsing ---
	# ...
	# (For brevity, only transform_record is shown here, but in the actual patch, all methods from FirestoreMigration are included)

	def parse_dietary_restrictions(self, diet_type_str: str, restrictions_str: str) -> Dict[str, Any]:
		"""
		Python port of the JavaScript parseDietaryRestrictions function
		Only puts unrecognized items in 'otherText', not in 'foodAllergens'.
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

		other_parts = []
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
				other_parts.append(part)

		# Do not populate 'other' or 'otherText' fields
		restrictions["other"] = False
		restrictions["otherText"] = ""
		return restrictions

	def is_duplicate(self, first_name: str, last_name: str) -> bool:
		"""
		Check if a client with the same name (case-insensitive) has already been processed
		within this migration run. This is independent of what is already in Firestore.
		"""
		if not first_name or not last_name:
			return False
		full_name = f"{first_name.strip().lower()} {last_name.strip().lower()}"
		if not hasattr(self, 'processed_names'):
			self.processed_names = set()
		if full_name in self.processed_names:
			return True
		self.processed_names.add(full_name)
		return False

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
		# Do not populate 'other' or 'otherText' fields
		ailments["other"] = False
		ailments["otherText"] = ""
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
		# Do not populate 'other' or 'otherText' fields
		disability["other"] = False
		disability["otherText"] = ""
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
		exclude_keywords = ['diabetes', 'hypertension', 'heart', 'kidney', 'cancer', 'disability', 'wheelchair', 'mental', 'depression', 'anxiety']
		lower_text = combined_text.lower()
		medical_count = sum(1 for keyword in exclude_keywords if keyword in lower_text)
		if medical_count > 2:
			words = combined_text.split()
			filtered_words = [word for word in words if not any(keyword in word.lower() for keyword in exclude_keywords)]
			return ' '.join(filtered_words)[:200]
		return combined_text[:200]
	def transform_record(self, row: Dict[str, Any], referral_form_records=None) -> Dict[str, Any]:
		"""
		Transform a record, using OpenMap geocoding and stripping apartment/unit info from address.
		Also tracks geocoding failures for retry.
		Supports both legacy JSON field names and direct Excel column names.
		"""
		# Name fields: prefer canonical *_database fields, fall back to raw Excel headers
		# Ensure missing/NaN values become empty strings instead of causing .strip() errors.
		def _clean_name(value: Any) -> str:
			if value is None:
				return ""
			text = str(value).strip()
			if not text or text.lower() == "nan":
				return ""
			return text
		first_name_raw = row.get("FIRST_database") or row.get("FIRST", "")
		last_name_raw = row.get("LAST_database") or row.get("LAST", "")
		first_name = _clean_name(first_name_raw)
		last_name = _clean_name(last_name_raw)
		if first_name:
			first_name = first_name.capitalize()
		if last_name:
			last_name = last_name.capitalize()

		# No longer skip inactive records; load all
		active_status = row.get("Active", "")
		doc_id = str(row.get("ID", "")).strip()

		if self.is_duplicate(first_name, last_name):
			logger.warning(f"Skipping duplicate: {first_name} {last_name}")
			return None

		phone = ""
		email = ""
		if row.get("Phone"):
			phone_str = str(row["Phone"])
			if '@' in phone_str:
				email = phone_str
			else:
				phone = phone_str

		# Dietary restrictions and vulnerability fields: handle both JSON and Excel headers
		restrictions = self.parse_dietary_restrictions(
			row.get("Diettype") or row.get("Diet type"),
			row.get("DietaryRestrictions")
			or row.get("Dietary Restrictions")
			or row.get("Dietary Preferences")
		)
		main_vulnerability = row.get("MainVulnerability") or row.get("Client's Main Vulnerability\n(Classification)", "")
		eligibility_database = row.get("Eligibility_database") or row.get("Eligibility", "")
		unnamed_29 = row.get("Unnamed: 29", "")
		further_information = row.get("further_information", "")
		physical_ailments = self.parse_physical_ailments(main_vulnerability, eligibility_database, unnamed_29, further_information)
		physical_disability = self.parse_physical_disability(main_vulnerability, eligibility_database, unnamed_29, further_information)
		mental_health_conditions = self.parse_mental_health_conditions(main_vulnerability, eligibility_database, unnamed_29, further_information)
		life_challenges = self.parse_life_challenges(main_vulnerability, eligibility_database, unnamed_29, further_information)
		referral_entity = self.parse_referral_entity(row, referral_form_records=referral_form_records)
		referral_phone = referral_entity.get("phone", "") if referral_entity else ""
		referral_email = referral_entity.get("email", "") if referral_entity else ""
		notes = row.get("Notes", "")
		if not phone and referral_entity and referral_entity.get("phone"):
			phone = referral_entity["phone"]
			if notes:
				notes += " | Phone number is from Referral Entity."
			else:
				notes = "Phone number is from Referral Entity."
		active_status = row.get("Active", "")
		has_recent_deliveries = self.check_recent_deliveries(row)
		if has_recent_deliveries and str(active_status).lower() in ['no', 'false', '0', 'inactive']:
			active_status = "Yes"
			if notes:
				notes += " | Status changed to Active due to recent deliveries."
			else:
				notes = "Status changed to Active due to recent deliveries."
		tags = []
		tefap_flag = row.get("TEFAP_FY25") or row.get("TEFAP FY25")
		if tefap_flag and str(tefap_flag).lower() != 'false':
			tags.append("TEFAPOnFile")
		if str(active_status).lower() in ['yes', 'true', '1', 'active', 'y']:
			tags.append("Active")
		delivery_freq = self.parse_frequency(row.get("Frequency", ""))
		# Household composition: support Adults_database/kids or Excel '# Adults'/'# kids'
		adults_raw = row.get("Adults_database") if row.get("Adults_database") is not None else row.get("# Adults")
		children_raw = row.get("kids") if row.get("kids") is not None else row.get("# kids")
		try:
			adults_count = int(adults_raw) if adults_raw not in (None, "") else 0
		except Exception:
			adults_count = 0
		try:
			children_count = int(children_raw) if children_raw not in (None, "") else 0
		except Exception:
			children_count = 0
		vuln_fields = [
			row.get("MainVulnerability", ""),
			row.get("Eligibility_database", ""),
			row.get("Notes", ""),
			row.get("Eligibility_referral", ""),
			row.get("further_information", ""),
			row.get("STATUS_WITH_DATE", "")
		]
		if any("senior" in str(val).lower() for val in vuln_fields) and adults_count > 0:
			age_group_data = {
				"adults": max(0, adults_count - 1),
				"seniors": 1,
				"headOfHousehold": "Senior"
			}
		else:
			age_group_data = self.parse_age_group(row.get("age_group", ""), adults_count)
		total_household = age_group_data["adults"] + age_group_data["seniors"] + children_count


		# --- Address handling: use main address up to quadrant for geocoding ---
		raw_address = row.get("ADDRESS", "")
		quadrant_match = re.search(r"\b(NE|NW|SE|SW)\b", raw_address)
		if quadrant_match:
			end_idx = quadrant_match.end()
			address_for_coords = raw_address[:end_idx].strip()
		else:
			address_for_coords = re.split(r",|\b(?:Apt|Apartment|Unit|#)\b", raw_address, flags=re.IGNORECASE)[0].strip()
		address = address_for_coords
		city = row.get("City", "")
		state = row.get("State", "")
		zip_in_data = row.get("ZIPcode", "") or row.get("ZIP", "")
		if any(q in address_for_coords for q in [" NE", " NW", " SE", " SW"]):
			city = "Washington"
			state = "DC"

		# --- Use API for ZIP first, fallback to Zipcode from JSON ---
		zip_in_data = row.get("ZIPcode", "") or row.get("ZIP", "")
		zip_code = ""
		# Step 1: Try geocoding with ZIP if present, else without ZIP
		coordinates = geocode_address_openmap(address_for_coords, city, state, zip_in_data)
		# Step 2: If API/geocoding fails to provide ZIP, fallback to Zipcode from JSON
		if coordinates:
			# Try to extract ZIP from geocoding result
			import requests
			base_addr = ', '.join([str(x) for x in [address_for_coords, city, state] if x and str(x).strip() and str(x).lower() != 'nan'])
			url = f"https://nominatim.openstreetmap.org/search?format=json&q={requests.utils.quote(base_addr)}"
			try:
				resp = requests.get(url, headers={"User-Agent": "food-for-all-dc-etl-script"}, timeout=10)
				if resp.status_code == 200:
					data = resp.json()
					if data:
						loc = data[0]
						zip_code = loc.get('postcode', '')
			except Exception as e:
				logger.warning(f"Could not extract ZIP from OpenMap geocoding API: {e}")
		# Fallback: If zip_code is still empty, use Zipcode from JSON
		if not zip_code:
			zip_code = str(row.get("Zipcode", ""))

		end_date = row.get("EndDate", "")
		if not end_date or not str(end_date).strip():
			end_date = "12/31/2026"
		else:
			# If end_date is present but not a valid date, set to 12/31/2026
			try:
				_ = datetime.strptime(end_date.strip(), "%m/%d/%Y")
			except Exception:
				end_date = "12/31/2026"

		# Map recurrence using the same logic as parse_frequency
		def map_recurrence(frequency_str):
			if not frequency_str or not str(frequency_str).strip():
				return "None"
			freq = str(frequency_str).strip().lower()
			emergency_keywords = ["emergency", "only", "two time only", "one time only", "emerg"]
			if any(keyword in freq for keyword in emergency_keywords):
				return "Periodic"
			if "periodic" in freq or "perodic" in freq:
				return "Periodic"
			if freq in ["none", "n/a", "na", ""]:
				return "None"
			elif "weekly" in freq or "week" in freq or freq in ["1x/week", "once/week", "every week"]:
				return "Weekly"
			elif any(pattern in freq for pattern in ["2x", "twice", "two", "bi-monthly", "bimonthly", "2/month", "2x/month", "twice/month"]):
				return "2x-Monthly"
			elif any(pattern in freq for pattern in ["monthly", "month", "1x/month", "once/month", "every month", "one/month"]):
				return "Monthly"
			else:
				return "Periodic"

		recurrence = map_recurrence(row.get("Frequency", ""))

		# Parse dates for activeStatus logic
		from datetime import datetime, date
		DEFAULT_START_DATE_STR = "11/15/2025"
		DEFAULT_START_DATE = datetime.strptime(DEFAULT_START_DATE_STR, "%m/%d/%Y").date()
		today = datetime.utcnow().date()
		# Get start and end dates as strings.
		# Support legacy JSON fields and direct Excel headers ("Start Date").
		raw_start = None
		if row.get("StartDate_database") and str(row.get("StartDate_database")).strip():
			raw_start = row.get("StartDate_database")
		elif row.get("StartDate_referral") and str(row.get("StartDate_referral")).strip():
			raw_start = row.get("StartDate_referral")
		elif row.get("Start Date") and str(row.get("Start Date")).strip():
			raw_start = row.get("Start Date")
		# Parse startDate from raw value (datetime, date, or string)
		start_date = None
		if raw_start is not None and str(raw_start).strip():
			if isinstance(raw_start, datetime):
				start_date = raw_start.date()
			elif isinstance(raw_start, date):
				start_date = raw_start
			else:
				text = str(raw_start).strip()
				for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%Y-%m-%d %H:%M:%S"):
					try:
						start_date = datetime.strptime(text, fmt).date()
						break
					except Exception:
						continue
		# If still no start_date, default it
		if not start_date:
			start_date = DEFAULT_START_DATE
		start_date_str = start_date.strftime("%m/%d/%Y")
		end_date_str = end_date
		# Parse endDate
		try:
			end_date_dt = datetime.strptime(str(end_date_str).strip(), "%m/%d/%Y").date() if end_date_str and str(end_date_str).strip() else None
		except Exception:
			end_date_dt = None
		# Determine activeStatus
		if start_date and end_date_dt:
			active_status_bool = start_date <= today <= end_date_dt
		elif start_date and not end_date_dt:
			active_status_bool = start_date <= today
		elif not start_date and end_date_dt:
			active_status_bool = today <= end_date_dt
		else:
			active_status_bool = False
		client_profile = {
			"uid": str(row.get("ID", "")),
			"firstName": first_name,
			"lastName": last_name,
			"streetName": address,
			"address": address,
			"address2": row.get("APT", ""),
			"zipCode": zip_code,
			"city": city,
			"state": state,
			"quadrant": row.get("Quadrant_database", ""),
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
			"ward": row.get("Ward", ""),
			"coordinates": coordinates,
			"seniors": age_group_data["seniors"],
			"headOfHousehold": age_group_data["headOfHousehold"],
			"startDate": start_date_str,
			"endDate": end_date,
			"recurrence": recurrence,
			"tefapCert": row.get("TEFAP_FY25", ""),
			"notesTimestamp": None,
			"deliveryInstructionsTimestamp": None,
			"lifeChallengesTimestamp": None,
			"lifestyleGoalsTimestamp": None,
			"lifestyleGoals": "",
			"activeStatus": active_status_bool
		}
		# Always attach a referralEntity. If we parsed a real one with a
		# name or organization, use it; otherwise, default to the canonical
		# "None" referral so every client has a consistent value.
		if referral_entity and (referral_entity.get("name") or referral_entity.get("organization")):
			client_profile["referralEntity"] = {
				"id": referral_entity.get("id", ""),
				"name": referral_entity.get("name", ""),
				"organization": referral_entity.get("organization", ""),
			}
		else:
			client_profile["referralEntity"] = {
				"id": "",
				"name": "None",
				"organization": "None"
			}
		# Stash referral contact info in helper fields so import_batch can
		# build referral docs with phone/email without persisting those
		# fields on the client-profile2 referralEntity itself.
		client_profile["_referralContactPhone"] = referral_phone
		client_profile["_referralContactEmail"] = referral_email
		return client_profile

# --- End FirestoreMigration ---

def main():
	SERVICE_ACCOUNT_PATH = os.path.join("ETL", "food-for-all-dc-caf23-firebase-adminsdk-fbsvc-4e77c7873e.json")
	PROJECT_ID = "food-for-all-dc-caf23"
	COLLECTION_NAME = CLIENT_COLLECTION_NAME
	INPUT_FILE_PATH = "ETL/csv-one-line-client-database_w_referral.json"
	EXCEL_FILE_PATH = os.path.join("ETL", "FFA_CLIENT_DATABASE.xlsx")
	EXCEL_SHEET_NAME = "Current Deliveries"

	# Ensure Firebase Admin SDK is initialized before any Firestore operations
	if not firebase_admin._apps:
		cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)
		firebase_admin.initialize_app(cred)

	# Removed test insert record to avoid writing a persistent test document during migration

	migration = FirestoreMigration(
		service_account_path=SERVICE_ACCOUNT_PATH,
		project_id=PROJECT_ID,
		collection_name=COLLECTION_NAME
	)

	# Load the original input file for migration
	input_records = migration.load_json_file(INPUT_FILE_PATH)
	if not input_records:
		print(f"No records found in {INPUT_FILE_PATH}. Attempting to load from Excel instead...")
		try:
			import pandas as pd
			if not os.path.exists(EXCEL_FILE_PATH):
				print(f"Excel file not found at {EXCEL_FILE_PATH}. Exiting.")
				return
			df = pd.read_excel(EXCEL_FILE_PATH, sheet_name=EXCEL_SHEET_NAME, dtype=object)
			# Ensure we only keep rows with a non-empty stable ID column,
			# since the migration code requires an ID to use as the Firestore document id.
			if "ID" not in df.columns:
				# Try to derive ID from a known identifier column such as 'Client ID'
				if "Client ID" in df.columns:
					print("Excel sheet is missing 'ID' column but has 'Client ID'; using 'Client ID' as ID.")
					df["ID"] = df["Client ID"]
				else:
					print(f"Excel sheet '{EXCEL_SHEET_NAME}' does not contain an 'ID' or 'Client ID' column. Exiting to avoid creating clients without stable IDs.")
					return
			# Drop rows where ID is NaN or blank after stripping
			df["ID"] = df["ID"].astype(str)
			df = df[df["ID"].str.strip() != ""]
			input_records = df.to_dict(orient='records')
			if not input_records:
				print(f"No records with a valid ID loaded from Excel file {EXCEL_FILE_PATH} (sheet '{EXCEL_SHEET_NAME}'). Exiting.")
				return
			print(f"Loaded {len(input_records)} records for migration from Excel file {EXCEL_FILE_PATH} (sheet '{EXCEL_SHEET_NAME}') with non-empty IDs")
		except Exception as e:
			print(f"Failed to load records from Excel file {EXCEL_FILE_PATH}: {e}")
			return
	else:
		print(f"Loaded {len(input_records)} records for migration from {INPUT_FILE_PATH}")

	# Forced insert for debugging removed: only transformed records will be inserted

	# Run full migration over all loaded records
	stats = migration.migrate_data(
		file_path=None,
		batch_size=250,
		max_workers=1,
		use_threading=False,
		limit=None,
		records_override=input_records
	)

	# --- Write failure files with timestamp and update latest ---
	timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')

	# Write failed_active_records
	if hasattr(stats, 'failed_active_records') and stats.failed_active_records:
		# Ensure all keys are strings and values are JSON-serializable
		def _make_json_safe_list(records: list) -> list:
			"""Convert any non-JSON-serializable keys/values to strings for logging."""
			safe_list = []
			for rec in records:
				if isinstance(rec, dict):
					clean = {}
					for k, v in rec.items():
						key_str = str(k)
						if isinstance(v, (str, int, float, bool)) or v is None:
							clean[key_str] = v
						else:
							clean[key_str] = str(v)
					safe_list.append(clean)
				else:
					safe_list.append(str(rec))
			return safe_list

		failed_active_safe = _make_json_safe_list(stats.failed_active_records)
		# Store failed active records inside the ETL/failed_active_records folder
		base_dir = os.path.join('ETL', 'failed_active_records')
		os.makedirs(base_dir, exist_ok=True)
		fname = os.path.join(base_dir, f'failed_active_records_{timestamp}.json')
		with open(fname, 'w', encoding='utf-8') as f:
			json.dump(failed_active_safe, f, ensure_ascii=False, indent=2)
		# Also update the latest file for next retry
		latest_path = os.path.join(base_dir, 'failed_active_records.json')
		with open(latest_path, 'w', encoding='utf-8') as f:
			json.dump(failed_active_safe, f, ensure_ascii=False, indent=2)
		print(
			f"Wrote {len(stats.failed_active_records)} active records that failed to insert to "
			f"{fname} and {latest_path}"
		)
	else:
		print("No active records failed to insert.")

	# Write failed_geocoding_records
	if hasattr(stats, 'failed_geocoding_records') and stats.failed_geocoding_records:
		failed_geocoding_safe = _make_json_safe_list(stats.failed_geocoding_records)
		fname = f'failed_geocoding_records_{timestamp}.json'
		with open(fname, 'w', encoding='utf-8') as f:
			json.dump(failed_geocoding_safe, f, ensure_ascii=False, indent=2)
		# Also update the latest file for next retry
		with open('failed_geocoding_records.json', 'w', encoding='utf-8') as f:
			json.dump(failed_geocoding_safe, f, ensure_ascii=False, indent=2)
		print(f"Wrote {len(stats.failed_geocoding_records)} active records that failed geocoding to {fname} and failed_geocoding_records.json")
	else:
		print("No active records failed geocoding.")

	print(f"Migration completed: {stats.successful_imports}/{stats.total_records} successful")
	print(f"Case workers collected: {len(migration.case_workers)}")
	if stats.unmapped_frequencies:
		print("\n⚠️  Unmapped frequency values found:")
		for freq, count in sorted(stats.unmapped_frequencies.items(), key=lambda x: x[1], reverse=True):
			print(f"  '{freq}': {count} occurrences")
		print("\nPlease review these values and update the frequency parser if needed.")
	else:
		print("✅ All frequency values were successfully mapped.")

if __name__ == "__main__":
	main()
