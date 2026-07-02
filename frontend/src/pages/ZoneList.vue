<template>
  <div class="zona-list">
    <header class="mb-6">
      <h1 class="page-title">Daftar Rute Kunjungan</h1>
      <p class="page-subtitle">
        {{ isManagement ? 'Semua rute aktif yang telah dibuat oleh Admin dan Supervisor' : `Zona kunjungan Anda sebagai ${auth.user?.userid}` }}
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
      <p class="text-lg mb-2"><i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b;"></i> Belum ada rute aktif yang ditemukan.</p>
      <p class="text-sm">{{ isManagement ? 'Silakan buat zona baru melalui menu Peta Rute RKM.' : 'Supervisor Anda belum menetapkan zona untuk Anda.' }}</p>
    </div>

    <!-- Grouped Zone cards (Calendar View) -->
    <div v-else class="calendar-view">
      <div v-for="yearGroup in groupedZonesArray" :key="yearGroup.year" class="mb-10">
        <h2 class="text-2xl font-extrabold text-gray-800 mb-6 border-b-2 border-gray-100 pb-2 flex items-center gap-2">
          <i class="fa-solid fa-calendar-days text-primary"></i> <span>{{ yearGroup.year }}</span>
        </h2>
        
        <div v-for="monthGroup in yearGroup.months" :key="monthGroup.month" class="mb-8 ml-2 md:ml-4">
          <div class="flex items-center gap-3 mb-5">
            <div class="w-2 h-8 bg-primary rounded-full"></div>
            <h3 class="text-xl font-bold text-gray-700 uppercase tracking-wider">{{ monthGroup.monthName }}</h3>
          </div>
          
          <div class="space-y-8 ml-4 md:ml-6 border-l-2 border-gray-200 pl-6 md:pl-8 relative">
            <div v-for="dateGroup in monthGroup.dates" :key="dateGroup.fullDate" class="relative date-group">
              <!-- Timeline node -->
              <div class="absolute -left-[31px] md:-left-[39px] top-1 bg-white border-4 border-gray-800 w-5 h-5 rounded-full shadow-sm z-10 timeline-node"></div>
              
              <div class="mb-4 flex items-center gap-3 cursor-pointer select-none hover:bg-gray-50 p-2 rounded-lg transition-colors -ml-2" @click="toggleDate(dateGroup.fullDate)">
                <div class="flex-1">
                  <h4 class="font-bold text-gray-800 text-lg leading-tight">{{ dateGroup.dayName }}</h4>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-500 font-medium">{{ dateGroup.dateStr }}</span>
                    <span class="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold">{{ dateGroup.zones.length }} Rute</span>
                  </div>
                </div>
                <div class="text-gray-400 mr-2">
                  <i v-if="expandedDates[dateGroup.fullDate]" class="fa-solid fa-chevron-up"></i>
                  <i v-else class="fa-solid fa-chevron-down"></i>
                </div>
              </div>
              
              <div v-show="expandedDates[dateGroup.fullDate]" class="zone-grid animate-fade-in mb-6">
                <div
                  v-for="zone in dateGroup.zones"
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
                        <i :class="zone.zone_type === 'radius' ? 'fa-solid fa-location-dot' : 'fa-solid fa-city'"></i> {{ zone.zone_type === 'radius' ? 'Radius' : 'Kecamatan' }}
                      </span>
                      <span class="badge badge-success text-xs">{{ formatStatus(zone) }}</span>
                    </div>
                  </div>

                  <!-- Details -->
                  <div class="zone-details mt-3">
                    <div v-if="zone.zone_type === 'kelurahan'" class="detail-row">
                      <span class="detail-label"><i class="fa-solid fa-city fa-fw"></i> Kecamatan:</span>
                      <span class="detail-value">{{ zone.kelurahan || '-' }}</span>
                    </div>
                    <div v-if="zone.zone_type === 'radius'" class="detail-row">
                      <span class="detail-label"><i class="fa-solid fa-ruler-combined fa-fw"></i> Radius:</span>
                      <span class="detail-value">{{ zone.radius_km?.toFixed(1) ?? '-' }} km</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label"><i class="fa-solid fa-users fa-fw"></i> Total Member:</span>
                      <span class="detail-value">{{ zone.total_member }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label"><i class="fa-solid fa-circle-check fa-fw" style="color:#16a34a;"></i> Selesai:</span>
                      <span class="detail-value text-green-600 font-bold">{{ zone.visited_count ?? 0 }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label"><i class="fa-solid fa-hourglass-hal fa-fw" style="color:#3b82f6;"></i> Menunggu Konfirmasi:</span>
                      <span class="detail-value text-blue-500 font-bold">{{ zone.pending_approval_count ?? 0 }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label"><i class="fa-solid fa-store-slash fa-fw" style="color:#ef4444;"></i> Toko Tutup:</span>
                      <span class="detail-value text-red-500 font-bold">{{ zone.closed_count ?? 0 }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label"><i class="fa-regular fa-circle fa-fw" style="color:#f97316;"></i> Belum Dikunjungi:</span>
                      <span class="detail-value text-orange-500 font-bold">{{ zone.pending_count ?? 0 }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-label"><i class="fa-regular fa-clock fa-fw"></i> Dibuat Pada:</span>
                      <span class="detail-value text-xs text-gray-400">{{ formatDateTime(zone.created_at) }}</span>
                    </div>
                    <div v-if="isManagement" class="detail-row">
                      <span class="detail-label"><i class="fa-solid fa-user fa-fw"></i> Dibuat Oleh:</span>
                      <span class="detail-value text-xs font-mono">{{ zone.created_by }}</span>
                    </div>
                  </div>

                  <!-- Progress Bar -->
                  <div class="mt-4">
                    <div class="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Progress Kunjungan (Selesai/Total)</span>
                      <span>{{ progressPct(zone) }}%</span>
                    </div>
                    <div class="progress-bar">
                      <div
                        class="progress-fill"
                        :style="{ width: progressPct(zone) + '%' }"
                      ></div>
                    </div>
                  </div>

                  <!-- Delete Button (Admin/Supervisor only) -->
                  <div v-if="isManagement" class="mt-4 flex justify-end">
                    <button
                      @click.stop="deleteZone(zone.id)"
                      class="btn btn-danger text-sm"
                      style="padding: 0.3rem 0.8rem; font-size: 0.75rem;"
                    >
                      <i class="fa-solid fa-trash-can"></i> Hapus Zona
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Visits Modal -->
    <div v-if="showingVisitsModal" class="modal-overlay" @click.self="showingVisitsModal = false">
      <div class="modal-content animate-fade-in" style="max-width: 900px; width: 90%;">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold">Daftar Kunjungan Zona #{{ selectedZone?.id }}</h2>
          <button @click="showingVisitsModal = false" class="text-gray-500 hover:text-gray-800 text-xl"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div v-if="loadingVisits" class="text-center py-8 text-gray-400">
          Memuat data kunjungan...
        </div>
        <div v-else-if="zoneVisits.length === 0" class="text-center py-8 text-gray-400">
          Tidak ada data member di zona ini.
        </div>
        <div v-else class="overflow-x-auto rounded-xl shadow-[0_4px_20px_rgb(0,0,0,0.04)] border border-gray-100 mt-2">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-gradient-to-r from-gray-50 to-slate-50 uppercase text-[10px] sm:text-xs text-gray-500 tracking-wider border-b border-gray-100">
                <th class="px-5 py-4 font-bold">Nama Member</th>
                <th class="px-5 py-4 font-bold">Kode</th>
                <th class="px-5 py-4 font-bold">Status Kunjungan</th>
                <th class="px-5 py-4 font-bold">Status Order</th>
                <th class="px-5 py-4 font-bold text-center">Waktu Kunjungan</th>
                <th class="px-5 py-4 font-bold text-center">Lokasi</th>
                <th class="px-5 py-4 font-bold text-center sticky right-0 bg-slate-50 z-10 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.6)] desktop-action-cell">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50">
              <tr v-for="v in zoneVisits" :key="`${v.visit_log_id}-${v.member_code}`" class="bg-white hover:bg-slate-50/60 transition-colors">
                <td class="px-5 py-3 font-bold text-gray-800">
                  {{ v.member_name }}
                  <div
                    v-if="v.visited === true && v.is_closed === false && v.is_approved === false"
                    class="mobile-visit-actions"
                  >
                    <button
                      @click="promptApprove(v)"
                      class="bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-colors text-xs font-medium py-1.5 px-3 rounded-lg flex items-center justify-center gap-1"
                      :disabled="approving[v.member_code]"
                    >
                      <i class="fa-solid fa-check"></i> Terima
                    </button>
                    <button
                      @click="rejectVisit(v)"
                      class="bg-rose-500 hover:bg-rose-600 text-white shadow-sm transition-colors text-xs font-medium py-1.5 px-3 rounded-lg flex items-center justify-center gap-1"
                      :disabled="approving[v.member_code]"
                    >
                      <i class="fa-solid fa-xmark"></i> Tolak
                    </button>
                  </div>
                </td>
                <td class="px-5 py-3 text-sm font-mono text-gray-500 bg-gray-50/50">{{ v.member_code }}</td>
                <td class="px-5 py-3 text-sm">
                  <span v-if="v.is_approved === true" class="bg-emerald-100/60 text-emerald-700 py-1 px-3 rounded-full text-xs font-bold border border-emerald-200"><i class="fa-solid fa-circle-check mr-1"></i>Selesai</span>
                  <span v-else-if="v.is_closed === true" class="bg-red-100/60 text-red-700 py-1 px-3 rounded-full text-xs font-bold border border-red-200"><i class="fa-solid fa-store-slash mr-1"></i>Tutup</span>
                  <span v-else-if="v.visited === true" class="bg-blue-100/60 text-blue-700 py-1 px-3 rounded-full text-xs font-bold border border-blue-200"><i class="fa-solid fa-hourglass-half mr-1"></i>Menunggu</span>
                  <span v-else class="bg-gray-100 text-gray-500 py-1 px-3 rounded-full text-xs font-bold border border-gray-200"><i class="fa-regular fa-circle mr-1"></i>Belum</span>
                </td>
                <td class="px-5 py-3 text-sm">
                  <span v-if="v.harga_total_item > 0" class="text-emerald-600 font-bold flex flex-col"><span class="flex items-center"><i class="fa-solid fa-circle-check mr-1"></i>Berhasil</span><span class="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md mt-1 font-mono w-max">{{ formatRupiah(v.harga_total_item) }}</span></span>
                  <span v-else class="text-rose-500 font-bold flex items-center"><i class="fa-solid fa-circle-xmark mr-1"></i>Gagal</span>
                </td>
                <td class="px-5 py-3 text-center text-xs text-gray-500">
                  <div class="bg-gray-50 py-1 px-2 rounded-md inline-block">{{ formatDateTime(v.visited_at) }}</div>
                  <div v-if="v.is_approved === true" class="text-[10px] text-emerald-600 mt-1 font-medium bg-emerald-50 px-2 py-0.5 rounded-md inline-block">Approve: {{ formatDateTime(v.approved_at) }}</div>
                </td>
                <td class="px-5 py-3 text-center text-xs">
                  <a
                    v-if="v.visit_lat && v.visit_lng"
                    :href="mapsUrl(v)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-blue-600 hover:underline font-medium"
                  >
                    Buka Maps
                  </a>
                  <div v-if="v.visit_accuracy_m != null" class="text-[10px] text-gray-500 mt-1">
                    Akurasi {{ Math.round(v.visit_accuracy_m) }} m
                  </div>
                  <span v-if="!v.visit_lat || !v.visit_lng" class="text-gray-400">-</span>
                </td>
                <td class="px-5 py-3 text-center sticky right-0 bg-white z-10 shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.6)] desktop-action-cell">
                  <div class="flex items-center justify-center gap-2">
                    <button 
                      v-if="v.visited === true && v.is_closed === false && v.is_approved === false" 
                      @click="promptApprove(v)"
                      class="bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm transition-colors text-xs font-medium py-1.5 px-3 rounded-lg flex items-center justify-center gap-1"
                      :disabled="approving[v.member_code]"
                    >
                      <i class="fa-solid fa-check"></i> Terima
                    </button>
                    <button 
                      v-if="v.visited === true && v.is_closed === false && v.is_approved === false" 
                      @click="rejectVisit(v)"
                      class="bg-rose-500 hover:bg-rose-600 text-white shadow-sm transition-colors text-xs font-medium py-1.5 px-3 rounded-lg flex items-center justify-center gap-1"
                      :disabled="approving[v.member_code]"
                    >
                      <i class="fa-solid fa-xmark"></i> Tolak
                    </button>
                  </div>
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

    <!-- Photo Verification Modal -->
    <div v-if="showingPhotoModal" class="modal-overlay" @click.self="showingPhotoModal = false" style="z-index: 1050;">
      <div class="modal-content animate-fade-in text-center" style="max-width: 500px;">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-bold">Verifikasi Foto Kunjungan</h2>
          <button @click="showingPhotoModal = false" class="text-gray-500 hover:text-gray-800 text-xl"><i class="fa-solid fa-xmark"></i></button>
        </div>
        
        <div class="mb-6 bg-gray-100 rounded-lg overflow-hidden min-h-[300px] flex items-center justify-center border border-gray-200">
          <img v-if="selectedVisitForApproval?.foto_kunjungan_url" :src="selectedVisitForApproval.foto_kunjungan_url" class="max-h-[60vh] object-contain w-full" alt="Foto Kunjungan" />
          <div v-else class="text-gray-400 flex flex-col items-center">
            <i class="fa-regular fa-image text-4xl mb-2"></i>
            <p>Tidak ada foto terlampir</p>
          </div>
        </div>

        <p class="text-sm text-gray-600 mb-6">Apakah Anda yakin ingin menyetujui kunjungan ke toko <strong>{{ selectedVisitForApproval?.member_name }}</strong>?</p>

        <div class="flex justify-between items-center mt-6">
          <button 
            @click="rejectVisit(selectedVisitForApproval)" 
            class="btn bg-rose-100 hover:bg-rose-200 text-rose-700 text-sm flex items-center gap-2"
            :disabled="approving[selectedVisitForApproval?.member_code]"
          >
            <i class="fa-solid fa-xmark"></i> Tolak Kunjungan
          </button>
          
          <div class="flex gap-3">
            <button @click="showingPhotoModal = false" class="btn btn-secondary text-sm">Batal</button>
            <button 
              @click="confirmApprove" 
              class="btn btn-primary text-sm flex items-center gap-2"
              :disabled="approving[selectedVisitForApproval?.member_code]"
            >
              <i class="fa-solid fa-check"></i> {{ approving[selectedVisitForApproval?.member_code] ? 'Memproses...' : 'Konfirmasi Terima' }}
            </button>
          </div>
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
import 'dayjs/locale/id'

dayjs.locale('id')

const auth = useAuthStore()
const zones = ref([])
const loading = ref(true)
const filterSalesman = ref('')

const expandedDates = ref({})
const toggleDate = (dateKey) => {
  expandedDates.value[dateKey] = !expandedDates.value[dateKey]
}

const showingVisitsModal = ref(false)
const selectedZone = ref(null)
const zoneVisits = ref([])
const loadingVisits = ref(false)
const approving = ref({})

const showingPhotoModal = ref(false)
const selectedVisitForApproval = ref(null)

const isManagement = computed(() => ['ADMIN', 'SUPERVISOR'].includes(auth.role))

const formatDate = (d) => dayjs(d).format('DD MMMM YYYY')
const formatDateTime = (d) => d ? dayjs(d).format('DD/MM/YY HH:mm') : '-'
const getLocalTimestamp = () => dayjs().format('YYYY-MM-DD HH:mm:ss')
const formatRupiah = (angka) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(angka || 0);
}

const progressPct = (z) => {
  if (!z.total_member) return 0
  const v = parseInt(z.visited_count || 0)
  const p = parseInt(z.pending_approval_count || 0)
  const c = parseInt(z.closed_count || 0)
  return Math.round(((v + p + c) / z.total_member) * 100)
}

const formatStatus = (zone) => {
  const p = zone.pending_count ?? 0
  const pv = zone.pending_approval_count ?? 0
  const v = zone.visited_count ?? 0
  const c = zone.closed_count ?? 0
  if (p === 0 && pv === 0 && v > 0) return 'Selesai'
  if (pv > 0) return `Menunggu Konfirmasi (${pv})`
  if (v > 0 || c > 0) return `Berjalan (${v}/${zone.total_member})`
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

const groupedZonesArray = computed(() => {
  const groups = {};
  
  // Sort descending by date
  const sortedZones = [...zones.value].sort((a, b) => new Date(b.scheduled_date) - new Date(a.scheduled_date));

  sortedZones.forEach(zone => {
    const d = dayjs(zone.scheduled_date);
    const year = d.format('YYYY');
    const monthKey = d.format('YYYY-MM'); // stable sorting key for month
    const monthName = d.format('MMMM');
    const dateKey = d.format('YYYY-MM-DD');
    
    if (!groups[year]) groups[year] = { year, months: {} };
    if (!groups[year].months[monthKey]) groups[year].months[monthKey] = { month: monthKey, monthName, dates: {} };
    if (!groups[year].months[monthKey].dates[dateKey]) {
       groups[year].months[monthKey].dates[dateKey] = {
         dateStr: d.format('DD MMMM YYYY'),
         day: d.format('DD'),
         dayName: d.format('dddd'),
         fullDate: dateKey,
         zones: []
       };
    }
    
    groups[year].months[monthKey].dates[dateKey].zones.push(zone);
  });

  // Convert to arrays and sort keys
  const result = Object.keys(groups).sort((a,b) => b - a).map(yearKey => {
    const y = groups[yearKey];
    
    const monthList = Object.values(y.months).sort((a, b) => {
      // sort months descending
      return b.month.localeCompare(a.month);
    }).map(m => {
      const dateList = Object.values(m.dates).sort((a, b) => new Date(b.fullDate) - new Date(a.fullDate));
      return { ...m, dates: dateList };
    });
    
    return { ...y, months: monthList };
  });
  
  return result;
});

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

const mapsUrl = (visit) => {
  return `https://www.google.com/maps?q=${visit.visit_lat},${visit.visit_lng}`
}

const promptApprove = (visit) => {
  selectedVisitForApproval.value = visit
  showingPhotoModal.value = true
}

const confirmApprove = async () => {
  if (!selectedZone.value || !selectedVisitForApproval.value) return
  const memberCode = selectedVisitForApproval.value.member_code
  
  approving.value[memberCode] = true
  try {
    await axios.post('/api/visit/approve', {
      zone_id: selectedZone.value.id,
      member_code: memberCode
    }, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    
    // Update local state
    const vIndex = zoneVisits.value.findIndex(v => v.member_code === memberCode)
    if (vIndex !== -1) {
      zoneVisits.value[vIndex].is_approved = true
      zoneVisits.value[vIndex].approved_at = getLocalTimestamp()
    }

    // Also update zone aggregate counters
    selectedZone.value.pending_approval_count = Math.max(0, (selectedZone.value.pending_approval_count || 1) - 1)
    selectedZone.value.visited_count = (selectedZone.value.visited_count || 0) + 1

    showingPhotoModal.value = false
  } catch (err) {
    alert(err.response?.data?.error || 'Gagal menyetujui kunjungan')
  } finally {
    approving.value[memberCode] = false
  }
}

const rejectVisit = async (visit) => {
  if (!selectedZone.value || !visit) return
  
  const reason = window.prompt(`Masukkan alasan penolakan kunjungan untuk toko ${visit.member_name}:`)
  if (reason === null) return // User cancelled
  
  const memberCode = visit.member_code
  approving.value[memberCode] = true
  try {
    await axios.post('/api/visit/reject', {
      zone_id: selectedZone.value.id,
      member_code: memberCode,
      reason: reason || ''
    }, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    
    // Update local state: reset to unvisited
    const vIndex = zoneVisits.value.findIndex(v => v.member_code === memberCode)
    if (vIndex !== -1) {
      zoneVisits.value[vIndex].visited = false
      zoneVisits.value[vIndex].is_approved = false
    }

    // Update aggregate counters
    selectedZone.value.pending_approval_count = Math.max(0, (selectedZone.value.pending_approval_count || 1) - 1)
    selectedZone.value.pending_count = (selectedZone.value.pending_count || 0) + 1

    if (showingPhotoModal.value) showingPhotoModal.value = false
  } catch (err) {
    alert(err.response?.data?.error || 'Gagal menolak kunjungan')
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
.mobile-visit-actions {
  display: none;
}

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
  .desktop-action-cell {
    display: none;
  }
  .mobile-visit-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
    margin-top: 0.5rem;
  }
  .mobile-visit-actions button {
    min-width: 4.5rem;
  }
  .btn-success {
    padding: 4px 8px !important;
    font-size: 0.65rem !important;
  }
  .timeline-node {
    left: -29px; /* Adjust node position for smaller padding */
    width: 16px;
    height: 16px;
    border-width: 3px;
  }
  .bg-primary-light {
    padding: 0.25rem 0.5rem;
    min-width: 2.5rem;
  }
}

.bg-primary-light {
  background-color: var(--pk-primary);
  opacity: 0.15;
}
.bg-dark-date {
  background-color: #1e293b;
}
.text-primary { color: var(--pk-primary); }
</style>
