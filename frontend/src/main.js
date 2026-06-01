import { createApp } from "vue";

import App from "./App.vue";
import router from "./router";
import { pinia } from "./stores/pinia";
import { useSessionStore } from "./stores/session";
import "./assets/styles.css";

async function bootstrap() {
  const app = createApp(App);

  app.use(pinia);

  const sessionStore = useSessionStore(pinia);
  await sessionStore.initializeSession();

  app.use(router);
  app.mount("#app");
}

bootstrap().catch((error) => {
  console.error("Failed to initialize frontend session", error);
});
