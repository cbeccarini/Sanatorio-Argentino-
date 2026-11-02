<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="container-main">
    <div class="cards-grid">
      
      <div class="card-item">
        <div class="card-icon-wrapper">
          <img src="../images/farmacia.png" class="custom-card-img" alt="Icono de Farmacia">
        </div>
        <div class="card-body">
          <h5 class="card-title">FARMACIA</h5>
          <p class="card-text">Solo personal de Farmacia.</p>
          <RouterLink to="/farmacia" class="btn-router">Ir a Farmacia</RouterLink>
        </div>
      </div>

      <div class="card-item">
        <div class="card-icon-wrapper">
          <img src="../images/RRHH.png" class="custom-card-img" alt="Recursos Humanos">
        </div>
        <div class="card-body">
          <h5 class="card-title">RECURSOS HUMANOS</h5>
          <p class="card-text">Solo personal de Recursos Humanos.</p>
          <RouterLink to="/rrhh" class="btn-router">Ir a RRHH</RouterLink>
        </div>
      </div>

      <div class="card-item">
        <div class="card-icon-wrapper">
          <img src="../images/QX.png" class="custom-card-img" alt="Cirugía">
        </div>
        <div class="card-body">
          <h5 class="card-title">CIRUGÍA</h5>
          <p class="card-text">Solo personal de Cirugía.</p>
          <RouterLink to="/quirofano" class="btn-router">Ir a Cirugía</RouterLink>
        </div>
      </div>

      <div class="card-item">
        <div class="card-icon-wrapper">
          <img src="../images/Limpieza.png" class="custom-card-img" alt="Hosteleria">
        </div>
        <div class="card-body">
          <h5 class="card-title">HOTELERÍA</h5>
          <p class="card-text">Solo personal de Hotelería.</p>
          <RouterLink to="/hosteleria" class="btn-router">Ir a Hotelería</RouterLink>
        </div>
      </div>

      <div class="card-item">
        <div class="card-icon-wrapper">
          <img src="../images/servidor.png" class="custom-card-img" alt="Sistemas">
        </div>
        <div class="card-body">
          <h5 class="card-title">SISTEMAS</h5>
          <p class="card-text">Solo personal de sistemas.</p>
          <RouterLink to="/sistemas" class="btn-router">Ir a Sistemas</RouterLink>
        </div>
      </div>

      <div class="card-item">
        <div class="card-icon-wrapper">
          <img src="../images/coordinacion.png" class="custom-card-img" alt="Generales">
        </div>
        <div class="card-body">
          <h5 class="card-title">GENERALES</h5>
          <p class="card-text">Solo personal de Generales.</p>
          <RouterLink to="/coordinacion" class="btn-router">Ir a Generales</RouterLink>
        </div>
      </div>

      <div class="card-item">
        <div class="card-icon-wrapper">
          <img src="../images/administracion.png" class="custom-card-img" alt="Icono de Administración">
        </div>
        <div class="card-body">
          <h5 class="card-title">ADMINISTRACIÓN</h5>
          <p class="card-text">Solo personal de Administración.</p>
          <RouterLink to="/administracion" class="btn-router">Ir a Administración</RouterLink>
        </div>
      </div>

      <div class="card-item">
        <div class="card-icon-wrapper">
          <img src="../images/Servicios.png" class="custom-card-img" alt="Icono de Servicios">
        </div>
        <div class="card-body">
          <h5 class="card-title">SERVICIOS</h5>
          <p class="card-text">Solo personal de Servicios.</p>
          <RouterLink to="/servicios" class="btn-router">Ir a Servicios</RouterLink>
        </div>
      </div>

      <div class="card-item">
        <div class="card-icon-wrapper">
          <img src="../images/enfermeria.png" class="custom-card-img" alt="Icono de Enfermería">
        </div>
        <div class="card-body">
          <h5 class="card-title">ENFERMERÍA</h5>
          <p class="card-text">Solo personal de Enfermería.</p>
          <RouterLink to="/enfermeria" class="btn-router">Ir a Enfermería</RouterLink>
        </div>
      </div>

    </div>
  </main>
</template>

<style scoped>
/* Contenedor principal de la cuadrícula */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr); 
  gap: 24px; 
  padding: 24px;
}

/* Tarjeta Médica Adaptable (Tema Claro / Oscuro) */
.card-item {
  background-color: var(--bg-tarjeta);
  border: 1px solid var(--border-color);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), 
              box-shadow 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), 
              border-color 0.3s ease,
              background-color 0.3s ease;
}

/* Efecto al pasar el mouse por encima */
.card-item:hover {
  transform: translateY(-6px);
  border-color: #0284c7;
  box-shadow: 0 12px 20px -5px rgba(0, 0, 0, 0.3);
}

/* Contenedor para que las ilustraciones queden centradas y simétricas */
.card-icon-wrapper {
  background-color: var(--bg-input);
  padding: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid var(--border-color);
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.placeholder-box {
  min-height: 140px;
  border: 2px dashed rgba(2, 132, 199, 0.45);
  background: rgba(2, 132, 199, 0.04);
  color: var(--texto-secundario);
  font-size: 0.8rem;
  text-align: center;
}

.placeholder-text {
  display: inline-block;
  padding: 8px 12px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.35);
}

.custom-card-img {
  width: 100%;        
  height: 140px;      
  object-fit: contain;  
  padding: 5px;
  transition: filter 0.3s ease;
}

/* Inversión automática de íconos oscuros en Modo Oscuro */
:deep([data-theme="dark"]) .custom-card-img,
html[data-theme="dark"] .custom-card-img {
  filter: invert(0.9) hue-rotate(180deg);
}

.card-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

.card-title {
  margin-top: 0;
  margin-bottom: 8px;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--texto-principal);
  transition: color 0.3s ease;
}

.card-text {
  color: var(--texto-secundario);
  font-size: 0.925rem;
  margin-bottom: 20px;
  flex-grow: 1; /* Empuja el botón siempre al fondo */
  transition: color 0.3s ease;
}

/* Botón Dinámico Premium */
.btn-router {
  display: inline-block;
  text-align: center;
  background-color: #0070f3;
  color: white;
  padding: 12px 16px;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
  box-shadow: 0 4px 6px rgba(0, 112, 243, 0.25);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Animación del botón */
.btn-router:hover {
  background-color: #0061d5;
  box-shadow: 0 6px 14px rgba(0, 112, 243, 0.4);
  transform: translateY(-2px);
}

.btn-router:active {
  transform: translateY(1px);
  box-shadow: 0 2px 4px rgba(0, 112, 243, 0.2);
}

/* Responsive para celulares y tablets */
@media (max-width: 1024px) {
  .cards-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .cards-grid {
    grid-template-columns: 1fr;
  }
}
</style>