'use server';

import { createClient } from '@/lib/supabase/server';
import { formatTime } from '@/lib/time';
import { endOfWeek, set, startOfWeek } from 'date-fns';

// Check if user is admin
async function isAdmin(supabase: any) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    return profile?.role === 'admin';
}


// Search Employees
export async function getEmployeesBySearch(search: string = '') {
    try {
        console.log('Searching employees with query:', search);
        const supabase = await createClient();
        const isAdminUser = await isAdmin(supabase);
        console.log('Is admin user:', isAdminUser);
        if (!isAdminUser) {
            return { error: 'Access denied. Admin role required.' };
        }
        let query = supabase
            .from('profiles')
            .select('id, name, email, emp_id, designation')
            .order('name', { ascending: true });

        if (search && search.trim()) {
            query = query.ilike('name', `%${search.trim()}%`);
        }
        const { data, error } = await query;
        console.log('Query error:', error);
        console.log('Query data:', data);
        if (error) throw error;
        return {
            success: true,
            data: data || []
        };
    } catch (err) {
        console.error('Employee search error:', err);
        return {
            success: false,
            error: 'Failed to fetch employees'
        };
    }
}

// Get the particular employee attendance by their name
export async function getEmployeeReport(employeeId: string) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: 'Unauthorized' };

        // Verify the caller is admin or hr
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'admin' && profile?.role !== 'hr') {
            return { success: false, error: 'Access denied. Admin or HR role required.' };
        }

        const currentDate = new Date();
        const monthlyStats: any[] = [];

        for (let i = 0; i < 12; i++) {
            const date = new Date(
                currentDate.getFullYear(),
                currentDate.getMonth() - i,
                1
            );
            const month = date.getMonth() + 1;
            const year = date.getFullYear();
            const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
            const endDate = new Date(year, month, 0)
                .toISOString()
                .split("T")[0];

            // Get detailed attendance records with all fields
            const { data, error } = await supabase
                .from("attendance")
                .select("*")
                .eq("user_id", employeeId)
                .gte("date", startDate)
                .lte("date", endDate)
                .order("date", { ascending: false });

            if (error) {
                console.error(error);
                continue;
            }

            const safeData = data || [];

            // Process detailed records with formatted times
            const detailedRecords = safeData.map(record => ({
                ...record,
                check_in_display: record.check_in ? formatTime(record.check_in) : null,
                check_out_display: record.check_out ? formatTime(record.check_out) : null,
                hours_display: record.total_minutes
                    ? `${Math.floor(record.total_minutes / 60)}h ${record.total_minutes % 60}m`
                    : null,
            }));

            // Calculate monthly statistics
            monthlyStats.push({
                month: date.toLocaleDateString("en-US", {
                    month: "short",
                    year: "numeric"
                }),
                present: safeData.filter((r: any) => r.present === true || r.status === "on_time").length,
                absent: safeData.filter((r: any) => r.status === "absent").length,
                leave: safeData.filter((r: any) => r.status === "half_day").length,
                late: safeData.filter((r: any) => r.status === "late").length,
                wfh: safeData.filter((r: any) => r.work_type === "wfh").length,
                // Add detailed records
                detailedRecords: detailedRecords,
                // Add summary statistics
                totalHours: safeData.reduce((sum: number, r: any) => sum + (r.total_minutes || 0), 0),
                averageHoursPerDay: safeData.length > 0
                    ? Math.round((safeData.reduce((sum: number, r: any) => sum + (r.total_minutes || 0), 0) || 0) / safeData.length / 60 * 10) / 10
                    : 0,
                overtimeHours: safeData.reduce((sum: number, r: any) => sum + (r.overtime_by || 0), 0)
            });
        }

        return {
            success: true,
            data: monthlyStats.reverse() // Show most recent first
        };
    } catch (err) {
        console.error('Error fetching employee report:', err);
        return {
            success: false,
            error: 'Failed to fetch employee attendance data'
        };
    }
}

// Admin/HR only: Returns attendance records for all employees (or a specific one)
export async function getEmployeesAttendance(month: number, year: number, employeeId?: string) {
    try {
        // Check cache first for all-employee queries
        if (!employeeId || employeeId === 'all') {
            const cacheKey = getCacheKey('employees_attendance', { month, year });
            const cachedData = getCachedData(cacheKey);
            if (cachedData) {
                return cachedData;
            }
        }

        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        // Verify the caller is admin or hr
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'admin' && profile?.role !== 'hr') return [];

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = new Date(year, month, 0);
        const endDateStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

        // Optimized query with only necessary fields
        let query = supabase
            .from('attendance')
            .select('user_id, status, work_type, total_minutes, check_in, check_out, present, profiles!inner(name, email, emp_id, designation)')
            .gte('date', startDate)
            .lte('date', endDateStr)
            .order('date', { ascending: false });

        if (employeeId && employeeId !== 'all') {
            query = query.eq('user_id', employeeId);
        }

        const { data, error } = await query;
        if (error) throw error;

        const safeData = data || [];
        const result = safeData.map(record => ({
            ...record,
            employee_name: (record.profiles as any)?.name || 'Unknown',
            employee_email: (record.profiles as any)?.email || '',
            employee_emp_id: (record.profiles as any)?.emp_id || '',
            employee_designation: (record.profiles as any)?.designation || '',
            check_in_display: record.check_in ? formatTime(record.check_in) : null,
            check_out_display: record.check_out ? formatTime(record.check_out) : null,
            hours_display: record.total_minutes
                ? `${Math.floor(record.total_minutes / 60)}h ${record.total_minutes % 60}m`
                : null,
        }));

        // Cache the result for all-employee queries
        if (!employeeId || employeeId === 'all') {
            const cacheKey = getCacheKey('employees_attendance', { month, year });
            setCachedData(cacheKey, result);
        }

        return result;
    } catch (error) {
        console.error('Error in getEmployeesAttendance:', error);
        return [];
    }
}

// Get Attendance Summary
async function getAllEmployees() {
    try {
        const supabase = await createClient();

        const isAdminUser = await isAdmin(supabase);
        if (!isAdminUser) {
            return { error: 'Access denied. Admin role required.' };
        }

        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();

        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

        const { data, error } = await supabase
            .from('attendance')
            .select(`
                user_id,
                status,
                work_type,
                total_minutes,
                overtime_by,
                present,
                profiles(name)
            `)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('user_id');

        if (error) throw error;

        const safeData = data || [];
        const employees = safeData.map((item: any) => item.profiles?.name).filter(Boolean);
        const uniqueEmployees = [...new Set(employees)];

        const summary = {
            totalDays: safeData.length,
            presentDays: safeData.filter((i: any) => i.present === true || i.status === 'on_time').length,
            absentDays: safeData.filter((i: any) => i.status === 'absent').length,
            lateDays: safeData.filter((i: any) => i.status === 'late').length,
            wfhDays: safeData.filter((i: any) => i.work_type === 'wfh').length,
            totalHours: safeData.reduce((sum: number, i: any) => sum + (i.total_minutes || 0), 0),
            totalOvertime: safeData.reduce((sum: number, i: any) => sum + (i.overtime_by || 0), 0),
        };

        return {
            success: true,
            data: uniqueEmployees,
            summary,
            month,
            year
        };

    } catch (err: any) {
        console.error('Error fetching attendance report:', err);
        return { error: err.message };
    }
}

// Optimized Monthly Chart Data with better query and caching
export async function getMonthlyAggregateData() {
    try {
        const supabase = await createClient();
        const isAdminUser = await isAdmin(supabase);
        if (!isAdminUser) {
            return { error: 'Access denied. Admin role required.' };
        }

        // Check cache first
        const cacheKey = getCacheKey('monthly_aggregate_all');
        const cachedData = getCachedData(cacheKey);
        if (cachedData) {
            return {
                success: true,
                data: cachedData,
                fromCache: true
            };
        }

        const currentDate = new Date();
        const monthlyStats = [];
        
        // Single query to get all data for the past 12 months
        const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 11, 1);
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const endDateStr = endDate.toISOString().split('T')[0];

        // Optimized single query with only necessary fields
        const { data, error } = await supabase
            .from('attendance')
            .select(`
                status, 
                work_type, 
                user_id,
                date,
                present
            `)
            .gte('date', startDateStr)
            .lte('date', endDateStr)
            .order('date');

        if (error) {
            console.error('Monthly aggregate query error:', error);
            return { error: error.message };
        }

        const safeData = data || [];
        
        // Group data by month for efficient processing
        const dataByMonth = new Map();
        safeData.forEach(record => {
            const date = new Date(record.date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!dataByMonth.has(monthKey)) {
                dataByMonth.set(monthKey, []);
            }
            dataByMonth.get(monthKey).push(record);
        });

        // Process each month
        for (let i = 0; i < 12; i++) {
            const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const monthData = dataByMonth.get(monthKey) || [];

            // Calculate aggregated stats by unique employees per status
            const presentEmployees = [...new Set(monthData.filter((r: any) => r.present === true || r.status === 'on_time').map((r: any) => r.user_id))];
            const absentEmployees = [...new Set(monthData.filter((r: any) => r.status === 'absent').map((r: any) => r.user_id))];
            const leaveEmployees = [...new Set(monthData.filter((r: any) => r.status === 'half_day').map((r: any) => r.user_id))];
            const lateEmployees = [...new Set(monthData.filter((r: any) => r.status === 'late').map((r: any) => r.user_id))];
            const wfhEmployees = [...new Set(monthData.filter((r: any) => r.work_type === 'wfh').map((r: any) => r.user_id))];

            monthlyStats.push({
                month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                present: presentEmployees.length,
                absent: absentEmployees.length,
                leave: leaveEmployees.length,
                late: lateEmployees.length,
                wfh: wfhEmployees.length,
                totalEmployees: [...new Set(monthData.map((r: any) => r.user_id))].length
            });
        }

        const finalData = monthlyStats.reverse();
        
        // Cache the result for 30 minutes
        setCachedData(cacheKey, finalData);
        
        return {
            success: true,
            data: finalData,
            fromCache: false
        };
    } catch (err: any) {
        console.error('Monthly aggregate data error:', err);
        return { error: err.message };
    }
}

// Cache utility functions
function getCacheKey(prefix: string, params?: any) {
  const paramString = params ? JSON.stringify(params) : '';
  return `${prefix}_${paramString}`;
}

function getCachedData(cacheKey: string) {
  if (typeof window === 'undefined') return null;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();
    
    // Cache expires after 30 minutes (1800000 ms)
    if (now - timestamp > 1800000) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

function setCachedData(cacheKey: string, data: any) {
  if (typeof window === 'undefined') return;
  try {
    const cacheData = {
      data,
      timestamp: Date.now()
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

// Weekly Tasks Data with Caching
export async function getWeeklyTasksData(employeeId?: string) {
  try {
    console.log('Starting getWeeklyTasksData with employeeId:', employeeId);
    
    // Check cache first (client-side only)
    const cacheKey = getCacheKey('weekly_tasks', { employeeId });
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
      console.log('Returning cached weekly tasks data');
      return {
        success: true,
        data: cachedData,
        fromCache: true
      };
    }
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log('User not authenticated');
      return { error: "Unauthorized" };
    }
    
    // Get start of current week (Sunday)
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    // Get end of current week (Saturday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    console.log('Week range:', {
      start: startOfWeek.toISOString(),
      end: endOfWeek.toISOString()
    });

    let query = supabase
      .from("tasks")
      .select("status, assigned_to, created_at")
      .gte("created_at", startOfWeek.toISOString())
      .lte("created_at", endOfWeek.toISOString());

    if (employeeId) {
      console.log('Filtering by employee ID:', employeeId);
      query = query.eq("assigned_to", employeeId);
    }

    console.log('Executing weekly query...');
    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    const safeData = data || [];
    console.log('Raw weekly tasks data:', safeData);
    console.log('Number of weekly tasks found:', safeData.length);
    
    // Show all unique statuses found in data
    const uniqueStatuses = [...new Set(safeData.map((task: any) => task.status))];
    console.log('Unique weekly task statuses found:', uniqueStatuses);

    const weeklyMap: any = {};

    // Initialize all days of week
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    daysOfWeek.forEach(day => {
      weeklyMap[day] = {
        week: day,
        done: 0,
        pending: 0
      };
    });

    safeData.forEach((task: any) => {
      console.log('Processing weekly task:', task);
      const date = new Date(task.created_at);
      const day = date.toLocaleDateString("en-US", { weekday: "short" });
      console.log('Task date:', date, 'Day:', day, 'Status:', task.status);

      if (weeklyMap[day]) {
        if (task.status === "completed") {
          weeklyMap[day].done++;
          console.log(`Incremented done count for ${day}`);
        } else {
          // Count anything that's not "completed" as pending
          weeklyMap[day].pending++;
          console.log(`Incremented pending count for ${day} (status: ${task.status})`);
        }
      }
    });

    const finalData = Object.values(weeklyMap);
    console.log(`Weekly tasks ${employeeId ? `for employee ${employeeId}` : 'for all employees'}:`, finalData);

    // Cache the result
    setCachedData(cacheKey, finalData);

    return {
      success: true,
      data: finalData,
      fromCache: false
    };

  } catch (err: any) {
    console.error("Weekly tasks error:", err);
    return { error: err.message };
  }
}

// Monthly Tasks Data with Caching
export async function getMonthlyTasksData(employeeId?: string) {
  try {
    console.log('Starting getMonthlyTasksData with employeeId:', employeeId);
    
    // Check cache first (client-side only)
    const cacheKey = getCacheKey('monthly_tasks', { employeeId });
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
      console.log('Returning cached monthly tasks data');
      return {
        success: true,
        data: cachedData,
        fromCache: true
      };
    }
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log('User not authenticated');
      return { error: "Unauthorized" };
    }
    
    // Get current date and calculate months for current year only
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const monthlyStats = [];
    
    // Process months from January to current month of current year
    for (let i = 0; i <= currentMonth; i++) {
      const month = i + 1;
      const startDate = `${currentYear}-${String(month).padStart(2, '0')}-01`;
      const endDate = new Date(currentYear, month, 0).toISOString().split('T')[0];

      console.log('Processing month:', {
        month: new Date(currentYear, i).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        startDate,
        endDate
      });

      let query = supabase
        .from("tasks")
        .select("status, assigned_to, created_at")
        .gte("created_at", startDate)
        .lte("created_at", endDate);

      if (employeeId) {
        console.log('Filtering by employee ID:', employeeId);
        query = query.eq("assigned_to", employeeId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Database error for month:', new Date(currentYear, i).toLocaleDateString(), error);
        continue;
      }

      const safeData = data || [];
      console.log('Tasks found for month:', new Date(currentYear, i).toLocaleDateString(), safeData.length);
      
      // Count tasks by status
      const doneCount = safeData.filter((task: any) => task.status === "completed").length;
      const pendingCount = safeData.filter((task: any) => task.status !== "completed").length;

      monthlyStats.push({
        month: new Date(currentYear, i).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        done: doneCount,
        pending: pendingCount
      });
    }

    const finalData = monthlyStats.reverse(); // Show oldest to newest
    console.log(`Monthly tasks ${employeeId ? `for employee ${employeeId}` : 'for all employees'}:`, finalData);

    // Cache the result
    setCachedData(cacheKey, finalData);

    return {
      success: true,
      data: finalData,
      fromCache: false
    };

  } catch (err: any) {
    console.error("Monthly tasks error:", err);
    return { error: err.message };
  }
}

// Quarterly Tasks Data with Caching
export async function getQuarterlyTasksData(employeeId?: string) {
  try {
    console.log('Starting getQuarterlyTasksData with employeeId:', employeeId);
    
    // Check cache first (client-side only)
    const cacheKey = getCacheKey('quarterly_tasks', { employeeId });
    const cachedData = getCachedData(cacheKey);
    
    if (cachedData) {
      console.log('Returning cached quarterly tasks data');
      return {
        success: true,
        data: cachedData,
        fromCache: true
      };
    }
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.log('User not authenticated');
      return { error: "Unauthorized" };
    }
    
    // Get current date
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    // Initialize quarterly map for current year's 4 quarters
    const quarterlyMap: any = {};

    // Get data for the 4 quarters of the current year
    for (let i = 0; i < 4; i++) {
      const quarterStartMonth = i * 3;
      const quarterNumber = i + 1;

      // Get month names for the quarter
      const startMonthName = new Date(currentYear, quarterStartMonth, 1).toLocaleDateString('en-US', { month: 'short' });
      const endMonthName = new Date(currentYear, quarterStartMonth + 2, 1).toLocaleDateString('en-US', { month: 'short' });

      quarterlyMap[`Q${quarterNumber} ${currentYear}`] = {
        quarter: `Q${quarterNumber} ${currentYear} (${startMonthName}-${endMonthName})`,
        done: 0,
        pending: 0
      };
    }

    // Get data for the entire current year
    const startDate = new Date(currentYear, 0, 1); // January 1st of current year
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(currentYear, 11, 31); // December 31st of current year
    endDate.setHours(23, 59, 59, 999);
    
    console.log('Query range for quarterly data:', {
      start: startDate.toISOString(),
      end: endDate.toISOString()
    });

    let query = supabase
      .from("tasks")
      .select("status, assigned_to, created_at")
      .gte("created_at", startDate.toISOString())
      .lte("created_at", endDate.toISOString());

    if (employeeId) {
      console.log('Filtering by employee ID:', employeeId);
      query = query.eq("assigned_to", employeeId);
    }

    console.log('Executing quarterly query...');
    const { data, error } = await query;

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    const safeData = data || [];
    console.log('Raw quarterly tasks data:', safeData);
    console.log('Number of quarterly tasks found:', safeData.length);

    safeData.forEach((task: any) => {
      console.log('Processing quarterly task:', task);
      const taskDate = new Date(task.created_at);
      const quarterStartMonth = Math.floor(taskDate.getMonth() / 3) * 3;
      const quarterYear = taskDate.getFullYear();
      const quarterNumber = Math.floor(quarterStartMonth / 3) + 1;
      const quarterKey = `Q${quarterNumber} ${quarterYear}`;
      console.log('Task date:', taskDate, 'Quarter:', quarterKey, 'Status:', task.status);

      if (quarterlyMap[quarterKey]) {
        if (task.status === "completed") {
          quarterlyMap[quarterKey].done++;
          console.log(`Incremented done count for ${quarterKey}`);
        } else {
          // Count anything that's not "completed" as pending
          quarterlyMap[quarterKey].pending++;
          console.log(`Incremented pending count for ${quarterKey} (status: ${task.status})`);
        }
      }
    });

    const finalData = Object.values(quarterlyMap);
    console.log(`Quarterly tasks ${employeeId ? `for employee ${employeeId}` : 'for all employees'}:`, finalData);

// ...
    setCachedData(cacheKey, finalData);

    return {
      success: true,
      data: finalData,
      fromCache: false
    };

  } catch (err: any) {
    console.error("Quarterly tasks error:", err);
    return { error: err.message };
  }
}

// Main Report
export async function getReportData() {
    const supabase = await createClient();
    const isAdminUser = await isAdmin(supabase);
    if (!isAdminUser) {
        return { error: 'Unauthorized' };
    }
    const report = await getAllEmployees();
    if (report.error) {
        return { attendance: [], tasks: [], employees: [] };
    }
    const employees = await getEmployeesBySearch();
    return {
        attendance: report.data || [],
        tasks: [],
        employees: employees.data || []
    };
}