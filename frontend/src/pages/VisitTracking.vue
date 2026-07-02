<template>
  <div class="visit-tracking">
    <header class="mb-8">
      <h1 class="page-title">Kunjungan Hari Ini</h1>
      <p class="page-subtitle">Pantau dan catat kunjungan Anda yang telah selesai untuk hari ini</p>
    </header>

    <div v-if="loading" class="text-center py-12 text-gray-500">
      Memuat jadwal kunjungan Anda...
    </div>

    <div v-else-if="visits.length === 0" class="card text-center py-12 text-gray-500 glass">
      <p class="mb-4">Tidak ada kunjungan yang ditugaskan untuk hari ini.</p>
      <!-- router-link removed because salesmen don't assign zones, but leaving it as it was if existing -->
      <router-link to="/zones" class="btn btn-primary">Lihat Zona Saya</router-link>
    </div>

    <div v-else class="card glass">
      <div class="flex justify-between items-center mb-6">
        <h3 class="font-bold text-lg">Rute Kunjungan: <span class="text-primary">{{ visits.length }} Member</span></h3>
        <div class="text-sm">
          Selesai: <span class="badge badge-success">{{ completedCount }}</span> / {{ visits.length }}
        </div>
      </div>

      <div class="bg-white rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/80 mt-4">
        <div class="bg-gradient-to-r from-blue-50 to-indigo-50/50 px-6 py-4 border-b border-gray-100">
          <h4 class="font-bold text-gray-800 text-lg flex items-center gap-2">
            <i class="fa-solid fa-list-check text-blue-500"></i> Daftar Target Kunjungan
          </h4>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-white border-b border-gray-100 uppercase text-[10px] sm:text-xs text-gray-500 tracking-wider">
                <th class="px-6 py-4 font-bold">Status</th>
                <th class="px-6 py-4 font-bold">Kode Member</th>
                <th class="px-6 py-4 font-bold">Nama Toko</th>
                <th class="px-6 py-4 font-bold">Alamat</th>
                <th class="px-6 py-4 font-bold">Telepon</th>
                <th class="px-6 py-4 font-bold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr v-for="v in visits" :key="v.member_code" 
                  class="bg-white hover:bg-blue-50/40 transition-all duration-200"
                  :class="{ 'bg-emerald-50/30': v.visited === true }">
                <td class="px-6 py-4">
                  <span v-if="v.is_approved === true" class="bg-emerald-100/60 text-emerald-700 py-1 px-3 rounded-full text-xs font-bold border border-emerald-200">SELESAI</span>
                  <span v-else-if="v.visited === true" class="bg-blue-100/60 text-blue-700 py-1 px-3 rounded-full text-xs font-bold border border-blue-200">MENUNGGU</span>
                  <span v-else class="bg-amber-100/60 text-amber-700 py-1 px-3 rounded-full text-xs font-bold border border-amber-200">BELUM TUNTAS</span>
                </td>
                <td class="px-6 py-4 font-mono text-sm text-gray-600">{{ v.member_code }}</td>
                <td class="px-6 py-4 font-bold text-gray-800">{{ v.cus_namamember || 'Tidak Diketahui' }}</td>
                <td class="px-6 py-4 text-sm text-gray-500 max-w-[250px] truncate" :title="v.cus_alamatmember4">
                  {{ v.cus_alamatmember4 }} {{ v.cus_alamatmember5 ? '- ' + v.cus_alamatmember5 : '' }}
                </td>
                <td class="px-6 py-4 text-sm text-gray-600">{{ v.cus_hpmember || '-' }}</td>
                <td class="px-6 py-4 text-center">
                  <button 
                    v-if="v.visited === false" 
                    @click="markVisited(v.member_code)" 
                    class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-colors text-sm"
                  >
                    Tandai Selesai
                  </button>
                  <div v-else class="flex flex-col items-center justify-center">
                    <span class="text-xs text-gray-400 font-medium bg-gray-100 py-1 px-2 rounded-md">
                      <i class="fa-regular fa-clock mr-1"></i>{{ formatTime(v.visited_at) }}
                    </span>
                    <div v-if="v.is_approved === true" class="text-emerald-500 font-bold text-[10px] mt-1 uppercase tracking-wide">
                      <i class="fa-solid fa-check-circle mr-1"></i>Disetujui
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useAuthStore } from '../stores/auth'
import axios from 'axios'
import dayjs from 'dayjs'

const auth = useAuthStore()
const visits = ref([])
const loading = ref(true)

const completedCount = computed(() => visits.value.filter(v => v.visited === true).length)

const fetchVisits = async () => {
  loading.value = true
  try {
    const res = await axios.get(`/api/visit/today?salesman=${auth.salesmanCode}`)
    visits.value = res.data
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

const markVisited = async (memberCode) => {
  try {
    await axios.post('/api/visit/mark', {
      salesman_code: auth.salesmanCode,
      member_code: memberCode
    })
    // Refresh list locally
    const target = visits.value.find(v => v.member_code === memberCode)
    if (target) {
      target.visited = true
      target.visited_at = dayjs().format('YYYY-MM-DD HH:mm:ss')
    }
  } catch (err) {
    alert(err.response?.data?.error || 'Gagal menandai kunjungan')
  }
}

const formatTime = (isoString) => {
  if (!isoString) return ''
  return dayjs(isoString).format('HH:mm')
}

onMounted(() => {
  fetchVisits()
})
</script>

<style scoped>
.font-mono { font-family: monospace; }
.text-sm { font-size: 0.875rem; }
.text-xs { font-size: 0.75rem; }
.text-gray-500 { color: var(--pk-text-muted); }
.text-gray-600 { color: #4B5563; }
.bg-green-50 { background-color: #F0FDF4; }
.max-w-xs { max-width: 320px; }
.truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; }
.py-12 { padding-top: 48px; padding-bottom: 48px; }
.font-bold { font-weight: 700; }

/* Mobile Optimization */
@media (max-width: 768px) {
  .table-container {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    margin: 0 -1rem;
    padding: 0 1rem;
  }
  .table th, .table td {
    white-space: nowrap;
    padding: 8px 12px;
    font-size: 0.8rem;
  }
  .page-title {
    font-size: 1.5rem;
  }
  .btn-primary {
    padding: 6px 12px !important;
  }
}
</style>
