import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'
import '@/assets/main.css'
import AdminApp from './AdminApp.vue'

createApp(AdminApp).use(Antd).mount('#app')
