<script setup>
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";

import { useSessionStore } from "@/stores/session";

const router = useRouter();
const sessionStore = useSessionStore();
const form = reactive({
  email: "",
  password: ""
});
const submitError = ref("");

async function submit() {
  submitError.value = "";

  try {
    await sessionStore.login(form);
    router.push("/dashboard");
  } catch (error) {
    submitError.value = error.response?.data?.message ?? "Unable to sign in";
  }
}
</script>

<template>
  <div class="login-shell">
    <div class="login-panel">
      <div class="login-copy">
        <span>DHL DAC 3.0</span>
        <h1>Operations access</h1>
        <p>
          Sign in to the DHL incident operations workspace to triage cases, review automation,
          and coordinate with your department.
        </p>
      </div>

      <form class="login-form" @submit.prevent="submit">
        <label>
          <span>Email</span>
          <input
            v-model="form.email"
            type="email"
            autocomplete="username"
            placeholder="you@dhl.com"
            required
          />
        </label>

        <label>
          <span>Password</span>
          <input
            v-model="form.password"
            type="password"
            autocomplete="current-password"
            placeholder="Enter your password"
            required
          />
        </label>

        <button class="primary-button" type="submit" :disabled="sessionStore.loading">
          {{ sessionStore.loading ? "Signing in..." : "Sign In" }}
        </button>

        <p v-if="submitError" class="form-error">{{ submitError }}</p>
      </form>
    </div>
  </div>
</template>
