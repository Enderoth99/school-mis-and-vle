// Catalogue transcribed from the user's Reporting.pdf (49 reports). Source format labels are retained;
// available demo output formats are shown separately in the report runner.
const categories=[
 ['Attendance',[
  ['Excessive Lateness - Class Attendance or School Attendance (Excel) by Teacher','late-threshold','List pupils whose saved late marks reach a chosen threshold.']]],
 ['Class Attendance',[
  ['Absences by Class - Daily (Excel, PDF)','class-absence-daily','Absent pupils in selected classes on a chosen day.'],
  ['Absences by Class - Monthly (Excel, PDF)','class-absence-monthly','Saved class absence marks during a selected month.'],
  ['Attendance by Teacher (Excel)','attendance-teacher','Attendance totals for the selected teacher’s classes over a date range.'],
  ['Class Attendance - Not Taken (Excel)','attendance-not-taken','Scheduled registers with unrecorded pupils, including registers never saved.'],
  ['Class Attendance Summary by Code - Date Range (Excel)','attendance-codes','Counts of each saved attendance code, grouped by class.'],
  ['Class Attendance Totals - Class (CSV, Excel)','attendance-class','Attendance totals for each class in the chosen date range.'],
  ['Student Class Attendance Totals - Class (CSV, Excel)','attendance-student','Attendance totals by student and teaching class.']]],
 ['Gradebook',[
  ['Current Yearly Average (Excel)','average-year','Current assessment averages by student and class.'],
  ['Grade Summary - Class (Zip)','grade-class','Saved assessment results and class averages for selected classes.'],
  ['Grade Summary - Grade Level (PDF)','grade-year','Assessment results for pupils in a selected year.'],
  ['Grade Summary - SBG (Zip)','standards','Standards-based grades for selected classes.'],
  ['Grade Summary - Student (PDF)','grade-student','A pupil’s results across their subjects alongside class averages.'],
  ['Gradebook View Export (Excel)','gradebook','A class gradebook with marks, maximum scores and percentages.'],
  ['List of Assignments (PDF)','assignments','Saved assessments and lesson assignments, including due dates and available marks.'],
  ['List of Assignments - SBG (PDF)','standards','Standards-based assignments for selected pupils.'],
  ['Progress Report - Standards Based (Excel)','standards','Progress against configured school standards.'],
  ['Standards Gradebook Export (Excel)','standards','Recorded standards-based marks by pupil and class.'],
  ['Standards-based Final Grade Report','standards','Published final grades against school standards.'],
  ['Student Assignments - Grades (Excel)','grade-detail','Student marks, maximum scores, percentages and missed assessments.'],
  ['Student Final Grades (Excel)','final-grades','Report grades and current assessment averages, clearly distinguished.'],
  ['Student Missing Assignments (CSV, Excel, PDF)','missing','Assessments marked missed or still awaiting a pupil’s mark.'],
  ['Student Missing Assignments by Grade Level (CSV, Excel, PDF)','missing-year','Missing assessment results grouped by year.'],
  ['Traditional Gradebook Assignments - Teacher (CSV)','grade-teacher','Saved pupil assessment results for the selected teacher’s classes.'],
  ['Traditional Gradebook Calculated, Published Grades, and Reported Grades (Excel)','published-grades','Compare calculated assessment averages with saved report grades.']]],
 ['Other',[
  ['Class Curriculum Export (CSV, PDF)','curriculum','Saved lesson plans, dates, objectives and completion.']]],
 ['Report Cards',[
  ['Final Average (Excel)','final-average','Current averages and saved report attainment; final examination weighting is not configured.'],
  ['Progress Report (PDF)','progress','Saved attainment, effort and comments for each pupil and subject.'],
  ['Report Card/Progress Reports Comments (CSV, Excel)','comments','Subject and homeroom comments entered by staff.']]],
 ['Schedule',[
  ['Teacher Schedule (PDF)','schedule','The active weekly lesson allocation, rooms and pupil counts for selected teachers.']]],
 ['School Attendance',[
  ['Emergency Drills Roster - Grade Level (CSV, Excel)','emergency','Pupils by year with their saved registration status on a chosen day.'],
  ['STUDENT SCHOOL ATTENDANCE - ABSENT/TARDY (Excel)','school-absence-late','Saved registration absence and lateness during a chosen date range.'],
  ['Student Absentee Report (Excel)','school-absent','Pupils recorded absent in school registration on the selected day.']]],
 ['Standards & Proficiencies',[
  ['Proficiencies Export (Excel)','proficiencies','Configured school proficiency records for the selected pupils.']]],
 ['Student Information',[
  ['Class Roster - Class (CSV, Excel)','roster','Pupils enrolled in the selected teaching classes.'],
  ['Class Roster - Teacher (PDF - alternate format)','roster-teacher-alternate','A compact roster grouped by the selected teacher’s classes.'],
  ['Class Roster - Teacher (PDF)','roster-teacher','Class rosters for the selected teacher.'],
  ['Class Roster Student Info (Excel)','roster-info','Class rosters with pupil information and linked contacts.'],
  ['Emergency Contact Email List - Class (CSV, Excel)','contact-email','Linked emergency contacts and email addresses for selected pupils.'],
  ['Emergency Contact Phone List - Class (CSV, Excel)','contact-phone','Linked emergency contacts and telephone numbers for selected pupils.'],
  ['Mailing Labels - Avery 5160 (PDF)','mail-labels','Household names and addresses for mailing labels.'],
  ['Mailing Labels - Envelope (#10)','envelopes','Household address blocks for envelopes.'],
  ['Student Birthdays (Excel)','birthdays','Pupils with birthdays in the selected calendar date range.'],
  ['Student Name Labels - Avery 5160 (PDF)','name-labels','Student names, years and classes for labels.'],
  ['Student Parent/Emergency Contacts (Excel)','contacts','Pupils and their linked parents and emergency contacts.'],
  ['Student Pick Up List (Excel, CSV)','pickup','Linked contacts with recorded permission to collect a pupil.'],
  ['Students grade levels','student-years','One record per pupil with year and form group.'],
  ['Trip Roster/Emergency Roster (PDF)','trip','A trip roster with pupil details and emergency contact information.']]],
 ['User Information',[
  ['User Last Login Report (CSV, Excel)','users','Actual recorded account sign-in times; blank means no login is recorded in this session.']]],
];
export const REPORT_CATEGORIES=categories.map(([name])=>name);
export const LIBRARY_REPORTS=categories.flatMap(([category,rows])=>rows.map(([title,kind,description],i)=>({id:category.toLowerCase().replace(/[^a-z]+/g,'-')+'-'+(i+1),category,title,kind,description,visibility:'All staff'})));
export function findLibraryReports(query='',category=''){
 const q=query.trim().toLowerCase();return LIBRARY_REPORTS.filter(r=>(!category||r.category===category)&&(!q||(r.title+' '+r.description+' '+r.category).toLowerCase().includes(q)));
}
