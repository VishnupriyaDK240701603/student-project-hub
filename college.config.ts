export const collegeConfig = {
  name: "Rajalakshmi Engineering College",
  domain: "rajlakshmi.edu.in",
  patterns: {
    // Student: name.initial.year.dept@rajlakshmi.edu.in (4 dot-separated segments before domain)
    student: /^[a-z0-9]+\.[a-z0-9]+\.\d{2}\.[a-z0-9]+@rajlakshmi\.edu\.in$/i,
    // Staff: name.initial.dept@rajlakshmi.edu.in (3 dot-separated segments before domain)
    staff: /^[a-z0-9]+\.[a-z0-9]+\.[a-z0-9]+@rajlakshmi\.edu\.in$/i,
  },
  departments: {
    cse: "Computer Science and Engineering",
    it: "Information Technology",
    aids: "Artificial Intelligence and Data Science",
    ece: "Electronics and Communication Engineering",
    eee: "Electrical and Electronics Engineering",
    mech: "Mechanical Engineering",
    bme: "Biomedical Engineering",
    biotech: "Biotechnology",
    civil: "Civil Engineering",
    csbs: "Computer Science and Business Systems",
  } as Record<string, string>,
  courseYears: 4,
  graduationMonthDay: "06-30",
  academicYearStartMonth: 6,
};
