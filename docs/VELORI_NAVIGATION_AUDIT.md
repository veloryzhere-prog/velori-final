# VELORI Navigation & Back-Button System Audit

## 1. Original Navigation Problem
Previously, pressing the physical Android Back button or system gesture back while inside the VELORI Android app could cause the WebView container or activity to exit immediately or close the application instead of popping the current modal, dismissing a bottom sheet, returning from a chat conversation to the inbox, or stepping back through route history.

## 2. Root Cause Analysis
- Lack of a centralized hardware back button listener (`@capacitor/app` `backButton` event).
- Absence of priority-based handling for active modals, open bottom sheets, media viewers, and nested message threads.
- Unhandled popstate/history navigation state in React Router v8 transitions.

## 3. Centralized Back-Handling Architecture (Implemented)
A centralized `AndroidBackController` component has been integrated into the application shell (`ProductFrame.tsx`) utilizing `@capacitor/app` and browser history events.

### Priority Sequence:
1. **Keyboard / Focus**: Dismisses active focused inputs when appropriate.
2. **Dialogs & Modals**: Closes any open dialog (`[role="dialog"]`).
3. **Bottom Sheets & Menus**: Closes open bottom sheets and navigation drawers.
4. **Media Viewers**: Closes full-screen story viewers, reel overlays, and photo modals.
5. **Messaging**: Returns from an active conversation thread back to the inbox list.
6. **Nested Route History**: Navigates back (`navigate(-1)`) through React Router history.
7. **Application Root**: Displays an exit confirmation dialog ("Are you sure you want to exit VELORI?") with "Stay in App" and "Exit" (`App.exitApp()`) actions.

## 4. Files Modified / Created
- `src/lib/back-handler.tsx`: Centralized Android Back navigation controller.
- `src/product/ProductFrame.tsx`: Integrated `AndroidBackController` into the product frame shell.
- `docs/VELORI_NAVIGATION_AUDIT.md`: Created navigation audit report.
- `docs/VELORI_ANDROID_TEST_REPORT.md`: Updated with navigation test matrix.
