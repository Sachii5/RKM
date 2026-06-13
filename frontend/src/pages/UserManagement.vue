<template>
  <div class="user-management max-w-6xl mx-auto px-4 py-8">
    <header class="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-900 tracking-tight">Manajemen Pengguna</h1>
        <p class="text-gray-500 mt-1">Kelola data Salesman, Supervisor, dan staff lainnya.</p>
      </div>
      <button @click="openAddModal" class="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2 font-medium">
        <i class="fa-solid fa-user-plus"></i> Tambah Pengguna
      </button>
    </header>

    <!-- Error/Loading States -->
    <div v-if="loading" class="text-center py-12">
      <i class="fa-solid fa-circle-notch fa-spin text-4xl text-indigo-500"></i>
      <p class="mt-4 text-gray-500">Memuat data pengguna...</p>
    </div>
    
    <div v-else-if="error" class="bg-red-50 text-red-600 p-4 rounded-xl mb-6">
      <i class="fa-solid fa-triangle-exclamation mr-2"></i> {{ error }}
    </div>

    <!-- Users Table -->
    <div v-else class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
              <th class="px-6 py-4 font-semibold">User ID</th>
              <th class="px-6 py-4 font-semibold">Nama Lengkap</th>
              <th class="px-6 py-4 font-semibold">Role</th>
              <th class="px-6 py-4 font-semibold">Status Sandi</th>
              <th class="px-6 py-4 font-semibold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50 text-sm">
            <tr v-for="user in users" :key="user.id" class="hover:bg-gray-50/50 transition-colors">
              <td class="px-6 py-4 font-medium text-gray-900">{{ user.userid }}</td>
              <td class="px-6 py-4 text-gray-600">{{ user.fullname || '-' }}</td>
              <td class="px-6 py-4">
                <span class="px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase" :class="{
                  'bg-blue-100 text-blue-700': user.role === 'SALESMAN',
                  'bg-purple-100 text-purple-700': user.role === 'SUPERVISOR',
                  'bg-emerald-100 text-emerald-700': user.role === 'ADMIN',
                  'bg-rose-100 text-rose-700': user.role === 'MANAGER'
                }">
                  {{ user.role }}
                </span>
              </td>
              <td class="px-6 py-4">
                <span v-if="user.first_login" class="text-orange-500 text-xs font-medium flex items-center gap-1.5">
                  <i class="fa-solid fa-clock-rotate-left"></i> Default (123456)
                </span>
                <span v-else class="text-emerald-500 text-xs font-medium flex items-center gap-1.5">
                  <i class="fa-solid fa-shield-check"></i> Sudah Diubah
                </span>
              </td>
              <td class="px-6 py-4 text-right">
                <div class="flex items-center justify-end gap-2">
                  <button @click="promptResetPassword(user)" class="w-8 h-8 rounded-lg bg-gray-50 text-gray-500 hover:text-orange-600 hover:bg-orange-50 transition-colors flex items-center justify-center" title="Reset Password">
                    <i class="fa-solid fa-key"></i>
                  </button>
                  <button @click="openEditModal(user)" class="w-8 h-8 rounded-lg bg-gray-50 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors flex items-center justify-center" title="Edit Pengguna">
                    <i class="fa-solid fa-pen"></i>
                  </button>
                  <button @click="promptDelete(user)" class="w-8 h-8 rounded-lg bg-gray-50 text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition-colors flex items-center justify-center" title="Hapus Pengguna">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="users.length === 0">
              <td colspan="5" class="px-6 py-12 text-center text-gray-500">
                Belum ada data pengguna.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Form (Add/Edit) -->
    <div v-if="showModal" class="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click.self="showModal = false">
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 class="text-lg font-bold text-gray-900">{{ isEditing ? 'Edit Pengguna' : 'Tambah Pengguna' }}</h3>
          <button @click="showModal = false" class="text-gray-400 hover:text-gray-600 transition-colors w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <form @submit.prevent="submitForm" class="p-6">
          <div class="space-y-5">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">User ID (Kode) *</label>
              <input v-model="form.userid" type="text" required placeholder="Cth: DND" class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" />
              <p v-if="!isEditing" class="text-[11px] text-gray-400 mt-1">User ID ini akan digunakan untuk login.</p>
            </div>
            
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Nama Lengkap</label>
              <input v-model="form.fullname" type="text" placeholder="Cth: Dendi Sudirman" class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all" />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Role (Akses) *</label>
              <select v-model="form.role" required class="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all appearance-none">
                <option value="SALESMAN">SALESMAN</option>
                <option value="SUPERVISOR">SUPERVISOR</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            <div v-if="!isEditing" class="bg-indigo-50 text-indigo-700 p-3 rounded-xl text-xs flex gap-3">
              <i class="fa-solid fa-circle-info mt-0.5"></i>
              <p>Password default untuk pengguna baru adalah <strong>123456</strong>. Pengguna akan diminta mengganti password saat pertama kali login.</p>
            </div>
          </div>

          <div class="mt-8 flex justify-end gap-3">
            <button type="button" @click="showModal = false" class="px-5 py-2.5 rounded-xl font-medium text-gray-600 hover:bg-gray-100 transition-colors">Batal</button>
            <button type="submit" :disabled="saving" class="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl shadow-sm transition-all font-medium flex items-center gap-2">
              <i v-if="saving" class="fa-solid fa-circle-notch fa-spin"></i>
              {{ saving ? 'Menyimpan...' : 'Simpan' }}
            </button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const users = ref([])
const loading = ref(true)
const error = ref('')

const showModal = ref(false)
const isEditing = ref(false)
const saving = ref(false)
const form = ref({ id: null, userid: '', fullname: '', role: 'SALESMAN' })

const fetchUsers = async () => {
  try {
    loading.value = true
    const res = await axios.get('/api/users', {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    users.value = res.data
  } catch (err) {
    error.value = 'Gagal mengambil data pengguna.'
  } finally {
    loading.value = false
  }
}

const openAddModal = () => {
  isEditing.value = false
  form.value = { id: null, userid: '', fullname: '', role: 'SALESMAN' }
  showModal.value = true
}

const openEditModal = (user) => {
  isEditing.value = true
  form.value = { id: user.id, userid: user.userid, fullname: user.fullname || '', role: user.role }
  showModal.value = true
}

const submitForm = async () => {
  saving.value = true
  try {
    if (isEditing.value) {
      await axios.put(`/api/users/${form.value.id}`, form.value, {
        headers: { Authorization: `Bearer ${auth.token}` }
      })
    } else {
      await axios.post('/api/users', form.value, {
        headers: { Authorization: `Bearer ${auth.token}` }
      })
    }
    showModal.value = false
    fetchUsers()
  } catch (err) {
    alert(err.response?.data?.error || 'Terjadi kesalahan saat menyimpan data.')
  } finally {
    saving.value = false
  }
}

const promptDelete = async (user) => {
  if (confirm(`Apakah Anda yakin ingin menghapus pengguna ${user.userid}?`)) {
    try {
      await axios.delete(`/api/users/${user.id}`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      })
      fetchUsers()
    } catch (err) {
      alert('Gagal menghapus pengguna.')
    }
  }
}

const promptResetPassword = async (user) => {
  if (confirm(`Apakah Anda yakin ingin me-reset password ${user.userid} kembali ke 123456?`)) {
    try {
      await axios.post(`/api/users/${user.id}/reset-password`, {}, {
        headers: { Authorization: `Bearer ${auth.token}` }
      })
      alert('Password berhasil direset!')
      fetchUsers()
    } catch (err) {
      alert('Gagal mereset password.')
    }
  }
}

onMounted(() => {
  fetchUsers()
})
</script>
