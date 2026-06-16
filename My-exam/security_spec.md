# Security Specification - EduTest CBT Portal

## Data Invariants
1. A **User** profile must match the authenticated `request.auth.uid`.
2. Only **Admins** can create or modify **Exams** and **Questions**.
3. **Students** can only read **Exams** and their own **Attempts**.
4. **Questions** are only readable if the student is currently enrolled or taking that specific exam (checked via active attempt).
5. **Attempts** are immutable once status is 'completed', except for admin corrections.
6. A student cannot have multiple 'in-progress' attempts for the same exam.
7. Correct answers in **Questions** must never be leaked to the client during an active exam (split schema or restricted read). *Refinement: Since Firestore doesn't support field-level security easily without splitting, we will ensure that `correctOptionIndex` is only returned via a "Results" check or stored in a separate collection if total secrecy is needed. For this MVP, we will protect the `questions` collection with strict read rules.*

## The "Dirty Dozen" Payloads
1. **Identity Theft**: Attempting to create a user profile for a different UID.
2. **Privilege Escalation**: A student trying to set `role: "admin"` in their profile.
3. **Ghost Exam**: A student trying to create a new Exam document.
4. **Leak Answers**: A student trying to query all questions with their `correctOptionIndex` before starting.
5. **Score Injection**: Manually updating an `Attempt` document to increase the `score`.
6. **Time Tamper**: Starting an exam with a `startedAt` time in the past.
7. **Terminal Breach**: Updating a 'completed' attempt to change answers.
8. **Orphan Attempt**: Creating an attempt for an exam that doesn't exist.
9. **Spam Questions**: An admin (compromised) trying to inject 10MB of data into a question text field.
10. **ID Poisoning**: Using a 1KB string as an `examId`.
11. **Unauthorized List**: A student trying to list all user profiles in the system.
12. **Double Dip**: Creating two "in-progress" attempts for the same exam simultaneously.

## Test Strategy
We will implement rules that handle these cases using `isValidUser`, `isValidExam`, `isValidQuestion`, and `isValidAttempt` logic.
