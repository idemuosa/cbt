# Secure Exam Environment: Cheating Prevention Research and Implementation Profile

Building a robust Computer-Based Testing (CBT) environment requires a multi-layered security approach. Below is the research and implementation outline for the EduTest portal.

## 1. Lockdown Browser Integration (Simulated/Web-Based)
*   **Technique**: Web-based enforcement of "Stay on Page".
*   **Implementation**:
    *   **Fullscreen Mode API**: Force the application into fullscreen. Any exit from fullscreen triggers an alert or immediate submission.
    *   **Page Visibility API**: Detect when the student switches tabs or minimizes the browser. Trigger violations or auto-submission.
    *   **Focus Loss Detection**: Monitor `window.blur` events to detect third-party applications coming into focus.

## 2. Shuffling (Randomization)
*   **Technique**: Algorithmic randomization to ensure no two students see the same sequence.
*   **Implementation**:
    *   **Question Shuffling**: Questions fetched from Firestore are shuffled on the client before display.
    *   **Option Shuffling**: The order of A, B, C, D is randomized for every question, preventing "Option A is correct" patterns.

## 3. Advanced Surveillance (Optional/Phased)
*   **AI Proctoring**: Integration with webcam feeds to detect multiple faces, unauthorized devices, or candidate absence (requires `requestFramePermissions`).
*   **IP Monitoring**: Detect if multiple sessions are active from disparate locations or the same IP (to prevent group solving).

## 4. Technical Implementation Detail
*   **Durstenfeld Shuffle**: Used for efficient O(n) randomization.
*   **Anti-Copy/Paste**: CSS `user-select: none` and disabling `contextmenu` (Right Click) to prevent question data extraction.
*   **Timed Auto-Submission**: Server-side timestamps to ensure final scores are only accepted if the session was logically valid.

---
*Prepared by EduTest Security Operations*
