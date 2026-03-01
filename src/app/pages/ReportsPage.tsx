"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';


const attendanceData = [
  { month: 'Sep', present: 20, absent: 2, leave: 1 },
  { month: 'Oct', present: 21, absent: 1, leave: 2 },
  { month: 'Nov', present: 19, absent: 3, leave: 1 },
  { month: 'Dec', present: 18, absent: 2, leave: 3 },
  { month: 'Jan', present: 20, absent: 1, leave: 2 },
  { month: 'Feb', present: 17, absent: 1, leave: 1 },
];



const taskData = [
  { week: 'W1', completed: 12, pending: 3 },
  { week: 'W2', completed: 15, pending: 2 },
  { week: 'W3', completed: 10, pending: 5 },
  { week: 'W4', completed: 18, pending: 1 },
];



const pieData = [
  { name: 'Present', value: 115, color: 'hsl(152, 60%, 40%)' },
  { name: 'WFH', value: 12, color: 'hsl(210, 80%, 52%)' },
  { name: 'Leave', value: 10, color: 'hsl(38, 92%, 50%)' },
  { name: 'Absent', value: 8, color: 'hsl(0, 84%, 60%)' },
];



const hoursData = [
  { day: 'Mon', hours: 8.5 },
  { day: 'Tue', hours: 9.0 },
  { day: 'Wed', hours: 7.5 },
  { day: 'Thu', hours: 8.8 },
  { day: 'Fri', hours: 8.0 },
];

export default function ReportsPage() {
  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Monthly attendance and work progress overview</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Bar Chart */}
        <div className="stat-card">
          <h3 className="font-semibold mb-4">Monthly Attendance</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="present" fill="hsl(152, 60%, 40%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="absent" fill="hsl(0, 84%, 60%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="leave" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Attendance Pie */}
        <div className="stat-card">
          <h3 className="font-semibold mb-4">Attendance Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Task Progress */}
        <div className="stat-card">
          <h3 className="font-semibold mb-4">Weekly Task Progress</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={taskData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="completed" fill="hsl(222, 62%, 22%)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pending" fill="hsl(32, 95%, 52%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Hours Line Chart */}
        <div className="stat-card">
          <h3 className="font-semibold mb-4">Daily Working Hours (This Week)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={hoursData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 13%, 91%)" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis domain={[6, 10]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="hours" stroke="hsl(222, 62%, 22%)" strokeWidth={2} dot={{ fill: 'hsl(32, 95%, 52%)', r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
