<template>
  <div class="dashboard">
    <div v-if="!auth.isAuthenticated" class="login-container">
      <div class="card glass text-center" style="max-width: 400px; margin: 100px auto;">
        <h2 class="page-title mb-2">Login Sistem</h2>
        <p class="text-sm text-gray-500 mb-6">Masukkan kredensial Anda untuk mengakses Sistem Zoning</p>
        
        <form @submit.prevent="handleLogin">
          <div class="form-group">
            <input 
              v-model="form.userid" 
              type="text" 
              class="form-control text-center text-lg uppercase" 
              placeholder="ID Pengguna (contoh: DND atau ALB)" 
              required
            />
          </div>
          
          <div class="form-group">
            <input 
              v-model="form.password" 
              type="password" 
              class="form-control text-center text-lg" 
              placeholder="Password" 
              required
            />
          </div>
          
          <button 
            type="submit" 
            class="btn btn-primary" 
            style="width: 100%"
            :disabled="loading"
          >
            {{ loading ? 'Memproses...' : 'Masuk' }}
          </button>
        </form>
        <p v-if="error" class="text-red-500 text-sm mt-4 font-bold">{{ error }}</p>
      </div>
    </div>

    <div v-else>
      <header class="mb-8">
        <h1 class="page-title">Selamat datang, <span class="text-primary">{{ auth.user?.userid }}</span></h1>
        <p class="page-subtitle">
          Level Akses: <span class="badge badge-warning">{{ roleBahasa }}</span>
        </p>
      </header>

      <div class="grid grid-cols-2 gap-6 mb-8">
        
        <div v-if="['ADMIN', 'SUPERVISOR'].includes(auth.role)" class="card bg-gradient-to-br from-indigo-50 to-white">
          <h2 class="font-bold mb-2">🗺️ Peta Zoning Interaktif</h2>
          <p class="text-gray-500 text-sm mb-4">Buat zona kunjungan baru menggunakan peta. Pilih mode Radius atau Kecamatan.</p>
          <router-link to="/zoning" class="btn btn-primary">Buka Peta Zoning</router-link>
        </div>

        <div v-if="['ADMIN', 'SUPERVISOR'].includes(auth.role)" class="card bg-gradient-to-br from-blue-50 to-white">
          <h2 class="font-bold mb-2">📋 Daftar Zona Kunjungan</h2>
          <p class="text-gray-500 text-sm mb-4">Lihat semua zona yang telah dibuat, termasuk progres kunjungan per salesman.</p>
          <router-link to="/zones" class="btn btn-primary" style="background: #06b6d4;">Lihat Daftar Zona</router-link>
        </div>
        
        <div v-if="auth.role === 'SALESMAN'" class="card bg-gradient-to-br from-green-50 to-white">
          <h2 class="font-bold mb-2">📍 Rute Kunjungan Hari Ini</h2>
          <p class="text-gray-500 text-sm mb-4">Lihat rute kunjungan harian Anda yang telah dioptimalkan secara otomatis.</p>
          <router-link to="/route" class="btn btn-success">Mulai Kunjungan</router-link>
        </div>

        <div v-if="auth.role === 'SALESMAN'" class="card bg-gradient-to-br from-blue-50 to-white">
          <h2 class="font-bold mb-2">📋 Zona Saya</h2>
          <p class="text-gray-500 text-sm mb-4">Lihat semua zona kunjungan yang ditetapkan untuk Anda oleh Supervisor.</p>
          <router-link to="/zones" class="btn btn-primary" style="background: #06b6d4;">Lihat Zona Saya</router-link>
        </div>

        <div v-if="auth.role === 'ADMIN'" class="card bg-gradient-to-br from-red-50 to-white">
          <h2 class="font-bold mb-2 text-red-700">⚠️ Zona Berbahaya</h2>
          <p class="text-gray-500 text-sm mb-4">Khusus Admin. Reset sistem akan menghapus semua data kunjungan.</p>
          <router-link to="/reset" class="btn btn-danger">Reset Sistem</router-link>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import axios from 'axios'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()

const form = ref({ userid: '', password: '' })
const error = ref('')
const loading = ref(false)

const roleBahasa = computed(() => {
  return { ADMIN: 'Admin', SUPERVISOR: 'Supervisor', SALESMAN: 'Salesman' }[auth.role] || auth.role
})

const handleLogin = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await axios.post('http://localhost:3000/api/auth/login', {
      userid: form.value.userid.trim().toUpperCase(),
      password: form.value.password
    })
    
    auth.login(res.data.token)
    
    if (res.data.first_login && res.data.role === 'SALESMAN') {
      router.push('/change-password')
    } else {
      router.push('/')
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Login Gagal. Periksa kembali ID dan password Anda.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.text-center { text-align: center; }
.text-lg { font-size: 1.125rem; }
.uppercase { text-transform: uppercase; }
.text-red-500 { color: var(--pk-danger); }
.font-bold { font-weight: 700; }
.text-primary { color: var(--pk-primary); }
.text-red-700 { color: #B91C1C; }
.btn-success { background-color: var(--pk-success); color: white; }
.bg-gradient-to-br { background: linear-gradient(to bottom right, var(--tw-gradient-stops)); }
.from-indigo-50 { --tw-gradient-stops: #EEF2FF, white; }
.from-green-50 { --tw-gradient-stops: #ECFDF5, white; }
.from-red-50 { --tw-gradient-stops: #FEF2F2, white; }
.from-blue-50 { --tw-gradient-stops: #eff6ff, white; }
</style>
