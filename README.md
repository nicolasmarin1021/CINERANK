# CineRank

App para **iOS y Android** que te ayuda a decidir qué película ver. Buscas las opciones que estás considerando, las añades a tu lista y CineRank las ordena de forma objetiva con las calificaciones de **IMDb** y de **Rotten Tomatoes**: la crítica (🍅 Tomatómetro) y el público (🍿 Popcornmeter).

Hecha con Expo SDK 58 (React Native 0.88, Expo Router, TypeScript).

## Qué hace

- **Buscar**: el logo de CineRank, un único buscador centrado y, abajo, una carátula de estrenos que se funde con el fondo (toca un póster para buscarlo). Al buscar aparecen los filtros (película o serie, año) y los resultados, cada uno con su nota de IMDb, la crítica (🍅) y el público (🍿) de Rotten Tomatoes. Se añaden a tu lista con el botón **+**.
- **Ranking**: el ganador aparece en portada con su **CineScore** y por cuántos puntos gana; avisa cuando hay un **empate técnico** (menos de 2 puntos de diferencia). **Editar** permite quitar títulos o vaciar la lista.
  - **Lista o Tabla**: la tabla pone los títulos lado a lado, con el mejor valor de cada criterio en dorado.
  - **Ordenar y filtrar**: ordena por CineScore, IMDb, crítica o público de RT, y filtra por duración (hasta 1 h 30, 2 h o 2 h 30).
  - **Balanza**: marca los títulos que quieres enfrentar a fondo en «¿Cuál es mejor?».
  - **Tu plan de hoy**: eliges qué te apetece (reír, adrenalina, emocionarte, pensar, pasar miedo, algo ligero) y con quién la ves (solo, en pareja, con amigos, en familia). El CineScore no cambia: aparece una puntuación «Para hoy» que resta hasta 15 puntos a lo que no encaja según género, clasificación por edad y duración, con el motivo a la vista. Vale hasta medianoche.
- **¿Cuál es mejor?**: solo los títulos que marcaste, cara a cara: puesto, CineScore en recuadro, nivel, barras de color de IMDb, crítica y público, quién gana y, en la esquina, en qué plataformas está (Netflix, HBO Max, Prime Video…). Cada icono abre el título en esa plataforma (en el teléfono, en su app).
- **Dónde verla** (en la ficha): las plataformas de tu país (el de «País del catálogo» en Explorar) con su nombre; cada una abre el título directamente si Wikidata tiene su identificador en esa plataforma, o lo busca dentro de ella si no. Con la clave de TMDB los datos son de tu país (JustWatch); sin ella, de EE. UU. (MDBList).
  - Desliza hacia abajo, o pulsa **Actualizar notas**, para volver a descargar las calificaciones.
- **Ficha**: portada a pantalla completa, el **tráiler** (se abre dentro de la app; viene de MDBList, y si no hay, un atajo para buscarlo en YouTube), las notas, la sinopsis en español (resumen de Wikipedia; si no hay artículo, la original en inglés), el desglose del CineScore, si la crítica y el público coinciden o no, la sinopsis, el reparto y enlaces a IMDb y Rotten Tomatoes.

El diseño usa una paleta inspirada en los teatros de Broadway (escenario negro, texto marfil, un único acento dorado y el rojo del telón) definida en [`src/constants/theme.ts`](src/constants/theme.ts).
- **Explorar**: para cuando no sabes qué ver. Eliges plataforma (Netflix, Disney+, Max, Prime Video…) y país, y filtras su catálogo por **IMDb 8+**, **crítica de RT 80%+**, **ganadoras del Óscar** y **año o década**. Cada póster muestra sus notas y Óscar; con **+** lo añades a tu lista. Necesita la clave gratuita de TMDB (y la de MDBList para los filtros de calidad).
- **Ajustes** (botón ⚙️ arriba en Buscar y Explorar): cuánto pesa cada fuente (con presets como “Manda la crítica” o “Manda el público”), el bonus por premios, la corrección por número de votos y tus claves de OMDb y MDBList.

## Cómo se calcula el CineScore

1. Cada fuente se pasa a una escala de 0 a 100: IMDb × 10; la crítica de RT (% de reseñas positivas) y el público de RT (% de espectadores que la valoran bien) tal cual.
2. **Corrección por votos** (opcional, viene activada): a la nota de IMDb se le aplica un promedio bayesiano, `(v·R + m·C) / (v + m)` con C = 6,5. Así, una película con 3.000 votos y un 7,9 no supera a un clásico con un millón de votos. `m` se elige en Ajustes: 2.500, 10.000 o 25.000 votos.
3. Las fuentes se combinan con los pesos que elijas. Por defecto, un tercio cada una: IMDb, RT crítica y RT público.
4. **Bonus por premios**: se suman puntos por Óscar, Emmy, BAFTA, Globos de Oro y el resto de premios que lista OMDb. Nunca resta, así que un título sin premios no se penaliza. Un Óscar ganado cuenta más que una nominación y los demás premios suman en escala logarítmica. En Ajustes eliges el máximo: sin bonus, +3, +6 (por defecto) o +10. El CineScore no pasa de 100.
5. Si a un título le falta una fuente, su peso se reparte entre las demás y la tarjeta muestra el aviso “Sin dato de…”.
6. Desempates: gana el título con más fuentes disponibles y, después, el que tiene más votos en IMDb.

| CineScore | Nivel |
|---|---|
| 85–100 | Imprescindible |
| 75–84 | Muy recomendable |
| 65–74 | Buena opción |
| 50–64 | Irregular |
| 0–49 | Mejor evítala |

La lógica está en [`src/lib/ranking.ts`](src/lib/ranking.ts) y tiene pruebas en [`tests/ranking.test.ts`](tests/ranking.test.ts).

## Fuentes de datos

IMDb y Rotten Tomatoes no ofrecen una API pública gratuita, así que CineRank combina tres servicios:

| Servicio | Aporta | Clave |
|---|---|---|
| [OMDb API](https://www.omdbapi.com) | Ficha, nota y votos de IMDb, crítica de RT (🍅) | Obligatoria, gratis |
| [MDBList](https://mdblist.com) | Público de RT (🍿), crítica de RT si OMDb no la tiene, plataformas donde verla (datos de EE. UU.) y el tráiler | Opcional, gratis |
| [Wikidata](https://www.wikidata.org) | Traduce títulos en español a su ID de IMDb, y da el ID de cada título en Netflix, Disney+, HBO Max, Apple TV, Prime Video… para abrirlo directamente | No necesita |
| [Wikipedia en español](https://es.wikipedia.org) | Sinopsis en español (resumen del artículo, licencia CC BY-SA; la ficha enlaza al artículo) | No necesita |
| Tienda de Apple (ranking público de películas, México) | Carátula de estrenos del buscador | No necesita |
| [TMDB](https://www.themoviedb.org) | Catálogo de cada plataforma por país para Explorar, y en qué plataformas de tu país está cada título (datos de JustWatch), con títulos y pósters en español | Opcional, gratis |
| [Trakt](https://trakt.tv) | Nota de quienes comentan (🗣), ponderada por «me gusta» | Opcional, gratis (Client ID) |

### OMDb

1. Pide una clave gratuita en <https://www.omdbapi.com/apikey.aspx> (plan FREE: 1.000 consultas al día).
2. Actívala con el enlace que te llega por correo.
3. Pégala en la app, en **Ajustes → Clave de OMDb → Guardar y probar**.
   Otra opción es copiar `.env.example` como `.env.local` y rellenar `EXPO_PUBLIC_OMDB_API_KEY`.

### MDBList (público de Rotten Tomatoes 🍿)

OMDb no trae el Popcornmeter, así que se obtiene de MDBList:

1. Entra en <https://mdblist.com> e inicia sesión.
2. Ve a **Preferences → API** (<https://mdblist.com/preferences/#api>) y crea tu clave gratuita (1.000 consultas al día).
3. Pégala en la app, en **Ajustes → Clave de MDBList → Guardar y probar**.
   Otra opción es rellenar `EXPO_PUBLIC_MDBLIST_API_KEY` en `.env.local`.

Sin esta clave la app funciona igual: el peso del público de RT se reparte entre IMDb y la crítica, y el Ranking muestra un aviso.

### TMDB (catálogo de Explorar)

1. Crea una cuenta gratis en <https://www.themoviedb.org>.
2. En tu perfil → **Ajustes → API** (<https://www.themoviedb.org/settings/api>) solicita una clave para uso personal.
3. Copia la **Clave de la API** (o el **Token de acceso de lectura**) y pégala en **Ajustes → Clave de TMDB → Guardar y probar**, o en `EXPO_PUBLIC_TMDB_API_KEY` dentro de `.env.local`.

Explorar recorre el catálogo de TMDB página a página (20 títulos por página) y consulta en MDBList las notas y los Óscar de cada título; con filtros de calidad pide primero los mejor valorados. Las notas se guardan 7 días. CineRank usa la API de TMDB, pero TMDB no la respalda ni certifica.

### Trakt (comentarios 🗣)

1. Crea una cuenta en <https://trakt.tv> (necesitas también una cuenta de GitHub verificada).
2. En <https://app.trakt.tv/apps> crea una app y copia su **Client ID** (no el Client Secret).
3. Pégalo en **Ajustes → Clave de Trakt → Guardar y probar**, o en `EXPO_PUBLIC_TRAKT_CLIENT_ID` dentro de `.env.local`.

CineRank pide los 50 comentarios más votados de cada título de tu lista (y del que abres en la ficha) y calcula la nota media que les dieron sus autores, dando más peso a los comentarios con más «me gusta». Hace falta un mínimo de 3 comentarios con nota. Se guarda 7 días. Sin la clave, el peso de los comentarios se reparte entre las demás fuentes. CineRank usa Trakt, pero Trakt no la respalda ni certifica.

Las fichas se guardan en caché 3 días para ahorrar consultas. En algunos estrenos muy recientes o títulos poco conocidos faltan datos de Rotten Tomatoes; en esos casos la app lo indica.

## Ejecutar la app

Necesitas Node.js 20 o superior.

```bash
npm install
```

```bash
npx expo start
```

- **En tu teléfono**: instala **Expo Go** (App Store o Google Play) y escanea el código QR que aparece en la terminal. El teléfono y el computador deben estar en la misma red Wi-Fi; si no lo están, usa `npx expo start --tunnel`.
- **Emulador Android**: pulsa `a` en la terminal (requiere Android Studio).
- **Navegador** (vista previa rápida): pulsa `w`.

## Versión web publicada

CineRank está publicada en **<https://cinerank.expo.app>** (Expo Hosting, cuenta `nicolasm21`): se abre en el navegador de cualquier teléfono o computador, sin instalar nada, y se puede «Añadir a pantalla de inicio». Cada persona pone sus propias claves en ⚙️ Ajustes (se guardan solo en su navegador).

Para publicar los cambios:

```bash
npx expo export --platform web
```

```bash
npx eas-cli@latest deploy --prod
```

## Comprobaciones

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run lint
```

## Publicar en las tiendas

Usa EAS Build, que compila en la nube y no necesita Xcode ni una Mac:

```bash
npx eas-cli@latest build --platform android
```

```bash
npx eas-cli@latest build --platform ios
```

Para iOS necesitas una cuenta de Apple Developer. Los identificadores `com.cinerank.app` de `app.json` son provisionales: cámbialos por unos tuyos antes de publicar.

## Estructura

```
src/
  app/                 Pantallas (Expo Router)
    (tabs)/index.tsx     Buscar
    (tabs)/ranking.tsx   Ranking y tabla comparativa
    (tabs)/compare.tsx   ¿Cuál es mejor? (títulos marcados, cara a cara)
    (tabs)/explore.tsx   Explorar (catálogo por plataforma con filtros)
    settings.tsx         Ajustes (se abre con ⚙️)
    movie/[id].tsx       Ficha de un título
  components/          Tarjetas, barras de puntuación, tabla, pestañas
  lib/
    omdb.ts              Cliente de OMDb con caché (une OMDb + MDBList)
    omdb-parse.ts        Conversión de las respuestas de OMDb
    mdblist.ts           Público de Rotten Tomatoes (MDBList)
    wikidata.ts          Títulos en español → ID de IMDb
    search.ts            Búsqueda combinada OMDb + Wikidata
    ranking.ts           Motor del CineScore (sin dependencias de React Native)
  store/app-store.tsx  Estado global guardado en el dispositivo
tests/                 Pruebas del motor de ranking (node --test)
```

---

IMDb y Rotten Tomatoes son marcas de sus respectivos dueños. CineRank no está afiliada a ellos.
