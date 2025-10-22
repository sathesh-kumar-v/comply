'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { MFASetup } from '@/components/auth/mfa-setup';
import { User, Shield, Bell, Palette } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { useSettings } from '@/contexts/settings-context';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

const formatPermissionLevel = (level?: string | null) => {
  if (!level) {
    return '—';
  }

  return level
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

export default function SettingsPage() {
  const { user, updateProfile, changePassword } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'appearance'>('profile');
  const { security, updateSecurity } = useSettings();
  const [profileForm, setProfileForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    phone: '',
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    setProfileForm({
      firstName: user.first_name ?? '',
      lastName: user.last_name ?? '',
      username: user.username ?? '',
      phone: user.phone ?? '',
    });
    setProfileMessage(null);
  }, [user]);

  const permissionLabel = useMemo(() => formatPermissionLevel(user?.permission_level), [user?.permission_level]);

  const isProfileDirty = useMemo(() => {
    if (!user) {
      return false;
    }

    return (
      profileForm.firstName !== (user.first_name ?? '') ||
      profileForm.lastName !== (user.last_name ?? '') ||
      profileForm.username !== (user.username ?? '') ||
      profileForm.phone !== (user.phone ?? '')
    );
  }, [profileForm, user]);

  const handleProfileChange = (field: keyof typeof profileForm) => (event: ChangeEvent<HTMLInputElement>) => {
    if (profileMessage) {
      setProfileMessage(null);
    }

    setProfileForm((previous) => ({
      ...previous,
      [field]: event.target.value,
    }));
  };

  const handlePasswordChange = (field: keyof typeof passwordForm) => (event: ChangeEvent<HTMLInputElement>) => {
    if (passwordMessage) {
      setPasswordMessage(null);
    }

    setPasswordForm((previous) => ({
      ...previous,
      [field]: event.target.value,
    }));
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user || !isProfileDirty) {
      return;
    }

    setIsSavingProfile(true);
    setProfileMessage(null);

    try {
      const trimmedPhone = profileForm.phone.trim();
      const payload = {
        first_name: profileForm.firstName.trim(),
        last_name: profileForm.lastName.trim(),
        username: profileForm.username.trim(),
        phone: trimmedPhone,
      };

      const updatedUser = await updateProfile(payload);

      setProfileForm({
        firstName: updatedUser.first_name ?? '',
        lastName: updatedUser.last_name ?? '',
        username: updatedUser.username ?? '',
        phone: updatedUser.phone ?? '',
      });

      setProfileMessage({ type: 'success', text: 'Profile details updated successfully.' });
    } catch (error) {
      let message = 'Unable to update profile. Please try again.';

      if (isAxiosError(error)) {
        const detail = error.response?.data?.detail;
        if (typeof detail === 'string' && detail.trim().length > 0) {
          message = detail;
        }
      } else if (error instanceof Error && error.message) {
        message = error.message;
      }

      setProfileMessage({ type: 'error', text: message });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const isPasswordFormValid = useMemo(() => {
    const current = passwordForm.currentPassword.trim();
    const next = passwordForm.newPassword.trim();
    const confirm = passwordForm.confirmPassword.trim();

    if (!current || !next || !confirm) {
      return false;
    }

    if (next.length < 8) {
      return false;
    }

    return next === confirm;
  }, [passwordForm]);

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isPasswordFormValid || isUpdatingPassword) {
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordMessage(null);

    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordMessage({ type: 'success', text: 'Password updated successfully.' });
    } catch (error) {
      let message = 'Unable to update password. Please try again.';

      if (isAxiosError(error)) {
        const detail = error.response?.data?.detail;
        if (typeof detail === 'string' && detail.trim().length > 0) {
          message = detail;
        }
      } else if (error instanceof Error && error.message) {
        message = error.message;
      }

      setPasswordMessage({ type: 'error', text: message });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 sm:p-6">
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50/70 via-white to-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">Workspace preferences</p>
              <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
              <p className="text-sm text-gray-600 max-w-xl">
                Manage your personal details, authentication controls, notification defaults, and interface style from one cohesive hub.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              {permissionLabel !== '—' && (
                <Badge variant="outline" className="border-emerald-200 bg-white/70 text-emerald-700">
                  {permissionLabel} access
                </Badge>
              )}
              <div className="rounded-xl border border-emerald-100 bg-white/70 px-4 py-3 shadow-sm">
                <p className="text-xs uppercase tracking-wide text-emerald-600">Security posture</p>
                <p className="text-sm font-semibold text-gray-800">
                  {security.requireMfaForAdmins ? 'Admins must use MFA' : 'MFA optional for admins'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border border-emerald-100/80 bg-white/90 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                <User className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-800">Profile completeness</p>
                <p className="text-xs text-gray-600">
                  {user?.first_name && user?.last_name ? 'Core details synced from directory.' : 'Complete your profile to improve visibility.'}
                </p>
              </div>
            </div>
          </Card>
          <Card className="border border-emerald-100/80 bg-white/90 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                <Shield className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-800">Authentication controls</p>
                <p className="text-xs text-gray-600">
                  {security.allowMfaEnrollment ? 'MFA enrollment is open to users.' : 'MFA enrollment currently restricted.'}
                </p>
              </div>
            </div>
          </Card>
          <Card className="border border-emerald-100/80 bg-white/90 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                <Bell className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-800">Notification cadence</p>
                <p className="text-xs text-gray-600">
                  Tailor announcement, reminder, and summary defaults for your account.
                </p>
              </div>
            </div>
          </Card>
          <Card className="border border-emerald-100/80 bg-white/90 p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                <Palette className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-800">Theme preferences</p>
                <p className="text-xs text-gray-600">
                  Configure workspace density, contrast, and focus assist modes.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as typeof activeTab)}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-2 gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-1 sm:grid-cols-4">
            <TabsTrigger
              value="profile"
              className="flex items-center justify-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold text-gray-600 transition data-[state=active]:border-emerald-200 data-[state=active]:bg-white data-[state=active]:text-emerald-700"
            >
              <User className="h-4 w-4" />
              <span>Profile</span>
            </TabsTrigger>
            <TabsTrigger
              value="security"
              className="flex items-center justify-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold text-gray-600 transition data-[state=active]:border-emerald-200 data-[state=active]:bg-white data-[state=active]:text-emerald-700"
            >
              <Shield className="h-4 w-4" />
              <span>Security</span>
            </TabsTrigger>
            <TabsTrigger
              value="notifications"
              className="flex items-center justify-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold text-gray-600 transition data-[state=active]:border-emerald-200 data-[state=active]:bg-white data-[state=active]:text-emerald-700"
            >
              <Bell className="h-4 w-4" />
              <span>Notifications</span>
            </TabsTrigger>
            <TabsTrigger
              value="appearance"
              className="flex items-center justify-center gap-2 rounded-xl border border-transparent px-3 py-2 text-sm font-semibold text-gray-600 transition data-[state=active]:border-emerald-200 data-[state=active]:bg-white data-[state=active]:text-emerald-700"
            >
              <Palette className="h-4 w-4" />
              <span>Appearance</span>
            </TabsTrigger>
          </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card className="border border-emerald-100/80 bg-white/90 p-6 shadow-sm">
            <form className="space-y-4" onSubmit={handleProfileSubmit}>
              <div>
                <h3 className="text-lg font-semibold">Profile Information</h3>
                <p className="text-sm text-gray-600">
                  Update your personal information and contact details
                </p>
              </div>
              <Separator />

              {profileMessage && (
                <Alert
                  variant={profileMessage.type === 'error' ? 'destructive' : 'default'}
                  className={
                    profileMessage.type === 'error'
                      ? ''
                      : 'border-emerald-200/70 bg-emerald-50/60 text-sm text-gray-700'
                  }
                >
                  <AlertDescription>{profileMessage.text}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    value={profileForm.firstName}
                    onChange={handleProfileChange('firstName')}
                    autoComplete="given-name"
                    disabled={!user || isSavingProfile}
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    value={profileForm.lastName}
                    onChange={handleProfileChange('lastName')}
                    autoComplete="family-name"
                    disabled={!user || isSavingProfile}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={user?.email ?? ''}
                  readOnly
                  disabled
                />
              </div>

              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={profileForm.username}
                  onChange={handleProfileChange('username')}
                  autoComplete="username"
                  disabled={!user || isSavingProfile}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={profileForm.phone}
                    onChange={handleProfileChange('phone')}
                    autoComplete="tel"
                    disabled={!user || isSavingProfile}
                  />
                </div>
                <div>
                  <Label htmlFor="position">Position</Label>
                  <Input
                    id="position"
                    value={user?.position ?? ''}
                    readOnly
                    disabled
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="permissionLevel">Permission Level</Label>
                <Input
                  id="permissionLevel"
                  value={permissionLabel}
                  readOnly
                  disabled
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={!user || !isProfileDirty || isSavingProfile}>
                  {isSavingProfile ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="border border-emerald-100/80 bg-white/90 p-6 shadow-sm">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Security Controls</h3>
                <p className="text-sm text-gray-600">
                  Configure company-wide authentication and identity options
                </p>
              </div>
              <Separator />
              <div className="space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-medium">Allow MFA enrollment</h4>
                    <p className="text-sm text-gray-500">
                      When disabled, new MFA registrations are blocked for all users.
                    </p>
                  </div>
                  <Switch
                    checked={security.allowMfaEnrollment}
                    onCheckedChange={(checked) => updateSecurity({ allowMfaEnrollment: checked })}
                    aria-label="Toggle MFA enrollment"
                  />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-medium">Require MFA for administrators</h4>
                    <p className="text-sm text-gray-500">
                      Admin and super admin accounts will be reminded until MFA is configured.
                    </p>
                  </div>
                  <Switch
                    checked={security.requireMfaForAdmins}
                    onCheckedChange={(checked) => updateSecurity({ requireMfaForAdmins: checked })}
                    aria-label="Toggle administrator MFA requirement"
                  />
                </div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="font-medium">Enable Google OAuth</h4>
                    <p className="text-sm text-gray-500">
                      Allow users to sign in using corporate Google accounts.
                    </p>
                  </div>
                  <Switch
                    checked={security.googleOAuthEnabled}
                    onCheckedChange={(checked) => updateSecurity({ googleOAuthEnabled: checked })}
                    aria-label="Toggle Google OAuth login"
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="border border-emerald-100/80 bg-white/90 p-6 shadow-sm">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Password</h3>
                <p className="text-sm text-gray-600">
                  Change your account password
                </p>
              </div>
              <Separator />

              <form className="space-y-4 max-w-md" onSubmit={handlePasswordSubmit}>
                {passwordMessage && (
                  <Alert variant={passwordMessage.type === 'error' ? 'destructive' : 'default'}>
                    <AlertDescription>{passwordMessage.text}</AlertDescription>
                  </Alert>
                )}

                <div>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    placeholder="Enter current password"
                    value={passwordForm.currentPassword}
                    onChange={handlePasswordChange('currentPassword')}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Enter new password"
                    value={passwordForm.newPassword}
                    onChange={handlePasswordChange('newPassword')}
                    minLength={8}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordChange('confirmPassword')}
                    minLength={8}
                    required
                  />
                </div>

                <Button type="submit" disabled={!isPasswordFormValid || isUpdatingPassword}>
                  {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
            </div>
          </Card>

          <div className="rounded-2xl border border-emerald-100/80 bg-white/80 p-1 shadow-sm">
            <MFASetup />
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card className="border border-emerald-100/80 bg-white/90 p-6 shadow-sm">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Notification Preferences</h3>
                <p className="text-sm text-gray-600">
                  Manage how you receive notifications
                </p>
              </div>
              <Separator />

              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Notification settings are not yet available.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6">
          <Card className="border border-emerald-100/80 bg-white/90 p-6 shadow-sm">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Appearance Settings</h3>
                <p className="text-sm text-gray-600">
                  Customize the look and feel of your dashboard
                </p>
              </div>
              <Separator />

              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Appearance settings are not yet available.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
