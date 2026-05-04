import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'

import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, ScatterChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  MarkLineComponent,
  MarkAreaComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  ScatterChart,
  GridComponent,
  TooltipComponent,
  TitleComponent,
  LegendComponent,
  MarkLineComponent,
  MarkAreaComponent,
])

const app = createApp(App)

app.component('VChart', VChart)

app.use(createPinia())
app.use(router)
app.use(Antd)

app.mount('#app')
