<template>
  <div class="change-password-page" style="max-width: 400px; margin: 100px auto;">
    <div class="card glass text-center">
      <h2 class="page-title text-primary mb-2">Keamanan Login Pertama</h2>
      <p class="text-sm text-gray-500 mb-6 font-bold">Anda wajib mengganti password default sebelum dapat melanjutkan.</p>
      
      <form @submit.prevent="submitChange">
        <div class="form-group text-left">
          <label class="form-label">Password Baru</label>
          <input 
            v-model="pass1" 
            type="password" 
            class="form-control" 
            required 
            minlength="6"
          />
        </div>
        <div class="form-group text-left">
          <label class="form-label">Konfirmasi Password Baru</label>
          <input 
            v-model="pass2" 
            type="password" 
            class="form-control" 
            required 
            minlength="6"
          />
        </div>
        
        <button type="submit" class="btn btn-primary" style="width: 100%" :disabled="loading">
          {{ loading ? 'Menyimpan...' : 'Simpan Password Baru' }}
        </button>
      </form>
      <p v-if="error" class="text-red-500 text-sm mt-4 font-bold">{{ error }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import axios from 'axios'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()

const pass1 = ref('')
const pass2 = ref('')
const error = ref('')
const loading = ref(false)

const submitChange = async () => {
  if (pass1.value !== pass2.value) {
    error.value = 'Konfirmasi password tidak cocok'
    return
  }

  loading.value = true
  error.value = ''
  try {
    await axios.post('http://localhost:3000/api/auth/change-password', 
      { newPassword: pass1.value },
      { headers: { Authorization: `Bearer ${auth.token}` } }
    )
    
    alert('Password berhasil diperbarui. Silakan masuk kembali menggunakan password baru Anda.')
    auth.logout()
    router.push('/')
  } catch (err) {
    error.value = err.response?.data?.error || 'Gagal memperbarui password'
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
