export const collegeConfig = {
  name: "Rajalakshmi Engineering College",
  domain: "rajalakshmi.edu.in",
  allowedDomains: ["rajalakshmi.edu.in", "rajlakshmi.edu.in"],
  patterns: {
    // Student: name.initial.year.dept@rajalakshmi.edu.in (e.g., karthik.s.23.cse@rajalakshmi.edu.in)
    student: /^[a-z0-9]+(?:\.[a-z0-9]+)*\.\d{2}\.[a-z0-9]+@(rajalakshmi|rajlakshmi)\.edu\.in$/i,
    // Staff: staffname@rajalakshmi.edu.in or name.initial.dept@rajalakshmi.edu.in
    staff: /^[a-z0-9]+(?:\.[a-z0-9]+)*(?<!\.\d{2})@(rajalakshmi|rajlakshmi)\.edu\.in$/i,
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
