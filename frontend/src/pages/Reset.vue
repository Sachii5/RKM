<template>
  <div class="reset-page max-w-2xl mx-auto">
    <header class="mb-8">
      <h1 class="page-title text-red-600">⚠️ Reset Sistem</h1>
      <p class="page-subtitle text-red-500">ZONA BERBAHAYA: Hanya untuk Admin. Bertindaklah dengan hati-hati.</p>
    </header>

    <div class="card glass" style="border-color: rgba(239,68,68,0.3); background: rgba(254, 242, 242, 0.8);">
      <h2 class="font-bold text-lg mb-4 text-red-700">Reset Data Kunjungan</h2>
      <div class="text-sm text-gray-700 mb-6">
        Menjalankan reset akan secara permanen melakukan:
        <ul class="list-disc pl-6 mt-2 space-y-1">
          <li>Backup lengkap database SQLite <code>visits.db</code> ke folder <code>/backup/</code>.</li>
          <li>Penghapusan semua data zona, member, dan log kunjungan aktif saat ini.</li>
          <li>Pembersihan file backup lama yang berusia lebih dari 365 hari.</li>
        </ul>
      </div>

      <div v-if="successMessage" class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-6">
        <span class="block sm:inline">{{ successMessage }}</span>
      </div>

      <div v-if="errorMessage" class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6">
        <span class="block sm:inline">{{ errorMessage }}</span>
      </div>

      <button 
        @click="confirmReset" 
        class="btn btn-danger" 
        :disabled="loading"
        style="width: 100%; font-size: 1rem; padding: 16px;"
      >
        <span v-if="!loading">Jalankan Reset Data</span>
        <span v-else>Memproses Reset...</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const loading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const confirmReset = async () => {
  const confirm = window.confirm('PERINGATAN: Tindakan ini akan menghapus semua zona dan data kunjungan aktif untuk semua salesman, dengan backup otomatis dibuat terlebih dahulu. Lanjutkan?')
  if (!confirm) return

  loading.value = true
  successMessage.value = ''
  errorMessage.value = ''

  try {
    const res = await axios.post('http://localhost:3000/api/reset', {}, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    successMessage.value = `Reset berhasil. Backup ${res.data.backupFilename} telah dibuat.`
  } catch (err) {
    errorMessage.value = err.response?.data?.error || 'Reset gagal dijalankan oleh server.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.max-w-2xl { max-width: 42rem; }
.mx-auto { margin-left: auto; margin-right: auto; }
.text-red-600 { color: #DC2626; }
.text-red-500 { color: var(--pk-danger); }
.text-red-700 { color: #B91C1C; }
.text-gray-700 { color: #374151; }
.list-disc { list-style-type: disc; }
.pl-6 { padding-left: 1.5rem; }
.mt-2 { margin-top: 0.5rem; }
.space-y-1 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.25rem; }
.bg-green-100 { background-color: #D1FAE5; }
.border-green-400 { border-color: #34D399; }
.text-green-700 { color: #047857; }
.bg-red-100 { background-color: #FEE2E2; }
.border-red-400 { border-color: #F87171; }
.rounded { border-radius: 0.25rem; }
.px-4 { padding-left: 1rem; padding-right: 1rem; }
.py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
.relative { position: relative; }
.mb-6 { margin-bottom: 1.5rem; }
</style>
