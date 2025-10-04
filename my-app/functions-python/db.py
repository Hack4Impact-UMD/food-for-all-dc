# from datetime import datetime, timedelta
# from zoneinfo import ZoneInfo
# import firebase_admin
# from firebase_admin import credentials
# from firebase_admin import firestore
# from firebase_functions import scheduler_fn, https_fn

# from testing import test_clustering
# import time
# import os

# # Initialize Firebase Admin SDK only once (same pattern as main.py)
# try:
#     firebase_admin.initialize_app()
# except ValueError:
#     # App already initialized, ignore the error
#     pass

# db = firestore.client()

# # Update deliveries each morning
# # @scheduler_fn.on_schedule(schedule="every day 00:00")
# @https_fn.on_request()
