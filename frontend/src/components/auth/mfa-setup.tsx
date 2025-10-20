'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Shield, 
  ShieldCheck, 
  ShieldX, 
  Eye, 
  EyeOff, 
  CheckCircle, 
  AlertCircle, 
  Smartphone, 
  Copy, 
  Download,
  QrCode
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://comply-x.onrender.com';

interface MFASetupData {
  secret: string;
  qr_code: string;
  backup_codes: string[];
}

interface MFAStatus {
  enabled: boolean;
  methods: string[];
}

export function MFASetup() {
  const [mfaStatus, setMfaStatus] = useState<MFAStatus>({ enabled: false, methods: [] });
  const [setupData, setSetupData] = useState<MFASetupData | null>(null);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<'password' | 'scan' | 'verify' | 'backup'>('password');
  const [formData, setFormData] = useState({
    password: '',
    verificationCode: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    fetchMFAStatus();
  }, []);

  const fetchMFAStatus = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await axios.get(`${API_BASE_URL}/api/auth/mfa/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMfaStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch MFA status:', error);
    }
  };

  const handleStartSetup = async () => {
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/mfa/setup`,
        { password: formData.password },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSetupData(response.data);
      setCurrentStep('scan');
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to setup MFA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySetup = async () => {
    if (!setupData) return;

    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('auth_token');
      await axios.post(
        `${API_BASE_URL}/api/auth/mfa/verify`,
        {
          secret: setupData.secret,
          verification_code: formData.verificationCode,
          backup_codes: setupData.backup_codes
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setCurrentStep('backup');
      await fetchMFAStatus();
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableMFA = async () => {
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('auth_token');
      await axios.post(
        `${API_BASE_URL}/api/auth/mfa/disable`,
        { password: formData.password },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await fetchMFAStatus();
      setIsSetupOpen(false);
      resetForm();
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to disable MFA');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ password: '', verificationCode: '' });
    setSetupData(null);
    setCurrentStep('password');
    setError('');
    setShowPassword(false);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadBackupCodes = () => {
    if (!setupData) return;
    
    const content = setupData.backup_codes.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'comply-x-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderPasswordStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Shield className="mx-auto h-12 w-12 text-blue-500 mb-4" />
        <h3 className="text-lg font-semibold">
          {mfaStatus.enabled ? 'Disable Multi-Factor Authentication' : 'Enable Multi-Factor Authentication'}
        </h3>
        <p className="text-sm text-gray-600 mt-2">
          {mfaStatus.enabled 
            ? 'Enter your password to disable MFA'
            : 'Enter your password to start setting up MFA'
          }
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="password">Current Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Enter your password"
              className="pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={() => setIsSetupOpen(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={mfaStatus.enabled ? handleDisableMFA : handleStartSetup}
            disabled={!formData.password || isLoading}
            className="flex-1"
            variant={mfaStatus.enabled ? "destructive" : "default"}
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            ) : null}
            {mfaStatus.enabled ? 'Disable MFA' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );

  const renderScanStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <QrCode className="mx-auto h-12 w-12 text-blue-500 mb-4" />
        <h3 className="text-lg font-semibold">Scan QR Code</h3>
        <p className="text-sm text-gray-600 mt-2">
          Use your authenticator app to scan this QR code
        </p>
      </div>

      {setupData && (
        <div className="space-y-4">
          <div className="flex justify-center">
            <img 
              src={setupData.qr_code} 
              alt="MFA QR Code"
              className="w-48 h-48 border rounded-lg"
            />
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Can't scan the code? Enter manually:</p>
            <div className="bg-gray-100 p-3 rounded text-sm font-mono break-all">
              {setupData.secret}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copyToClipboard(setupData.secret)}
                className="ml-2 h-6"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <Alert>
            <Smartphone className="h-4 w-4" />
            <AlertDescription>
              <strong>Recommended apps:</strong><br />
              • Google Authenticator<br />
              • Microsoft Authenticator<br />
              • Authy<br />
              • 1Password
            </AlertDescription>
          </Alert>

          <div className="flex space-x-3">
            <Button
              variant="outline"
              onClick={() => setCurrentStep('password')}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              onClick={() => setCurrentStep('verify')}
              className="flex-1"
            >
              Continue
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  const renderVerifyStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <ShieldCheck className="mx-auto h-12 w-12 text-blue-500 mb-4" />
        <h3 className="text-lg font-semibold">Verify Setup</h3>
        <p className="text-sm text-gray-600 mt-2">
          Enter the 6-digit code from your authenticator app
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="verificationCode">Verification Code</Label>
          <Input
            id="verificationCode"
            value={formData.verificationCode}
            onChange={(e) => setFormData({ ...formData, verificationCode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
            placeholder="000000"
            className="text-center text-lg tracking-widest"
            maxLength={6}
          />
        </div>

        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={() => setCurrentStep('scan')}
            className="flex-1"
          >
            Back
          </Button>
          <Button
            onClick={handleVerifySetup}
            disabled={formData.verificationCode.length !== 6 || isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            ) : null}
            Verify & Enable
          </Button>
        </div>
      </div>
    </div>
  );

  const renderBackupStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
        <h3 className="text-lg font-semibold">MFA Enabled Successfully!</h3>
        <p className="text-sm text-gray-600 mt-2">
          Save these backup codes in a safe place
        </p>
      </div>

      {setupData && (
        <div className="space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Save these backup codes safely. You can use them to access your account if you lose your authenticator device.
            </AlertDescription>
          </Alert>

          <div>
            <div className="flex justify-between items-center mb-2">
              <Label>Backup Codes</Label>
              <div className="space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowBackupCodes(!showBackupCodes)}
                >
                  {showBackupCodes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={downloadBackupCodes}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="bg-gray-100 p-4 rounded text-sm font-mono">
              {showBackupCodes ? (
                <div className="grid grid-cols-2 gap-2">
                  {setupData.backup_codes.map((code, index) => (
                    <div key={index} className="flex justify-between">
                      <span>{code}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(code)}
                        className="h-4 p-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500">Click the eye icon to reveal codes</p>
              )}
            </div>
          </div>

          <Button
            onClick={() => {
              setIsSetupOpen(false);
              resetForm();
            }}
            className="w-full"
          >
            Complete Setup
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold flex items-center">
            <Shield className="h-5 w-5 mr-2" />
            Multi-Factor Authentication
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Add an extra layer of security to your account
          </p>
        </div>
        <Badge 
          variant={mfaStatus.enabled ? "default" : "secondary"}
          className={mfaStatus.enabled ? "bg-green-100 text-green-800" : ""}
        >
          {mfaStatus.enabled ? (
            <>
              <ShieldCheck className="h-4 w-4 mr-1" />
              Enabled
            </>
          ) : (
            <>
              <ShieldX className="h-4 w-4 mr-1" />
              Disabled
            </>
          )}
        </Badge>
      </div>

      <div className="space-y-4">
        <div className="text-sm text-gray-600">
          {mfaStatus.enabled ? (
            <div className="space-y-2">
              <p className="flex items-center text-green-600">
                <CheckCircle className="h-4 w-4 mr-2" />
                Your account is protected with multi-factor authentication
              </p>
              <p>Methods enabled: {mfaStatus.methods.join(', ')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p>Multi-factor authentication is not enabled.</p>
              <p>Enable MFA to secure your account with an authenticator app.</p>
            </div>
          )}
        </div>

        <Dialog open={isSetupOpen} onOpenChange={setIsSetupOpen}>
          <DialogTrigger asChild>
            <Button 
              variant={mfaStatus.enabled ? "destructive" : "default"}
              onClick={() => {
                setIsSetupOpen(true);
                resetForm();
              }}
            >
              {mfaStatus.enabled ? 'Disable MFA' : 'Enable MFA'}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Multi-Factor Authentication</DialogTitle>
            </DialogHeader>
            {currentStep === 'password' && renderPasswordStep()}
            {currentStep === 'scan' && renderScanStep()}
            {currentStep === 'verify' && renderVerifyStep()}
            {currentStep === 'backup' && renderBackupStep()}
          </DialogContent>
        </Dialog>
      </div>
    </Card>
  );
}