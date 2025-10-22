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
  QrCode,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useSettings } from '@/contexts/settings-context';
import axios from 'axios';
import type { AxiosResponse } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://comply-x.onrender.com';

type ApiMode = 'modern' | 'legacy';

interface MFASetupData {
  methodId?: number;
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

interface MFAStatus {
  enabled: boolean;
  methods: string[];
}

/** ————————————————————————————————————————————————————————————————
 * Helpers (non-exported) — keep these as plain functions/consts so
 * TypeScript never confuses them with a React component.
 * ———————————————————————————————————————————————————————————————— */
const ensureDataUrl = (value: string): string =>
  value.startsWith('data:') ? value : `data:image/png;base64,${value}`;

/**
 * “withApiMode” lives inside the component so it can read state,
 * but it returns a *Promise* — it does not affect the component’s
 * JSX return type.
 */
export function MFASetup(): JSX.Element {
  const [mfaStatus, setMfaStatus] = useState<MFAStatus>({ enabled: false, methods: [] });
  const [setupData, setSetupData] = useState<MFASetupData | null>(null);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState<'password' | 'scan' | 'verify' | 'backup'>('password');
  const [formData, setFormData] = useState({ password: '', verificationCode: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [apiMode, setApiMode] = useState<ApiMode>('modern');

  const { user } = useAuth(); // kept for future use if needed
  const { security } = useSettings();
  const canManageMfa = security.allowMfaEnrollment || mfaStatus.enabled;

  useEffect(() => {
    void fetchMFAStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const withApiMode = async <T,>(
    modernCall: () => Promise<T>,
    legacyCall: () => Promise<T>
  ): Promise<{ result: T; mode: ApiMode }> => {
    if (apiMode === 'legacy') {
      const legacy = await legacyCall();
      return { result: legacy, mode: 'legacy' };
    }
    try {
      const modern = await modernCall();
      if (apiMode !== 'modern') setApiMode('modern');
      return { result: modern, mode: 'modern' };
    } catch (err: any) {
      if (err?.response?.status === 404) {
        const legacy = await legacyCall();
        setApiMode('legacy');
        return { result: legacy, mode: 'legacy' };
      }
      throw err;
    }
  };

  const fetchMFAStatus = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const { result: response } = await withApiMode<
        AxiosResponse<Partial<MFAStatus> & { mfa_enabled?: boolean }>
      >(
        () =>
          axios.get(`${API_BASE_URL}/api/mfa/status`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        () =>
          axios.get(`${API_BASE_URL}/api/auth/mfa/status`, {
            headers: { Authorization: `Bearer ${token}` },
          })
      );

      const data = response.data;
      setMfaStatus({
        enabled: Boolean(data.enabled ?? data.mfa_enabled),
        methods: Array.isArray(data.methods) ? data.methods : [],
      });
    } catch (err) {
      console.error('Failed to fetch MFA status:', err);
    }
  };

  const handleStartSetup = async (): Promise<void> => {
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('Not authenticated');

      const { result: response, mode } = await withApiMode<
        | AxiosResponse<{
            method_id: number;
            secret_key: string;
            qr_code_base64: string;
            backup_codes: string[];
          }>
        | AxiosResponse<{
            secret: string;
            qr_code: string;
            backup_codes: string[];
          }>
      >(
        () =>
          axios.post(
            `${API_BASE_URL}/api/mfa/totp/setup`,
            { password: formData.password },
            { headers: { Authorization: `Bearer ${token}` } }
          ),
        () =>
          axios.post(
            `${API_BASE_URL}/api/auth/mfa/setup`,
            { password: formData.password },
            { headers: { Authorization: `Bearer ${token}` } }
          )
      );

      if (mode === 'modern') {
        const data = (response as AxiosResponse<{
          method_id: number;
          secret_key: string;
          qr_code_base64: string;
          backup_codes: string[];
        }>).data;

        setSetupData({
          methodId: data.method_id,
          secret: data.secret_key,
          qrCode: ensureDataUrl(data.qr_code_base64),
          backupCodes: data.backup_codes || [],
        });
      } else {
        const data = (response as AxiosResponse<{
          secret: string;
          qr_code: string;
          backup_codes: string[];
        }>).data;

        setSetupData({
          secret: data.secret,
          qrCode: ensureDataUrl(data.qr_code),
          backupCodes: data.backup_codes || [],
        });
      }

      setCurrentStep('scan');
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to setup MFA');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySetup = async (): Promise<void> => {
    if (!setupData) return;

    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('Not authenticated');

      await withApiMode(
        () =>
          axios.post(
            `${API_BASE_URL}/api/mfa/totp/verify`,
            {
              method_id: setupData.methodId,
              verification_code: formData.verificationCode,
            },
            { headers: { Authorization: `Bearer ${token}` } }
          ),
        () =>
          axios.post(
            `${API_BASE_URL}/api/auth/mfa/verify`,
            {
              secret: setupData.secret,
              verification_code: formData.verificationCode,
              backup_codes: setupData.backupCodes,
            },
            { headers: { Authorization: `Bearer ${token}` } }
          )
      );

      setCurrentStep('backup');
      await fetchMFAStatus();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Invalid verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableMFA = async (): Promise<void> => {
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('Not authenticated');

      await withApiMode(
        () =>
          axios.post(
            `${API_BASE_URL}/api/mfa/disable`,
            { password: formData.password },
            { headers: { Authorization: `Bearer ${token}` } }
          ),
        () =>
          axios.post(
            `${API_BASE_URL}/api/auth/mfa/disable`,
            { password: formData.password },
            { headers: { Authorization: `Bearer ${token}` } }
          )
      );

      await fetchMFAStatus();
      setIsSetupOpen(false);
      resetForm();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to disable MFA');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = (): void => {
    setFormData({ password: '', verificationCode: '' });
    setSetupData(null);
    setCurrentStep('password');
    setError('');
    setShowPassword(false);
  };

  const copyToClipboard = (text: string): void => {
    void navigator.clipboard.writeText(text);
  };

  const downloadBackupCodes = (): void => {
    if (!setupData) return;
    const content = setupData.backupCodes.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'comply-x-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ——————— Render subviews ———————
  const renderPasswordStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <Shield className="mx-auto mb-4 h-12 w-12 text-blue-500" />
        <h3 className="text-lg font-semibold">
          {mfaStatus.enabled ? 'Disable Multi-Factor Authentication' : 'Enable Multi-Factor Authentication'}
        </h3>
        <p className="mt-2 text-sm text-gray-600">
          {mfaStatus.enabled ? 'Enter your password to disable MFA' : 'Enter your password to start setting up MFA'}
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
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => setIsSetupOpen(false)} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={mfaStatus.enabled ? handleDisableMFA : handleStartSetup}
            disabled={!formData.password || isLoading || (!security.allowMfaEnrollment && !mfaStatus.enabled)}
            className="flex-1"
            variant={mfaStatus.enabled ? 'destructive' : 'default'}
          >
            {isLoading ? <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" /> : null}
            {mfaStatus.enabled ? 'Disable MFA' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );

  const renderScanStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <QrCode className="mx-auto mb-4 h-12 w-12 text-blue-500" />
        <h3 className="text-lg font-semibold">Scan QR Code</h3>
        <p className="mt-2 text-sm text-gray-600">Use your authenticator app to scan this QR code</p>
      </div>

      {setupData && (
        <div className="space-y-4">
          <div className="flex justify-center">
            <img src={setupData.qrCode} alt="MFA QR Code" className="h-48 w-48 rounded-lg border" />
          </div>

          <div className="text-center">
            <p className="mb-2 text-sm text-gray-600">Can't scan the code? Enter manually:</p>
            <div className="rounded bg-gray-100 p-3 font-mono text-sm break-all">
              {setupData.secret}
              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(setupData.secret)} className="ml-2 h-6">
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <Alert>
            <Smartphone className="h-4 w-4" />
            <AlertDescription>
              <strong>Recommended apps:</strong>
              <br />• Google Authenticator
              <br />• Microsoft Authenticator
              <br />• Authy
              <br />• 1Password
            </AlertDescription>
          </Alert>

          <div className="flex space-x-3">
            <Button variant="outline" onClick={() => setCurrentStep('password')} className="flex-1">
              Back
            </Button>
            <Button onClick={() => setCurrentStep('verify')} className="flex-1">
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
        <ShieldCheck className="mx-auto mb-4 h-12 w-12 text-blue-500" />
        <h3 className="text-lg font-semibold">Verify Setup</h3>
        <p className="mt-2 text-sm text-gray-600">Enter the 6-digit code from your authenticator app</p>
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
            onChange={(e) =>
              setFormData({
                ...formData,
                verificationCode: e.target.value.replace(/\D/g, '').slice(0, 6),
              })
            }
            placeholder="000000"
            className="text-center text-lg tracking-widest"
            maxLength={6}
          />
        </div>

        <div className="flex space-x-3">
          <Button variant="outline" onClick={() => setCurrentStep('scan')} className="flex-1">
            Back
          </Button>
          <Button onClick={handleVerifySetup} disabled={formData.verificationCode.length !== 6 || isLoading} className="flex-1">
            {isLoading ? <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white" /> : null}
            Verify & Enable
          </Button>
        </div>
      </div>
    </div>
  );

  const renderBackupStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
        <h3 className="text-lg font-semibold">MFA Enabled Successfully!</h3>
        <p className="mt-2 text-sm text-gray-600">Save these backup codes in a safe place</p>
      </div>

      {setupData && (
        <div className="space-y-4">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Save these backup codes safely. You can use them to access your account if you lose
              your authenticator device.
            </AlertDescription>
          </Alert>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Backup Codes</Label>
              <div className="space-x-2">
                <Button size="sm" variant="outline" onClick={() => setShowBackupCodes((v) => !v)}>
                  {showBackupCodes ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button size="sm" variant="outline" onClick={downloadBackupCodes}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="rounded bg-gray-100 p-4 font-mono text-sm">
              {showBackupCodes ? (
                <div className="grid grid-cols-2 gap-2">
                  {setupData.backupCodes.map((code, index) => (
                    <div key={index} className="flex justify-between">
                      <span>{code}</span>
                      <Button size="sm" variant="ghost" onClick={() => copyToClipboard(code)} className="h-4 p-0">
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

  // ——————— Top-level component return (always JSX) ———————
  return (
    <Card className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="flex items-center text-lg font-semibold">
            <Shield className="mr-2 h-5 w-5" />
            Multi-Factor Authentication
          </h3>
          <p className="mt-1 text-sm text-gray-600">Add an extra layer of security to your account</p>
        </div>
        <Badge variant={mfaStatus.enabled ? 'default' : 'secondary'} className={mfaStatus.enabled ? 'bg-green-100 text-green-800' : ''}>
          {mfaStatus.enabled ? (
            <>
              <ShieldCheck className="mr-1 h-4 w-4" />
              Enabled
            </>
          ) : (
            <>
              <ShieldX className="mr-1 h-4 w-4" />
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
                <CheckCircle className="mr-2 h-4 w-4" />
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

        {!security.allowMfaEnrollment && !mfaStatus.enabled && (
          <Alert className="border-yellow-200 bg-yellow-50 text-yellow-900">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              MFA enrollment is currently disabled by your administrator. Enablement options will appear once the security
              setting is turned on in Company Settings.
            </AlertDescription>
          </Alert>
        )}

        <Dialog open={isSetupOpen} onOpenChange={setIsSetupOpen}>
          <DialogTrigger asChild>
            <Button
              variant={mfaStatus.enabled ? 'destructive' : 'default'}
              disabled={!canManageMfa}
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
