"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Calendar, Send, CheckCircle2, XCircle, Clock, Search, Users, AlertTriangle, Trash, Loader2 } from 'lucide-react';
import { getLeaveRequests, createLeaveRequest, updateLeaveStatus, deleteLeaveRequest } from '../actions/leave';
import { toast } from 'sonner';

type LeaveType = 'full-day' | 'half-day' | 'wfh' | 'hybrid';
type LeaveStatus = 'pending' | 'approved' | 'rejected';

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

const statusIcons = { pending: Clock, approved: CheckCircle2, rejected: XCircle };
const statusColors = {
  pending: 'bg-warning/10 text-warning',
  approved: 'bg-success/10 text-success',
  rejected: 'bg-destructive/10 text-destructive',
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getLeaveRequests();
      setRequests(data as any);
    } catch (error) {
      console.error('Failed to load leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);


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

  const handleApproval = async (id: string, status: LeaveStatus) => {
    // Only allow 'approved' or 'rejected'
    if (status === 'pending') return;

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

  // Detect overlapping date ranges: find date keys that appear more than once
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

        <div className="flex gap-2 w-full sm:w-auto">
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
      <div className="space-y-3">
        {filteredRequests.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-lg">No requests found.</div>
        ) : (
          filteredRequests.map((req) => {
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

                    {isAdmin && req.status !== 'pending' && (
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
