<script setup>
import { onMounted, ref } from "vue";

import PanelCard from "@/components/PanelCard.vue";
import { userService } from "@/services/userService";
import { formatRole } from "@/utils/formatRole";

const loading = ref(true);
const users = ref([]);

async function loadUsers() {
  loading.value = true;

  try {
    users.value = await userService.list();
  } finally {
    loading.value = false;
  }
}

onMounted(loadUsers);
</script>

<template>
  <div class="page-grid">
    <PanelCard
      title="Operational User Directory"
      description="Active operational accounts and the departments they cover."
    >
      <div v-if="loading" class="empty-inline">Loading users...</div>
      <div v-else class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td>{{ user.name }}</td>
              <td>{{ user.email }}</td>
              <td>{{ formatRole(user.role) }}</td>
              <td>{{ user.department }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </PanelCard>
  </div>
</template>
