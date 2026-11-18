# CyruxLabs

CyruxLabs es una plataforma web que permite practicar ciberseguridad de forma
guiada y segura. Cada ejercicio es un **laboratorio aislado** (una máquina
vulnerable desplegada en contenedores Docker) donde el estudiante aplica
técnicas reales de pentesting, captura la *flag* correcta, gana trofeos e insignias
y sigue su progreso. Profesores y administradores, por su parte, gestionan los
laboratorios, los usuarios y los reportes de la plataforma.

Proyecto de título — Ingeniería en Informática, Pontificia Universidad Católica
de Valparaíso.

---

## Índice

- [Resumen del proyecto](#cyruxlabs)
- [Funcionalidades principales](#funcionalidades-principales)
- [Arquitectura](#arquitectura)
- [Tecnologías y librerías](#tecnologías-y-librerías)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Requisitos e instalación](#requisitos-e-instalación)
- [Autores](#autores)

---

## Funcionalidades principales

- **Laboratorios aislados:** cada reto corre en su propio entorno Docker, con una
  red privada y acceso al escritorio mediante navegador (Webtop).
- **Sistema de flags:** el estudiante resuelve el laboratorio y envía la flag para
  completarlo.
- **Trofeos e insignias:** recompensas por completar un laboratorio, por hacerlo
  sin errores, por rapidez o por usar comandos concretos en la terminal.
- **Progreso y niveles:** puntaje y nivel del estudiante que avanzan a medida que
  resuelve laboratorios.
- **Roles de usuario:** estudiante, profesor y administrador, cada uno con sus
  permisos.
- **Gestión de laboratorios:** creación, edición y validación de laboratorios a
  partir de un archivo `.zip` (compose, Dockerfile e imágenes permitidas).
- **Reportes en PDF:** generación de reportes de la actividad de la plataforma.

---

## Arquitectura

CyruxLabs sigue una **arquitectura de tres capas**: presentación (frontend),
aplicación (backend) y datos (base de datos).

```
┌─────────────────────────────────────┐
│   Capa de Presentación — Frontend   │
│           React + Vite              │
└─────────────────────────────────────┘
                 │ ▲   HTTP / API REST
                 ▼ │
┌─────────────────────────────────────┐
│   Capa de Aplicación — Backend      │
│   Node.js + Express                 │
│   routes → controllers → services   │
└─────────────────────────────────────┘
                 │ ▲   consultas
                 ▼ │
┌─────────────────────────────────────┐
│   Capa de Datos — Base de datos     │
│       Supabase (PostgreSQL)         │
└─────────────────────────────────────┘
```

---

## Tecnologías y librerías

### Backend

| Tecnología / Librería | Para qué se usa |
| --- | --- |
| **Node.js + Express** | Servidor y API REST. |
| **Supabase** (`@supabase/supabase-js`) | Base de datos y almacenamiento. |
| **jsonwebtoken** | Autenticación mediante tokens JWT. |
| **bcrypt** | Cifrado (hash) de contraseñas. |
| **helmet** | Cabeceras de seguridad HTTP. |
| **cors** | Permite que el frontend se comunique con la API. |
| **dotenv** | Carga de variables de entorno. |
| **multer** | Subida de archivos (el `.zip` del laboratorio). |
| **pdfkit** | Generación de reportes en PDF. |
| **yauzl** | Lectura y validación de archivos `.zip`. |
| **yaml** | Lectura y validación de los archivos `docker-compose`. |
| **Docker** | Despliegue aislado de cada laboratorio. |

### Frontend

| Tecnología / Librería | Para qué se usa |
| --- | --- |
| **React + Vite** | Construcción de la interfaz y entorno de desarrollo. |
| **react-router-dom** | Navegación entre páginas. |
| **react-markdown** | Renderizado de las guías de los laboratorios escritas en Markdown. |

---

## Estructura del proyecto

```
cyrux/
├── backend/
│   └── src/
│       ├── config/
│       ├── routes/
│       ├── controllers/
│       ├── services/
│       ├── middleware/
│       ├── utils/
│       └── server.js
│
└── frontend/
    └── src/
        ├── pages/
        ├── components/
        ├── context/
        ├── utils/
        └── App.jsx
```

---

## Requisitos e instalación

### Requisitos previos

- Node.js (versión 18 o superior)
- Docker y Docker Compose
- Una cuenta de Supabase

### Pasos

1. Clonar el repositorio:

   ```bash
   git clone https://github.com/camilo2701/CyruxLabs.git
   cd cyruxlabs
   ```

2. Configurar las variables de entorno (crear un archivo `.env` en `backend/` con
   las claves de Supabase, JWT, etc.).

3. Instalar dependencias y levantar el **backend**:

   ```bash
   cd backend
   npm install
   npm run start
   ```

4. En otra terminal, instalar dependencias y levantar el **frontend**:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. Abrir la aplicación en el navegador (por defecto, `http://localhost:5173`).

---

## Autores

- **Camilo Mondaca**
- **Raúl Rozas**

Ingeniería en Informática — Pontificia Universidad Católica de Valparaíso.