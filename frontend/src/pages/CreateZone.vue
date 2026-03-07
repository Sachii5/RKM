<template>
  <div class="create-zone">
    <header class="mb-8">
      <h1 class="page-title">Zone Assignment</h1>
      <p class="page-subtitle">Find members and assign today's visiting schedule</p>
    </header>

    <div class="grid grid-cols-2 gap-6 mb-8">
      <!-- Radius Form -->
      <div class="card">
        <h2 class="text-lg font-bold mb-4 text-primary">Haversine Radius Search</h2>
        <form @submit.prevent="searchRadius">
          <div class="grid grid-cols-2 gap-4">
            <div class="form-group">
              <label class="form-label">Latitude</label>
              <input v-model="form.lat" type="number" step="any" required class="form-control" placeholder="-6.80961" />
            </div>
            <div class="form-group">
              <label class="form-label">Longitude</label>
              <input v-model="form.lng" type="number" step="any" required class="form-control" placeholder="108.4681" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Radius (km)</label>
            <input v-model="form.radius" type="number" step="0.1" min="0.1" required class="form-control" placeholder="5" />
          </div>
          <button type="submit" class="btn btn-primary" :disabled="loading">Search by Radius</button>
        </form>
      </div>

      <!-- Kelurahan Form -->
      <div class="card">
        <h2 class="text-lg font-bold mb-4 text-secondary">Kelurahan Search</h2>
        <form @submit.prevent="searchKelurahan">
          <div class="form-group">
            <label class="form-label">Kelurahan Name</label>
            <input v-model="form.kelurahan" type="text" required class="form-control uppercase" placeholder="e.g. HARJAMUKTI" />
          </div>
          <button type="submit" class="btn btn-primary" :disabled="loading" style="background-color: var(--pk-secondary);">
            Search by Kelurahan
          </button>
        </form>
      </div>
    </div>

    <!-- Results Table -->
    <div v-if="results.length > 0" class="card mt-6 fade-in glass">
      <div class="flex justify-between items-center mb-6">
        <div>
          <h3 class="font-bold text-lg text-primary">Search Results</h3>
          <p class="text-sm text-gray-500">
            Found {{ totalFound }} members. Limit is 12 per day.
            <span v-if="requiresConfirmation" class="badge badge-warning ml-2">Override Required (>12)</span>
          </p>
        </div>
        <button @click="assignVisits" class="btn btn-success" :disabled="loading">
          Assign {{ results.length }} Members to Today
        </button>
      </div>

      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Member Code</th>
              <th>Name</th>
              <th>Kelurahan</th>
              <th>Phone</th>
              <th v-if="activeTab === 'radius'">Distance (km)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in results" :key="m.cus_kodemember">
              <td><span class="badge badge-gray">{{ m.cus_kodemember }}</span></td>
              <td class="font-bold">{{ m.cus_namamember }}</td>
              <td>{{ m.cus_alamatmember5 }}</td>
              <td>{{ m.cus_hpmember || '-' }}</td>
              <td v-if="activeTab === 'radius'">{{ m.distance_km ? m.distance_km.toFixed(2) : '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    
    <!-- Empty State -->
    <div v-else-if="searched && results.length === 0" class="card mt-6 text-center text-gray-500 py-12">
      No members found matching your criteria.
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import axios from 'axios'
import { useRouter } from 'vue-router'

const auth = useAuthStore()
const router = useRouter()

const form = ref({
  lat: '',
  lng: '',
  radius: '',
  kelurahan: ''
})

const loading = ref(false)
const searched = ref(false)
const results = ref([])
const requiresConfirmation = ref(false)
const totalFound = ref(0)
const activeTab = ref('')
const currentZoneValue = ref('')

const searchRadius = async () => {
  loading.value = true
  searched.value = true
  activeTab.value = 'radius'
  currentZoneValue.value = form.value.radius
  try {
    const res = await axios.post('/api/zone/radius', {
      lat: parseFloat(form.value.lat),
      lng: parseFloat(form.value.lng),
      radius_km: parseFloat(form.value.radius),
      salesman_code: auth.salesmanCode
    })
    
    results.value = res.data.members
    requiresConfirmation.value = res.data.requiresConfirmation
    totalFound.value = res.data.totalFound
  } catch (err) {
    alert(err.response?.data?.error || 'Search error')
  } finally {
    loading.value = false
  }
}

const searchKelurahan = async () => {
  loading.value = true
  searched.value = true
  activeTab.value = 'kelurahan'
  currentZoneValue.value = form.value.kelurahan
  try {
    const res = await axios.post('/api/zone/kelurahan', {
      kelurahan: form.value.kelurahan,
      salesman_code: auth.salesmanCode
    })
    
    results.value = res.data.members
    requiresConfirmation.value = res.data.requiresConfirmation
    totalFound.value = res.data.totalFound
  } catch (err) {
    alert(err.response?.data?.error || 'Search error')
  } finally {
    loading.value = false
  }
}

const assignVisits = async () => {
  if (requiresConfirmation.value) {
    const confirm = window.confirm(`You are assigning ${results.value.length} members which is above the maximum limit of 12. Are you sure?`)
    if (!confirm) return
  }

  loading.value = true
  try {
    await axios.post('/api/visit/assign', {
      salesman_code: auth.salesmanCode,
      members: results.value,
      zone_type: activeTab.value,
      zone_value: currentZoneValue.value
    })
    alert('Visits assigned successfully!')
    router.push('/visits')
  } catch (err) {
    alert(err.response?.data?.error || 'Assignment error')
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.text-primary { color: var(--pk-primary); }
.text-secondary { color: var(--pk-secondary); }
.text-success { color: var(--pk-success); }
.text-lg { font-size: 1.125rem; }
.font-bold { font-weight: 700; }
.uppercase { text-transform: uppercase; }
.btn-success { background-color: var(--pk-success); color: white; }
.btn-success:hover { background-color: #059669; }
.ml-2 { margin-left: 8px; }
.py-12 { padding-top: 48px; padding-bottom: 48px; }
.text-gray-500 { color: var(--pk-text-muted); }
.fade-in { animation: fadeIn 0.3s ease-in; }
</style>
