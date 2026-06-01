import { userService } from "../services/user.service.js";

export const userController = {
  async list(_request, response) {
    const users = await userService.listUsers();
    response.json({
      items: users
    });
  }
};

