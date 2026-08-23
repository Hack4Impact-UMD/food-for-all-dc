import unittest
from types import SimpleNamespace
from unittest.mock import Mock, patch

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

    @patch("main.logger.exception")
    def test_create_user_logs_failed_auth_rollback(self, log_exception):
        auth_client = FakeAuth()
        self.user_doc.set.side_effect = RuntimeError("Firestore unavailable")
        auth_client.delete_user.side_effect = RuntimeError("Auth unavailable")

        with self.assertRaisesRegex(RuntimeError, "Firestore unavailable"):
            main._create_user_records(self.db, self.user_data, auth_client)

        log_exception.assert_called_once()

    def test_create_role_policy_matches_existing_manager_form_options(self):
        self.assertTrue(main._can_create_managed_role("admin", "Admin"))
        self.assertTrue(main._can_create_managed_role("manager", "Manager"))
        self.assertTrue(main._can_create_managed_role("manager", "Client Intake"))
        self.assertFalse(main._can_create_managed_role("manager", "Admin"))

    def test_user_management_rejects_unauthenticated_and_unprivileged_callers(self):
        with self.assertRaises(main.https_fn.HttpsError) as unauthenticated:
            main._require_user_manager(SimpleNamespace(auth=None), self.db)
        self.assertEqual(
            unauthenticated.exception.code,
            main.https_fn.FunctionsErrorCode.UNAUTHENTICATED,
        )

        request = SimpleNamespace(
            auth=SimpleNamespace(uid="client-intake-uid", token={"role": "Client Intake"})
        )
        with self.assertRaises(main.https_fn.HttpsError) as unprivileged:
            main._require_user_manager(request, self.db)
        self.assertEqual(
            unprivileged.exception.code,
            main.https_fn.FunctionsErrorCode.PERMISSION_DENIED,
        )

    def test_create_payload_rejects_short_password_and_unknown_role(self):
        for override in ({"password": "short"}, {"role": "Driver"}):
            payload = {**self.user_data, **override}
            with self.subTest(override=override):
                with self.assertRaises(main.https_fn.HttpsError) as invalid:
                    main._validated_create_user_data(payload)
                self.assertEqual(
                    invalid.exception.code,
                    main.https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                )

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

    @patch("main.query_today_client_ids")
    @patch("main.firestore.client")
    def test_run_update_still_serializes_its_summary(self, firestore_client, query_today):
        query_today.return_value = {"client_ids": []}

        result = main.run_update()

        self.assertEqual(result["total_clients"], 0)
        self.assertEqual(result["updated_count"], 0)
        firestore_client.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
