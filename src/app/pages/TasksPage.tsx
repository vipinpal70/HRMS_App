"use client";

import { useState, useEffect } from 'react';
import { Plus, CheckCircle2, Clock, Circle, Search, Users, Calendar as CalendarIcon, Loader2, AlertCircle, XCircle, Check, ChevronsUpDown } from 'lucide-react';
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
import { getTasks, createTask, getEmployeesList } from '../actions/tasks';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  due_date?: string;
  assignee_name?: string;
  assignee_email?: string;
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
  
  // Add Task Form State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [openAssignee, setOpenAssignee] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');

  // Date Range State (default: current week Monday–Sunday)
  const getWeekDates = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return {
      start: monday.toISOString().split('T')[0],
      end: sunday.toISOString().split('T')[0]
    };
  };

  const [dateRange, setDateRange] = useState(getWeekDates);

  const canManageTasks = user?.role === 'admin' || user?.role === 'hr';

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const userId = viewAll ? 'all' : undefined;
      const data = await getTasks(
        userId,
        viewAll ? dateRange.start : undefined,
        viewAll ? dateRange.end : undefined
      );
      setTasks(data as any);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [viewAll, dateRange]);

  useEffect(() => {
    if (canManageTasks && isAddOpen) {
      getEmployeesList().then(setEmployees);
      setAssigneeId('');
    }
  }, [canManageTasks, isAddOpen]);

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!assigneeId) {
        toast.error('Please assign the task to an employee.');
        return;
    }
    setSaving(true);
    const formData = new FormData(e.currentTarget);
    formData.set('assigned_to', assigneeId); // Ensure assignee ID is set
    
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

  const filtered = tasks.filter((t) => {
    const matchesSearch = !viewAll || !searchQuery || 
      (t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
       t.assignee_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       t.assignee_email?.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const pendingCount = filtered.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
  const completedCount = filtered.filter(t => t.status === 'completed').length;
  const totalCount = filtered.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Task Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Track and manage tasks</p>
        </div>

        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
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
                         <Label htmlFor="assigned_to">Assign To</Label>
                         <input type="hidden" name="assigned_to" value={assigneeId} />
                         <Popover open={openAssignee} onOpenChange={setOpenAssignee}>
                           <PopoverTrigger asChild>
                             <Button
                               variant="outline"
                               role="combobox"
                               aria-expanded={openAssignee}
                               className="w-full justify-between font-normal"
                             >
                               {assigneeId
                                 ? employees.find((emp) => emp.id === assigneeId)?.name || employees.find((emp) => emp.id === assigneeId)?.email
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
                                         setAssigneeId(emp.id);
                                         setOpenAssignee(false);
                                       }}
                                     >
                                       <Check
                                         className={cn(
                                           "mr-2 h-4 w-4",
                                           assigneeId === emp.id ? "opacity-100" : "opacity-0"
                                         )}
                                       />
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

                    <div className="space-y-2">
                      <Label htmlFor="due_date">Due Date</Label>
                      <Input id="due_date" name="due_date" type="date" />
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
        </div>
      </div>

      {viewAll && canManageTasks && (
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search tasks by title or assignee..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 text-muted-foreground" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="px-2 py-1.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-muted-foreground text-sm">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="px-2 py-1.5 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDateRange(getWeekDates())}
              className="text-xs"
            >
              This Week
            </Button>
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

      {/* Task List */}
      <div className="grid gap-3">
        {loading ? (
             <div className="text-center py-10"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></div>
        ) : filtered.length === 0 ? (
             <div className="text-center py-10 text-muted-foreground bg-muted/20 rounded-lg">No tasks found.</div>
        ) : (
          filtered.map((task) => {
            const Icon = statusIcons[task.status] || Circle;
            return (
              <div
                key={task.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border border-border bg-card hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3 flex-1">
                   <div className={`mt-1 ${statusColors[task.status]}`}>
                      <Icon className="w-5 h-5" />
                   </div>
                   <div className="flex-1">
                      <h3 className={`font-medium ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                        {task.title}
                      </h3>
                      {task.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{task.description}</p>}
                      
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                         {viewAll && task.assignee_name && (
                            <span className="flex items-center gap-1 bg-secondary px-2 py-0.5 rounded text-secondary-foreground">
                               <Users className="w-3 h-3" /> {task.assignee_name}
                            </span>
                         )}
                         <span className={`px-2 py-0.5 rounded capitalize ${priorityColors[task.priority]}`}>
                            {task.priority}
                         </span>
                         {task.due_date && (
                            <span className="flex items-center gap-1">
                               <CalendarIcon className="w-3 h-3" /> {new Date(task.due_date).toLocaleDateString()}
                            </span>
                         )}
                      </div>
                   </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
