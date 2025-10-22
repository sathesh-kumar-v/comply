from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional, Any, Dict
import json
import secrets
import pyotp
import qrcode
import io
import base64
from urllib.parse import urlencode, urlparse

from database import get_db
from models import User, UserRole, PasswordResetToken, MFAMethod, PermissionLevel
from schemas import (
    UserCreate, UserLogin, Token, UserResponse, TokenData,
    PasswordResetRequest, PasswordResetConfirm, MFASetupRequest,
    MFASetupResponse, MFAVerifyRequest, MFALoginRequest, MFAStatusResponse,
    GoogleOAuthRequest, UserUpdate, UserProfileUpdate, PasswordChangeRequest
)
from email_service import email_service
import os
import httpx
from fastapi.responses import RedirectResponse
try:
    from google.oauth2 import id_token as google_id_token
    from google.auth.transport import requests as google_requests
except ModuleNotFoundError as exc:  # pragma: no cover - depends on optional dependency
    google_id_token = None  # type: ignore[assignment]
    google_requests = None  # type: ignore[assignment]
    _GOOGLE_IMPORT_ERROR = exc
else:
    _GOOGLE_IMPORT_ERROR = None

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-this-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Configuration helpers -----------------------------------------------------
router = APIRouter()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")


def _derive_default_redirect_uri() -> Optional[str]:
    """Infer a Google redirect URI when it is not explicitly configured.

    The local development workflow commonly relies on the Next.js proxy which
    means developers rarely set ``GOOGLE_REDIRECT_URI``.  Previously this caused
    the OAuth flow to abort with a server error because the backend considered
    the configuration incomplete.  By deriving a sensible default we preserve
    the strict validation for production (where an explicit value should be
    provided) while keeping the developer experience smooth.
    """

    explicit_redirect = os.getenv("GOOGLE_REDIRECT_URI")
    if explicit_redirect:
        return explicit_redirect.rstrip("/")

    backend_base = os.getenv("BACKEND_BASE_URL")
    if backend_base:
        backend_base = backend_base.strip().rstrip("/")
        if backend_base:
            if not backend_base.startswith("http"):
                backend_base = f"http://{backend_base.lstrip('/')}"

            parsed = urlparse(backend_base)
            path = (parsed.path or "").rstrip("/")
            if path.startswith("/api"):
                return f"{backend_base}/auth/oauth/google/callback"

            return f"{backend_base}/api/auth/oauth/google/callback"

    api_base = os.getenv("API_BASE_URL") or os.getenv("SERVICE_BASE_URL")
    if api_base:
        api_base = api_base.strip().rstrip("/")
        if api_base.startswith("http"):
            parsed = urlparse(api_base)
            path = (parsed.path or "").rstrip("/")
            if path.startswith("/api"):
                return f"{api_base}/auth/oauth/google/callback"

            return f"{api_base}/api/auth/oauth/google/callback"

    frontend_base = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")

    if any(token in frontend_base for token in {"localhost", "127.0.0.1"}):
        # Fall back to the conventional local FastAPI port when running locally.
        return "http://localhost:8000/api/auth/oauth/google/callback"

    # Unable to infer a safe default.
    return None


GOOGLE_REDIRECT_URI = _derive_default_redirect_uri()
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:3000")
GOOGLE_OAUTH_SUCCESS_PATH = os.getenv("GOOGLE_OAUTH_SUCCESS_PATH", "/auth/oauth/google/callback")
GOOGLE_OAUTH_SCOPES = os.getenv("GOOGLE_OAUTH_SCOPES", "openid email profile")
GOOGLE_OAUTH_PROMPT = os.getenv("GOOGLE_OAUTH_PROMPT")

try:
    OAUTH_STATE_TTL_SECONDS = int(os.getenv("GOOGLE_OAUTH_STATE_TTL", "600"))
except ValueError:
    OAUTH_STATE_TTL_SECONDS = 600

_oauth_state_store: Dict[str, Dict[str, Any]] = {}


def _cleanup_expired_oauth_states() -> None:
    """Remove expired OAuth state entries from the in-memory store."""

    if not _oauth_state_store:
        return

    now = datetime.utcnow()
    expired_states = [
        state
        for state, data in _oauth_state_store.items()
        if now - data.get("created_at", now) > timedelta(seconds=OAUTH_STATE_TTL_SECONDS)
    ]
    for state in expired_states:
        _oauth_state_store.pop(state, None)


def _store_oauth_state(state: str, *, redirect_to: Optional[str] = None) -> None:
    """Persist OAuth state with optional redirect information."""

    _cleanup_expired_oauth_states()
    _oauth_state_store[state] = {
        "created_at": datetime.utcnow(),
        "redirect_to": redirect_to,
    }


def _pop_oauth_state(state: str) -> Optional[Dict[str, Any]]:
    """Retrieve and remove OAuth state if it is still valid."""

    data = _oauth_state_store.pop(state, None)
    if not data:
        return None

    if datetime.utcnow() - data.get("created_at", datetime.utcnow()) > timedelta(seconds=OAUTH_STATE_TTL_SECONDS):
        return None

    return data


def _normalize_redirect_path(redirect_to: Optional[str]) -> Optional[str]:
    """Ensure redirect destinations remain within the frontend application."""

    if not redirect_to:
        return None

    redirect_to = redirect_to.strip()
    if not redirect_to:
        return None

    if redirect_to.startswith("http://") or redirect_to.startswith("https://"):
        # Prevent open redirects to external sites
        return None

    if redirect_to.startswith("//"):
        return None

    if not redirect_to.startswith("/"):
        redirect_to = f"/{redirect_to}"

    return redirect_to


def _build_frontend_redirect(*, token: Optional[str] = None, error: Optional[str] = None, redirect_to: Optional[str] = None) -> str:
    base_url = FRONTEND_BASE_URL.rstrip("/")
    success_path = GOOGLE_OAUTH_SUCCESS_PATH or "/auth/oauth/google/callback"
    if not success_path.startswith("/"):
        success_path = f"/{success_path}"

    params = {}
    if token:
        params["token"] = token
    if error:
        params["error"] = error
    if redirect_to:
        params["redirect"] = redirect_to

    query = urlencode(params)
    return f"{base_url}{success_path}{'?' + query if query else ''}"


def _ensure_google_oauth_configured(require_secret: bool = True) -> None:
    if not GOOGLE_CLIENT_ID or not GOOGLE_REDIRECT_URI:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth is not configured",
        )
    if require_secret and not GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth client secret is not configured",
        )


def _verify_google_id_token(id_token: str) -> Dict[str, Any]:
    """Validate a Google ID token and return the decoded payload."""

    if _GOOGLE_IMPORT_ERROR is not None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Google authentication support is not available. "
                "Install the 'google-auth' dependency to enable it."
            ),
        ) from _GOOGLE_IMPORT_ERROR

    _ensure_google_oauth_configured(require_secret=False)

    try:
        request = google_requests.Request()  # type: ignore[union-attr]
        return google_id_token.verify_oauth2_token(  # type: ignore[union-attr]
            id_token, request, GOOGLE_CLIENT_ID
        )
    except ValueError as exc:  # pragma: no cover - depends on external token
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Google ID token",
        ) from exc


def _generate_unique_username(db: Session, base_username: str) -> str:
    candidate = base_username
    suffix = 1
    while get_user_by_username(db, candidate):
        candidate = f"{base_username}{suffix}"
        suffix += 1
    return candidate


def _get_or_create_google_user(
    db: Session,
    *,
    email: str,
    given_name: Optional[str],
    family_name: Optional[str],
    email_verified: bool,
    picture: Optional[str] = None,
) -> User:
    email = email.lower()
    user = get_user_by_email(db, email)

    if not user:
        username_base = email.split("@")[0]
        username_base = username_base.replace("+", ".")
        username_candidate = _generate_unique_username(db, username_base)

        default_first = given_name or username_base.split(".")[0].capitalize() or "User"
        domain_part = email.split("@")[1]
        default_last = family_name or domain_part.split(".")[0].capitalize()

        user = User(
            email=email,
            username=username_candidate,
            first_name=default_first,
            last_name=default_last,
            hashed_password=get_password_hash(secrets.token_urlsafe(32)),
            role=UserRole.EMPLOYEE,
            permission_level=ROLE_PERMISSION_DEFAULT.get(UserRole.EMPLOYEE, PermissionLevel.VIEW_ONLY),
            is_active=True,
            is_verified=email_verified,
        )
        if picture:
            user.avatar_url = picture

        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    updated = False

    if email_verified and not user.is_verified:
        user.is_verified = True
        updated = True

    if given_name and given_name != user.first_name:
        user.first_name = given_name
        updated = True

    if family_name and family_name != user.last_name:
        user.last_name = family_name
        updated = True

    if picture and not user.avatar_url:
        user.avatar_url = picture
        updated = True

    if updated:
        db.commit()
        db.refresh(user)

    return user


def _issue_token_for_user(db: Session, user: User) -> Token:
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is disabled")

    user.permission_level = ROLE_PERMISSION_DEFAULT.get(user.role, PermissionLevel.VIEW_ONLY)
    user.last_login = datetime.utcnow()
    db.commit()
    db.refresh(user)

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires,
    )

    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user),
    )


async def _exchange_code_for_tokens(code: str) -> Dict[str, Any]:
    _ensure_google_oauth_configured(require_secret=True)

    token_endpoint = "https://oauth2.googleapis.com/token"
    payload = {
        "code": code,
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(token_endpoint, data=payload)
    except httpx.HTTPError as exc:  # pragma: no cover - network errors
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Unable to contact Google OAuth services",
        ) from exc

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to exchange authorization code",
        )

    return response.json()


def _normalize_role_name(role: str) -> str:
    """Normalize role labels to a consistent snake_case key."""
    return role.strip().lower().replace("-", "_").replace(" ", "_")


_ROLE_ALIAS_MAP: dict[str, set[UserRole]] = {}

for _role in UserRole:
    for _alias in {
        _role.value,
        _role.name,
        _role.name.lower(),
        _role.value.replace("_", " "),
        _role.name.replace("_", " "),
    }:
        _ROLE_ALIAS_MAP.setdefault(_normalize_role_name(_alias), set()).add(_role)

for _alias, _roles in {
    "reader": {
        UserRole.VIEWER,
        UserRole.EMPLOYEE,
        UserRole.AUDITOR,
        UserRole.MANAGER,
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
    },
    "editor": {
        UserRole.MANAGER,
        UserRole.AUDITOR,
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
    },
    "reviewer": {
        UserRole.AUDITOR,
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
    },
    "admin": {
        UserRole.ADMIN,
        UserRole.SUPER_ADMIN,
    },
    "super admin": {
        UserRole.SUPER_ADMIN,
    },
}.items():
    _ROLE_ALIAS_MAP.setdefault(_normalize_role_name(_alias), set()).update(_roles)

ROLE_PERMISSION_DEFAULT = {
    UserRole.SUPER_ADMIN: PermissionLevel.SUPER_ADMIN,
    UserRole.ADMIN: PermissionLevel.ADMIN_ACCESS,
    UserRole.MANAGER: PermissionLevel.EDIT_ACCESS,
    UserRole.AUDITOR: PermissionLevel.EDIT_ACCESS,
    UserRole.EMPLOYEE: PermissionLevel.VIEW_ONLY,
    UserRole.VIEWER: PermissionLevel.VIEW_ONLY,
}


def _create_user_record(db: Session, user_data: UserCreate) -> User:
    """Persist a new user record applying defaults and hashing the password."""

    if get_user_by_email(db, user_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    if get_user_by_username(db, user_data.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )

    hashed_password = get_password_hash(user_data.password)
    permission_level = (
        user_data.permission_level
        if getattr(user_data, "permission_level", None)
        else ROLE_PERMISSION_DEFAULT.get(user_data.role, PermissionLevel.VIEW_ONLY)
    )

    db_user = User(
        email=user_data.email,
        username=user_data.username,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        hashed_password=hashed_password,
        role=user_data.role,
        permission_level=permission_level,
        phone=user_data.phone,
        position=user_data.position,
        employee_id=getattr(user_data, "employee_id", None),
        areas_of_responsibility=json.dumps(getattr(user_data, "areas_of_responsibility", [])),
        timezone=getattr(user_data, "timezone", "UTC"),
        notifications_email=getattr(user_data, "notifications_email", True),
        notifications_sms=getattr(user_data, "notifications_sms", False),
        is_active=getattr(user_data, "is_active", True),
    )

    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return db_user

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_user_by_username(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username == username).first()

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()

def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    # Try to find user by username first
    user = get_user_by_username(db, username)
    
    # If not found by username and it looks like an email, try email lookup
    if not user and "@" in username:
        user = get_user_by_email(db, username)
    
    # If user found and password is correct
    if user and verify_password(password, user.hashed_password):
        # Check if account is active
        if not user.is_active:
            return None
        return user
    
    return None

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    
    user = get_user_by_username(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

def require_role(required_roles: list[UserRole]):
    def role_checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions"
            )
        return current_user
    return role_checker


def require_roles(*roles: str):
    """Accepts human friendly role labels and resolves them to system roles."""
    resolved_roles: set[UserRole] = set()

    for role_name in roles:
        if not role_name:
            continue
        normalized = _normalize_role_name(role_name)
        resolved_roles.update(_ROLE_ALIAS_MAP.get(normalized, set()))

    if not resolved_roles:
        resolved_roles = set(UserRole)

    sorted_roles = sorted(resolved_roles, key=lambda role: role.value)
    return require_role(sorted_roles)

def generate_reset_token() -> str:
    """Generate a secure random token for password reset"""
    return secrets.token_urlsafe(32)

def generate_backup_codes(count: int = 8) -> list[str]:
    """Generate backup codes for MFA"""
    return [secrets.token_hex(4).upper() for _ in range(count)]

def verify_totp(secret: str, token: str) -> bool:
    """Verify TOTP code"""
    totp = pyotp.TOTP(secret)
    return totp.verify(token, valid_window=1)

def generate_qr_code(secret: str, user_email: str) -> str:
    """Generate QR code for TOTP setup"""
    totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=user_email,
        issuer_name="Comply-X"
    )
    
    # Generate QR code
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(totp_uri)
    qr.make(fit=True)
    
    # Convert to base64 image
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    # Convert to base64
    img_base64 = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{img_base64}"

@router.post("/register", 
             response_model=UserResponse,
             summary="Register New User",
             description="Create a new user account with the provided information. Email and username must be unique.",
             responses={
                 200: {"description": "User created successfully"},
                 400: {"description": "Email already registered or username already taken"},
             })
async def register(user_data: UserCreate, db: Session = Depends(get_db)):
    db_user = _create_user_record(db, user_data)
    return UserResponse.model_validate(db_user)

@router.post("/login", 
             response_model=Token,
             summary="User Login",
             description="Authenticate user with username and password. Returns JWT access token and user information.",
             responses={
                 200: {"description": "Login successful"},
                 401: {"description": "Incorrect username/password or account disabled"},
             })
async def login(user_credentials: UserLogin, db: Session = Depends(get_db)):
    user = authenticate_user(db, user_credentials.username, user_credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is disabled"
        )
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user)
    )


@router.get(
    "/oauth/google/start",
    include_in_schema=False,
    summary="Begin the Google OAuth login flow",
    description="Redirects the user to Google's OAuth consent screen."
)
async def oauth_google_start(redirect_to: Optional[str] = None):
    _ensure_google_oauth_configured(require_secret=False)

    normalized_redirect = _normalize_redirect_path(redirect_to)
    state = secrets.token_urlsafe(32)
    _store_oauth_state(state, redirect_to=normalized_redirect)

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": GOOGLE_OAUTH_SCOPES,
        "access_type": "offline",
        "include_granted_scopes": "true",
        "state": state,
        "prompt": GOOGLE_OAUTH_PROMPT or "select_account",
    }

    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    return RedirectResponse(auth_url)


@router.get(
    "/oauth/google/callback",
    include_in_schema=False,
    summary="Handle Google OAuth callback",
    description="Exchanges the authorization code for tokens and issues a Comply-X session token."
)
async def oauth_google_callback(
    code: Optional[str] = None,
    state: Optional[str] = None,
    error: Optional[str] = None,
    db: Session = Depends(get_db),
):
    redirect_to: Optional[str] = None
    state_data: Optional[Dict[str, Any]] = None

    if state:
        state_data = _pop_oauth_state(state)
        if state_data:
            redirect_to = _normalize_redirect_path(state_data.get("redirect_to"))

    if error:
        redirect_url = _build_frontend_redirect(error=error, redirect_to=redirect_to)
        return RedirectResponse(redirect_url, status_code=status.HTTP_302_FOUND)

    if not code or not state or not state_data:
        redirect_url = _build_frontend_redirect(
            error="Invalid OAuth response",
            redirect_to=redirect_to,
        )
        return RedirectResponse(redirect_url, status_code=status.HTTP_302_FOUND)

    try:
        token_response = await _exchange_code_for_tokens(code)
    except HTTPException as exc:
        message = exc.detail if isinstance(exc.detail, str) else "Failed to complete Google sign-in"
        redirect_url = _build_frontend_redirect(error=message, redirect_to=redirect_to)
        return RedirectResponse(redirect_url, status_code=status.HTTP_302_FOUND)

    id_token_value = token_response.get("id_token")
    if not id_token_value:
        redirect_url = _build_frontend_redirect(
            error="Google did not return an ID token",
            redirect_to=redirect_to,
        )
        return RedirectResponse(redirect_url, status_code=status.HTTP_302_FOUND)

    try:
        google_profile = _verify_google_id_token(id_token_value)
    except HTTPException as exc:
        message = exc.detail if isinstance(exc.detail, str) else "Invalid Google ID token"
        redirect_url = _build_frontend_redirect(error=message, redirect_to=redirect_to)
        return RedirectResponse(redirect_url, status_code=status.HTTP_302_FOUND)

    email = google_profile.get("email")
    if not email:
        redirect_url = _build_frontend_redirect(
            error="Google account email is unavailable",
            redirect_to=redirect_to,
        )
        return RedirectResponse(redirect_url, status_code=status.HTTP_302_FOUND)

    if not google_profile.get("email_verified", False):
        redirect_url = _build_frontend_redirect(
            error="Google account email is not verified",
            redirect_to=redirect_to,
        )
        return RedirectResponse(redirect_url, status_code=status.HTTP_302_FOUND)

    user = _get_or_create_google_user(
        db,
        email=email,
        given_name=google_profile.get("given_name"),
        family_name=google_profile.get("family_name"),
        email_verified=True,
        picture=google_profile.get("picture"),
    )

    try:
        token = _issue_token_for_user(db, user)
    except HTTPException as exc:
        message = exc.detail if isinstance(exc.detail, str) else "Unable to sign in"
        redirect_url = _build_frontend_redirect(error=message, redirect_to=redirect_to)
        return RedirectResponse(redirect_url, status_code=status.HTTP_302_FOUND)

    redirect_url = _build_frontend_redirect(token=token.access_token, redirect_to=redirect_to)
    return RedirectResponse(redirect_url, status_code=status.HTTP_302_FOUND)


@router.post(
    "/oauth/google",
    response_model=Token,
    summary="Authenticate via Google OAuth",
    description="Create or update a user using Google OAuth profile information."
)
async def oauth_google_login(
    payload: GoogleOAuthRequest,
    db: Session = Depends(get_db)
):
    if not payload.id_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google ID token is required",
        )

    google_profile = _verify_google_id_token(payload.id_token)
    email = google_profile.get("email") or payload.email

    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google account email is required")

    email_verified = bool(google_profile.get("email_verified", False))
    if not email_verified:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google account email is not verified")

    user = _get_or_create_google_user(
        db,
        email=email,
        given_name=google_profile.get("given_name") or payload.given_name,
        family_name=google_profile.get("family_name") or payload.family_name,
        email_verified=email_verified,
        picture=google_profile.get("picture"),
    )

    return _issue_token_for_user(db, user)

@router.get("/me",
            response_model=UserResponse,
            summary="Get Current User",
            description="Get information about the currently authenticated user.",
            responses={
                200: {"description": "Current user information"},
                401: {"description": "Not authenticated"},
            })
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return UserResponse.model_validate(current_user)


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Update Current User",
    description="Update personal profile details for the authenticated user.",
)
async def update_current_user_profile(
    payload: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    update_data = payload.model_dump(exclude_unset=True)

    if "username" in update_data:
        new_username = update_data.pop("username")
        if new_username and new_username != current_user.username:
            existing_user = (
                db.query(User)
                .filter(User.username == new_username, User.id != current_user.id)
                .first()
            )
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already taken",
                )
            current_user.username = new_username

    for field in ["first_name", "last_name", "phone"]:
        if field in update_data:
            value = update_data.pop(field)
            if isinstance(value, str):
                value = value.strip()
            setattr(current_user, field, value)

    # Ignore any unsupported fields gracefully
    update_data.clear()

    current_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)

    return UserResponse.model_validate(current_user)


@router.post(
    "/change-password",
    status_code=status.HTTP_200_OK,
    summary="Change Current User Password",
    description="Allow the authenticated user to update their password after validating the current password.",
)
async def change_password(
    change_request: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(change_request.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    if verify_password(change_request.new_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password",
        )

    current_user.hashed_password = get_password_hash(change_request.new_password)
    current_user.updated_at = datetime.utcnow()

    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return {"message": "Password updated successfully"}

@router.get("/users",
            response_model=list[UserResponse],
            summary="List All Users",
            description="Get a list of all users in the system. Requires Admin or Manager role.",
            responses={
                200: {"description": "List of users"},
                401: {"description": "Not authenticated"},
                403: {"description": "Insufficient permissions"},
            })
async def get_users(
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN])),
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    return [UserResponse.model_validate(user) for user in users]


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create User (Admin)",
    description="Create a new user account. Requires Admin, Manager, or Super Admin role.",
)
async def create_user_admin(
    user_data: UserCreate,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN])),
    db: Session = Depends(get_db),
):
    db_user = _create_user_record(db, user_data)
    return UserResponse.model_validate(db_user)


@router.put(
    "/users/{user_id}",
    response_model=UserResponse,
    summary="Update User",
    description="Update user profile details, role assignments, and permission levels.",
)
async def update_user_details(
    user_id: int,
    payload: UserUpdate,
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.MANAGER, UserRole.SUPER_ADMIN])),
    db: Session = Depends(get_db),
):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    update_data = payload.model_dump(exclude_unset=True)

    if "password" in update_data:
        db_user.hashed_password = get_password_hash(update_data.pop("password"))

    if "role" in update_data:
        db_user.role = update_data.pop("role")
        # If a new role is provided but permission wasn't overridden, align with defaults
        if "permission_level" not in update_data and payload.permission_level is None:
            db_user.permission_level = ROLE_PERMISSION_DEFAULT.get(db_user.role, db_user.permission_level)

    if "permission_level" in update_data:
        db_user.permission_level = update_data.pop("permission_level")

    if "username" in update_data:
        new_username = update_data.pop("username")
        if new_username and new_username != db_user.username:
            existing_user = (
                db.query(User)
                .filter(User.username == new_username, User.id != db_user.id)
                .first()
            )
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already taken",
                )
            db_user.username = new_username

    for field in [
        "first_name",
        "last_name",
        "phone",
        "position",
        "is_active",
        "notifications_email",
        "notifications_sms",
        "timezone",
    ]:
        if field in update_data:
            setattr(db_user, field, update_data.pop(field))

    if update_data:
        # Log or ignore unsupported fields gracefully
        for key in list(update_data.keys()):
            update_data.pop(key)

    db_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_user)

    return UserResponse.model_validate(db_user)

@router.post("/password-reset/request",
             summary="Request Password Reset",
             description="Send password reset email to user")
async def request_password_reset(
    request_data: PasswordResetRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    # Find user by email
    user = get_user_by_email(db, request_data.email)
    if not user:
        # Don't reveal if email exists - security best practice
        return {"message": "If the email exists in our system, a password reset link has been sent"}
    
    # Check if user is active
    if not user.is_active:
        return {"message": "If the email exists in our system, a password reset link has been sent"}
    
    # Generate reset token
    reset_token = generate_reset_token()
    expires_at = datetime.utcnow() + timedelta(hours=1)  # 1 hour expiry
    
    # Save token to database
    db_token = PasswordResetToken(
        user_id=user.id,
        token=reset_token,
        expires_at=expires_at,
        ip_address=request.client.host,
        user_agent=request.headers.get("user-agent")
    )
    db.add(db_token)
    db.commit()
    
    # Send email
    reset_url = os.getenv("FRONTEND_URL", "http://localhost:3000") + "/reset-password"
    await email_service.send_password_reset_email(
        to_email=user.email,
        reset_token=reset_token,
        user_name=f"{user.first_name} {user.last_name}",
        reset_url=reset_url
    )
    
    return {"message": "If the email exists in our system, a password reset link has been sent"}

@router.post("/password-reset/confirm",
             summary="Confirm Password Reset",
             description="Reset password using token from email")
async def confirm_password_reset(
    reset_data: PasswordResetConfirm,
    request: Request,
    db: Session = Depends(get_db)
):
    # Find valid token
    token_record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == reset_data.token,
        PasswordResetToken.is_used == False,
        PasswordResetToken.expires_at > datetime.utcnow()
    ).first()
    
    if not token_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Get user
    user = db.query(User).filter(User.id == token_record.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    # Update password
    user.hashed_password = get_password_hash(reset_data.new_password)
    user.updated_at = datetime.utcnow()
    
    # Mark token as used
    token_record.is_used = True
    token_record.used_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Password has been successfully reset"}

@router.get("/mfa/status",
            response_model=MFAStatusResponse,
            summary="Get MFA Status",
            description="Check if MFA is enabled for current user")
async def get_mfa_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    methods = db.query(MFAMethod).filter(
        MFAMethod.user_id == current_user.id,
        MFAMethod.is_enabled == True
    ).all()
    
    return MFAStatusResponse(
        enabled=len(methods) > 0,
        methods=[method.method_type for method in methods]
    )

@router.post("/mfa/setup",
             response_model=MFASetupResponse,
             summary="Setup MFA",
             description="Initialize MFA setup with QR code and backup codes")
async def setup_mfa(
    setup_data: MFASetupRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify password
    if not verify_password(setup_data.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password"
        )
    
    # Check if TOTP already enabled
    existing_totp = db.query(MFAMethod).filter(
        MFAMethod.user_id == current_user.id,
        MFAMethod.method_type == "totp",
        MFAMethod.is_enabled == True
    ).first()
    
    if existing_totp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is already enabled"
        )
    
    # Generate secret and backup codes
    secret = pyotp.random_base32()
    backup_codes = generate_backup_codes()
    qr_code = generate_qr_code(secret, current_user.email)
    
    return MFASetupResponse(
        secret=secret,
        qr_code=qr_code,
        backup_codes=backup_codes
    )

@router.post("/mfa/verify",
             summary="Verify and Enable MFA",
             description="Verify MFA setup and enable it")
async def verify_and_enable_mfa(
    verify_data: MFAVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify TOTP code
    if not verify_totp(verify_data.secret, verify_data.verification_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code"
        )
    
    # Disable any existing TOTP methods
    db.query(MFAMethod).filter(
        MFAMethod.user_id == current_user.id,
        MFAMethod.method_type == "totp"
    ).update({"is_enabled": False})
    
    # Save new TOTP method
    totp_method = MFAMethod(
        user_id=current_user.id,
        method_type="totp",
        is_primary=True,
        is_enabled=True,
        secret_key=verify_data.secret,
        backup_codes=json.dumps(verify_data.backup_codes)
    )
    db.add(totp_method)
    
    # Enable MFA for user
    current_user.mfa_enabled = True
    db.commit()
    
    # Send confirmation email
    await email_service.send_mfa_setup_email(
        to_email=current_user.email,
        user_name=f"{current_user.first_name} {current_user.last_name}"
    )
    
    return {"message": "MFA has been successfully enabled"}

@router.post("/mfa/disable",
             summary="Disable MFA",
             description="Disable MFA for current user")
async def disable_mfa(
    password_data: MFASetupRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify password
    if not verify_password(password_data.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid password"
        )
    
    # Disable all MFA methods
    db.query(MFAMethod).filter(
        MFAMethod.user_id == current_user.id
    ).update({"is_enabled": False})
    
    # Disable MFA for user
    current_user.mfa_enabled = False
    db.commit()
    
    return {"message": "MFA has been successfully disabled"}

@router.post("/mfa/login",
             response_model=Token,
             summary="MFA Login",
             description="Login with MFA verification")
async def mfa_login(
    login_data: MFALoginRequest,
    db: Session = Depends(get_db)
):
    # Authenticate user with username/password
    user = authenticate_user(db, login_data.username, login_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Account is disabled"
        )
    
    # Check if MFA is enabled
    if not user.mfa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MFA is not enabled for this account"
        )
    
    # Get TOTP method
    totp_method = db.query(MFAMethod).filter(
        MFAMethod.user_id == user.id,
        MFAMethod.method_type == "totp",
        MFAMethod.is_enabled == True
    ).first()
    
    if not totp_method:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="MFA configuration error"
        )
    
    # Verify MFA code (try TOTP first, then backup codes)
    mfa_valid = False
    
    # Try TOTP
    if verify_totp(totp_method.secret_key, login_data.mfa_code):
        mfa_valid = True
    else:
        # Try backup codes
        if totp_method.backup_codes:
            backup_codes = json.loads(totp_method.backup_codes)
            if login_data.mfa_code.upper() in backup_codes:
                mfa_valid = True
                # Remove used backup code
                backup_codes.remove(login_data.mfa_code.upper())
                totp_method.backup_codes = json.dumps(backup_codes)
                db.commit()
    
    if not mfa_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid MFA code"
        )
    
    # Update last login
    user.last_login = datetime.utcnow()
    totp_method.last_used_at = datetime.utcnow()
    db.commit()
    
    # Create token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user)
    )