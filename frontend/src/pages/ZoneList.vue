<template>
  <div class="zona-list">
    <header class="mb-6">
      <h1 class="page-title">Daftar Zona Kunjungan</h1>
      <p class="page-subtitle">
        {{ isManagement ? 'Semua zona aktif yang telah dibuat oleh Admin dan Supervisor' : `Zona kunjungan Anda sebagai ${auth.user?.userid}` }}
      </p>
    </header>

    <!-- Filter Salesman (Admin/Supervisor Only) -->
    <div v-if="isManagement" class="card mb-6">
      <div class="flex items-center gap-4">
        <div class="form-group mb-0" style="min-width: 200px;">
          <label class="form-label">Filter Salesman</label>
          <select v-model="filterSalesman" class="form-control" @change="fetchZones">
            <option value="">-- Semua Salesman --</option>
            <option value="DND">DND</option>
            <option value="DPT">DPT</option>
            <option value="FRL">FRL</option>
            <option value="LID">LID</option>
          </select>
        </div>
        <div style="margin-top: 24px;">
          <button @click="fetchZones" class="btn btn-primary">Muat Ulang</button>
        </div>
      </div>
    </div>

    <!-- Loading / Empty state -->
    <div v-if="loading" class="card text-center py-12 text-gray-400">
      <p>Memuat data zona...</p>
    </div>

    <div v-else-if="zones.length === 0" class="card text-center py-12 text-gray-400">
      <p class="text-lg mb-2">⚠️ Belum ada zona aktif yang ditemukan.</p>
      <p class="text-sm">{{ isManagement ? 'Silakan buat zona baru melalui menu Peta Zoning Interaktif.' : 'Supervisor Anda belum menetapkan zona untuk Anda.' }}</p>
    </div>

    <!-- Zone cards grid -->
    <div v-else class="zone-grid">
      <div
        v-for="zone in zones"
        :key="zone.id"
        class="card zone-card"
        :class="getStatusClass(zone)"
        @click="isManagement && openVisitsModal(zone)"
        :style="isManagement ? 'cursor: pointer;' : ''"
      >
        <!-- Header Row -->
        <div class="zone-header">
          <div>
            <span class="zone-id text-xs font-mono text-gray-400">#{{ zone.id }}</span>
            <h3 class="font-bold text-lg text-gray-800">Salesman: <span class="text-primary">{{ zone.salesman_code }}</span></h3>
          </div>
          <div class="flex flex-col items-end gap-1">
            <span class="badge" :class="zone.zone_type === 'radius' ? 'badge-primary' : 'badge-warning'">
              {{ zone.zone_type === 'radius' ? '📍 Radius' : '🏘️ Kecamatan' }}
            </span>
            <span class="badge badge-success text-xs">{{ formatStatus(zone) }}</span>
          </div>
        </div>

        <!-- Details -->
        <div class="zone-details mt-3">
          <div class="detail-row">
            <span class="detail-label">📅 Tanggal Kunjungan:</span>
            <span class="detail-value font-bold">{{ formatDate(zone.scheduled_date) }}</span>
          </div>
          <div v-if="zone.zone_type === 'kelurahan'" class="detail-row">
            <span class="detail-label">🏘️ Kecamatan:</span>
            <span class="detail-value">{{ zone.kelurahan || '-' }}</span>
          </div>
          <div v-if="zone.zone_type === 'radius'" class="detail-row">
            <span class="detail-label">📐 Radius:</span>
            <span class="detail-value">{{ zone.radius_km?.toFixed(1) ?? '-' }} km</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">👥 Total Member:</span>
            <span class="detail-value">{{ zone.total_member }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">✅ Selesai:</span>
            <span class="detail-value text-green-600 font-bold">{{ zone.visited_count ?? 0 }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">⏳ Menunggu Konfirmasi:</span>
            <span class="detail-value text-blue-500 font-bold">{{ zone.pending_approval_count ?? 0 }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">⚪ Belum Dikunjungi:</span>
            <span class="detail-value text-orange-500 font-bold">{{ zone.pending_count ?? 0 }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">🕐 Dibuat Pada:</span>
            <span class="detail-value text-xs text-gray-400">{{ formatDateTime(zone.created_at) }}</span>
          </div>
          <div v-if="isManagement" class="detail-row">
            <span class="detail-label">👤 Dibuat Oleh:</span>
            <span class="detail-value text-xs font-mono">{{ zone.created_by }}</span>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="mt-4">
          <div class="flex justify-between text-xs text-gray-500 mb-1">
            <span>Progress Kunjungan (Selesai/Total)</span>
            <span>{{ zone.total_member > 0 ? Math.round((zone.visited_count / zone.total_member) * 100) : 0 }}%</span>
          </div>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: zone.total_member > 0 ? Math.round((zone.visited_count / zone.total_member) * 100) + '%' : '0%' }"
            ></div>
          </div>
        </div>

        <!-- Delete Button (Admin/Supervisor only) -->
        <div v-if="isManagement" class="mt-4 flex justify-end">
          <button
            @click="deleteZone(zone.id)"
            class="btn btn-danger text-sm"
            style="padding: 0.3rem 0.8rem; font-size: 0.75rem;"
          >
            Hapus Zona
          </button>
        </div>
      </div>
    </div>

    <!-- Visits Modal -->
    <div v-if="showingVisitsModal" class="modal-overlay" @click.self="showingVisitsModal = false">
      <div class="modal-content animate-fade-in" style="max-width: 700px; width: 90%;">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold">Daftar Kunjungan Zona #{{ selectedZone?.id }}</h2>
          <button @click="showingVisitsModal = false" class="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
        </div>

        <div v-if="loadingVisits" class="text-center py-8 text-gray-400">
          Memuat data kunjungan...
        </div>
        <div v-else-if="zoneVisits.length === 0" class="text-center py-8 text-gray-400">
          Tidak ada data member di zona ini.
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-gray-100 uppercase text-xs text-gray-600">
                <th class="p-3 border-b">Nama Member</th>
                <th class="p-3 border-b">Kode</th>
                <th class="p-3 border-b">Status</th>
                <th class="p-3 border-b text-center">Waktu Kunjungan</th>
                <th class="p-3 border-b text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="v in zoneVisits" :key="v.member_code" class="border-b hover:bg-gray-50">
                <td class="p-3 font-medium">{{ v.member_name }}</td>
                <td class="p-3 text-sm font-mono text-gray-500">{{ v.member_code }}</td>
                <td class="p-3 text-sm">
                  <span v-if="v.is_approved === 1" class="text-green-600 font-bold">✅ Selesai</span>
                  <span v-else-if="v.visited === 1" class="text-blue-500 font-bold">⏳ Menunggu Konfirmasi</span>
                  <span v-else class="text-gray-400 font-bold">⚪ Belum</span>
                </td>
                <td class="p-3 text-center text-xs text-gray-500">
                  {{ formatDateTime(v.visited_at) }}
                  <div v-if="v.is_approved === 1" class="text-[10px] text-green-600">Disetujui: {{ formatDateTime(v.approved_at) }}</div>
                </td>
                <td class="p-3 text-center">
                  <button 
                    v-if="v.visited === 1 && v.is_approved === 0" 
                    @click="approveVisit(v.member_code)"
                    class="btn btn-success text-xs py-1 px-3"
                    :disabled="approving[v.member_code]"
                  >
                    {{ approving[v.member_code] ? '...' : 'Terima' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div class="mt-6 flex justify-end">
          <button @click="showingVisitsModal = false" class="btn btn-secondary">Tutup</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import dayjs from 'dayjs'

const auth = useAuthStore()
const zones = ref([])
const loading = ref(true)
const filterSalesman = ref('')

const showingVisitsModal = ref(false)
const selectedZone = ref(null)
const zoneVisits = ref([])
const loadingVisits = ref(false)
const approving = ref({})

const isManagement = computed(() => ['ADMIN', 'SUPERVISOR'].includes(auth.role))

const formatDate = (d) => dayjs(d).format('DD MMMM YYYY')
const formatDateTime = (d) => d ? dayjs(d).format('DD/MM/YY HH:mm') : '-'

const formatStatus = (zone) => {
  const p = zone.pending_count ?? 0
  const pv = zone.pending_approval_count ?? 0
  const v = zone.visited_count ?? 0
  if (p === 0 && pv === 0 && v > 0) return '✓ Selesai'
  if (pv > 0) return `Menunggu Konfirmasi (${pv})`
  if (v > 0) return `Berjalan (${v}/${zone.total_member})`
  return 'Belum Dimulai'
}

const getStatusClass = (zone) => {
  const p = zone.pending_count ?? 0
  const pv = zone.pending_approval_count ?? 0
  const v = zone.visited_count ?? 0
  if (p === 0 && pv === 0 && v > 0) return 'zone-done'
  if (pv > 0 || v > 0) return 'zone-active'
  return ''
}

const fetchZones = async () => {
  loading.value = true
  try {
    let url = '/api/zones'
    if (isManagement.value) {
      if (filterSalesman.value) url += `?salesman_code=${filterSalesman.value}`
    } else {
      url = '/api/zones/mine'
    }
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    zones.value = res.data
  } catch (err) {
    console.error(err)
    zones.value = []
  } finally {
    loading.value = false
  }
}

const deleteZone = async (id) => {
  if (!window.confirm('Hapus zona ini? Tindakan ini tidak dapat dibatalkan.')) return
  try {
    await axios.delete(`/api/zone/${id}`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    zones.value = zones.value.filter(z => z.id !== id)
  } catch (err) {
    alert(err.response?.data?.error || 'Gagal menghapus zona')
  }
}

const openVisitsModal = async (zone) => {
  selectedZone.value = zone
  showingVisitsModal.value = true
  loadingVisits.value = true
  zoneVisits.value = []
  try {
    const res = await axios.get(`/api/zone/${zone.id}/visits`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    zoneVisits.value = res.data
  } catch (err) {
    alert('Gagal memuat detail kunjungan')
  } finally {
    loadingVisits.value = false
  }
}

const approveVisit = async (memberCode) => {
  if (!selectedZone.value) return
  approving.value[memberCode] = true
  try {
    await axios.post('/api/visit/approve', {
      zone_id: selectedZone.value.id,
      member_code: memberCode
    }, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    
    // Update local visit list array
    const vIndex = zoneVisits.value.findIndex(v => v.member_code === memberCode)
    if (vIndex !== -1) {
      zoneVisits.value[vIndex].is_approved = 1
      zoneVisits.value[vIndex].approved_at = new Date().toISOString()
    }

    // Refresh overall stats without full page reload if possible, or just call fetchZones
    fetchZones()

  } catch (err) {
    alert(err.response?.data?.error || 'Gagal menyetujui kunjungan')
  } finally {
    approving.value[memberCode] = false
  }
}

onMounted(() => fetchZones())
</script>

<style scoped>
.zone-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.zone-card {
  border-left: 4px solid var(--pk-border);
  transition: transform 0.2s, box-shadow 0.2s;
}

.zone-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0,0,0,0.1);
}

.zone-done {
  border-left-color: var(--pk-success);
  background: linear-gradient(135deg, #ecfdf5, #fff);
}

.zone-active {
  border-left-color: var(--pk-primary);
  background: linear-gradient(135deg, #eef2ff, #fff);
}

.zone-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.5rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0;
  border-bottom: 1px solid #f3f4f6;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  font-size: 0.75rem;
  color: #6b7280;
  flex-shrink: 0;
  margin-right: 0.5rem;
}

.detail-value {
  font-size: 0.8rem;
  color: #374151;
  text-align: right;
}

.progress-bar {
  height: 6px;
  background: #e5e7eb;
  border-radius: 9999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(to right, var(--pk-primary), var(--pk-success));
  border-radius: 9999px;
  transition: width 0.4s ease;
}

.badge-primary { background: var(--pk-primary); color: white; }
.badge-warning { background: #f59e0b; color: white; }
.text-primary { color: var(--pk-primary); }
.text-green-600 { color: #16a34a; }
.text-orange-500 { color: #f97316; }
.text-blue-500 { color: #3b82f6; }
.font-mono { font-family: monospace; }
.mb-0 { margin-bottom: 0; }

/* Modal Styles */
.modal-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5); z-index: 1000;
  display: flex; justify-content: center; align-items: center;
}
.modal-content {
  background: white; border-radius: 12px; padding: 1.5rem;
  max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
}
.animate-fade-in { animation: fadeIn 0.2s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

/* Tablet */
@media (max-width: 1024px) {
  .zone-grid {
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }
}

/* Mobile */
@media (max-width: 768px) {
  .zone-grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
  .zona-list .flex.items-center.gap-4 {
    flex-direction: column;
    align-items: stretch;
  }
  .zona-list .flex.items-center.gap-4 > div {
    min-width: 100% !important;
    margin-top: 0 !important;
  }
  .zone-header {
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  .detail-label {
    font-size: 0.7rem;
  }
  .detail-value {
    font-size: 0.75rem;
  }
  .modal-content {
    padding: 1rem;
    width: 95% !important;
  }
  .modal-content h2 {
    font-size: 1.1rem;
  }
  .overflow-x-auto {
    margin-bottom: 0.5rem;
  }
  /* Responsive Table For Modal */
  table th, table td {
    padding: 8px 4px !important;
    font-size: 0.7rem !important;
  }
  .btn-success {
    padding: 4px 8px !important;
    font-size: 0.65rem !important;
  }
}
</style>
