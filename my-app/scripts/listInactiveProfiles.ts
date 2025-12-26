import { clientService } from "../src/services/client-service";

async function listInactiveProfiles() {
  try {
    const result = await clientService.getAllClients();
    const clients = result.clients;
    const inactive = clients.filter(
      (c) => !Array.isArray(c.tags) || !c.tags.includes("active")
    );
    if (inactive.length === 0) {
      console.log("All profiles have the 'active' tag.");
      return;
    }
    console.log("Profiles without 'active' tag:");
    inactive.forEach((c) => {
      console.log(`Name: ${c.firstName} ${c.lastName} | ID: ${c.uid}`);
    });
    console.log(`\nTotal without 'active' tag: ${inactive.length}`);
  } catch (err) {
    console.error("Error fetching clients:", err);
  }
}

listInactiveProfiles();
