# Python Firebase Cloud Functions

Quick description of the `functions-python` directory and how to work on it

# Setup

If you haven't installed `firebase-tools`, do so with the following command

```bash
npm install -g firebase-tools
```

Then sign in to firebase using the following command

```bash
firebase login
```

Then, in the `functions-python` directory, create a virtual environment with the following commands

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Now, we can run the firebase emulator in order to test our functions locally

```bash
firebase emulators:start
```