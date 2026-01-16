# 🔒 Bare Minimum Security Fixes Plan

**Goal:** Make the app reasonably secure for an internal tool with minimal effort.
**Total Time Estimate:** 2-3 hours
**Risk Reduction:** Critical → Acceptable

---

## ✅ Fix #1: Implement Firestore Security Rules (CRITICAL)

**Why:** Without this, anyone with Firebase credentials can read/write ALL data, bypassing your UI entirely.

**Time:** 1-2 hours (including testing)

**Steps:**

1. Create `my-app/firestore.rules` file with role-based access control
2. Update `firebase.json` to reference the rules file
3. Deploy rules to Firebase
4. Test that rules work correctly

**Files to create/modify:**
- `my-app/firestore.rules` (NEW)
- `my-app/firebase.json` (MODIFY)

---

## ✅ Fix #2: Add Server-Side Authorization to deleteUserAccount (CRITICAL)

**Why:** Currently ANY authenticated user can delete ANY user account, including admins.

**Time:** 30 minutes

**Steps:**

1. Add role verification in `deleteUserAccount` Cloud Function
2. Test that only Admin/Manager can delete users
3. Verify Driver/ClientIntake users get permission denied

**Files to modify:**
- `my-app/functions-python/main.py` (lines 51-53)

---

## ✅ Fix #3: Restrict CORS on Geocoding Endpoint (HIGH)

**Why:** Open CORS allows anyone to abuse your Google Maps API quota, causing unexpected costs.

**Time:** 15 minutes

**Steps:**

1. Replace wildcard CORS with specific origins
2. Redeploy Cloud Functions
3. Test geocoding still works from your app

**Files to modify:**
- `my-app/functions-python/clustering.py` (line 78)

---

## 📋 Implementation Order

Do these in sequence:

1. **First:** Firestore rules (biggest impact)
2. **Second:** deleteUserAccount authorization (prevents privilege escalation)
3. **Third:** CORS fix (prevents API abuse)

---

## 🚀 Quick Win: Deploy All 3 Fixes Together

After implementing all changes locally:

```bash
# Deploy everything at once
cd my-app
firebase deploy --only firestore:rules,functions
```

---

## ✅ Validation Checklist

After deploying, verify:

- [ ] Driver/ClientIntake users CANNOT delete users (should see permission error)
- [ ] Admin/Manager users CAN delete users (should work)
- [ ] Client data read/write works from UI
- [ ] Geocoding works from your app
- [ ] Geocoding fails from external domains (test with curl)

---

## 🎯 Result

After these 3 fixes:
- ✅ Database is protected from unauthorized direct access
- ✅ User deletion requires proper authorization
- ✅ API quota is protected from external abuse
- ✅ App moves from "Critical Risk" to "Acceptable Risk" for an internal tool

**Skip everything else for now.** These 3 fixes address the most severe vulnerabilities.
