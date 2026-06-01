import { authService } from "../services/auth.service.js";

export const authController = {
  async login(request, response) {
    const session = await authService.login(request.body);
    response.json(session);
  },

  async me(request, response) {
    const user = await authService.getCurrentUser(request.user);
    response.json({ user });
  },

  async logout(_request, response) {
    response.json({
      message: "Logout acknowledged. Client should discard the token."
    });
  }
};

