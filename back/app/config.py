import os
from dotenv import load_dotenv

load_dotenv()

CONNECT_STRING = os.environ.get('CONNECT_STRING', '')
ALLOWED_ORIGIN = os.environ.get('ALLOWED_ORIGIN', 'http://localhost:5173')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'bikeflow-admin')
LOCAL_ADMIN_NAME = os.environ.get('LOCAL_ADMIN_NAME', 'Jeremy')
LOCAL_ADMIN_EMAIL = os.environ.get('LOCAL_ADMIN_EMAIL', 'jeremy@bikeflow.local')
LOCAL_ADMIN_PASSWORD = os.environ.get('LOCAL_ADMIN_PASSWORD', 'JeremyBike26!')
