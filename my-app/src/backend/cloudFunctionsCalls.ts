import { getFunctions, httpsCallable } from "firebase/functions";

export function createAdminUser(userId: string, email: string, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const functions = getFunctions();
    const createAdminCloudFunction = httpsCallable(
      functions,
      "createAdminUser",
    );

    createAdminCloudFunction({
      userId: userId,
      email: email,
      name: name,
      userType: "Admin",
    })
      .then(async () => {
        resolve();
      })
      .catch((error) => {
        console.log(error.message);
        reject(error);
      });
  });
}

export function createManagerUser(userId: string, email: string, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const functions = getFunctions();
    const createManagerCloudFunction = httpsCallable(
      functions,
      "createManagerUser",
    );

    createManagerCloudFunction({
      userId: userId,
      email: email,
      name: name,
      userType: "Manager",
    })
      .then(async () => {
        resolve();
      })
      .catch((error) => {
        console.log(error.message);
        reject(error);
      });
  });
}

export function createClientIntakeUser(userId: string, email: string, name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const functions = getFunctions();
    const createClientIntakeCloudFunction = httpsCallable(
      functions,
      "createClientIntakeUser",
    );

    createClientIntakeCloudFunction({
      userId: userId,
      email: email,
      name: name,
      userType: "ClientIntake",
    })
      .then(async () => {
        resolve();
      })
      .catch((error) => {
        console.log(error.message);
        reject(error);
      });
  });
}
