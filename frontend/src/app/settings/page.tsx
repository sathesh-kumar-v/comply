'use client';

import { useState } from 'react';
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

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'appearance'>('profile');
  const { security, updateSecurity } = useSettings();

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
              {user?.permission_level && (
                <Badge variant="outline" className="border-emerald-200 bg-white/70 text-emerald-700">
                  {user.permission_level.replace(/_/g, ' ')} access
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
              <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Profile Information</h3>
                <p className="text-sm text-gray-600">
                  Update your personal information and contact details
                </p>
              </div>
              <Separator />
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input
                    id="firstName"
                    defaultValue={user?.first_name}
                    disabled
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input
                    id="lastName"
                    defaultValue={user?.last_name}
                    disabled
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  defaultValue={user?.email}
                  disabled
                />
              </div>

              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  defaultValue={user?.username}
                  disabled
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    defaultValue={user?.phone || ''}
                    disabled
                  />
                </div>
                <div>
                  <Label htmlFor="position">Position</Label>
                  <Input
                    id="position"
                    defaultValue={user?.position || ''}
                    disabled
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="permissionLevel">Permission Level</Label>
                <Input
                  id="permissionLevel"
                  defaultValue={user?.permission_level?.replace(/_/g, ' ') || 'View only'}
                  disabled
                  className="capitalize"
                />
              </div>

              <div className="flex justify-end">
                <Button disabled>
                  Save Changes
                </Button>
              </div>
            </div>
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

              <div className="space-y-4 max-w-md">
                <div>
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    placeholder="Enter current password"
                  />
                </div>

                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Enter new password"
                  />
                </div>

                <div>
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                  />
                </div>

                <Button disabled>
                  Update Password
                </Button>
              </div>
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
