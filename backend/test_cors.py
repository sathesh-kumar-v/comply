#!/usr/bin/env python3

import requests
import json

def test_cors_preflight():
    """Test CORS preflight request"""
    # backend_url = "https://comply-x.onrender.com"
    # frontend_url = "https://comply-x-tyle.onrender.com"
    backend_url = "http://localhost:8000"
    frontend_url = "http://localhost:3000"
    
    print("🧪 Testing CORS configuration...")
    print(f"Frontend: {frontend_url}")
    print(f"Backend: {backend_url}")
    
    # Test preflight request
    headers = {
        "Origin": frontend_url,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type,Authorization"
    }
    
    try:
        print("\n🔄 Testing preflight request...")
        response = requests.options(
            f"{backend_url}/api/auth/password-reset/request",
            headers=headers,
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        print("Response headers:")
        for header, value in response.headers.items():
            if "access-control" in header.lower() or "origin" in header.lower():
                print(f"  {header}: {value}")
        
        # Check if CORS headers are present
        cors_headers = {
            "access-control-allow-origin": response.headers.get("access-control-allow-origin"),
            "access-control-allow-methods": response.headers.get("access-control-allow-methods"),
            "access-control-allow-headers": response.headers.get("access-control-allow-headers"),
            "access-control-allow-credentials": response.headers.get("access-control-allow-credentials")
        }
        
        print(f"\n📊 CORS Headers Analysis:")
        for header, value in cors_headers.items():
            status = "✅" if value else "❌"
            print(f"  {status} {header}: {value}")
        
        return all(cors_headers.values())
        
    except Exception as e:
        print(f"❌ Preflight test failed: {e}")
        return False

def test_actual_request():
    """Test actual password reset request"""
    # backend_url = "https://comply-x.onrender.com"
    # frontend_url = "https://comply-x-tyle.onrender.com"
    backend_url = "http://localhost:8000"
    frontend_url = "http://localhost:3000"
    
    headers = {
        "Origin": frontend_url,
        "Content-Type": "application/json"
    }
    
    data = {
        "email": "test@example.com"
    }
    
    try:
        print("\n🔄 Testing actual password reset request...")
        response = requests.post(
            f"{backend_url}/api/auth/password-reset/request",
            headers=headers,
            json=data,
            timeout=10
        )
        
        print(f"Status: {response.status_code}")
        print("Response headers:")
        for header, value in response.headers.items():
            if "access-control" in header.lower() or "origin" in header.lower():
                print(f"  {header}: {value}")
        
        if response.status_code == 200:
            print("✅ Request successful")
            return True
        else:
            print(f"⚠️  Request returned {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Actual request test failed: {e}")
        return False

def main():
    print("🌐 CORS Configuration Test")
    print("=" * 50)
    
    preflight_ok = test_cors_preflight()
    actual_ok = test_actual_request()
    
    print("\n" + "=" * 50)
    print("📋 Test Results:")
    print(f"  Preflight Request: {'✅ PASS' if preflight_ok else '❌ FAIL'}")
    print(f"  Actual Request: {'✅ PASS' if actual_ok else '❌ FAIL'}")
    
    if preflight_ok and actual_ok:
        print("\n🎉 CORS configuration is working correctly!")
    else:
        print("\n⚠️  CORS configuration needs attention")
    
    return preflight_ok and actual_ok

if __name__ == "__main__":
    main()