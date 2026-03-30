"use client";

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPut, apiPatch } from '@/lib/apiClient';
import { toast } from 'react-hot-toast';
import { Loader2, Shield, MapPin, Wifi, Building2, Clock, CalendarDays } from 'lucide-react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

// 1. Move helpers out of the component to prevent re-creation
const formatTimeLabel = (time: string) => {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:${(m || 0).toString().padStart(2, '0')} ${period}`;
};

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [savingLeaves, setSavingLeaves] = useState(false);
  const [totalLeavesInput, setTotalLeavesInput] = useState<number>(0);

  // 2. Transition to useQuery for consistency and better caching
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => apiGet('/api/settings'),
  });

  const { data: totalLeaves, isLoading: leavesLoading } = useQuery({
    queryKey: ['total-leaves'],
    queryFn: () => apiGet('/api/settings?type=total-leaves'),
  });

  // Sync totalLeavesInput with the fetched value once it arrives
  useEffect(() => {
    if (totalLeaves !== undefined) {
      setTotalLeavesInput(totalLeaves);
    }
  }, [totalLeaves]);

  const isAdmin = useMemo(() => user?.role === 'admin', [user?.role]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Only admins can update settings.');
      return;
    }

    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const result = await apiPut('/api/settings', {
      organization_name: formData.get('organization_name'),
      allowed_ip_range: formData.get('allowed_ip_range'),
      office_lat: formData.get('office_lat'),
      office_lng: formData.get('office_lng'),
      allowed_radius_meters: formData.get('allowed_radius_meters'),
      office_start_time: formData.get('office_start_time'),
      office_end_time: formData.get('office_end_time'),
    });

    if (result.success) {
      toast.success("Settings saved successfully!");
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    } else {
      toast.error(result.error || 'Failed to update settings.');
    }
    setSaving(false);
  };

  const handleUpdateTotalLeaves = async () => {
    if (totalLeavesInput < 0 || totalLeavesInput > 365) {
      toast.error('Value must be between 0 and 365.');
      return;
    }
    setSavingLeaves(true);
    const result = await apiPatch('/api/settings', { action: 'updateTotalLeaves', newTotal: totalLeavesInput });
    if (result.success) {
      toast.success(result.message ?? 'Leave quota updated.');
      queryClient.invalidateQueries({ queryKey: ['total-leaves'] });
    } else {
      toast.error(result.error ?? 'Failed to update quota.');
    }
    setSavingLeaves(false);
  };

  // 3. Progressive Loading Strategy: Render Header immediately
  return (
    <div className="space-y-6 animate-fade-up max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure attendance validation and company settings</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Office Hours */}
        <div className="stat-card space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold">Office Hours</h2>
          </div>
          {settingsLoading ? (
             <Skeleton width="80%" height={14} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
          ) : (
             <p className="text-sm text-muted-foreground">
                Set the office working hours. Employees can only check-in and check-out within this time window.
                {settings?.office_start_time && settings?.office_end_time && (
                  <span className="ml-1 font-medium text-foreground">
                    Currently: {formatTimeLabel(settings.office_start_time)} – {formatTimeLabel(settings.office_end_time)}
                  </span>
                )}
              </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Office Start Time</label>
              {settingsLoading ? (
                <Skeleton width="100%" height={38} borderRadius={6} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
              ) : (
                <input
                  type="time"
                  name="office_start_time"
                  defaultValue={settings?.office_start_time?.substring(0, 5) || '09:00'}
                  disabled={!isAdmin}
                  className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Office End Time</label>
              {settingsLoading ? (
                <Skeleton width="100%" height={38} borderRadius={6} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
              ) : (
                <input
                  type="time"
                  name="office_end_time"
                  defaultValue={settings?.office_end_time?.substring(0, 5) || '19:00'}
                  disabled={!isAdmin}
                  className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
                />
              )}
            </div>
          </div>
          {!isAdmin && !settingsLoading && (
            <p className="text-xs text-muted-foreground italic">Only administrators can change office hours.</p>
          )}
        </div>

        {/* IP Validation */}
        <div className="stat-card space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Wifi className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">IP Address Validation</h2>
          </div>
          <p className="text-sm text-muted-foreground">Set the allowed office IP range for attendance check-in validation.</p>

          <div>
            <label className="block text-sm font-medium mb-1">Office IP Range (CIDR)</label>
            {settingsLoading ? (
              <Skeleton width="100%" height={38} borderRadius={6} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
            ) : (
              <input
                type="text"
                name="allowed_ip_range"
                defaultValue={settings?.allowed_ip_range || ''}
                disabled={!isAdmin}
                className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
                placeholder="e.g. 192.168.1.0/24"
              />
            )}
          </div>
        </div>

        {/* Geo-fencing */}
        <div className="stat-card space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-success" />
            <h2 className="text-lg font-semibold">Geo-fencing Configuration</h2>
          </div>
          <p className="text-sm text-muted-foreground">Set the office location and allowed radius for geo-fence validation.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Latitude</label>
              {settingsLoading ? (
                 <Skeleton width="100%" height={38} borderRadius={6} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
              ) : (
                <input
                  type="number"
                  step="any"
                  name="office_lat"
                  defaultValue={settings?.office_lat || ''}
                  disabled={!isAdmin}
                  className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Longitude</label>
              {settingsLoading ? (
                 <Skeleton width="100%" height={38} borderRadius={6} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
              ) : (
                <input
                  type="number"
                  step="any"
                  name="office_lng"
                  defaultValue={settings?.office_lng || ''}
                  disabled={!isAdmin}
                  className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Radius (m)</label>
              {settingsLoading ? (
                 <Skeleton width="100%" height={38} borderRadius={6} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
              ) : (
                <input
                  type="number"
                  name="allowed_radius_meters"
                  defaultValue={settings?.allowed_radius_meters || 100}
                  disabled={!isAdmin}
                  className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
                />
              )}
            </div>
          </div>
        </div>

        {/* Casual Leave Policy */}
        <div className="stat-card space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <CalendarDays className="w-5 h-5 text-info" />
            <h2 className="text-lg font-semibold">Casual Leave Policy</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Set the total number of casual leaves allocated to every employee per year.
            Changing this will adjust all employees' leave balances by the difference.
          </p>

          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-[200px]">
              <label className="block text-sm font-medium mb-1">Total Casual Leaves</label>
              {leavesLoading ? (
                 <Skeleton width="100%" height={38} borderRadius={6} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
              ) : (
                <input
                  type="number"
                  min={0}
                  max={365}
                  value={totalLeavesInput}
                  onChange={(e) => setTotalLeavesInput(Number(e.target.value))}
                  disabled={!isAdmin || savingLeaves}
                  className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
                />
              )}
            </div>
            {isAdmin && !leavesLoading && (
              <button
                type="button"
                disabled={savingLeaves}
                onClick={handleUpdateTotalLeaves}
                className="flex items-center gap-2 bg-info text-white px-4 py-2 rounded-lg font-medium hover:bg-info/90 transition-colors disabled:opacity-50 text-sm"
              >
                {savingLeaves && <Loader2 className="w-4 h-4 animate-spin" />}
                {savingLeaves ? 'Applying...' : 'Apply to All'}
              </button>
            )}
          </div>
          {!isAdmin && !leavesLoading && (
            <p className="text-xs text-muted-foreground italic">Only administrators can change leave quotas.</p>
          )}
        </div>

        {/* Company Settings */}
        <div className="stat-card space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-warning" />
            <h2 className="text-lg font-semibold">Company Settings</h2>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Company Name</label>
            {settingsLoading ? (
              <Skeleton width="100%" height={38} borderRadius={6} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
            ) : (
              <input
                type="text"
                name="organization_name"
                defaultValue={settings?.organization_name || ''}
                disabled={!isAdmin}
                className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
              />
            )}
          </div>
        </div>

        {/* Save Button */}
        {isAdmin && !settingsLoading && (
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-primary text-primary-foreground px-6 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        )}

        {!isAdmin && !settingsLoading && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-2 text-sm">
            <Shield className="w-4 h-4" />
            Only administrators can update these settings.
          </div>
        )}

      </form>
    </div>
  );
}
