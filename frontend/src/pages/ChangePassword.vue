<template>
  <div class="change-password-page" style="max-width: 400px; margin: 100px auto;">
    <div class="card glass text-center">
      <h2 class="page-title text-primary mb-2">{{ isFirstLogin ? 'Keamanan Akses Masuk Perdana' : '🔑 Ganti Kata Sandi' }}</h2>
      <p class="text-sm text-gray-500 mb-6 font-bold">{{ isFirstLogin ? 'Anda diwajibkan untuk mengganti kata sandi bawaan sistem sebelum dapat melanjutkan aktivitas.' : 'Masukkan kata sandi baru Anda untuk memperbarui keamanan akun.' }}</p>
      
      <form @submit.prevent="submitChange">
        <div class="form-group text-left">
          <label class="form-label">Kata Sandi Baru</label>
          <input 
            v-model="pass1" 
            type="password" 
            class="form-control" 
            required 
            minlength="6"
          />
        </div>
        <div class="form-group text-left">
          <label class="form-label">Konfirmasi Kata Sandi Baru</label>
          <input 
            v-model="pass2" 
            type="password" 
            class="form-control" 
            required 
            minlength="6"
          />
        </div>
        
        <button type="submit" class="btn btn-primary" style="width: 100%" :disabled="loading">
          {{ loading ? 'Memproses...' : 'Simpan Kata Sandi' }}
        </button>
      </form>
      <p v-if="error" class="text-red-500 text-sm mt-4 font-bold">{{ error }}</p>
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

const isFirstLogin = computed(() => auth.isFirstLogin)

const pass1 = ref('')
const pass2 = ref('')
const error = ref('')
const loading = ref(false)

const submitChange = async () => {
  if (pass1.value !== pass2.value) {
    error.value = 'Konfirmasi kata sandi tidak cocok dengan sandi awal'
    return
  }

  loading.value = true
  error.value = ''
  try {
    await axios.post('/api/auth/change-password', 
  { newPassword: pass1.value },
  { headers: { Authorization: `Bearer ${auth.token}` } }
)
    
    if (isFirstLogin.value) {
      alert('Kata sandi berhasil diperbarui. Silakan akses kembali menggunakan kata sandi Anda yang baru.')
      auth.logout()
      router.push('/')
    } else {
      alert('Kata sandi berhasil diperbarui.')
      auth.logout()
      router.push('/')
    }
  } catch (err) {
    error.value = err.response?.data?.error || 'Pembaruan kata sandi sistem mengalami kegagalan'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.text-left { text-align: left; }
.text-center { text-align: center; }
.text-primary { color: var(--pk-primary); }
.text-red-500 { color: var(--pk-danger); }
.font-bold { font-weight: 700; }
</style>
