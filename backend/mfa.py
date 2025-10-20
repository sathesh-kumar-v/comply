from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
from models import User, UserDevice, MFAMethod
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
import pyotp
import qrcode
import io
import base64
import secrets
import hashlib
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

router = APIRouter()

# Pydantic models for MFA management

class DeviceRegistrationRequest(BaseModel):
    device_name: str = Field(..., max_length=200)
    device_type: str = Field(..., max_length=50)  # mobile, desktop, tablet
    device_os: Optional[str] = None
    browser: Optional[str] = None

class DeviceResponse(BaseModel):
    id: int
    device_name: str
    device_type: str
    device_id: str
    is_verified: bool
    is_trusted: bool
    is_active: bool
    last_used_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True

class MFAMethodResponse(BaseModel):
    id: int
    method_type: str
    is_primary: bool
    is_enabled: bool
    phone_number: Optional[str] = None
    email_address: Optional[str] = None
    created_at: datetime
    last_used_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class TOTPSetupResponse(BaseModel):
    secret_key: str
    qr_code_url: str
    qr_code_base64: str
    backup_codes: List[str]

class MFAVerificationRequest(BaseModel):
    method_id: int
    verification_code: str

class SMSMFARequest(BaseModel):
    phone_number: str = Field(..., max_length=20)

class EmailMFARequest(BaseModel):
    email_address: str = Field(..., max_length=255)

# Utility functions

def generate_device_id(request: Request, device_info: DeviceRegistrationRequest) -> str:
    """Generate a unique device fingerprint"""
    user_agent = request.headers.get("user-agent", "")
    client_ip = request.client.host if request.client else ""
    
    # Create fingerprint from device info + network info
    fingerprint_data = f"{device_info.device_name}:{device_info.device_type}:{device_info.device_os}:{device_info.browser}:{user_agent}:{client_ip}"
    return hashlib.sha256(fingerprint_data.encode()).hexdigest()

def generate_backup_codes(count: int = 8) -> List[str]:
    """Generate backup codes for account recovery"""
    return [secrets.token_hex(4).upper() for _ in range(count)]

def send_verification_email(email: str, code: str):
    """Send verification email with MFA code"""
    # This is a placeholder - implement actual email sending
    print(f"Sending MFA code {code} to email {email}")
    # In production, integrate with SendGrid, AWS SES, or similar service

def send_verification_sms(phone: str, code: str):
    """Send verification SMS with MFA code"""
    # This is a placeholder - implement actual SMS sending  
    print(f"Sending MFA code {code} to phone {phone}")
    # In production, integrate with Twilio, AWS SNS, or similar service

def generate_qr_code(secret: str, user_email: str, issuer: str = "Comply-X") -> str:
    """Generate QR code for TOTP setup"""
    totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=user_email,
        issuer_name=issuer
    )
    
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(totp_uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    
    return base64.b64encode(buffer.getvalue()).decode()

# Device management endpoints

@router.post("/devices/register", response_model=DeviceResponse, summary="Register New Device")
async def register_device(
    device_info: DeviceRegistrationRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Register a new device for the current user"""
    
    # Generate unique device ID
    device_id = generate_device_id(request, device_info)
    
    # Check if device is already registered
    existing_device = db.query(UserDevice).filter(
        UserDevice.user_id == current_user.id,
        UserDevice.device_id == device_id
    ).first()
    
    if existing_device:
        # Update existing device info and mark as used
        existing_device.device_name = device_info.device_name
        existing_device.device_type = device_info.device_type
        existing_device.device_os = device_info.device_os
        existing_device.browser = device_info.browser
        existing_device.last_used_at = datetime.utcnow()
        existing_device.is_active = True
        
        db.commit()
        db.refresh(existing_device)
        return existing_device
    
    # Create new device record
    verification_token = secrets.token_urlsafe(32)
    
    db_device = UserDevice(
        user_id=current_user.id,
        device_name=device_info.device_name,
        device_type=device_info.device_type,
        device_id=device_id,
        device_os=device_info.device_os,
        browser=device_info.browser,
        verification_token=verification_token,
        is_verified=False,  # Require verification for new devices
        is_trusted=False,
        last_used_at=datetime.utcnow()
    )
    
    db.add(db_device)
    db.commit()
    db.refresh(db_device)
    
    # TODO: Send device verification email/SMS to user
    return db_device

@router.post("/devices/{device_id}/verify", summary="Verify Device")
async def verify_device(
    device_id: int,
    verification_token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Verify a registered device using verification token"""
    
    device = db.query(UserDevice).filter(
        UserDevice.id == device_id,
        UserDevice.user_id == current_user.id
    ).first()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    if device.verification_token != verification_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification token"
        )
    
    if device.is_verified:
        return {"message": "Device already verified"}
    
    # Verify the device
    device.is_verified = True
    device.verified_at = datetime.utcnow()
    device.verification_token = None
    
    db.commit()
    
    return {"message": "Device verified successfully"}

@router.get("/devices", response_model=List[DeviceResponse], summary="List User Devices")
async def list_user_devices(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all devices registered for the current user"""
    devices = db.query(UserDevice).filter(
        UserDevice.user_id == current_user.id,
        UserDevice.is_active == True
    ).order_by(UserDevice.last_used_at.desc()).all()
    
    return devices

@router.post("/devices/{device_id}/trust", summary="Trust Device")
async def trust_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Mark a verified device as trusted (skip MFA for this device)"""
    
    device = db.query(UserDevice).filter(
        UserDevice.id == device_id,
        UserDevice.user_id == current_user.id,
        UserDevice.is_verified == True
    ).first()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verified device not found"
        )
    
    device.is_trusted = True
    db.commit()
    
    return {"message": "Device marked as trusted"}

@router.delete("/devices/{device_id}", summary="Remove Device")
async def remove_device(
    device_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a device from the user's account"""
    
    device = db.query(UserDevice).filter(
        UserDevice.id == device_id,
        UserDevice.user_id == current_user.id
    ).first()
    
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found"
        )
    
    device.is_active = False
    db.commit()
    
    return {"message": "Device removed successfully"}

# MFA management endpoints

@router.get("/mfa/methods", response_model=List[MFAMethodResponse], summary="List MFA Methods")
async def list_mfa_methods(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all MFA methods configured for the current user"""
    methods = db.query(MFAMethod).filter(
        MFAMethod.user_id == current_user.id,
        MFAMethod.is_enabled == True
    ).all()
    
    # Remove sensitive data from response
    for method in methods:
        if method.method_type == "totp":
            method.secret_key = None
        if method.method_type == "backup_codes":
            method.backup_codes = None
    
    return methods

@router.post("/mfa/totp/setup", response_model=TOTPSetupResponse, summary="Setup TOTP MFA")
async def setup_totp_mfa(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Setup Time-based One-Time Password (TOTP) MFA using an authenticator app"""
    
    # Check if TOTP is already enabled
    existing_totp = db.query(MFAMethod).filter(
        MFAMethod.user_id == current_user.id,
        MFAMethod.method_type == "totp",
        MFAMethod.is_enabled == True
    ).first()
    
    if existing_totp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TOTP MFA is already enabled"
        )
    
    # Generate secret key and backup codes
    secret = pyotp.random_base32()
    backup_codes = generate_backup_codes()
    
    # Generate QR code
    qr_code_base64 = generate_qr_code(secret, current_user.email)
    totp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=current_user.email,
        issuer_name="Comply-X"
    )
    
    # Create MFA method record (but don't enable until verified)
    db_totp = MFAMethod(
        user_id=current_user.id,
        method_type="totp",
        secret_key=secret,
        is_primary=not current_user.mfa_enabled,  # First method becomes primary
        is_enabled=False  # Enable after verification
    )
    db.add(db_totp)
    
    # Create backup codes method
    db_backup = MFAMethod(
        user_id=current_user.id,
        method_type="backup_codes",
        backup_codes=json.dumps(backup_codes),
        is_primary=False,
        is_enabled=False  # Enable with TOTP
    )
    db.add(db_backup)
    
    db.commit()
    
    return TOTPSetupResponse(
        secret_key=secret,
        qr_code_url=totp_uri,
        qr_code_base64=qr_code_base64,
        backup_codes=backup_codes
    )

@router.post("/mfa/totp/verify", summary="Verify and Enable TOTP MFA")
async def verify_totp_mfa(
    verification: MFAVerificationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Verify TOTP code and enable TOTP MFA"""
    
    # Get the TOTP method
    totp_method = db.query(MFAMethod).filter(
        MFAMethod.id == verification.method_id,
        MFAMethod.user_id == current_user.id,
        MFAMethod.method_type == "totp"
    ).first()
    
    if not totp_method:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="TOTP method not found"
        )
    
    # Verify the TOTP code
    totp = pyotp.TOTP(totp_method.secret_key)
    if not totp.verify(verification.verification_code):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code"
        )
    
    # Enable TOTP and backup codes
    totp_method.is_enabled = True
    totp_method.last_used_at = datetime.utcnow()
    
    # Enable backup codes too
    backup_method = db.query(MFAMethod).filter(
        MFAMethod.user_id == current_user.id,
        MFAMethod.method_type == "backup_codes"
    ).first()
    if backup_method:
        backup_method.is_enabled = True
    
    # Enable MFA for user
    current_user.mfa_enabled = True
    
    db.commit()
    
    return {"message": "TOTP MFA enabled successfully"}

@router.post("/mfa/sms/setup", summary="Setup SMS MFA")
async def setup_sms_mfa(
    sms_request: SMSMFARequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Setup SMS-based MFA"""
    
    # Check if SMS MFA is already enabled
    existing_sms = db.query(MFAMethod).filter(
        MFAMethod.user_id == current_user.id,
        MFAMethod.method_type == "sms",
        MFAMethod.is_enabled == True
    ).first()
    
    if existing_sms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="SMS MFA is already enabled"
        )
    
    # Generate verification code
    verification_code = secrets.randbelow(999999)
    verification_code_str = f"{verification_code:06d}"
    
    # Create SMS MFA method record
    db_sms = MFAMethod(
        user_id=current_user.id,
        method_type="sms",
        phone_number=sms_request.phone_number,
        secret_key=verification_code_str,  # Temporary store for verification
        is_primary=not current_user.mfa_enabled,
        is_enabled=False  # Enable after verification
    )
    db.add(db_sms)
    db.commit()
    db.refresh(db_sms)
    
    # Send SMS verification code
    send_verification_sms(sms_request.phone_number, verification_code_str)
    
    return {
        "message": "SMS verification code sent",
        "method_id": db_sms.id,
        "phone_number": sms_request.phone_number[-4:]  # Show only last 4 digits
    }

@router.post("/mfa/email/setup", summary="Setup Email MFA")  
async def setup_email_mfa(
    email_request: EmailMFARequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Setup Email-based MFA"""
    
    # Check if email MFA is already enabled
    existing_email = db.query(MFAMethod).filter(
        MFAMethod.user_id == current_user.id,
        MFAMethod.method_type == "email",
        MFAMethod.is_enabled == True
    ).first()
    
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email MFA is already enabled"
        )
    
    # Generate verification code
    verification_code = secrets.randbelow(999999)
    verification_code_str = f"{verification_code:06d}"
    
    # Create email MFA method record
    db_email = MFAMethod(
        user_id=current_user.id,
        method_type="email",
        email_address=email_request.email_address,
        secret_key=verification_code_str,  # Temporary store for verification
        is_primary=not current_user.mfa_enabled,
        is_enabled=False  # Enable after verification
    )
    db.add(db_email)
    db.commit()
    db.refresh(db_email)
    
    # Send email verification code
    send_verification_email(email_request.email_address, verification_code_str)
    
    return {
        "message": "Email verification code sent",
        "method_id": db_email.id,
        "email_address": email_request.email_address
    }

@router.post("/mfa/verify", summary="Verify MFA Method")
async def verify_mfa_method(
    verification: MFAVerificationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Verify and enable an MFA method (SMS or Email)"""
    
    method = db.query(MFAMethod).filter(
        MFAMethod.id == verification.method_id,
        MFAMethod.user_id == current_user.id
    ).first()
    
    if not method:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="MFA method not found"
        )
    
    # Verify the code
    if method.secret_key != verification.verification_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code"
        )
    
    # Enable the method
    method.is_enabled = True
    method.last_used_at = datetime.utcnow()
    method.secret_key = None  # Clear the temporary verification code
    
    # Enable MFA for user
    current_user.mfa_enabled = True
    
    db.commit()
    
    return {"message": f"{method.method_type.upper()} MFA enabled successfully"}

@router.delete("/mfa/methods/{method_id}", summary="Disable MFA Method")
async def disable_mfa_method(
    method_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Disable an MFA method"""
    
    method = db.query(MFAMethod).filter(
        MFAMethod.id == method_id,
        MFAMethod.user_id == current_user.id
    ).first()
    
    if not method:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="MFA method not found"
        )
    
    method.is_enabled = False
    
    # Check if this was the last MFA method
    remaining_methods = db.query(MFAMethod).filter(
        MFAMethod.user_id == current_user.id,
        MFAMethod.is_enabled == True,
        MFAMethod.id != method_id
    ).count()
    
    if remaining_methods == 0:
        current_user.mfa_enabled = False
    
    db.commit()
    
    return {"message": "MFA method disabled successfully"}

@router.get("/mfa/status", summary="Get MFA Status")
async def get_mfa_status(
    current_user: User = Depends(get_current_user)
):
    """Get current MFA status for the user"""
    return {
        "mfa_enabled": current_user.mfa_enabled,
        "user_id": current_user.id,
        "last_login": current_user.last_login
    }