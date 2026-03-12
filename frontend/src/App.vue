<template>
  <div class="app-container">
    <aside class="sidebar" v-if="auth.isAuthenticated">
      <div class="sidebar-header">
        <h1>Sistem RKM</h1>
        <div class="mt-2 text-sm text-gray-500">
          User : <span class="badge badge-success">{{ auth.user?.userid }}</span>
        </div>
      </div>
      <nav class="nav-links">
        <div class="nav-item">
          <router-link to="/" class="nav-link">🏠 Beranda</router-link>
        </div>

        <!-- Tautan Manajemen -->
        <template v-if="['ADMIN', 'SUPERVISOR'].includes(auth.role)">
          <div class="nav-item">
            <router-link to="/zoning" class="nav-link">🗺️ Rute RKM</router-link>
          </div>
          <div class="nav-item">
            <router-link to="/zones" class="nav-link">📋 Daftar Rute RKM</router-link>
          </div>
        </template>

        <!-- Tautan Salesman -->
        <template v-if="auth.role === 'SALESMAN' && !auth.isFirstLogin">
          <div class="nav-item">
            <router-link to="/route" class="nav-link">📍 Rute Kunjungan Hari Ini</router-link>
          </div>
          <div class="nav-item">
            <router-link to="/zones" class="nav-link">📋 Zona Saya</router-link>
          </div>
          <div class="nav-item">
            <router-link to="/change-password" class="nav-link">🔑 Ganti Kata Sandi</router-link>
          </div>
        </template>

        <!-- Tautan Admin -->
        <template v-if="auth.role === 'ADMIN'">
          <div class="nav-item">
            <router-link to="/reset" class="nav-link text-red-500 hover:text-red-700 font-bold">⚠️ Reset Sistem</router-link>
          </div>
        </template>

      </nav>
      
      <div style="margin-top: auto; padding: 20px;">
        <button @click="logout" class="btn btn-outline" style="width: 100%;">🔒 Keluar</button>
      </div>
    </aside>

    <main class="main-content">
      <router-view class="animate-fade-in" />
    </main>
  </div>
</template>

<script setup>
import { useAuthStore } from './stores/auth'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()

const logout = () => {
  auth.logout()
  router.push('/')
}
</script>

<style>
/* Global Leaflet Map Overrides to fit layout neatly */
.leaflet-container {
  border-radius: var(--pk-radius-md);
  box-shadow: var(--pk-shadow-sm);
  z-index: 1; /* prevent overriding navbar logic */
}
</style>
