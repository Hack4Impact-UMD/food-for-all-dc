import unittest
from types import SimpleNamespace
from unittest.mock import Mock

import main


class FakeAuth:
    class UserNotFoundError(Exception):
        pass

    def __init__(self):
        self.created_user = SimpleNamespace(uid="created-uid")
        self.create_user = Mock(return_value=self.created_user)
        self.delete_user = Mock()


class UserSynchronizationTests(unittest.TestCase):
    def setUp(self):
        self.db = Mock()
        self.user_doc = self.db.collection.return_value.document.return_value
        self.user_data = {
            "name": "Test User",
            "email": "test@example.com",
            "password": "test-password",
            "phone": "(202) 555-0100",
            "role": "Client Intake",
        }

    def test_create_user_writes_matching_firestore_document(self):
        auth_client = FakeAuth()

        uid = main._create_user_records(self.db, self.user_data, auth_client)

        self.assertEqual(uid, "created-uid")
        auth_client.create_user.assert_called_once_with(
            email="test@example.com",
            password="test-password",
            display_name="Test User",
        )
        self.db.collection.assert_called_with("users")
        self.db.collection.return_value.document.assert_called_with("created-uid")
        self.user_doc.set.assert_called_once_with({
            "name": "Test User",
            "email": "test@example.com",
            "phone": "(202) 555-0100",
            "role": "Client Intake",
        })
        auth_client.delete_user.assert_not_called()

    def test_create_user_rolls_back_auth_when_firestore_write_fails(self):
        auth_client = FakeAuth()
        self.user_doc.set.side_effect = RuntimeError("Firestore unavailable")

        with self.assertRaisesRegex(RuntimeError, "Firestore unavailable"):
            main._create_user_records(self.db, self.user_data, auth_client)

        auth_client.delete_user.assert_called_once_with("created-uid")

    def test_delete_removes_firestore_when_auth_user_is_already_missing(self):
        auth_client = FakeAuth()
        auth_client.delete_user.side_effect = auth_client.UserNotFoundError()

        result = main._delete_user_records(self.db, "stale-uid", auth_client)

        self.assertEqual(result, {"authDeleted": False, "firestoreDeleted": True})
        self.user_doc.delete.assert_called_once_with()

    def test_delete_retry_converges_after_firestore_failure(self):
        auth_client = FakeAuth()
        self.user_doc.delete.side_effect = [RuntimeError("Firestore unavailable"), None]

        with self.assertRaisesRegex(RuntimeError, "Firestore unavailable"):
            main._delete_user_records(self.db, "partial-uid", auth_client)

        auth_client.delete_user.side_effect = auth_client.UserNotFoundError()
        result = main._delete_user_records(self.db, "partial-uid", auth_client)

        self.assertEqual(result, {"authDeleted": False, "firestoreDeleted": True})
        self.assertEqual(self.user_doc.delete.call_count, 2)


if __name__ == "__main__":
    unittest.main()
