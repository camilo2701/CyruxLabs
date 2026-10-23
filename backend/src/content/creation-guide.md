# Guía de creación de laboratorios

Esta guía explica cómo funciona CyruxLabs por dentro y cómo preparar un laboratorio que funcione bien en la plataforma: qué debe contener tu archivo zip, cómo se combina tu `compose.yaml` con el archivo base de la plataforma, qué funciona, qué no, y cómo completar el formulario de creación (flag, puntaje, instrucciones y trofeos).

Si solo quieres empezar, ve directo a la [Plantilla de inicio](#plantilla-de-inicio) y vuelve aquí cuando necesites entender por qué algo no funciona.

## En resumen

- Cada laboratorio es **un archivo zip** con un único `compose.yaml` (con ese nombre exacto) y todo lo que ese archivo necesite.
- Cada sesión de estudiante recibe **su propia copia** del laboratorio, con su propia red. Nunca se mezclan dos estudiantes.
- La plataforma pone un **proxy de acceso** y la red interna `labnet`. Tú solo describes tus servicios y los conectas a `labnet`.
- El estudiante **solo ve el escritorio** (`webtop`, puerto 3000). Todo lo demás lo alcanza desde ese escritorio, por nombre, dentro de `labnet`.
- Con el laboratorio en marcha **no hay internet**. La construcción de las imágenes (`build`) sí tiene internet.
- Nada se debe publicar al exterior: **no uses `ports`**, `container_name`, `network_mode`, `privileged` ni montajes del servidor.
- Los trofeos de comandos y procesos solo observan lo que ocurre **dentro del contenedor `webtop`**.

## Introducción

### Qué es un laboratorio en CyruxLabs

Un laboratorio es un entorno de práctica de pentesting. Cada estudiante recibe un escritorio Linux dentro del navegador (llamado **webtop**) y uno o más servicios vulnerables que debe analizar. Al final del recorrido encuentra una **flag**, la escribe en la plataforma y el laboratorio se marca como resuelto.

Tú diseñas ese entorno: los servicios, los datos, las herramientas del escritorio y el camino hasta la flag. También defines las instrucciones paso a paso, el nivel de dificultad y, si quieres, trofeos extra para retar a los estudiantes.

### Cómo funciona una sesión

1. El estudiante presiona **Comenzar** en un laboratorio.
2. La plataforma toma tu archivo zip y crea un entorno nuevo, solo para esa sesión. Mientras tanto el estudiante ve el avance (preparando, construyendo, iniciando).
3. Cuando todo está listo, el escritorio se abre dentro de la página y el estudiante sigue las instrucciones que escribiste.
4. La sesión termina cuando el estudiante envía la flag correcta o presiona **Terminar Lab**. El tiempo se mide desde que inicia hasta que envía la flag.
5. **Reiniciar Lab** detiene todo y lo vuelve a crear desde tu zip. Un reinicio es un intento nuevo: el contador de tiempo vuelve a empezar y se descarta lo registrado en el intento anterior.

Al terminar, se destruyen los contenedores y la red de esa sesión. Lo que el estudiante hizo dentro del laboratorio no se conserva.

### Qué necesitas antes de empezar

- Una cuenta con rol de instructor o administrador.
- Docker y Docker Compose instalados en tu computador para probar el laboratorio.
- Conocimientos básicos de Docker: escribir un `compose.yaml` y un `Dockerfile`.
- Una idea clara de qué aprenderá el estudiante, cuál será la flag y qué trofeos quieres ofrecer.

## Cómo funciona la plataforma por dentro

Entender esta sección te ahorra la mayoría de los problemas. Casi todas las reglas de la guía salen de cómo se arma una sesión.

### Las piezas

- **La aplicación** guarda tu laboratorio (datos, instrucciones, trofeos y el zip) y valida lo que subes.
- **El runner** es un servicio que corre en un servidor Linux con Docker. Recibe órdenes de la aplicación (iniciar, reiniciar, detener) y es quien realmente levanta tus contenedores.
- **Docker Compose** es la herramienta que el runner usa para crear cada sesión a partir de tu zip.

Tú nunca hablas con el runner. Subes tu zip en el formulario y la plataforma se encarga del resto.

### Qué pasa cuando un estudiante presiona Comenzar

| Fase | Qué hace el runner | Qué suele fallar |
| --- | --- | --- |
| Preparando | Crea una carpeta nueva para la sesión, descomprime tu zip en ella y busca el `compose.yaml`. | No existe un `compose.yaml` en las primeras carpetas del zip. |
| Construyendo | Descarga las imágenes de `image:` y construye las de `build:`. Es la fase más lenta. | Un `Dockerfile` con errores, un archivo que no está en el zip, una etiqueta de imagen que no existe. |
| Iniciando | Crea y arranca los contenedores respetando `depends_on` y los `healthcheck`. | Un servicio que se cae al arrancar o un `healthcheck` que nunca pasa. |
| Finalizando | Averigua en qué puerto del servidor quedó publicado el proxy y prepara el registro de comandos y procesos. | El proxy no arrancó (por ejemplo, porque el compose rompió algo de la plataforma). |
| Listo | La aplicación abre el escritorio dentro de la página. | Pantalla en blanco o error 502: el `webtop` no responde (ver [Solución de problemas](#solución-de-problemas)). |

Si algo falla, el estudiante solo ve un mensaje general ("no se pudo construir o arrancar el laboratorio"). El detalle técnico queda en los registros del servidor, **no** se le muestra a nadie. Por eso es importante probar tu laboratorio en tu computador antes de subirlo.

La construcción de imágenes ocurre en cada inicio de sesión, pero Docker reutiliza las capas ya construidas. La primera vez que alguien inicia tu laboratorio puede tardar varios minutos; las siguientes veces es mucho más rápido siempre que tus archivos no cambien.

### La fusión de archivos: base + tu compose.yaml

Esta es la parte clave. La plataforma **no usa tu `compose.yaml` solo**: lo combina con un archivo base propio, y Docker Compose los une en un único entorno. El comando que ejecuta el runner es, en esencia:

```bash
docker compose -p <id-de-sesion> \
  --project-directory <carpeta-de-tu-compose.yaml> \
  -f base-proxy.yaml \
  -f <tu-compose.yaml> \
  up -d
```

Hay tres cosas que dependen de esa línea:

- **`-p <id-de-sesion>`**: cada sesión es un proyecto de Compose distinto, con su propio nombre. Los contenedores, la red y las imágenes de una sesión no se mezclan con los de otra. Por eso dos estudiantes pueden jugar el mismo laboratorio a la vez.
- **`--project-directory`**: todas las rutas relativas de tu `compose.yaml` (`build: ./webtop`, `./templates:/etc/nginx/conf.d:ro`, etc.) se calculan **desde la carpeta donde está tu `compose.yaml`**, no desde la raíz del zip.
- **El orden de los `-f`**: primero va el archivo base y después el tuyo. Cuando dos archivos dicen cosas distintas sobre el mismo elemento, **gana el último**, es decir, el tuyo. Por eso la plataforma no te deja tocar lo que es suyo.

#### Qué contiene el archivo base

```yaml
services:
  labaccessproxy:
    image: nginx:latest
    ports:
      - "443"
    volumes:
      - "<carpeta de certificados>:/etc/nginx/ssl:ro"
      - "<carpeta base>/default.conf:/etc/nginx/conf.d/default.conf:ro"
    networks:
      - publicnet
      - labnet
networks:
  publicnet:
    driver: bridge
  labnet:
    internal: true
```

Y el proxy usa esta configuración (resumida):

```nginx
server {
    listen 443 ssl;
    resolver 127.0.0.11 valid=10s;

    location / {
        set $upstream webtop:3000;
        proxy_pass http://$upstream;
        # (cabeceras para WebSocket y Host)
    }
}
```

De ahí salen las reglas que debes respetar:

| El archivo base define | Consecuencia para tu laboratorio |
| --- | --- |
| Un servicio `labaccessproxy` | Ese nombre está reservado. Si lo declaras, tu definición se mezclaría con la de la plataforma y podrías romper el acceso de todos. |
| El proxy publica el puerto `443` **sin número fijo** en el servidor | Docker asigna un puerto aleatorio por sesión. Así dos sesiones no chocan. Por eso tus servicios **no deben publicar puertos**: ya hay una única puerta de entrada y la decide la plataforma. |
| El proxy envía todo a `webtop:3000` por HTTP | Debes tener un servicio llamado exactamente `webtop`, que hable HTTP en el puerto 3000 y esté en `labnet`. El proxy se encarga del HTTPS y del certificado. |
| La red `labnet` con `internal: true` | Tus servicios no tienen salida a internet con el laboratorio en marcha. Tampoco puedes fijar subredes ni direcciones IP. |
| La red `publicnet` | Solo la usa el proxy para ser alcanzable desde afuera. Está reservada y tus servicios no se conectan a ella. |
| Las rutas del certificado y de `default.conf` se llenan con variables del servidor | Es una de las razones por las que tu `compose.yaml` no puede usar variables `${...}`: se resolverían con el entorno del servidor, no con el tuyo. |

#### Cómo queda todo junto

Con la plantilla de inicio de esta guía, el resultado combinado equivale a esto (simplificado):

```yaml
name: "1234"                      # el id de la sesión
services:
  labaccessproxy:                 # viene del archivo base
    image: nginx:latest
    ports: ["443"]                # puerto aleatorio del servidor → 443 del proxy
    networks: [publicnet, labnet]
  webtop:                         # viene de tu compose.yaml
    build: ./webtop
    networks: [labnet]
  web:                            # viene de tu compose.yaml
    image: nginx:alpine
    networks:
      labnet:
        aliases: [mitienda.com]
networks:
  publicnet:                      # viene del archivo base
    driver: bridge
  labnet:                         # viene del archivo base: tú no la declaras
    internal: true
```

Observa que tú nunca escribes la sección `networks:` del final: solo escribes `networks: - labnet` dentro de cada servicio y la red ya existe gracias al archivo base. Si intentaras redefinir `labnet` (por ejemplo con `internal: false`), tu valor se impondría sobre el de la plataforma y le darías internet a tu laboratorio, por eso no está permitido.

Puedes ver este resultado en tu computador con `docker compose -f local-base.yaml -f compose.yaml config`; el archivo `local-base.yaml` se explica en [Probar tu laboratorio](#probar-tu-laboratorio).

#### Qué elementos se combinan y cuáles chocan

| Elemento | ¿Qué ocurre al combinar? |
| --- | --- |
| Tus servicios (`webtop`, `fakebank`, `redis`, etc.) | Se **agregan** a los de la plataforma. Es el uso normal. |
| Un servicio tuyo con el mismo nombre que uno de la plataforma (`labaccessproxy`) | Se **fusiona campo por campo** con el de la plataforma. Está prohibido. |
| `networks: - labnet` dentro de tu servicio | Se conecta a la red que define el archivo base. Es obligatorio en todos los servicios. |
| Redefinir `labnet` o `publicnet` en la sección `networks:` del final | Se fusionaría con la definición de la plataforma. Está prohibido. |
| `ports` en un servicio | Los puertos se **acumularían** con los de la plataforma y se abrirían en el servidor. Está prohibido. |
| Variables `${VAR}` y archivo `.env` | Se resolverían con el entorno del servidor. No están permitidos: escribe los valores directamente. |
| Rutas relativas en `build` y `volumes` | Se calculan desde la carpeta de tu `compose.yaml`. Funcionan mientras apunten **dentro** de tu zip. |
| Un segundo archivo compose (`include`, `extends` de otro archivo, otro `compose.yaml`) | No se usa. La plataforma solo conoce un archivo compose por laboratorio. |

### La red labnet

Todos los servicios de tu laboratorio viven en `labnet`, una red interna creada solo para esa sesión. Esto tiene consecuencias de diseño:

- **Sin internet en ejecución.** Ni los servicios ni el escritorio pueden salir de la red. Instala todo lo que necesites durante el `build`.
- **Descubrimiento por nombre.** Docker resuelve los nombres de los servicios y los *aliases* dentro de `labnet`. Si tienes un servicio `fakebank`, desde el escritorio lo alcanzas como `fakebank`.
- **Aislamiento entre sesiones.** Cada sesión tiene su propia `labnet`. Un estudiante nunca ve los servicios de otro, y por eso puedes usar el mismo alias (por ejemplo `fakebank.com`) en todas las sesiones sin que choquen.
- **Direcciones IP variables.** La subred la elige Docker y puede ser distinta en cada sesión. No escribas IPs en tus instrucciones ni en tu configuración; usa nombres.
- **El proxy de la plataforma también está en `labnet`.** Si tu ejercicio incluye escanear la red, el estudiante verá un host adicional (`labaccessproxy`, con el puerto 443 abierto). Es parte de la plataforma y no forma parte del objetivo. También verá el propio `webtop`.
- **Los nombres de tus servicios son visibles.** Un estudiante puede resolver `redis`, `db` o `admin-panel` desde el escritorio. Si tu ejercicio consiste en descubrir qué servicios existen, ponles nombres que no delaten la respuesta y usa *aliases* para los dominios que el estudiante debe encontrar.

### Quién ve qué

```
Navegador del estudiante
        │  HTTPS (puerto aleatorio del servidor)
        ▼
 [ labaccessproxy ]        ← plataforma, red publicnet + labnet
        │  HTTP, red labnet
        ▼
 [ webtop :3000 ]          ← tu escritorio
        │  red labnet (sin salida a internet)
        ▼
 [ tus servicios ]         ← fakebank, redis, bases de datos, etc.
```

El estudiante **solo llega al escritorio**. Los demás servicios solo son accesibles desde dentro del escritorio, con sus herramientas (navegador, terminal, `curl`, `nmap`, etc.). Esto implica que:

- Un servicio vulnerable no se puede abrir desde el navegador del estudiante, solo desde el navegador o la terminal del `webtop`.
- No hay forma de que el estudiante use sus propias herramientas desde su computador contra tu laboratorio. Todo lo que necesite debe estar instalado en el `webtop`.

### Qué pone la plataforma y qué pones tú

| La plataforma se encarga de | Tú te encargas de |
| --- | --- |
| El proxy HTTPS y su certificado | El archivo `compose.yaml` |
| Crear la red `labnet` y aislarla de internet | El servicio `webtop` y sus herramientas |
| Elegir y publicar el puerto de acceso | Los servicios vulnerables y sus datos |
| Iniciar, reiniciar y detener sesiones | La flag y el camino hasta ella |
| Registrar comandos y procesos del `webtop` para los trofeos | Las instrucciones, el puntaje y los trofeos |

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

Todo el contenido va dentro de **una sola carpeta raíz**. El nombre de esa carpeta es libre. El `compose.yaml` va directamente dentro de ella. Todo lo que el `compose.yaml` necesite (Dockerfiles, archivos de apoyo, plantillas) debe estar en esa misma carpeta o en subcarpetas, porque las rutas relativas se calculan desde ahí.

### Reglas del zip

- Sube **un solo archivo** con extensión `.zip`, de hasta **50 MB**.
- Debe ser un zip real y **sin contraseña**. Renombrar otro tipo de archivo a `.zip` no sirve: se revisa el contenido.
- El archivo de composición debe llamarse exactamente `compose.yaml`. Nombres como `docker-compose.yml` o `compose.yml` no se reconocen.
- Debe haber **un solo** `compose.yaml` en todo el zip.
- El runner busca el `compose.yaml` hasta dos carpetas de profundidad desde la raíz del zip. Si lo escondes más abajo, no lo encuentra.
- No incluyas un archivo `.env`: no se usa y el zip se rechaza.
- No incluyas enlaces simbólicos, rutas absolutas ni rutas que salgan de la carpeta (`../`), ni nombres de archivo duplicados.
- El zip no puede descomprimirse a un tamaño desproporcionado (se rechazan las "bombas zip").
- No incluyas credenciales reales, llaves privadas ni datos personales.

Todas estas comprobaciones se hacen **cuando creas el laboratorio**: si algo no cumple, la plataforma rechaza el zip y te muestra el motivo concreto en el formulario. Lo que no se puede detectar al subirlo (por ejemplo, que un servicio se caiga al arrancar) solo se descubre cuando alguien inicia una sesión.

### Consejos para armar el zip

- **Finales de línea:** si trabajas en Windows, guarda los scripts de shell (`.sh`) con finales de línea LF, no CRLF. Un script con CRLF falla dentro de Linux con errores como `bad interpreter`. Los archivos YAML no tienen este problema.
- **Permisos de ejecución:** un zip creado en Windows no conserva el permiso de ejecución. Si copias un script a la imagen, dale el permiso dentro del `Dockerfile` con `RUN chmod +x /ruta/script.sh`.
- **Mantenlo ligero:** copia solo lo necesario. Cada sesión descomprime el zip completo y construye con ese contenido.

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

Además de ser el punto de entrada, `webtop` es el único contenedor que la plataforma observa para los trofeos de comandos y procesos (ver [Trofeos](#trofeos)).

### La red `labnet`

Conecta **cada** servicio a `labnet` con `networks: - labnet`. No declares `labnet` al final de tu archivo: la plataforma ya la define.

```yaml
  fakebank:
    build: ./fakebank
    networks:
      - labnet
```

Un servicio que no esté conectado a `labnet` se rechaza al subir el zip.

### Servicios de apoyo

Agrega los servicios que necesite tu laboratorio: aplicaciones web, bases de datos, caches y similares. Puedes usar imágenes permitidas con `image:` o construir las tuyas con `build:`.

```yaml
  redis:
    image: redis:alpine
    restart: unless-stopped
    networks:
      - labnet
```

### Imágenes permitidas

Para proteger la plataforma, las imágenes (tanto en `image:` como en el `FROM` de tus Dockerfiles) solo pueden venir de estos publicadores:

- Las **imágenes oficiales de Docker** (por ejemplo `nginx`, `redis`, `python`, `node`, `postgres`, `mysql`, `alpine`, `ubuntu`, `debian`).
- Las imágenes de **LinuxServer.io**, publicadas en `docker.io`, `lscr.io` o `ghcr.io` (por ejemplo `lscr.io/linuxserver/webtop`).

Otras imágenes de Docker Hub o de otros registros se rechazan al subir el zip. Si necesitas un programa que no viene en esas imágenes, instálalo en tu `Dockerfile` con `apt`, `apk`, `pip` o `npm`.

Fija siempre la etiqueta (`nginx:1.27-alpine`, `python:3.12-alpine`) cuando puedas. Con `latest` tu laboratorio podría cambiar de comportamiento sin que lo toques.

### Dominios falsos con aliases

Para que los estudiantes visiten un dominio del laboratorio (por ejemplo `fakebank.com`) en vez de un nombre de servicio, agrega un alias en `labnet`:

```yaml
  serviceproxy:
    image: nginx:latest
    restart: unless-stopped
    volumes:
      - ./templates/webproxy:/etc/nginx/conf.d:ro
    networks:
      labnet:
        aliases:
          - fakebank.com
```

Con una plantilla de nginx como esta en `templates/webproxy/fakebank.conf`:

```nginx
resolver 127.0.0.11 valid=10s;

server {
    listen 80 default_server;
    server_name fakebank.com;

    set $upstream http://fakebank:5000;

    location / {
        proxy_pass $upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

Algunos detalles que importan:

- El alias solo resuelve el nombre. El tráfico dentro de `labnet` va por **HTTP**; el puerto lo decide la configuración de tu servicio (aquí, el 80 de `serviceproxy`).
- Usa `resolver 127.0.0.11` y una variable en `proxy_pass` para que nginx no se caiga si el servicio de destino todavía no ha arrancado.
- Un mismo alias en todas las sesiones es seguro: cada sesión tiene su propia red.
- Los alias no hacen que el estudiante vea "internet": solo existen dentro de `labnet`.

### Variables de entorno

Escribe los valores directamente en `environment:`. No uses un archivo `.env` ni la sintaxis `${VARIABLE}`: se resolverían con el entorno del servidor y no están permitidas.

```yaml
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
```

Si necesitas un signo `$` literal en un valor (por ejemplo en una contraseña), escríbelo duplicado: `$$`. Docker Compose interpreta un `$` suelto como el inicio de una variable.

### Orden de arranque y healthchecks

Docker inicia los servicios casi al mismo tiempo. Si un servicio necesita que otro esté listo (por ejemplo una base de datos), usa un `healthcheck` y `depends_on` con `condition: service_healthy`:

```yaml
  fakebank:
    build: ./fakebank
    depends_on:
      redis:
        condition: service_healthy
    networks:
      - labnet

  redis:
    image: redis:alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 10s
    networks:
      - labnet
```

Dos cosas para tener presentes:

- El arranque espera a que los servicios de los que otros dependen estén **sanos**. Si un `healthcheck` nunca pasa, el arranque falla y la sesión se cancela. Calcula bien los tiempos: `interval × retries` debe dar margen para que el servicio arranque.
- Los servicios de los que nadie depende no se esperan. El escritorio puede mostrar un error 502 unos segundos mientras termina de arrancar.

### Datos y volúmenes

- Puedes montar carpetas de tu zip con rutas **relativas** (`./templates:/etc/nginx/conf.d:ro`). Móntalas en solo lectura (`:ro`) cuando sea posible.
- No montes rutas absolutas del servidor ni el socket de Docker.
- **Evita los volúmenes con nombre.** Al detener una sesión la plataforma elimina contenedores y red, pero no volúmenes con nombre. Como un reinicio reutiliza el nombre de la sesión, los datos de un intento podrían reaparecer en el siguiente. Carga los datos iniciales desde la imagen (con `COPY` en el `Dockerfile`) o desde archivos de tu zip.

### Qué sí funciona y qué no

| Funciona | No funciona o no está permitido |
| --- | --- |
| Varios servicios (web, bases de datos, caches) en `labnet`, construidos por ti o con imágenes permitidas. | Abrir un servicio directamente desde el navegador del estudiante: solo se llega al `webtop`. |
| Comunicación entre servicios por nombre y por alias. | Internet con el laboratorio en marcha (descargas, APIs externas, actualizaciones). |
| Dominios falsos con `aliases`, sobre HTTP. | IPs fijas, subredes propias o redes adicionales: la subred la decide Docker en cada sesión. |
| `depends_on` con `healthcheck`. | `ports`, `container_name`, `network_mode`. |
| `Dockerfile` propios con imágenes base permitidas. | Variables `${...}` y archivo `.env`. |
| Montajes relativos de carpetas de tu zip. | Segundo archivo compose, `include` o `extends` hacia otro archivo. |
| Datos iniciales dentro de la imagen o del zip. | Datos que sobrevivan entre sesiones o reinicios. |
| Servicios en cualquier lenguaje que corra en una imagen permitida. | Montar `/var/run/docker.sock` o rutas absolutas del servidor. |
| Registro de comandos y procesos del `webtop`. | Registro de comandos o procesos de los demás servicios. |

## Preparar el escritorio (webtop)

### El Dockerfile del webtop

El escritorio es una imagen de escritorio web que escucha en el puerto 3000. La opción recomendada es partir de la imagen webtop de LinuxServer y agregarle lo que tu laboratorio necesite. La variante probada con la plataforma es `ubuntu-xfce`:

```dockerfile
FROM lscr.io/linuxserver/webtop:ubuntu-xfce

RUN apt update && \
    apt install -y --no-install-recommends \
        curl \
        iputils-ping \
        iproute2 \
        dnsutils \
        procps \
        sqlite3 \
        hydra && \
    apt clean
```

Las demás variantes de webtop (Alpine, Fedora, etc.) pueden funcionar para el escritorio, pero no se han probado con el registro de comandos de los trofeos. Si usas trofeos de comandos, quédate con `ubuntu-xfce`.

Tu `Dockerfile` puede instalar paquetes, copiar archivos y modificar la imagen. Las imágenes base deben cumplir la política de [Imágenes permitidas](#imágenes-permitidas).

### El usuario del escritorio

En las imágenes webtop de LinuxServer el estudiante trabaja con el usuario `abc`, cuya carpeta personal es `/config`. Ten en cuenta que esta carpeta forma parte del estado que la imagen administra y puede repoblarse al arrancar.

### Herramientas y archivos de práctica

- Instala las herramientas en el `Dockerfile`, no durante la sesión.
- Copia los archivos de práctica (listas de palabras, muestras, etc.) a una ruta fija **fuera de cualquier carpeta personal**, por ejemplo `/usr/share/wordlists/`. No los pongas en `/config`: ahí la imagen puede reiniciarlos o repoblarlos.
- Indica en las instrucciones la ruta exacta donde el estudiante encontrará esos archivos.

```dockerfile
COPY wordlists/lab-wordlist.txt /usr/share/wordlists/lab-wordlist.txt
RUN chmod 644 /usr/share/wordlists/lab-wordlist.txt
```

### Navegador y dominios sin HTTPS

Si tu laboratorio expone sitios solo por HTTP (lo normal con aliases), el navegador del escritorio puede intentar `https://` primero cuando el estudiante escribe un dominio sin esquema, y la conexión será rechazada. Además, el DNS seguro del navegador no funciona sin internet. Puedes evitarlo con una política que desactive ambos comportamientos:

```dockerfile
RUN mkdir -p /etc/chromium/policies/managed /etc/opt/chrome/policies/managed && \
    printf '{\n  "DnsOverHttpsMode": "off",\n  "HttpsUpgradesEnabled": false\n}\n' > /etc/chromium/policies/managed/lab-policy.json && \
    printf '{\n  "DnsOverHttpsMode": "off",\n  "HttpsUpgradesEnabled": false\n}\n' > /etc/opt/chrome/policies/managed/lab-policy.json
```

Si no la usas, indica en las instrucciones que el estudiante escriba `http://` explícitamente.

### Sin internet en ejecución

La construcción de imágenes **sí** tiene acceso a internet, pero el laboratorio ya en marcha **no**: `labnet` es una red interna. Por eso:

- Instala todo lo que necesites durante el `build`.
- No dependas de descargas, APIs externas ni actualizaciones mientras el laboratorio corre.
- Si los estudiantes deben descargar algo, sírvelo desde uno de tus propios servicios.

### El historial de comandos lo configura la plataforma

No necesitas configurar el historial de bash para los trofeos de comandos: al iniciar la sesión, la plataforma agrega por sí sola la configuración necesaria dentro del `webtop`. Solo necesita que exista `bash` y que la carpeta del usuario sea `/config` (como en las imágenes de LinuxServer).

## Flags

### Formato de la flag

- Usa un formato reconocible, por ejemplo `FLAG{texto_unico_del_laboratorio}`. El botón **Generar** del formulario crea una aleatoria.
- Tiene entre 4 y 100 caracteres y no puede contener espacios.
- Cada laboratorio necesita una flag **distinta**: la plataforma no permite repetirla entre laboratorios.
- La comparación distingue mayúsculas de minúsculas. Los espacios al inicio y al final que escriba el estudiante se ignoran.

### Dónde esconderla

- Colócala en el servicio objetivo: un campo de base de datos, un archivo detrás de un login, un panel de administración.
- No la pongas en la imagen del `webtop`: el estudiante la encontraría sin resolver nada.
- Haz que sea imposible llegar a ella sin completar el recorrido que diseñaste.
- La flag es **la misma para todos los estudiantes** (no se genera una por sesión). Un estudiante que la comparta con otro le ahorra el recorrido; tenlo en cuenta al diseñar el laboratorio y complementa con trofeos de comandos o procesos que exijan hacer el recorrido.

### Cómo se valida

El estudiante escribe la flag en la página de la sesión. La plataforma la compara, en el servidor, con la que registraste al crear el laboratorio. Si coincide, la sesión termina, se guarda el tiempo, se otorga el puntaje y el laboratorio queda marcado como resuelto. Cada intento incorrecto se cuenta (lo usan los trofeos de intentos fallidos).

La flag debe existir realmente dentro de tu laboratorio y coincidir exactamente con la que escribiste en el formulario. Si cambias el contenido del zip, cambia también la flag cuando corresponda.

## Crear el laboratorio en la plataforma

### Campos del formulario

| Campo | Regla |
| --- | --- |
| Título | Obligatorio, de 3 a 50 caracteres: letras (con tildes y ñ), números, espacios y `. , : ( ) ¿ ? ¡ ! -`. No puede repetirse (sin distinguir mayúsculas). |
| Descripción | Obligatoria, hasta 500 caracteres. |
| Beneficios | Entre 3 y 8, de hasta 100 caracteres cada uno, con los mismos caracteres permitidos que el título. Escribe uno y presiona **Enter** para agregarlo; el botón **×** lo elimina. |
| Flag | Obligatoria, de 4 a 100 caracteres, sin espacios, única entre laboratorios. El botón **Generar** crea una aleatoria. |
| Archivo zip | Exactamente un archivo `.zip` de hasta 50 MB. Puedes arrastrarlo o elegirlo, y el botón **Ver archivos** lo muestra antes de enviar. |
| Dificultad y puntaje | Obligatorio. Eliges uno de cinco niveles (100, 200, 300, 400 o 500 puntos). |
| Instrucciones | Obligatorias, hasta 20 000 caracteres, en Markdown. Escríbelas en el formulario (con vista previa) o importa un archivo `.md`. |
| Trofeos | Opcionales. Puedes añadir trofeos propios de bronce, plata y oro. |

Al presionar **Crear Laboratorio** se revisan todos los campos a la vez y los errores aparecen juntos. Luego la plataforma comprueba que el título no esté repetido, valida el contenido del zip y guarda el laboratorio. Si la flag o el título ya existen, el error aparece en el campo correspondiente.

### Dificultad y puntaje

Elegir un nivel define cuánta experiencia (XP) recibe el estudiante al resolver el laboratorio: el puntaje del laboratorio se convierte en XP para su perfil. También se muestra en la lista de laboratorios para que los estudiantes sepan qué tan difícil es.

Elige el nivel según el esfuerzo real del recorrido, no por cuánto quieras que valga. Un laboratorio de 500 puntos debería exigir varios pasos encadenados; uno de 100 puntos, un solo concepto.

### Trofeos

Cada laboratorio incluye automáticamente un trofeo de bronce por **resolverlo**. Además puedes añadir trofeos propios. Cada trofeo tiene un tipo (**bronce, plata u oro**), un nombre, una descripción y un criterio. El formulario te muestra cuántos trofeos propios puedes añadir en total y cuántos por tipo, y también los límites de caracteres del nombre y la descripción.

Estos son los criterios disponibles:

| Criterio | Cuándo se otorga |
| --- | --- |
| Tiempo | Si el estudiante resuelve el laboratorio en menos del tiempo indicado (minutos y segundos). |
| Intentos fallidos | Si resuelve el laboratorio con ese número de intentos fallidos de flag o menos. Con `0`, solo si no se equivoca ninguna vez. |
| Comando | Si algún comando escrito en la terminal del `webtop` contiene **todos** los fragmentos indicados. |
| Proceso | Si algún proceso en ejecución dentro del `webtop` contiene **todos** los fragmentos indicados. |

El formulario también muestra criterios marcados como "próximamente"; todavía no se pueden usar.

Los trofeos de **tiempo** e **intentos fallidos** solo pueden otorgarse si el estudiante resuelve el laboratorio. Los de **comando** y **proceso** cuentan aunque no lo resuelva.

#### Cómo funcionan los fragmentos de comando y de proceso

Los dos criterios usan de 1 a 4 **fragmentos** de texto de entre 2 y 50 caracteres. La regla es:

- **Todos** los fragmentos deben aparecer en **la misma línea** (el mismo comando, o la misma línea de proceso).
- Pueden aparecer en cualquier orden.
- Se distingue entre mayúsculas y minúsculas.

Ejemplo: con los fragmentos `nmap` y `-sV`, se otorga si el estudiante escribe `nmap -sV fakebank.com` o `nmap fakebank.com -sV`. No se otorga si escribe `nmap fakebank.com` y, en otra línea, `ls -sV`.

Por eso los fragmentos no funcionan como una lista de pasos que el estudiante pueda completar en comandos separados: tienen que coincidir en una sola línea.

#### Qué se registra y qué no

Es importante conocer la forma en que la plataforma recoge la evidencia, para diseñar trofeos que se puedan otorgar de forma justa:

| | Comandos | Procesos |
| --- | --- | --- |
| Dónde se registra | El historial de `bash` del usuario del `webtop` (`/config/.bash_history`). | Los procesos que corren dentro del contenedor `webtop`. |
| Cuándo se registra | Cada comando se guarda cuando termina y vuelve el prompt. | Se toma una muestra cada ~10 segundos y una más al terminar la sesión. |
| Cuándo se lee | Al terminar o detener la sesión, antes de destruir los contenedores. | Igual. |
| Qué cuenta | El texto escrito, aunque el comando falle o no exista. | Solo lo que alcanza a verse en una muestra. |
| Qué no cuenta | Comandos en otros contenedores, otros intérpretes (`zsh`, `sh`) o desde scripts. | Procesos de otros contenedores. |

Consecuencias prácticas:

- Un **proceso muy corto** (por ejemplo `ping -c 1`) puede terminar entre dos muestras y no registrarse. Para comandos rápidos usa el criterio **Comando**; el de **Proceso** es para herramientas que corren un buen rato (`hydra`, `hashcat`).
- Un comando que sigue ejecutándose cuando el estudiante termina la sesión todavía no se guardó en el historial. Si es una herramienta larga, cúbrela también con un trofeo de **Proceso**.
- Los procesos que el escritorio ya tiene al arrancar también se registran. No uses como fragmento algo que ya esté corriendo por defecto (por ejemplo `xfce`), porque se otorgaría a todos.
- Cada línea de proceso se recorta a 200 caracteres: un fragmento que aparezca más allá de ese punto no se detectará.
- Si el estudiante reinicia el laboratorio, la evidencia anterior se descarta.

### Editar o eliminar un laboratorio

- Los instructores gestionan sus propios laboratorios y los administradores pueden gestionar cualquiera.
- Cambiar el archivo zip de un laboratorio exige también registrar una **flag nueva**. El reemplazo se aplica cuando no hay sesiones abiertas de ese laboratorio: mientras tanto, la plataforma sigue usando la copia anterior del zip.
- Las instrucciones se pueden modificar. El formulario de gestión te muestra qué otros campos admiten cambios.
- Al eliminar un laboratorio se eliminan también sus sesiones y los reportes asociados.

## Instrucciones para estudiantes

Las instrucciones se escriben en Markdown directamente en el formulario de creación. La pestaña **Vista previa** muestra exactamente lo que verá el estudiante. También puedes escribirlas en tu editor favorito y usar el botón **Importar .md** o arrastrar el archivo sobre el cuadro de texto (hasta 100 KB; si ya habías escrito algo, la plataforma te pregunta antes de reemplazarlo).

### Escribir buenos pasos

- Una acción por paso, con un título corto.
- Pon los comandos en bloques de código para que se puedan copiar.
- Explica qué debe ver el estudiante si el paso salió bien.
- Da pistas, no la solución completa. Si quieres más ayuda, ponla en pasos posteriores.
- Nombra las rutas y archivos exactos que el estudiante va a necesitar.
- Usa nombres de servicio o dominios, nunca direcciones IP: cambian entre sesiones.
- Si tu laboratorio usa dominios sin HTTPS, recuerda indicar `http://` (a menos que hayas aplicado la política del navegador).

### Formato Markdown disponible

| Quieres | Escribes |
| --- | --- |
| Título de sección | `## Título` |
| Texto en negrita | `**texto**` |
| Comando o código en línea | `` `comando` `` |
| Bloque de código | tres comillas invertidas antes y después (puedes indicar el lenguaje, por ejemplo `bash`, para resaltar la sintaxis) |
| Lista | `- elemento` |
| Lista con pasos | `1. paso` |
| Casilla de verificación | `- [ ] tarea` |
| Enlace | `[texto](https://...)` |
| Tabla | columnas separadas con `\|` |

No se permiten imágenes ni HTML dentro de las instrucciones.

## Probar tu laboratorio

### Prueba local con Docker Compose

En tu computador no existe el proxy de la plataforma. Para acercarte lo más posible al comportamiento real, crea estos dos archivos **junto a tu `compose.yaml`** (no los incluyas en el zip). Son una versión sencilla del archivo base: mantienen la red `labnet` interna y un proxy que envía al `webtop`.

`local-base.yaml`:

```yaml
services:
  labaccessproxy:
    image: nginx:latest
    ports:
      - "8080:80"
    volumes:
      - ./local-proxy.conf:/etc/nginx/conf.d/default.conf:ro
    networks:
      - publicnet
      - labnet

networks:
  publicnet:
    driver: bridge
  labnet:
    internal: true
```

`local-proxy.conf`:

```nginx
server {
    listen 80;
    resolver 127.0.0.11 valid=10s;

    location / {
        set $upstream webtop:3000;
        proxy_pass http://$upstream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Luego inicia el laboratorio:

```bash
docker compose -p mitest -f local-base.yaml -f compose.yaml up --build
```

Abre `http://localhost:8080` en el navegador: deberías ver el escritorio. Cuando termines, detén y limpia todo:

```bash
docker compose -p mitest -f local-base.yaml -f compose.yaml down -v
```

Como `labnet` es interna, con esta configuración tu laboratorio ya funciona **sin internet** (igual que en la plataforma), mientras que la construcción de imágenes sigue teniendo acceso. Si algo depende de internet, lo verás fallar aquí.

Para ver cómo queda la fusión de los dos archivos (los servicios, las redes y los alias finales) sin iniciar nada:

```bash
docker compose -f local-base.yaml -f compose.yaml config
```

Diferencias con la plataforma:

- Localmente el proxy usa HTTP en el puerto 8080; en la plataforma usa HTTPS en un puerto aleatorio con su propio certificado.
- La plataforma no usa tu `local-base.yaml`, así que no cuentes con nada que definas allí.
- El registro de comandos y procesos para los trofeos solo existe en la plataforma.

### Lista de verificación antes de subir

- [ ] El archivo se llama exactamente `compose.yaml` y está dentro de la carpeta raíz del zip.
- [ ] Hay una sola carpeta raíz y un solo `compose.yaml`.
- [ ] Existe un servicio `webtop` que escucha HTTP en el puerto 3000 y está en `labnet`.
- [ ] Todos los servicios están en `labnet` y no declaras la red al final del archivo.
- [ ] No usas `ports`, `container_name`, `network_mode` ni nombres fijos para redes o volúmenes.
- [ ] No usas `.env`, variables `${...}` ni IPs fijas.
- [ ] Las imágenes (`image:` y `FROM`) son oficiales de Docker o de LinuxServer.
- [ ] No dependes de internet mientras el laboratorio corre.
- [ ] Probaste el laboratorio local de principio a fin con `local-base.yaml` y llegaste a la flag siguiendo tus propias instrucciones.
- [ ] La flag es única y no está en la imagen del `webtop`.
- [ ] Los scripts `.sh` tienen finales de línea LF y permiso de ejecución desde el `Dockerfile`.
- [ ] Las instrucciones usan nombres, no IPs, y mencionan las rutas exactas.
- [ ] Los fragmentos de tus trofeos de comando y proceso aparecen en una misma línea y no coinciden con algo que el escritorio ya ejecuta.
- [ ] El zip contiene solo lo necesario y pesa menos de 50 MB.

### Probar en la plataforma

Después de subirlo, inicia el laboratorio desde la página de **Laboratorios** y recórrelo completo, con las instrucciones abiertas tal como las verá un estudiante. Prueba también **Reiniciar Lab** y **Terminar Lab** para confirmar que el entorno se levanta bien desde cero. Si definiste trofeos de comandos o procesos, comprueba que se otorgan.

## Reglas de seguridad y límites

### Qué está prohibido

Estas opciones ponen en riesgo a los demás estudiantes o a la plataforma y no están permitidas en el `compose.yaml`. Si las incluyes, el zip se rechaza al crear el laboratorio:

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
| Variables `${...}` y archivos `.env` | Se resolverían con el entorno del servidor. |

Los laboratorios que incumplan estas reglas pueden ser eliminados por los administradores.

### Contenido permitido

- Todo debe ser ficticio y con fines educativos.
- No uses datos personales reales, credenciales reales ni sistemas de terceros como objetivos.
- Respeta las licencias del software que incluyas en tus imágenes.

## Solución de problemas

| Síntoma | Causa probable | Qué revisar |
| --- | --- | --- |
| El zip se rechaza al subirlo | No cumple alguna regla de la plataforma. | Lee el mensaje del formulario: indica el motivo concreto. Revisa la [lista de verificación](#lista-de-verificación-antes-de-subir). |
| El laboratorio tarda mucho en cargar | Primera construcción de imágenes. | Normal la primera vez. Si pasan más de unos minutos, revisa que tu `build` no sea muy pesado. |
| "No se pudo construir o arrancar el laboratorio" | Error en un `Dockerfile`, un archivo que falta en el zip, una etiqueta que no existe o un `healthcheck` que nunca pasa. | Reproduce el problema en local con `docker compose ... up --build` y mira la salida. |
| Error 502 o pantalla en blanco al abrir el escritorio | El `webtop` no responde por HTTP en el puerto 3000, o no está en `labnet`, o se está reiniciando. | Espera unos segundos y recarga. Si persiste: comprueba el nombre exacto `webtop`, el puerto 3000 y la red. |
| No llego a un servicio desde webtop | Servicio fuera de `labnet`, alias mal escrito, puerto inesperado o servicio caído. | En la terminal del escritorio prueba `curl http://fakebank.com`. Revisa red, alias y puerto. |
| El navegador del escritorio rechaza la conexión a un dominio del laboratorio | El navegador intenta `https://` y tu servicio solo escucha HTTP. | Escribe `http://` o aplica la política de navegador de [Navegador y dominios sin HTTPS](#navegador-y-dominios-sin-https). |
| Un script de mi imagen falla con `bad interpreter` o `permission denied` | Finales de línea CRLF o falta de permiso de ejecución. | Guarda el script con LF y agrega `RUN chmod +x` en el `Dockerfile`. |
| Los datos de un intento reaparecen tras reiniciar | Usas un volumen con nombre. | Carga los datos desde la imagen o desde archivos del zip. |
| La flag no se acepta | No coincide exactamente con la registrada. | Mayúsculas y minúsculas importan. Los espacios al inicio o al final se ignoran, los del medio cuentan. |
| Un trofeo de comando no se otorgó | Los fragmentos no están todos en una misma línea, o el comando no se terminó de ejecutar. | Revisa [Cómo funcionan los fragmentos](#cómo-funcionan-los-fragmentos-de-comando-y-de-proceso). |
| Un trofeo de proceso no se otorgó | El proceso duró menos que el intervalo de muestreo. | Usa el criterio **Comando** para acciones rápidas. |

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

RUN apt update && \
    apt install -y --no-install-recommends curl && \
    apt clean
```

`web/index.html`:

```html
<h1>Mi tienda</h1>
<p>Reemplaza este contenido con tu objetivo vulnerable.</p>
```

Desde el escritorio, `curl http://mitienda.com` debería mostrar esa página. Cuando funcione, comprime la carpeta `mi-laboratorio/` completa en un `.zip` y súbela desde el formulario de creación.