# 🚀 Deploy Security Fixes - Quick Guide

## ✅ What Was Fixed

1. **Firestore Security Rules** - Database now enforces role-based access control
2. **Server-Side Authorization** - Only Admin/Manager can delete users
3. **CORS Restrictions** - API endpoints only accept requests from your domains

---

## 📦 Files Changed

```
✅ NEW:  my-app/firestore.rules
✅ MOD:  my-app/firebase.json
✅ MOD:  my-app/functions-python/main.py
✅ MOD:  my-app/functions-python/clustering.py
```

---

## 🚀 Deploy to Firebase (5 minutes)

### Step 1: Review Changes (Optional but Recommended)

```bash
cd /home/user/food-for-all-dc/my-app

# Review the Firestore rules
cat firestore.rules

# Review the Cloud Functions changes
git diff functions-python/
```

### Step 2: Deploy Everything

```bash
# Deploy Firestore rules AND Cloud Functions together
firebase deploy --only firestore:rules,functions

# Or deploy separately:
# firebase deploy --only firestore:rules
# firebase deploy --only functions
```

**Expected Output:**
```
✔  Deploy complete!

Project Console: https://console.firebase.google.com/project/food-for-all-dc-caf23/overview
```

---

## ✅ Test That It Works

### Test 1: Firestore Rules (Quick Check in Console)

1. Go to [Firebase Console](https://console.firebase.google.com/project/food-for-all-dc-caf23/firestore/rules)
2. Verify rules are deployed (should see your new rules with `getUserRole()` function)
3. Click "Rules Playground" tab
4. Test a query to verify it works

### Test 2: User Deletion Authorization

**As Admin/Manager (Should Work):**
1. Log in as an Admin or Manager user
2. Go to Users page
3. Try to delete a test user → Should succeed ✅

**As Driver/ClientIntake (Should Fail):**
1. Log in as a Driver or ClientIntake user
2. Open browser DevTools → Console tab
3. Try calling the function directly:
```javascript
const functions = firebase.functions();
const deleteUser = functions.httpsCallable('deleteUserAccount');
deleteUser({ uid: 'some-user-id' })
  .then(() => console.log('Deleted')) // Should NOT reach here
  .catch(err => console.error('Expected error:', err)); // Should see "Only Admin and Manager roles can delete users"
```

Expected error: **"Only Admin and Manager roles can delete users."** ✅

### Test 3: CORS Protection (Optional)

Test that external domains can't use your API:

```bash
# This should fail with 403 Forbidden
curl -X POST https://us-central1-food-for-all-dc-caf23.cloudfunctions.net/geocode_fn \
  -H "Content-Type: application/json" \
  -H "Origin: https://evil-site.com" \
  -d '{"addresses": ["123 Main St, Washington DC"]}'

# Expected: {"error": "Origin not allowed"}
```

Your app should still work normally from:
- http://localhost:3000
- https://food-for-all-dc-caf23.web.app
- https://food-for-all-dc-caf23.firebaseapp.com

---

## 🐛 Troubleshooting

### Issue: "Permission denied" errors for all users

**Cause:** Firestore rules are too restrictive or role check is failing

**Fix:**
1. Check that users have `role` field in Firestore `users` collection
2. Verify role values are exactly: `"Admin"`, `"Manager"`, `"Client Intake"` (case-sensitive!)
3. Check Firebase Console → Firestore → Rules → Simulator for detailed errors

### Issue: Cloud Functions deploy fails

**Cause:** Python dependencies or syntax errors

**Fix:**
```bash
cd my-app/functions-python

# Check Python syntax
python3 -m py_compile main.py
python3 -m py_compile clustering.py

# Reinstall dependencies
pip install -r requirements.txt

# Try deploying again
firebase deploy --only functions
```

### Issue: CORS errors in browser console

**Cause:** Origin not whitelisted or preflight failing

**Fix:**
1. Check that your app domain is in `ALLOWED_ORIGINS` list in `clustering.py`
2. Add any missing domains
3. Redeploy: `firebase deploy --only functions`

---

## 📊 Security Impact

### Before:
- ❌ Any authenticated user could read/write ALL database data
- ❌ Any authenticated user could delete any account (including admins)
- ❌ Anyone on the internet could use your Google Maps API

### After:
- ✅ Database enforces role-based permissions
- ✅ Only Admin/Manager can delete users
- ✅ API only accepts requests from your app domains

**Risk Reduction: Critical → Acceptable** 🎉

---

## 🔄 Rollback (If Needed)

If something breaks after deployment:

```bash
# Revert Firestore rules
firebase deploy --only firestore:rules

# Or deploy previous version from Git
git checkout HEAD~1 my-app/firestore.rules
firebase deploy --only firestore:rules
```

For Cloud Functions, Firebase keeps previous versions:
1. Go to [Cloud Functions Console](https://console.cloud.google.com/functions/list)
2. Click function name → "EDIT" → "PREVIOUS VERSION" dropdown
3. Select previous version and deploy

---

## ✅ Deployment Checklist

- [ ] Reviewed all changed files
- [ ] Deployed to Firebase: `firebase deploy --only firestore:rules,functions`
- [ ] Verified Firestore rules in Firebase Console
- [ ] Tested user deletion as Admin (should work)
- [ ] Tested user deletion as Driver (should fail with permission error)
- [ ] Verified app still works normally
- [ ] Checked browser console for any unexpected errors

---

## 📞 Next Steps After Deployment

1. **Monitor for issues** - Check Firebase Console → Functions → Logs for errors
2. **Update README** - Remove security items from roadmap (DONE! ✅)
3. **Consider remaining fixes** - See `SECURITY_FIXES_PLAN.md` for non-critical items

---

**Questions?** Check the comprehensive security audit report for more details.

**Time to Deploy:** ~5 minutes
**Downtime:** None (seamless deployment)
