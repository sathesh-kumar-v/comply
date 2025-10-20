import os
import sys
from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from fastapi import FastAPI, HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import calendar_module
from calendar_module import router, create_event  # noqa: E402
from database import Base, get_db  # noqa: E402
from auth import get_current_user  # noqa: E402
from models import User, UserRole, PermissionLevel  # noqa: E402
from schemas import EventCreate  # noqa: E402


@pytest.fixture
def test_env():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    test_user = User(
        email="test@example.com",
        username="testuser",
        first_name="Test",
        last_name="User",
        hashed_password="hashed",
        role=UserRole.ADMIN,
        permission_level=PermissionLevel.VIEW_ONLY,
    )
    db.add(test_user)
    db.commit()
    db.refresh(test_user)

    app = FastAPI()
    app.include_router(router)

    def override_get_db():
        try:
            yield db
        finally:
            pass

    def override_current_user():
        return test_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_current_user

    client = TestClient(app)
    yield client, db, test_user
    db.close()


def _base_payload():
    return {
        "title": "Test Event",
        "type": "Meeting",
        "start_at": "2024-01-01T10:00:00Z",
        "end_at": "2024-01-01T11:00:00Z",
    }


def test_integer_reminder(test_env):
    client, _, _ = test_env
    payload = _base_payload()
    payload["reminders"] = [15]
    resp = client.post("/api/calendar/events", json=payload)
    assert resp.status_code == 201


def test_object_reminder(test_env):
    client, _, _ = test_env
    payload = _base_payload()
    payload["reminders"] = [{"minutes_before": 5, "method": "SMS"}]
    resp = client.post("/api/calendar/events", json=payload)
    assert resp.status_code == 201


def test_malformed_reminder_raises_422(test_env):
    _, db, user = test_env
    payload = EventCreate(**_base_payload(), reminders=[])
    payload.reminders.append({"method": "Email"})
    with pytest.raises(HTTPException) as exc:
        create_event(payload, db=db, current_user=user)
    assert exc.value.status_code == 422
    assert exc.value.detail == "Invalid reminder format"