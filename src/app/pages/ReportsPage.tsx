"use client";

import { useState, useMemo } from "react";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { usePDF } from 'react-to-pdf';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { useQuery } from '@tanstack/react-query';

import {
  getMonthlyAggregateData,
  getEmployeesBySearch,
  getEmployeeReport,
  getMonthlyTasksData,
  getQuarterlyTasksData,
  getEmployeesAttendance
} from "../api/report/actions";

import { Search, Loader2 } from "lucide-react";

// --- TypeScript Interfaces ---
interface Employee {
  id: string;
  name: string;
  email: string;
  emp_id: string;
  designation: string;
}

interface MonthlyTask {
  month: string;
  done: number;
  pending: number;
}

interface QuarterlyTask {
  quarter: string;
  done: number;
  pending: number;
}

interface AttendanceRecord {
  user_id: string;
  status: string;
  work_type: string;
  total_minutes: number | null;
  check_in: string | null;
  check_out: string | null;
  present: boolean | null;
  employee_name: string;
  employee_email: string;
  employee_emp_id: string;
  employee_designation: string;
  check_in_display: string | null;
  check_out_display: string | null;
  hours_display: string | null;
}

interface MonthlyAggregate {
  month: string;
  present: number;
  absent: number;
  leave: number;
  late: number;
  wfh: number;
  totalEmployees: number;
}

// 1. Move static styles and helpers outside the component
const pageBreakStyle = `
@media print {
  .page-break {
    page-break-before: always;
  }
}
.page-break{
  break-before: page;
}
`;

const customColors = {
  Present: "#2ECC70",
  Absent: "#ff4646ff",
  Late: "#f5a623",
  WFH: "#3498db",
  Leave: "#9b59b6"
};

// 2. Component Extraction: Move BrowserPieChart outside to prevent re-mounting
const BrowserPieChart = ({ attendanceData, selectedEmployeeName }: { attendanceData: AttendanceRecord[], selectedEmployeeName?: string }) => {
    const stats = useMemo(() => {
        if (!attendanceData || attendanceData.length === 0) {
            return { present: 15, absent: 4, late: 2, wfh: 5, total: 26 };
        }
        const s = attendanceData.reduce((acc, record) => {
            if (record.present === true || record.status === 'on_time') acc.present++;
            else if (record.status === 'absent') acc.absent++;
            else if (record.status === 'late') acc.late++;
            if (record.work_type === 'wfh') acc.wfh++;
            if (record.status === 'half_day') acc.absent++;
            return acc;
        }, { present: 0, absent: 0, late: 0, wfh: 0 });

        const total = s.present + s.absent + s.late + s.wfh;
        return { ...s, total };
    }, [attendanceData]);

    const options: Highcharts.Options = useMemo(() => {
        const total = stats.total;
        const presentPercentage = total > 0 ? Math.round((stats.present / total) * 100) : 0;
        const absentPercentage = total > 0 ? Math.round((stats.absent / total) * 100) : 0;
        const latePercentage = total > 0 ? Math.round((stats.late / total) * 100) : 0;
        const wfhPercentage = total > 0 ? Math.round((stats.wfh / total) * 100) : 0;

        const presentCombined = presentPercentage + latePercentage + wfhPercentage;
        const absentCombined = absentPercentage;

        return {
            chart: { type: "pie", backgroundColor: "transparent" },
            title: {
                text: selectedEmployeeName ? `${selectedEmployeeName} - Monthly Attendance Report` : `Monthly Attendance Report`,
                style: { color: "hsl(var(--foreground))" }
            },
            tooltip: {
                valueSuffix: "%",
                backgroundColor: "hsl(var(--card))",
                style: { color: "hsl(var(--foreground))" }
            },
            plotOptions: { pie: { shadow: false, center: ["50%", "50%"] } },
            series: [
                {
                    type: "pie",
                    name: "Detailed Breakdown",
                    data: [
                        { name: "Present", y: presentPercentage, color: customColors.Present },
                        { name: "Late", y: latePercentage, color: customColors.Late },
                        { name: "WFH", y: wfhPercentage, color: customColors.WFH },
                        { name: "Absent", y: absentPercentage, color: customColors.Absent }
                    ],
                    size: "45%",
                    dataLabels: { distance: -20, style: { color: "white", fontSize: "10px", textOutline: "none" } }
                },
                {
                    type: "pie",
                    name: "Overall Attendance",
                    data: [
                        { name: "Present", y: presentCombined, color: customColors.Present },
                        { name: "Absent", y: absentCombined, color: customColors.Absent }
                    ],
                    size: "80%",
                    innerSize: "60%",
                    dataLabels: {
                        format: "<b>{point.name}</b>: {point.y}%",
                        style: { fontWeight: "normal", color: "hsl(var(--foreground))" }
                    }
                }
            ]
        };
    }, [stats, selectedEmployeeName]);

    if (stats.total === 0) {
        return (
            <div className="w-full max-w-xl mx-auto flex items-center justify-center h-64 text-center text-muted-foreground">
                <p className="text-sm">No attendance data available {selectedEmployeeName && `for ${selectedEmployeeName}`}</p>
            </div>
        );
    }

    return (
        <div className="w-full max-w-xl mx-auto">
            <HighchartsReact highcharts={Highcharts} options={options} />
        </div>
    );
};

export default function ReportsPage() {
  const { toPDF, targetRef } = usePDF({
    filename: "attendance-report.pdf",
    page: { margin: 20 }
  });

  const [search, setSearch] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const now = useMemo(() => new Date(), []);
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // 3. Transition to useQuery for all data sources
  const { data: employeeSearchResult, isLoading: searchLoading } = useQuery({
    queryKey: ['employee-search', search],
    queryFn: () => getEmployeesBySearch(search),
    enabled: search.trim().length > 0
  }) as { data: { success: boolean; data: Employee[] } | undefined; isLoading: boolean };

  const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
    queryKey: ['report-monthly-agg', selectedEmployee?.id],
    queryFn: async () => {
        if (selectedEmployee?.id) {
            const res = await getEmployeeReport(selectedEmployee.id);
            return res?.data ? [...res.data].reverse() : [];
        }
        const res = await getMonthlyAggregateData();
        return res?.data || [];
    }
  }) as { data: MonthlyAggregate[] | undefined; isLoading: boolean };

  const { data: monthlyTasksData, isLoading: tasksLoading } = useQuery({
    queryKey: ['report-monthly-tasks', selectedEmployee?.id],
    queryFn: async () => {
        const res = await getMonthlyTasksData(selectedEmployee?.id);
        return res?.data || [];
    }
  }) as { data: MonthlyTask[] | undefined; isLoading: boolean };

  const { data: quarterlyTasksData, isLoading: quarterlyLoading } = useQuery({
    queryKey: ['report-quarterly-tasks', selectedEmployee?.id],
    queryFn: async () => {
        const res = await getQuarterlyTasksData(selectedEmployee?.id);
        return res?.data || [];
    }
  }) as { data: QuarterlyTask[] | undefined; isLoading: boolean };

  const { data: attendanceData, isLoading: attendanceLoading } = useQuery({
    queryKey: ['report-attendance', selectedEmployee?.id, currentMonth, currentYear],
    queryFn: () => getEmployeesAttendance(currentMonth, currentYear, selectedEmployee?.id)
  }) as { data: AttendanceRecord[] | undefined; isLoading: boolean };

  const employees = useMemo<Employee[]>(() => employeeSearchResult?.success ? employeeSearchResult.data || [] : [], [employeeSearchResult]);
  const safeMonthlyTasks = useMemo<MonthlyTask[]>(() => monthlyTasksData || [], [monthlyTasksData]);
  const safeQuarterlyTasks = useMemo<QuarterlyTask[]>(() => quarterlyTasksData || [], [quarterlyTasksData]);
  const safeAttendance = useMemo<AttendanceRecord[]>(() => attendanceData || [], [attendanceData]);

  const handleEmployeeSelect = (emp: Employee) => {
    setSelectedEmployee(emp);
    setSearch("");
  };

  const handleClearSelection = () => {
    setSelectedEmployee(null);
    setSearch("");
  };

  // 4. Memoize Highcharts Configuration Objects
  const monthlyTasksOptions: Highcharts.Options = useMemo(() => ({
    chart: { type: "column", backgroundColor: "transparent" },
    colors: ["#3732a7ff", "#2DAFFE"],
    title: {
      text: selectedEmployee ? `${selectedEmployee.name} - Monthly Tasks Overview` : "Monthly Tasks Overview",
      align: "center",
      style: { color: "hsl(var(--foreground))" }
    },
    xAxis: {
      categories: safeMonthlyTasks.map(item => item.month),
      labels: { style: { color: "hsl(var(--foreground))" } },
      lineColor: "hsl(var(--border))",
      tickColor: "hsl(var(--border))"
    },
    yAxis: {
      allowDecimals: false,
      min: 0,
      title: { text: "Count Tasks", style: { color: "hsl(var(--foreground))" } },
      labels: { style: { color: "hsl(var(--foreground))" } },
      lineColor: "hsl(var(--border))",
      tickColor: "hsl(var(--border))"
    },
    tooltip: {
      shared: false,
      pointFormat: "<b>{point.category}</b><br/>{series.name}: {point.y}<br/>Total: {point.stackTotal}",
      style: { color: "hsl(var(--foreground))" },
      backgroundColor: "hsl(var(--background))",
      borderColor: "hsl(var(--border))"
    },
    plotOptions: { column: { stacking: "normal" } },
    series: [
      { type: "column", name: "Task Done", data: safeMonthlyTasks.map(item => item.done) },
      { type: "column", name: "Task Pending", data: safeMonthlyTasks.map(item => item.pending) }
    ]
  }), [safeMonthlyTasks, selectedEmployee]);

  const quarterlyTasksOptions: Highcharts.Options = useMemo(() => ({
    chart: { type: "column", backgroundColor: "transparent" },
    colors: ["#3732a7ff", "#2DAFFE"],
    title: {
      text: selectedEmployee ? `${selectedEmployee.name} - Quarterly Tasks Overview` : "Quarterly Tasks Overview",
      align: "center",
      style: { color: "hsl(var(--foreground))" }
    },
    xAxis: {
      categories: safeQuarterlyTasks.map(item => item.quarter),
      labels: { style: { color: "hsl(var(--foreground))" } },
      lineColor: "hsl(var(--border))",
      tickColor: "hsl(var(--border))"
    },
    yAxis: {
      allowDecimals: false,
      min: 0,
      title: { text: "Count Tasks", style: { color: "hsl(var(--foreground))" } },
      labels: { style: { color: "hsl(var(--foreground))" } },
      lineColor: "hsl(var(--border))",
      tickColor: "hsl(var(--border))"
    },
    tooltip: {
      shared: false,
      pointFormat: "<b>{point.category}</b><br/>{series.name}: {point.y}<br/>Total: {point.stackTotal}",
      style: { color: "hsl(var(--foreground))" },
      backgroundColor: "hsl(var(--background))",
      borderColor: "hsl(var(--border))"
    },
    plotOptions: { column: { stacking: "normal" } },
    series: [
      { type: "column", name: "Task Done", data: safeQuarterlyTasks.map(item => item.done) },
      { type: "column", name: "Task Pending", data: safeQuarterlyTasks.map(item => item.pending) }
    ]
  }), [safeQuarterlyTasks, selectedEmployee]);

  const anyLoading = monthlyLoading || tasksLoading || quarterlyLoading || attendanceLoading;

  return (
    <>
      <div>
        <style>{pageBreakStyle}</style>
        <div className="space-y-6 animate-fade-up">
          {/* Header - Always visible */}
          <div className="flex flex-col md:flex-row justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">
                Reports & Analytics {selectedEmployee && `- ${selectedEmployee.name}`}
              </h1>
              <p className="text-muted-foreground text-sm mt-1">
                Monthly attendance and work progress overview {selectedEmployee && `for ${selectedEmployee.name}`}
              </p>
            </div>
            <button
              onClick={() => { setTimeout(() => toPDF(), 1000); }}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors text-sm font-medium mt-4 md:mt-0"
            >
              Export to PDF
            </button>
          </div>

          <div className="stat-card">
            <h3 className="font-semibold mb-4">Search Employee by Name</h3>
            <div className="relative">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Type employee name to search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-xs pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {searchLoading && (
                <div className="absolute right-3 top-2.5">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="mt-3 max-h-48 overflow-y-auto border rounded-lg empty:hidden">
              {employees.map((emp) => (
                <div
                  key={emp.id}
                  onClick={() => handleEmployeeSelect(emp)}
                  className="p-3 border-b last:border-b-0 text-sm cursor-pointer hover:bg-black/5 dark:hover:bg-black/20 dark:hover:text-white transition-colors flex justify-between items-center"
                >
                  <div>
                    <div className="font-medium text-hsl(var(--foreground))">{emp.name}</div>
                    <div className="text-xs text-hsl(var(--foreground))">ID: {emp.email}</div>
                    <div className="text-xs text-hsl(var(--foreground))">Designation: {emp.designation}</div>
                  </div>
                  <div className="text-xs text-blue-500 hover:text-blue-600 font-medium">View Report →</div>
                </div>
              ))}
            </div>
            {selectedEmployee && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleClearSelection}
                  className="text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-2"
                >
                  Clear Selection
                </button>
              </div>
            )}
          </div>

          <div ref={targetRef}>
            {selectedEmployee && (
              <div className="mb-6 p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">Employee Attendance Report</h3>
                <p className="text-sm text-gray-600">
                  Showing detailed attendance for: <span className="font-semibold ml-2">{selectedEmployee.name}</span>
                  <span className="ml-2">(EMAIL: {selectedEmployee.email})</span>
                </p>
              </div>
            )}

            <div className="relative min-h-[400px]">
              {anyLoading && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-lg">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground mt-4">Refreshing Report Data...</p>
                </div>
              )}

              <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8", anyLoading && "opacity-50 pointer-events-none")}>
                {/* Monthly Tasks Chart */}
                <div className="stat-card">
                  <h3 className="font-semibold font-roboto mb-4">
                    {selectedEmployee ? `${selectedEmployee.name} - Monthly Tasks` : 'All Employees - Monthly Tasks'}
                  </h3>
                  <div className="w-full max-w-4xl mx-auto">
                    <HighchartsReact highcharts={Highcharts} options={monthlyTasksOptions} />
                  </div>
                </div>

                {/* Browser Pie Chart */}
                <div className="stat-card">
                  <h3 className="font-semibold mb-4">
                    {selectedEmployee ? `${selectedEmployee.name} - Monthly Attendance` : 'All Employees - Monthly Attendance'}
                  </h3>
                  <BrowserPieChart attendanceData={safeAttendance} selectedEmployeeName={selectedEmployee?.name} />
                </div>
              </div>

              <div className="page-break"></div>

              {/* Quarterly Task Progress */}
              <div className={cn("stat-card mt-8", anyLoading && "opacity-50")}>
                <h3 className="font-semibold mb-4">
                  {selectedEmployee ? `${selectedEmployee.name} - Quarterly Tasks` : 'All Employees - Quarterly Tasks'}
                </h3>
                <div className="w-full max-w-6xl mx-auto">
                    <HighchartsReact highcharts={Highcharts} options={quarterlyTasksOptions} />
                </div>
              </div>
            </div>
          </div>

          {/* PDF Only Content - Standard Table View */}
          <div className="hidden">
            <div className="mt-10">
              <h2 className="text-xl font-semibold mb-4">Monthly Tasks Summary</h2>
              <table className="w-full border border-gray-300 text-sm">
                <thead className="bg-gray-100 italic">
                  <tr>
                    <th className="border px-3 py-2">Month</th>
                    <th className="border px-3 py-2">Done</th>
                    <th className="border px-3 py-2">Pending</th>
                    <th className="border px-3 py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {safeMonthlyTasks.map((item, id) => (
                    <tr key={id} className="text-center">
                      <td className="border px-3 py-2">{item.month}</td>
                      <td className="border px-3 py-2">{item.done}</td>
                      <td className="border px-3 py-2">{item.pending}</td>
                      <td className="border px-3 py-2">{item.done + item.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// Utility for class merging
function cn(...classes: (string | boolean | undefined)[]) {
    return classes.filter(Boolean).join(" ");
}