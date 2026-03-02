'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Clock,
  MapPin,
  Wifi,
  CheckCircle2,
  XCircle,
  TrendingUp,
  CalendarCheck,
  ListTodo,
  Timer,
  Star,
  Palmtree,
  Loader2,
} from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Calendar } from '../components/ui/calendar';
import { checkIn, checkOut, getTodayStatus } from '../actions/attendance';
import { getCompanySettings } from '../actions/settings';
import { toast } from 'react-hot-toast';

const holidays = [
  { date: new Date(2026, 1, 14), label: "Valentine's Day", type: 'holiday' as const },
  { date: new Date(2026, 1, 26), label: 'Republic Day', type: 'holiday' as const },
  { date: new Date(2026, 2, 1), label: 'New Month Kickoff', type: 'event' as const },
  { date: new Date(2026, 2, 17), label: "St. Patrick's Day", type: 'event' as const },
  { date: new Date(2026, 3, 2), label: 'Good Friday', type: 'holiday' as const },
];

const holidayTypeStyles = {
  holiday: 'bg-destructive/10 text-destructive',
  event: 'bg-accent/10 text-accent',
};

export default function Dashboard() {
  const { user } = useAuth();
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [ipValid, setIpValid] = useState(true);
  const [locationValid, setLocationValid] = useState(true);
  const [calendarDate, setCalendarDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [officeHours, setOfficeHours] = useState<{ start: string; end: string }>({ start: '09:00', end: '19:00' });
  const [isWithinHours, setIsWithinHours] = useState(true);

  // Fetch initial status + office hours
  useEffect(() => {
    async function fetchStatus() {
      try {
        const [data, settings] = await Promise.all([
          getTodayStatus(),
          getCompanySettings()
        ]);

        if (data) {
          const isCheckedIn = !!data.check_in && !data.check_out;
          setCheckedIn(isCheckedIn);
          if (data.check_in) {
            setCheckInTime(new Date(data.check_in));
          }
        }

        if (settings) {
          const start = settings.office_start_time?.substring(0, 5) ?? '09:00';
          const end = settings.office_end_time?.substring(0, 5) ?? '19:00';
          setOfficeHours({ start, end });
        }
      } catch (error) {
        console.error('Error fetching status:', error);
      } finally {
        setInitialLoading(false);
      }
    }
    fetchStatus();
  }, []);

  // Check office hours every minute
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

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (checkedIn && checkInTime) {
      // Update elapsed time immediately
      setElapsed(Math.floor((Date.now() - checkInTime.getTime()) / 1000));

      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - checkInTime.getTime()) / 1000));
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [checkedIn, checkInTime]);

  const handleCheckIn = async () => {
    setLoading(true);

    // Get Location
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        try {
          const result = await checkIn(latitude, longitude);

          if (result.error) {
            toast.error(result.error);
          } else {
            toast.success('Checked in successfully!');
            setCheckedIn(true);
            setCheckInTime(new Date());
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

    // Get Location (optional for checkout but good for audit)
    if (!navigator.geolocation) {
      // Fallback if no geolocation
      await performCheckOut(0, 0);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        await performCheckOut(latitude, longitude);
      },
      async (error) => {
        // Allow checkout even if location fails
        await performCheckOut(0, 0);
      }
    );
  };

  const performCheckOut = async (lat: number, lng: number) => {
    try {
      const result = await checkOut(lat, lng);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Checked out successfully!');
        setCheckedIn(false);
        setCheckInTime(null);
      }
    } catch (error) {
      toast.error('Failed to check out');
    } finally {
      setLoading(false);
    }
  }

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

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

  const stats = [
    { label: 'Present Days', value: '18', icon: CalendarCheck, color: 'text-success' },
    { label: 'Tasks Done', value: '12', icon: ListTodo, color: 'text-info' },
    { label: 'Avg Hours', value: '8.2h', icon: Timer, color: 'text-accent' },
    { label: 'Streak', value: '5 days', icon: TrendingUp, color: 'text-primary' },
  ];

  const todayTasks = [
    { title: 'Review PR #342', status: 'completed' as const },
    { title: 'Update API documentation', status: 'in_progress' as const },
    { title: 'Team standup meeting', status: 'completed' as const },
    { title: 'Deploy staging build', status: 'pending' as const },
  ];

  const statusColors = {
    completed: 'bg-success/10 text-success',
    in_progress: 'bg-info/10 text-info',
    pending: 'bg-muted text-muted-foreground',
  };

  const upcomingHolidays = holidays
    .filter((h) => h.date >= new Date())
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 4);

  const holidayDates = holidays.map((h) => h.date);

  // Debug user name
  useEffect(() => {
    if (user) {
      console.log('Dashboard User:', user);
    }
  }, [user]);

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.name || user?.email?.split('@')[0] || 'User'}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{today}</p>
      </div>

      {/* Check-in Card */}
      <div className="stat-card flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-3 h-3 rounded-full ${checkedIn ? 'bg-success pulse-dot' : 'bg-muted-foreground/30'
                }`}
            />
            <span className="font-semibold text-lg">
              {checkedIn ? 'Checked In' : 'Not Checked In'}
            </span>
          </div>

          {checkedIn && (
            <div className="font-mono text-3xl font-bold tracking-wider text-primary">
              {formatTime(elapsed)}
            </div>
          )}

          {/* Validation Status */}
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="flex items-center gap-1.5">
              <Wifi className="w-4 h-4" />
              IP:
              {ipValid ? (
                <CheckCircle2 className="w-4 h-4 text-success" />
              ) : (
                <XCircle className="w-4 h-4 text-destructive" />
              )}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              Location:
              {locationValid ? (
                <CheckCircle2 className="w-4 h-4 text-success" />
              ) : (
                <XCircle className="w-4 h-4 text-destructive" />
              )}
            </span>
          </div>
        </div>

        <Button
          size="lg"
          onClick={checkedIn ? handleCheckOut : handleCheckIn}
          disabled={loading || !isWithinHours}
          title={!isWithinHours ? `Allowed only between ${formatOfficeTime(officeHours.start)} – ${formatOfficeTime(officeHours.end)}` : undefined}
          className={
            !isWithinHours
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
      </div>

      {/* Office Hours Info */}
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm ${isWithinHours
        ? 'bg-success/10 text-success'
        : 'bg-destructive/10 text-destructive'
        }`}>
        <Clock className="w-4 h-4" />
        <span>
          Office hours: <strong>{formatOfficeTime(officeHours.start)} – {formatOfficeTime(officeHours.end)}</strong>
          {!isWithinHours && ' — Check-in/out is currently unavailable'}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center justify-between mb-2">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Calendar + Holidays & Tasks Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mini Calendar */}
        <div className="stat-card flex flex-col items-center">
          <h2 className="font-semibold text-lg mb-3 self-start">Calendar</h2>
          <Calendar
            mode="single"
            selected={calendarDate}
            onSelect={setCalendarDate}
            className="rounded-md border shadow-sm p-4 w-full"
            modifiers={{ holiday: holidayDates }}
            modifiersClassNames={{
              holiday: 'bg-destructive/15 text-destructive font-bold',
            }}
          />
        </div>

        {/* Upcoming Holidays & Events */}
        <div className="stat-card">
          <h2 className="font-semibold text-lg mb-4">Upcoming Holidays & Events</h2>
          <div className="space-y-3">
            {upcomingHolidays.map((h, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${holidayTypeStyles[h.type]}`}>
                  {h.type === 'holiday' ? <Palmtree className="w-4 h-4" /> : <Star className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{h.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {h.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${holidayTypeStyles[h.type]}`}>
                  {h.type}
                </Badge>
              </div>
            ))}
            {upcomingHolidays.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No upcoming holidays</p>
            )}
          </div>
        </div>
      </div>

      {/* Today's Tasks */}
      <div className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Today's Tasks</h2>
          <Badge variant="secondary" className="text-xs">
            {todayTasks.filter((t) => t.status === 'completed').length}/{todayTasks.length} done
          </Badge>
        </div>
        <div className="space-y-3">
          {todayTasks.map((task, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <span
                className={`text-sm ${task.status === 'completed' ? 'line-through text-muted-foreground' : ''
                  }`}
              >
                {task.title}
              </span>
              <span className={`badge-status ${statusColors[task.status]}`}>
                {task.status.replace('_', ' ')}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Progress</span>
            <span>{Math.round((todayTasks.filter((t) => t.status === 'completed').length / todayTasks.length) * 100)}%</span>
          </div>
          <Progress
            value={(todayTasks.filter((t) => t.status === 'completed').length / todayTasks.length) * 100}
            className="h-2"
          />
        </div>
      </div>
    </div>
  );
}
