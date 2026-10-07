# Visual QA & Screen Breakpoint Documentation

**Student Project Hub**
**Breakpoints Tested**:
- **Mobile Viewport**: 360px width (iPhone / Android mobile)
- **Tablet Viewport**: 768px width (iPad / portrait tablets)
- **Desktop Viewport**: 1280px+ width (Laptop / widescreen monitors)

---

## 1. Verified Key Screens & States

| Screen Route | Loading State | Empty State | Error State | Mobile (360px) | Desktop (1280px) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **`/requests` (Project Board)** | Skeleton cards | "No open requests" | Retry banner | Stacked cards | Multi-column grid |
| **`/rooms` (My Rooms)** | Pulse skeleton | "Create or join room" | Error modal | Single col | Grid with badges |
| **`/rooms/[id]` (Workspace)** | Tab skeleton | "No messages yet" | Error toast | Drawer menu | Side-by-side tabs |
| **`/inbox` (Notifications)** | List shimmer | "All caught up" | Error alert | Full width list | Compact list |
| **`/staff/moderator-console`**| Table loader | "Queue empty" | Banner alert | Card layout | Action table |
| **`/owner` (Console)** | Grid loader | "No logs recorded" | Banner alert | Stacked forms | Split dashboard |
| **`/privacy` (Policy)** | Static | Static | Static | Readable prose | Framed prose |

---

## 2. Design System & Accessibility Compliance

- **Contrast Ratio**: AA compliant (> 4.5:1 for standard text, > 3:1 for large text / badges).
- **Reduced Motion**: Respects `prefers-reduced-motion: reduce` for smooth degradation.
- **Focus Indicators**: 2px accent ring visible on all interactive elements during keyboard navigation.
- **Microcopy**: Consistent, action-oriented, and friendly language across all alerts and tooltips.
