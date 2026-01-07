# CI/CD Setup Instructions

## Overview
The GitHub Actions workflow automatically deploys the app to Firebase when code is pushed to the `main` branch.

## Required GitHub Secrets

To enable CI/CD deployment, you must configure the following secrets in your GitHub repository settings:

### Firebase Secrets
- `FIREBASE_TOKEN` - Authentication token for Firebase CLI deployment

### React App Environment Variables
- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_PROJECT_ID`
- `REACT_APP_FIREBASE_STORAGE_BUCKET`
- `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- `REACT_APP_FIREBASE_APP_ID`
- `REACT_APP_FIREBASE_MEASUREMENT_ID`
- `REACT_APP_GOOGLE_MAPS_API_KEY`
- `REACT_APP_DC_WARD_API_KEY` (optional)

## How to Add GitHub Secrets

1. Navigate to your repository on GitHub
2. Go to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Enter the secret name and value
5. Click **Add secret**
6. Repeat for each required secret

## Getting Your Firebase Token

Run this command locally (you'll need to be logged into Firebase):

```bash
firebase login:ci
```

This will output a token that you should add as the `FIREBASE_TOKEN` secret.

## Getting Environment Variable Values

Your environment variable values are in your local `.env` file in the `my-app` directory. Copy each value to its corresponding GitHub secret.

**Important**: Never commit your `.env` file to the repository!

## Testing the Workflow

Once all secrets are configured:

1. Push a commit to the `main` branch
2. Go to the **Actions** tab in your GitHub repository
3. Watch the "Deploy to Firebase" workflow run
4. If successful, your app will be deployed to Firebase automatically

## Troubleshooting

If the workflow fails:

1. Check the workflow logs in the **Actions** tab
2. Verify all secrets are correctly named (case-sensitive!)
3. Ensure your Firebase token is valid: `firebase login:ci`
4. Make sure your local `.env` values are correct

## Workflow File Location

`.github/workflows/firebase-deploy.yml`
