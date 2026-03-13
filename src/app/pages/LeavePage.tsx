"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Calendar, Send, CheckCircle2, XCircle, Clock, Search, Users, AlertTriangle, Trash, Loader2 } from 'lucide-react';
import { getLeaveRequests, createLeaveRequest, updateLeaveStatus, deleteLeaveRequest, retractLeaveRequest } from '../actions/leave';
import { toast } from 'react-hot-toast';

type LeaveType = 'full-day' | 'half-day' | 'wfh' | 'hybrid';
type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'retraction_pending';

interface LeaveRequest {
  id: string;
  type: LeaveType;
  start_date: string;
  end_date: string;
  reason: string;
  status: LeaveStatus;
  created_at?: string;
  user_name?: string;
  user_email?: string;
}

const statusIcons = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
  cancelled: Trash,
  retraction_pending: AlertTriangle
};
const statusColors = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
  retraction_pending: 'bg-amber-500/10 text-amber-500',
};

const typeColors: Record<string, string> = {
  'full-day': 'bg-info/10 text-info',
  'half-day': 'bg-accent/10 text-accent',
  wfh: 'bg-primary/10 text-primary',
  hybrid: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
};

const typeLabels: Record<string, string> = {
  'full-day': 'Full Day',
  'half-day': 'Half Day',
  wfh: 'WFH',
  hybrid: 'Hybrid',
};

export default function LeavePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'hr';
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'full-day' as LeaveType, startDate: '', endDate: '', reason: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Date Range Helpers
  const getWeekDates = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(now.getFullYear(), now.getMonth(), diff);
    const sunday = new Date(now.getFullYear(), now.getMonth(), diff + 6);
    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0]
    };
  };

  const getMonthDates = () => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: firstDay.toISOString().split('T')[0],
      end: lastDay.toISOString().split('T')[0]
    };
  };

  const [dateRange, setDateRange] = useState(getMonthDates);
  const [timeFilter, setTimeFilter] = useState<'week' | 'month'>('month');

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getLeaveRequests(isAdmin ? 'all' : undefined, dateRange.start, dateRange.end);

      // Sort: retraction_pending first, then pending, then others
      const sortedData = [...(data as any)].sort((a, b) => {
        const order: Record<string, number> = {
          'retraction_pending': 0,
          'pending': 1,
          'approved': 2,
          'rejected': 3,
          'cancelled': 4
        };
        const statusA = order[a.status] ?? 5;
        const statusB = order[b.status] ?? 5;

        if (statusA !== statusB) return statusA - statusB;

        // Secondary sort by date (newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setRequests(sortedData);
    } catch (error) {
      console.error('Failed to load leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  // Update date range when filter changes
  useEffect(() => {
    if (timeFilter === 'week') {
      setDateRange(getWeekDates());
    } else {
      setDateRange(getMonthDates());
    }
  }, [timeFilter]);


  // Delete Leave Request
  const handleDelete = async (id: string) => {
    const result = await deleteLeaveRequest(id);
    if (result.success) {
      toast.success(result.message);
      fetchData();
    } else {
      toast.error(result.error || 'Failed to delete request.');
    }
  };

  const handleSubmit = async () => {
    if (!form.startDate || !form.reason) return;

    const formData = new FormData();
    formData.append('type', form.type);
    formData.append('start_date', form.startDate);
    formData.append('end_date', form.endDate || form.startDate);
    formData.append('reason', form.reason);

    const result = await createLeaveRequest(formData);

    if (result.success) {
      toast.success(result.message);
      setForm({ type: 'full-day', startDate: '', endDate: '', reason: '' });
      setShowForm(false);
      fetchData();
    } else {
      toast.error(result.error || 'Failed to submit request.');
    }
  };

  const handleRetract = async (id: string) => {
    const result = await retractLeaveRequest(id);
    if (result.success) {
      toast.success(result.message);
      fetchData();
    } else {
      toast.error(result.error || 'Failed to retract request.');
    }
  };

  const handleApproval = async (id: string, status: 'approved' | 'rejected' | 'cancelled') => {
    // Only allow 'approved', 'rejected' or 'cancelled'
    const result = await updateLeaveStatus(id, status);
    if (result.success) {
      toast.success(result.message);
      fetchData();
    } else {
      toast.error(result.error || 'Failed to update status.');
    }
  };

  const filteredRequests = requests.filter((r) => {
    const matchesSearch = !isAdmin || !searchQuery ||
      (r.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.user_email?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  // Grouping Logic - Using created_at (Requested On date)
  const groupedRequests = filteredRequests.reduce((acc, req) => {
    // Extract just the date part from created_at
    const date = req.created_at ? new Date(req.created_at).toISOString().split('T')[0] : 'Unknown';
    if (!acc[date]) acc[date] = [];
    acc[date].push(req);
    return acc;
  }, {} as Record<string, LeaveRequest[]>);

  const sortedDates = Object.keys(groupedRequests).sort((a, b) => b.localeCompare(a));

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const compareDate = new Date(dateStr);
    compareDate.setHours(0, 0, 0, 0);

    if (compareDate.getTime() === today.getTime()) return 'Today';
    if (compareDate.getTime() === yesterday.getTime()) return 'Yesterday';

    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Detect overlapping date ranges
  const dateKeyCount: Record<string, number> = {};
  requests.forEach((r) => {
    const key = `${r.start_date}__${r.end_date || r.start_date}`;
    dateKeyCount[key] = (dateKeyCount[key] || 0) + 1;
  });
  const overlappingKeys = new Set(
    Object.entries(dateKeyCount).filter(([, count]) => count > 1).map(([key]) => key)
  );

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Leave & WFH</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdmin ? 'Manage team leave requests' : 'Request time off or work from home'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <div className="flex bg-muted p-1 rounded-xl mr-2">
            <button
              onClick={() => setTimeFilter('week')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${timeFilter === 'week' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Week
            </button>
            <button
              onClick={() => setTimeFilter('month')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${timeFilter === 'month' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Month
            </button>
          </div>

          {isAdmin && (
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          )}

          {!isAdmin && (
            <Button onClick={() => setShowForm(!showForm)} className="bg-primary text-primary-foreground">
              <Send className="w-4 h-4 mr-2" /> New Request
            </Button>
          )}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="stat-card space-y-4">
          <h2 className="font-semibold">New Leave Request</h2>
          <div className="flex flex-wrap gap-2">
            {(['full-day', 'half-day', 'wfh', 'hybrid'] as LeaveType[]).map((t) => (
              <button
                key={t}
                onClick={() => setForm({ ...form, type: t })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${form.type === t
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
                  }`}
              >
                {typeLabels[t] ?? t}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Start Date</label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">End Date</label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          {form.startDate && (
            <p className="text-xs text-muted-foreground">
              Total days:{' '}
              <span className="font-semibold text-foreground">
                {(() => {
                  const start = new Date(form.startDate);
                  const end = new Date(form.endDate || form.startDate);
                  const diff = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
                  return diff > 0 ? `${diff} day${diff > 1 ? 's' : ''}` : '—';
                })()}
              </span>
            </p>
          )}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Reason</label>
            <Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason for leave..." />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSubmit} className="bg-primary text-primary-foreground">Submit</Button>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Requests */}
      <div className="space-y-8">
        {loading ? (
          <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-lg">No requests found.</div>
        ) : (
          sortedDates.map((dateStr) => (
            <div key={dateStr} className="space-y-4">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  {formatDateHeader(dateStr)}
                </h2>
                <div className="h-px w-full bg-border/60"></div>
              </div>

              <div className="space-y-3">
                {groupedRequests[dateStr].map((req) => {
                  const StatusIcon = statusIcons[req.status];
                  return (
                    <div key={req.id} className={`stat-card flex flex-col sm:flex-row sm:items-center gap-3 ${isAdmin && overlappingKeys.has(`${req.start_date}__${req.end_date || req.start_date}`)
                      ? 'border-l-4 border-l-amber-500'
                      : ''
                      }`}>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`badge-status capitalize ${typeColors[req.type] ?? 'bg-secondary text-secondary-foreground'}`}>{typeLabels[req.type] ?? req.type}</span>
                            <span className={`badge-status capitalize ${statusColors[req.status]}`}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {req.status}
                            </span>
                            {isAdmin && <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded">by {req.user_name}</span>}
                            {isAdmin && overlappingKeys.has(`${req.start_date}__${req.end_date || req.start_date}`) && (
                              <span className="flex items-center gap-1 text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                                <AlertTriangle className="w-3 h-3" /> Overlapping
                              </span>
                            )}
                          </div>

                          {isAdmin && req.status !== 'pending' && req.status !== 'retraction_pending' && (
                            <button onClick={() => handleDelete(req.id)} className="flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded">
                              <Trash className="w-3 h-3" />
                              {loading ? 'Deleting...' : 'Delete'}
                            </button>
                          )}
                        </div>
                        <p className="text-sm">{req.reason}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {req.start_date} {req.end_date !== req.start_date && `→ ${req.end_date}`}
                          {' '}·{' '}
                          {(() => {
                            const start = new Date(req.start_date);
                            const end = new Date(req.end_date || req.start_date);
                            const diff = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
                            return `${diff} day${diff > 1 ? 's' : ''}`;
                          })()}
                        </p>
                        {req.created_at && (
                          <p className="text-xs text-muted-foreground">
                            Requested on{' '}
                            {new Date(req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' at '}
                            {new Date(req.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </p>
                        )}
                      </div>
                      {isAdmin && req.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleApproval(req.id, 'approved')} className="bg-success text-success-foreground hover:bg-success/90">
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleApproval(req.id, 'rejected')} className="border-destructive text-destructive hover:bg-destructive/10">
                            Reject
                          </Button>
                        </div>
                      )}

                      {isAdmin && req.status === 'retraction_pending' && (
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleApproval(req.id, 'cancelled')} className="border-success text-success bg-success/10 hover:bg-success/20">
                            Approve Retraction
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleApproval(req.id, 'approved')} className="border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive">
                            Reject Retraction
                          </Button>
                        </div>
                      )}

                      {!isAdmin && (req.status === 'pending' || req.status === 'approved') && (
                        <div className="flex gap-2">
                          {(() => {
                            const startDate = new Date(req.start_date);
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const tomorrow = new Date(today);
                            tomorrow.setDate(today.getDate() + 1);

                            const canRetract = startDate > tomorrow;

                            return canRetract && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRetract(req.id)}
                                className="border-warning text-warning hover:text-warning hover:bg-warning/10 text-xs py-1 h-auto"
                              >
                                {req.status === 'pending' ? 'Cancel' : 'Retract'}
                              </Button>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
