-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 17-09-2026 a las 14:46:26
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `sanatorio_db`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `archivos_secciones`
--

CREATE TABLE `archivos_secciones` (
  `id` int(11) NOT NULL,
  `seccion` varchar(50) DEFAULT NULL,
  `nombre` varchar(255) NOT NULL,
  `seccion_destino` varchar(100) NOT NULL,
  `url` varchar(255) NOT NULL,
  `carpeta_id` int(11) DEFAULT NULL,
  `revisado` tinyint(1) DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `archivos_secciones`
--

INSERT INTO `archivos_secciones` (`id`, `seccion`, `nombre`, `seccion_destino`, `url`, `carpeta_id`, `revisado`) VALUES
(4, NULL, 'servidor.png', 'hosteleria', 'http://localhost:3000/archivos/1781620608383-servidor.png', NULL, 0),
(39, NULL, '1782222200078-Script.docx', 'hosteleria', 'http://localhost:3000/ver-archivo/1782394108219-1782222200078-Script.docx', NULL, 0),
(44, NULL, '1782222200078-Script (1).docx', 'farmacia', 'http://localhost:3000/ver-archivo/1785851682015-254357795.docx', 7, 1),
(45, NULL, '1782212869796-1781620447679-LISTADO EMPLEADOS - SECCIONES (1).xlsx', 'farmacia', 'http://localhost:3000/ver-archivo/1785851702968-84025958.xlsx', 1, 1),
(46, NULL, '1785851682015-254357795.docx', 'rrhh', 'http://localhost:3000/ver-archivo/1786014952925-548131448.docx', 6, 0),
(58, NULL, 'TRABAJO PRACTICO 2 - Matriz de Eisenhower.pdf', 'coordinacion', 'http://localhost:3000/ver-archivo/1788439853326-95119781.pdf', 9, 0),
(64, NULL, 'TRABAJO PRACTICO 2 - Matriz de Eisenhower.pdf', 'farmacia', 'http://localhost:3000/ver-archivo/1788444166398-358388944.pdf', 11, 1),
(65, NULL, 'TRABAJO PRACTICO 2 - Matriz de Eisenhower.docx', 'farmacia', 'http://localhost:3000/ver-archivo/1788444166399-824531933.docx', 11, 1),
(66, NULL, '1785851702968-84025958.xlsx', 'farmacia', 'http://localhost:3000/ver-archivo/1789472592264-762253407.xlsx', 11, 1),
(67, NULL, 'TRABAJO PRACTICO 2 - Matriz de Eisenhower.pdf', 'rrhh', 'http://localhost:3000/ver-archivo/1789472641899-127905153.pdf', NULL, 0),
(69, NULL, 'TRABAJO PRACTICO 2 - Matriz de Eisenhower.pdf', 'quirofano', 'http://localhost:3000/ver-archivo/1789473097951-819850584.pdf', NULL, 0),
(70, NULL, 'TRABAJO PRACTICO 2 - Matriz de Eisenhower.docx', 'quirofano', 'http://localhost:3000/ver-archivo/1789473097954-489772614.docx', NULL, 0),
(74, NULL, 'TRABAJO PRACTICO 2 - Matriz de Eisenhower.docx', 'quirofano', 'http://localhost:3000/ver-archivo/1789474487547-967154470.docx', NULL, 0),
(75, NULL, '1789472592264-762253407.xlsx', 'farmacia', 'http://localhost:3000/ver-archivo/1789599789401-914605621.xlsx', 11, 1),
(91, NULL, 'TRABAJO PRACTICO 2 - Matriz de Eisenhower.docx', 'farmacia', 'http://localhost:3000/ver-archivo/1789645005323-185358188.docx', NULL, 1),
(92, NULL, 'Presentación general.pptx', 'farmacia', 'http://localhost:3000/ver-archivo/1789645005323-115849639.pptx', NULL, 1),
(93, NULL, 'Copia de Encuesta de Satisfacción del Paciente (respuestas).xlsx', 'farmacia', 'http://localhost:3000/ver-archivo/1789645005363-474698936.xlsx', NULL, 1),
(95, NULL, '1789472592264-762253407.xlsx', 'farmacia', 'http://localhost:3000/ver-archivo/1789645208381-366067329.xlsx', 7, 1);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `carpetas`
--

CREATE TABLE `carpetas` (
  `id` int(11) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `seccion` varchar(100) NOT NULL,
  `carpeta_padre_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `carpetas`
--

INSERT INTO `carpetas` (`id`, `nombre`, `seccion`, `carpeta_padre_id`, `created_at`) VALUES
(1, 'sanatorio', 'farmacia', NULL, '2026-07-02 13:03:32'),
(2, 'sanatorio', 'farmacia', NULL, '2026-07-02 13:11:09');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `comentarios_archivos`
--

CREATE TABLE `comentarios_archivos` (
  `id` int(11) NOT NULL,
  `archivo_id` int(11) NOT NULL,
  `usuario_email` varchar(255) NOT NULL,
  `rol` varchar(50) NOT NULL,
  `seccion` varchar(100) NOT NULL DEFAULT 'general',
  `comentario` text NOT NULL,
  `fecha` timestamp NOT NULL DEFAULT current_timestamp(),
  `coord_x` float DEFAULT NULL,
  `coord_y` float DEFAULT NULL,
  `coord_w` decimal(5,2) DEFAULT NULL,
  `coord_h` decimal(5,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `comentarios_archivos`
--

INSERT INTO `comentarios_archivos` (`id`, `archivo_id`, `usuario_email`, `rol`, `seccion`, `comentario`, `fecha`, `coord_x`, `coord_y`, `coord_w`, `coord_h`) VALUES
(26, 66, 'fabeccarini@escuelasproa.edu.ar', 'CONTROLADOR', 'farmacia', 'kasjc', '2026-09-16 22:57:20', 32.85, 30.45, 11.72, 30.29);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `historial_accesos`
--

CREATE TABLE `historial_accesos` (
  `id` int(11) NOT NULL,
  `legajo_usuario` varchar(20) DEFAULT NULL,
  `fecha_hora` timestamp NOT NULL DEFAULT current_timestamp(),
  `dispositivo` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `personal_sanatorio`
--

CREATE TABLE `personal_sanatorio` (
  `legajo` varchar(20) NOT NULL,
  `apellido_nombres` varchar(255) NOT NULL,
  `dni` varchar(20) NOT NULL,
  `puesto_trabajo` varchar(150) NOT NULL,
  `urgencia` enum('Baja','Media','Alta') DEFAULT 'Baja'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `personal_sanatorio`
--

INSERT INTO `personal_sanatorio` (`legajo`, `apellido_nombres`, `dni`, `puesto_trabajo`, `urgencia`) VALUES
('04/0012', 'VIEYRA NANCY GLORIA', '18612828', 'ADMINISTRATIVA', 'Baja'),
('04/0055', 'GIORDANO ROSSANA ALEJANDRA', '18613418', 'FARMACIA', 'Baja'),
('04/0071', 'TORANZO MIRTA INES', '13786907', 'ENFERMERA DE TERAPIA', 'Baja'),
('04/0083', 'ROMERO ALICIA BEATRIZ', '16882288', 'ENFERMERA DE TERAPIA', 'Baja'),
('04/0089', 'ALGARBE VERONICA ANDREA', '22647914', 'FACTURISTA', 'Baja'),
('04/0136', 'REPISO MARIA EUGENIA', '22647592', 'MUCAMA DE CIRUGIA', 'Baja'),
('04/0146', 'TOSTICARELLI MARIA BELEN', '27920624', 'TECNICO RX', 'Baja'),
('04/0149', 'PELIZA MARIA CLAUDIA', '17896905', 'SECRETARIA', 'Baja'),
('04/0158', 'ALBERTI MARIA DEL LOURDES', '22423081', 'SECRETARIA', 'Baja'),
('04/0170', 'SANCHEZ ESTEFANIA MARGARITA', '29685622', 'MUCAMA DE PISO', 'Baja'),
('04/0174', 'GUTIERREZ NILDA STELLA MARY', '18201984', ' MUCAMA DE PISO', 'Baja'),
('04/0194', 'TAVERNA MARIA FLORENCIA', '29363058', 'TECNICO RX', 'Baja'),
('04/0197', 'WEBER MONICA MARCELA', '20097226', 'ENFERMERA DE PISO', 'Baja'),
('04/0198', 'BORIGLIO RUBEN RENEE', '14622384', 'ADMISION', 'Baja'),
('04/0202', 'AIRASCA BETIANA SOLEDAD', '32228885', 'ENFERMERA', 'Baja'),
('04/0207', 'SILEONE MARCELA ALEJANDRA', '20188357', 'ADMISION', 'Baja'),
('04/0210', 'TORANZO DANIELA VIRGINIA', '27109262', 'MUCAMA', 'Baja'),
('04/0211', 'JOBSON MAYCO OSMAR', '32221352', 'ENFERMERO DE PISO', 'Baja'),
('04/0223', 'ARANDA YANINA DEL VALLE', '32139044', 'ADMINISTRACION', 'Baja'),
('04/0225', 'POMBA MELISA', '33477662', 'CABAS DE PISO', 'Baja'),
('04/0248', 'CAMPOS ELIZABETH YANINA', '29117280', 'ENFERMERA DE TERAPIA', 'Baja'),
('04/0261', 'GARNERO PABLO CESAR', '27540782', 'TECNICO RX', 'Baja'),
('04/0270', 'BURGOS MAILEN CONCEPCION', '37285846', 'MUCAMA DE CIRUGIA', 'Baja'),
('04/0274', 'AREVALO JULIAN', '33370074', 'ADMINISTRACION', 'Baja'),
('04/0275', 'SILIONI NADIA LUCIANA', '33178061', 'SECRETARIA', 'Baja'),
('04/0281', 'NIZ MELINA SOLEDAD', '32901303', 'ENFERMERA DE PISO', 'Baja'),
('04/0285', 'HERRERA RITA DEL CARMEN', '23252264', 'SECRETARIA', 'Baja'),
('04/0286', 'CABRERA CARLOS DANTE', '26309585', 'OFICIAL', 'Baja'),
('04/0288', 'JAIME CLARIBEL JUDITH', '36185139', 'COCINERA', 'Baja'),
('04/0303', 'GALLARDO MARIA CRISTINA', '17936389', 'SECRETARIA', 'Baja'),
('04/0326', 'TESSIO ROXANA CARINA', '24598591', 'SECRETARIA', 'Baja'),
('04/0332', 'GUTIERREZ ARACELI BELEN', '37822927', 'ENFERMERA DE PISO', 'Baja'),
('04/0341', 'FLORES NATALIA VERONICA', '29560068', 'SECRETARIA', 'Baja'),
('04/0352', 'DELGADO ARNEZ ANDREA CLELIA', '95584829', 'ADMINISTRACION', 'Baja'),
('04/0356', 'MATTEOS LUCRECIA VIRGINIA', '36185514', 'SECRETARIA', 'Baja'),
('04/0365', 'GERBAUDO DANIELA SOLEDAD', '42183981', 'CABAS DE PISO', 'Baja'),
('04/0407', 'SOLIZ MARIA JULIA', '41000705', 'INTRUMENTISTA', 'Baja'),
('04/0414', 'BOSIO VIRGINIA LOURDES', '41994052', 'SECRETARIA', 'Baja'),
('04/0419', 'EXNER FRANCO MAYRA AYELEN', '39420187', 'INSTRUMENTADORA', 'Baja'),
('04/0423', 'GUARDIA MARIA BELEN', '34446851', 'ENFERMERA DE PISO', 'Baja'),
('04/0435', 'PEREZ MICAELA ROCIO', '39968908', 'SECRETARIA', 'Baja'),
('04/0436', 'CIARROCCHI TIZIANA', '44295677', 'SECRETARIA', 'Baja'),
('04/0438', 'ZAMUDIO NADIA SABRINA', '37701898', 'SECRETARIA', 'Baja'),
('04/0453', 'VILLEGAS LUCRECIA ANAHI', '40506700', 'ENFERMERA DE PISO', 'Baja'),
('04/0457', 'ASTRADA PAOLA ALEJANDRA', '43675587', 'MUCAMA DE PISO', 'Baja'),
('04/0459', 'FLORES DAIANA MARISA', '39566485', 'INSTRUMENTISTA', 'Baja'),
('04/0463', 'GUIDETTI ROCIO', '44078894', 'INSTRUMENTISTA', 'Baja'),
('04/0466', 'CHIOZZI ANDREA DE LOS ANGELES', '33537752', 'MUCAMA DE PISO', 'Baja'),
('04/0468', 'SALAS FRANCO', '41879339', 'ENFERMERO DE PISO', 'Baja'),
('04/0470', 'ARMANDO YAMILA NARELLA', '42787461', 'SECRETARIA', 'Baja'),
('04/0474', 'STASSI ELIANA', '44694331', 'SECRETARIA', 'Baja'),
('04/0476', 'TOSSEN PAOLA ALEJANDRA', '41256918', 'SECRETARIA', 'Baja'),
('04/0477', 'SO?EZ SILVANA MARIEL', '35559839', 'SECRETARIA', 'Baja'),
('04/0479', 'MATEOS GEORGINA SOLEDAD', '31480710', 'SECRETARIA', 'Baja'),
('04/0480', 'FERNANDEZ DAMARIS CARLA ELENA', '31668047', 'SECRETARIA', 'Baja'),
('04/0483', 'BARRIONUEVO GONZALO ANDRES', '28104632', 'ADMINISTRACION', 'Baja'),
('04/0485', 'CORDOBA MELINA', '40052904', 'SECRETARIA', 'Baja'),
('04/0489', 'GALFRE VALENTIN', '44305259', 'ENFERMERO DE PISO', 'Baja'),
('04/0491', 'GERVAN MAZZUCCI FATIMA', '45245303', 'SECRETARIA', 'Baja'),
('04/0492', 'CARLE MACARENA', '44371789', 'ENFERMERA DE PISO', 'Baja'),
('04/0493', 'SCAPECCIA ANTONELLA', '43136313', 'MUCAMA DE PISO', 'Baja'),
('04/0494', 'RODRIGUEZ LAURA ELIZABETH', '37715649', 'ENFREMERA DE PISO', 'Baja'),
('04/0495', 'BAUDI MARIA ALEJANDRA', '28104960', 'MUCAMA DE PISO', 'Baja'),
('04/496', 'JUAREZ FACUNDO', '44289405', 'ENFERMERO DE PISO', 'Baja');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `archivos_secciones`
--
ALTER TABLE `archivos_secciones`
  ADD PRIMARY KEY (`id`),
  ADD KEY `carpeta_id` (`carpeta_id`);

--
-- Indices de la tabla `carpetas`
--
ALTER TABLE `carpetas`
  ADD PRIMARY KEY (`id`),
  ADD KEY `carpeta_padre_id` (`carpeta_padre_id`);

--
-- Indices de la tabla `comentarios_archivos`
--
ALTER TABLE `comentarios_archivos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `archivo_id` (`archivo_id`);

--
-- Indices de la tabla `historial_accesos`
--
ALTER TABLE `historial_accesos`
  ADD PRIMARY KEY (`id`),
  ADD KEY `legajo_usuario` (`legajo_usuario`);

--
-- Indices de la tabla `personal_sanatorio`
--
ALTER TABLE `personal_sanatorio`
  ADD PRIMARY KEY (`legajo`),
  ADD UNIQUE KEY `dni` (`dni`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `archivos_secciones`
--
ALTER TABLE `archivos_secciones`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=97;

--
-- AUTO_INCREMENT de la tabla `carpetas`
--
ALTER TABLE `carpetas`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT de la tabla `comentarios_archivos`
--
ALTER TABLE `comentarios_archivos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT de la tabla `historial_accesos`
--
ALTER TABLE `historial_accesos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `carpetas`
--
ALTER TABLE `carpetas`
  ADD CONSTRAINT `carpetas_ibfk_1` FOREIGN KEY (`carpeta_padre_id`) REFERENCES `carpetas` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `comentarios_archivos`
--
ALTER TABLE `comentarios_archivos`
  ADD CONSTRAINT `comentarios_archivos_ibfk_1` FOREIGN KEY (`archivo_id`) REFERENCES `archivos_secciones` (`id`) ON DELETE CASCADE;

--
-- Filtros para la tabla `historial_accesos`
--
ALTER TABLE `historial_accesos`
  ADD CONSTRAINT `historial_accesos_ibfk_1` FOREIGN KEY (`legajo_usuario`) REFERENCES `personal_sanatorio` (`legajo`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
