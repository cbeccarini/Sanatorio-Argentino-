<script setup>
import { ref, onMounted } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import HelloWorld from './components/HelloWorld.vue'
import logoSanatorio from './images/Logo_Sanatorio.png'
// Traemos useUser junto con los componentes de Clerk
import { Show, SignInButton, SignUpButton, UserButton, SignIn, useUser } from '@clerk/vue'

const { user } = useUser()

// --- INTEGRACIÓN MODO OSCURO ---
const esOscuro = ref(false)

const toggleModo = () => {
  esOscuro.value = !esOscuro.value
  if (esOscuro.value) {
    document.documentElement.setAttribute('data-theme', 'dark')
    localStorage.setItem('theme', 'dark')
  } else {
    document.documentElement.removeAttribute('data-theme')
    localStorage.setItem('theme', 'light')
  }
}

onMounted(() => {
  const temaGuardado = localStorage.getItem('theme')
  const prefiereOscuro = window.matchMedia('(prefers-color-scheme: dark)').matches

  if (temaGuardado === 'dark' || (!temaGuardado && prefiereOscuro)) {
    esOscuro.value = true
    document.documentElement.setAttribute('data-theme', 'dark')
  } else {
    esOscuro.value = false
    document.documentElement.removeAttribute('data-theme')
  }
})
</script>

<template>
  <header class="main-header">
    <div class="wrapper">
      <div class="brand">
        <img class="brand-logo" :src="logoSanatorio" alt="Sanatorio" />
      </div>

      <nav class="nav-links">
        <RouterLink to="/">Inicio</RouterLink>

        <!-- SECCIÓN INTEGRADA: Solo se muestra si el usuario inició sesión -->
        <Show when="signed-in">
          <div v-if="user" class="mini-tarjeta-usuario-nav">
            <span class="avatar-nav">👤</span>
            <div class="info-nav">
              <span class="email-nav">{{ user.primaryEmailAddress?.emailAddress }}</span>
              <span class="badge-rol-nav">{{ user.publicMetadata?.role || 'EMPLEADO' }}</span>
              <span class="badge-seccion-nav">{{ user.publicMetadata?.seccion || 'FARMACIA' }}</span>
            </div>
          </div>
        </Show>
      </nav>
    </div>

    <div class="header-clerk">
      <!-- BOTÓN INTERRUPTOR MODO OSCURO -->
      <button @click="toggleModo" class="btn-theme" type="button">
        <span v-if="esOscuro">☀️ Claro</span>
        <span v-else>🌙 Oscuro</span>
      </button>

      <Show when="signed-out">
        <SignInButton class="btn-login">
          Iniciar sesión
        </SignInButton>
        <SignUpButton class="btn-register">
          Registrarse
        </SignUpButton>
      </Show>
      
      <Show when="signed-in">
        <UserButton />
      </Show>
    </div>
  </header>

  <RouterView />
</template>

<style scoped>
/* ==========================================================================
   HEADER PRINCIPAL (Tu diseño original intacto)
   ========================================================================== */
.main-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 30px;
  background: linear-gradient(135deg, #1e40af 0%, #0284c7 100%); 
  box-shadow: 0 4px 12px rgba(30, 64, 175, 0.15);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

/* El estilo del nuevo botón adaptado a tu barra azul */
.btn-theme {
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #ffffff;
  padding: 8px 18px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  margin-right: 10px;
}
.btn-theme:hover {
  background: rgba(255, 255, 255, 0.25);
  border-color: #ffffff;
  transform: translateY(-1px);
}

/* ==========================================================================
   ENLACES DE NAVEGACIÓN Y RECUADRO INTEGRADO
   ========================================================================== */
.brand {
  display: flex;
  align-items: center;
}

.brand-logo {
  width: 58px;
  height: 58px;
  object-fit: contain;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.95);
  padding: 4px;
  margin-right: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.nav-links {
  display: flex;
  align-items: center; 
  gap: 15px;
}

.nav-links a {
  text-decoration: none;
  color: #ffffff;
  font-weight: 600;
  font-size: 0.9rem;
  padding: 8px 18px;
  background: rgba(255, 255, 255, 0.12); 
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 8px; 
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.nav-links a:hover {
  background: rgba(255, 255, 255, 0.25);
  border-color: #ffffff;
  transform: translateY(-1px); 
}

.mini-tarjeta-usuario-nav {
  display: flex;
  align-items: center;
  gap: 10px;
  background-color: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 6px 14px;
  border-radius: 30px; 
  color: white;
  font-size: 0.85rem;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.05);
}

.avatar-nav {
  font-size: 1rem;
}

.info-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.email-nav {
  font-weight: 500;
  color: rgba(255, 255, 255, 0.95);
}

.badge-rol-nav {
  background-color: #2b6cb0;
  color: white;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.badge-seccion-nav {
  background-color: #4a5568;
  color: white;
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

/* ==========================================================================
   CONTENEDOR Y BOTONES DE CLERK (Derecha)
   ========================================================================== */
.header-clerk {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.btn-login {
  background-color: transparent;
  border: 1px solid rgba(255, 255, 255, 0.45);
  color: #ffffff;
  padding: 9px 20px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.92rem;
  letter-spacing: 0.2px;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-login:hover {
  background-color: rgba(255, 255, 255, 0.18);
  border-color: #ffffff;
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
}

.btn-register {
  background-color: #ffffff; 
  color: #1e40af; 
  border: 1px solid #ffffff;
  padding: 9px 22px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 700;
  font-size: 0.92rem;
  letter-spacing: 0.2px;
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.12);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

.btn-register:hover {
  background-color: #f8fafc;
  border-color: #f8fafc;
  color: #1d4ed8;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.18);
  transform: translateY(-1px);
}

@media (max-width: 820px) {
  .header-clerk {
    gap: 8px;
  }
  .btn-login, .btn-register {
    padding: 8px 14px;
    font-size: 0.85rem;
  }
}

/* ==========================================================================
   ESTILOS BASE DE VUE
   ========================================================================== */
header {
  line-height: 1.5;
}

nav {
  width: auto;
  margin-top: 0;
}

@media (min-width: 1024px) {
  header .wrapper {
    display: flex;
    place-items: center;
    flex-wrap: wrap;
  }
}
</style>