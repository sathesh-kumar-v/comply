"use client"

import { useState } from 'react'
import { LoginForm } from '@/components/auth/login-form'
import { RegisterForm } from '@/components/auth/register-form'
import logo from '@/assets/logo-1.png'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex items-center justify-center mb-6">
            <div className="text-primary">
              {/* <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 0L24.5 15.5H40L28.5 24.5L33 40L20 31L7 40L11.5 24.5L0 15.5H15.5L20 0Z" fill="currentColor"/>
              </svg> */}
            <img src={logo.src} alt="Logo" width="40" height="40" />
            </div>
          </div>
          <h2 className="text-xl text-gray-600 mb-8">AI-powered compliance management</h2>
        </div>
        
        {/* Toggle Buttons */}
        <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
          <button
            onClick={() => setIsLogin(true)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              isLogin
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setIsLogin(false)}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
              !isLogin
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Register
          </button>
        </div>
        
        {isLogin ? (
          <LoginForm />
        ) : (
          <RegisterForm 
            onToggle={() => setIsLogin(true)}
            onSuccess={() => {
              // Don't automatically switch to login - let user see success message
              // and click the "Sign In" button when ready
            }}
          />
        )}
      </div>
    </div>
  )
}