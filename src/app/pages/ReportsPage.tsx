"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Highcharts from "highcharts";
import HighchartsReact from "highcharts-react-official";
import { usePDF } from 'react-to-pdf';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

import { apiGet } from '@/lib/apiClient';
import { Search, Download } from "lucide-react";
import { Mosaic } from "react-loading-indicators";

// Add page break styling
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

export default function ReportsPage() {
  const { toPDF, targetRef } = usePDF({
    filename: "attendance-report.pdf",
    page: { margin: 20 }
  });
  const [search, setSearch] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [employeeFilter, setEmployeeFilter] = useState<string>('all');

  const now = useMemo(() => new Date(), []);
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  // Queries for "All Employees" data
  const { data: reportData, isLoading: reportLoading } = useQuery({
    queryKey: ['report-data'],
    queryFn: () => apiGet('/api/report?type=report-data'),
  });

  const { data: monthlyResult, isLoading: monthlyLoading } = useQuery({
    queryKey: ['monthly-aggregate'],
    queryFn: () => apiGet('/api/report?type=monthly-aggregate'),
  });

  const { data: monthlyTasksResult, isLoading: monthlyTasksLoading } = useQuery({
    queryKey: ['monthly-tasks', 'all'],
    queryFn: () => apiGet('/api/report?type=monthly-tasks'),
  });

  const { data: quarterlyTasksResult, isLoading: quarterlyTasksLoading } = useQuery({
    queryKey: ['quarterly-tasks', 'all'],
    queryFn: () => apiGet('/api/report?type=quarterly-tasks'),
  });

  const { data: attendanceResult, isLoading: attendanceLoading } = useQuery({
    queryKey: ['attendance-aggregate', currentMonth, currentYear, 'all'],
    queryFn: () => apiGet(`/api/report?type=attendance-aggregate&month=${currentMonth}&year=${currentYear}`),
  });

  const { data: employeesResult, isLoading: employeesLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => apiGet('/api/profile?type=employees'),
  });

  // Queries for specific employee data
  const { data: empAttendance, isLoading: empAttendanceLoading } = useQuery({
    queryKey: ['employee-report', employeeFilter],
    queryFn: () => apiGet(`/api/report?type=employee-report&userId=${employeeFilter}`),
    enabled: !!employeeFilter && employeeFilter !== 'all',
  });

  const { data: empMonthlyTasks, isLoading: empMonthlyTasksLoading } = useQuery({
    queryKey: ['monthly-tasks', employeeFilter],
    queryFn: () => apiGet(`/api/report?type=monthly-tasks&userId=${employeeFilter}`),
    enabled: !!employeeFilter && employeeFilter !== 'all',
  });

  const { data: empQuarterlyTasks, isLoading: empQuarterlyTasksLoading } = useQuery({
    queryKey: ['quarterly-tasks', employeeFilter],
    queryFn: () => apiGet(`/api/report?type=quarterly-tasks&userId=${employeeFilter}`),
    enabled: !!employeeFilter && employeeFilter !== 'all',
  });

  const { data: empAttendanceRecords, isLoading: empAttendanceRecordsLoading } = useQuery({
    queryKey: ['attendance-aggregate', currentMonth, currentYear, employeeFilter],
    queryFn: () => apiGet(`/api/report?type=attendance-aggregate&month=${currentMonth}&year=${currentYear}&userId=${employeeFilter}`),
    enabled: !!employeeFilter && employeeFilter !== 'all',
  });

  const allEmployees = employeesResult || [];
  const monthlyData = monthlyResult?.data || [];

  const monthlyTasksData = employeeFilter !== 'all'
    ? (empMonthlyTasks?.data || [])
    : (monthlyTasksResult?.data || []);

  const QuarterlyTasksData = employeeFilter !== 'all'
    ? (empQuarterlyTasks?.data || [])
    : (quarterlyTasksResult?.data || []);

  const attendanceData = employeeFilter !== 'all'
    ? (empAttendanceRecords?.data || [])
    : (attendanceResult?.data || []);

  const employeeReport = useMemo(() => {
    if (employeeFilter !== 'all' && empAttendance?.data) {
      return [...empAttendance.data].reverse();
    }
    return [];
  }, [employeeFilter, empAttendance]);

  const initialLoading = reportLoading || monthlyLoading || employeesLoading || (employeeFilter === 'all' && (monthlyTasksLoading || quarterlyTasksLoading || attendanceLoading));
  const isDataLoading = empAttendanceLoading || empMonthlyTasksLoading || empQuarterlyTasksLoading || empAttendanceRecordsLoading;
  const error = reportData?.error || monthlyResult?.error || (employeeFilter !== 'all' && empAttendance?.error);


  useEffect(() => {
    const fetchEmployees = async () => {
      if (!search.trim()) {
        setEmployees([]);
        return;
      }
      try {
        setSearchLoading(true);
        console.log('Frontend: Searching for employees with query:', search);
        const result = await apiGet(`/api/report?type=employee-search&query=${search}`);
        console.log('Frontend: Search result:', result);
        if (result?.success) {
          setEmployees(result.data || []);
        } else {
          console.log('Frontend: Search failed with error:', result?.error);
        }
      } catch (err) {
        console.error("Employee search failed:", err);
      } finally {
        setSearchLoading(false);
      }
    };
    fetchEmployees();
  }, [search]);

  // const Reportpage = () => {
  //   const {toPDF, targetRef} = usePDF({filename: 'report.pdf'});
  // }

  const handleEmployeeSelect = async (emp: any) => {
    setSelectedEmployee(emp);
    setEmployeeFilter(emp.id);
    setSearch(""); // Clear search to hide the dropdown
    setEmployees([]);
  };

  const handleClearSelection = async () => {
    setSelectedEmployee(null);
    setEmployeeFilter('all');
    setSearch("");
  };

  const chartData = selectedEmployee
    ? employeeReport
    : monthlyData;

  const latestMonthData = chartData.length > 0 ? chartData[chartData.length - 1] : null;

  if (initialLoading) {
    return (
      <div className="space-y-6 animate-fade-up">
        <div className="flex justify-between items-start">
          <div>
            <Skeleton width={220} height={28} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
            <Skeleton width={300} height={14} style={{ marginTop: 6 }} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
          </div>
          <Skeleton width={120} height={38} borderRadius={8} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
        </div>
        <div className="stat-card space-y-4">
          <Skeleton width={200} height={18} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
          <Skeleton width="100%" height={38} borderRadius={8} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="stat-card">
            <Skeleton width={200} height={18} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
            <Skeleton width="100%" height={280} style={{ marginTop: 16 }} borderRadius={8} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
          </div>
          <div className="stat-card">
            <Skeleton width={200} height={18} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
            <Skeleton width="100%" height={280} style={{ marginTop: 16 }} borderRadius={8} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
          </div>
        </div>
        <div className="stat-card">
          <Skeleton width={250} height={18} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
          <Skeleton width="100%" height={280} style={{ marginTop: 16 }} borderRadius={8} baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  // Browser Pie Chart Component
  const BrowserPieChart = () => {
    // Custom colors for attendance data
    const customColors = {
      Present: "#2ECC70",
      Absent: "#ff4646ff",
      Late: "#f5a623",
      WFH: "#3498db",
      Leave: "#9b59b6"
    };

    // Calculate attendance statistics from attendanceData
    const calculateAttendanceStats = () => {
      if (!Array.isArray(attendanceData)) {
        console.log('attendanceData is not an array:', attendanceData);
        return { present: 0, absent: 0, late: 0, wfh: 0, leave: 0 };
      }

      const stats = attendanceData.reduce((acc, record) => {
        console.log('Processing record:', record);

        // Use the actual attendance data from getEmployeesAttendance
        // Check for present flag and status
        if (record.present === true || record.status === 'on_time') {
          acc.present++;
          console.log('Counted as present');
        } else if (record.status === 'absent') {
          acc.absent++;
          console.log('Counted as absent');
        } else if (record.status === 'late') {
          acc.late++;
          console.log('Counted as late');
        }

        // Count WFH from work_type
        if (record.work_type === 'wfh') {
          acc.wfh++;
          console.log('Counted as WFH');
        }

        // Count leave from status
        if (record.status === 'half_day') {
          acc.leave++;
          console.log('Counted as leave');
        }

        return acc;
      }, { present: 0, absent: 0, late: 0, wfh: 0, leave: 0 });

      console.log('Final calculated stats:', stats);
      return stats;
    };

    const attendanceStats = calculateAttendanceStats();

    // Debug logging
    console.log('Attendance Data:', attendanceData);
    console.log('Calculated Stats:', attendanceStats);
    console.log('Selected Employee:', selectedEmployee?.name);

    // Calculate total for percentage calculation
    const total = attendanceStats.present + attendanceStats.absent + attendanceStats.late + attendanceStats.wfh + attendanceStats.leave;

    console.log('Total Records:', total);

    // Calculate percentages
    const presentPercentage = total > 0 ? Math.round(attendanceStats.present / total * 100) : 0;
    const absentPercentage = total > 0 ? Math.round(attendanceStats.absent / total * 100) : 0;
    const latePercentage = total > 0 ? Math.round(attendanceStats.late / total * 100) : 0;
    const wfhPercentage = total > 0 ? Math.round(attendanceStats.wfh / total * 100) : 0;
    const leavePercentage = total > 0 ? Math.round(attendanceStats.leave / total * 100) : 0;

    console.log('Percentages:', { presentPercentage, absentPercentage, latePercentage, wfhPercentage, leavePercentage });

    // If no data, show a message
    if (total === 0) {
      return (
        <div className="w-full max-w-xl mx-auto flex items-center justify-center h-64">
          <div className="text-center text-muted-foreground">
            <p className="text-sm">No attendance data available</p>
            {selectedEmployee && <p className="text-xs mt-1">for {selectedEmployee.name}</p>}
          </div>
        </div>
      );
    }

    // Calculate combined percentages for inner circle
    const presentCombined = presentPercentage + latePercentage + wfhPercentage;
    const absentCombined = absentPercentage + leavePercentage;

    const AttendanceData = [
      { name: "Present", y: presentCombined, color: customColors.Present },
      { name: "Absent", y: absentCombined, color: customColors.Absent }
    ];

    const DayData = [
      { name: "Present", y: presentPercentage, color: customColors.Present },
      { name: "Late", y: latePercentage, color: customColors.Late },
      { name: "WFH", y: wfhPercentage, color: customColors.WFH },
      { name: "Absent", y: absentCombined, color: customColors.Absent }
    ];

    const options: Highcharts.Options = {
      chart: {
        type: "pie",
        backgroundColor: "transparent"
      },

      title: {
        text: selectedEmployee ? `${selectedEmployee.name} - Monthly Attendance Report` : `Monthly Attendance Report`,
        style: {
          color: "hsl(var(--foreground))"
        }
      },

      tooltip: {
        valueSuffix: "%",
        backgroundColor: "hsl(var(--card))",
        style: {
          color: "hsl(var(--foreground))"
        }
      },

      plotOptions: {
        pie: {
          shadow: false,
          center: ["50%", "50%"]
        }
      },

      series: [
        {
          type: "pie",
          name: "Total Day",
          data: DayData,
          size: "45%",
          dataLabels: {
            distance: -30,
            style: {
              color: "white"
            }
          }
        },
        {
          type: "pie",
          name: "Attendance Data",
          data: AttendanceData,
          size: "80%",
          innerSize: "60%",
          dataLabels: {
            format: "<b>{point.name}</b>: {point.y}%",
            style: {
              fontWeight: "normal",
              color: "hsl(var(--foreground))"
            }
          }
        }
      ]
    };

    return (
      <div className="w-full max-w-xl mx-auto">
        <HighchartsReact
          highcharts={Highcharts}
          options={options}
        />
      </div>
    );
  };

  return (
    <>
      <div>
        <style>{pageBreakStyle}</style>
        <div className="space-y-6 animate-fade-up">
          {/* Header */}
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
              onClick={() => {
                setTimeout(() => {
                  toPDF();
                }, 1000);
              }}
              className="flex items-center px-4 py-2 gap-2 bg-primary text-white dark:text-black rounded-lg hover:bg-primary/80 transition-colors text-sm font-medium mt-4 md:mt-0"
            >
              <Download className="w-4 h-4" />
              Export to PDF
            </button>
          </div>
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">
                Search Employee by Name
              </h3>
              <div className="w-64">
                <Select value={employeeFilter} onValueChange={(val) => {
                  setEmployeeFilter(val);
                  if (val === 'all') {
                    handleClearSelection();
                  } else {
                    const emp = allEmployees.find((e: any) => e.id === val);
                    if (emp) handleEmployeeSelect(emp);
                  }
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {allEmployees.map((emp: any) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name || emp.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

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
                  <Skeleton width={20} height={20} circle baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
                </div>
              )}
            </div>
            <div className="mt-3 max-h-48 overflow-y-auto border rounded-lg">
              {/* {search && employees.length === 0 && !searchLoading && (
                <div className="p-3 text-sm text-muted-foreground text-center">
                  No employees found matching "{search}"
                </div>
              )} */}
              {employees.map((emp: any) => (
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
                  <div className="text-xs text-blue-500 hover:text-blue-600 font-medium">
                    View Report →
                  </div>
                </div>
              ))}
            </div>
            {selectedEmployee && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={handleClearSelection}
                  disabled={isDataLoading}
                  className="text-xs text-red-600 hover:text-red-800 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isDataLoading && (
                    <Skeleton width={16} height={16} circle baseColor="hsl(var(--muted))" highlightColor="hsl(var(--secondary))" />
                  )}
                  Clear
                </button>
              </div>
            )}
          </div>
          <div ref={targetRef}>
            {/* Selected Employee Info */}
            {selectedEmployee && (
              <div className="mb-6 p-4 border rounded-lg">
                <h3 className="font-semibold mb-2">
                  Employee Report & Analytics
                </h3>
                <p className="text-sm text-gray-600">
                  Showing detailed report for:
                  <span className="font-semibold ml-2">{selectedEmployee.name}</span>
                  <span className="ml-2">(EMAIL ID: {selectedEmployee.email})</span>
                </p>
              </div>
            )}
            {/* Charts Container */}
            <div className="relative">
              {isDataLoading && (
                <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-lg" style={{ minHeight: '400px' }}>
                  <Mosaic color="#f88a10" size="small" />
                  <p className="text-sm text-muted-foreground mt-4">Loading data...</p>
                </div>
              )}

              <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8 ${isDataLoading ? 'opacity-30' : ''}`}>
                {/* Monthly Tasks Chart */}
                <div className="stat-card">
                  <h3 className="font-semibold font-roboto mb-4">
                    {selectedEmployee ? `${selectedEmployee.name} - Monthly Tasks` : 'All Employees - Monthly Tasks'}
                  </h3>
                  <div className="w-full max-w-4xl mx-auto">
                    <HighchartsReact
                      highcharts={Highcharts}
                      options={{
                        chart: {
                          type: "column",
                          backgroundColor: "transparent",
                        },
                        colors: ["#3732a7ff", "#2DAFFE"],
                        title: {
                          text: selectedEmployee ? `${selectedEmployee.name} - Monthly Tasks Overview` : "Monthly Tasks Overview",
                          align: "center",
                          style: {
                            color: "hsl(var(--foreground))"
                          }
                        },
                        xAxis: {
                          categories: monthlyTasksData?.map((item: any) => item.month) || [],
                          labels: {
                            style: {
                              color: "hsl(var(--foreground))"
                            }
                          },
                          lineColor: "hsl(var(--border))",
                          tickColor: "hsl(var(--border))"
                        },
                        yAxis: {
                          allowDecimals: false,
                          min: 0,
                          title: {
                            text: "Count Tasks",
                            style: {
                              color: "hsl(var(--foreground))"
                            }
                          },
                          labels: {
                            style: {
                              color: "hsl(var(--foreground))"
                            }
                          },
                          lineColor: "hsl(var(--border))",
                          tickColor: "hsl(var(--border))"
                        },
                        tooltip: {
                          shared: false,
                          pointFormat:
                            "<b>{point.category}</b><br/>{series.name}: {point.y}<br/>Total: {point.stackTotal}",
                          style: {
                            color: "hsl(var(--foreground))"
                          },
                          backgroundColor: "hsl(var(--background))",
                          borderColor: "hsl(var(--border))"
                        },
                        plotOptions: {
                          series: {
                            stickyTracking: false
                          },
                          column: {
                            stacking: "normal",
                            states: {
                              hover: {
                                enabled: true
                              },
                              inactive: {
                                opacity: 0.3
                              }
                            }
                          }
                        },
                        series: [
                          {
                            type: "column",
                            name: "Task Done",
                            data: monthlyTasksData?.map((item: any) => item.done) || [],
                            stack: "Tasks"
                          },
                          {
                            type: "column",
                            name: "Task Pending",
                            data: monthlyTasksData?.map((item: any) => item.pending) || [],
                            stack: "Tasks"
                          }
                        ]
                      }
                      }
                    />
                  </div>
                </div>

                {/* Browser Pie Chart */}
                <div className="stat-card">
                  <h3 className="font-semibold mb-4">
                    {selectedEmployee ? `${selectedEmployee.name} - Monthly Attendance` : 'All Employees - Monthly Attendance'}
                  </h3>
                  <BrowserPieChart />
                </div>
              </div>

              {/* Page Break */}
              <div className="page-break"></div>

              {/* quarterly Task Progress */}
              <div className="stat-card mt-8">
                <h3 className="font-semibold mb-4">
                  {selectedEmployee ? `${selectedEmployee.name} - Quarterly Tasks` : 'All Employees - Quarterly Tasks'}
                </h3>
                <div className="w-full max-w-6xl mx-auto">
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={{
                      chart: {
                        type: "column",
                        backgroundColor: "transparent",
                      },
                      colors: ["#3732a7ff", "#2DAFFE"],
                      title: {
                        text: selectedEmployee ? `${selectedEmployee.name} - Quarterly Tasks Overview` : "Quarterly Tasks Overview",
                        align: "center",
                        style: {
                          color: "hsl(var(--foreground))"
                        }
                      },
                      xAxis: {
                        categories: QuarterlyTasksData?.map((item: any) => item.quarter) || [],
                        labels: {
                          style: {
                            color: "hsl(var(--foreground))"
                          }
                        },
                        lineColor: "hsl(var(--border))",
                        tickColor: "hsl(var(--border))"
                      },
                      yAxis: {
                        allowDecimals: false,
                        min: 0,
                        title: {
                          text: "Count Tasks",
                          style: {
                            color: "hsl(var(--foreground))"
                          }
                        },
                        labels: {
                          style: {
                            color: "hsl(var(--foreground))"
                          }
                        },
                        lineColor: "hsl(var(--border))",
                        tickColor: "hsl(var(--border))"
                      },
                      tooltip: {
                        shared: false,
                        pointFormat:
                          "<b>{point.category}</b><br/>{series.name}: {point.y}<br/>Total: {point.stackTotal}",
                        style: {
                          color: "hsl(var(--foreground))"
                        },
                        backgroundColor: "hsl(var(--background))",
                        borderColor: "hsl(var(--border))"
                      },
                      plotOptions: {
                        series: {
                          stickyTracking: false
                        },
                        column: {
                          stacking: "normal",
                          states: {
                            hover: {
                              enabled: true
                            },
                            inactive: {
                              opacity: 0.3
                            }
                          }
                        }
                      },
                      series: [
                        {
                          type: "column",
                          name: "Task Done",
                          data: QuarterlyTasksData?.map((item: any) => item.done) || [],
                          stack: "Tasks"
                        },
                        {
                          type: "column",
                          name: "Task Pending",
                          data: QuarterlyTasksData?.map((item: any) => item.pending) || [],
                          stack: "Tasks"
                        }
                      ]
                    }
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          {/* PDF Only Content - Hidden from UI */}
          <div ref={targetRef} style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
            {/* PDF Title */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-center" style={{ color: 'black' }}>
                Reports & Analytics {selectedEmployee && `- ${selectedEmployee.name}`}
              </h1>
              <p className="text-center text-sm mt-2" style={{ color: 'black' }}>
                Monthly attendance and work progress overview {selectedEmployee && `for ${selectedEmployee.name}`}
              </p>
            </div>

            {/* Charts */}
            <div className="space-y-6 mt-8">
              {/* Monthly Tasks Chart */}
              <div className="stat-card">
                <h3 className="font-semibold mb-4" style={{ color: 'white' }}>
                  {selectedEmployee ? `${selectedEmployee.name} - Monthly Tasks` : 'All Employees - Monthly Tasks'}
                </h3>
                <div className="w-full max-w-6xl mx-auto">
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={{
                      chart: {
                        type: "column",
                        backgroundColor: "transparent",
                        height: 350,
                      },
                      colors: ["#3732a7ff", "#2DAFFE"],
                      title: {
                        text: selectedEmployee ? `${selectedEmployee.name} - Monthly Tasks Overview` : "Monthly Tasks Overview",
                        align: "center",
                        style: {
                          color: 'white',
                          fontSize: '16px'
                        }
                      },
                      xAxis: {
                        categories: monthlyTasksData?.map((item: any) => item.month) || [],
                        labels: {
                          style: {
                            color: 'white'
                          }
                        },
                        lineColor: "hsl(var(--border))",
                        tickColor: "hsl(var(--border))"
                      },
                      yAxis: {
                        allowDecimals: false,
                        min: 0,
                        title: {
                          text: "Count Tasks",
                          style: {
                            color: 'white'
                          }
                        },
                        labels: {
                          style: {
                            color: 'white'
                          }
                        },
                        lineColor: "hsl(var(--border))",
                        tickColor: "hsl(var(--border))"
                      },
                      tooltip: {
                        shared: false,
                        pointFormat:
                          "<b>{point.category}</b><br/>{series.name}: {point.y}<br/>Total: {point.stackTotal}",
                        style: {
                          color: 'white'
                        },
                        backgroundColor: "hsl(var(--background))",
                        borderColor: "hsl(var(--border))"
                      },
                      plotOptions: {
                        series: {
                          stickyTracking: false
                        },
                        column: {
                          stacking: "normal",
                          states: {
                            hover: {
                              enabled: true
                            },
                            inactive: {
                              opacity: 0.3
                            }
                          }
                        }
                      },
                      series: [
                        {
                          type: "column",
                          name: "Task Done",
                          data: monthlyTasksData?.map((item: any) => item.done) || [],
                          stack: "Tasks"
                        },
                        {
                          type: "column",
                          name: "Task Pending",
                          data: monthlyTasksData?.map((item: any) => item.pending) || [],
                          stack: "Tasks"
                        }
                      ]
                    }}
                  />
                </div>
                <div></div>
              </div>

              {/* Quarterly Tasks Chart */}
              <div className="stat-card">
                <h3 className="font-semibold mb-4">
                  {selectedEmployee ? `${selectedEmployee.name} - Quarterly Tasks` : 'All Employees - Quarterly Tasks'}
                </h3>
                <div className="w-full max-w-6xl mx-auto">
                  <HighchartsReact
                    highcharts={Highcharts}
                    options={{
                      chart: {
                        type: "column",
                        backgroundColor: "transparent",
                        height: 350,
                      },
                      colors: ["#3732a7ff", "#2DAFFE"],
                      title: {
                        text: selectedEmployee ? `${selectedEmployee.name} - Quarterly Tasks Overview` : "Quarterly Tasks Overview",
                        align: "center",
                        style: {
                          color: 'white',
                          fontSize: '16px'
                        }
                      },
                      xAxis: {
                        categories: QuarterlyTasksData?.map((item: any) => item.quarter) || [],
                        labels: {
                          style: {
                            color: 'white'
                          }
                        },
                        lineColor: "hsl(var(--border))",
                        tickColor: "hsl(var(--border))"
                      },
                      yAxis: {
                        allowDecimals: false,
                        min: 0,
                        title: {
                          text: "Count Tasks",
                          style: {
                            color: 'white'
                          }
                        },
                        labels: {
                          style: {
                            color: 'white'
                          }
                        },
                        lineColor: "hsl(var(--border))",
                        tickColor: "hsl(var(--border))"
                      },
                      tooltip: {
                        shared: false,
                        pointFormat:
                          "<b>{point.category}</b><br/>{series.name}: {point.y}<br/>Total: {point.stackTotal}",
                        style: {
                          color: "white"
                        },
                        backgroundColor: "hsl(var(--background))",
                        borderColor: "hsl(var(--border))"
                      },
                      plotOptions: {
                        series: {
                          stickyTracking: false
                        },
                        column: {
                          stacking: "normal",
                          states: {
                            hover: {
                              enabled: true
                            },
                            inactive: {
                              opacity: 0.3
                            }
                          }
                        }
                      },
                      series: [
                        {
                          type: "column",
                          name: "Task Done",
                          data: QuarterlyTasksData?.map((item: any) => item.done) || [],
                          stack: "Tasks"
                        },
                        {
                          type: "column",
                          name: "Task Pending",
                          data: QuarterlyTasksData?.map((item: any) => item.pending) || [],
                          stack: "Tasks"
                        }
                      ]
                    }}
                  />
                </div>
                <div></div>
              </div>

              {/* Browser Pie Chart */}
              <div className="stat-card">
                <h3 className="font-semibold mb-4">
                  {selectedEmployee ? `${selectedEmployee.name} - Monthly Attendance` : 'All Employees - Monthly Attendance'}
                </h3>
                <BrowserPieChart />
              </div>
              <div></div>
            </div>

            {/* Monthly Tasks Data Table - PDF Only */}
            <div className="mt-10">
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'black' }}>
                Monthly Tasks Data
              </h2>

              <table className="w-full border border-gray-300 text-sm" style={{ color: 'black' }}>
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-3 py-2" style={{ color: 'black', blockSize: '40px' }}>Month</th>
                    <th className="border px-3 py-2" style={{ color: 'black', blockSize: '40px' }}>Total Tasks Done</th>
                    <th className="border px-3 py-2" style={{ color: 'black', blockSize: '40px' }}>Total Tasks Pending</th>
                    <th className="border px-3 py-2" style={{ color: 'black', blockSize: '40px' }}>Total Tasks Assigned</th>
                  </tr>
                </thead>

                <tbody>
                  {monthlyTasksData.map((item: any, index: number) => (
                    <tr key={index}>
                      <td className="border px-3 py-2" style={{ color: 'black' }}>{item.month}</td>
                      <td className="border px-3 py-2">{item.done}</td>
                      <td className="border px-3 py-2">{item.pending}</td>
                      <td className="border px-3 py-2">{item.done + item.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Attendance Data Table - PDF Only */}
            <div className="mt-10">
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'black' }}>
                Attendance Summary
              </h2>

              <table className="w-full border border-gray-300 text-sm" style={{ color: 'black' }}>
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-3 py-2" style={{ color: 'black', blockSize: '40px' }}>Status</th>
                    <th className="border px-3 py-2" style={{ color: 'black', blockSize: '40px' }}>Count</th>
                    <th className="border px-3 py-2" style={{ color: 'black', blockSize: '40px' }}>Percentage</th>
                  </tr>
                </thead>

                <tbody>
                  {(() => {
                    const stats = Array.isArray(attendanceData) ? attendanceData.reduce((acc: any, record: any) => {
                      if (record.present === true || record.status === 'on_time') acc.present++;
                      else if (record.status === 'absent') acc.absent++;
                      else if (record.status === 'late') acc.late++;
                      else if (record.status === 'half_day') acc.leave++;
                      if (record.work_type === 'wfh') acc.wfh++;
                      return acc;
                    }, { present: 0, absent: 0, late: 0, wfh: 0, leave: 0 }) : { present: 0, absent: 0, late: 0, wfh: 0, leave: 0 };

                    const total = stats.present + stats.absent + stats.late + stats.wfh + stats.leave;

                    return [
                      { status: 'Present', count: stats.present, percentage: total > 0 ? Math.round(stats.present / total * 100) : 0 },
                      { status: 'Absent', count: stats.absent, percentage: total > 0 ? Math.round(stats.absent / total * 100) : 0 },
                      { status: 'Late', count: stats.late, percentage: total > 0 ? Math.round(stats.late / total * 100) : 0 },
                      { status: 'WFH', count: stats.wfh, percentage: total > 0 ? Math.round(stats.wfh / total * 100) : 0 },
                      { status: 'Leave', count: stats.leave, percentage: total > 0 ? Math.round(stats.leave / total * 100) : 0 }
                    ].map((item, index) => (
                      <tr key={index}>
                        <td className="border px-3 py-2" style={{ color: 'black', blockSize: '40px' }}>{item.status}</td>
                        <td className="border px-3 py-2" style={{ color: 'black', blockSize: '40px' }}>{item.count}</td>
                        <td className="border px-3 py-2" style={{ color: 'black', blockSize: '40px' }}>{item.percentage}%</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>

            {/* Quarterly Tasks Data Table - PDF Only */}
            <div className="mt-10">
              <h2 className="text-xl font-semibold mb-4" style={{ color: 'black' }}>
                Quarterly Tasks Data
              </h2>

              <table className="w-full border border-gray-300 text-sm" style={{ color: 'black' }}>
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border px-3 py-2" style={{ color: 'black', blockSize: '40px' }}>Quarter</th>
                    <th className="border px-3 py-2" style={{ color: 'black', blockSize: '40px' }}>Total Tasks Done</th>
                    <th className="border px-3 py-2" style={{ color: 'black', blockSize: '40px' }}>Total Tasks Pending</th>
                  </tr>
                </thead>

                <tbody>
                  {QuarterlyTasksData?.map((item: any, index: number) => (
                    <tr key={index}>
                      <td className="border px-3 py-2" style={{ color: 'black', blockSize: '40px' }}>{item.quarter}</td>
                      <td className="border px-3 py-2" style={{ color: 'black', blockSize: '40px' }}>{item.done}</td>
                      <td className="border px-3 py-2" style={{ color: 'black', blockSize: '40px' }}>{item.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </>)
}