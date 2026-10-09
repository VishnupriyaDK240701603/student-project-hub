# Multi-College Replication & Re-theming Guide

**Student Project Hub**
**Target**: Deploying this system for another university or college.

---

## 1. Core Configuration File: `college.config.ts`

To customize the platform for a different educational institution, update `college.config.ts` in the project root:

```typescript
export const collegeConfig = {
  name: "New College of Engineering",
  domain: "newcollege.edu.in",
  allowedDomains: ["newcollege.edu.in", "newcollege.ac.in"],
  patterns: {
    // Student email format
    student: /^[a-z0-9]+(?:\.[a-z0-9]+)*\.\d{2}\.[a-z0-9]+@(newcollege|newcollege\.ac)\.edu\.in$/i,
    // Staff email format
    staff: /^[a-z0-9]+(?:\.[a-z0-9]+)*(?<!\.\d{2})@(newcollege|newcollege\.ac)\.edu\.in$/i,
  },
  departments: {
    cse: "Computer Science and Engineering",
    it: "Information Technology",
    aids: "Artificial Intelligence and Data Science",
    ece: "Electronics and Communication Engineering",
    eee: "Electrical and Electronics Engineering",
    mech: "Mechanical Engineering",
    civil: "Civil Engineering",
  } as Record<string, string>,
  courseYears: 4,
  graduationMonthDay: "06-30",
  academicYearStartMonth: 6,
};
```

---

## 2. Branding & Visual Theme (`tailwind.config.ts` & `src/app/globals.css`)

1. **Brand Colors**: Update the `accent` color palette in `tailwind.config.ts` to match the institution's colors (e.g., emerald, violet, navy).
2. **Favicon and Logos**: Replace `/public/icons/` assets (`icon-192.png`, `icon-512.png`, `favicon.ico`) with the college crest.

---

## 3. Database Deployment

1. Create a new Supabase project for the institution.
2. Run `supabase/full_schema_setup.sql` in the Supabase SQL Editor.
3. Configure Google OAuth with the college domain redirect URI in the Supabase Auth settings.
