import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'



const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/farmacia',
      name: 'farmacia',
      component: () => import('../views/Almacenamiento.vue'),
      props: { seccion: 'farmacia', titulo: 'ÁREA DE FARMACIA' }
    },
    {
      path: '/RRHH',
      name: 'RRHH',
      component: () => import('../views/Almacenamiento.vue'),
      props: { seccion: 'rrhh', titulo: 'RECURSOS HUMANOS' }
    },
    {
      path: '/quirofano',
      name: 'quirofano',
      component: () => import('../views/Almacenamiento.vue'), 
      props: { seccion: 'quirofano', titulo: 'ÁREA DE CIRUGÍA' } 
    },
    {
      path: '/login',
      name: 'inicio de sesion',
      component: () => import('../views/login.vue'),
    },
    {
      path: '/hosteleria',
      name: 'hosteleria',
      component: () => import('../views/Almacenamiento.vue'),
      props: { seccion: 'hoteleria', titulo: 'ÁREA DE HOTELERÍA' }
    },
    {
      path: '/sistemas',
      name: 'sistemas',
      component: () => import('../views/Sistemas.vue'),
      props: { seccion: 'sistemas', titulo: 'ÁREA DE SISTEMAS' }
    },
    {
      path: '/servidores',
      name: 'servidores',
      component: () => import('../views/Sistemas.vue'),
      props: { seccion: 'sistemas', titulo: 'ÁREA DE SISTEMAS' },
      alias: ['/servidores']
    },
    {
      path: '/coordinacion',
      name: 'coordinacion',
      component: () => import('../views/Almacenamiento.vue'),
      props: { seccion: 'coordinacion', titulo: 'ÁREA DE GENERALES' }
    },
    {
      path: '/administracion',
      name: 'administracion',
      component: () => import('../views/Administracion.vue'),
      props: { seccion: 'administracion', titulo: 'ÁREA DE ADMINISTRACIÓN' }
    },
    {
      path: '/servicios',
      name: 'servicios',
      component: () => import('../views/Servicios.vue'),
      props: { seccion: 'servicios', titulo: 'ÁREA DE SERVICIOS' }
    },
    {
      path: '/enfermeria',
      name: 'enfermeria',
      component: () => import('../views/Enfermeria.vue'),
      props: { seccion: 'enfermeria', titulo: 'ÁREA DE ENFERMERÍA' }
    },
  ],
})

export default router
