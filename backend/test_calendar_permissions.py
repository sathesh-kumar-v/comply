import os
import sys
from types import SimpleNamespace

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from calendar_module import _can_manage_calendar
from models import UserRole


def test_admin_can_manage_calendar():
    user = SimpleNamespace(role=UserRole.ADMIN)
    assert _can_manage_calendar(user) is True


def test_super_admin_can_manage_calendar():
    user = SimpleNamespace(role=UserRole.SUPER_ADMIN)
    assert _can_manage_calendar(user) is True


def test_regular_user_cannot_manage_calendar():
    user = SimpleNamespace(role=UserRole.EMPLOYEE)
    assert _can_manage_calendar(user) is False