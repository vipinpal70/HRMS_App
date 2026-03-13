"use client";

import { useState, useEffect } from 'react';
import { Plus, CheckCircle2, Clock, Circle, Search, Users, Calendar as CalendarIcon, Loader2, XCircle, Check, ChevronsUpDown, Edit2, Trash2 } from 'lucide-react';
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
import { getTasks, createTask, getEmployeesList, updateTaskStatus, createSelfTask, checkAndNotifyNoTasks, updateTask, deleteTask } from '../actions/tasks';
import { toast } from 'react-hot-toast';
import { useTransition } from 'react';
import { cn } from '@/lib/utils';

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

export default function TasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewAll, setViewAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');
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

  const fetchTasks = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const userId = viewAll ? 'all' : undefined;
      const data = await getTasks(
        userId,
        dateRange.start, // Always use dateRange for consistency
        dateRange.end,
        viewAll && employeeFilter !== 'all' ? employeeFilter : undefined
      );
      setTasks(data as any);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [viewAll, dateRange, employeeFilter]);

  // Update date range when filter changes
  useEffect(() => {
    if (timeFilter === 'week') {
      setDateRange(getWeekDates());
    } else {
      setDateRange(getMonthDates());
    }
  }, [timeFilter]);

  useEffect(() => {
    if (canManageTasks && (isAddOpen || viewAll)) {
      getEmployeesList().then(setEmployees);
      if (isAddOpen) setSelectedAssigneeIds([]);
    }
  }, [canManageTasks, isAddOpen, viewAll]);

  // Trigger 11AM no-task notification check on mount (fire-and-forget)
  useEffect(() => {
    checkAndNotifyNoTasks().catch(() => { });
  }, []);

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (selectedAssigneeIds.length === 0) {
      toast.error('Please assign the task to at least one employee.');
      return;
    }
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    formData.set('assigned_to', selectedAssigneeIds.join(',')); // Comma-separated for server action

    const result = await createTask(formData);

    if (result.success) {
      toast.success(result.message);
      setIsAddOpen(false);
      fetchTasks(); // Refresh list
    } else {
      toast.error(result.error || 'Failed to create task.');
    }
    setSaving(false);
  };

  const handleCreateSelfTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSelfSaving(true);
    const formData = new FormData(e.currentTarget);
    const result = await createSelfTask(formData);
    if (result.success) {
      toast.success(result.message);
      setIsSelfAddOpen(false);
      fetchTasks();
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

    // Admin/HR might need to assign, employees might not see the combobox.
    // If the combobox was used, selectedAssigneeIds is set. Otherwise, fallback to existing task assignee.
    const finalAssigneeId = selectedAssigneeIds[0] || editingTask.assignee_id || user?.id;

    if (!finalAssigneeId) {
      toast.error('Task must have an assignee.');
      return;
    }

    setSaving(true);
    const formData = new FormData(e.currentTarget);
    formData.set('assigned_to', finalAssigneeId);

    const result = await updateTask(editingTask.id, formData);

    if (result.success) {
      toast.success(result.message);
      setIsEditOpen(false);
      setEditingTask(null);
      fetchTasks();
    } else {
      toast.error(result.error || 'Failed to update task.');
    }
    setSaving(false);
  };

  const confirmDeleteTask = async () => {
    if (!deletingTaskId) return;
    setSaving(true);
    const result = await deleteTask(deletingTaskId);
    if (result.success) {
      toast.success(result.message);
      setIsDeleteDialogOpen(false);
      setDeletingTaskId(null);
      fetchTasks();
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

  const filtered = tasks.filter((t) => {
    const matchesSearch = !viewAll || !searchQuery ||
      (t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.assignee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.assignee_email?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  // Grouping Logic
  const groupedTasks = filtered.reduce((acc, task) => {
    const date = task.start_day;
    if (!acc[date]) acc[date] = [];
    acc[date].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  const sortedDates = Object.keys(groupedTasks).sort((a, b) => b.localeCompare(a));

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

  const pendingCount = filtered.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
  const completedCount = filtered.filter(t => t.status === 'completed').length;
  const totalCount = filtered.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    // 1. Optimistic Update: Update local state immediately
    const previousTasks = [...tasks];
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as TaskStatus } : t));

    startTransition(async () => {
      try {
        const result = await updateTaskStatus(taskId, newStatus);

        if (result.success && result.data) {
          toast.success(result.message);
          // 2. Sync with server data: Use the data returned from server
          setTasks(prev => prev.map(t => t.id === taskId ? {
            ...t,
            status: result.data.status as TaskStatus,
            updated_at: result.data.updated_at
          } : t));
          // We don't fetchTasks(true) immediately here to avoid write-read race conditions
          // The local state is already synced with the server response
        } else {
          toast.error(result.error || 'Failed to update status');
          setTasks(previousTasks); // Revert on failure
        }
      } catch (err) {
        toast.error('An unexpected error occurred.');
        setTasks(previousTasks); // Revert on exception
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

          {canManageTasks && (
            <>
              <Button
                variant={viewAll ? "secondary" : "outline"}
                onClick={() => setViewAll(!viewAll)}
                className="gap-2"
              >
                <Users className="w-4 h-4" />
                {viewAll ? 'My Tasks' : 'All Tasks'}
              </Button>

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
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2 flex flex-col">
                        <Label htmlFor="assigned_to">Assign To (Multiple allowed)</Label>
                        <Popover open={openAssignee} onOpenChange={setOpenAssignee}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={openAssignee}
                              className="w-full justify-between font-normal"
                            >
                              {selectedAssigneeIds.length > 0
                                ? `${selectedAssigneeIds.length} employee(s) selected`
                                : "Select employees..."}
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
                                    <CommandItem
                                      key={emp.id}
                                      value={emp.name || emp.email}
                                      onSelect={() => toggleAssignee(emp.id)}
                                    >
                                      <div className={cn(
                                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                        selectedAssigneeIds.includes(emp.id)
                                          ? "bg-primary text-primary-foreground"
                                          : "opacity-50 [&_svg]:invisible"
                                      )}>
                                        <Check className="h-3 w-3" />
                                      </div>
                                      {emp.name || emp.email} ({emp.role})
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
                      <Button type="submit" disabled={saving}>
                        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        {saving ? 'Creating...' : 'Create Task'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </>
          )}

          {/* Employee: Add My Task button */}
          {!canManageTasks && (
            <Dialog open={isSelfAddOpen} onOpenChange={setIsSelfAddOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground gap-2">
                  <Plus className="w-4 h-4" /> Add My Task
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                  <DialogTitle>Add My Task</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateSelfTask} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="self-title">Task Title</Label>
                    <Input id="self-title" name="title" required placeholder="e.g. Prepare weekly report" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="self-description">Description</Label>
                    <Textarea id="self-description" name="description" placeholder="Add details..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="self-priority">Priority</Label>
                      <Select name="priority" defaultValue="medium">
                        <SelectTrigger>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="self-start_day">Date</Label>
                      <Input
                        id="self-start_day"
                        name="start_day"
                        type="date"
                        defaultValue={new Date().toISOString().split('T')[0]}
                        required
                      />
                    </div>
                  </div>
                  <DialogFooter className="mt-6">
                    <Button type="button" variant="outline" onClick={() => setIsSelfAddOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={selfSaving}>
                      {selfSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      {selfSaving ? 'Saving...' : 'Add Task'}
                    </Button>
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
              <Input
                placeholder="Search by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Employees" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name || emp.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date Range Filter */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 flex-1">
                <CalendarIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="text-muted-foreground text-xs">to</span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full px-2 py-1.5 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Overall Progress</h2>
          <span className="text-sm text-muted-foreground">
            {completedCount}/{totalCount} tasks completed
          </span>
        </div>
        <Progress value={progress} className="h-2.5" />
      </div>

      {/* Task List - Grouped by Date */}
      <div className="space-y-8">
        {loading ? (
          <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-lg">No tasks found.</div>
        ) : (
          sortedDates.map((dateStr) => (
            <div key={dateStr} className="space-y-4">
              <div className="flex items-center gap-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  {formatDateHeader(dateStr)}
                </h2>
                <div className="h-px w-full bg-border/60"></div>
              </div>

              <div className="grid gap-3">
                {groupedTasks[dateStr].map((task) => (
                  <div
                    key={task.id}
                    className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-border/50 bg-card hover:shadow-lg hover:shadow-primary/5 transition-all group"
                  >
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className={`font-semibold text-base ${task.status === 'completed' ? 'line-through text-muted-foreground/60' : ''}`}>
                            {task.title}
                          </h3>
                          {task.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}
                        </div>

                        <div className="w-36 shrink-0">
                          <Select
                            value={task.status}
                            onValueChange={(val) => handleStatusChange(task.id, val)}
                            disabled={isPending}
                          >
                            <SelectTrigger className={cn(
                              "h-8 text-[11px] font-bold uppercase tracking-tight rounded-lg",
                              task.status === 'completed' && "bg-success/10 text-success border-success/20",
                              task.status === 'in_progress' && "bg-info/10 text-info border-info/20",
                              task.status === 'pending' && "bg-muted text-muted-foreground border-border"
                            )}>
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 mt-4 text-[11px] text-muted-foreground font-medium">
                        {viewAll && task.assignee_name && (
                          <span className="flex items-center gap-1.5 bg-secondary px-2 py-0.5 rounded-md text-secondary-foreground font-bold">
                            <Users className="w-3 h-3" /> {task.assignee_name.toUpperCase()}
                          </span>
                        )}
                        <span className={`px-2 py-0.5 rounded-md uppercase font-bold tracking-wider ${priorityColors[task.priority]}`}>
                          {task.priority}
                        </span>
                        <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-md">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(task.start_day).toLocaleDateString()}</span>
                          {task.start_day !== task.end_day && (
                            <>
                              <span>-</span>
                              <span>{new Date(task.end_day).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(canManageTasks || task.assignee_id === user?.id) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          onClick={() => handleEditTaskClick(task)}
                        >
                          <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      )}
                      {user?.role === 'admin' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                          onClick={() => {
                            setDeletingTaskId(task.id);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Task Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateTask} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-title">Task Title</Label>
              <Input id="edit-title" name="title" required defaultValue={editingTask?.title || ''} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea id="edit-description" name="description" defaultValue={editingTask?.description || ''} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-priority">Priority</Label>
                <Select name="priority" defaultValue={editingTask?.priority || 'medium'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {canManageTasks && (
                <div className="space-y-2 flex flex-col">
                  <Label htmlFor="edit_assigned_to">Assignee (Single for Edit)</Label>
                  <Popover open={openAssignee} onOpenChange={setOpenAssignee}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openAssignee}
                        className="w-full justify-between font-normal"
                      >
                        {selectedAssigneeIds.length > 0
                          ? employees.find(e => e.id === selectedAssigneeIds[0])?.name || "Employee Selected"
                          : "Select employee..."}
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
                              <CommandItem
                                key={emp.id}
                                value={emp.name || emp.email}
                                onSelect={() => {
                                  setSelectedAssigneeIds([emp.id]);
                                  setOpenAssignee(false);
                                }}
                              >
                                <div className={cn(
                                  "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                  selectedAssigneeIds.includes(emp.id)
                                    ? "bg-primary text-primary-foreground"
                                    : "opacity-50 [&_svg]:invisible"
                                )}>
                                  <Check className="h-3 w-3" />
                                </div>
                                {emp.name || emp.email} ({emp.role})
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-start_day">Start Date</Label>
                <Input id="edit-start_day" name="start_day" type="date" defaultValue={editingTask?.start_day || ''} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-end_day">End Date</Label>
                <Input id="edit-end_day" name="end_day" type="date" defaultValue={editingTask?.end_day || ''} required />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Task</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">Are you sure you want to delete this task? This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDeleteTask} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {saving ? 'Deleting...' : 'Delete Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
