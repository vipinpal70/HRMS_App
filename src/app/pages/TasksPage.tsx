"use client";

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, CheckCircle2, Clock, Circle, Search, Users, Calendar as CalendarIcon, Loader2, XCircle, Check, ChevronsUpDown, Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Progress } from '../components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/apiClient';
import { toast } from 'react-hot-toast';
import { useTransition } from 'react';
import { cn } from '@/lib/utils';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  start_day: string;
  end_day: string;
  due_date?: string;
  assignee_name?: string;
  assignee_email?: string;
  assignee_id?: string;
  created_at: string;
}

const statusIcons = {
  pending: Circle,
  in_progress: Clock,
  completed: CheckCircle2,
  cancelled: XCircle
};

const statusColors = {
  pending: 'text-muted-foreground',
  in_progress: 'text-info',
  completed: 'text-success',
  cancelled: 'text-destructive'
};

const priorityColors = {
  low: 'bg-slate-100 text-slate-600',
  medium: 'bg-blue-100 text-blue-600',
  high: 'bg-orange-100 text-orange-600',
  critical: 'bg-red-100 text-red-600'
};

const RECORDS_PER_PAGE = 10;

export default function TasksPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [viewAll, setViewAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  // Add Task Form State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [openAssignee, setOpenAssignee] = useState(false);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);

  // Employee self-add dialog
  const [isSelfAddOpen, setIsSelfAddOpen] = useState(false);
  const [selfSaving, setSelfSaving] = useState(false);

  // Edit/Delete Task State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

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

  const canManageTasks = user?.role === 'admin' || user?.role === 'hr';

  const userId = viewAll ? 'all' : undefined;
  const filteredEmployee = viewAll && employeeFilter !== 'all' ? employeeFilter : undefined;

  const { data: tasksData, isLoading: loading } = useQuery({
    queryKey: ['tasks', userId, dateRange.start, dateRange.end, filteredEmployee],
    queryFn: () => {
      const params = new URLSearchParams();
      if (userId) params.set('userId', userId);
      if (dateRange.start) params.set('startDate', dateRange.start);
      if (dateRange.end) params.set('endDate', dateRange.end);
      if (filteredEmployee) params.set('employeeFilter', filteredEmployee);
      return apiGet(`/api/tasks?${params.toString()}`);
    },
  });

  const rawTasks: Task[] = Array.isArray(tasksData) ? tasksData : [];

  // Sort by latest first across all tasks before searching/paginating
  const allTasksSorted = [...rawTasks].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Client-side filtering (search)
  const filtered = allTasksSorted.filter((t) => {
    const q = searchQuery.toLowerCase();
    return !searchQuery ||
      t.title.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      (viewAll && (
        t.assignee_name?.toLowerCase().includes(q) ||
        t.assignee_email?.toLowerCase().includes(q)
      ));
  });

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / RECORDS_PER_PAGE);
  const paginatedTasks = filtered.slice(
    (currentPage - 1) * RECORDS_PER_PAGE,
    currentPage * RECORDS_PER_PAGE
  );

  // Grouping Logic (apply to paginated set for performance and UI clarity)
  const groupedTasks = paginatedTasks.reduce((acc, task) => {
    const date = task.start_day;
    if (!acc[date]) acc[date] = [];
    acc[date].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  const sortedDates = Object.keys(groupedTasks).sort((a, b) => b.localeCompare(a));

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, employeeFilter, timeFilter, viewAll, dateRange.start, dateRange.end]);

  // Update date range when shortcut changes
  useEffect(() => {
    if (timeFilter === 'week') {
      setDateRange(getWeekDates());
    } else {
      setDateRange(getMonthDates());
    }
  }, [timeFilter]);

  useEffect(() => {
    if (canManageTasks && (isAddOpen || viewAll)) {
      apiGet('/api/tasks?type=employees-list').then(res => {
        if (Array.isArray(res)) setEmployees(res);
      });
      if (isAddOpen) setSelectedAssigneeIds([]);
    }
  }, [canManageTasks, isAddOpen, viewAll]);

  // Trigger 11AM no-task notification check on mount
  useEffect(() => {
    apiPost('/api/tasks', { action: 'checkNotify' }).catch(() => { });
  }, []);

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedAssigneeIds.length === 0) {
      toast.error('Please assign the task to at least one employee.');
      return;
    }
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const result = await apiPost('/api/tasks', {
      action: 'create',
      title: formData.get('title'),
      description: formData.get('description'),
      priority: formData.get('priority'),
      assigned_to: selectedAssigneeIds.join(','),
      start_day: formData.get('start_day'),
      end_day: formData.get('end_day'),
    });

    if (result.success) {
      toast.success(result.message);
      setIsAddOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardTasks'] });
    } else {
      toast.error(result.error || 'Failed to create task.');
    }
    setSaving(false);
  };

  const handleCreateSelfTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSelfSaving(true);
    const formData = new FormData(e.currentTarget);
    const result = await apiPost('/api/tasks', {
      action: 'createSelf',
      title: formData.get('title'),
      description: formData.get('description'),
      priority: formData.get('priority'),
      start_day: formData.get('start_day'),
    });
    if (result.success) {
      toast.success(result.message);
      setIsSelfAddOpen(false);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardTasks'] });
    } else {
      toast.error(result.error || 'Failed to add task.');
    }
    setSelfSaving(false);
  };

  const handleEditTaskClick = (task: Task) => {
    setEditingTask(task);
    if (task.assignee_id) setSelectedAssigneeIds([task.assignee_id]);
    setIsEditOpen(true);
  };

  const handleUpdateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingTask) return;

    const finalAssigneeId = selectedAssigneeIds[0] || editingTask.assignee_id || user?.id;

    if (!finalAssigneeId) {
      toast.error('Task must have an assignee.');
      return;
    }

    setSaving(true);
    const formData = new FormData(e.currentTarget);
    const result = await apiPatch('/api/tasks', {
      action: 'update',
      taskId: editingTask.id,
      title: formData.get('title'),
      description: formData.get('description'),
      priority: formData.get('priority'),
      assigned_to: finalAssigneeId,
      start_day: formData.get('start_day'),
      end_day: formData.get('end_day'),
    });

    if (result.success) {
      toast.success(result.message);
      setIsEditOpen(false);
      setEditingTask(null);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardTasks'] });
    } else {
      toast.error(result.error || 'Failed to update task.');
    }
    setSaving(false);
  };

  const confirmDeleteTask = async () => {
    if (!deletingTaskId) return;
    setSaving(true);
    const result = await apiDelete(`/api/tasks?id=${deletingTaskId}`);
    if (result.success) {
      toast.success(result.message);
      setIsDeleteDialogOpen(false);
      setDeletingTaskId(null);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardTasks'] });
    } else {
      toast.error(result.error || 'Failed to delete task.');
    }
    setSaving(false);
  };

  const toggleAssignee = (id: string) => {
    setSelectedAssigneeIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const formatDateHeader = (dateStr: string) => {
    if (dateStr === 'Unknown') return 'Unscheduled';
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

  const pendingCount = filtered.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
  const completedCount = filtered.filter(t => t.status === 'completed').length;
  const totalCount = filtered.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    // Optimistic Update
    queryClient.setQueriesData({ queryKey: ['tasks'] }, (old: any) =>
      old ? old.map((t: any) => t.id === taskId ? { ...t, status: newStatus as TaskStatus } : t) : old
    );

    startTransition(async () => {
      try {
        const result = await apiPatch('/api/tasks', { action: 'updateStatus', taskId, status: newStatus });
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.error || 'Failed to update status');
        }
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['dashboardTasks'] });
      } catch (err) {
        toast.error('An unexpected error occurred.');
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }
    });
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Task Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Track and manage tasks</p>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <div className="flex bg-muted p-1 rounded-xl mr-2">
            <button
              onClick={() => setTimeFilter('week')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                timeFilter === 'week' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Week
            </button>
            <button
              onClick={() => setTimeFilter('month')}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                timeFilter === 'month' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Month
            </button>
          </div>

          <Button
            variant={viewAll ? "secondary" : "outline"}
            onClick={() => setViewAll(!viewAll)}
            className="gap-2"
          >
            <Users className="w-4 h-4" />
            {viewAll ? 'My Tasks' : 'All Tasks'}
          </Button>

          {canManageTasks ? (
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground gap-2">
                  <Plus className="w-4 h-4" /> Add Task
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateTask} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Task Title</Label>
                    <Input id="title" name="title" required placeholder="e.g. Update Documentation" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea id="description" name="description" placeholder="Add details..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="priority">Priority</Label>
                      <Select name="priority" defaultValue="medium">
                        <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 flex flex-col">
                      <Label>Assign To</Label>
                      <Popover open={openAssignee} onOpenChange={setOpenAssignee}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-between font-normal">
                            {selectedAssigneeIds.length > 0 ? `${selectedAssigneeIds.length} selected` : "Select employees..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search employee..." />
                            <CommandList>
                              <CommandEmpty>No employee found.</CommandEmpty>
                              <CommandGroup>
                                {employees.map((emp) => (
                                  <CommandItem key={emp.id} value={emp.name || emp.email} onSelect={() => toggleAssignee(emp.id)}>
                                    <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", selectedAssigneeIds.includes(emp.id) ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                                      <Check className="h-3 w-3" />
                                    </div>
                                    {emp.name || emp.email}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_day">Start Date</Label>
                      <Input id="start_day" name="start_day" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_day">End Date</Label>
                      <Input id="end_day" name="end_day" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : 'Create Task'}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog open={isSelfAddOpen} onOpenChange={setIsSelfAddOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground gap-2"><Plus className="w-4 h-4" /> Add My Task</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px]">
                <DialogHeader><DialogTitle>Add My Task</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateSelfTask} className="space-y-4 mt-4">
                  <div className="space-y-2"><Label>Title</Label><Input name="title" required /></div>
                  <div className="space-y-2"><Label>Description</Label><Textarea name="description" /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Priority</Label><Select name="priority" defaultValue="medium"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label>Date</Label><Input name="start_day" type="date" required defaultValue={new Date().toISOString().split('T')[0]} /></div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={() => setIsSelfAddOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={selfSaving}>{selfSaving ? 'Saving...' : 'Add Task'}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {viewAll && canManageTasks && (
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search tasks..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger><SelectValue placeholder="All Employees" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map(emp => <SelectItem key={emp.id} value={emp.id}>{emp.name || emp.email}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
              <input type="date" value={dateRange.start} onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))} className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-xs" />
              <span className="text-muted-foreground text-xs">to</span>
              <input type="date" value={dateRange.end} onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))} className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-xs" />
            </div>
          </div>
        </div>
      )}

      <div className="stat-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Overall Progress</h2>
          <span className="text-sm text-muted-foreground">{completedCount}/{totalCount} tasks completed</span>
        </div>
        <Progress value={progress} className="h-2.5" />
      </div>

      <div className="space-y-8">
        {loading ? (
          <div className="space-y-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 rounded-xl border border-border/50 bg-card space-y-3">
                <Skeleton width="60%" height={18} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
                <Skeleton width="100%" height={24} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-lg">No tasks found.</div>
        ) : (
          sortedDates.map((dateStr) => (
            <div key={dateStr} className="space-y-4">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">{formatDateHeader(dateStr)}</h2>
                <div className="h-px w-full bg-border/60"></div>
              </div>
              <div className="grid gap-3">
                {groupedTasks[dateStr].map((task) => (
                  <div key={task.id} className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-border/50 bg-card hover:shadow-lg hover:shadow-primary/5 transition-all group">
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className={`font-semibold text-base ${task.status === 'completed' ? 'line-through text-muted-foreground/60' : ''}`}>{task.title}</h3>
                          {task.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}
                        </div>
                        <div className="w-36 shrink-0">
                          <Select value={task.status} onValueChange={(val) => handleStatusChange(task.id, val)} disabled={isPending}>
                            <SelectTrigger className={cn("h-8 text-[11px] font-bold uppercase tracking-tight rounded-lg", task.status === 'completed' && "bg-success/10 text-success border-success/20", task.status === 'in_progress' && "bg-info/10 text-info border-info/20")}>
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="in_progress">In Progress</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-4 text-[11px] text-muted-foreground font-medium">
                        {viewAll && task.assignee_name && <span className="bg-secondary px-2 py-0.5 rounded-md font-bold text-secondary-foreground"><Users className="w-3 h-3 inline mr-1" />{task.assignee_name.toUpperCase()}</span>}
                        <span className={cn("px-2 py-0.5 rounded-md uppercase font-bold tracking-wider", priorityColors[task.priority])}>{task.priority}</span>
                        <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-md"><Clock className="w-3 h-3" />{new Date(task.start_day).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(canManageTasks || task.assignee_id === user?.id) && <Button variant="ghost" size="icon" onClick={() => handleEditTaskClick(task)} className="h-8 w-8"><Edit2 className="w-3.5 h-3.5" /></Button>}
                      {user?.role === 'admin' && <Button variant="ghost" size="icon" onClick={() => { setDeletingTaskId(task.id); setIsDeleteDialogOpen(true); }} className="h-8 w-8 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}

        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between p-4 bg-muted/20 rounded-2xl border border-border/40 mt-8">
            <p className="text-sm text-muted-foreground">Showing {(currentPage - 1) * RECORDS_PER_PAGE + 1}–{Math.min(currentPage * RECORDS_PER_PAGE, filtered.length)} of {filtered.length} tasks</p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="w-4 h-4" /></Button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <Button key={i} variant={currentPage === i + 1 ? "default" : "outline"} className="h-8 w-8 text-xs" onClick={() => setCurrentPage(i + 1)}>{i + 1}</Button>
              ))}
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Edit Task</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdateTask} className="space-y-4 mt-4">
            <div className="space-y-2"><Label>Title</Label><Input name="title" defaultValue={editingTask?.title} required /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea name="description" defaultValue={editingTask?.description} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Priority</Label><Select name="priority" defaultValue={editingTask?.priority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Start Date</Label><Input name="start_day" type="date" defaultValue={editingTask?.start_day} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>End Date</Label><Input name="end_day" type="date" defaultValue={editingTask?.end_day} required /></div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Delete Task</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this task?</p>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteTask} disabled={saving}>Delete Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
