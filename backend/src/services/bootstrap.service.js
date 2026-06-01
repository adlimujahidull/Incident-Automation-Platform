import { userService } from "./user.service.js";

let bootstrapped = false;

export const bootstrapService = {
  async ensureDevelopmentDataset() {
    if (bootstrapped) {
      return;
    }

    await userService.ensureBootstrapUsers();

    bootstrapped = true;
  }
};
