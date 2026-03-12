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

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Status</th>
              <th>Kode Member</th>
              <th>Nama</th>
              <th>Alamat</th>
              <th>Telepon</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in visits" :key="v.member_code" :class="{ 'bg-green-50': v.visited === 1 }">
              <td>
                <span v-if="v.is_approved === 1" class="badge badge-success">SELESAI</span>
                <span v-else-if="v.visited === 1" class="badge bg-blue-500 text-white">MENUNGGU KONFIRMASI</span>
                <span v-else class="badge badge-warning text-white">BELUM TUNTAS</span>
              </td>
              <td class="font-mono text-sm">{{ v.member_code }}</td>
              <td class="font-bold">{{ v.cus_namamember || 'Tidak Diketahui' }}</td>
              <td class="text-sm text-gray-600 max-w-xs truncate" :title="v.cus_alamatmember4">
                {{ v.cus_alamatmember4 }} - {{ v.cus_alamatmember5 }}
              </td>
              <td>{{ v.cus_hpmember || '-' }}</td>
              <td>
                <button 
                  v-if="v.visited === 0" 
                  @click="markVisited(v.member_code)" 
                  class="btn btn-primary"
                  style="padding: 8px 16px; font-size: 0.75rem"
                >
                  Tandai Selesai
                </button>
                <div v-else class="text-xs text-gray-500">
                  {{ formatTime(v.visited_at) }}
                  <div v-if="v.is_approved === 1" class="text-green-600 font-bold mt-1">Disetujui</div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
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

const completedCount = computed(() => visits.value.filter(v => v.visited === 1).length)

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
      target.visited = 1
      target.visited_at = new Date().toISOString()
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
