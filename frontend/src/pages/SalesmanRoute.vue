<template>
  <div class="salesman-route flex flex-col h-full" style="height: 100vh;">
    <header class="mb-4">
      <h1 class="page-title">Rute RKM Hari Ini</h1>
      <p class="page-subtitle text-gray-500">
        {{ routeMembers.length }} Member dijadwalkan untuk <strong class="text-primary">{{ todayDisplay }}</strong>
      </p>
    </header>

    <div v-if="loading" class="text-center py-12 text-gray-500">
      Memuat data rute dan geografis Anda...
    </div>
    
    <div v-else-if="routeMembers.length === 0" class="card glass text-center py-12 text-gray-500">
      Tidak ada rute yang dipetakan untuk hari ini. Silakan hubungi supervisor Anda.
    </div>

    <div v-else class="h-full overflow-y-auto pb-6 flex justify-center">
      
      <!-- List View Grid -->
      <div class="w-full max-w-4xl">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 px-2">
          <div 
            v-for="(member, idx) in routeMembers" 
          :key="member.member_code"
          class="card relative flex flex-col"
          :class="{ 'opacity-70 bg-gray-50': member.visited === true }"
        >
          <div class="absolute top-4 right-4">
             <span v-if="member.is_approved === true" class="badge badge-success">SELESAI</span>
             <span v-else-if="member.is_closed === true" class="badge bg-red-500 text-white">TOKO TUTUP</span>
             <span v-else-if="member.visited === true" class="badge bg-blue-500 text-white">MENUNGGU KONFIRMASI</span>
             <span v-else class="badge badge-warning text-white">#{{ idx + 1 }}</span>
          </div>
          
          <h3 class="font-bold text-lg mb-1 cursor-pointer hover:text-primary transition-colors duration-200" @click="member.showDetails = !member.showDetails">
            {{ member.member_name || 'Tidak Diketahui' }}
            <span v-if="!member.showDetails" class="ml-2 text-xs text-blue-500 font-normal">(Lihat Detail)</span>
          </h3>
          <p class="text-xs text-gray-500 font-mono mb-2">{{ member.member_code }}</p>
          <p class="text-sm text-gray-600 mb-2">{{ member.alamat_snapshot }}</p>
          
          <div v-show="member.showDetails" class="bg-white p-3 rounded mb-4 text-sm mt-2 border shadow-sm animate-fade-in">
             <div class="mb-1"><strong class="text-gray-700">Telepon HT:</strong> <a :href="'tel:'+member.hp_snapshot" class="text-blue-600 hover:underline">{{ member.hp_snapshot || '-' }}</a></div>
             <div><strong class="text-gray-700">Email:</strong> <a :href="'mailto:'+member.email_snapshot" class="text-blue-600 hover:underline">{{ member.email_snapshot || '-' }}</a></div>
          </div>
          
          <div class="mt-auto pt-4 space-y-2">
            <button 
              v-if="member.visited === false" 
              @click="openSurvey(member)" 
              class="btn btn-primary w-full text-sm py-2"
            >
              Tandai Selesai
            </button>
            <button 
              v-if="member.visited === false" 
              @click="markClosed(member.member_code)" 
              class="btn bg-orange-500 hover:bg-orange-600 text-white font-medium w-full text-sm py-2 rounded-lg transition-colors"
            >
              Toko Tutup
            </button>
            <button 
              v-if="member.visited === true && member.is_approved !== true" 
              @click="cancelVisit(member.member_code)" 
              class="btn btn-outline w-full text-sm py-2" 
              style="border-color: var(--pk-danger); color: var(--pk-danger);"
            >
              Batalkan Kunjungan
            </button>
            <div v-else-if="member.is_approved === true" class="text-center text-green-600 text-sm font-bold py-2">
              <i class="fa-solid fa-circle-check"></i> Kunjungan Telah Disetujui
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
    
    <!-- Survey Modal -->
    <SurveyForm 
      :show="showSurveyModal" 
      :visitId="selectedVisitId" 
      :memberCode="selectedMemberCode" 
      @close="closeSurvey" 
      @submit="handleSurveySubmit" 
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import dayjs from 'dayjs'
import 'dayjs/locale/id'
import SurveyForm from '../components/SurveyForm.vue'

const auth = useAuthStore()
const loading = ref(true)

const zoneInfo = ref(null)
const routeMembers = ref([])

const todayDisplay = computed(() => dayjs().format('DD MMMM YYYY'))

const fetchRoute = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/route/today', {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    
    zoneInfo.value = res.data.zone
    routeMembers.value = res.data.route.map(m => ({ ...m, showDetails: false }))
  } catch (err) {
    if (err.response?.status !== 404) {
      console.error(err)
    }
  } finally {
    loading.value = false
  }
}

const showSurveyModal = ref(false)
const selectedVisitId = ref(null)
const selectedMemberCode = ref(null)

const openSurvey = (member) => {
  selectedVisitId.value = member.visit_id
  selectedMemberCode.value = member.member_code
  showSurveyModal.value = true
}

const closeSurvey = () => {
  showSurveyModal.value = false
  selectedVisitId.value = null
  selectedMemberCode.value = null
}

const handleSurveySubmit = async () => {
  // Setelah survei sukses, panggil mark api untuk ubah status visited
  try {
    await axios.post('/api/visit/mark', {
      zone_id: zoneInfo.value.id,
      member_code: selectedMemberCode.value
    }, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    
    const target = routeMembers.value.find(m => m.member_code === selectedMemberCode.value)
    if (target) {
      target.visited = true
    }
    closeSurvey()
  } catch (err) {
    alert(err.response?.data?.error || 'Survei tersimpan, namun gagal memperbarui status kunjungan')
  }
}

const markClosed = async (memberCode) => {
  try {
    await axios.post('/api/visit/close', {
      zone_id: zoneInfo.value.id,
      member_code: memberCode
    }, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    
    const target = routeMembers.value.find(m => m.member_code === memberCode)
    if (target) {
      target.visited = true
      target.is_closed = true
    }
  } catch (err) {
    alert(err.response?.data?.error || 'Gagal memperbarui status')
  }
}

const cancelVisit = async (memberCode) => {
  if (!window.confirm('Batalkan kunjungan member ini?')) return
  try {
    await axios.post('/api/visit/cancel', {
      zone_id: zoneInfo.value.id,
      member_code: memberCode
    }, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    
    const target = routeMembers.value.find(m => m.member_code === memberCode)
    if (target) {
      target.visited = false
      target.is_closed = false
      target.visited_at = null
    }
  } catch (err) {
    alert(err.response?.data?.error || 'Gagal membatalkan kunjungan')
  }
}

onMounted(() => {
  fetchRoute()
})

onUnmounted(() => {
  if (map) map.remove()
})
</script>

<style scoped>
.h-full { height: 100%; }
.flex-col { flex-direction: column; }
.overflow-hidden { overflow: hidden; }
.w-1\/3 { width: 33.333333%; }
.opacity-70 { opacity: 0.7; }
.py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
.text-primary { color: var(--pk-primary); }
.font-mono { font-family: monospace; }

/* Tablet */
@media (max-width: 1024px) {
  .salesman-route .flex.gap-6 {
    flex-direction: column !important;
    height: auto !important;
  }
  .salesman-route .w-1\/3 {
    width: 100% !important;
    max-height: 40vh;
    overflow-y: auto;
  }
  #route-map {
    height: 50vh !important;
    min-height: 350px !important;
  }
}

/* Mobile */
@media (max-width: 768px) {
  .salesman-route {
    height: auto !important;
  }
  .salesman-route .flex.gap-6 {
    flex-direction: column !important;
    height: auto !important;
    gap: 12px !important;
  }
  .salesman-route .w-1\/3 {
    width: 100% !important;
    max-height: 45vh;
    padding-right: 0 !important;
  }
  #route-map {
    height: 45vh !important;
    min-height: 280px !important;
  }
  .page-title {
    font-size: 1.25rem;
  }
  .card {
    padding: 12px;
  }
}
</style>
