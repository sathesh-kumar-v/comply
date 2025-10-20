from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from database import get_db
from auth import get_current_user
from models import (
    User, UserRole, PermissionLevel, Group, Company, Country, Site, Department,
    DocumentAccess, DocumentAssignment, DocumentSchedule, CrossDepartmentTag
)
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

router = APIRouter()

# Pydantic models for organization management

class GroupCreate(BaseModel):
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    code: str = Field(..., max_length=20)

class GroupResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    code: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class CompanyCreate(BaseModel):
    name: str = Field(..., max_length=200)
    legal_name: Optional[str] = None
    code: str = Field(..., max_length=20)
    group_id: int
    registration_number: Optional[str] = None
    tax_id: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    industry: Optional[str] = None

class CompanyResponse(BaseModel):
    id: int
    name: str
    legal_name: Optional[str]
    code: str
    group_id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True

class CountryCreate(BaseModel):
    name: str = Field(..., max_length=100)
    code: str = Field(..., max_length=3)
    company_id: int
    timezone: str = "UTC"
    currency: Optional[str] = None
    language: str = "en"

class CountryResponse(BaseModel):
    id: int
    name: str
    code: str
    company_id: int
    timezone: str
    currency: Optional[str]
    language: str
    is_active: bool
    
    class Config:
        from_attributes = True

class SiteCreate(BaseModel):
    name: str = Field(..., max_length=200)
    code: str = Field(..., max_length=20)
    country_id: int
    address: Optional[str] = None
    city: Optional[str] = None
    state_province: Optional[str] = None
    postal_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    site_type: Optional[str] = None
    capacity: Optional[int] = None

class SiteResponse(BaseModel):
    id: int
    name: str
    code: str
    country_id: int
    city: Optional[str]
    site_type: Optional[str]
    is_active: bool
    
    class Config:
        from_attributes = True

class DepartmentCreate(BaseModel):
    name: str = Field(..., max_length=200)
    code: str = Field(..., max_length=20)
    site_id: int
    parent_department_id: Optional[int] = None
    description: Optional[str] = None
    manager_id: Optional[int] = None
    is_confidential: bool = False
    access_level: str = "internal"

class DepartmentResponse(BaseModel):
    id: int
    name: str
    code: str
    site_id: int
    parent_department_id: Optional[int]
    manager_id: Optional[int]
    is_confidential: bool
    is_active: bool
    
    class Config:
        from_attributes = True

class OrganizationHierarchy(BaseModel):
    groups: List[GroupResponse]
    companies: List[CompanyResponse]
    countries: List[CountryResponse]
    sites: List[SiteResponse]
    departments: List[DepartmentResponse]

# Permission checking utilities
def check_admin_access(current_user: User):
    if current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to manage organization structure"
        )

def check_super_admin_access(current_user: User):
    if current_user.permission_level != PermissionLevel.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required"
        )

# Group management endpoints
@router.post("/groups", response_model=GroupResponse, summary="Create Group")
async def create_group(
    group: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_super_admin_access(current_user)
    
    # Check if group code already exists
    if db.query(Group).filter(Group.code == group.code).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Group code already exists"
        )
    
    db_group = Group(
        name=group.name,
        description=group.description,
        code=group.code,
        created_by_id=current_user.id
    )
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db_group

@router.get("/groups", response_model=List[GroupResponse], summary="List Groups")
async def list_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_access(current_user)
    return db.query(Group).filter(Group.is_active == True).all()

# Company management endpoints
@router.post("/companies", response_model=CompanyResponse, summary="Create Company")
async def create_company(
    company: CompanyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_access(current_user)
    
    # Verify group exists
    group = db.query(Group).filter(Group.id == company.group_id, Group.is_active == True).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found"
        )
    
    db_company = Company(
        name=company.name,
        legal_name=company.legal_name,
        code=company.code,
        group_id=company.group_id,
        registration_number=company.registration_number,
        tax_id=company.tax_id,
        address=company.address,
        website=company.website,
        email=company.email,
        phone=company.phone,
        industry=company.industry,
        created_by_id=current_user.id
    )
    db.add(db_company)
    db.commit()
    db.refresh(db_company)
    return db_company

@router.get("/companies", response_model=List[CompanyResponse], summary="List Companies")
async def list_companies(
    group_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_access(current_user)
    
    query = db.query(Company).filter(Company.is_active == True)
    if group_id:
        query = query.filter(Company.group_id == group_id)
    
    return query.all()

# Country management endpoints
@router.post("/countries", response_model=CountryResponse, summary="Create Country")
async def create_country(
    country: CountryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_access(current_user)
    
    # Verify company exists
    company = db.query(Company).filter(Company.id == country.company_id, Company.is_active == True).first()
    if not company:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company not found"
        )
    
    db_country = Country(
        name=country.name,
        code=country.code,
        company_id=country.company_id,
        timezone=country.timezone,
        currency=country.currency,
        language=country.language,
        created_by_id=current_user.id
    )
    db.add(db_country)
    db.commit()
    db.refresh(db_country)
    return db_country

@router.get("/countries", response_model=List[CountryResponse], summary="List Countries")
async def list_countries(
    company_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_access(current_user)
    
    query = db.query(Country).filter(Country.is_active == True)
    if company_id:
        query = query.filter(Country.company_id == company_id)
    
    return query.all()

# Site management endpoints
@router.post("/sites", response_model=SiteResponse, summary="Create Site")
async def create_site(
    site: SiteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_access(current_user)
    
    # Verify country exists
    country = db.query(Country).filter(Country.id == site.country_id, Country.is_active == True).first()
    if not country:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Country not found"
        )
    
    db_site = Site(
        name=site.name,
        code=site.code,
        country_id=site.country_id,
        address=site.address,
        city=site.city,
        state_province=site.state_province,
        postal_code=site.postal_code,
        phone=site.phone,
        email=site.email,
        site_type=site.site_type,
        capacity=site.capacity,
        created_by_id=current_user.id
    )
    db.add(db_site)
    db.commit()
    db.refresh(db_site)
    return db_site

@router.get("/sites", response_model=List[SiteResponse], summary="List Sites")
async def list_sites(
    country_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_access(current_user)
    
    query = db.query(Site).filter(Site.is_active == True)
    if country_id:
        query = query.filter(Site.country_id == country_id)
    
    return query.all()

# Department management endpoints
@router.post("/departments", response_model=DepartmentResponse, summary="Create Department")
async def create_department(
    department: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_access(current_user)
    
    # Verify site exists
    site = db.query(Site).filter(Site.id == department.site_id, Site.is_active == True).first()
    if not site:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Site not found"
        )
    
    # Verify parent department if specified
    if department.parent_department_id:
        parent = db.query(Department).filter(
            Department.id == department.parent_department_id,
            Department.is_active == True
        ).first()
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Parent department not found"
            )
    
    # Verify manager if specified
    if department.manager_id:
        manager = db.query(User).filter(
            User.id == department.manager_id,
            User.is_active == True
        ).first()
        if not manager:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Manager not found"
            )
    
    db_department = Department(
        name=department.name,
        code=department.code,
        site_id=department.site_id,
        parent_department_id=department.parent_department_id,
        description=department.description,
        manager_id=department.manager_id,
        is_confidential=department.is_confidential,
        created_by_id=current_user.id
    )
    db.add(db_department)
    db.commit()
    db.refresh(db_department)
    return db_department

@router.get("/departments", response_model=List[DepartmentResponse], summary="List Departments")
async def list_departments(
    site_id: Optional[int] = None,
    include_confidential: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_access(current_user)
    
    query = db.query(Department).filter(Department.is_active == True)
    
    if site_id:
        query = query.filter(Department.site_id == site_id)
    
    # Hide confidential departments unless explicitly requested and user has access
    if not include_confidential or current_user.permission_level not in [PermissionLevel.SUPER_ADMIN, PermissionLevel.ADMIN_ACCESS]:
        query = query.filter(Department.is_confidential == False)
    
    return query.all()

@router.get("/hierarchy", response_model=OrganizationHierarchy, summary="Get Organization Hierarchy")
async def get_organization_hierarchy(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_access(current_user)
    
    # Get user's permission level to determine what they can see
    include_confidential = current_user.permission_level in [PermissionLevel.SUPER_ADMIN, PermissionLevel.ADMIN_ACCESS]
    
    groups = db.query(Group).filter(Group.is_active == True).all()
    companies = db.query(Company).filter(Company.is_active == True).all()
    countries = db.query(Country).filter(Country.is_active == True).all()
    sites = db.query(Site).filter(Site.is_active == True).all()
    
    dept_query = db.query(Department).filter(Department.is_active == True)
    if not include_confidential:
        dept_query = dept_query.filter(Department.is_confidential == False)
    departments = dept_query.all()
    
    return OrganizationHierarchy(
        groups=groups,
        companies=companies,
        countries=countries,
        sites=sites,
        departments=departments
    )

# User assignment endpoints
class UserAssignmentRequest(BaseModel):
    user_id: int
    department_id: int
    reporting_manager_id: Optional[int] = None
    permission_level: PermissionLevel = PermissionLevel.VIEW_ONLY

@router.post("/users/{user_id}/assign-department", summary="Assign User to Department")
async def assign_user_to_department(
    user_id: int,
    assignment: UserAssignmentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_access(current_user)
    
    # Get user
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Verify department
    department = db.query(Department).filter(
        Department.id == assignment.department_id,
        Department.is_active == True
    ).first()
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )
    
    # Check access to confidential departments
    if department.is_confidential and current_user.permission_level not in [PermissionLevel.SUPER_ADMIN, PermissionLevel.ADMIN_ACCESS]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot assign to confidential department"
        )
    
    # Verify reporting manager if specified
    if assignment.reporting_manager_id:
        manager = db.query(User).filter(
            User.id == assignment.reporting_manager_id,
            User.is_active == True
        ).first()
        if not manager:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reporting manager not found"
            )
    
    # Update user assignment
    user.department_id = assignment.department_id
    user.reporting_manager_id = assignment.reporting_manager_id
    user.permission_level = assignment.permission_level
    
    db.commit()
    db.refresh(user)
    
    return {"message": "User assigned successfully", "user_id": user.id, "department_id": assignment.department_id}

@router.get("/users/{user_id}/organization-context", summary="Get User Organization Context")
async def get_user_organization_context(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Users can see their own context, admins can see any user's context
    if current_user.id != user_id and current_user.role not in [UserRole.ADMIN, UserRole.MANAGER]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions"
        )
    
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    context = {
        "user_id": user.id,
        "department": None,
        "site": None,
        "country": None,
        "company": None,
        "group": None,
        "reporting_manager": None
    }
    
    if user.user_department:
        context["department"] = {
            "id": user.user_department.id,
            "name": user.user_department.name,
            "code": user.user_department.code,
            "is_confidential": user.user_department.is_confidential
        }
        
        if user.user_department.site:
            context["site"] = {
                "id": user.user_department.site.id,
                "name": user.user_department.site.name,
                "code": user.user_department.site.code,
                "city": user.user_department.site.city
            }
            
            if user.user_department.site.country:
                context["country"] = {
                    "id": user.user_department.site.country.id,
                    "name": user.user_department.site.country.name,
                    "code": user.user_department.site.country.code,
                    "timezone": user.user_department.site.country.timezone
                }
                
                if user.user_department.site.country.company:
                    context["company"] = {
                        "id": user.user_department.site.country.company.id,
                        "name": user.user_department.site.country.company.name,
                        "code": user.user_department.site.country.company.code
                    }
                    
                    if user.user_department.site.country.company.group:
                        context["group"] = {
                            "id": user.user_department.site.country.company.group.id,
                            "name": user.user_department.site.country.company.group.name,
                            "code": user.user_department.site.country.company.group.code
                        }
    
    if user.reporting_manager:
        context["reporting_manager"] = {
            "id": user.reporting_manager.id,
            "name": f"{user.reporting_manager.first_name} {user.reporting_manager.last_name}",
            "email": user.reporting_manager.email
        }
    
    return context