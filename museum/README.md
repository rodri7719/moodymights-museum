# MoodyMights Museum — Deploy Guide

## Estructura del repositorio

```
/
├── index.html              ← renombrar moody_museum_v3_html.html a esto
├── vercel.json             ← config de Vercel
├── api/
│   └── alchemy.js          ← serverless function (solo Vercel)
└── fondo 1920.png          ← imagen de fondo (subir también)
```

---

## Deploy en Vercel (recomendado)

1. Subí todos estos archivos a tu repo de GitHub
2. Renombrá el HTML a `index.html`
3. En Vercel → Settings → Environment Variables, agregá:
   ```
   ALCHEMY_API_KEY = 2KVtnElWVnXZLK1_nAgoS
   ```
4. Conectá el repo en vercel.com → "Import Project"
5. Deploy automático ✓

La función `/api/alchemy` queda disponible como proxy seguro.

---

## Deploy en GitHub Pages (solo HTML estático)

GitHub Pages **no corre serverless functions**, pero el HTML ya llama
directo a Alchemy desde el browser — funciona igual.

1. Renombrá el HTML a `index.html`
2. Subí `index.html` + `fondo 1920.png` al repo
3. En GitHub → Settings → Pages → Branch: `main` / root `/`
4. Listo ✓

> La API key queda visible en el HTML del lado del cliente.
> Para mayor seguridad, usá Vercel con la variable de entorno.

---

## Si los NFTs siguen sin cargar

Verificá que tu Alchemy key esté activa:
- https://dashboard.alchemy.com → Apps → tu app → API Key
- La key actual configurada: `2KVtnElWVnXZLK1_nAgoS`
- Red habilitada: **Ethereum Mainnet** y **Abstract Mainnet**
