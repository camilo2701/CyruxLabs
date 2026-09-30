# Guía de creación de laboratorios

Esta guía explica cómo preparar un laboratorio para CyruxLabs: qué debe contener tu archivo zip, cómo escribir el `compose.yaml`, cómo probarlo antes de subirlo y qué hacer cuando algo falla.

## Introducción

### Qué es un laboratorio en CyruxLabs

Un laboratorio es un entorno de práctica de pentesting. Cada estudiante recibe un escritorio Linux dentro del navegador (llamado **webtop**) y uno o más servicios vulnerables que debe analizar. Al final del recorrido encuentra una **flag**, la escribe en la plataforma y el laboratorio se marca como resuelto.

Tú diseñas ese entorno: los servicios, los datos, las herramientas del escritorio y el camino hasta la flag.

### Cómo funciona una sesión

1. El estudiante presiona **Comenzar** en un laboratorio.
2. La plataforma toma tu archivo zip y crea un entorno nuevo, solo para esa sesión.
3. El escritorio se abre dentro de la página y el estudiante sigue los pasos.
4. La sesión termina cuando el estudiante envía la flag correcta o presiona **Terminar Lab**. El tiempo se mide desde que inicia hasta que envía la flag.
5. **Reiniciar Lab** detiene los contenedores y los vuelve a crear desde tu zip.

### Qué necesitas antes de empezar

- Una cuenta con rol de instructor o administrador.
- Docker y Docker Compose instalados en tu computador para probar el laboratorio.
- Conocimientos básicos de Docker: escribir un `compose.yaml` y un `Dockerfile`.
- Una idea clara de qué aprenderá el estudiante y cuál será la flag.

## Cómo funciona la plataforma

### Un entorno aislado por sesión

Cada sesión recibe su **propia copia** de tu laboratorio. Dos estudiantes pueden jugar el mismo laboratorio al mismo tiempo sin verse entre sí. Por eso tu `compose.yaml` no debe fijar nombres de contenedores ni puertos del servidor: dos sesiones chocarían.

### El proxy de acceso y la red `labnet`

```
Navegador del estudiante
        │  HTTPS
        ▼
 [ proxy de acceso ] ───► [ webtop :3000 ] ───► [ tus servicios ]
     (plataforma)          (tu escritorio)        (red labnet)
```

- La plataforma pone un proxy que recibe la conexión HTTPS del estudiante y la envía a tu servicio `webtop`.
- Todos los servicios de tu laboratorio viven en una red interna llamada `labnet`, que **no tiene salida a internet**.

### Qué pone la plataforma y qué pones tú

| La plataforma se encarga de | Tú te encargas de |
| --- | --- |
| El proxy HTTPS y su certificado | El archivo `compose.yaml` |
| Crear la red `labnet` | El servicio `webtop` y sus herramientas |
| Publicar el acceso al estudiante | Los servicios vulnerables y sus datos |
| Iniciar, reiniciar y detener sesiones | La flag y el camino hasta ella |

> **Importante:** los nombres `labaccessproxy`, `publicnet` y `labnet` están reservados por la plataforma. No los uses para tus propios servicios ni redes.

## Estructura del archivo zip

### Árbol de carpetas

```
mi-laboratorio.zip
└── mi-laboratorio/
    ├── compose.yaml
    ├── webtop/
    │   └── Dockerfile
    ├── web/
    │   └── index.html
    └── templates/
```

Las rutas que escribas en el `compose.yaml` (por ejemplo `build: ./webtop`) se calculan **desde la carpeta donde está el `compose.yaml`**.

### Reglas del zip

- Sube **un solo archivo** con extensión `.zip`.
- El archivo de composición debe llamarse exactamente `compose.yaml`. Nombres como `docker-compose.yml` o `compose.yml` no se reconocen.
- Puede estar en la raíz del zip o dentro de una o dos carpetas, pero no más profundo.
- Debe haber **un solo** `compose.yaml` en todo el zip.
- No incluyas credenciales reales, llaves privadas ni datos personales.

### El archivo `compose.yaml`

La plataforma combina tu `compose.yaml` con su propio archivo base y levanta todo junto. Por eso tu archivo solo describe lo tuyo: el escritorio y los servicios del laboratorio. Las redes y el proxy ya vienen resueltos.

## Escribir el compose.yaml

### El servicio `webtop` (obligatorio)

Tu laboratorio **debe** tener un servicio llamado exactamente `webtop`, que escuche HTTP en el puerto **3000** y esté conectado a `labnet`. El proxy envía allí a los estudiantes; sin este servicio no hay escritorio.

```yaml
services:
  webtop:
    build: ./webtop
    shm_size: "1gb"
    restart: unless-stopped
    networks:
      - labnet
```

`shm_size: "1gb"` evita que el navegador del escritorio se cierre por falta de memoria compartida.

### La red `labnet`

Conecta **cada** servicio a `labnet` con `networks: - labnet`. No declares `labnet` al final de tu archivo: la plataforma ya la define.

Los servicios se hablan entre sí por su nombre. Si tienes un servicio llamado `fakebank`, desde cualquier otro servicio de tu laboratorio lo encuentras como `fakebank`.

### Servicios de apoyo

Agrega los servicios que necesite tu laboratorio: aplicaciones web, bases de datos, caches y similares. Puedes usar imágenes públicas con `image:` o construir las tuyas con `build:`.

```yaml
  redis:
    image: redis:alpine
    restart: unless-stopped
    networks:
      - labnet
```

> Las imágenes con `build:` se construyen al iniciar la sesión. La primera vez puede tardar; las siguientes aprovechan la caché de Docker.

### Dominios falsos con aliases

Para que los estudiantes visiten un dominio del laboratorio (por ejemplo `fakebank.com`) en vez de un nombre de servicio, agrega un alias en `labnet`:

```yaml
  serviceproxy:
    image: nginx:alpine
    restart: unless-stopped
    volumes:
      - ./templates/webproxy:/etc/nginx/conf.d:ro
    networks:
      labnet:
        aliases:
          - fakebank.com
```

El tráfico dentro de `labnet` va por HTTP. Si quieres otro puerto, configúralo en el servicio; el alias solo resuelve el nombre.

### Variables de entorno

Escribe los valores directamente en `environment:`. No dependas de un archivo `.env` ni de la sintaxis `${VARIABLE}`: no se garantiza que se cargue al iniciar la sesión.

```yaml
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
```

### Orden de arranque y healthchecks

Docker inicia los servicios casi al mismo tiempo. Si un servicio necesita que otro esté listo (por ejemplo una base de datos), usa un `healthcheck` y `depends_on` con `condition: service_healthy`:

```yaml
  fakebank:
    build: ./fakebank
    depends_on:
      redis:
        condition: service_healthy

  redis:
    image: redis:alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
```

> Evita los **volúmenes con nombre** para datos del laboratorio: pueden sobrevivir a un reinicio. Carga los datos iniciales desde la imagen o desde archivos de tu zip.

## Preparar el escritorio (webtop)

### El Dockerfile del webtop

El escritorio es una imagen de escritorio web que escucha en el puerto 3000. Una opción práctica es partir de la imagen webtop de LinuxServer y agregarle lo que tu laboratorio necesite:

```dockerfile
FROM lscr.io/linuxserver/webtop:ubuntu-xfce

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl sqlite3 \
    && rm -rf /var/lib/apt/lists/*
```

Ajusta la etiqueta de la imagen y el gestor de paquetes (`apt`, `apk`, etc.) según la versión que uses.

### Herramientas y archivos de práctica

- Instala las herramientas en el `Dockerfile`, no durante la sesión.
- Copia los archivos de práctica (listas de palabras, muestras, etc.) a la carpeta personal del usuario del escritorio. En las imágenes webtop de LinuxServer esa carpeta es `/config`.
- Indica en las instrucciones la ruta exacta donde el estudiante encontrará esos archivos.

### Sin internet en ejecución

La construcción de imágenes **sí** tiene acceso a internet, pero el laboratorio ya en marcha **no**: `labnet` es una red interna. Por eso:

- Instala todo lo que necesites durante el `build`.
- No dependas de descargas, APIs externas ni actualizaciones mientras el laboratorio corre.
- Si los estudiantes deben descargar algo, sírvelo desde uno de tus propios servicios.

## Flags

### Formato de la flag

- Usa un formato reconocible, por ejemplo `FLAG{texto_unico_del_laboratorio}`.
- Cada laboratorio necesita una flag **distinta**: la plataforma no permite repetirla entre laboratorios.
- La comparación distingue mayúsculas de minúsculas. Los espacios al inicio y al final se ignoran.

### Dónde esconderla

- Colócala en el servicio objetivo: un campo de base de datos, un archivo detrás de un login, un panel de administración.
- No la pongas en la imagen del `webtop`: el estudiante la encontraría sin resolver nada.
- Haz que sea imposible llegar a ella sin completar el recorrido que diseñaste.

### Cómo se valida

El estudiante escribe la flag en la página de la sesión. La plataforma la compara con la que registraste al crear el laboratorio. Si coincide, la sesión termina, se guarda el tiempo y el laboratorio queda marcado como resuelto.

## Crear el laboratorio en la plataforma

### Campos del formulario

| Campo | Regla |
| --- | --- |
| Título | Obligatorio, hasta 50 caracteres, solo letras sin tilde, números y espacios. No puede repetirse. |
| Descripción | Obligatoria, hasta 500 caracteres. |
| Beneficios | Mínimo 3. Escribe cada uno y presiona Enter. Mismas reglas de caracteres que el título. |
| Flag | Obligatoria y única entre laboratorios. |
| Archivo zip | Exactamente un archivo `.zip`. |

### Qué pasa al subirlo

La plataforma guarda tu laboratorio y lo muestra en la lista de **Laboratorios**. Tu zip se usa cuando un estudiante inicia una sesión, y es entonces cuando se descubren los errores de configuración (por ejemplo, un servicio que no se llame `webtop`). Por eso conviene probarlo antes de subirlo.

### Editar o eliminar un laboratorio

- Puedes actualizar el título, la descripción y los beneficios.
- Por ahora los archivos de un laboratorio no se pueden reemplazar: si necesitas cambiarlos, crea un laboratorio nuevo.
- Al eliminar un laboratorio se eliminan también sus sesiones y los reportes asociados.

## Instrucciones para estudiantes

> **Próximamente:** podrás escribir las instrucciones de tu laboratorio en Markdown al crearlo. Mientras tanto, prepara tus pasos siguiendo estas pautas.

### Escribir buenos pasos

- Una acción por paso, con un título corto.
- Pon los comandos en bloques de código para que se puedan copiar.
- Explica qué debe ver el estudiante si el paso salió bien.
- Da pistas, no la solución completa. Si quieres más ayuda, ponla en pasos posteriores.
- Nombra las rutas y archivos exactos que el estudiante va a necesitar.

### Formato Markdown disponible

| Quieres | Escribes |
| --- | --- |
| Título de sección | `## Título` |
| Texto en negrita | `**texto**` |
| Comando o código en línea | `` `comando` `` |
| Bloque de código | tres comillas invertidas antes y después |
| Lista | `- elemento` |
| Lista con pasos | `1. paso` |
| Casilla de verificación | `- [ ] tarea` |
| Enlace | `[texto](https://...)` |
| Tabla | columnas separadas con `\|` |

No se permiten imágenes ni HTML dentro de las instrucciones.

## Probar tu laboratorio

### Prueba local con Docker Compose

En tu computador no existe el proxy de la plataforma, así que usa un archivo base mínimo que publique el escritorio directamente. Guárdalo junto a tu `compose.yaml` con el nombre `local-base.yaml`:

```yaml
services:
  webtop:
    ports:
      - "3000:3000"

networks:
  labnet:
```

Luego inicia el laboratorio:

```bash
docker compose -f local-base.yaml -f compose.yaml up --build
```

Abre `http://localhost:3000` en el navegador: deberías ver el escritorio. Cuando termines, detén y limpia todo:

```bash
docker compose -f local-base.yaml -f compose.yaml down -v
```

> `local-base.yaml` es solo para tus pruebas: **no lo incluyas en el zip**. Además, en tu computador la red sí tiene internet; desconéctalo mientras pruebas para comprobar que nada depende de él.

### Lista de verificación antes de subir

- [ ] El archivo se llama exactamente `compose.yaml` y está a lo sumo a dos carpetas de la raíz del zip.
- [ ] Existe un servicio `webtop` que escucha en el puerto 3000 y está en `labnet`.
- [ ] Todos los servicios están en `labnet` y no declaras la red al final del archivo.
- [ ] No usas `ports`, `container_name` ni nombres fijos para redes o volúmenes.
- [ ] No dependes de `.env` ni de internet mientras el laboratorio corre.
- [ ] Puedes llegar a la flag siguiendo tus propios pasos de principio a fin.
- [ ] La flag es única y no está en la imagen del `webtop`.
- [ ] El zip contiene solo lo necesario.

### Probar en la plataforma

Después de subirlo, inicia el laboratorio desde la página de **Laboratorios** y recórrelo completo. Prueba también **Reiniciar Lab** y **Terminar Lab** para confirmar que el entorno se levanta bien desde cero.

## Reglas de seguridad y límites

### Qué está prohibido

Estas opciones ponen en riesgo a los demás estudiantes o a la plataforma y no están permitidas en el `compose.yaml`:

| No uses | Por qué |
| --- | --- |
| `privileged: true` | Da al contenedor control casi total del servidor. |
| `cap_add`, `devices` | Amplían los permisos del contenedor sobre el servidor. |
| `pid: host`, `ipc: host` | Comparten procesos o memoria con el servidor. |
| `network_mode` | Salta el aislamiento de red del laboratorio. |
| Montar `/var/run/docker.sock` o rutas absolutas del servidor | Permite controlar Docker o leer archivos ajenos. |
| `ports` | La plataforma decide cómo se publica el acceso. |
| `container_name` | Dos sesiones simultáneas chocarían. |
| Redefinir `labnet`, `publicnet` o `labaccessproxy` | Estos nombres son de la plataforma. |

Los laboratorios que incumplan estas reglas pueden ser eliminados por los administradores.

### Contenido permitido

- Todo debe ser ficticio y con fines educativos.
- No uses datos personales reales, credenciales reales ni sistemas de terceros como objetivos.
- Respeta las licencias del software que incluyas en tus imágenes.

## Solución de problemas

### El laboratorio tarda en cargar

La primera vez, la plataforma construye las imágenes, y eso puede tardar. Mientras el escritorio arranca es normal ver un error **502 Bad Gateway** unos segundos: espera y recarga. Si pasan más de un par de minutos, revisa que tu servicio `webtop` escuche en el puerto 3000 y esté conectado a `labnet`.

### No llego a un servicio desde webtop

Abre una terminal en el escritorio y prueba el servicio directamente, por ejemplo `curl http://fakebank.com`. Si falla, revisa que el servicio esté en `labnet`, que el alias esté bien escrito y que el servicio escuche en el puerto que esperas.

### La flag no se acepta

Comprueba que la flag del laboratorio coincide exactamente con la que hay en tu servicio, incluyendo mayúsculas y minúsculas. Los espacios al inicio o al final se ignoran, pero los del medio cuentan.

### Reportar un problema

Si un laboratorio falla, los estudiantes pueden usar el botón de advertencia de la barra lateral de la sesión. Escriben un título y una descripción del problema y pueden enviar un reporte por laboratorio al día.

## Plantilla de inicio

Un laboratorio mínimo para copiar y modificar. Estructura:

```
mi-laboratorio/
├── compose.yaml
├── webtop/
│   └── Dockerfile
└── web/
    └── index.html
```

`compose.yaml`:

```yaml
services:
  webtop:
    build: ./webtop
    shm_size: "1gb"
    restart: unless-stopped
    networks:
      - labnet

  web:
    image: nginx:alpine
    restart: unless-stopped
    volumes:
      - ./web:/usr/share/nginx/html:ro
    networks:
      labnet:
        aliases:
          - mitienda.com
```

`webtop/Dockerfile`:

```dockerfile
FROM lscr.io/linuxserver/webtop:ubuntu-xfce

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*
```

`web/index.html`:

```html
<h1>Mi tienda</h1>
<p>Reemplaza este contenido con tu objetivo vulnerable.</p>
```

Desde el escritorio, `curl http://mitienda.com` debería mostrar esa página.