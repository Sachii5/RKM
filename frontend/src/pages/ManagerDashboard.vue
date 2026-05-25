<template>
  <div class="manager-dashboard">
    <header class="mb-6">
      <h1 class="page-title">Manager Dashboard - Evaluasi Konversi Order</h1>
      <p class="page-subtitle">Ringkasan performa kunjungan dan konversi order tiap salesman per bulan</p>
    </header>

    <div class="card glass mb-6">
      <div class="flex flex-wrap items-end gap-3">
        <div class="flex flex-col">
          <label class="text-xs font-semibold text-gray-600 mb-1">Bulan</label>
          <select v-model="selectedMonth" class="border border-gray-300 rounded-md text-sm py-1.5 px-3 min-w-[120px] bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option v-for="(m, i) in months" :key="i" :value="i + 1">{{ m }}</option>
          </select>
        </div>
        <div class="flex flex-col">
          <label class="text-xs font-semibold text-gray-600 mb-1">Tahun</label>
          <select v-model="selectedYear" class="border border-gray-300 rounded-md text-sm py-1.5 px-3 min-w-[100px] bg-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500">
            <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
          </select>
        </div>
        <div class="flex gap-2">
          <button @click="fetchEvaluation" class="bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md text-sm py-1.5 px-4 transition-colors disabled:opacity-60 shadow-sm flex items-center gap-1" :disabled="loading">
            <i class="fa-solid fa-search text-xs"></i> Tampilkan
          </button>
          <button @click="exportToCSV" class="bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md text-sm py-1.5 px-4 transition-colors disabled:opacity-60 shadow-sm flex items-center gap-1" :disabled="loading || !data.salesmen || data.salesmen.length === 0">
            <i class="fa-solid fa-file-csv text-xs"></i> Export CSV
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="card text-center py-12 text-gray-400">
      <p>Memuat data analitik...</p>
    </div>

    <div v-else-if="!data.salesmen || data.salesmen.length === 0" class="card text-center py-12 text-gray-400">
      <p>Tidak ada data kunjungan untuk bulan ini.</p>
    </div>

    <div v-else class="space-y-6">
      <!-- Chart Section -->
      <div class="card glass">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
          <h3 class="font-bold text-lg text-gray-700">Tren Harian Kunjungan & Closing</h3>
          <div class="form-group mb-0 w-full sm:w-auto mt-2 sm:mt-0">
            <select v-model="selectedSalesmanChart" class="form-control min-w-[150px] py-1 text-sm bg-gray-50">
              <option value="">Semua Salesman</option>
              <option v-for="s in data.salesmen" :key="s.salesman_code" :value="s.salesman_code">{{ s.salesman_code }}</option>
            </select>
          </div>
        </div>
        <div style="position: relative; height: 350px; width: 100%;">
          <Line :data="chartData" :options="chartOptions" v-if="chartData" />
        </div>
      </div>

      <!-- Data Tables -->
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        <!-- Table 1: Performa Kunjungan -->
        <div class="bg-white rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/80 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          <div class="bg-gradient-to-r from-blue-50 to-indigo-50/50 px-6 py-4 border-b border-gray-100">
            <h4 class="font-bold text-gray-800 text-lg flex items-center gap-2">
              <i class="fa-solid fa-route text-blue-500"></i> Performa Kunjungan
            </h4>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-white border-b border-gray-100 uppercase text-[10px] sm:text-xs text-gray-500 tracking-wider">
                  <th class="px-6 py-4 font-bold">Salesman Code</th>
                  <th class="px-6 py-4 font-bold text-center">Total Kunjungan</th>
                  <th class="px-6 py-4 font-bold text-center">Kunjungan Berhasil</th>
                  <th class="px-6 py-4 font-bold text-center">Persentase</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50">
                <tr v-for="(row, idx) in data.salesmen" :key="'t1'+idx" class="bg-white even:bg-gray-50/30 hover:bg-blue-50/40 transition-all duration-200">
                  <td class="px-6 py-4 font-bold text-gray-800 text-sm md:text-base">{{ row.salesman_code }}</td>
                  <td class="px-6 py-4 text-center text-sm font-medium text-gray-500">{{ row.total_assigned }}</td>
                  <td class="px-6 py-4 text-center text-sm font-bold text-blue-600">
                    <div class="bg-blue-100/50 text-blue-700 py-1 px-3 rounded-lg inline-block">{{ row.total_visited }}</div>
                  </td>
                  <td class="px-6 py-4 text-center">
                    <span class="font-bold text-sm px-3 py-1 rounded-full" :class="getSuccessBgColorWithText(row.total_assigned ? Math.round((row.total_visited/row.total_assigned)*100) : 0)">
                      {{ row.total_assigned ? Math.round((row.total_visited/row.total_assigned)*100) : 0 }}%
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Table 2: Performa Closing -->
        <div class="bg-white rounded-2xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100/80 transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          <div class="bg-gradient-to-r from-purple-50 to-fuchsia-50/50 px-6 py-4 border-b border-gray-100">
            <h4 class="font-bold text-gray-800 text-lg flex items-center gap-2">
              <i class="fa-solid fa-handshake text-purple-500"></i> Performa Closing
            </h4>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-white border-b border-gray-100 uppercase text-[10px] sm:text-xs text-gray-500 tracking-wider">
                  <th class="px-6 py-4 font-bold">Salesman Code</th>
                  <th class="px-6 py-4 font-bold text-center">Kunjungan Berhasil</th>
                  <th class="px-6 py-4 font-bold text-center">Closing Order</th>
                  <th class="px-6 py-4 font-bold text-center w-40">Closing Rate</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50">
                <tr v-for="(row, idx) in data.salesmen" :key="'t2'+idx" class="bg-white even:bg-gray-50/30 hover:bg-purple-50/40 transition-all duration-200">
                  <td class="px-6 py-4 font-bold text-gray-800 text-sm md:text-base">{{ row.salesman_code }}</td>
                  <td class="px-6 py-4 text-center text-sm font-bold text-blue-600">{{ row.total_visited }}</td>
                  <td class="px-6 py-4 text-center text-sm font-bold text-purple-600">
                    <div class="bg-purple-100/50 text-purple-700 py-1 px-3 rounded-lg inline-block">{{ row.closing_order }}</div>
                  </td>
                  <td class="px-6 py-4 text-center">
                    <div class="flex flex-col items-center gap-1.5 w-full">
                      <span class="font-bold text-sm" :class="getSuccessColor(row.success_percentage)">
                        {{ row.success_percentage }}%
                      </span>
                      <div class="w-full max-w-[100px] h-2 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                        <div class="h-full rounded-full transition-all duration-700 ease-out" 
                          :class="getSuccessBgColor(row.success_percentage)"
                          :style="{ width: `${Math.min(100, Math.max(0, row.success_percentage))}%` }">
                        </div>
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
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { useAuthStore } from '../stores/auth'
import { Line } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale } from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale)

const auth = useAuthStore()

const months = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]
const currentYear = new Date().getFullYear()
const years = Array.from({length: 5}, (_, i) => currentYear - 2 + i)

const selectedMonth = ref(new Date().getMonth() + 1)
const selectedYear = ref(currentYear)
const selectedSalesmanChart = ref("")

const data = ref({ salesmen: [], daily: [] })
const loading = ref(false)

const chartData = computed(() => {
  if (!data.value.daily || data.value.daily.length === 0) return null;
  
  const aggregated = {}
  data.value.daily.forEach(d => {
    if (selectedSalesmanChart.value && d.salesman_code !== selectedSalesmanChart.value) return;
    if (!aggregated[d.date]) {
      aggregated[d.date] = { date: d.date, total_visited: 0, closing_order: 0 }
    }
    aggregated[d.date].total_visited += d.total_visited
    aggregated[d.date].closing_order += d.closing_order
  })

  // Ensure all dates in month are present (1 to daysInMonth)
  const daysInMonth = new Date(selectedYear.value, selectedMonth.value, 0).getDate();
  const fullMonthData = [];
  for(let i = 1; i <= daysInMonth; i++) {
    const dStr = `${selectedYear.value}-${String(selectedMonth.value).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    fullMonthData.push(aggregated[dStr] || { date: dStr, total_visited: 0, closing_order: 0 })
  }

  return {
    labels: fullMonthData.map(d => parseInt(d.date.split('-')[2])), // Day 1..31
    datasets: [
      {
        label: 'Kunjungan Berhasil',
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        pointBackgroundColor: '#3b82f6',
        tension: 0.3,
        data: fullMonthData.map(d => d.total_visited)
      },
      {
        label: 'Closing Order',
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        pointBackgroundColor: '#8b5cf6',
        tension: 0.3,
        data: fullMonthData.map(d => d.closing_order)
      }
    ]
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: { beginAtZero: true }
  }
}

const fetchEvaluation = async () => {
  loading.value = true
  try {
    const res = await axios.get('/api/analytics/monthly', {
      params: { month: selectedMonth.value, year: selectedYear.value },
      headers: { Authorization: `Bearer ${auth.token}` }
    })
    data.value = res.data
  } catch (err) {
    alert(err.response?.data?.error || 'Gagal memuat data evaluasi')
    data.value = { salesmen: [], daily: [] }
  } finally {
    loading.value = false
  }
}

const getSuccessColor = (pct) => {
  if (pct >= 80) return 'text-emerald-500'
  if (pct >= 50) return 'text-amber-500'
  return 'text-rose-500'
}

const getSuccessBgColor = (pct) => {
  if (pct >= 80) return 'bg-emerald-500'
  if (pct >= 50) return 'bg-amber-500'
  return 'bg-rose-500'
}

const getSuccessBgColorWithText = (pct) => {
  if (pct >= 80) return 'bg-emerald-100/60 text-emerald-700'
  if (pct >= 50) return 'bg-amber-100/60 text-amber-700'
  return 'bg-rose-100/60 text-rose-700'
}

const exportToCSV = () => {
  if (!data.value.salesmen || data.value.salesmen.length === 0) return

  let csvContent = "PERFORMA SALESMAN\n"
  csvContent += "Salesman Code,Total Kunjungan,Kunjungan Berhasil,Persentase Kunjungan (%),Closing Order,Closing Rate (%)\n"
  
  data.value.salesmen.forEach(r => {
    const success_pct = r.total_assigned ? Math.round((r.total_visited/r.total_assigned)*100) : 0
    csvContent += `${r.salesman_code},${r.total_assigned},${r.total_visited},${success_pct},${r.closing_order},${r.success_percentage}\n`
  })

  csvContent += "\n\nTREN HARIAN KUNJUNGAN & CLOSING\n"
  csvContent += "Tanggal,Salesman Code,Kunjungan Berhasil,Closing Order\n"
  
  if (data.value.daily && data.value.daily.length > 0) {
    data.value.daily.forEach(d => {
      csvContent += `${d.date},${d.salesman_code},${d.total_visited},${d.closing_order}\n`
    })
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', `Dashboard_Konversi_${months[selectedMonth.value - 1]}_${selectedYear.value}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

onMounted(() => {
  fetchEvaluation()
})
</script>

<style scoped>
.manager-dashboard {
  animation: fadeIn 0.3s ease;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
