<template>
  <div class="map-zoning flex h-full" style="height: 100vh;">
    <!-- Sidebar Control Panel -->
    <div class="control-panel w-1/3 p-6 bg-white shadow-md z-10 overflow-y-auto">
      <h2 class="page-title mb-4">Buat Rute RKM</h2>
      
      <div class="form-group">
        <label class="form-label">Target Salesman</label>
        <select v-model="form.salesman" class="form-control" @change="fetchMembers">
          <option value="DND">DND</option>
          <option value="DPT">DPT</option>
          <option value="FRL">FRL</option>
          <option value="LID">LID</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Tanggal Kunjungan</label>
        <input v-model="form.date" type="date" class="form-control" required />
      </div>

      <div class="form-group">
        <label class="form-label">Mode</label>
        <select v-model="form.mode" class="form-control" @change="resetPreview">
          <option value="radius">Berdasarkan Radius</option>
          <option value="kelurahan">Berdasarkan Kecamatan</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      <!-- Mode: Radius -->
      <div v-if="form.mode === 'radius'" class="animate-fade-in">
        <div class="card bg-gray-50 mb-6">
          <p class="text-sm text-gray-500 mb-2"><strong>Langkah 1:</strong> Klik di sembarang tempat pada peta untuk menentukan titik koordinat rute.</p>
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
      <div v-else-if="form.mode === 'kelurahan'" class="animate-fade-in">
        <div class="form-group mb-6">
          <label class="form-label">Pilih Kecamatan</label>
          <select v-model="form.kelurahan" class="form-control bg-white" @change="resetPreview">
            <option value="" disabled>-- Pilih Kecamatan --</option>
            <option v-for="kec in availableKecamatans" :key="kec" :value="kec">{{ kec }}</option>
          </select>
        </div>
      </div>

      <!-- Mode: Manual -->
      <div v-else-if="form.mode === 'manual'" class="animate-fade-in card bg-gray-50 mb-6">
          <p class="text-sm text-gray-500"><strong>Mode Manual:</strong> Klik tombol mulai di bawah, lalu pilih member langsung dari peta dengan mengklik pin abu-abu yang tersedia.</p>
      </div>

      <button @click="calculateZone" class="btn btn-primary w-full mb-4" :disabled="!isReadyToCalculate || loading">
        {{ loading ? 'Memproses...' : (form.mode === 'manual' ? 'Mulai Pilih Manual' : 'Pratinjau Anggota Zona') }}
      </button>

      <!-- Results Panel -->
      <div v-if="previewResult" class="results mt-6 animate-fade-in">
        <h3 class="font-bold mb-2">Preview Zona</h3>
        <p class="text-sm mb-4">
          Total ditemukan: <strong>{{ previewResult.members.length }}</strong>
        </p>
        
        <div v-if="previewResult.requiresConfirmation" class="bg-yellow-50 text-yellow-800 p-3 rounded mb-4 text-sm border border-yellow-200">
          <strong>Perhatian:</strong> Lebih dari 18 member ditemukan. 18 terdekat telah dipilih otomatis. Sesuaikan dengan centang/hapus centang.
        </div>

        <div v-if="previewResult.members.length > 0" class="mb-4 preview-table-wrap">
          <table class="preview-table">
            <thead>
              <tr>
                <th class="col-chk">✓</th>
                <th class="col-no">No</th>
                <th class="col-name">Nama Member</th>
                <th class="col-code">Kode</th>
                <th class="col-dist">Jarak</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(m, idx) in previewResult.members" :key="m.cus_kodemember"
                  :class="{'row-extra': m.is_extra, 'row-selected': selectedMemberIds.includes(m.cus_kodemember)}">
                <td class="col-chk">
                  <input type="checkbox" :id="'chk-'+m.cus_kodemember" :value="m.cus_kodemember" 
                         v-model="selectedMemberIds" @change="drawMapEntities(true)" />
                </td>
                <td class="col-no">{{ idx + 1 }}</td>
                <td class="col-name">
                  {{ m.cus_namamember }}
                  <span v-if="m.is_extra" class="badge-outside">LUAR</span>
                </td>
                <td class="col-code">{{ m.cus_kodemember }}</td>
                <td class="col-dist">{{ m.distance_km ? m.distance_km.toFixed(1) + ' km' : '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="text-sm text-right mb-4 font-bold" :class="selectedMemberIds.length > 18 ? 'text-red-600' : 'text-green-600'">
            Terpilih: {{ selectedMemberIds.length }} / 18 Kuota
        </div>

        <button @click="commitZone" class="btn btn-success w-full" :disabled="committing || selectedMemberIds.length === 0">
          {{ committing ? 'Menyimpan...' : 'Simpan dan Tugaskan Zona' }}
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
  if (form.value.mode === 'kelurahan') return !!form.value.kelurahan
  return true // manual mode is always ready
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
      axios.get('/api/members', {
        headers: { Authorization: `Bearer ${auth.token}` }
      }),
      axios.get('/api/zones/member-codes', {
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
    alert('Gagal memuat data pelanggan')
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
    if (form.value.mode === 'manual') {
      previewResult.value = { members: [], requiresConfirmation: false }
      selectedMemberIds.value = []
      drawMapEntities()
      loading.value = false
      return
    }

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

    const res = await axios.post(endpoint, payload, {
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    
    previewResult.value = res.data
    // Pre-check up to 18 automatically
    selectedMemberIds.value = res.data.members.slice(0, 18).map(m => m.cus_kodemember)
    
    drawMapEntities()
  } catch (err) {
    alert(err.response?.data?.error || 'Proses gagal dilakukan')
  } finally {
    loading.value = false
  }
}

const commitZone = async () => {
  const finalMembers = previewResult.value.members.filter(m => selectedMemberIds.value.includes(m.cus_kodemember))

  if (finalMembers.length > 18) {
    const conf = window.confirm(`Anda telah memilih ${finalMembers.length} pelanggan yang melampaui standar batas pemantauan rute harian (18 pelanggan). Apakah Anda tetap ingin melanjutkan?`)
    if (!conf) return
  }

  committing.value = true
  try {
    await axios.post('/api/zone/create', {
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
    alert('Zona berhasil dikunci dan ditugaskan.')
    resetPreview()
  } catch (err) {
    alert(err.response?.data?.error || 'Gagal menyimpan dan menugaskan zona')
  } finally {
    committing.value = false
  }
}

const drawMapEntities = (skipFitBounds = false) => {
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

  // Sync preview table for manual mode based on current selections
  if (form.value.mode === 'manual' && previewResult.value) {
    const selectedSet = new Set(selectedMemberIds.value)
    previewResult.value.members = allMembers.value.filter(m => selectedSet.has(m.cus_kodemember))
  }

  // 3. Define 3 pin groups: green (selected), grey (not selected), blue (already zoned)
  let dGrey = []
  let dBlue = []
  let dGreen = []

  if (previewResult.value) {
    // Any member that is selected (checked) → green, regardless of origin
    const selectedSet = new Set(selectedMemberIds.value)
    dGreen = allMembers.value.filter(m => selectedSet.has(m.cus_kodemember))
    
    // Remaining → blue (already zoned) or grey (available)
    const rest = allMembers.value.filter(m => !selectedSet.has(m.cus_kodemember))
    dBlue = rest.filter(m => zonedMemberCodes.value.has(m.cus_kodemember))
    dGrey = rest.filter(m => !zonedMemberCodes.value.has(m.cus_kodemember))
  } else {
    // No preview yet
    dBlue = allMembers.value.filter(m => zonedMemberCodes.value.has(m.cus_kodemember))
    dGrey = allMembers.value.filter(m => !zonedMemberCodes.value.has(m.cus_kodemember))
  }

  // Global handler for popup button clicks (Leaflet popups are raw HTML, no Vue bindings)
  window.__zoningAction = (memberCode, action) => {
    if (action === 'add') {
      if (!selectedMemberIds.value.includes(memberCode)) {
        selectedMemberIds.value.push(memberCode)
      }
    } else if (action === 'remove') {
      selectedMemberIds.value = selectedMemberIds.value.filter(id => id !== memberCode)
    }
    drawMapEntities(true)
  }

  // Helper: build popup HTML with interactive button
  const buildPopup = (m, label) => {
    const isSelected = selectedMemberIds.value.includes(m.cus_kodemember)
    const isZoned = zonedMemberCodes.value.has(m.cus_kodemember)
    const hasPreview = !!previewResult.value

    let html = `<div style="min-width:180px;font-family:Inter,sans-serif;">
      <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${m.cus_namamember}</div>
      <div style="font-size:11px;color:#6b7280;margin-bottom:6px;font-family:monospace;">${m.cus_kodemember}</div>
      <div style="font-size:11px;color:#9ca3af;margin-bottom:8px;">${label}</div>`

    if (hasPreview && !isZoned) {
      if (isSelected) {
        html += `<button onclick="window.__zoningAction('${m.cus_kodemember}','remove')" 
          style="width:100%;padding:6px 0;border:none;border-radius:6px;background:#ef4444;color:#fff;font-weight:600;font-size:12px;cursor:pointer;">
          ✕ Hapus dari Zona
        </button>`
      } else {
        html += `<button onclick="window.__zoningAction('${m.cus_kodemember}','add')" 
          style="width:100%;padding:6px 0;border:none;border-radius:6px;background:#10b981;color:#fff;font-weight:600;font-size:12px;cursor:pointer;">
          ＋ Tambah ke Zona
        </button>`
      }
    }

    html += `</div>`
    return html
  }

  // Draw markers — only 3 colors
  dBlue.forEach(m => {
    L.marker([m.lat, m.lng], { icon: icons.blue })
      .bindPopup(buildPopup(m, '🔵 Sudah masuk zona lain'))
      .addTo(markersLayer)
  })
  dGrey.forEach(m => {
    L.marker([m.lat, m.lng], { icon: icons.grey })
      .bindPopup(buildPopup(m, '⚪ Belum dipilih'))
      .addTo(markersLayer)
  })
  dGreen.forEach(m => {
    L.marker([m.lat, m.lng], { icon: icons.green })
      .bindPopup(buildPopup(m, '🟢 Terpilih ke zona'))
      .addTo(markersLayer)
  })
  
  if (!skipFitBounds && form.value.mode === 'kelurahan' && dGreen.length > 0) {
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

/* Preview Table */
.preview-table-wrap {
  max-height: 300px;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fafafa;
}
.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}
.preview-table thead {
  position: sticky;
  top: 0;
  z-index: 2;
}
.preview-table th {
  background: #f3f4f6;
  padding: 6px 8px;
  text-align: left;
  font-weight: 700;
  font-size: 0.7rem;
  color: #6b7280;
  text-transform: uppercase;
  border-bottom: 2px solid #e5e7eb;
  white-space: nowrap;
}
.preview-table td {
  padding: 6px 8px;
  border-bottom: 1px solid #f3f4f6;
  vertical-align: middle;
}
.preview-table tbody tr:hover {
  background: #f0f4ff;
}
.row-selected {
  background: #ecfdf5 !important;
}
.row-extra {
  background: #fefce8 !important;
}
.col-chk { width: 30px; text-align: center; }
.col-no { width: 30px; text-align: center; color: #9ca3af; }
.col-name { min-width: 120px; font-weight: 600; color: #1f2937; }
.col-code { font-family: monospace; font-size: 0.7rem; color: #6b7280; white-space: nowrap; }
.col-dist { white-space: nowrap; color: #3b82f6; font-size: 0.7rem; }
.badge-outside {
  display: inline-block;
  font-size: 9px;
  background: #fde68a;
  color: #854d0e;
  padding: 1px 5px;
  border-radius: 4px;
  margin-left: 4px;
  vertical-align: middle;
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
  .preview-table-wrap {
    max-height: 200px;
  }
  .preview-table th, .preview-table td {
    padding: 4px 6px;
    font-size: 0.7rem;
  }
  .col-name { min-width: 90px; }
}
</style>
