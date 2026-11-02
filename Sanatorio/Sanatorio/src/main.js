import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { clerkPlugin } from '@clerk/vue'

// Importación de estilos corregida
import './assets/main.css'
// ❌ Borramos o comentamos la línea de abajo porque no existe el archivo:
// import './style.css' 

// Pega aquí tu clave real (asegúrate de que empiece con pk_test_)
const PUBLISHABLE_KEY = "pk_test_c3BsZW5kaWQta2l3aS00OC5jbGVyay5hY2NvdW50cy5kZXYk" 

const app = createApp(App)

app.use(router)

// Le agregamos opciones extra al plugin para forzarlo a usar el entorno correcto
app.use(clerkPlugin, { 
  publishableKey: PUBLISHABLE_KEY,
  options: {
    clerkJSUrl: 'https://unpkg.com/@clerk/clerk-js@6/dist/clerk.browser.js'
  }
})

app.mount('#app')