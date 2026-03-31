'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Clock,
  MapPin,
  Wifi,
  CheckCircle2,
  XCircle,
  CalendarCheck,
  ListTodo,
  Timer,
  Star,
  CloudSun,
  Loader2
} from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Calendar } from '../components/ui/calendar';
import { apiGet, apiPost } from '@/lib/apiClient';
import { toast } from 'react-hot-toast';
import Link from 'next/link';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const holidayTypeStyles = {
  holiday: 'bg-destructive/10 text-destructive',
  event: 'bg-purple-500/10 text-purple-500',
};

interface AttendanceRecord {
  id: string;
  date: string;
  // Session 1
  check_in_1: string | null;
  check_out_1: string | null;
  // Session 2 (hybrid)
  check_in_2: string | null;
  check_out_2: string | null;
  // Display helpers (from getAttendanceHistory)
  check_in: string | null;  // backward-compat: formatted check_in_1
  check_out: string | null; // backward-compat: formatted check_out_1
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

// 1. Independent Timer Component to prevent full Dashboard re-renders
function CheckInTimer({ checkInTime }: { checkInTime: Date | null }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (checkInTime) {
      setElapsed(Math.floor((Date.now() - checkInTime.getTime()) / 1000));
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - checkInTime.getTime()) / 1000));
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [checkInTime]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="font-mono text-5xl md:text-4xl font-bold tracking-wider text-primary">
      {formatTime(elapsed || 0)}
    </div>
  );
}

const getLocalISODate = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // 2. Remove elapsed from main state
  const [ipValid, setIpValid] = useState(true);
  const [locationValid, setLocationValid] = useState(true);
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(false);
  const [isWithinHours, setIsWithinHours] = useState(true);
  const [currentYear] = useState(new Date().getFullYear());

  const { data: todayData, isLoading: loadingToday } = useQuery({
    queryKey: ['todayStatus'],
    queryFn: () => apiGet('/api/attendance?type=today'),
    staleTime: 0,
  });

  const { data: settingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ['companySettings'],
    queryFn: () => apiGet('/api/settings'),
  });

  const { data: historyData, isLoading: loadingHistory } = useQuery({
    queryKey: ['attendanceHistory'],
    queryFn: () => apiGet('/api/attendance?type=history'),
  });

  const { data: tasksData, isLoading: loadingTasks } = useQuery({
    queryKey: ['dashboardTasks'],
    queryFn: () => apiGet('/api/tasks'),
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    staleTime: 10000
  });

  const { data: workTypeData, isLoading: loadingWorkType } = useQuery({
    queryKey: ['effectiveWorkType'],
    queryFn: () => apiGet('/api/attendance?type=effective-work-type'),
  });

  const { data: quote, isLoading: loadingQuote } = useQuery({
    queryKey: ['quoteOfDay'],
    queryFn: () => apiGet('/api/quotes'),
  });

  const { data: yearData, isLoading: loadingYearData } = useQuery({
    queryKey: ['yearHolidays', currentYear],
    queryFn: () => apiGet(`/api/calendar?type=holidays&year=${currentYear}`),
  });

  const officeHours = useMemo(() => {
    if (!settingsData) return { start: '09:00', end: '19:00' };
    return {
      start: settingsData.office_start_time?.substring(0, 5) ?? '09:30',
      end: settingsData.office_end_time?.substring(0, 5) ?? '19:00'
    };
  }, [settingsData]);

  const effectiveWorkType = (workTypeData as any) || 'office';
  const records = useMemo(() => Array.isArray(historyData) ? (historyData as unknown as AttendanceRecord[]) : [], [historyData]);
  const tasks: any[] = useMemo(() => Array.isArray(tasksData) ? (tasksData as any[]) : [], [tasksData]);

  const holidays = useMemo(() => {
    if (!Array.isArray(yearData)) return [];
    return (yearData as any[]).map((h: any) => ({
      date: new Date(h.date),
      label: h.description,
      type: h.type
    }));
  }, [yearData]);

  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);

  useEffect(() => {
    if (todayData) {
      const hasActiveSession2 = !!todayData.check_in_2 && !todayData.check_out_2;
      const hasActiveSession1 = !!todayData.check_in_1 && !todayData.check_out_1;
      const isCheckedIn = hasActiveSession2 || hasActiveSession1;
      setCheckedIn(isCheckedIn);
      if (hasActiveSession2 && todayData.check_in_2) {
        setCheckInTime(new Date(todayData.check_in_2));
      } else if (hasActiveSession1 && todayData.check_in_1) {
        setCheckInTime(new Date(todayData.check_in_1));
      } else {
        setCheckInTime(null);
      }
    }
  }, [todayData]);

  useEffect(() => {
    function checkHours() {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [sh, sm] = officeHours.start.split(':').map(Number);
      const [eh, em] = officeHours.end.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      setIsWithinHours(currentMinutes >= startMin && currentMinutes <= endMin);
    }
    checkHours();
    const interval = setInterval(checkHours, 60000);
    return () => clearInterval(interval);
  }, [officeHours]);

  const handleCheckIn = async () => {
    setLoading(true);
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const result = await apiPost('/api/attendance', { action: 'checkIn', latitude, longitude });
          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success('Checked in successfully!');
            setCheckedIn(true);
            setCheckInTime(new Date());
            const refreshed = await apiGet('/api/attendance?type=today');
            if (refreshed) queryClient.setQueryData(['todayStatus'], refreshed);
            const workType = await apiGet('/api/attendance?type=effective-work-type');
            if (workType) queryClient.setQueryData(['effectiveWorkType'], workType);
          }
        } catch (error) {
          toast.error('Failed to check in');
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        toast.error('Unable to retrieve your location. Please allow location access.');
        setLoading(false);
      }
    );
  };

  const handleCheckOut = async () => {
    setLoading(true);
    if (!navigator.geolocation) {
      await performCheckOut(0, 0);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        await performCheckOut(latitude, longitude);
      },
      async (error) => {
        await performCheckOut(0, 0);
      }
    );
  };

  const performCheckOut = async (lat: number, lng: number) => {
    try {
      const result = await apiPost('/api/attendance', { action: 'checkOut', latitude: lat, longitude: lng });
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Checked out successfully!');
        setCheckedIn(false);
        setCheckInTime(null);
        const refreshed = await apiGet('/api/attendance?type=today');
        if (refreshed) queryClient.setQueryData(['todayStatus'], refreshed);
      }
    } catch (error) {
      toast.error('Failed to check out');
    } finally {
      setLoading(false);
    }
  }

  const formatOfficeTime = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return `${displayH}:${(m || 0).toString().padStart(2, '0')} ${period}`;
  };

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const officeDone = todayData?.work_type === 'office' && !!todayData?.check_in_1 && !!todayData?.check_out_1 && !checkedIn;

  // 3. Memoize stats
  const stats = useMemo(() => {
    const present = records.filter(r => (r as any).check_in_1 != null).length;
    const totalMin = records.reduce((acc, r) => acc + (r.total_minutes ?? 0), 0);
    const tasksDone = tasks.filter(t => t.status === 'completed').length;
    const totalWorkDays = records.length;
    return [
      { label: 'Present Days', value: present.toString(), icon: CalendarCheck, color: 'text-success' },
      { label: 'Tasks Done', value: tasksDone.toString(), icon: ListTodo, color: 'text-info' },
      { label: 'Avg Hours', value: records.length > 0 ? `${(totalMin / (records.length * 60)).toFixed(1)}h` : '0h', icon: Timer, color: 'text-accent' },
      { label: 'Work Days', value: totalWorkDays.toString(), icon: CalendarCheck, color: 'text-primary' },
    ];
  }, [records, tasks]);

  const todayStr = useMemo(() => getLocalISODate(), []);
  const todayTasks = useMemo(() => tasks.filter(t => t.start_day === todayStr), [tasks, todayStr]);
  const pendingTasks = useMemo(() => tasks.filter(t => t.status !== 'completed' && t.start_day !== todayStr), [tasks, todayStr]);

  const statusColors = {
    completed: 'bg-success/10 text-success',
    in_progress: 'bg-info/10 text-info',
    pending: 'bg-muted text-muted-foreground',
  };

  const holidayDates = useMemo(() => holidays.map((h) => h.date), [holidays]);
  const eventDates = useMemo(() => holidays.filter((h) => h.type === 'event').map((h) => h.date), [holidays]);

  const upcomingHolidays = useMemo(() => {
    const now = new Date();
    return holidays
      .filter((h) => {
        const isUpcoming = h.date >= now;
        if (!isUpcoming) return false;
        if (h.type === 'event') {
          return h.date.getMonth() === now.getMonth() && h.date.getFullYear() === now.getFullYear();
        }
        return h.type === 'holiday';
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [holidays]);

  // 4. Implement Progressive Loading
  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.name || user?.email?.split('@')[0] || 'User'}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{today}</p>
        <div className="text-sm italic mt-2 text-primary/80 bg-primary/10 p-2 rounded-lg min-h-[40px] flex items-center">
          {loadingQuote ? (
            <Skeleton width="60%" height={16} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
          ) : (
            quote ? `"${quote.q}" — ${quote.a}` : 'Loading inspiration...'
          )}
        </div>
      </div>

      {/* Check-in Card */}
      <div className="stat-card flex flex-col sm:flex-row items-center gap-5">
        {loadingToday ? (
          <div className="flex-1 space-y-3 w-full">
            <div className="flex items-center gap-3">
              <Skeleton circle width={12} height={12} />
              <Skeleton width={140} height={20} />
            </div>
            <div className="flex gap-3">
              <Skeleton width={100} height={40} />
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <div
                className={`w-3 h-3 rounded-full ${checkedIn ? 'bg-success pulse-dot' : 'bg-muted-foreground/30'}`}
              />
              <span className="font-semibold text-lg">
                {checkedIn ? 'Checked In' : 'Not Checked In'}
              </span>
            </div>

            {checkedIn && <CheckInTimer checkInTime={checkInTime} />}

            {/* Validation Status */}
            <div className="flex flex-wrap justify-center md:justify-start gap-3 text-sm">
              <span className="flex items-center gap-1.5">
                <Wifi className="w-4 h-4" />
                IP: {ipValid ? <CheckCircle2 className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-destructive" />}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                Location: {locationValid ? <CheckCircle2 className="w-4 h-4 text-success" /> : <XCircle className="w-4 h-4 text-destructive" />}
              </span>
            </div>
          </div>
        )}

        {!loadingToday && (
          officeDone ? (
            <div className="flex flex-col items-center gap-1">
              <Button
                size="lg"
                className="bg-success hover:bg-success/90 text-success-foreground"
                onClick={() => toast.error('You cannot check in again.')}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Check In
              </Button>
            </div>
          ) : (
            <Button
              size="lg"
              onClick={checkedIn ? handleCheckOut : handleCheckIn}
              disabled={loading || loadingSettings || (effectiveWorkType === 'office' && !isWithinHours) || effectiveWorkType === 'leave'}
              className={
                (effectiveWorkType === 'office' && !isWithinHours) || effectiveWorkType === 'leave'
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : checkedIn
                    ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
                    : 'bg-success hover:bg-success/90 text-success-foreground'
              }
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Clock className="w-4 h-4 mr-2" />
              )}
              {checkedIn ? 'Check Out' : 'Check In'}
            </Button>
          )
        )}
      </div>

      {/* Office Hours Info */}
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${loadingSettings ? 'bg-muted/50' : (isWithinHours ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive')}`}>
        <Clock className="w-4 h-4" />
        {loadingSettings ? (
          <Skeleton width={300} height={14} />
        ) : (
          <span>
            Office hours: <strong>{formatOfficeTime(officeHours.start)} – {formatOfficeTime(officeHours.end)}</strong>
            {effectiveWorkType === 'leave' && ' — You are on approved leave today'}
            {(!isWithinHours && effectiveWorkType === 'office') && ' — Check-in/out is currently unavailable'}
          </span>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {(loadingHistory || loadingTasks) ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="stat-card">
              <Skeleton circle width={20} height={20} />
              <Skeleton width={60} height={28} style={{ marginTop: 8 }} />
              <Skeleton width={80} height={12} style={{ marginTop: 4 }} />
            </div>
          ))
        ) : (
          stats.map((stat) => (
            <div key={stat.label} className="stat-card">
              <div className="flex items-center justify-between mb-2">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))
        )}
      </div>

      {/* Calendar + Holidays Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="stat-card flex flex-col items-center">
          <h2 className="font-semibold text-lg mb-3 self-start">Calendar</h2>
          <Calendar
            mode="single"
            selected={calendarDate}
            onSelect={setCalendarDate}
            className="rounded-md border shadow-sm p-4 w-full"
            modifiers={{ holiday: holidayDates, event: eventDates }}
            modifiersClassNames={{
              holiday: 'bg-destructive/15 text-destructive font-bold',
              event: 'bg-purple-500/10 text-purple-500 font-bold',
            }}
          />
        </div>

        <div className="stat-card flex flex-col">
          <h2 className="font-semibold text-lg mb-4">Upcoming Holidays & Events</h2>
          {loadingYearData ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <Skeleton width={36} height={36} borderRadius={8} />
                  <div className="flex-1">
                    <Skeleton width="70%" height={14} />
                    <Skeleton width="40%" height={12} style={{ marginTop: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
              {upcomingHolidays.map((h, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${holidayTypeStyles[h.type as keyof typeof holidayTypeStyles]}`}>
                    {h.type === 'holiday' ? <CloudSun className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{h.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {h.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${holidayTypeStyles[h.type as keyof typeof holidayTypeStyles]}`}>
                    {h.type}
                  </Badge>
                </div>
              ))}
              {upcomingHolidays.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No upcoming holidays</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Today's Tasks */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Today's Tasks</h2>
          {!loadingTasks && (
            <Badge variant="secondary" className="text-xs">
              {todayTasks.filter((t) => t.status === 'completed').length}/{todayTasks.length} done
            </Badge>
          )}
        </div>
        {loadingTasks ? (
          <div className="space-y-3">
            <Skeleton count={3} height={40} className="rounded-lg" />
          </div>
        ) : todayTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No tasks assigned</p>
        ) : (
          <>
            <div className="space-y-3">
              {todayTasks.map((task, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                  <span className={`text-sm ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</span>
                  <span className={`badge-status ${statusColors[task.status as keyof typeof statusColors]}`}>{task.status.replace('_', ' ')}</span>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                <span>Progress</span>
                <span>{Math.round((todayTasks.filter((t) => t.status === 'completed').length / todayTasks.length) * 100)}%</span>
              </div>
              <Progress value={(todayTasks.filter((t) => t.status === 'completed').length / todayTasks.length) * 100} className="h-2" />
            </div>
          </>
        )}
      </div>

      {/* Pending Tasks */}
      <div className="stat-card">
        <h2 className="font-semibold text-lg mb-4">Pending Tasks</h2>
        {loadingTasks ? (
          <Skeleton count={2} height={60} className="rounded-lg mb-3" />
        ) : pendingTasks.length === 0 ? (
          <div className="flex gap-2 items-center justify-center py-4 bg-muted/5 rounded-xl border border-dashed border-border/50">
            <CheckCircle2 className="w-6 h-6 text-success/30" />
            <p className="text-sm text-muted-foreground">All caught up!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingTasks.slice(0, 2).map((task, i) => (
              <Link key={i} href="/tasks" className="block group">
                <div className="flex items-center justify-between py-3 px-1 border-b border-border/50 last:border-0 group-hover:bg-muted/30 transition-colors rounded-lg">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium group-hover:text-primary transition-colors">{task.title}</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Timer className="w-3 h-3" /> Due: {new Date(task.start_day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <span className={`badge-status ${statusColors[task.status as keyof typeof statusColors]}`}>{task.status.replace('_', ' ')}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
