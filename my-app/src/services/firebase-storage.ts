import { getStorage, ref, getDownloadURL, connectStorageEmulator } from "firebase/storage";
import { app, useEmulators } from "../auth/firebaseConfig";

export const storage = getStorage(app);

if (useEmulators) {
  connectStorageEmulator(storage, "localhost", 9199);
}

export async function getProfileFieldsConfigUrl() {
  const fileRef = ref(storage, "profile-fields.json");
  return await getDownloadURL(fileRef);
}
