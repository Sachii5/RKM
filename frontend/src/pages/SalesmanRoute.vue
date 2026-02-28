<template>
  <div class="salesman-route flex flex-col h-full" style="height: 100vh;">
    <header class="mb-4">
      <h1 class="page-title">Today's Optimized Route</h1>
      <p class="page-subtitle text-gray-500">
        {{ routeMembers.length }} Members scheduled for <strong class="text-primary">{{ todayDisplay }}</strong>
      </p>
    </header>

    <div v-if="loading" class="text-center py-12 text-gray-500">
      Loading your geographical constraints...
    </div>
    
    <div v-else-if="routeMembers.length === 0" class="card glass text-center py-12 text-gray-500">
      No route mapped for today. Please contact your supervisor.
    </div>

    <div v-else class="flex gap-6 h-full" style="height: 75vh;">
      
      <!-- List View -->
      <div class="w-1/3 overflow-y-auto pr-2">
        <div 
          v-for="(member, idx) in routeMembers" 
          :key="member.member_code"
          class="card mb-4 relative"
          :class="{ 'opacity-70 bg-gray-50': member.visited === 1 }"
        >
          <div class="absolute top-4 right-4">
             <span v-if="member.visited" class="badge badge-success">VISITED</span>
             <span v-else class="badge badge-warning text-white">#{{ idx + 1 }}</span>
          </div>
          
          <h3 class="font-bold text-lg mb-1 cursor-pointer hover:text-primary transition-colors duration-200" @click="member.showDetails = !member.showDetails">
            {{ member.member_name || 'Unknown' }}
            <span v-if="!member.showDetails" class="ml-2 text-xs text-blue-500 font-normal">(View Details)</span>
          </h3>
          <p class="text-xs text-gray-500 font-mono mb-2">{{ member.member_code }}</p>
          <p class="text-sm text-gray-600 mb-2">{{ member.alamat_snapshot }}</p>
          
          <div v-show="member.showDetails" class="bg-white p-3 rounded mb-4 text-sm mt-2 border shadow-sm animate-fade-in">
             <div class="mb-1"><strong class="text-gray-700">Phone HT:</strong> <a :href="'tel:'+member.hp_snapshot" class="text-blue-600 hover:underline">{{ member.hp_snapshot || '-' }}</a></div>
             <div><strong class="text-gray-700">Email:</strong> <a :href="'mailto:'+member.email_snapshot" class="text-blue-600 hover:underline">{{ member.email_snapshot || '-' }}</a></div>
          </div>
          
          <button 
            v-if="member.visited === 0" 
            @click="markVisited(member.member_code)" 
            class="btn btn-primary w-full text-sm py-2"
          >
            Tandai Dikunjungi
          </button>
          <button 
            v-if="member.visited === 1" 
            @click="cancelVisit(member.member_code)" 
            class="btn btn-outline w-full text-sm py-2" 
            style="border-color: var(--pk-danger); color: var(--pk-danger);"
          >
            Batalkan Kunjungan
          </button>
        </div>
      </div>

      <!-- Map View -->
      <div id="route-map" class="flex-1 map-container shadow-md border rounded overflow-hidden" style="height: 100%; min-height: 500px; z-index: 1;"></div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import dayjs from 'dayjs'

const auth = useAuthStore()
const loading = ref(true)

const zoneInfo = ref(null)
const routeMembers = ref([])

let map = null
let routeLayer = null

// CDN Marker Icons
const createIcon = (color) => L.icon({
  iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

const icons = {
  blue: createIcon('blue'),
  green: createIcon('green')
}

const todayDisplay = computed(() => dayjs().format('DD MMMM YYYY'))

const activeCoords = computed(() => {
  return routeMembers.value.filter(m => m.lat !== null && m.lng !== null)
})

const fetchRoute = async () => {
  loading.value = true
  try {
    const res = await axios.get('http://localhost:3000/api/route/today', {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    
    zoneInfo.value = res.data.zone
    routeMembers.value = res.data.route.map(m => ({ ...m, showDetails: false }))

    await nextTick()
    initMap()
  } catch (err) {
    if (err.response?.status !== 404) {
      console.error(err)
    }
    loading.value = false
  }
}

const initMap = () => {
  loading.value = false
  const mapElement = document.getElementById('route-map')
  if (!mapElement) return

  let startCenter = [-6.7320, 108.5523]
  if (activeCoords.value.length > 0) {
    startCenter = [activeCoords.value[0].lat, activeCoords.value[0].lng]
  }

  map = L.map('route-map').setView(startCenter, 13)
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map)

  drawRoute()
}

const drawRoute = () => {
  if (!map) return

  if (routeLayer) routeLayer.clearLayers()
  else routeLayer = L.layerGroup().addTo(map)

  // 1. Draw Polyline
  const polyCoords = activeCoords.value.map(m => [m.lat, m.lng])
  if (polyCoords.length > 1) {
    L.polyline(polyCoords, {
      color: '#4F46E5',
      weight: 3,
      opacity: 0.8
    }).addTo(routeLayer)
  }

  // 2. Add Markers
  activeCoords.value.forEach((m, idx) => {
    L.marker([m.lat, m.lng], {
      icon: m.visited === 1 ? icons.green : icons.blue
    })
    .bindPopup(`<strong>#${idx + 1} ${m.member_name}</strong><br/>${m.visited ? 'Already Visited' : 'Pending'}`)
    .addTo(routeLayer)
  })

  // Fit bounds natively to route
  if (polyCoords.length > 0) {
    map.fitBounds(polyCoords, { padding: [50, 50] })
  }
}

const markVisited = async (memberCode) => {
  try {
    await axios.post('http://localhost:3000/api/visit/mark', {
      zone_id: zoneInfo.value.id,
      member_code: memberCode
    }, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    
    const target = routeMembers.value.find(m => m.member_code === memberCode)
    if (target) {
      target.visited = 1
    }
    drawRoute()
  } catch (err) {
    alert(err.response?.data?.error || 'Gagal memperbarui status')
  }
}

const cancelVisit = async (memberCode) => {
  if (!window.confirm('Batalkan kunjungan member ini?')) return
  try {
    await axios.post('http://localhost:3000/api/visit/cancel', {
      zone_id: zoneInfo.value.id,
      member_code: memberCode
    }, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    
    const target = routeMembers.value.find(m => m.member_code === memberCode)
    if (target) {
      target.visited = 0
      target.visited_at = null
    }
    drawRoute()
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
