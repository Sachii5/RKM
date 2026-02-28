<template>
  <div class="map-zoning flex h-full" style="height: 100vh;">
    <!-- Sidebar Control Panel -->
    <div class="control-panel w-1/3 p-6 bg-white shadow-md z-10 overflow-y-auto">
      <h2 class="page-title mb-4">Interactive Zoning</h2>
      
      <div class="form-group">
        <label class="form-label">Target Salesman</label>
        <select v-model="form.salesman" class="form-control" @change="fetchMembers">
          <option value="DND">DND</option>
          <option value="DPT">DPT</option>
          <option value="FRL">FRL</option>
          <option value="LID">LID</option>
          <option value="FDL">FDL</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Scheduled Date</label>
        <input v-model="form.date" type="date" class="form-control" required />
      </div>

      <div class="form-group">
        <label class="form-label">Zone Mode</label>
        <select v-model="form.mode" class="form-control" @change="resetPreview">
          <option value="radius">Radius Centered</option>
          <option value="kelurahan">By Kecamatan (Sub-district)</option>
        </select>
      </div>

      <!-- Mode: Radius -->
      <div v-if="form.mode === 'radius'" class="animate-fade-in">
        <div class="card bg-gray-50 mb-6">
          <p class="text-sm text-gray-500 mb-2"><strong>Step 1:</strong> Click anywhere on the map to set the routing center point.</p>
          <div class="grid grid-cols-2 gap-2 text-sm font-mono">
            <div>Lat: {{ form.lat ? form.lat.toFixed(5) : '-' }}</div>
            <div>Lng: {{ form.lng ? form.lng.toFixed(5) : '-' }}</div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Radius (km)</label>
          <input v-model="form.radius" type="number" step="0.1" min="0.1" class="form-control bg-white" placeholder="e.g. 5" />
        </div>
      </div>

      <!-- Mode: Kecamatan -->
      <div v-else class="animate-fade-in">
        <div class="form-group mb-6">
          <label class="form-label">Select Kecamatan</label>
          <select v-model="form.kelurahan" class="form-control bg-white" @change="resetPreview">
            <option value="" disabled>-- Choose Kecamatan --</option>
            <option v-for="kec in availableKecamatans" :key="kec" :value="kec">{{ kec }}</option>
          </select>
        </div>
      </div>

      <button @click="calculateZone" class="btn btn-primary w-full mb-4" :disabled="!isReadyToCalculate || loading">
        {{ loading ? 'Calculating...' : 'Preview Zone Layout' }}
      </button>

      <!-- Results Panel -->
      <div v-if="previewResult" class="results mt-6 animate-fade-in">
        <h3 class="font-bold mb-2">Zone Preview</h3>
        <p class="text-sm mb-4">
          Total Match Found: <strong>{{ previewResult.members.length }}</strong>
        </p>
        
        <div v-if="previewResult.requiresConfirmation" class="bg-yellow-50 text-yellow-800 p-3 rounded mb-4 text-sm border border-yellow-200">
          <strong>Notice:</strong> More than 18 members found. The closest/first 18 have been selected by default. Please check/uncheck to adjust your sequence.
        </div>

        <div v-if="previewResult.members.length > 0" class="mb-4 max-h-60 overflow-y-auto bg-gray-50 rounded p-2 border shadow-inner">
           <div v-for="(m, idx) in previewResult.members" :key="m.cus_kodemember" class="flex items-start gap-2 mb-3 text-sm pb-2 border-b border-gray-200 last:border-0" :class="{'bg-yellow-50': m.is_extra}">
               <input type="checkbox" :id="'chk-'+m.cus_kodemember" :value="m.cus_kodemember" v-model="selectedMemberIds" @change="drawMapEntities" class="mt-1 flex-shrink-0" />
               <label :for="'chk-'+m.cus_kodemember" class="flex-1 cursor-pointer">
                 <div class="font-bold text-gray-800">
                   {{ m.cus_namamember }}
                   <span v-if="m.is_extra" class="ml-1 text-[10px] bg-yellow-200 text-yellow-800 px-1 py-0.5 rounded">OUTSIDE</span>
                 </div>
                 <div class="text-xs text-blue-600 mb-1" v-if="m.distance_km">{{ m.distance_km.toFixed(2) }} km from SPI KUNINGAN</div>
                 <div class="text-xs text-gray-500 line-clamp-2" :title="m.cus_alamatmember5 + ' ' + m.cus_alamatmember4">{{ m.cus_alamatmember5 }}</div>
               </label>
           </div>
        </div>

        <div class="text-sm text-right mb-4 font-bold" :class="selectedMemberIds.length > 18 ? 'text-red-600' : 'text-green-600'">
            Selected: {{ selectedMemberIds.length }} / 18 Quota
        </div>

        <button @click="commitZone" class="btn btn-success w-full" :disabled="committing || selectedMemberIds.length === 0">
          {{ committing ? 'Saving...' : 'Lock Immutable Sequence' }}
        </button>
      </div>
    </div>

    <!-- Map Container -->
    <div id="leaflet-map" class="map-container flex-1 relative" style="height: 100vh; min-height: 500px; z-index: 1;"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import dayjs from 'dayjs'

const auth = useAuthStore()

// Native Leaflet Map Instance
let map = null
let markersLayer = null
let circleLayer = null
let centerMarker = null

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
  grey: createIcon('grey'),
  green: createIcon('green'),
  yellow: createIcon('gold'),
  red: createIcon('red'),
  blue: createIcon('blue')
}

// Form State
const form = ref({
  mode: 'radius',
  salesman: 'DND',
  date: dayjs().format('YYYY-MM-DD'),
  lat: null,
  lng: null,
  radius: 2,
  kelurahan: ''
})

// Data State
const allMembers = ref([])
const zonedMemberCodes = ref(new Set())
const previewResult = ref(null)
const selectedMemberIds = ref([])
const loading = ref(false)
const committing = ref(false)

const availableKecamatans = computed(() => {
  const set = new Set(allMembers.value.map(m => m.cus_kecamatan_surat).filter(Boolean))
  return Array.from(set).sort()
})

const isReadyToCalculate = computed(() => {
  if (form.value.mode === 'radius') {
    return form.value.lat && form.value.lng && form.value.radius > 0
  }
  return !!form.value.kelurahan
})

const parseCoords = (coordStr) => {
  if (!coordStr) return null
  const parts = coordStr.split(',')
  if (parts.length !== 2) return null
  const lat = parseFloat(parts[0])
  const lng = parseFloat(parts[1])
  if (isNaN(lat) || isNaN(lng)) return null
  return { lat, lng }
}

const resetPreview = () => {
  previewResult.value = null
  selectedMemberIds.value = []
  drawMapEntities()
}

const fetchMembers = async () => {
  resetPreview()
  try {
    const [membersRes, zonedRes] = await Promise.all([
      axios.get('http://localhost:3000/api/members', {
        headers: { Authorization: `Bearer ${auth.token}` }
      }),
      axios.get('http://localhost:3000/api/zones/member-codes', {
        headers: { Authorization: `Bearer ${auth.token}` }
      })
    ])
    
    zonedMemberCodes.value = new Set(zonedRes.data)

    const parsed = membersRes.data
      .filter(m => m.cus_nosalesman === form.value.salesman)
      .map(m => ({ ...m, ...parseCoords(m.crm_koordinat) }))
      .filter(m => m.lat !== null)

    allMembers.value = parsed

    if (parsed.length > 0 && map) {
      map.setView([parsed[0].lat, parsed[0].lng], 12)
    }
    drawMapEntities()
  } catch (err) {
    console.error(err)
    alert('Failed to load members')
  }
}

const onMapClick = (e) => {
  if (form.value.mode !== 'radius') return // Map click only sets pin in radius mode
  form.value.lat = e.latlng.lat
  form.value.lng = e.latlng.lng
  resetPreview()
}

const calculateZone = async () => {
  loading.value = true
  try {
    const isRadius = form.value.mode === 'radius'
    const endpoint = isRadius ? '/api/zone/radius' : '/api/zone/kelurahan'
    
    const payload = { salesman_code: form.value.salesman }
    if (isRadius) {
      payload.lat = form.value.lat
      payload.lng = form.value.lng
      payload.radius_km = parseFloat(form.value.radius)
    } else {
      payload.kelurahan = form.value.kelurahan
    }

    const res = await axios.post('http://localhost:3000' + endpoint, payload, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    
    previewResult.value = res.data
    // Pre-check up to 18 automatically
    selectedMemberIds.value = res.data.members.slice(0, 18).map(m => m.cus_kodemember)
    
    drawMapEntities()
  } catch (err) {
    alert(err.response?.data?.error || 'Failed to calculate')
  } finally {
    loading.value = false
  }
}

const commitZone = async () => {
  const finalMembers = previewResult.value.members.filter(m => selectedMemberIds.value.includes(m.cus_kodemember))

  if (finalMembers.length > 18) {
    const conf = window.confirm(`You have selected ${finalMembers.length} members which forcefully exceeds the standard 18 member tracking limit. Proceed?`)
    if (!conf) return
  }

  committing.value = true
  try {
    await axios.post('http://localhost:3000/api/zone/create', {
      salesman_code: form.value.salesman,
      scheduled_date: form.value.date,
      zone_type: form.value.mode,
      center_lat: form.value.lat,
      center_lng: form.value.lng,
      radius_km: parseFloat(form.value.radius),
      kelurahan: form.value.kelurahan,
      members: finalMembers
    }, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    alert('Zone locked and successfully assigned.')
    resetPreview()
  } catch (err) {
    alert(err.response?.data?.error || 'Failed to commit zone')
  } finally {
    committing.value = false
  }
}

const drawMapEntities = () => {
  if (!map) return

  // 1. Clear previous layers safely
  if (markersLayer) markersLayer.clearLayers()
  else markersLayer = L.layerGroup().addTo(map)

  if (centerMarker) {
    map.removeLayer(centerMarker)
    centerMarker = null
  }
  if (circleLayer) {
    map.removeLayer(circleLayer)
    circleLayer = null
  }

  // 2. Draw Center Pin & Radius (ONLY if mode is radius)
  if (form.value.mode === 'radius' && form.value.lat && form.value.lng) {
    centerMarker = L.marker([form.value.lat, form.value.lng], { icon: icons.red })
      .bindPopup("Route Center")
      .addTo(map)
      
    if (form.value.radius > 0) {
      circleLayer = L.circle([form.value.lat, form.value.lng], {
        radius: form.value.radius * 1000,
        color: '#4F46E5',
        fillColor: '#4F46E5',
        fillOpacity: 0.1
      }).addTo(map)
    }
  } else if (form.value.mode === 'kelurahan') {
    // SPI Kuningan Custom Reference Center for Kecamatan
    centerMarker = L.marker([-6.945995100429211, 108.4892379767215], { icon: icons.red })
      .bindPopup("<strong>SPI KUNINGAN</strong><br/>(Reference Centerpoint)")
      .addTo(map)
  }

  // 3. Define mapping logic arrays
  let dGrey = allMembers.value
  let dBlue = []  // already zoned
  let dGreen = []
  let dYellow = []

  if (previewResult.value) {
    if (form.value.mode === 'kelurahan') {
      dGreen = previewResult.value.members.filter(m => selectedMemberIds.value.includes(m.cus_kodemember) && !m.is_extra)
      dYellow = previewResult.value.members.filter(m => selectedMemberIds.value.includes(m.cus_kodemember) && m.is_extra)
      
      const activeIds = [...dGreen, ...dYellow].map(m => m.cus_kodemember)
      const rest = allMembers.value.filter(m => !activeIds.includes(m.cus_kodemember))
      dBlue = rest.filter(m => zonedMemberCodes.value.has(m.cus_kodemember))
      dGrey = rest.filter(m => !zonedMemberCodes.value.has(m.cus_kodemember))
    } else {
      dGreen = previewResult.value.members.filter(m => selectedMemberIds.value.includes(m.cus_kodemember))
      dYellow = previewResult.value.members.filter(m => !selectedMemberIds.value.includes(m.cus_kodemember))
      
      const activeIds = previewResult.value.members.map(m => m.cus_kodemember)
      const rest = allMembers.value.filter(m => !activeIds.includes(m.cus_kodemember))
      dBlue = rest.filter(m => zonedMemberCodes.value.has(m.cus_kodemember))
      dGrey = rest.filter(m => !zonedMemberCodes.value.has(m.cus_kodemember))
    }
  } else {
    // No preview yet — show blue for zoned, grey for available
    dBlue = allMembers.value.filter(m => zonedMemberCodes.value.has(m.cus_kodemember))
    dGrey = allMembers.value.filter(m => !zonedMemberCodes.value.has(m.cus_kodemember))
  }

  // Helper inside to draw markers dynamically
  const addTarget = (m, iconDef, label) => {
    const distText = m.distance_km ? `<br/><small class="text-blue-600">${m.distance_km.toFixed(2)} km from center</small>` : ''
    L.marker([m.lat, m.lng], { icon: iconDef })
      .bindPopup(`<strong>${m.cus_namamember}</strong><br/>${label}${distText}`)
      .addTo(markersLayer)
  }

  dBlue.forEach(m => addTarget(m, icons.blue, "(Sudah Masuk Zona)"))
  if (form.value.mode === 'kelurahan') {
    dGrey.forEach(m => addTarget(m, icons.grey, "(Tersedia)"))
    dGreen.forEach(m => addTarget(m, icons.green, "(Terpilih - Dalam Kecamatan)"))
    dYellow.forEach(m => addTarget(m, icons.yellow, "(Terpilih - Luar Kecamatan)"))
  } else {
    dGrey.forEach(m => addTarget(m, icons.grey, "(Tersedia)"))
    dGreen.forEach(m => addTarget(m, icons.green, "(Terpilih untuk Zona)"))
    dYellow.forEach(m => addTarget(m, icons.yellow, "(Tidak Terpilih)"))
  }
  
  if (form.value.mode === 'kelurahan' && dGreen.length > 0) {
    const bounds = L.latLngBounds(previewResult.value.members.map(m => [m.lat, m.lng]))
    map.fitBounds(bounds, { padding: [50, 50] })
  }
}

// Boot Map using Vanilla Leaflet binding tightly to a generic div ID seamlessly bypassing buggy vue-wrappers.
onMounted(() => {
  map = L.map('leaflet-map').setView([-6.7320, 108.5523], 12)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map)

  map.on('click', onMapClick)

  setTimeout(() => {
    map.invalidateSize()
    fetchMembers()
  }, 200)
})

onUnmounted(() => {
  if (map) {
    map.remove()
  }
})

// Trigger invalidation on radius adjustments automatically
watch(() => form.value.radius, () => drawMapEntities())
</script>

<style scoped>
.h-full { height: calc(100vh - 80px); }
.w-full { width: 100%; }
.w-1\/3 { width: 33.333333%; }
.flex-1 { flex: 1; }
.p-6 { padding: 1.5rem; }
.bg-white { background-color: white; }
.shadow-md { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
.overflow-y-auto { overflow-y: auto; }
.relative { position: relative; }
.bg-gray-50 { background-color: #F9FAFB; }
.bg-yellow-50 { background-color: #FEFCE8; }
.text-yellow-800 { color: #854D0E; }
.border-yellow-200 { border-color: #FEF08A; }
.rounded { border-radius: 0.25rem; }
.p-3 { padding: 0.75rem; }

/* Enforcing Leaflet global UI bounds */
#leaflet-map {
  outline: none;
  background: #f8f9fa;
}

/* Tablet */
@media (max-width: 1024px) {
  .map-zoning {
    flex-direction: column !important;
    height: auto !important;
  }
  .control-panel {
    width: 100% !important;
    max-height: 50vh;
    overflow-y: auto;
  }
  #leaflet-map {
    height: 50vh !important;
    min-height: 350px !important;
  }
}

/* Mobile */
@media (max-width: 768px) {
  .map-zoning {
    flex-direction: column !important;
    height: auto !important;
  }
  .control-panel {
    width: 100% !important;
    padding: 1rem !important;
    max-height: 45vh;
  }
  #leaflet-map {
    height: 55vh !important;
    min-height: 300px !important;
  }
  .page-title {
    font-size: 1.25rem;
  }
}
</style>
