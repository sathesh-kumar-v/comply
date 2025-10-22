"""Compatibility helpers for cryptography dependencies.

This module currently provides workarounds for behavioural changes in the
``bcrypt`` package which removed the ``__about__`` attribute that older
versions of ``passlib`` still rely on.  Importing :func:`ensure_bcrypt_about`
will reinstate a lightweight shim so ``passlib`` can continue to introspect
its backend without errors.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any


def ensure_bcrypt_about() -> None:
    """Ensure ``bcrypt`` exposes the metadata interface expected by passlib.

    The ``passlib`` 1.x series looks for ``bcrypt.__about__.__version__`` when
    initialising its bcrypt handlers.  Starting with ``bcrypt`` 4.0 this module
    attribute was removed, causing an ``AttributeError`` at runtime.  Rather
    than downgrading dependencies we synthesise a minimal stand-in module that
    surfaces the version information passlib needs.
    """

    try:
        import bcrypt  # type: ignore[import-not-found]
    except Exception:
        # If bcrypt itself is unavailable we have bigger issues; defer the
        # resulting ImportError to the caller.
        return

    about: Any = getattr(bcrypt, "__about__", None)
    if about is not None and getattr(about, "__version__", None):
        return

    version = getattr(bcrypt, "__version__", None)
    if version:
        setattr(bcrypt, "__about__", SimpleNamespace(__version__=version))

