"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getCompanySettings, updateCompanySettings, updateTotalLeaves, getCurrentTotalLeaves } from '../actions/settings';
import { toast } from 'react-hot-toast';
import { Loader2, Shield, MapPin, Wifi, Building2, Clock, CalendarDays } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [totalLeaves, setTotalLeaves] = useState<number>(20);
  const [savingLeaves, setSavingLeaves] = useState(false);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const [data, currentLeaves] = await Promise.all([
          getCompanySettings(),
          getCurrentTotalLeaves(),
        ]);
        setSettings(data);
        setTotalLeaves(currentLeaves);
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (user?.role !== 'admin') {
      toast.error('Only admins can update settings.');
      return;
    }

    setSaving(true);
    const formData = new FormData(e.currentTarget);

    const result = await updateCompanySettings(formData);

    if (result.success) {
      const updated = Object.fromEntries(formData.entries());
      setSettings((prev: any) => ({ ...prev, ...updated }));
      toast.success("Settings saved successfully!");
    } else {
      toast.error(result.error || 'Failed to update settings.');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const isAdmin = user?.role === 'admin';

  // Helper to format time for display
  const formatTimeLabel = (time: string) => {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:${(m || 0).toString().padStart(2, '0')} ${period}`;
  };

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
          <p className="text-sm text-muted-foreground">
            Set the office working hours. Employees can only check-in and check-out within this time window.
            {settings?.office_start_time && settings?.office_end_time && (
              <span className="ml-1 font-medium text-foreground">
                Currently: {formatTimeLabel(settings.office_start_time)} – {formatTimeLabel(settings.office_end_time)}
              </span>
            )}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Office Start Time</label>
              <input
                type="time"
                name="office_start_time"
                defaultValue={settings?.office_start_time?.substring(0, 5) || '09:00'}
                disabled={!isAdmin}
                className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Office End Time</label>
              <input
                type="time"
                name="office_end_time"
                defaultValue={settings?.office_end_time?.substring(0, 5) || '19:00'}
                disabled={!isAdmin}
                className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
              />
            </div>
          </div>
          {!isAdmin && (
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
            <input
              type="text"
              name="allowed_ip_range"
              defaultValue={settings?.allowed_ip_range || ''}
              disabled={!isAdmin}
              className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
              placeholder="e.g. 192.168.1.0/24"
            />
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
              <input
                type="number"
                step="any"
                name="office_lat"
                defaultValue={settings?.office_lat || ''}
                disabled={!isAdmin}
                className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Longitude</label>
              <input
                type="number"
                step="any"
                name="office_lng"
                defaultValue={settings?.office_lng || ''}
                disabled={!isAdmin}
                className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Radius (m)</label>
              <input
                type="number"
                name="allowed_radius_meters"
                defaultValue={settings?.allowed_radius_meters || 100}
                disabled={!isAdmin}
                className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
              />
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
              <input
                type="number"
                min={0}
                max={365}
                value={totalLeaves}
                onChange={(e) => setTotalLeaves(Number(e.target.value))}
                disabled={!isAdmin || savingLeaves}
                className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
              />
            </div>
            {isAdmin && (
              <button
                type="button"
                disabled={savingLeaves}
                onClick={async () => {
                  if (totalLeaves < 0 || totalLeaves > 365) {
                    toast.error('Value must be between 0 and 365.');
                    return;
                  }
                  setSavingLeaves(true);
                  const result = await updateTotalLeaves(totalLeaves);
                  if (result.success) {
                    toast.success(result.message ?? 'Leave quota updated.');
                  } else {
                    toast.error(result.error ?? 'Failed to update quota.');
                  }
                  setSavingLeaves(false);
                }}
                className="flex items-center gap-2 bg-info text-white px-4 py-2 rounded-lg font-medium hover:bg-info/90 transition-colors disabled:opacity-50 text-sm"
              >
                {savingLeaves && <Loader2 className="w-4 h-4 animate-spin" />}
                {savingLeaves ? 'Applying...' : 'Apply to All'}
              </button>
            )}
          </div>
          {!isAdmin && (
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
            <input
              type="text"
              name="organization_name"
              defaultValue={settings?.organization_name || ''}
              disabled={!isAdmin}
              className="w-full p-2 border rounded-md bg-background disabled:opacity-50"
            />
          </div>
        </div>

        {/* Save Button */}
        {isAdmin && (
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

        {!isAdmin && (
          <div className="bg-destructive/10 text-destructive p-4 rounded-lg flex items-center gap-2 text-sm">
            <Shield className="w-4 h-4" />
            Only administrators can update these settings.
          </div>
        )}

      </form>
    </div>
  );
}
