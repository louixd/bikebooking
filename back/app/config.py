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
ENTRA_TENANT_ID = os.environ.get('ENTRA_TENANT_ID') or os.environ.get('AZURE_TENANT_ID')
ENTRA_CLIENT_ID = os.environ.get('ENTRA_CLIENT_ID') or os.environ.get('AZURE_CLIENT_ID')
ENTRA_ADMIN_EMAILS = os.environ.get('ENTRA_ADMIN_EMAILS', '')
ENTRA_ADMIN_OBJECT_IDS = os.environ.get('ENTRA_ADMIN_OBJECT_IDS', '')
