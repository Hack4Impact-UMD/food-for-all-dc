import argparse
import csv
import math
import sys
import tempfile
import types
import unittest
from pathlib import Path

try:
    import requests
except ModuleNotFoundError:
    requests = types.ModuleType("requests")

    class RequestException(Exception):
        pass

    class Timeout(RequestException):
        pass

    requests.Session = object
    requests.exceptions = types.SimpleNamespace(RequestException=RequestException, Timeout=Timeout)
    sys.modules["requests"] = requests

try:
    import firebase_admin  # noqa: F401
except ModuleNotFoundError:
    firebase_admin = types.ModuleType("firebase_admin")
    firebase_admin._apps = {}
    firebase_admin.initialize_app = lambda *_args, **_kwargs: None
    credentials = types.ModuleType("credentials")
    credentials.Certificate = lambda value: value
    firestore = types.ModuleType("firestore")
    firestore.client = lambda: None
    firebase_admin.credentials = credentials
    firebase_admin.firestore = firestore
    sys.modules["firebase_admin"] = firebase_admin
    sys.modules["firebase_admin.credentials"] = credentials
    sys.modules["firebase_admin.firestore"] = firestore

from audit_client_coordinates import (
    CSV_FIELDNAMES,
    escape_csv_cell,
    finite_non_negative_float,
    geocode_full_address,
    write_csv_report,
)


class FailingSession:
    def get(self, *_args, **_kwargs):
        raise requests.exceptions.Timeout("request failed with key=do-not-export")


class AddressAuditTests(unittest.TestCase):
    def test_request_failure_becomes_safe_error_result(self):
        result = geocode_full_address(FailingSession(), "100 Main Street NW", "secret-key")

        self.assertEqual(result["status"], "REQUEST_ERROR")
        self.assertIn("Timeout", result["error"])
        self.assertNotIn("secret-key", result["error"])
        self.assertNotIn("do-not-export", result["error"])

    def test_threshold_must_be_finite_and_non_negative(self):
        self.assertEqual(finite_non_negative_float("0"), 0.0)
        self.assertEqual(finite_non_negative_float("250"), 250.0)
        for value in ("-1", "nan", "inf", "-inf"):
            with self.subTest(value=value):
                with self.assertRaises(argparse.ArgumentTypeError):
                    finite_non_negative_float(value)

    def test_csv_formula_values_are_escaped(self):
        for value in ("=1+1", "+1", "-1", "@SUM(A1)", "  =1+1", "\t=1+1"):
            with self.subTest(value=value):
                self.assertTrue(escape_csv_cell(value).startswith("'"))

        self.assertEqual(escape_csv_cell("normal"), "normal")
        self.assertEqual(escape_csv_cell(12.5), 12.5)
        self.assertTrue(math.isfinite(escape_csv_cell(12.5)))

    def test_empty_audit_still_writes_a_valid_csv(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            csv_path = Path(temp_dir) / "audit.csv"
            write_csv_report(csv_path, [])

            with csv_path.open(newline="", encoding="utf-8") as input_file:
                reader = csv.DictReader(input_file)
                self.assertEqual(reader.fieldnames, CSV_FIELDNAMES)
                self.assertEqual(list(reader), [])


if __name__ == "__main__":
    unittest.main()
