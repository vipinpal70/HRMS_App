"use client";

import { useState, useEffect } from 'react';
import { Clock, CheckCircle2, XCircle, MapPin, Wifi, Loader2, Users, Search } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { getAttendanceHistory } from '../actions/attendance';
import { useAuth } from '../context/AuthContext';

interface AttendanceRecord {
  date: string;
  check_in: string;
  check_out: string;
  total_minutes: string;
  ipValid: boolean;
  locationValid: boolean;
  status: 'present' | 'absent' | 'half-day' | 'wfh' | 'leave' | 'late' | 'auto_checkout';
  employee_name?: string;
  employee_email?: string;
}

const statusStyles: Record<string, string> = {
  present: 'bg-success/10 text-success',
  absent: 'bg-destructive/10 text-destructive',
  'half-day': 'bg-warning/10 text-warning',
  wfh: 'bg-info/10 text-info',
  leave: 'bg-muted text-muted-foreground',
  late: 'bg-warning/10 text-warning',
  auto_checkout: 'bg-muted text-muted-foreground'
};

export default function AttendancePage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<string>('all');
  const [viewAll, setViewAll] = useState(false); // Toggle for Admin/HR
  const [searchQuery, setSearchQuery] = useState(''); // Search by name/email
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        // If viewAll is true and user is admin/hr, fetch all
        const userId = viewAll ? 'all' : undefined;
        const data = await getAttendanceHistory(userId);
        setRecords(data as any);
      } catch (error) {
        console.error('Failed to load attendance:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [viewAll]); // Re-fetch when viewAll toggles

  const filtered = records.filter((r) => {
    const matchesStatus = filter === 'all' || r.status === filter;
    const matchesSearch = !viewAll || !searchQuery || 
      (r.employee_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
       r.employee_email?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });
  const canViewAll = user?.role === 'admin' || user?.role === 'hr';

  if (loading) {
      return (
          <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
      )
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold">Attendance History</h1>
        <p className="text-muted-foreground text-sm mt-1">Track your daily check-ins and validations</p>
      </div>

      {/* Filters & View Toggle */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full lg:w-auto">
          {viewAll && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search employee..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {['all', 'present', 'absent', 'half-day', 'wfh', 'leave'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                  filter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
        </div>

        {canViewAll && (
          <button
            onClick={() => setViewAll(!viewAll)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              viewAll
                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            }`}
          >
            <Users className="w-4 h-4" />
            {viewAll ? 'View My Attendance' : 'Viewing All Employees'}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="stat-card overflow-x-auto">
        {records.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
                <p>No attendance records found.</p>
            </div>
        ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              {viewAll && <th className="text-left py-3 px-2 font-medium">Employee</th>}
              <th className="text-left py-3 px-2 font-medium">Date</th>
              <th className="text-left py-3 px-2 font-medium">Check In</th>
              <th className="text-left py-3 px-2 font-medium">Check Out</th>
              <th className="text-left py-3 px-2 font-medium">Hours</th>
              <th className="text-center py-3 px-2 font-medium">
                <Wifi className="w-4 h-4 inline" />
              </th>
              <th className="text-center py-3 px-2 font-medium">
                <MapPin className="w-4 h-4 inline" />
              </th>
              <th className="text-left py-3 px-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((record, i) => (
              <tr key={i} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                {viewAll && (
                  <td className="py-3 px-2 font-medium flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {record.employee_name?.charAt(0)}
                    </div>
                    {record.employee_name}
                  </td>
                )}
                <td className="py-3 px-2 font-medium">{record.date}</td>
                <td className="py-3 px-2 font-mono text-xs">{record.check_in}</td>
                <td className="py-3 px-2 font-mono text-xs">{record.check_out}</td>
                <td className="py-3 px-2 font-mono text-xs">{record.total_minutes}</td>
                <td className="py-3 px-2 text-center">
                  {record.ipValid ? (
                    <CheckCircle2 className="w-4 h-4 text-success inline" />
                  ) : (
                    <XCircle className="w-4 h-4 text-muted-foreground/40 inline" />
                  )}
                </td>
                <td className="py-3 px-2 text-center">
                  {record.locationValid ? (
                    <CheckCircle2 className="w-4 h-4 text-success inline" />
                  ) : (
                    <XCircle className="w-4 h-4 text-muted-foreground/40 inline" />
                  )}
                </td>
                <td className="py-3 px-2">
                  <span className={`badge-status capitalize ${statusStyles[record.status] || 'bg-secondary'}`}>
                    {record.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
