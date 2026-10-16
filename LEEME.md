# AquaProbe Mocaná · Archivos para GitHub Pages

## Instalación

1. Descomprime el ZIP. Los siete archivos están directamente en la raíz, sin subcarpetas.
2. En tu repositorio `monitoreo-calidad-agua`, sube los siete archivos juntos a la carpeta que publica GitHub Pages y reemplaza los anteriores.
3. Confirma los cambios y espera a que termine el despliegue.
4. Abre https://mconde24.github.io/monitoreo-calidad-agua/ y recarga con Ctrl+F5.

Los archivos son `index.html`, `styles.css`, `app.js`, `station.js`, `aquatrace-sensores.jpeg`, `entorno-estacion.jpeg` y este `LEEME.md`. No requiere instalación ni compilación. Las imágenes deben quedar junto a `index.html`. No se han enviado cambios a GitHub desde esta conversación.

## Distribución final

El encabezado muestra «AquaProbe Mocaná» sobre el banner fotográfico. Las opciones están en una barra lateral.

En Medidores, los grupos se presentan en este orden:

1. pH y temperatura: pH a la izquierda y temperatura a la derecha.
2. Oxigenación: oxígeno disuelto a la izquierda y saturación a la derecha.
3. Sales y mineralización, en dos filas:
   - Primera fila: sólidos disueltos a la izquierda y salinidad a la derecha.
   - Segunda fila: gravedad específica a la izquierda y conductividad a la derecha.

En escritorio, el mapa satelital está arriba a la derecha, junto a los grupos, y acompaña el desplazamiento. En pantallas más pequeñas pasa antes de los medidores. El mapa utiliza una vista híbrida de Google Maps, con imágenes satelitales y referencias del entorno; el enlace permite abrirla en otra pestaña.

El fondo del encabezado usa `aquatrace-sensores.jpeg`. Se conserva `entorno-estacion.jpeg` por si deseas usar esa fotografía como fondo: cambia `headerImage` en `station.js`.

## Lectura actual y resumen de los medidores

Cada tarjeta presenta la última lectura y tres cuadros: mínimo, máximo y promedio. El resumen se calcula inicialmente sobre la última hora y se puede cambiar desde la barra lateral: 15 o 30 minutos, 1 o 6 horas, 24 horas, o una duración personalizada de entre 1 y 10080 minutos.

La consulta se actualiza cada 30 segundos mientras la pestaña está visible. La lectura actual se obtiene del último valor válido de cada variable en los últimos 100 registros de ThingSpeak. El resumen usa una consulta separada para todo el periodo seleccionado, hasta el límite de 8000 registros.

El borde de la tarjeta y el cuadro del promedio cambian según la media aritmética del periodo, no según la última lectura. Se usan verde, ámbar y rojo cuando existe un criterio aplicable. Las variables sin umbral configurado mantienen un borde neutro, sin el mensaje «requiere referencia local». Una media fuera de la escala configurada se señala para revisión. Sin datos, se muestran guiones y borde neutro.

Las referencias implementadas son orientativas para ecosistemas naturales:

- pH en agua dulce: 6,5–9.
- pH en agua marina/estuarina: 6,5–8,5 como referencia general de agua salada, sujeta a la variabilidad natural y las condiciones del sitio.
- Oxígeno disuelto en el perfil de agua dulce: ≥5 mg/L, categoría alta; >3 y <5 mg/L, moderada; ≤3 mg/L, baja. Son categorías usadas para comparar lagos en National Lakes Assessment, no un umbral universal para todas las especies. No se aplican automáticamente al perfil marino/estuarino.

Estas referencias no certifican la salud del ecosistema, potabilidad ni las condiciones sanitarias de una piscina. Las otras variables no se clasifican como saludables usando intervalos universales. Los enlaces de las fuentes están en el desplegable «Rangos y fuentes».

## Series de tiempo

Un único selector «Periodo» define tanto los datos consultados como la extensión del eje temporal. Los periodos predefinidos se cargan automáticamente al cambiarlos. Para fechas exactas, elige «Personalizado», completa inicio y fin y pulsa «Actualizar».

Las gráficas ocupan el área principal. Cada una permite escala vertical automática o límites manuales. La escala automática usa las lecturas de todo el periodo cargado; los límites manuales se conservan al cambiar el periodo.

Para analizar un segmento, arrastra horizontalmente sobre una gráfica o escribe las fechas en el panel lateral de estadísticas. El mismo segmento se sombrea en las ocho gráficas. La tabla muestra n, media y mediana; el CSV de estadísticas incluye también mínimo y máximo. «Analizar todo el periodo» restablece el segmento a los límites de la consulta.

«Lecturas CSV» exporta las mediciones del periodo cargado completo. «Estadísticas CSV» exporta el segmento seleccionado. La consulta histórica permanece fija hasta cambiar el periodo o pulsar «Actualizar», para que el análisis no se mueva mientras trabajas. Los medidores se actualizan de forma independiente.

La media asigna igual peso a cada lectura válida, sin interpolar ni ponderar por tiempo. Se omiten campos vacíos y valores no numéricos; se incluyen los ceros. La mediana es el valor central, o el promedio de los dos centrales cuando n es par. Se incluyen ambos extremos del segmento. La interfaz muestra hasta dos decimales, excepto gravedad específica (cuatro); el CSV mantiene la precisión numérica disponible.

Las entradas y las fechas visibles utilizan la hora de Colombia (UTC−5), independientemente del país del navegador. Los CSV utilizan fecha ISO en UTC.

## Configuración y ubicación

En `station.js` puedes editar nombre, canal público, fondo del encabezado, coordenadas, zoom, perfil de agua y duración inicial del resumen (`defaultSummaryMinutes`, 60 por defecto). `staleAfterMinutes` indica cuándo avisar de que la última lectura es antigua: 15 minutos por defecto.

En `app.js`, el arreglo `variables` conserva los campos de ThingSpeak, unidades, colores y escalas del proyecto recibido. El orden visual de los medidores no altera la correspondencia entre campo y variable. Comprueba las escalas con las especificaciones de tus instrumentos.

El mapa usa como referencia cartográfica la piscina del Centro Deportivo Roble Amarillo de Uninorte: 11.01947°, −74.84595°. No es una lectura GPS del sensor ni una ubicación recuperada automáticamente de ThingSpeak.

Fuente de la ubicación: https://www.openstreetmap.org/way/1476599457
Referencia complementaria: https://mapcarta.com/es/W1476599457

## Límites y dependencias

ThingSpeak devuelve como máximo 8000 registros por consulta. Si se alcanza ese límite, se avisa de que el resumen o el historial pueden estar incompletos; reduce el periodo. Esta versión no incluye paginación. El historial personalizado admite hasta un año por consulta. Los fallos de conexión conservan las últimas lecturas válidas con sus fechas y un aviso.

Los datos del sitio final se consultan al canal público 3151173. No hay datos ilustrativos ni API keys en los archivos de producción. Todo archivo servido por GitHub Pages es público: no coloques credenciales en el código ni en la configuración.

Requiere Internet para ThingSpeak, Chart.js 4.4.8 (CDN) y Google Maps. El código no requiere una clave para estas consultas públicas de datos o la vista de mapa incrustada.

## Fuentes de los rangos

- EPA, criterios de vida acuática y pH: https://www.epa.gov/wqc/national-recommended-water-quality-criteria-aquatic-life-criteria-table
- EPA, contexto del pH: https://www.epa.gov/caddis/ph
- EPA, categorías de oxígeno en lagos: https://archive.epa.gov/water/archive/web/html/lakessurvey_faq.html

## Verificación

Se verificaron sintaxis, referencias de archivos, distribución de los campos en grupos, resúmenes por intervalo, medias y medianas, ceros y valores vacíos, alertas de la media independientes del dato actual, duraciones personalizadas, cambios de periodo, escalas verticales, exportación CSV, zona horaria y fallos de red con respuestas simuladas. Los archivos finales conservan la consulta real a ThingSpeak. No se realizó una prueba visual de la página publicada en un navegador en este entorno.
