<script setup>
// Importamos los componentes necesarios de Clerk para esta vista
import { SignIn, Show } from '@clerk/vue'
</script>

<template>
  <div class="login-container">
    <Show when="signed-out">
      <h2 class="login-title">Ingreso al sistema del Sanatorio Argentino</h2>
      <SignIn />
    </Show>

    <Show when="signed-in">
      <div class="already-logged">
        <h3>¡Ya estás dentro del sistema!</h3>
        <p>Utiliza la barra de navegación superior para ir al inicio.</p>
      </div>
    </Show>
  </div>
</template>

<style scoped>
/* Estilos para centrar la tarjeta de Clerk perfectamente en la pantalla */
.login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 70vh; /* Ocupa buena parte de la pantalla vertical */
  padding: 20px;
}

.login-title {
  margin-bottom: 25px;
  color: #333;
  font-family: sans-serif;
}

.already-logged {
  text-align: center;
  padding: 30px;
  background-color: #d4edda;
  color: #155724;
  border-radius: 8px;
}
</style>