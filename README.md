# Botsito 🤖

[![CI](https://github.com/samuelhuicab/Bot_15_Diciembre/actions/workflows/ci.yml/badge.svg)](https://github.com/samuelhuicab/Bot_15_Diciembre/actions/workflows/ci.yml)
[![Licencia: MIT](https://img.shields.io/badge/licencia-MIT-blue.svg)](LICENSE)

Bot de WhatsApp **open source** pensado como **base extensible**: trae comandos útiles, platica con IA **gratis** (Groq, Gemini, OpenRouter) y cualquiera puede agregar sus propios comandos, **públicos** (se suben al repo) o **privados** (solo viven en tu servidor).

> ⚠️ **Aviso:** usa [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js), que **no es oficial**. WhatsApp puede banear el número. **Usa un número secundario** para el bot.

## ✨ Qué hace

- 💬 **Modo plática con IA:** háblale por su nombre (`bot ¿qué onda?`) o mencionándolo con @. Recuerda los últimos mensajes de cada chat.
- 🔁 **IA gratis con respaldo:** si un proveedor llega a su límite o falla, pasa solo al siguiente.
- 🧩 **Comandos listos:** clima, tipo de cambio, recordatorios, calculadora, traductor y más.
- 🔒 **Comandos y personalidad privados:** cada quien personaliza su bot sin tocar el repo.
- 🪶 **Ligero:** sin base de datos; corre en un VPS de 1 vCPU / 1–2 GB.

## 📋 Requisitos

- [Node.js](https://nodejs.org/) **22 o superior**
- Un número de WhatsApp para el bot (de preferencia secundario)
- Opcional: una clave gratis de al menos un proveedor de IA ([Groq](https://console.groq.com/keys), [Gemini](https://aistudio.google.com/apikey) u [OpenRouter](https://openrouter.ai/keys)). Sin claves, el bot funciona igual pero sin IA.

## ⚡ Empezar en tu computadora

```bash
git clone https://github.com/samuelhuicab/Bot_15_Diciembre.git
cd Bot_15_Diciembre
npm install
```

Copia la configuración de ejemplo y edítala (nombre del bot, tu número, claves de IA):

```bash
cp .env.example .env
```

> En PowerShell: `Copy-Item .env.example .env`

Arranca el bot:

```bash
npm run dev
```

Escanea el QR con el celular del bot (WhatsApp → **Dispositivos vinculados** → **Vincular un dispositivo**). Si el QR se ve mal en la terminal, se abre solo en tu navegador (también está en `data/qr.html`). Cuando diga **"WhatsApp listo ✅"**, mándale `!help` desde otro número.

La sesión se guarda en `data/`: la próxima vez ya no pide QR. Para cambiar de número, borra esa carpeta.

## ⚙️ Configuración (`.env`)

| Variable                                                 | Qué hace                                                                                    | Default                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------ |
| `BOT_NAME`                                               | Nombre con el que se presenta                                                               | `botsito`                |
| `BOT_TRIGGER`                                            | Palabra para platicar con él (`bot hola`)                                                   | `bot`                    |
| `COMMAND_PREFIX`                                         | Prefijo de comandos                                                                         | `!`                      |
| `OWNER_NUMBER`                                           | Tu número (solo dígitos, con código de país). Sin cooldowns y acceso a comandos `ownerOnly` | vacío                    |
| `AI_PROVIDER_ORDER`                                      | Orden en que se prueban los proveedores                                                     | `groq,gemini,openrouter` |
| `GROQ_API_KEY` / `GEMINI_API_KEY` / `OPENROUTER_API_KEY` | Claves de IA (solo se usan los que tengan clave)                                            | vacío                    |
| `GROQ_MODEL` / `GEMINI_MODEL` / `OPENROUTER_MODEL`       | Modelo de cada proveedor                                                                    | ver `.env.example`       |
| `AI_USER_COOLDOWN`                                       | Segundos entre usos de IA por persona                                                       | `10`                     |
| `AI_HISTORY_SIZE`                                        | Mensajes que recuerda por chat                                                              | `6`                      |
| `AI_MAX_TOKENS`                                          | Largo máximo de cada respuesta                                                              | `300`                    |
| `AI_COOLDOWN_ON_429`                                     | Segundos que descansa un proveedor al llegar a su límite                                    | `60`                     |
| `HTTP_TIMEOUT`                                           | Timeout de APIs externas (segundos)                                                         | `10`                     |
| `LOG_LEVEL`                                              | `fatal`, `error`, `warn`, `info`, `debug`                                                   | `info`                   |

Si algo está mal escrito, el bot no arranca y te dice exactamente qué corregir.

> Los nombres de los modelos gratis cambian seguido. Si un proveedor responde "modelo no existe", el log lo avisa: actualiza su `*_MODEL` en `.env` y reinicia.

## 💬 Comandos incluidos

| Comando                        | Qué hace                                                  |
| ------------------------------ | --------------------------------------------------------- |
| `!help [comando]`              | Lista de comandos o detalle de uno                        |
| `!ping`                        | ¿Está vivo? Y cuánto lleva despierto                      |
| `!clima <ciudad>`              | Clima actual y del día (`!clima Monterrey, Colombia`)     |
| `!cambio [cantidad] [de] [a]`  | Tipo de cambio entre 160+ monedas (`!cambio 100 usd mxn`) |
| `!recuerda <tiempo> <texto>`   | Recordatorio en el chat (`!recuerda 30m sacar la pizza`)  |
| `!elige a, b o c`              | Elige al azar                                             |
| `!calc <operación>`            | Calculadora (`!calc 850*15%`, `!calc raiz(144)`)          |
| `!ia <pregunta>` 🤖            | Pregunta a la IA                                          |
| `!traduce <idioma> <texto>` 🤖 | Traduce con la IA                                         |

🤖 = usa IA (tiene cooldown de IA). `!help` marca con 🔒 los comandos privados.

## 🎭 Personalidad y comandos privados

Todo lo que pongas en `private/` es **tuyo**: git lo ignora y nunca se sube.

- **Personalidad:** copia `private/_prompt.js` como `private/prompt.js` y escribe cómo quieres que hable tu bot. Si no existe, usa la personalidad pública. También puedes agregar respuestas al azar que no gastan IA (`randomReplies`).
- **Comandos privados:** copia `private/commands/_ejemplo.js` con otro nombre y edítalo. Sus claves van al final de tu `.env`. Si un comando privado se llama igual que uno público, lo reemplaza.
- **Archivos:** audios, imágenes, etc. para tus comandos van en `private/media/` y se mandan con `ctx.replyFile(ruta)`.

Guía completa para crear comandos: [CONTRIBUTING.md](CONTRIBUTING.md).

---

## 🚀 Instalar en un servidor Ubuntu 24.04

Funciona en un VPS pequeño (1 vCPU, 1–2 GB de RAM) y también en un servidor que ya corre otras cosas (Odoo, nginx, bases de datos…): el bot vive en su propio usuario con su propio Node, sin tocar lo demás.

Necesitas entrar al servidor con un usuario que pueda usar `sudo` (o como `root`, quitando el `sudo` de los comandos).

### 0. En tu computadora: empaquetar el bot

En PowerShell, dentro de la carpeta del proyecto:

```powershell
tar --exclude=node_modules --exclude=data --exclude=.git --exclude=.wwebjs_auth --exclude=.wwebjs_cache --exclude='*.tgz' -czf botsito.tgz .
```

Esto crea `botsito.tgz` con todo, **incluidos tu `.env` y `private/`**. No compartas ese archivo.

> Apaga el bot en tu computadora antes de prenderlo en el servidor: si los dos corren a la vez, responden doble.

### 1. Conectarte y revisar el servidor

```bash
ssh TU_USUARIO@IP_DE_TU_SERVIDOR
lsb_release -ds; free -h; df -h /; sudo ufw status; sudo ss -tlnp | grep LISTEN
```

Fíjate en dos cosas:

- **Swap** (`free -h`): si dice `0B` y tienes 1–2 GB de RAM, haz el paso opcional A.
- **Qué está escuchando** (`ss`): si ves otros servicios (nginx, Odoo, una base de datos…), **no actives el firewall** del paso opcional B, o podrías bloquearlos.

<details>
<summary><b>Opcional A: memoria swap</b> (solo si no tienes y la RAM es de 1–2 GB)</summary>

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

</details>

<details>
<summary><b>Opcional B: firewall</b> (solo en un servidor dedicado al bot)</summary>

El bot no necesita puertos abiertos; solo se deja SSH.

```bash
sudo ufw allow OpenSSH && sudo ufw --force enable
```

</details>

### 2. Librerías que necesita Chrome

```bash
sudo apt update && sudo apt install -y curl ca-certificates fonts-liberation fonts-noto-color-emoji libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libcairo2 libcups2t64 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 libglib2.0-0t64 libgtk-3-0t64 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxkbcommon0 libxrandr2 libxrender1 libxss1 libxtst6 wget xdg-utils
```

### 3. Un usuario solo para el bot

```bash
sudo adduser --disabled-password --gecos "" botsito
```

### 4. Node 24 y pm2 (solo para el bot)

Se instalan con [nvm](https://github.com/nvm-sh/nvm) dentro de `botsito`, así no se toca el Node que ya tenga el servidor.

```bash
sudo -iu botsito
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.8/install.sh | bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
nvm install 24
npm install -g pm2
node -v; pm2 -v
exit
```

### 5. Subir el bot

En tu computadora (PowerShell, en la carpeta del proyecto):

```powershell
scp botsito.tgz TU_USUARIO@IP_DE_TU_SERVIDOR:~/
```

En el servidor:

```bash
sudo mv ~/botsito.tgz /home/botsito/ && sudo chown botsito:botsito /home/botsito/botsito.tgz
sudo -iu botsito
mkdir -p ~/botsito && tar -xzf ~/botsito.tgz -C ~/botsito && rm ~/botsito.tgz
cd ~/botsito && npm ci --omit=dev
```

`npm ci` también descarga Chrome (tarda un par de minutos).

### 6. Primer arranque y QR

Como `botsito`, dentro de `~/botsito`:

```bash
npm start
```

Escanea el QR **con el celular del bot** (WhatsApp → Dispositivos vinculados → Vincular un dispositivo). Cuando en los logs salga `"WhatsApp listo ✅"`, prueba `!ping` desde otro número y apágalo con **Ctrl+C**.

### 7. Dejarlo corriendo para siempre

Como `botsito`:

```bash
cd ~/botsito && pm2 start ecosystem.config.cjs && pm2 save
pm2 install pm2-logrotate
exit
```

Con tu usuario (para que arranque solo si el servidor se reinicia). Cambia `v24.21.0` por tu versión de `node -v` si es distinta:

```bash
sudo env PATH=$PATH:/home/botsito/.nvm/versions/node/v24.21.0/bin /home/botsito/.nvm/versions/node/v24.21.0/lib/node_modules/pm2/bin/pm2 startup systemd -u botsito --hp /home/botsito
systemctl is-enabled pm2-botsito
```

Debe decir `enabled`.

> La hora del bot (logs y recordatorios) es la de México, configurada en `ecosystem.config.cjs` (`TZ`), sin cambiar la del servidor.

### 🔧 Uso diario

Entra como el usuario del bot con `sudo -iu botsito` y:

| Qué              | Comando                            |
| ---------------- | ---------------------------------- |
| Ver si está vivo | `pm2 status`                       |
| Ver logs en vivo | `pm2 logs botsito` (salir: Ctrl+C) |
| Reiniciar        | `pm2 restart botsito`              |
| Apagar           | `pm2 stop botsito`                 |
| Salir de botsito | `exit`                             |

Sin entrar: `sudo -iu botsito bash -ic 'pm2 status'`.

### 🔄 Actualizar el bot

1. En tu computadora, vuelve a crear `botsito.tgz` (paso 0) y súbelo con `scp` (paso 5).
2. En el servidor:

```bash
sudo mv ~/botsito.tgz /home/botsito/ && sudo chown botsito:botsito /home/botsito/botsito.tgz
sudo -iu botsito
tar -xzf ~/botsito.tgz -C ~/botsito && rm ~/botsito.tgz
cd ~/botsito && npm ci --omit=dev && pm2 restart botsito
```

La sesión de WhatsApp (`data/`) no se toca, así que no pide QR otra vez.

### 🆘 Problemas comunes

- **El QR sale con letras raras (`Ôûä`):** sal del servidor y, en PowerShell, corre `chcp 65001` antes de volver a conectarte con `ssh`. Si se ve deforme, reduce el zoom (Ctrl + -).
- **Escaneaste con el celular equivocado / cambiar de número:** `pm2 stop botsito`, `rm -rf ~/botsito/data`, `npm start` para escanear el QR correcto, Ctrl+C y `pm2 restart botsito`. En el celular equivocado, cierra la sesión en Dispositivos vinculados.
- **`pm2: command not found`:** estás en una sesión sin nvm. Entra con `sudo -iu botsito` (o usa `bash -ic '…'`).
- **`Failed to launch the browser process` / falta una librería `.so`:** repite el paso 2.
- **Se reinicia solo muy seguido:** revisa `pm2 logs botsito`; si es memoria, revisa el swap (`free -h`).
- **Enviar archivos falla con `Data passed to getter must include an id property`:** es un [bug de whatsapp-web.js](https://github.com/wwebjs/whatsapp-web.js/issues/201922). El proyecto lo parcha solo al instalar (`scripts/patch-whatsapp-web.js`); si ves el error, corre `npm ci` otra vez y revisa que salga "Parche aplicado".

---

## 🧪 Desarrollo

| Comando                | Qué hace                                      |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | Arranca con recarga automática y logs bonitos |
| `npm start`            | Arranca normal (logs en JSON)                 |
| `npm test`             | Corre los tests (`node --test`)               |
| `npm run lint`         | Revisa el código con ESLint                   |
| `npm run format`       | Formatea con Prettier                         |
| `npm run format:check` | Revisa el formato sin cambiar nada            |

## 🗂️ Estructura

```
src/            el motor (casi nadie lo toca)
  whatsapp/     único lugar que conoce whatsapp-web.js
  handlers/     decide qué hacer con cada mensaje
  core/         carga de comandos, ctx y cooldowns
  ai/           proveedores, router con respaldo, modo plática y prompts
  utils/        http (ctx.http) y logger
commands/       comandos públicos (se suben al repo)
private/        lo tuyo: prompt.js, commands/, media/ (no se sube)
scripts/        parche temporal de whatsapp-web.js (postinstall)
test/           tests
data/           sesión de WhatsApp (no se sube)
```

## 🤝 Contribuir

¿Quieres agregar un comando o arreglar algo? Lee [CONTRIBUTING.md](CONTRIBUTING.md). Los reportes de bugs e ideas van en [Issues](https://github.com/samuelhuicab/Bot_15_Diciembre/issues).

## 📄 Licencia

[MIT](LICENSE)
