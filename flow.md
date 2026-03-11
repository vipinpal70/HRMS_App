1. Approval check happens first

When an employee tries to check-in, the system first checks if there is an approved request for that date.

Possible approvals:

WFH

Hybrid

No approval

2. If WFH or Hybrid is approved

The employee is allowed to work from anywhere.

Meaning:

They can check-in from home

They can check-in from office

GPS validation for office is not enforced

But you restrict number of sessions per day.

Rule

Maximum:

2 check-ins
2 check-outs

Example hybrid day:

Action	Time	Location
check-in	06:00	home
check-out	10:00	home
check-in	14:00	office
check-out	19:00	office

Total sessions = 2

3. If there is NO approval

Then the employee must work from office only.

At check-in:

if location != office_location
    reject check-in

So:

Location	Allowed
office	yes
home	no

Employee can still have max 2 sessions, but both must be office.

Example:

Action	Time
check-in	09:30
check-out	13:00
check-in	14:00
check-out	18:30
4. Work Type Handling

When approval exists:

work_type = approval_type

Meaning:

approval	work_type
WFH	wfh
Hybrid	hybrid

If no approval:

work_type = office
5. Checkout Logic

When the employee checks out:

You calculate the session duration.

Example:

session_minutes = checkout - checkin

Then update the attendance record.

First checkout
total_minutes = session_minutes
Second checkout
total_minutes = total_minutes + session_minutes

So the final attendance row contains total working time for the day.

Example:

session	minutes
06:00–10:00	240
14:00–19:00	300

Final:

total_minutes = 540
6. Late and Overtime removed

You decided to remove these fields:

late_by
overtime_by

So the attendance system now only tracks:

check-in

check-out

total_minutes

work_type

location

7. System Rules Summary
Check-in

Check approval

If approved (WFH / Hybrid)

allow from anywhere

If not approved

allow only if inside office geofence

Limit sessions:

max 2 check-in
max 2 check-out
Check-out

Calculate session minutes

Add to total_minutes

If second checkout → final working hours calculated

8. What this system prevents

This prevents:

Abuse	Prevented
fake early WFH	yes
multiple fake check-ins	yes
location bypass without approval	yes
unlimited sessions	yes
9. One important thing still missing

Right now your system cannot differentiate hybrid sessions because your table has:

check_in
check_out

But hybrid means two sessions.

So internally you must store:

check_in_1
check_out_1
check_in_2
check_out_2

or use a sessions table.