"use client";

import { useState, useEffect, useCallback, useTransition } from 'react';
import {
  Clock, CheckCircle2, XCircle, MapPin, Wifi, Loader2,
  Users, ChevronLeft, ChevronRight, Download, CalendarDays,
  TrendingUp, UserCheck, AlertCircle, Coffee, Search, X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getMyAttendance, getEmployeesAttendance, getEmployeeListForFilter } from '../actions/attendance';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AttendanceRecord {
  id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  check_in_display: string | null;
  check_out_display: string | null;
  hours_display: string | null;
  total_minutes: number | null;
  status: string;
  work_type: string | null;
  employee_name?: string;
  employee_email?: string;
  employee_emp_id?: string;
  employee_designation?: string;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  emp_id?: string;
  designation?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function formatDateDisplay(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
}

function isToday(dateStr: string) {
  const today = new Date();
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear();
}

const statusConfig: Record<string, { label: string; cls: string }> = {
  present:       { label: 'Present',     cls: 'bg-emerald-600 text-white' },
  on_time:       { label: 'On Time',     cls: 'bg-emerald-600 text-white' },
  late:          { label: 'Late',        cls: 'bg-amber-500 text-white' },
  absent:        { label: 'Absent',      cls: 'bg-red-500 text-white' },
  half_day:      { label: 'Half Day',    cls: 'bg-orange-500 text-white' },
  'half-day':    { label: 'Half Day',    cls: 'bg-orange-500 text-white' },
  wfh:           { label: 'WFH',         cls: 'bg-blue-500 text-white' },
  leave:         { label: 'Leave',       cls: 'bg-purple-500 text-white' },
  auto_checkout: { label: 'Auto C/O',    cls: 'bg-slate-500 text-white' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? { label: status, cls: 'bg-gray-500 text-white' };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize shadow-sm ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── Excel Export (CSV) ───────────────────────────────────────────────────────

function exportToCSV(records: AttendanceRecord[], fileName: string) {
  const isAdmin = 'employee_name' in (records[0] ?? {});
  const headers = isAdmin
    ? ['Employee', 'Employee ID', 'Designation', 'Date', 'Check In', 'Check Out', 'Hours', 'Work Type', 'Status']
    : ['Date', 'Check In', 'Check Out', 'Hours', 'Work Type', 'Status'];

  const rows = records.map(r =>
    isAdmin
      ? [
          r.employee_name ?? '',
          r.employee_emp_id ?? '',
          r.employee_designation ?? '',
          r.date,
          r.check_in_display ?? '',
          r.check_out_display ?? '',
          r.hours_display ?? '',
          r.work_type ?? '',
          r.status,
        ]
      : [r.date, r.check_in_display ?? '', r.check_out_display ?? '', r.hours_display ?? '', r.work_type ?? '', r.status]
  );

  const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Month Picker ─────────────────────────────────────────────────────────────

function MonthPicker({
  month, year, onChange,
}: {
  month: number; year: number; onChange: (m: number, y: number) => void;
}) {
  const prev = () => {
    if (month === 1) onChange(12, year - 1);
    else onChange(month - 1, year);
  };
  const next = () => {
    const now = new Date();
    if (year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)) return;
    if (month === 12) onChange(1, year + 1);
    else onChange(month + 1, year);
  };
  const isCurrentMonth = month === new Date().getMonth() + 1 && year === new Date().getFullYear();

  return (
    <div className="flex items-center gap-1 bg-secondary/60 rounded-lg px-1 py-1">
      <button onClick={prev} className="p-1.5 rounded-md hover:bg-background transition-colors">
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="px-2 text-sm font-semibold min-w-[120px] text-center">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <button
        onClick={next}
        disabled={isCurrentMonth}
        className="p-1.5 rounded-md hover:bg-background transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Stats Cards ──────────────────────────────────────────────────────────────

function StatsRow({ records }: { records: AttendanceRecord[] }) {
  // "Present" = total check-ins (any record that has a check_in time)
  const present = records.filter(r => r.check_in != null).length;
  // "Late" = only records explicitly marked as late
  const late = records.filter(r => r.status === 'late').length;
  const absent = records.filter(r => r.status === 'absent').length;
  const wfh = records.filter(r => r.work_type === 'wfh' || r.status === 'wfh').length;
  const totalMin = records.reduce((acc, r) => acc + (r.total_minutes ?? 0), 0);
  const totalHrs = Math.floor(totalMin / 60);
  const totalMins = totalMin % 60;

  const stats = [
    { label: 'Present',     value: present,                        icon: UserCheck,   accentColor: '#10b981', iconBg: 'bg-emerald-500' },
    { label: 'Late',        value: late,                           icon: Clock,       accentColor: '#f59e0b', iconBg: 'bg-amber-500' },
    { label: 'Absent',      value: absent,                         icon: AlertCircle, accentColor: '#ef4444', iconBg: 'bg-red-500' },
    { label: 'WFH',         value: wfh,                            icon: Coffee,      accentColor: '#3b82f6', iconBg: 'bg-blue-500' },
    { label: 'Total Hours', value: `${totalHrs}h ${totalMins}m`,   icon: TrendingUp,  accentColor: '#8b5cf6', iconBg: 'bg-violet-500' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {stats.map(s => (
        <div
          key={s.label}
          className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md"
          style={{ borderLeftWidth: '4px', borderLeftColor: s.accentColor }}
        >
          <div className={`p-2 rounded-lg ${s.iconBg} text-white`}>
            <s.icon className="w-4 h-4" />
          </div>
          <div>
            <p className="text-lg font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Attendance Table ─────────────────────────────────────────────────────────

function AttendanceTable({
  records, showEmployee, loading,
}: {
  records: AttendanceRecord[]; showEmployee: boolean; loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <CalendarDays className="w-10 h-10 opacity-30" />
        <p className="text-sm">No attendance records found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wide">
            {showEmployee && <th className="text-left py-3 px-3 font-medium">Employee</th>}
            <th className="text-left py-3 px-3 font-medium">Date</th>
            <th className="text-left py-3 px-3 font-medium">Check In</th>
            <th className="text-left py-3 px-3 font-medium">Check Out</th>
            <th className="text-left py-3 px-3 font-medium">Hours</th>
            <th className="text-left py-3 px-3 font-medium">Type</th>
            <th className="text-left py-3 px-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, i) => (
            <tr
              key={record.id ?? i}
              className={`border-b border-border/40 last:border-0 transition-colors hover:bg-muted/30 ${
                isToday(record.date) ? 'bg-primary/5' : ''
              }`}
            >
              {showEmployee && (
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {record.employee_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate max-w-[140px]">{record.employee_name}</p>
                      {record.employee_emp_id && (
                        <p className="text-xs text-muted-foreground">{record.employee_emp_id}</p>
                      )}
                    </div>
                  </div>
                </td>
              )}
              <td className="py-3 px-3">
                <div className="flex items-center gap-1.5">
                  {isToday(record.date) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  )}
                  <span className={isToday(record.date) ? 'font-semibold text-primary' : 'font-medium'}>
                    {formatDateDisplay(record.date)}
                  </span>
                </div>
              </td>
              <td className="py-3 px-3 text-sm font-medium">
                {record.check_in_display
                  ? <span className="text-emerald-600 dark:text-emerald-400">{record.check_in_display}</span>
                  : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="py-3 px-3 text-sm font-medium">
                {record.check_out_display
                  ? <span className="text-sky-600 dark:text-sky-400">{record.check_out_display}</span>
                  : <span className="text-muted-foreground">—</span>}
              </td>
              <td className="py-3 px-3 text-xs font-medium">
                {record.hours_display ?? <span className="text-muted-foreground">—</span>}
              </td>
              <td className="py-3 px-3">
                {record.work_type ? (
                  <span className="text-xs capitalize px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                    {record.work_type === 'wfh' ? 'WFH' : record.work_type}
                  </span>
                ) : <span className="text-muted-foreground text-xs">—</span>}
              </td>
              <td className="py-3 px-3">
                <StatusBadge status={record.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── My Attendance (Employee View) ────────────────────────────────────────────

function MyAttendanceView() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const fetch = useCallback(() => {
    setLoading(true);
    startTransition(async () => {
      try {
        const data = await getMyAttendance(month, year);
        setRecords(data as AttendanceRecord[]);
      } catch {
        toast.error('Failed to load attendance');
      } finally {
        setLoading(false);
      }
    });
  }, [month, year]);

  useEffect(() => { fetch(); }, [fetch]);

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <MonthPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
        {records.length > 0 && (
          <button
            onClick={() => exportToCSV(records, `my-attendance-${MONTH_NAMES[month - 1]}-${year}`)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        )}
      </div>

      {/* Stats */}
      {!loading && records.length > 0 && <StatsRow records={records} />}

      {/* Table */}
      <div className="stat-card !p-0 overflow-hidden">
        <AttendanceTable records={records} showEmployee={false} loading={loading} />
      </div>
    </div>
  );
}

// ─── All Employees Attendance (Admin/HR View) ─────────────────────────────────

function AllEmployeesView() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [selectedEmployee, setSelectedEmployee] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [empLoading, setEmpLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  // Load employee list once
  useEffect(() => {
    startTransition(async () => {
      try {
        const data = await getEmployeeListForFilter();
        setEmployees(data as Employee[]);
      } catch {
        toast.error('Failed to load employees');
      } finally {
        setEmpLoading(false);
      }
    });
  }, []);

  const fetch = useCallback(() => {
    setLoading(true);
    startTransition(async () => {
      try {
        const data = await getEmployeesAttendance(month, year, selectedEmployee);
        setRecords(data as AttendanceRecord[]);
      } catch {
        toast.error('Failed to load attendance');
      } finally {
        setLoading(false);
      }
    });
  }, [month, year, selectedEmployee]);

  useEffect(() => { fetch(); }, [fetch]);

  const selectedEmpName = employees.find(e => e.id === selectedEmployee)?.name;
  const exportFileName = selectedEmployee === 'all'
    ? `team-attendance-${MONTH_NAMES[month - 1]}-${year}`
    : `${selectedEmpName?.replace(/\s+/g, '-')}-attendance-${MONTH_NAMES[month - 1]}-${year}`;

  // Client-side search filter (name, email, emp_id)
  const q = searchQuery.trim().toLowerCase();
  const filteredRecords = q
    ? records.filter(r =>
        r.employee_name?.toLowerCase().includes(q) ||
        r.employee_email?.toLowerCase().includes(q) ||
        r.employee_emp_id?.toLowerCase().includes(q)
      )
    : records;

  return (
    <div className="space-y-5">
      {/* Filter bar – row 1: dropdown + month + export */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Employee filter */}
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <select
              value={selectedEmployee}
              onChange={e => { setSelectedEmployee(e.target.value); setSearchQuery(''); }}
              disabled={empLoading}
              className="pl-9 pr-8 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring appearance-none min-w-[200px] disabled:opacity-60"
            >
              <option value="all">All Employees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}{emp.emp_id ? ` (${emp.emp_id})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Month picker */}
          <MonthPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
        </div>

        {/* Export – exports only what's currently shown (filtered) */}
        {filteredRecords.length > 0 && (
          <button
            onClick={() => exportToCSV(filteredRecords, exportFileName)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm"
          >
            <Download className="w-4 h-4" /> Export to Excel
          </button>
        )}
      </div>

      {/* Search bar – only shown when viewing All Employees */}
      {selectedEmployee === 'all' && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by employee name, email or ID…"
            className="w-full pl-9 pr-9 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Match count badge when searching */}
      {q && (
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-medium text-foreground">{filteredRecords.length}</span> of {records.length} records
          {` matching "`}<span className="font-medium text-foreground">{searchQuery}</span>{`"`}
        </p>
      )}

      {/* Stats – reflect the current search/filter */}
      {!loading && filteredRecords.length > 0 && <StatsRow records={filteredRecords} />}

      {/* Table */}
      <div className="stat-card !p-0 overflow-hidden">
        <AttendanceTable records={filteredRecords} showEmployee={selectedEmployee === 'all'} loading={loading} />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const { user } = useAuth();
  const isAdminOrHR = user?.role === 'admin' || user?.role === 'hr';

  // Tab state: 'mine' or 'all'
  const [tab, setTab] = useState<'mine' | 'all'>('mine');

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdminOrHR
              ? 'Manage and review team attendance records'
              : 'View your monthly attendance history'}
          </p>
        </div>
      </div>

      {/* Tabs (Admin/HR only) */}
      {isAdminOrHR && (
        <div className="flex gap-1 p-1 bg-secondary/60 rounded-xl w-fit">
          <button
            onClick={() => setTab('mine')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === 'mine'
                ? 'bg-background shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            My Attendance
          </button>
          <button
            onClick={() => setTab('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
              tab === 'all'
                ? 'bg-background shadow text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-4 h-4" />
            All Employees
          </button>
        </div>
      )}

      {/* Content */}
      {(tab === 'mine' || !isAdminOrHR) && <MyAttendanceView />}
      {isAdminOrHR && tab === 'all' && <AllEmployeesView />}
    </div>
  );
}
