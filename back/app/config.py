import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get('DATABASE_URL', '')
DEFAULT_ALLOWED_ORIGINS = 'http://localhost:5173,https://bikebooking-akyr.onrender.com'
ALLOWED_ORIGINS = ','.join(filter(None, [
	DEFAULT_ALLOWED_ORIGINS,
	os.environ.get('ALLOWED_ORIGIN', ''),
	os.environ.get('ALLOWED_ORIGINS', ''),
]))
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'bikeflow-admin')
LOCAL_ADMIN_NAME = os.environ.get('LOCAL_ADMIN_NAME', 'Jeremy')
LOCAL_ADMIN_EMAIL = os.environ.get('LOCAL_ADMIN_EMAIL', 'jeremy@bikeflow.local')
LOCAL_ADMIN_PASSWORD = os.environ.get('LOCAL_ADMIN_PASSWORD', 'JeremyBike26!')
