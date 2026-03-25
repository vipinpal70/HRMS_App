'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { TriangleAlert } from 'lucide-react';
import { Button } from './ui/button';
import { getTasks } from '../actions/tasks';
import { getCompanySettings } from '../actions/settings';
import { createNotification } from '../actions/notifications';
import { useAuth } from '../context/AuthContext';
import { createClient } from '@/lib/supabase/client';

export default function TaskReminder() {
  const { user } = useAuth();
  const [showPopUp, setShowPopUp] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'emp') return;

    const checkTasksAndNotify = async () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const storageKey = `task_reminder_${user.id}_${todayStr}`;

      // Check if already notified today in this session/browser
      if (localStorage.getItem(storageKey)) return;

      try {
        const supabase = createClient();
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if (!profile || profile.role !== 'emp') return;

        const [tasks, settings] = await Promise.all([
          getTasks(),
          getCompanySettings()
        ]);

        const todayTasks = tasks.filter((t: any) => t.start_day === todayStr);

        if (todayTasks.length === 0) {
          const startTime = settings?.office_start_time || '09:00';
          const [hours, minutes] = startTime.split(':').map(Number);

          const thresholdTime = new Date();
          thresholdTime.setHours(hours, minutes, 0, 0);
          // +1.5 hours = 90 minutes
          thresholdTime.setMinutes(thresholdTime.getMinutes() + 90);

          if (new Date() > thresholdTime) {
            // Trigger toast
            toast.error("No task found for today, please add your task", {
              duration: 5000,
              position: 'top-center',
              icon: '⚠️',
            });
            setShowPopUp(true);

            // Trigger Supabase In-app notification
            await createNotification(
              "Task Reminder",
              "Oops! It seems you haven't added your task for today, please add your task",
              "warning",
              "system"
            );

            // Mark as notified for today
            localStorage.setItem(storageKey, 'true');
          }
        }
      } catch (error) {
        console.error('Error in task reminder check:', error);
      }
    };

    // Run check on mount
    const timer = setTimeout(checkTasksAndNotify, 3000); // Wait a bit after mount for everything to stabilize

    // Check periodically (every 10 minutes)
    const interval = setInterval(checkTasksAndNotify, 10 * 60000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [user]);

  return (
    <Dialog open={showPopUp} onOpenChange={setShowPopUp}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <TriangleAlert className='text-yellow-500' /> Task Reminder
          </DialogTitle>
          <DialogDescription className="text-center py-6 text-lg font-normal text-foreground">
            Oops! It seems you haven't added any task for today, please add your task
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button
            type="button"
            variant="default"
            size="lg"
            className="w-full sm:w-auto px-10"
            onClick={() => setShowPopUp(false)}
          >
            Okay
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
